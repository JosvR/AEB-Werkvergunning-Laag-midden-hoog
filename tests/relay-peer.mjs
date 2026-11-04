import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdir, rm } from 'node:fs/promises';
import { v2 } from 'nostr-tools/nip44';
import { generateSecretKey } from 'nostr-tools/pure';
await mkdir('.test-relay', { recursive: true });
await build({ entryPoints:['src/relay-peer.ts','src/live-session.ts'], outdir:'.test-relay', outExtension:{'.js':'.mjs'}, bundle:true, platform:'node', format:'esm', packages:'external' });
const { Signals, RelayPeer, FallbackPeer, createRelayIdentity, roomCodeForKey } = await import('../.test-relay/relay-peer.mjs');
const { TrainerSession, LearnerSession } = await import('../.test-relay/live-session.mjs');
after(() => rm('.test-relay',{recursive:true,force:true}));
const flush = async()=>{for(let i=0;i<40;i++) await Promise.resolve();};
function broker() {
  const clients=new Set();const wire=[];
  class Socket extends Signals {
    readyState=0;filters=[];
    constructor(){super();clients.add(this);queueMicrotask(()=>{this.readyState=1;this.emit('open')});}
    addEventListener(name,fn){this.on(name,fn)}
    send(raw){
      const m=JSON.parse(raw);
      if(m[0]==='REQ'){this.filters=m.slice(2);return;}
      if(m[0]!=='EVENT')return;wire.push(m[1]);
      for(const c of clients) if(c.readyState===1&&c.filters.some(f=>f.kinds.includes(m[1].kind)&&m[1].tags.some(t=>t[0]==='r'&&f['#r'].includes(t[1]))))
        queueMicrotask(()=>{if(c.readyState===1)c.emit('message',{data:JSON.stringify(['EVENT','aeb-live',m[1]])});});
    }
    close(){if(this.readyState===3)return;this.readyState=3;clients.delete(this);this.emit('close');}
  }
  class NoDirect extends Signals {open=false;destroyed=false;disconnected=true;connect(){throw Error('ICE geblokkeerd')}reconnect(){}destroy(){this.destroyed=true}}
  const peers=[],directs=[];
  const factory=async(id,identity)=>{const direct=new NoDirect();directs.push(direct);const peer=new FallbackPeer(direct,new RelayPeer(id||'guest-'+crypto.randomUUID(),identity,['wss://fixture.invalid'],()=>new Socket()));peers.push(peer);return peer;};
  return {factory,wire,clients,peers,directs};
}
test('zonder werkende WebRTC: twee deelnemers, antwoorden, ACK, nabespreking en wissen via versleutelde tijdelijke berichten',async t=>{
  t.mock.timers.enable({apis:['setTimeout','setInterval','Date'],now:100000});
  const net=broker();let h,a,b;
  const host=new TrainerSession(s=>h=s,net.factory);await host.start();await flush();
  const first=new LearnerSession(h.code,s=>a=s,net.factory),second=new LearnerSession(h.code,s=>b=s,net.factory);
  try {
    await first.start('Test Anna');await second.start('Test Bram');await flush();t.mock.timers.tick(4000);await flush();
    assert.equal(a.status,'connected');assert.equal(b.status,'connected');assert.equal(h.participants.length,2);
    // A delayed incoming PeerJS object from the abandoned ICE route must not
    // start a pending-participant warning after successful relay enrollment.
    net.directs[0].emit('connection',Object.assign(new Signals(),{open:false,close(){this.emit('close')}}));
    for(let i=0;i<9;i++){t.mock.timers.tick(4000);await flush();}
    assert.equal(h.error,'');assert.equal(a.status,'connected');
    first.update({answers:{1:1,2:2},current:3,finished:false});second.update({answers:{1:4},current:2,finished:false});await flush();
    assert.deepEqual(h.participants.find(p=>p.name==='Test Anna').answers,{1:1,2:2});
    assert.equal(a.acknowledged,a.progress.revision);
    assert.equal(net.wire.every(e=>e.kind>=20000&&e.kind<30000),true);
    assert.equal(net.wire.every(e=>e.tags.some(t=>t[0]==='expiration')),true);
    assert.doesNotMatch(JSON.stringify(net.wire),/Test Anna|Test Bram|answers|revision/,'Namen en antwoorden mogen niet leesbaar door de relay gaan.');
    const encrypted=net.wire.find(e=>e.tags.some(t=>t[0]==='p'));
    const other=createRelayIdentity();
    assert.throws(()=>v2.decrypt(encrypted.content,v2.utils.getConversationKey(other.secret,encrypted.pubkey)),'Een derde deelnemer kan niet ontsleutelen.');
    host.review(4,true);await flush();assert.equal(a.question,4);assert.equal(b.revealed,true);
    host.resume();await flush();assert.equal(a.phase,'practice');
    host.close();await flush();assert.equal(a.status,'closed');assert.deepEqual(a.progress.answers,{});assert.deepEqual(h.participants,[]);t.mock.timers.tick(1000);await flush();
  }finally{first.dispose();second.dispose();host.close(true);t.mock.timers.reset();}
});
test('sessiecode bindt de openbare trainerssleutel; nieuwe lessen hebben andere codes',()=>{
 const a=createRelayIdentity(),b=createRelayIdentity();assert.match(roomCodeForKey(a.publicKey),/^[A-HJ-NP-Z2-9]{12}$/);assert.notEqual(roomCodeForKey(a.publicKey),roomCodeForKey(b.publicKey));assert.equal(roomCodeForKey('invalid'),'');
});

test('na verlies van alle WebSockets worden dezelfde deelnemers en onderweg gekozen antwoorden hersteld',async t=>{
 t.mock.timers.enable({apis:['setTimeout','setInterval','Date'],now:100000});
 const net=broker();let h,g;
 const host=new TrainerSession(s=>h=s,net.factory);await host.start();await flush();
 const guest=new LearnerSession(h.code,s=>g=s,net.factory);
 try{
  await guest.start('Test herstel');await flush();t.mock.timers.tick(4000);await flush();
  assert.equal(g.status,'connected');const id=h.participants[0].id;
  guest.update({answers:{1:2},current:1,finished:false});await flush();
  for(const c of [...net.clients])c.close();await flush();assert.equal(g.status,'reconnecting');
  guest.update({answers:{1:4,2:2},current:3,finished:false});
  t.mock.timers.tick(5000);await flush();t.mock.timers.tick(5000);await flush();
  assert.equal(g.status,'connected');assert.equal(h.participants.length,1);assert.equal(h.participants[0].id,id);
  assert.deepEqual(h.participants[0].answers,{1:4,2:2});assert.equal(g.acknowledged,g.progress.revision);
 }finally{guest.dispose();host.close(true);t.mock.timers.reset();}
});

test('na vernietigen van het transport blijft de sessiesleutel bruikbaar voor herbouw met dezelfde code',async t=>{
 t.mock.timers.enable({apis:['setTimeout','setInterval','Date'],now:100000});
 const net=broker();let h,g;
 const host=new TrainerSession(s=>h=s,net.factory);await host.start();await flush();
 const guest=new LearnerSession(h.code,s=>g=s,net.factory);
 try{
  await guest.start('Test herbouw');await flush();t.mock.timers.tick(4000);await flush();
  const code=h.code;guest.update({answers:{1:2},current:2,finished:false});await flush();
  for(const peer of [...net.peers])peer.destroy();await flush();
  for(let i=0;i<6;i++){t.mock.timers.tick(5000);await flush();}
  assert.equal(h.code,code);assert.equal(g.status,'connected');assert.equal(h.participants.length,1);
  assert.deepEqual(h.participants[0].answers,{1:2});assert.equal(g.acknowledged,g.progress.revision);
 }finally{guest.dispose();host.close(true);t.mock.timers.reset();}
});
