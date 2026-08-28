import type { DidAccount } from "./did";
import { b64uEncode, b64uDecode } from "./did";

export interface Envelope {
  v: 1;
  from: string;
  pub: JsonWebKey;
  ts: number;
  type: string;
  payload: unknown;
  sig: string;
}

export interface PeerInfo {
  did: string;
  alias: string;
  rtt: number;
  since: number;
}

type Handler = (env: Envelope, peerDid: string) => void;

const ICE = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

const waitIce = (pc: RTCPeerConnection): Promise<void> =>
  new Promise((resolve) => {
    if (pc.iceGatheringState === "complete") {
      resolve();
      return;
    }
    const check = () => {
      if (pc.iceGatheringState === "complete") {
        pc.removeEventListener("icegatheringstatechange", check);
        resolve();
      }
    };
    pc.addEventListener("icegatheringstatechange", check);
    setTimeout(resolve, 1500);
  });

export class MeshNode {
  private peers = new Map<string, RTCDataChannel>();
  private aliases = new Map<string, string>();
  private rtts = new Map<string, number>();
  private since = new Map<string, number>();
  private wiring = new Map<RTCDataChannel, RTCPeerConnection>();
  private handlers = new Map<string, Set<Handler>>();
  private pendingPc: RTCPeerConnection | null = null;
  private alias = "node";
  private pingInt = 0;

  constructor(private did: DidAccount) {}

  setAlias(a: string): void {
    this.alias = a;
  }

  on(type: string, fn: Handler): () => void {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set());
    this.handlers.get(type)!.add(fn);
    return () => {
      this.handlers.get(type)?.delete(fn);
    };
  }

  private emit(type: string, env: Envelope, peer: string): void {
    this.handlers.get(type)?.forEach((fn) => fn(env, peer));
    this.handlers.get("*")?.forEach((fn) => fn(env, peer));
  }

  async createInvitation(): Promise<string> {
    const pc = new RTCPeerConnection({ iceServers: ICE });
    this.pendingPc = pc;
    const dc = pc.createDataChannel("studio-mesh");
    this.wire(pc, dc);
    await pc.setLocalDescription(await pc.createOffer());
    await waitIce(pc);
    return this.encode({ t: "o", sdp: pc.localDescription?.sdp ?? "" });
  }

  async acceptInvitation(code: string): Promise<string> {
    const { sdp } = this.decode(code);
    const pc = new RTCPeerConnection({ iceServers: ICE });
    pc.ondatachannel = (e) => this.wire(pc, e.channel);
    await pc.setRemoteDescription({ type: "offer", sdp });
    await pc.setLocalDescription(await pc.createAnswer());
    await waitIce(pc);
    return this.encode({ t: "a", sdp: pc.localDescription?.sdp ?? "" });
  }

  async join(code: string): Promise<void> {
    if (!this.pendingPc) throw new Error("no pending invitation");
    const { sdp } = this.decode(code);
    await this.pendingPc.setRemoteDescription({ type: "answer", sdp });
    this.pendingPc = null;
  }

  private wire(pc: RTCPeerConnection, dc: RTCDataChannel): void {
    this.wiring.set(dc, pc);
    dc.onopen = () => void this.sendRaw(dc, "hello", { alias: this.alias, kind: "user" });
    dc.onmessage = (e) => void this.receive(String(e.data), dc);
    dc.onclose = () => this.drop(dc);
  }

  private async receive(raw: string, dc: RTCDataChannel): Promise<void> {
    let env: Envelope;
    try {
      env = JSON.parse(raw) as Envelope;
    } catch {
      return;
    }
    if (env.v !== 1 || !env.from || !env.sig) return;
    if (env.from === this.did.profile?.did) return;
    const ok = await this.did.verify(env.from, env.pub, `${env.from}|${env.ts}|${env.type}|${JSON.stringify(env.payload)}`, env.sig);
    if (!ok) return;

    if (env.type === "hello") {
      if (!this.peers.has(env.from)) {
        this.peers.set(env.from, dc);
        this.wiring.delete(dc);
        const p = env.payload as { alias?: string };
        this.aliases.set(env.from, p.alias ?? env.from.slice(8, 16));
        this.since.set(env.from, Date.now());
        this.emit("peer-joined", env, env.from);
      }
      return;
    }
    if (!this.peers.has(env.from)) return;
    if (env.type === "ping") {
      await this.send(env.from, "pong", { t: (env.payload as { t: number }).t });
      return;
    }
    if (env.type === "pong") {
      this.rtts.set(env.from, Date.now() - (env.payload as { t: number }).t);
      return;
    }
    this.emit(env.type, env, env.from);
  }

  private async sendRaw(dc: RTCDataChannel, type: string, payload: unknown): Promise<void> {
    const profile = this.did.profile;
    const doc = this.did.document();
    if (!profile || !doc || dc.readyState !== "open") return;
    const env: Envelope = { v: 1, from: profile.did, pub: doc.verificationMethod[0].publicKeyJwk, ts: Date.now(), type, payload, sig: "" };
    env.sig = await this.did.sign(`${env.from}|${env.ts}|${env.type}|${JSON.stringify(env.payload)}`);
    dc.send(JSON.stringify(env));
  }

  async send(peerDid: string, type: string, payload: unknown): Promise<void> {
    const dc = this.peers.get(peerDid);
    if (dc) await this.sendRaw(dc, type, payload);
  }

  async broadcast(type: string, payload: unknown): Promise<void> {
    for (const dc of this.peers.values()) await this.sendRaw(dc, type, payload);
  }

  peersInfo(): PeerInfo[] {
    return [...this.peers.keys()].map((did) => ({
      did,
      alias: this.aliases.get(did) ?? did.slice(8, 16),
      rtt: this.rtts.get(did) ?? 0,
      since: this.since.get(did) ?? Date.now(),
    }));
  }

  startKeepalive(intervalMs = 10_000): void {
    this.stopKeepalive();
    this.pingInt = window.setInterval(() => void this.broadcast("ping", { t: Date.now() }), intervalMs);
  }

  stopKeepalive(): void {
    clearInterval(this.pingInt);
    this.pingInt = 0;
  }

  private drop(dc: RTCDataChannel): void {
    let removed: string | null = null;
    for (const [did, ch] of this.peers) {
      if (ch === dc) {
        this.peers.delete(did);
        removed = did;
      }
    }
    for (const [ch, pc] of this.wiring) {
      if (ch === dc) {
        this.wiring.delete(ch);
        pc.close();
      }
    }
    if (removed) {
      const env: Envelope = { v: 1, from: removed, pub: {} as JsonWebKey, ts: Date.now(), type: "peer-left", payload: null, sig: "" };
      this.emit("peer-left", env, removed);
    }
  }

  destroy(): void {
    this.stopKeepalive();
    for (const dc of this.peers.values()) dc.close();
    for (const pc of this.wiring.values()) pc.close();
    this.peers.clear();
    this.wiring.clear();
  }

  private encode(o: { t: string; sdp: string }): string {
    return b64uEncode(new TextEncoder().encode(JSON.stringify(o)));
  }

  private decode(code: string): { t: string; sdp: string } {
    return JSON.parse(new TextDecoder().decode(b64uDecode(code.trim())));
  }
}
