import type { IDB } from "./db";

export interface NodeEntry {
  id: string;
  alias: string;
  kind: "user" | "ai";
  caps: string[];
  peers: string[];
  firstSeen: number;
  lastSeen: number;
}

export interface ConnectionSuggestion {
  a: string;
  b: string;
  score: number;
  shared: string[];
}

export class NodeMap {
  private nodes = new Map<string, NodeEntry>();
  private listeners = new Set<() => void>();

  constructor(
    private db: IDB,
    private selfId: string
  ) {}

  async load(): Promise<void> {
    const all = await this.db.get<NodeEntry[]>("mesh", "nodemap");
    (all ?? []).forEach((n) => this.nodes.set(n.id, n));
  }

  private commit(): void {
    void this.db.set("mesh", "nodemap", [...this.nodes.values()]);
    this.listeners.forEach((fn) => fn());
  }

  onChange(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  upsert(e: Partial<NodeEntry> & { id: string }): void {
    const cur = this.nodes.get(e.id);
    this.nodes.set(e.id, {
      id: e.id,
      alias: e.alias ?? cur?.alias ?? e.id.slice(8, 16),
      kind: e.kind ?? cur?.kind ?? "user",
      caps: e.caps?.length ? e.caps : cur?.caps ?? [],
      peers: e.peers?.length ? e.peers : cur?.peers ?? [],
      firstSeen: cur?.firstSeen ?? Date.now(),
      lastSeen: Math.max(cur?.lastSeen ?? 0, e.lastSeen ?? Date.now()),
    });
    this.commit();
  }

  merge(remote: NodeEntry[]): void {
    let changed = false;
    for (const r of remote) {
      const cur = this.nodes.get(r.id);
      if (!cur || r.lastSeen > cur.lastSeen) {
        this.nodes.set(r.id, { ...r, firstSeen: cur?.firstSeen ?? r.firstSeen ?? Date.now() });
        changed = true;
      }
    }
    if (changed) this.commit();
  }

  touch(id: string): void {
    const cur = this.nodes.get(id);
    if (cur) {
      cur.lastSeen = Date.now();
      this.commit();
    }
  }

  get(id: string): NodeEntry | undefined {
    return this.nodes.get(id);
  }

  all(): NodeEntry[] {
    return [...this.nodes.values()].sort((a, b) => b.lastSeen - a.lastSeen);
  }

  size(): number {
    return this.nodes.size;
  }

  snapshotForAi(limit = 20): string {
    const rows = this.all()
      .slice(0, limit)
      .map((n) => {
        const ago = Math.max(0, Math.round((Date.now() - n.lastSeen) / 60000));
        return `- ${n.alias} (${n.id.slice(0, 16)}…) · ${n.kind} · seen ${ago}m ago · caps: ${n.caps.join(", ") || "—"} · links: ${n.peers.length}`;
      })
      .join("\n");
    return `Shared node map from ${this.selfId.slice(0, 16)}… perspective — ${this.nodes.size} nodes known:\n${rows || "- empty"}`;
  }

  suggestConnections(max = 5): ConnectionSuggestion[] {
    const all = this.all();
    const out: ConnectionSuggestion[] = [];
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const a = all[i];
        const b = all[j];
        if (a.peers.includes(b.id)) continue;
        const shared = a.caps.filter((c) => b.caps.includes(c));
        if (!shared.length) continue;
        const mutual = a.peers.filter((p) => b.peers.includes(p)).length;
        out.push({ a: a.id, b: b.id, score: shared.length * 2 + mutual * 3, shared });
      }
    }
    return out.sort((x, y) => y.score - x.score).slice(0, max);
  }
}
