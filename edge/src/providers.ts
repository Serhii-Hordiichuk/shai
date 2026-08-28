export interface ProviderDef {
  id: string;
  name: string;
  keyEnv: string;
  modelsRequest(env: Record<string, string>): { url: string; headers: Record<string, string> } | null;
  mapModels(raw: unknown): { id: string; name?: string }[];
  chatRequest(
    body: ChatBody,
    env: Record<string, string>
  ): { url: string; headers: Record<string, string>; body: unknown } | null;
  normalize(event: string, data: string): { type: "delta" | "thinking"; text: string } | null | "done";
}

export interface ChatBody {
  provider: string;
  model: string;
  messages: { role: string; content: string }[];
  stream?: boolean;
  deep?: boolean;
  web?: string;
}

const oaiNormalize = (data: string): { type: "delta" | "thinking"; text: string } | null | "done" => {
  if (data === "[DONE]") return "done";
  try {
    const j = JSON.parse(data);
    const d = j?.choices?.[0]?.delta;
    if (d?.reasoning_content) return { type: "thinking", text: d.reasoning_content };
    if (typeof d?.content === "string" && d.content) return { type: "delta", text: d.content };
    return null;
  } catch {
    return null;
  }
};

function openaiLike(id: string, name: string, keyEnv: string, base: string): ProviderDef {
  return {
    id,
    name,
    keyEnv,
    modelsRequest: (env) =>
      env[keyEnv] ? { url: `${base}/models`, headers: { Authorization: `Bearer ${env[keyEnv]}` } } : null,
    mapModels: (raw) => ((raw as any)?.data ?? []).map((m: any) => ({ id: m.id })),
    chatRequest: (body, env) => {
      if (!env[keyEnv]) return null;
      const messages = [...body.messages];
      if (body.web) messages.unshift({ role: "system", content: `Web search context:\n${body.web}` });
      return {
        url: `${base}/chat/completions`,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${env[keyEnv]}` },
        body: { model: body.model, messages, stream: true, temperature: 0.7 },
      };
    },
    normalize: oaiNormalize,
  };
}

export const PROVIDERS: ProviderDef[] = [
  openaiLike("openai", "OpenAI", "OPENAI_API_KEY", "https://api.openai.com/v1"),
  openaiLike("deepseek", "DeepSeek", "DEEPSEEK_API_KEY", "https://api.deepseek.com/v1"),
  openaiLike("groq", "Groq", "GROQ_API_KEY", "https://api.groq.com/openai/v1"),
  openaiLike("openrouter", "OpenRouter", "OPENROUTER_API_KEY", "https://openrouter.ai/api/v1"),
  openaiLike("mistral", "Mistral", "MISTRAL_API_KEY", "https://api.mistral.ai/v1"),
  {
    ...openaiLike("ollama", "Ollama", "OLLAMA_URL", "http://localhost:11434/v1"),
    modelsRequest: (env) =>
      env.OLLAMA_URL ? { url: `${env.OLLAMA_URL.replace(/\/$/, "")}/v1/models`, headers: {} } : null,
    chatRequest: (body, env) => {
      const base = (env.OLLAMA_URL || "http://localhost:11434").replace(/\/$/, "");
      return {
        url: `${base}/v1/chat/completions`,
        headers: { "Content-Type": "application/json" },
        body: { model: body.model, messages: body.messages, stream: true },
      };
    },
  },
  {
    id: "anthropic",
    name: "Anthropic",
    keyEnv: "ANTHROPIC_API_KEY",
    modelsRequest: (env) =>
      env.ANTHROPIC_API_KEY
        ? {
            url: "https://api.anthropic.com/v1/models",
            headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
          }
        : null,
    mapModels: (raw) => ((raw as any)?.data ?? []).map((m: any) => ({ id: m.id })),
    chatRequest: (body, env) => {
      if (!env.ANTHROPIC_API_KEY) return null;
      const system = body.messages.filter((m) => m.role === "system").map((m) => m.content).join("\n");
      const messages = body.messages.filter((m) => m.role !== "system");
      const payload: Record<string, unknown> = { model: body.model, max_tokens: 2048, messages, stream: true };
      if (system) payload.system = system;
      if (body.deep) payload.thinking = { type: "enabled", budget_tokens: 1024 };
      return {
        url: "https://api.anthropic.com/v1/messages",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: payload,
      };
    },
    normalize: (event, data) => {
      try {
        const j = JSON.parse(data);
        if (j?.type === "content_block_delta") {
          if (j.delta?.type === "thinking_delta") return { type: "thinking", text: j.delta.thinking ?? "" };
          if (j.delta?.type === "text_delta") return { type: "delta", text: j.delta.text ?? "" };
        }
        if (j?.type === "message_stop") return "done";
        return null;
      } catch {
        return null;
      }
    },
  },
  {
    id: "gemini",
    name: "Google Gemini",
    keyEnv: "GOOGLE_API_KEY",
    modelsRequest: (env) =>
      env.GOOGLE_API_KEY
        ? { url: `https://generativelanguage.googleapis.com/v1beta/models?key=${env.GOOGLE_API_KEY}`, headers: {} }
        : null,
    mapModels: (raw) =>
      ((raw as any)?.models ?? [])
        .filter((m: any) => String(m.name).includes("generateContent"))
        .map((m: any) => ({ id: String(m.name).replace("models/", ""), name: m.displayName })),
    chatRequest: (body, env) => {
      if (!env.GOOGLE_API_KEY) return null;
      const contents = body.messages
        .filter((m) => m.role !== "system")
        .map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));
      const payload: Record<string, unknown> = { contents, generationConfig: { temperature: 0.7 } };
      if (body.deep) payload.generationConfig = { temperature: 0.7, thinkingConfig: { includeThoughts: true, thinkingBudget: 2048 } };
      return {
        url: `https://generativelanguage.googleapis.com/v1beta/models/${body.model}:streamGenerateContent?alt=sse&key=${env.GOOGLE_API_KEY}`,
        headers: { "Content-Type": "application/json" },
        body: payload,
      };
    },
    normalize: (event, data) => {
      try {
        const j = JSON.parse(data);
        const part = j?.candidates?.[0]?.content?.parts?.[0];
        if (part?.thought) return { type: "thinking", text: part.text ?? "" };
        if (part?.text) return { type: "delta", text: part.text };
        return null;
      } catch {
        return null;
      }
    },
  },
];

export const byId = (id: string): ProviderDef | undefined => PROVIDERS.find((p) => p.id === id);
