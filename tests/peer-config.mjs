import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdir, rm } from 'node:fs/promises';

test('trainer en deelnemer gebruiken de VCH-transportinstellingen zonder extra aanbieder of sleutel', async () => {
  await mkdir('.test-peer', { recursive: true });
  after(() => rm('.test-peer', { recursive: true, force: true }));
  await build({ entryPoints: ['src/live-session.ts'], outfile: '.test-peer/session.mjs', bundle: true, platform: 'node', format: 'esm', plugins: [{
    name: 'capture-peer-options', setup(builder) {
      builder.onResolve({ filter: /^peerjs$/ }, () => ({ path: 'peerjs', namespace: 'capture' }));
      builder.onLoad({ filter: /.*/, namespace: 'capture' }, () => ({ contents: `
        import { EventEmitter } from 'node:events';
        export const util = { defaultConfig: {
          iceServers: [{urls: 'stun:example.invalid:19302'}, {urls: ['turn:example.invalid:3478'], username: 'test-fixture'}],
          sdpSemantics: 'unified-plan'
        }};
        export default class Peer extends EventEmitter {
          open = true; destroyed = false; disconnected = false;
          constructor(id, options) { super(); globalThis.capturedPeers.push({id, options}); }
          connect() { const c = new EventEmitter(); c.open = false; c.close = () => {}; c.send = () => {}; return c; }
          destroy() { this.destroyed = true; }
        }`, loader: 'js' }));
    },
  }] });
  globalThis.capturedPeers = [];
  const { TrainerSession, LearnerSession } = await import('../.test-peer/session.mjs');
  let state;
  const host = new TrainerSession(s => state = s);
  const guest = new LearnerSession('ABCDEFGH2345', () => {});
  try {
    await host.start(); await guest.start('Test');
    assert.equal(state.status, 'ready');
    assert.equal(globalThis.capturedPeers.length, 2);
    for (const { options } of globalThis.capturedPeers) {
      assert.equal(options.secure, true); assert.equal(options.debug, 0);
      assert.equal(options.config.sdpSemantics, 'unified-plan');
      assert.equal(options.config.iceServers.length, 3);
      assert.equal(options.config.iceServers[0].urls, 'stun:example.invalid:19302');
      assert.deepEqual(options.config.iceServers[1].urls, ['turn:example.invalid:3478']);
      assert.deepEqual(options.config.iceServers[2].urls, ['turn:example.invalid:3478?transport=tcp']);
      assert.doesNotMatch(JSON.stringify(options), /openrelay|metered/);
    }
  } finally { host.close(true); guest.dispose(); delete globalThis.capturedPeers; }
});
