import type { IDB } from "./db";

export interface DidProfile {
  did: string;
  alias: string;
  color: string;
  bio: string;
  createdAt: number;
}

export interface DidDocument {
  "@context": string[];
  id: string;
  verificationMethod: { id: string; type: string; controller: string; publicKeyJwk: JsonWebKey }[];
  authentication: string[];
  service: { id: string; type: string; serviceEndpoint: string }[];
}

export interface AuthChallenge {
  nonce: string;
  ts: number;
}

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const te = new TextEncoder();

function base58(bytes: Uint8Array): string {
  let n = 0n;
  for (const b of bytes) n = n * 256n + BigInt(b);
  let out = "";
  while (n > 0n) {
    out = B58[Number(n % 58n)] + out;
    n /= 58n;
  }
  for (const b of bytes) {
    if (b !== 0) break;
    out = "1" + out;
  }
  return out;
}

export function b64uEncode(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function b64uDecode(s: string): Uint8Array {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function compressedPublicKey(jwk: JsonWebKey): Uint8Array {
  const x = b64uDecode(jwk.x!);
  const y = b64uDecode(jwk.y!);
  const out = new Uint8Array(33);
  out[0] = (y[y.length - 1] & 1) === 0 ? 0x02 : 0x03;
  out.set(x, 1);
  return out;
}

function toDidKey(jwk: JsonWebKey): string {
  const pub = compressedPublicKey(jwk);
  const bytes = new Uint8Array(2 + pub.length);
  bytes[0] = 0x80;
  bytes[1] = 0x24;
  bytes.set(pub, 2);
  return "did:key:z" + base58(bytes);
}

export class DidAccount {
  profile: DidProfile | null = null;
  private priv: CryptoKey | null = null;
  private pub: CryptoKey | null = null;
  private pubJwk: JsonWebKey | null = null;

  constructor(private db: IDB) {}

  async load(): Promise<boolean> {
    const saved = await this.db.get<{ priv: JsonWebKey; pub: JsonWebKey; profile: DidProfile }>("did", "account");
    if (!saved?.priv) return false;
    this.priv = await crypto.subtle.importKey("jwk", saved.priv, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
    this.pub = await crypto.subtle.importKey("jwk", saved.pub, { name: "ECDSA", namedCurve: "P-256" }, true, ["verify"]);
    this.pubJwk = saved.pub;
    this.profile = saved.profile;
    return true;
  }

  async create(alias: string): Promise<DidProfile> {
    const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
    const priv = await crypto.subtle.exportKey("jwk", pair.privateKey);
    const pub = await crypto.subtle.exportKey("jwk", pair.publicKey);
    this.priv = pair.privateKey;
    this.pub = pair.publicKey;
    this.pubJwk = pub;
    this.profile = { did: toDidKey(pub), alias, color: "#7d79f6", bio: "", createdAt: Date.now() };
    await this.save(priv);
    return this.profile;
  }

  private async save(priv: JsonWebKey): Promise<void> {
    await this.db.set("did", "account", { priv, pub: this.pubJwk, profile: this.profile });
  }

  async updateProfile(patch: Partial<Omit<DidProfile, "did">>): Promise<void> {
    if (!this.profile) return;
    this.profile = { ...this.profile, ...patch };
    const saved = await this.db.get<{ priv: JsonWebKey }>("did", "account");
    if (saved) await this.save(saved.priv);
  }

  document(): DidDocument | null {
    if (!this.profile || !this.pubJwk) return null;
    const id = this.profile.did;
    return {
      "@context": ["https://www.w3.org/ns/did/v1"],
      id,
      verificationMethod: [{ id: `${id}#key-1`, type: "EcdsaSecp256r1VerificationKey2019", controller: id, publicKeyJwk: this.pubJwk }],
      authentication: [`${id}#key-1`],
      service: [],
    };
  }

  async sign(data: string): Promise<string> {
    if (!this.priv) throw new Error("no identity");
    const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, this.priv, te.encode(data));
    return b64uEncode(new Uint8Array(sig));
  }

  async verify(did: string, pubJwk: JsonWebKey, data: string, sig: string): Promise<boolean> {
    try {
      const key = did === this.profile?.did && this.pub
        ? this.pub
        : await crypto.subtle.importKey("jwk", pubJwk, { name: "ECDSA", namedCurve: "P-256" }, true, ["verify"]);
      return await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, key, b64uDecode(sig) as unknown as BufferSource, te.encode(data));
    } catch {
      return false;
    }
  }

  challenge(): AuthChallenge {
    return { nonce: b64uEncode(crypto.getRandomValues(new Uint8Array(24))), ts: Date.now() };
  }

  async signChallenge(ch: AuthChallenge): Promise<string> {
    return this.sign(`${ch.nonce}:${ch.ts}`);
  }

  async verifyChallenge(did: string, pubJwk: JsonWebKey, ch: AuthChallenge, sig: string): Promise<boolean> {
    if (Date.now() - ch.ts > 5 * 60_000) return false;
    return this.verify(did, pubJwk, `${ch.nonce}:${ch.ts}`, sig);
  }

  async exportEncrypted(passphrase: string): Promise<string> {
    const saved = await this.db.get<{ priv: JsonWebKey; pub: JsonWebKey; profile: DidProfile }>("did", "account");
    if (!saved) throw new Error("no identity");
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const base = await crypto.subtle.importKey("raw", te.encode(passphrase), "PBKDF2", false, ["deriveKey"]);
    const key = await crypto.subtle.deriveKey(
      { name: "PBKDF2", salt: salt as BufferSource, iterations: 150_000, hash: "SHA-256" },
      base,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt"]
    );
    const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv as BufferSource }, key, te.encode(JSON.stringify(saved)));
    return JSON.stringify({ v: 1, alg: "PBKDF2-AES256GCM", salt: b64uEncode(salt), iv: b64uEncode(iv), data: b64uEncode(new Uint8Array(ct)) });
  }

  async importEncrypted(blob: string, passphrase: string): Promise<DidProfile> {
    const j = JSON.parse(blob) as { v: number; salt: string; iv: string; data: string };
    if (j.v !== 1) throw new Error("Unsupported backup format");
    const salt = b64uDecode(j.salt);
    const iv = b64uDecode(j.iv);
    const base = await crypto.subtle.importKey("raw", te.encode(passphrase), "PBKDF2", false, ["deriveKey"]);
    const key = await crypto.subtle.deriveKey(
      { name: "PBKDF2", salt: salt as BufferSource, iterations: 150_000, hash: "SHA-256" },
      base,
      { name: "AES-GCM", length: 256 },
      false,
      ["decrypt"]
    );
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv as BufferSource }, key, b64uDecode(j.data) as BufferSource);
    const saved = JSON.parse(new TextDecoder().decode(pt)) as { priv: JsonWebKey; pub: JsonWebKey; profile: DidProfile };
    await this.db.set("did", "account", saved);
    await this.load();
    return this.profile!;
  }

  async erase(): Promise<void> {
    await this.db.del("did", "account");
    this.profile = null;
    this.priv = null;
    this.pub = null;
    this.pubJwk = null;
  }
}
