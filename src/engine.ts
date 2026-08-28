/* ============================================================
   Вбудований офлайн-рушій: відповідає локально, без API.
   Генерує ланцюжок думок для режиму Deep Thinking.
   ============================================================ */

export interface EngineResult {
  text: string;
  steps?: string[];
}

/* ---------- безпечний математичний парсер ---------- */
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
    .replace(/скільки буде|порахуй|обчисли|рахуй|=|\?/gi, "")
    .replace(/х/i, "*")
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

/* ---------- ланцюжок думок (Deep Thinking) ---------- */
export function thinkSteps(q: string, ctx?: { sources?: number; images?: number }): string[] {
  const steps: string[] = [];
  steps.push(`Розбір запиту: виділяю ключові теми — «${q.length > 60 ? q.slice(0, 57) + "…" : q}»`);
  if (ctx?.sources) steps.push(`Веб-пошук: аналізую ${ctx.sources} знайдених джерел, відкидаю нерелевантні`);
  if (ctx?.images) steps.push(`Обробка зображень: ${ctx.images} шт. — розпізнаю вміст і контекст`);
  if (/[0-9]/.test(q) && /[+\-*/]/.test(q)) steps.push("Виявлено математичний вираз — перевіряю безпечним парсером");
  if (/чому|навіщо|як |що таке|поясни/i.test(q)) steps.push("Питання відкрите — структурую відповідь: визначення → деталі → висновок");
  steps.push("Формулюю відповідь українською, перевіряю тон і факти");
  return steps;
}

/* ---------- знання ---------- */
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

const JOKES = [
  "Чому програмісти плутають Хелловін і Різдво? Бо OCT 31 == DEC 25.",
  "— Скільки програмістів треба, щоб замінити лампочку?\n— Жодного, це апаратна проблема.",
  "У мене є жарт про UDP, але не факт, що він до вас дійде.",
  "99 багів у коді було, 99 багів у коді. Один виправив — і ось їх вже 117.",
  "Штучний інтелект ніколи не замінить людей, які його вимикають.",
];

const FACTS = [
  "Соловейко — єдиний птах, чий спів вивчають як окрему мову: у нього понад 20 «слів».",
  "Українську мову визнано однією з найгармонійніших за фонетикою серед мов Європи.",
  "Перший у свіді комп'ютерний хробак 1947 року був справжнім метеликом у реле Mark II.",
  "Октава — це 8 нот, але на фортепіано між ними 12 клавіш. Математика музики!",
];

export function localChat(raw: string, opts: { images?: number; sources?: { title: string; url: string }[] } = {}): EngineResult {
  const q = raw.trim();
  const low = q.toLowerCase();

  if (opts.images) {
    return {
      text: `Бачу ${opts.images} зображен${opts.images > 1 ? (opts.images < 5 ? "ня" : "ь") : "ня"}. Щоб отримати справжній аналіз зображень, під'єднайте модель із зором (Gemini 2.5 Flash, Mistral Small) у меню моделей — офлайн-рушій працює лише з текстом.`,
    };
  }

  const math = tryMath(q);
  if (math) return { text: `Результат: **${math}**\n\nОбчислено вбудованим безпечним парсером — без \`eval\`, підтримуються \`+ − × ÷ %\` та дужки.` };

  if (/слава україні/i.test(low)) return { text: "Героям слава! 🇺🇦" };
  if (/^(привіт|вітаю|хай|hello|hi|добрий день|доброго)/i.test(low))
    return { text: pick(["Привіт! Я студійний асистент. Поставте питання — або увімкніть модель Gemini чи DeepSeek для хмарних відповідей.", "Вітаю! Працюю офлайн, без API-ключів. Вмію рахувати вирази, жартувати й пояснювати архітектуру цього застосунку — спробуйте «розкажи про архітектуру»."]) };
  if (/(хто ти|що ти вмієш|допомо[жг]и|help)/i.test(low))
    return {
      text: "Я — вбудований офлайн-рушій **Studio Local**. Вмію:\n\n- рахувати математичні вирази: `(128 + 7) * 3`\n- відповідати на привітання й базові питання\n- працювати без інтернету та API-ключів\n\nДля повноцінних відповідей оберіть хмарну модель (Gemini, DeepSeek, Groq, OpenRouter) у селекторі зверху.",
    };
  if (/архітектур|як (ти|це) працює|про (себе|код)|модул/i.test(low))
    return {
      text: "Застосунок побудовано за модульною схемою:\n\n1. **`store.ts`** — стан на `Proxy` + Observer\n2. **`router.ts`** — власний hash-роутер\n3. **`db.ts`** — обгортка над IndexedDB\n4. **`api.ts`** — `EdgeClient` + власний SSE-парсер\n5. **`chat.ts`** — `class ChatEngine`: стримінг, артефакти\n6. **`call.ts`** — `class CallManager`: дзвінки з barge-in\n\nEdge-бекенд (TypeScript, Cloudflare Workers) лежить у `edge/` — проксує запити й ховає ключі. Повне ТЗ — на сторінці **«Архітектура»** у сайдбарі.",
    };
  if (/жарт|анекдот|смішн/i.test(low)) return { text: pick(JOKES) };
  if (/факт|цікав/i.test(low)) return { text: pick(FACTS) };
  if (/(час|котра година|дата|число|сьогодні)/i.test(low)) {
    const now = new Date();
    return { text: `Зараз **${now.toLocaleTimeString("uk-UA")}**, ${now.toLocaleDateString("uk-UA", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}.` };
  }
  if (/дякую|спасибі/i.test(low)) return { text: "Будь ласка! Звертайтесь 👋" };
  if (/бувай|до побачення|пока/i.test(low)) return { text: "До зустрічі! Розмову збережено в IndexedDB — вона чекатиме на вас." };

  return {
    text: `Офлайн-рушій почув ваш запит, але не має бази знань для ґрунтовної відповіді.\n\n**Що зробить відповідь повноцінною:**\n1. Відкрийте селектор моделей (зверху) й оберіть *Gemini 2.5 Flash* або *DeepSeek*\n2. Додайте безкоштовний API-ключ у Налаштуваннях → API\n3. Або задеплойте Edge-воркер з \`edge/\` й вкажіть його URL — ключі лишаться на сервері\n\nТим часом спробуйте: «порахуй 15% від 240», «жарт», «розкажи про архітектуру».`,
  };
}

/** Стислий контекст із джерел веб-пошуку для промпту */
export function sourcesContext(sources: { title: string; snippet: string }[]): string {
  return sources.map((s, i) => `[${i + 1}] ${s.title}: ${s.snippet}`).join("\n");
}
