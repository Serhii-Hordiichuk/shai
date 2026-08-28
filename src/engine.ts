export interface EngineResult {
  text: string;
  steps?: string[];
}

class Parser {
  private i = 0;
  constructor(private s: string) {}
  parse(): number {
    const v = this.expr();
    this.ws();
    if (this.i < this.s.length) throw new Error("bad");
    return v;
  }
  private ws() { while (/\s/.test(this.s[this.i] ?? "")) this.i++; }
  private expr(): number {
    let v = this.term();
    for (;;) {
      this.ws();
      const c = this.s[this.i];
      if (c === "+" || c === "-") { this.i++; const r = this.term(); v = c === "+" ? v + r : v - r; }
      else return v;
    }
  }
  private term(): number {
    let v = this.factor();
    for (;;) {
      this.ws();
      const c = this.s[this.i];
      if (c === "*" || c === "/" || c === "%") {
        this.i++;
        const r = this.factor();
        if (c === "*") v *= r;
        else if (c === "/") { if (r === 0) throw new Error("div0"); v /= r; }
        else v %= r;
      } else return v;
    }
  }
  private factor(): number {
    this.ws();
    const c = this.s[this.i];
    if (c === "-") { this.i++; return -this.factor(); }
    if (c === "(") {
      this.i++;
      const v = this.expr();
      this.ws();
      if (this.s[this.i] !== ")") throw new Error("paren");
      this.i++;
      return v;
    }
    return this.num();
  }
  private num(): number {
    this.ws();
    const m = /^(\d+\.?\d*|\.\d+)/.exec(this.s.slice(this.i));
    if (!m) throw new Error("num");
    this.i += m[0].length;
    return parseFloat(m[0]);
  }
}

export function tryMath(text: string): string | null {
  const s = text
    .replace(/how much is|calculate|compute|evaluate|=|\?/gi, "")
    .replace(/x/i, "*")
    .replace(/,/g, ".")
    .trim();
  if (!/^[\d\s+\-*/%().]+$/.test(s) || !/\d/.test(s) || !/[+\-*/%]/.test(s)) return null;
  try {
    const v = new Parser(s).parse();
    if (!isFinite(v)) return null;
    return String(Math.round(v * 1e6) / 1e6);
  } catch {
    return null;
  }
}

export function thinkSteps(q: string, ctx?: { sources?: number; images?: number }): string[] {
  const steps: string[] = [];
  steps.push(`Parsing the request: key topics — "${q.length > 60 ? q.slice(0, 57) + "…" : q}"`);
  if (ctx?.sources) steps.push(`Web search: analyzing ${ctx.sources} sources, dropping irrelevant ones`);
  if (ctx?.images) steps.push(`Processing ${ctx.images} image(s): recognizing content and context`);
  if (/[0-9]/.test(q) && /[+\-*/]/.test(q)) steps.push("Math expression detected — running the safe parser");
  if (/why|how |what is|explain/i.test(q)) steps.push("Open question — structuring the reply: definition → details → takeaway");
  steps.push("Composing the answer, checking tone and facts");
  return steps;
}

const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

const JOKES = [
  "Why do programmers mix up Halloween and Christmas? Because OCT 31 == DEC 25.",
  "— How many programmers does it take to change a light bulb?\n— None. That's a hardware problem.",
  "I'd tell you a UDP joke, but you might not get it.",
  "There were 99 bugs in the code, 99 bugs in the code. Fixed one — now there are 117.",
  "AI will never replace humans — the ones who turn it off, at least.",
];

const FACTS = [
  "The common nightingale's song has over 20 distinct 'words' — ornithologists study it like a language.",
  "The first computer bug in 1947 was a real moth found in the Harvard Mark II relay.",
  "An octave spans 8 notes, yet a piano fits 12 keys inside. Music is math!",
  "SSE (Server-Sent Events) is older than WebSockets — it shipped in Opera back in 2006.",
];

export function localChat(raw: string, opts: { images?: number; sources?: { title: string; url: string }[] } = {}): EngineResult {
  const q = raw.trim();
  const low = q.toLowerCase();

  if (opts.images) {
    return {
      text: `I see ${opts.images} image${opts.images > 1 ? "s" : ""}. For real vision analysis, pick a vision model (Gemini 2.5 Flash, Mistral Small) in the model menu — the offline engine handles text only.`,
    };
  }

  const math = tryMath(q);
  if (math) return { text: `Result: **${math}**\n\nComputed by the built-in safe parser — no \`eval\`, supports \`+ − × ÷ %\` and parentheses.` };

  if (/^(hi|hello|hey|good (morning|afternoon|evening)|greetings)/i.test(low))
    return { text: pick(["Hello! I'm the studio assistant. Ask me anything — or switch to Gemini / DeepSeek in the model menu for cloud answers.", "Hi there! I run fully offline, no API keys needed. I can do math, tell jokes and explain this app's architecture — try \"walk me through the architecture\"."]) };
  if (/(who are you|what can you do|help me|help$)/i.test(low))
    return {
      text: "I'm **Studio Local**, the built-in offline engine. I can:\n\n- compute math expressions: `(128 + 7) * 3`\n- answer greetings and basic questions\n- work without internet or API keys\n\nFor full answers, pick a cloud model (Gemini, DeepSeek, Groq, OpenRouter) in the selector above.",
    };
  if (/architecture|how (do|does) (you|this|it) work|about (yourself|the code)|modules?/i.test(low))
    return {
      text: "The app is built from small ES modules:\n\n1. **`store.ts`** — Proxy + Observer state manager\n2. **`router.ts`** — custom hash router\n3. **`db.ts`** — IndexedDB wrapper\n4. **`api.ts`** — `EdgeClient` + hand-rolled SSE parser\n5. **`chat.ts`** — `class ChatEngine`: streaming, artifacts\n6. **`call.ts`** — `class CallManager`: calls with barge-in\n\nThe Edge backend (TypeScript, Cloudflare Workers) lives in `edge/` — it proxies requests and keeps keys server-side. Full spec on the **Architecture & Spec** page in the sidebar.",
    };
  if (/joke|funny|make me laugh/i.test(low)) return { text: pick(JOKES) };
  if (/fact|interesting|did you know/i.test(low)) return { text: pick(FACTS) };
  if (/(time|what.s the date|today.s date|what day)/i.test(low)) {
    const now = new Date();
    return { text: `It's **${now.toLocaleTimeString("en-US")}**, ${now.toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}.` };
  }
  if (/thank|thanks/i.test(low)) return { text: "You're welcome! 👋" };
  if (/bye|goodbye|see you/i.test(low)) return { text: "See you! The conversation is saved in IndexedDB — it'll be waiting." };

  return {
    text: `The offline engine heard you, but it has no knowledge base for a solid answer.\n\n**To get a real answer:**\n1. Open the model selector (top bar) and pick *Gemini 2.5 Flash* or *DeepSeek*\n2. Add a free API key under Settings → Models & API\n3. Or deploy the Edge worker from \`edge/\` and set its URL — keys stay on the server\n\nMeanwhile try: "calculate 15 * 240", "tell me a joke", "walk me through the architecture".`,
  };
}

export function sourcesContext(sources: { title: string; snippet: string }[]): string {
  return sources.map((s, i) => `[${i + 1}] ${s.title}: ${s.snippet}`).join("\n");
}
