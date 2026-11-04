import { generateSecretKey, getPublicKey, finalizeEvent, verifyEvent, type Event } from 'nostr-tools/pure';
import { v2 } from 'nostr-tools/nip44';
import { PEER_PREFIX, MAX_PARTICIPANTS } from './live-protocol.mjs';

// NIP-01 ephemeral events (20000–29999), NIP-44 encryption. No account or
// embedded service credential. Every page creates a temporary keypair in RAM.
// Only a room identifier and temporary public keys are visible to the relays.
export const RELAYS = ['wss://relay.damus.io', 'wss://nos.lol'];
const KIND = 20049;
const CHANNEL = 'aeb-risk-transient-v1:';
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export type RelayIdentity = { secret: Uint8Array; publicKey: string };
export function createRelayIdentity(): RelayIdentity { const secret = generateSecretKey(); return { secret, publicKey: getPublicKey(secret) }; }
export function roomCodeForKey(publicKey: string) {
  if (!/^[a-f0-9]{64}$/.test(publicKey)) return '';
  let n = BigInt(`0x${publicKey.slice(0, 15)}`); let code = '';
  for (let i = 0; i < 12; i++) { code = ALPHABET[Number(n & 31n)] + code; n >>= 5n; }
  return code;
}
export class Signals {
  private listeners = new Map<string, Set<(...args: any[]) => void>>();
  on(name: string, listener: (...args: any[]) => void) { if (!this.listeners.has(name)) this.listeners.set(name, new Set()); this.listeners.get(name)!.add(listener); return this; }
  emit(name: string, ...args: any[]) { for (const fn of this.listeners.get(name) || []) fn(...args); }
}
type Packet = { type: 'connect' | 'accept' | 'data' | 'close'; id: string; seq: number; data?: unknown };
export class RelayConnection extends Signals {
  open = false;
  private closed = false;
  private sequence = 0;
  private received = -1;
  constructor(readonly peer: string, readonly id: string, private owner: RelayPeer) { super(); }
  activate() { if (!this.closed && !this.open) { this.open = true; this.owner.connected(this); this.emit('open'); } }
  deliver(packet: Packet) {
    if (this.closed || !Number.isSafeInteger(packet.seq) || packet.seq <= this.received) return;
    this.received = packet.seq;
    if (packet.type === 'accept') this.activate();
    else if (packet.type === 'close') this.close(false);
    else if (packet.type === 'data' && this.open) this.emit('data', packet.data);
  }
  send(data: unknown) { if (this.open) this.owner.transmit(this.peer, { type: 'data', id: this.id, seq: ++this.sequence, data }); }
  accept() { if (!this.closed) this.owner.transmit(this.peer, { type: 'accept', id: this.id, seq: ++this.sequence }); }
  request() { if (!this.closed && !this.open) this.owner.transmit(this.peer, { type: 'connect', id: this.id, seq: ++this.sequence }); }
  close(notify = true) {
    if (this.closed) return;
    if (notify) this.owner.transmit(this.peer, { type: 'close', id: this.id, seq: ++this.sequence });
    this.closed = true; this.open = false; this.owner.forget(this); this.emit('close');
  }
}

export class RelayPeer extends Signals {
  readonly identity: RelayIdentity;
  open = false;
  destroyed = false;
  disconnected = false;
  private code = '';
  private host: boolean;
  private sockets = new Map<string, WebSocket>();
  private retries = new Map<string, ReturnType<typeof setTimeout>>();
  private seen = new Set<string>();
  private connections = new Map<string, RelayConnection>();
  private waiting = new Set<RelayConnection>();
  private keys = new Map<string, Uint8Array>();
  private hostKey = '';
  private announceAt = 0;
  private heartbeat?: ReturnType<typeof setInterval>;
  constructor(readonly id: string, identity: RelayIdentity, private endpoints = RELAYS, private socketFactory = (url: string) => new WebSocket(url)) {
    super(); this.identity = { publicKey: identity.publicKey, secret: identity.secret.slice() }; this.host = id.startsWith(PEER_PREFIX);
    if (this.host) this.enter(id.slice(PEER_PREFIX.length));
    else { this.open = true; queueMicrotask(() => this.emit('open', id)); }
  }
  private enter(code: string) {
    if (this.destroyed || this.code) return;
    this.code = code;
    for (const endpoint of this.endpoints) this.attach(endpoint);
    this.heartbeat = setInterval(() => {
      if (this.host) this.announce();
      else { this.discover(); for (const c of this.waiting) c.request(); }
    }, 4000);
  }
  private attach(endpoint: string) {
    if (this.destroyed || this.sockets.has(endpoint)) return;
    let socket: WebSocket;
    try { socket = this.socketFactory(endpoint); } catch { this.retry(endpoint); return; }
    this.sockets.set(endpoint, socket);
    const timeout = setTimeout(() => { if (socket.readyState !== 1) socket.close(); }, 15000);
    socket.addEventListener('open', () => {
      if (this.destroyed || this.sockets.get(endpoint) !== socket) return;
      clearTimeout(timeout);
      socket.send(JSON.stringify(['REQ', 'aeb-live', { kinds: [KIND], '#r': [CHANNEL + this.code], since: Math.floor(Date.now() / 1000) - 15 }]));
      this.open = true; this.disconnected = false; this.emit('open', this.id);
      if (this.host) this.announce(true); else { this.discover(); for (const c of this.waiting) c.request(); }
    });
    socket.addEventListener('message', event => {
      if (typeof event.data !== 'string' || event.data.length > 40000 || this.destroyed) return;
      try {
        const message = JSON.parse(event.data);
        if (message[0] === 'EVENT') this.receive(message[2]);
        // Refusal is not successful delivery. Other relays and application ACKs
        // remain in use; no participant is marked connected by an OK message.
        if (message[0] === 'CLOSED') { socket.close(); }
      } catch { /* Ignore malformed or unrelated public traffic. */ }
    });
    socket.addEventListener('error', () => { /* close triggers bounded reconnect. */ });
    socket.addEventListener('close', () => {
      clearTimeout(timeout);
      if (this.sockets.get(endpoint) !== socket) return;
      this.sockets.delete(endpoint);
      if (!this.destroyed && ![...this.sockets.values()].some(s => s.readyState === 1)) {
        this.open = false; this.disconnected = true;
        for (const c of [...this.connections.values()]) c.close(false);
        this.emit('disconnected');
      }
      this.retry(endpoint);
    });
  }
  private retry(endpoint: string) {
    if (this.destroyed || this.retries.has(endpoint)) return;
    this.retries.set(endpoint, setTimeout(() => { this.retries.delete(endpoint); this.attach(endpoint); }, 3000));
  }
  private publish(content: string, to?: string, announce = false) {
    if (this.destroyed || !this.code || content.length > 24000) return;
    const tags = [['r', CHANNEL + this.code], ['expiration', String(Math.floor(Date.now() / 1000) + 60)]];
    if (to) tags.push(['p', to]);
    if (announce) tags.push(['t', 'announce']);
    const event = finalizeEvent({ kind: KIND, created_at: Math.floor(Date.now() / 1000), tags, content }, this.identity.secret);
    const wire = JSON.stringify(['EVENT', event]);
    for (const socket of this.sockets.values()) if (socket.readyState === 1) socket.send(wire);
  }
  private announce(force = false) {
    if (!this.host || !force && Date.now() - this.announceAt < 3000) return;
    this.announceAt = Date.now(); this.publish(JSON.stringify({ aeb: 1, type: 'announce', nonce: crypto.randomUUID() }), undefined, true);
  }
  private discover() {
    if (!this.hostKey && this.waiting.size) this.publish(JSON.stringify({ aeb: 1, type: 'discover', nonce: crypto.randomUUID() }));
  }
  private conversation(other: string) {
    let key = this.keys.get(other);
    if (!key && this.keys.size < MAX_PARTICIPANTS + 10) { key = v2.utils.getConversationKey(this.identity.secret, other); this.keys.set(other, key); }
    return key;
  }
  transmit(to: string, packet: Packet) {
    if (!/^[a-f0-9]{64}$/.test(to)) return;
    const key = this.conversation(to);
    if (key) this.publish(v2.encrypt(JSON.stringify(packet), key), to);
  }
  private receive(event: Event) {
    if (!event || event.kind !== KIND || typeof event.content !== 'string' || event.content.length > 24000 || Math.abs(Date.now() / 1000 - event.created_at) > 75 || !event.tags?.some(t => t[0] === 'r' && t[1] === CHANNEL + this.code) || this.seen.has(event.id) || !verifyEvent(event)) return;
    this.seen.add(event.id); if (this.seen.size > 2048) this.seen.delete(this.seen.values().next().value!);
    if (event.pubkey === this.identity.publicKey) return;
    const recipient = event.tags.find(t => t[0] === 'p')?.[1];
    if (!recipient) {
      const data = JSON.parse(event.content);
      if (data.aeb !== 1) return;
      if (this.host && data.type === 'discover') this.announce();
      if (!this.host && data.type === 'announce' && roomCodeForKey(event.pubkey) === this.code) {
        this.hostKey = event.pubkey;
        for (const c of [...this.waiting]) {
          if (c.peer === this.hostKey) { c.request(); continue; }
          this.connections.delete(c.id); const ready = new RelayConnection(this.hostKey, c.id, this);
          this.connections.set(c.id, ready); this.waiting.delete(c); this.waiting.add(ready); c.emit('resolved', ready); ready.request();
        }
      }
      return;
    }
    if (recipient !== this.identity.publicKey || !this.host && event.pubkey !== this.hostKey) return;
    const key = this.conversation(event.pubkey); if (!key) return;
    const packet = JSON.parse(v2.decrypt(event.content, key)) as Packet;
    if (!packet || typeof packet.id !== 'string' || !/^[a-f0-9-]{36}$/.test(packet.id) || !Number.isSafeInteger(packet.seq) || packet.seq < 1) return;
    if (this.host && packet.type === 'connect') {
      let c = this.connections.get(packet.id);
      if (c && c.peer !== event.pubkey) return;
      if (!c) {
        if (this.connections.size >= MAX_PARTICIPANTS + 10) return;
        c = new RelayConnection(event.pubkey, packet.id, this); this.connections.set(packet.id, c);
        this.emit('connection', c); c.activate();
      }
      c.accept(); return;
    }
    const connection = this.connections.get(packet.id);
    if (connection?.peer === event.pubkey) connection.deliver(packet);
  }
  connect(peer: string, _options?: unknown): RelayConnection {
    const code = peer.slice(PEER_PREFIX.length); this.enter(code);
    const id = crypto.randomUUID(); const connection = new RelayConnection(this.hostKey, id, this);
    this.connections.set(id, connection);
    this.waiting.add(connection);
    if (this.hostKey) connection.request(); else this.discover();
    return connection;
  }
  connected(connection: RelayConnection) { this.waiting.delete(connection); }
  forget(connection: RelayConnection) { if (this.connections.get(connection.id) === connection) this.connections.delete(connection.id); this.waiting.delete(connection); }
  reconnect() { if (!this.destroyed) for (const endpoint of this.endpoints) this.attach(endpoint); }
  destroy() {
    if (this.destroyed) return; this.destroyed = true; this.open = false;
    clearInterval(this.heartbeat); for (const t of this.retries.values()) clearTimeout(t); this.retries.clear();
    for (const c of [...this.connections.values()]) c.close(false);
    for (const socket of this.sockets.values()) socket.close(); this.sockets.clear();
    for (const key of this.keys.values()) key.fill(0); this.keys.clear(); this.identity.secret.fill(0); this.seen.clear(); this.emit('close');
  }
}

type Link = { open: boolean; peer: string; on: (event: string, fn: (...args: any[]) => void) => any; send: (data: any) => void; close: () => void };
type DirectPeer = { open?: boolean; destroyed: boolean; disconnected: boolean; on: (event: string, fn: (...args: any[]) => void) => any; connect: (id: string, options: any) => Link; reconnect: () => void; destroy: () => void };
class FallbackConnection extends Signals {
  open = false;
  private current?: Link;
  private ended = false;
  private fallbackTimer?: ReturnType<typeof setTimeout>;
  constructor(readonly peer: string, direct: DirectPeer, private relay: RelayPeer, options: any) {
    super();
    if (direct.open && !direct.disconnected && !direct.destroyed) {
      try { const c = direct.connect(peer, options); this.bind(c, () => this.useRelay()); this.fallbackTimer = setTimeout(() => { if (!this.open) this.useRelay(); }, 3000); }
      catch { queueMicrotask(() => this.useRelay()); }
    } else queueMicrotask(() => this.useRelay());
  }
  private bind(connection: Link, failed?: () => void) {
    this.current = connection;
    connection.on('resolved', (resolved: Link) => { if (this.current === connection && !this.ended) this.bind(resolved); else resolved.close(); });
    connection.on('open', () => { if (this.current === connection && !this.ended) { clearTimeout(this.fallbackTimer); this.open = true; this.emit('open'); } });
    connection.on('data', data => { if (this.current === connection && !this.ended) this.emit('data', data); });
    const closed = () => { if (this.current !== connection || this.ended) return; if (!this.open && failed) failed(); else this.close(); };
    connection.on('close', closed); connection.on('error', closed);
  }
  private useRelay() {
    if (this.ended || this.open || this.current instanceof RelayConnection) return;
    clearTimeout(this.fallbackTimer); const previous = this.current; this.current = undefined; previous?.close();
    this.bind(this.relay.connect(this.peer));
  }
  send(data: unknown) { if (this.open && !this.ended) this.current?.send(data); }
  close() { if (this.ended) return; this.ended = true; this.open = false; clearTimeout(this.fallbackTimer); this.current?.close(); this.emit('close'); }
}
export class FallbackPeer extends Signals {
  open = false;
  destroyed = false;
  get disconnected() { return this.direct.disconnected && this.relay.disconnected; }
  constructor(private direct: DirectPeer, private relay: RelayPeer) {
    super();
    const opened = () => { if (!this.destroyed) { this.open = true; this.emit('open'); } };
    for (const peer of [direct, relay]) {
      peer.on('open', opened); peer.on('connection', c => { if (!this.destroyed) this.emit('connection', c); else c.close(); });
      peer.on('disconnected', () => { if (!this.destroyed && this.disconnected) this.emit('disconnected'); });
      peer.on('error', () => { if (!this.destroyed && this.disconnected) this.emit('error', { type: 'network' }); });
    }
    if (direct.open || relay.open) this.open = true;
  }
  connect(id: string, options: any) { return new FallbackConnection(id, this.direct, this.relay, options); }
  reconnect() { if (this.direct.disconnected && !this.direct.destroyed) this.direct.reconnect(); this.relay.reconnect(); }
  destroy() { if (this.destroyed) return; this.destroyed = true; this.open = false; this.direct.destroy(); this.relay.destroy(); this.emit('close'); }
}
