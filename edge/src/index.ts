/* ============================================================
   Edge Worker (Cloudflare) — вхідна точка.
   GET  /api/health — перевірка
   GET  /api/models — агрегація /v1/models усіх провайдерів (KV-кеш)
   POST /api/chat   — проксі до вендора з нормалізованим SSE
   Деплой: cd edge && npx wrangler deploy
   ============================================================ */
import { EdgeRouter, json } from "./router";
import { PROVIDERS, byId } from "./providers";
import type { ChatBody } from "./providers";

interface Env extends Record<string, string> {
  KV: KVNamespace;
}

const router = new EdgeRouter();

/* ---------- health ---------- */
router.get("/api/health", () => json({ ok: true, service: "ai-studio-edge", ts: Date.now() }));

/* ---------- агрегація моделей + KV-кеш ---------- */
router.get("/api/models", async (_req, _p, envRaw, ctx) => {
  const env = envRaw as Env;
  const CACHE_KEY = "models:v1";

  const cached = await env.KV.get(CACHE_KEY, "json").catch(() => null);
  if (cached && (cached as { ts: number }).ts > Date.now() - 3600_000) {
    return json({ models: (cached as { models: unknown[] }).models, cached: true });
  }

  const configured = PROVIDERS.filter((p) => {
    const v = env[p.keyEnv];
    return !!v;
  });

  const results = await Promise.allSettled(
    configured.map(async (p) => {
      const mr = p.modelsRequest(env as unknown as Record<string, string>);
      if (!mr) return [];
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 5000);
      try {
        const res = await fetch(mr.url, { headers: mr.headers, signal: ctrl.signal });
        if (!res.ok) return [];
        const raw = await res.json();
        return p.mapModels(raw).slice(0, 40).map((m) => ({
          id: m.id,
          name: m.name || m.id,
          provider: p.id,
        }));
      } finally {
        clearTimeout(t);
      }
    })
  );

  const models = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));

  // кешуємо у фоні, не блокуючи відповідь
  ctx.waitUntil(env.KV.put(CACHE_KEY, JSON.stringify({ ts: Date.now(), models }), { expirationTtl: 3600 }).catch(() => {}));
  return json({ models, cached: false, providers: configured.map((p) => p.id) });
});

/* ---------- проксі чату зі стримінгом ---------- */
router.post("/api/chat", async (req, _p, envRaw) => {
  const env = envRaw as Env;
  const body = (await req.json()) as ChatBody;
  const provider = byId(body.provider);
  if (!provider) return json({ error: `Невідомий провайдер: ${body.provider}` }, 400);

  const chatReq = provider.chatRequest(body, env as unknown as Record<string, string>);
  if (!chatReq) return json({ error: `На сервері немає ключа ${provider.keyEnv}` }, 400);

  const upstream = await fetch(chatReq.url, {
    method: "POST",
    headers: chatReq.headers,
    body: JSON.stringify(chatReq.body),
  });
  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text().catch(() => "");
    return json({ error: `${provider.id}: HTTP ${upstream.status}`, detail: text.slice(0, 200) }, upstream.status);
  }

  // Нормалізація SSE вендора → єдиний формат: event: message, data: {type, text}
  const reader = upstream.body.getReader();
  const dec = new TextDecoder();
  const enc = new TextEncoder();
  let buf = "";
  let data = "";

  const stream = new ReadableStream({
    async pull(ctrl) {
      const { done, value } = await reader.read();
      if (done) {
        ctrl.enqueue(enc.encode("data: {\"type\":\"done\"}\n\n"));
        ctrl.close();
        return;
      }
      buf += dec.decode(value, { stream: true });
      let idx: number;
      while ((idx = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, idx).replace(/\r$/, "");
        buf = buf.slice(idx + 1);
        if (line.startsWith("data:")) data += (data ? "\n" : "") + line.slice(5).trimStart();
        else if (line === "" && data) {
          const norm = provider.normalize("message", data);
          data = "";
          if (norm === "done") {
            ctrl.enqueue(enc.encode("data: {\"type\":\"done\"}\n\n"));
            ctrl.close();
            return;
          }
          if (norm && norm.text) {
            ctrl.enqueue(enc.encode(`data: ${JSON.stringify({ type: norm.type, text: norm.text })}\n\n`));
          }
        }
      }
    },
    cancel: () => reader.cancel().catch(() => {}),
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
});

export default {
  fetch: (req: Request, env: Env, ctx: ExecutionContext) => router.handle(req, env, ctx),
};
