import type { DidAccount } from "./did";
import type { MeshNode, Envelope } from "./mesh";
import type { NodeMap } from "./nodemap";

export interface AgentManifest {
  did: string;
  alias: string;
  interests: string[];
  models: string[];
  languages: string[];
  services: string[];
  updatedAt: number;
}

export interface IntroPayload {
  from: string;
  to: string;
  reason: string;
  score: number;
}

export class AgentBroker {
  manifest: AgentManifest | null = null;
  onIntro: ((p: IntroPayload) => void) | null = null;
  private known = new Map<string, AgentManifest>();

  constructor(
    private did: DidAccount,
    private mesh: MeshNode,
    private map: NodeMap
  ) {
    mesh.on("hello", (env) => this.handleHello(env));
    mesh.on("agent-manifest", (env) => this.handleManifest(env));
    mesh.on("agent-intro", (env) => this.handleIntro(env));
    mesh.on("nodes-gossip", (env) => this.handleGossip(env));
  }

  publish(interests: string[], models: string[], languages: string[]): void {
    if (!this.did.profile) return;
    this.manifest = {
      did: this.did.profile.did,
      alias: this.did.profile.alias,
      interests,
      models,
      languages,
      services: ["chat", "voice-call", "artifacts"],
      updatedAt: Date.now(),
    };
    this.mesh.setAlias(this.did.profile.alias);
    void this.mesh.broadcast("agent-manifest", this.manifest);
  }

  private handleHello(env: Envelope): void {
    const p = env.payload as { alias?: string; kind?: "user" | "ai" };
    this.map.upsert({ id: env.from, alias: p.alias, kind: p.kind ?? "user", lastSeen: Date.now() });
  }

  private handleManifest(env: Envelope): void {
    const m = env.payload as AgentManifest;
    if (!m || m.did !== env.from) return;
    this.known.set(env.from, m);
    this.map.upsert({ id: env.from, alias: m.alias, caps: [...m.interests, ...m.models, ...m.languages], lastSeen: m.updatedAt });
  }

  private handleIntro(env: Envelope): void {
    const p = env.payload as IntroPayload;
    if (p && p.to === this.did.profile?.did) this.onIntro?.(p);
  }

  private handleGossip(env: Envelope): void {
    const list = env.payload as unknown;
    if (Array.isArray(list)) this.map.merge(list as never[]);
  }

  score(other: AgentManifest): number {
    if (!this.manifest) return 0;
    const sharedI = this.manifest.interests.filter((x) => other.interests.includes(x)).length;
    const sharedM = this.manifest.models.filter((x) => other.models.includes(x)).length;
    const sharedL = this.manifest.languages.filter((x) => other.languages.includes(x)).length;
    return sharedI * 3 + sharedM * 2 + sharedL;
  }

  bestMatches(max = 3): { manifest: AgentManifest; score: number }[] {
    return [...this.known.values()]
      .map((m) => ({ manifest: m, score: this.score(m) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, max);
  }

  introduce(a: string, b: string, reason: string): void {
    const score = this.map.suggestConnections(20).find((s) => (s.a === a && s.b === b) || (s.a === b && s.b === a))?.score ?? 0;
    void this.mesh.send(a, "agent-intro", { from: b, to: a, reason, score } satisfies IntroPayload);
    void this.mesh.send(b, "agent-intro", { from: a, to: b, reason, score } satisfies IntroPayload);
  }

  shareMap(): void {
    void this.mesh.broadcast("nodes-gossip", this.map.all());
  }

  summary(): string {
    const mine = this.manifest
      ? `My agent "${this.manifest.alias}": interests [${this.manifest.interests.join(", ")}], models [${this.manifest.models.join(", ")}]`
      : "My agent: manifest not configured";
    const known = [...this.known.values()]
      .slice(0, 10)
      .map((m) => `- ${m.alias} (${m.did.slice(0, 16)}…): [${m.interests.join(", ")}]`)
      .join("\n");
    const suggestions = this.map
      .suggestConnections(3)
      .map((s) => `- link ${s.a.slice(8, 16)}… ↔ ${s.b.slice(8, 16)}… (score ${s.score}, shared: ${s.shared.join(", ")})`)
      .join("\n");
    return [mine, `Known agents:\n${known || "- none"}`, `Suggested links:\n${suggestions || "- none"}`].join("\n");
  }
}
