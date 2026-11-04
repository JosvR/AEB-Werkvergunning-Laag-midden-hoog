import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { build } from 'esbuild';
import { mkdir, rm } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import questions from '../src/questions.json' with { type: 'json' };
import { answerMask } from '../src/quiz-core.mjs';
import { PROTOCOL, normalizeCode, readRoomCode, joinUrl, validateProgress, questionStats, STALE_MS, LOST_MS } from '../src/live-protocol.mjs';
await mkdir('.test-runtime', { recursive: true });
await build({ entryPoints: ['src/live-session.ts'], outfile: '.test-runtime/live-session.mjs', bundle: true, platform: 'node', format: 'esm', packages: 'external' });
const { TrainerSession, LearnerSession } = await import(pathToFileURL(resolve('.test-runtime/live-session.mjs')).href);
after(() => rm('.test-runtime', { recursive: true, force: true }));
const flush = async () => { for (let i = 0; i < 18; i++) await Promise.resolve(); };

function broker({ connectionDelay = 0 } = {}) {
  const peers = new Map(); let next = 0;
  class Connection extends EventEmitter {
    open = false; closed = false; peer; remote;
    constructor(peer) { super(); this.peer = peer; }
    send(data) { if (this.open) queueMicrotask(() => { if (this.remote.open) this.remote.emit('data', structuredClone(data)); }); }
    close() { if (this.closed) return; this.closed = true; this.open = false; this.emit('close'); if (!this.remote.closed) { this.remote.closed = true; this.remote.open = false; this.remote.emit('close'); } }
  }
  class Peer extends EventEmitter {
    open = false; destroyed = false; disconnected = false; connections = [];
    constructor(id) { super(); this.id = id; }
    connect(id) {
      const local = new Connection(id); const remote = new Connection(this.id); local.remote = remote; remote.remote = local;
      this.connections.push(local);
      queueMicrotask(() => {
        const other = peers.get(id);
        if (!other || other.destroyed) { this.emit('error', { type: 'peer-unavailable' }); return; }
        other.connections.push(remote); other.emit('connection', remote);
        const open = () => { if (local.closed || remote.closed) return; local.open = remote.open = true; remote.emit('open'); local.emit('open'); };
        if (connectionDelay) setTimeout(open, connectionDelay); else queueMicrotask(open);
      });
      return local;
    }
    reconnect() { this.disconnected = false; queueMicrotask(() => this.emit('open', this.id)); }
    destroy() { this.destroyed = true; peers.delete(this.id); this.connections.forEach(c => c.close()); }
  }
  const factory = async id => {
    const peer = new Peer(id || `guest-${++next}`); peers.set(peer.id, peer);
    // The caller must attach handlers before the simulated signaling server replies.
    queueMicrotask(() => queueMicrotask(() => { peer.open = true; peer.emit('open', peer.id); }));
    return peer;
  };
  return { factory, peers };
}

test('sessiecodes, relatieve publicatie-URL en antwoordvalidatie', () => {
  assert.equal(normalizeCode('abcd - efgh - 2345'), 'ABCDEFGH2345');
  assert.equal(normalizeCode('invalid'), '');
  assert.equal(readRoomCode(joinUrl('https://example.org/training/?trainer=1', 'ABCDEFGH2345')), 'ABCDEFGH2345');
  assert.equal(new URL(joinUrl('https://example.org/sub/index.html', 'ABCDEFGH2345')).pathname, '/sub/index.html');
  const base = { revision: 1, answers: { 1: 1 }, current: 1, finished: false };
  assert.ok(validateProgress(base, questions));
  assert.equal(validateProgress({ ...base, answers: { 1: 3 } }, questions), null);
  assert.equal(validateProgress({ ...base, answers: { 99: 1 } }, questions), null);
  assert.equal(validateProgress({ ...base, finished: true }, questions), null);
  assert.equal(validateProgress({ ...base, revision: Infinity }, questions), null);
});

test('twee deelnemers, live ontvangst, alle tien categorieën, selectie, verbergen en wissen', async () => {
  const net = broker(); let hostState; let firstState; let secondState;
  const host = new TrainerSession(s => hostState = s, net.factory);
  await host.start(); await flush(); assert.equal(hostState.status, 'ready');
  const roomCode = hostState.code;
  const first = new LearnerSession(roomCode, s => firstState = s, net.factory);
  const second = new LearnerSession(roomCode, s => secondState = s, net.factory);
  try {
    await first.start('Jos'); await second.start('Test deelnemer'); await flush();
    assert.equal(firstState.status, 'connected'); assert.equal(secondState.status, 'connected');
    assert.equal(hostState.participants.length, 2); assert.equal(hostState.participants.filter(p => p.online).length, 2);
    assert.equal(hostState.revealed, false);
    let answers = {};
    for (const q of questions) {
      answers = { ...answers, [q.n]: answerMask(q.key) };
      first.update({ answers, current: q.n, finished: q.n === questions.length }); await flush();
      assert.equal(hostState.participants[0].answers[q.n], answerMask(q.key));
    }
    assert.equal(hostState.participants[0].finished, true);
    assert.equal(firstState.acknowledged, firstState.progress.revision);
    second.update({ answers: { 1: 1 }, current: 2, finished: false }); await flush();
    assert.equal(questionStats(questions[0], hostState.participants).received, 2);
    host.review(8, false); await flush();
    assert.equal(firstState.question, 8); assert.equal(secondState.phase, 'review'); assert.equal(firstState.revealed, false);
    const before = secondState.progress.revision;
    second.update({ answers: { 1: 2 }, current: 1, finished: false }); await flush();
    assert.equal(secondState.progress.revision, before, 'Tijdens nabespreking worden geen antwoorden gewijzigd.');
    host.review(8, true); await flush(); assert.equal(firstState.revealed, true);
    host.review(9, false); await flush(); assert.equal(firstState.revealed, false);
    host.resume(); await flush(); assert.equal(secondState.phase, 'practice');
    second.dispose(); await flush(); assert.equal(hostState.participants.filter(p => p.online).length, 1);
    host.close(); await flush();
    assert.equal(hostState.active, false); assert.deepEqual(hostState.participants, []); assert.equal(hostState.code, '');
    assert.equal(firstState.status, 'closed'); assert.equal(firstState.name, ''); assert.deepEqual(firstState.progress.answers, {});
    assert.equal(secondState.name, ''); assert.deepEqual(secondState.progress.answers, {});
  } finally { first.dispose(); second.dispose(); host.close(true); }
});

test('transport accepteert geen vervalste payload; een oude revisie overschrijft niets', async () => {
  const net = broker(); let state; let learnerState;
  const host = new TrainerSession(s => state = s, net.factory); await host.start(); await flush();
  const learner = new LearnerSession(state.code, s => learnerState = s, net.factory);
  await learner.start('<script>naam</script>'); await flush();
  try {
    learner.update({ answers: { 1: 2 }, current: 2, finished: false }); await flush();
    const guestPeer = [...net.peers.values()].find(p => p.id.startsWith('guest-'));
    const connection = guestPeer.connections[0];
    connection.send({ protocol: PROTOCOL, type: 'update', progress: { revision: 999, answers: { 1: 15 }, current: 1, finished: false } }); await flush();
    assert.equal(state.participants[0].answers[1], 2);
    connection.send({ protocol: PROTOCOL, type: 'update', progress: { revision: 0, answers: { 1: 1 }, current: 1, finished: false } }); await flush();
    assert.equal(state.participants[0].answers[1], 2);
    assert.equal(learnerState.progress.answers[1], 2);
  } finally { learner.dispose(); host.close(true); }
});

test('verbroken verbinding herstelt dezelfde deelnemer met alle ontvangen antwoorden', async t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: 100000 });
  const net = broker(); let state; let guest;
  const host = new TrainerSession(s => state = s, net.factory); await host.start(); await flush();
  const learner = new LearnerSession(state.code, s => guest = s, net.factory); await learner.start('Herstel'); await flush();
  try {
    learner.update({ answers: { 1: 4, 5: 2 }, current: 6, finished: false }); await flush();
    const id = state.participants[0].id;
    const guestPeer = [...net.peers.values()].find(p => p.id.startsWith('guest-'));
    guestPeer.connections[0].close(); await flush();
    assert.equal(guest.status, 'reconnecting'); assert.equal(state.participants[0].online, false);
    t.mock.timers.tick(35000); await flush();
    assert.equal(guest.status, 'connected'); assert.equal(state.participants.length, 1);
    assert.equal(state.participants[0].id, id); assert.equal(state.participants[0].online, true);
    assert.deepEqual(state.participants[0].answers, { 1: 4, 5: 2 });
  } finally { learner.dispose(); host.close(true); t.mock.timers.reset(); }
});

test('geen ontvangst van afsluitbericht: offline telefoon wist na timeout alsnog zijn geheugen', async t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: 100000 });
  const net = broker(); let state; let guest;
  const host = new TrainerSession(s => state = s, net.factory); await host.start(); await flush();
  const learner = new LearnerSession(state.code, s => guest = s, net.factory); await learner.start('Offline'); await flush();
  learner.update({ answers: { 1: 1 }, current: 1, finished: false }); await flush();
  const guestPeer = [...net.peers.values()].find(p => p.id.startsWith('guest-')); guestPeer.connections[0].close();
  host.close(true); await flush();
  t.mock.timers.tick(LOST_MS + 10000); await flush();
  assert.equal(guest.status, 'error'); assert.equal(guest.name, ''); assert.deepEqual(guest.progress.answers, {});
  learner.dispose(); t.mock.timers.reset();
});


test('nieuwe deelnemer met dezelfde naam verstoort bestaande deelnemers niet', async () => {
  const net = broker(); let state; let a; let b; let c;
  const host = new TrainerSession(s => state = s, net.factory); await host.start(); await flush();
  const one = new LearnerSession(state.code, s => a = s, net.factory);
  const two = new LearnerSession(state.code, s => b = s, net.factory);
  const three = new LearnerSession(state.code, s => c = s, net.factory);
  try {
    await one.start('Sam'); await two.start('Sam'); await flush();
    one.update({ answers: { 1: 2 }, current: 2, finished: false }); await flush();
    const firstId = state.participants[0].id;
    await three.start('Nieuwe deelnemer'); await flush();
    assert.equal(state.participants.length, 3);
    assert.equal(new Set(state.participants.map(p => p.id)).size, 3);
    assert.equal(a.status, 'connected'); assert.equal(b.status, 'connected'); assert.equal(c.status, 'connected');
    assert.deepEqual(state.participants.find(p => p.id === firstId).answers, { 1: 2 });
  } finally { one.dispose(); two.dispose(); three.dispose(); host.close(true); }
});

test('telefoon blijft kiezen bij korte uitval en verstuurt de laatste keuze na herstel', async t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: 100000 });
  const net = broker(); let state; let guest;
  const host = new TrainerSession(s => state = s, net.factory); await host.start(); await flush();
  const learner = new LearnerSession(state.code, s => guest = s, net.factory); await learner.start('Doorgaan'); await flush();
  try {
    learner.update({ answers: { 1: 1 }, current: 1, finished: false }); await flush();
    const id = state.participants[0].id;
    const peer = [...net.peers.values()].find(p => p.id.startsWith('guest-')); peer.connections.at(-1).close(); await flush();
    learner.update({ answers: { 1: 4, 2: 2 }, current: 3, finished: false });
    assert.deepEqual(guest.progress.answers, { 1: 4, 2: 2 });
    assert.ok(guest.acknowledged < guest.progress.revision);
    t.mock.timers.tick(6000); await flush();
    assert.equal(guest.status, 'connected'); assert.equal(state.participants.length, 1);
    assert.equal(state.participants[0].id, id);
    assert.deepEqual(state.participants[0].answers, { 1: 4, 2: 2 });
    assert.equal(guest.acknowledged, guest.progress.revision);
  } finally { learner.dispose(); host.close(true); t.mock.timers.reset(); }
});

test('trainer kan twee minuten pauzeren en dezelfde sessie met antwoorden hervatten', async t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: 100000 });
  const net = broker(); let state; let guest;
  const host = new TrainerSession(s => state = s, net.factory); await host.start(); await flush();
  const learner = new LearnerSession(state.code, s => guest = s, net.factory); await learner.start('Achtergrond'); await flush();
  try {
    learner.update({ answers: { 1: 2 }, current: 2, finished: false }); await flush();
    const code = state.code;
    // Simulate a paused trainer scheduler, while learner retry/heartbeat work continues.
    clearInterval(host.heartbeat);
    t.mock.timers.tick(120000); await flush();
    assert.notEqual(guest.status, 'error'); assert.equal(guest.name, 'Achtergrond');
    host.resumeConnection(); learner.resumeConnection(); await flush();
    assert.equal(state.code, code); assert.equal(guest.status, 'connected');
    assert.deepEqual(state.participants[0].answers, { 1: 2 });
    assert.deepEqual(guest.progress.answers, { 1: 2 });
  } finally { learner.dispose(); host.close(true); t.mock.timers.reset(); }
});

test('na een geschorste browser worden open kanalen eerst gepeild in plaats van direct gewist', async t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: 100000 });
  const net = broker(); let state; let guest;
  const host = new TrainerSession(s => state = s, net.factory); await host.start(); await flush();
  const learner = new LearnerSession(state.code, s => guest = s, net.factory); await learner.start('Hervatten'); await flush();
  try {
    clearInterval(host.heartbeat); clearInterval(learner.timer);
    t.mock.timers.tick(120000);
    host.tick(); learner.tick(); await flush();
    assert.equal(guest.status, 'connected'); assert.equal(state.participants[0].online, true);
  } finally { learner.dispose(); host.close(true); t.mock.timers.reset(); }
});

test('een fout bij een nieuwe deelnemer maakt de werkende trainerssessie niet ongeldig', async () => {
  const net = broker(); let state; let guest;
  const host = new TrainerSession(s => state = s, net.factory); await host.start(); await flush();
  const learner = new LearnerSession(state.code, s => guest = s, net.factory); await learner.start('Bestaand'); await flush();
  try {
    const trainerPeer = [...net.peers.values()].find(p => !p.id.startsWith('guest-'));
    trainerPeer.emit('error', { type: 'webrtc' }); await flush();
    assert.equal(state.status, 'ready'); assert.equal(guest.status, 'connected'); assert.equal(state.participants.length, 1);
    trainerPeer.emit('error', { type: 'peer-unavailable' }); await flush();
    assert.equal(state.status, 'ready');
  } finally { learner.dispose(); host.close(true); }
});

test('vernietigde signaling-peer wordt met dezelfde sessiecode hersteld', async t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: 100000 });
  const net = broker(); let state; let guest;
  const host = new TrainerSession(s => state = s, net.factory); await host.start(); await flush();
  const learner = new LearnerSession(state.code, s => guest = s, net.factory); await learner.start('Zelfde sessie'); await flush();
  try {
    learner.update({ answers: { 1: 4 }, current: 2, finished: false }); await flush();
    const code = state.code;
    const trainerPeer = [...net.peers.values()].find(p => !p.id.startsWith('guest-')); trainerPeer.destroy();
    host.resumeConnection(); await flush();
    learner.resumeConnection(); t.mock.timers.tick(6000); await flush();
    assert.equal(state.code, code); assert.equal(state.status, 'ready'); assert.equal(guest.status, 'connected');
    assert.equal(state.participants.length, 1); assert.deepEqual(state.participants[0].answers, { 1: 4 });
  } finally { learner.dispose(); host.close(true); t.mock.timers.reset(); }
});


test('trage verbindingsopbouw krijgt tijd en wordt niet door heartbeat of focus vervangen', async t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: 100000 });
  const net = broker({ connectionDelay: 20000 }); let state; let guest;
  const host = new TrainerSession(s => state = s, net.factory); await host.start(); await flush();
  const learner = new LearnerSession(state.code, s => guest = s, net.factory); await learner.start('Trage verbinding'); await flush();
  try {
    learner.update({ answers: { 1: 4 }, current: 2, finished: false });
    for (let i = 0; i < 3; i++) { t.mock.timers.tick(5000); await flush(); learner.resumeConnection(); }
    const peer = [...net.peers.values()].find(p => p.id.startsWith('guest-'));
    assert.equal(peer.connections.length, 1, 'Een lopende poging mag niet elke vijf seconden opnieuw beginnen.');
    t.mock.timers.tick(5000); await flush();
    assert.equal(guest.status, 'connected'); assert.equal(state.participants.length, 1);
    assert.deepEqual(state.participants[0].answers, { 1: 4 });
    assert.equal(guest.acknowledged, guest.progress.revision);
  } finally { learner.dispose(); host.close(true); t.mock.timers.reset(); }
});

test('ook een mislukte eerste transportinitialisatie herstelt automatisch met dezelfde code', async t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: 100000 });
  const net = broker(); let state; let calls = 0;
  const host = new TrainerSession(s => state = s, async id => {
    if (++calls === 1) throw new Error('Tijdelijk geen internet');
    return net.factory(id);
  });
  try {
    await host.start(); await flush(); const code = state.code;
    assert.equal(state.status, 'reconnecting');
    t.mock.timers.tick(5000); await flush();
    assert.equal(state.status, 'ready'); assert.equal(state.code, code); assert.equal(calls, 2);
  } finally { host.close(true); t.mock.timers.reset(); }
});
