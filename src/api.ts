export type ProviderId =
  | "local" | "gemini" | "deepseek" | "groq" | "openrouter"
  | "mistral" | "anthropic" | "openai" | "ollama"
  | "xai" | "cerebras" | "sambanova";

export interface ModelInfo {
  id: string;
  name: string;
  provider: ProviderId;
  tag?: string;
  vision?: boolean;
  reasoning?: boolean;
  free?: boolean;
}

export interface ChatMsg {
  role: "system" | "user" | "assistant";
  content: string;
  images?: string[];
}

export type StreamEvent =
  | { type: "thinking"; text: string }
  | { type: "delta"; text: string }
  | { type: "done"; text: string }
  | { type: "error"; message: string };

export class SSEParser {
  private buf = "";
  private data = "";
  private event = "message";

  feed(chunk: string, cb: (ev: { event: string; data: string }) => void): void {
    this.buf += chunk;
    let idx: number;
    while ((idx = this.buf.indexOf("\n")) >= 0) {
      const line = this.buf.slice(0, idx).replace(/\r$/, "");
      this.buf = this.buf.slice(idx + 1);
      if (line.startsWith("data:")) {
        const d = line.slice(5).trimStart();
        this.data += (this.data ? "\n" : "") + d;
      } else if (line.startsWith("event:")) {
        this.event = line.slice(6).trim();
      } else if (line === "" && this.data !== "") {
        cb({ event: this.event, data: this.data });
        this.data = "";
        this.event = "message";
      }
    }
  }
}

export const STATIC_MODELS: ModelInfo[] = [
  { id: "studio-local", name: "Studio Local (offline)", provider: "local", tag: "no API", free: true },
  { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", provider: "gemini", tag: "powerful · vision", vision: true, free: true },
  { id: "gemini-2.5-flash-lite", name: "Gemini 2.5 Flash-Lite", provider: "gemini", tag: "fast · vision", vision: true, free: true },
  { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash", provider: "gemini", tag: "vision", vision: true, free: true },
  { id: "deepseek-chat", name: "DeepSeek V3.2", provider: "deepseek", tag: "powerful", free: true },
  { id: "deepseek-reasoner", name: "DeepSeek R1", provider: "deepseek", tag: "reasoning", reasoning: true, free: true },
  { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B (Groq)", provider: "groq", tag: "instant", free: true },
  { id: "openai/gpt-oss-120b", name: "GPT-OSS 120B (Groq)", provider: "groq", tag: "instant", free: true },
  { id: "meta-llama/llama-3.3-70b-instruct:free", name: "Llama 3.3 70B", provider: "openrouter", tag: "free", free: true },
  { id: "deepseek/deepseek-r1t2-chimera:free", name: "DeepSeek R1T2 Chimera", provider: "openrouter", tag: "free", free: true },
  { id: "mistralai/devstral-small-2507:free", name: "Devstral Small", provider: "openrouter", tag: "free · code", free: true },
  { id: "google/gemini-2.0-flash-001", name: "Gemini 2.0 Flash (OR)", provider: "openrouter", tag: "vision", vision: true },
  { id: "mistral-small-latest", name: "Mistral Small 3.2", provider: "mistral", tag: "vision", vision: true },
  { id: "mistral-large-latest", name: "Mistral Large", provider: "mistral", tag: "powerful" },
  { id: "claude-haiku-4-5", name: "Claude Haiku 4.5", provider: "anthropic", tag: "fast", vision: true },
  { id: "gpt-4.1-mini", name: "GPT-4.1 mini", provider: "openai", tag: "all-round", vision: true },
  { id: "qwen3-coder:30b", name: "Qwen3 Coder 30B (Ollama)", provider: "ollama", tag: "local" },
  { id: "grok-4-fast-non-reasoning", name: "Grok 4 Fast", provider: "xai", tag: "fast · vision", vision: true },
  { id: "llama-3.3-70b", name: "Llama 3.3 70B (Cerebras)", provider: "cerebras", tag: "instant", free: true },
  { id: "Meta-Llama-3.3-70B-Instruct", name: "Llama 3.3 70B (SambaNova)", provider: "sambanova", tag: "instant", free: true },
];

export const PROVIDERS: { id: ProviderId; name: string; keyEnv: string; keyUrl: string }[] = [
  { id: "gemini", name: "Google Gemini", keyEnv: "GOOGLE_API_KEY", keyUrl: "https://aistudio.google.com/apikey" },
  { id: "deepseek", name: "DeepSeek", keyEnv: "DEEPSEEK_API_KEY", keyUrl: "https://platform.deepseek.com/api_keys" },
  { id: "groq", name: "Groq", keyEnv: "GROQ_API_KEY", keyUrl: "https://console.groq.com/keys" },
  { id: "openrouter", name: "OpenRouter", keyEnv: "OPENROUTER_API_KEY", keyUrl: "https://openrouter.ai/settings/keys" },
  { id: "mistral", name: "Mistral", keyEnv: "MISTRAL_API_KEY", keyUrl: "https://console.mistral.ai/api-keys" },
  { id: "anthropic", name: "Anthropic", keyEnv: "ANTHROPIC_API_KEY", keyUrl: "https://console.anthropic.com/settings/keys" },
  { id: "openai", name: "OpenAI", keyEnv: "OPENAI_API_KEY", keyUrl: "https://platform.openai.com/api-keys" },
  { id: "xai", name: "xAI (Grok)", keyEnv: "XAI_API_KEY", keyUrl: "https://console.x.ai/" },
  { id: "cerebras", name: "Cerebras", keyEnv: "CEREBRAS_API_KEY", keyUrl: "https://cloud.cerebras.ai/" },
  { id: "sambanova", name: "SambaNova", keyEnv: "SAMBANOVA_API_KEY", keyUrl: "https://cloud.sambanova.ai/" },
  { id: "ollama", name: "Ollama (local)", keyEnv: "OLLAMA_URL", keyUrl: "https://ollama.com" },
];

const OAI_BASE: Record<string, string> = {
  openai: "https://api.openai.com/v1",
  deepseek: "https://api.deepseek.com/v1",
  groq: "https://api.groq.com/openai/v1",
  openrouter: "https://openrouter.ai/api/v1",
  mistral: "https://api.mistral.ai/v1",
  xai: "https://api.x.ai/v1",
  cerebras: "https://api.cerebras.ai/v1",
  sambanova: "https://api.sambanova.ai/v1",
  ollama: "http://localhost:11434/v1",
};

export const KEY_ENV: Record<string, string> = {
  openai: "OPENAI_API_KEY", deepseek: "DEEPSEEK_API_KEY", groq: "GROQ_API_KEY",
  openrouter: "OPENROUTER_API_KEY", mistral: "MISTRAL_API_KEY",
  anthropic: "ANTHROPIC_API_KEY", gemini: "GOOGLE_API_KEY", ollama: "OLLAMA_URL",
  xai: "XAI_API_KEY", cerebras: "CEREBRAS_API_KEY", sambanova: "SAMBANOVA_API_KEY",
};

export interface WebSource { title: string; url: string; snippet: string }

export async function webSearch(query: string, signal?: AbortSignal): Promise<WebSource[]> {
  const q = query.replace(/[?.!,]+$/g, "").trim();
  const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&srlimit=4&format=json&origin=*`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error("Search is unavailable");
  const json: any = await res.json();
  return (json?.query?.search ?? []).map((s: any) => ({
    title: s.title as string,
    url: `https://en.wikipedia.org/wiki/${encodeURIComponent(String(s.title).replace(/ /g, "_"))}`,
    snippet: String(s.snippet ?? "").replace(/<[^>]+>/g, "").slice(0, 160),
  }));
}

async function* parseSseStream(
  res: Response,
  map: (ev: { event: string; data: string }) => StreamEvent | null,
  signal: AbortSignal
): AsyncGenerator<StreamEvent> {
  if (!res.body) {
    yield { type: "error", message: `Empty response (HTTP ${res.status})` };
    return;
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  const parser = new SSEParser();
  try {
    for (;;) {
      if (signal.aborted) break;
      const { done, value } = await reader.read();
      if (done) break;
      const events: StreamEvent[] = [];
      parser.feed(dec.decode(value, { stream: true }), (ev) => {
        const e = map(ev);
        if (e) events.push(e);
      });
      for (const e of events) yield e;
    }
  } finally {
    try { reader.cancel(); } catch { /* noop */ }
  }
}

const oaiMap = (ev: { data: string }): StreamEvent | null => {
  if (ev.data === "[DONE]") return null;
  try {
    const j = JSON.parse(ev.data);
    const d = j?.choices?.[0]?.delta;
    if (d?.reasoning_content) return { type: "thinking", text: d.reasoning_content };
    if (typeof d?.content === "string" && d.content) return { type: "delta", text: d.content };
    return null;
  } catch { return null; }
};

async function* openaiCompat(
  provider: string, model: string, messages: ChatMsg[], keys: Record<string, string>,
  deep: boolean, signal: AbortSignal
): AsyncGenerator<StreamEvent> {
  const base = provider === "ollama" ? (keys["OLLAMA_URL"]?.replace(/\/$/, "") || "http://localhost:11434") + "/v1" : OAI_BASE[provider];
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (provider !== "ollama") headers.Authorization = `Bearer ${keys[KEY_ENV[provider]]}`;
  if (provider === "openrouter") {
    headers["HTTP-Referer"] = location.origin;
    headers["X-Title"] = "AI Studio";
  }
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST", headers, signal,
    body: JSON.stringify({ model, messages, stream: true, temperature: 0.7 }),
  });
  if (!res.ok) throw new Error(`${provider}: HTTP ${res.status} — ${await res.text().then((t) => t.slice(0, 140))}`);
  yield* parseSseStream(res, oaiMap, signal);
}

async function* geminiDirect(
  model: string, messages: ChatMsg[], keys: Record<string, string>, deep: boolean, signal: AbortSignal
): AsyncGenerator<StreamEvent> {
  const contents: any[] = [];
  for (const m of messages) {
    if (m.role === "system") continue;
    const parts: any[] = [];
    if (m.images?.length) for (const img of m.images) {
      const match = /^data:(.+?);base64,(.+)$/.exec(img);
      if (match) parts.push({ inline_data: { mime_type: match[1], data: match[2] } });
    }
    if (m.content) parts.push({ text: m.content });
    if (parts.length) contents.push({ role: m.role === "assistant" ? "model" : "user", parts });
  }
  const fixed: any[] = [];
  for (const c of contents) {
    const last = fixed[fixed.length - 1];
    if (last && last.role === c.role) last.parts.push(...c.parts);
    else fixed.push({ role: c.role, parts: [...c.parts] });
  }
  const body: any = { contents: fixed, generationConfig: { temperature: 0.7 } };
  if (deep) body.generationConfig = { ...body.generationConfig, thinkingConfig: { includeThoughts: true, thinkingBudget: 2048 } };
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${keys[KEY_ENV.gemini]}`;
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal });
  if (!res.ok) throw new Error(`gemini: HTTP ${res.status} — ${await res.text().then((t) => t.slice(0, 140))}`);
  yield* parseSseStream(res, (ev) => {
    try {
      const j = JSON.parse(ev.data);
      const part = j?.candidates?.[0]?.content?.parts?.[0];
      if (part?.thought) return { type: "thinking", text: part.text ?? "" };
      if (part?.text) return { type: "delta", text: part.text };
      return null;
    } catch { return null; }
  }, signal);
}

async function* anthropicDirect(
  model: string, messages: ChatMsg[], keys: Record<string, string>, deep: boolean, signal: AbortSignal
): AsyncGenerator<StreamEvent> {
  const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n");
  const msgs = messages.filter((m) => m.role !== "system").map((m) => ({ role: m.role, content: m.content }));
  const body: any = { model, max_tokens: 2048, system, messages: msgs, stream: true };
  if (deep) { body.thinking = { type: "enabled", budget_tokens: 1024 }; body.temperature = 1; }
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": keys[KEY_ENV.anthropic],
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) throw new Error(`anthropic: HTTP ${res.status} — ${await res.text().then((t) => t.slice(0, 140))}`);
  yield* parseSseStream(res, (ev) => {
    try {
      const j = JSON.parse(ev.data);
      if (j?.type === "content_block_delta") {
        if (j.delta?.type === "thinking_delta") return { type: "thinking", text: j.delta.thinking ?? "" };
        if (j.delta?.type === "text_delta") return { type: "delta", text: j.delta.text ?? "" };
      }
      return null;
    } catch { return null; }
  }, signal);
}

export interface ChatOpts {
  keys: Record<string, string>;
  signal: AbortSignal;
  deep: boolean;
  webContext?: string;
}

export class EdgeClient {
  constructor(private getEdgeUrl: () => string) {}

  get edgeUrl(): string {
    return this.getEdgeUrl().replace(/\/$/, "");
  }

  async fetchModels(keys: Record<string, string>): Promise<ModelInfo[]> {
    let list: ModelInfo[] = [];
    if (this.edgeUrl) {
      try {
        const res = await fetch(`${this.edgeUrl}/api/models`);
        if (res.ok) {
          const j: any = await res.json();
          if (Array.isArray(j?.models)) list = j.models;
        }
      } catch { /* fall back below */ }
    }
    if (!list.length) {
      const direct = await Promise.allSettled(
        Object.entries(OAI_BASE)
          .filter(([p]) => p !== "ollama" && keys[KEY_ENV[p]])
          .map(async ([p, base]) => {
            const res = await fetch(`${base}/models`, { headers: { Authorization: `Bearer ${keys[KEY_ENV[p]]}` } });
            if (!res.ok) return [] as ModelInfo[];
            const j: any = await res.json();
            return (j?.data ?? []).slice(0, 24).map((m: any) => ({ id: m.id, name: m.id, provider: p as ProviderId }));
          })
      );
      for (const d of direct) if (d.status === "fulfilled") list.push(...d.value);
    }
    const merged = [
      ...STATIC_MODELS.filter((m) => m.provider === "local"),
      ...list,
      ...STATIC_MODELS.filter((m) => m.provider !== "local"),
    ];
    const seen = new Set<string>();
    return merged.filter((m) => (seen.has(m.id) ? false : (seen.add(m.id), true)));
  }

  async health(): Promise<boolean> {
    try {
      const res = await fetch(`${this.edgeUrl}/api/health`);
      return res.ok;
    } catch { return false; }
  }

  async *chat(model: ModelInfo, messages: ChatMsg[], opts: ChatOpts): AsyncGenerator<StreamEvent> {
    const { keys, signal, deep, webContext } = opts;

    if (this.edgeUrl && model.provider !== "local") {
      const res = await fetch(`${this.edgeUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal,
        body: JSON.stringify({ provider: model.provider, model: model.id, messages, stream: true, deep, web: webContext }),
      });
      if (!res.ok) throw new Error(`edge: HTTP ${res.status}`);
      yield* parseSseStream(res, (ev) => {
        try {
          const j = JSON.parse(ev.data);
          if (j.type === "delta") return { type: "delta", text: j.text ?? "" };
          if (j.type === "thinking") return { type: "thinking", text: j.text ?? "" };
          return null;
        } catch { return null; }
      }, signal);
      return;
    }

    const key = keys[KEY_ENV[model.provider]];
    if (model.provider === "local") throw new Error("local handled by engine");
    if (!key && model.provider !== "ollama") {
      yield { type: "error", message: `Missing key ${KEY_ENV[model.provider]}. Add it under Settings → Models & API, or deploy the Edge worker.` };
      return;
    }
    const msgs = webContext
      ? [{ role: "system" as const, content: `Web search context (cite the sources):\n${webContext}` }, ...messages]
      : messages;
    if (model.provider === "gemini") yield* geminiDirect(model.id, msgs, keys, deep, signal);
    else if (model.provider === "anthropic") yield* anthropicDirect(model.id, msgs, keys, deep, signal);
    else yield* openaiCompat(model.provider, model.id, msgs, keys, deep, signal);
  }
}

export const providerName = (p: ProviderId): string =>
  p === "local" ? "Local" : PROVIDERS.find((x) => x.id === p)?.name ?? p;
