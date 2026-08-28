export type Ctx = ExecutionContext;

export type Handler = (
  req: Request,
  params: Record<string, string>,
  env: unknown,
  ctx: Ctx
) => Response | Promise<Response>;

interface Route {
  method: string;
  parts: string[];
  handler: Handler;
}

export const json = (data: unknown, status = 200, headers: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers },
  });

export class EdgeRouter {
  private routes: Route[] = [];

  on(method: string, pattern: string, handler: Handler): this {
    this.routes.push({ method, parts: pattern.split("/").filter(Boolean), handler });
    return this;
  }

  get(pattern: string, handler: Handler): this {
    return this.on("GET", pattern, handler);
  }

  post(pattern: string, handler: Handler): this {
    return this.on("POST", pattern, handler);
  }

  async handle(req: Request, env: unknown, ctx: Ctx): Promise<Response> {
    const cors: Record<string, string> = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
    };
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

    const url = new URL(req.url);
    const parts = url.pathname.split("/").filter(Boolean);

    for (const r of this.routes) {
      if (r.method !== req.method) continue;
      const params = this.match(r.parts, parts);
      if (!params) continue;
      try {
        const res = await r.handler(req, params, env, ctx);
        for (const [k, v] of Object.entries(cors)) res.headers.set(k, v);
        return res;
      } catch (e) {
        const message = e instanceof Error ? e.message : "Internal error";
        return json({ error: message }, 500, cors);
      }
    }
    return json({ error: "Not found", path: url.pathname }, 404, cors);
  }

  private match(routeParts: string[], urlParts: string[]): Record<string, string> | null {
    if (routeParts.length !== urlParts.length) return null;
    const params: Record<string, string> = {};
    for (let i = 0; i < routeParts.length; i++) {
      const rp = routeParts[i];
      if (rp.startsWith(":")) params[rp.slice(1)] = decodeURIComponent(urlParts[i]);
      else if (rp !== urlParts[i]) return null;
    }
    return params;
  }
}
