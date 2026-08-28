/* ============================================================
   Власний hash-роутер на чистому JS: '#/c/:id', '#/settings'...
   ============================================================ */

export type RouteParams = Record<string, string>;
export type RouteHandler = (params: RouteParams) => void;

interface RouteEntry {
  parts: string[];
  handler: RouteHandler;
}

function match(parts: string[], hashParts: string[]): RouteParams | null {
  if (parts.length !== hashParts.length) return null;
  const params: RouteParams = {};
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (p.startsWith(":")) params[p.slice(1)] = decodeURIComponent(hashParts[i]);
    else if (p !== hashParts[i]) return null;
  }
  return params;
}

export class Router {
  private routes: RouteEntry[] = [];
  private fallback: RouteHandler | null = null;
  private onHash = () => this.resolve();

  add(pattern: string, handler: RouteHandler): this {
    this.routes.push({ parts: pattern.replace(/^#?\/?/, "").split("/"), handler });
    return this;
  }

  setFallback(handler: RouteHandler): this {
    this.fallback = handler;
    return this;
  }

  navigate(hash: string): void {
    if (location.hash === hash) this.resolve();
    else location.hash = hash;
  }

  current(): string {
    return location.hash || "#/";
  }

  resolve(): void {
    const hash = (location.hash || "#/").replace(/^#\/?/, "");
    const hashParts = hash === "" ? [""] : hash.split("/");
    for (const r of this.routes) {
      const params = match(r.parts, hashParts);
      if (params) {
        r.handler(params);
        return;
      }
    }
    this.fallback?.({ path: hash });
  }

  start(): void {
    window.addEventListener("hashchange", this.onHash);
    this.resolve();
  }

  destroy(): void {
    window.removeEventListener("hashchange", this.onHash);
  }
}
