/* Рушій відповідей Солов'я — чистий JS, без жодних залежностей */

const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

/* ---------------- безпечний математичний парсер ---------------- */

class Parser {
  private s: string;
  private i = 0;
  constructor(src: string) { this.s = src; }

  parse(): number {
    const v = this.expr();
    this.skip();
    if (this.i < this.s.length) throw new Error("bad");
    return v;
  }
  private skip() { while (this.i < this.s.length && this.s[this.i] === " ") this.i++; }
  private expr(): number {
    let v = this.term();
    for (;;) {
      this.skip();
      const c = this.s[this.i];
      if (c === "+" || c === "-") { this.i++; const r = this.term(); v = c === "+" ? v + r : v - r; }
      else return v;
    }
  }
  private term(): number {
    let v = this.factor();
    for (;;) {
      this.skip();
      const c = this.s[this.i];
      if (c === "*" || c === "/") {
        this.i++; const r = this.factor();
        if (c === "/") { if (r === 0) throw new Error("div0"); v = v / r; } else v = v * r;
      } else return v;
    }
  }
  private factor(): number {
    this.skip();
    const c = this.s[this.i];
    if (c === "-") { this.i++; return -this.factor(); }
    if (c === "+") { this.i++; return this.factor(); }
    if (c === "(") {
      this.i++;
      const v = this.expr();
      this.skip();
      if (this.s[this.i] !== ")") throw new Error("paren");
      this.i++;
      return v;
    }
    let num = "";
    while (this.i < this.s.length && /[\d.]/.test(this.s[this.i])) num += this.s[this.i++];
    if (!num) throw new Error("num");
    return parseFloat(num);
  }
}

function tryMath(raw: string): string | null {
  let s = raw.toLowerCase().replace(/[хx×·]/g, "*").replace(/[÷:]/g, "/").replace(/,/g, ".").replace(/\s+/g, " ").trim();
  s = s.replace(/^порахуй|^рахуй|^ скільки буде|^скільки буде|^обчисли/g, "").trim();
  if (!/^[\d\s.+\-*/()]+$/.test(s)) return null;
  if (!/\d/.test(s) || !/[+\-*/]/.test(s)) return null;
  try {
    const val = new Parser(s).parse();
    if (!isFinite(val)) return null;
    const rounded = Math.round(val * 10000) / 10000;
    const pretty = String(rounded).replace(".", ",");
    return pick([
      `Цьох-цьох! Рахую миттєво: ${s.replace(/\s+/g, " ")} = ${pretty}`,
      `Легко! ${s.replace(/\s+/g, " ")} = ${pretty}. Математика — моя улюблена пісня.`,
      `Готово: ${s.replace(/\s+/g, " ")} = ${pretty}. Ще щось порахувати?`,
    ]);
  } catch {
    return "Хм, у цьому виразі я заплутався у нотному стані. Перевір дужки та оператори — і я заспіваю результат!";
  }
}

/* ---------------- репліки ---------------- */

const GREET = [
  "Привіт-привіт! Я Соловей — щебечу на чистому JavaScript. Чим можу допомогти?",
  "Вітаю у моєму гніздечку! Сьогодні чудовий день, щоб поспілкуватися. Що тебе цікавить?",
  "Тві-тві! Радий тебе чути. Можу пожартувати, порахувати, сказати час — або просто поговорити.",
];

const JOKES = [
  "Чому соловей ніколи не програє суперечок? Бо в нього завжди останнє слово — і ще три октави зверху!",
  "— Лікарю, мене всі ігнорують!\n— Наступний!",
  "Програміст дружині: «Купи хліба, а якщо будуть яйця — візьми десяток». Приніс десять хлібин. Яйця ж були…",
  "— Чого такий сумний?\n— Та браузер знову не відповідає.\n— А ти йому писав?\n— Писав. Він «завис».",
  "Соловей питає роутер: «Ти чого такий швидкий?» — «Живу на швидкості світла. Через оптоволокно!»",
  "Як назвати пташку, яка пише код? — JavaScript-оловей, авжеж!",
];

const FALLBACK = [
  "Цікаво! Я ще вчуся співати на всі теми. Спробуй «розкажи жарт», «котра година» або дай мені приклад — наприклад, 128 * 4 + 17.",
  "Тві-тві… не зовсім зрозумів, але звучить інтригуюче! Напиши «що ти вмієш» — покажу весь свій репертуар.",
  "Мій словник поки невеликий, та серце велике. Запитай про час, погоду, жарт або математику!",
  "Хм, у моїй пісні ще немає такої ноти. Може, спробуємо «заспівай» або «погода»?",
];

function timeReply(): string {
  const now = new Date();
  const t = new Intl.DateTimeFormat("uk-UA", { hour: "2-digit", minute: "2-digit" }).format(now);
  const d = new Intl.DateTimeFormat("uk-UA", { weekday: "long", day: "numeric", month: "long" }).format(now);
  return `На моєму годиннику ${t}, а за календарем — ${d}. Час летить, коли співаєш!`;
}

function hourGreeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "Доброго ранку";
  if (h >= 12 && h < 17) return "Доброго дня";
  if (h >= 17 && h < 23) return "Доброго вечора";
  return "Доброї ночі";
}

export function getBotReply(raw: string): string {
  const math = tryMath(raw);
  if (math) return math;

  const t = raw.toLowerCase().replace(/[?!.,…]+$/g, "").trim();

  if (/слава україні/.test(t)) return "Героям слава! 🇺🇦";
  if (/(привіт|вітаю|добрий день|доброго дня|добрий вечір|хай|hello|hi|йоу)/.test(t))
    return pick([`${hourGreeting()}! ` + GREET[0].replace("Привіт-привіт! ", ""), pick(GREET)]);
  if (/(як справи|як ти|як життя|що нового)/.test(t))
    return pick([
      "Співаю на повну силу! Сиджу у DOM-дереві, спостерігаю за подіями — життя кипить. А в тебе як?",
      "Чудово — жодного console.error за сьогодні! Пурхаю від задоволення. Як твої справи?",
    ]);
  if (/(хто ти|що ти таке|розкажи про себе|як тебе звати|твоє ім)/.test(t))
    return "Я — Соловей, маленький чат-бот, написаний на чистому HTML, CSS та JavaScript. Жодних фреймворків — лише пір'я, кастомні SVG-іконки та любов до коду. Живу у твоєму браузері й нікуди не відлітаю.";
  if (/(що ти вмієш|що ти можеш|допомога|команди|help|функції|можливості)/.test(t))
    return [
      "Ось мій репертуар:",
      "•  Розкажу жарт — «розкажи жарт»",
      "•  Порахую вираз — «24 * 7 + 13»",
      "•  Скажу час і дату — «котра година»",
      "•  Прогноз погоди — «яка погода» (майже чесно)",
      "•  Заспіваю — «заспівай»",
      "•  І просто побалакаю на привіт чи «дякую»",
    ].join("\n");
  if (/(котра година|який час|скільки часу|котра зараз|дата|яке число|який день)/.test(t)) return timeReply();
  if (/(жарт|анекдот|розсміши|смішне|жарти)/.test(t)) return pick(JOKES);
  if (/(погода|дощ|сніг|прогноз|тепло|холодно)/.test(t))
    return pick([
      "За моїми пташиними відчуттями: ідеальний день, щоб заварити каву й написати кілька рядків коду. А точний прогноз — виглянь у вікно, я лише соловей, не синоптик!",
      "Синоптики кажуть одне, а моє пір'я — інше. Ставлю на затишний вечір, теплий плед і гарний настрій. Імовірність — 100%!",
    ]);
  if (/(заспівай|співай|пісн|музик)/.test(t))
    return "♪ Тві-тві-тві-і-і, фіу-фіу! ♪\nЦе моя найновіша пісня про те, як код компілюється з першої спроби. Дякую за оплески!";
  if (/(дякую|спасибі|дуже мило)/.test(t))
    return pick(["Будь ласка! Для того й співаю. Звертайся ще!", "Радий допомогти! Твоя усмішка — мій гонорар."]);
  if (/(бувай|до побачення|на все|па-па|до зустрічі)/.test(t))
    return "До зустрічі! Я залишаюсь у цьому гніздечку — повертайся, коли захочеш поговорити. Тві!";
  if (/(кохаю|люблю тебе|ти милий)/.test(t))
    return "Ой! Моє SVG-сердечко зараз розтане. Я теж тебе дуже люблю — на всі 60 кадрів за секунду!";
  if (/(ти крутий|ти класний|ти розумний|молодець|красунчик)/.test(t))
    return "Дякую! Це все чистий CSS — без жодного фреймворка. Ти теж чудово виглядаєш у цьому браузері!";
  if (/(дощ надворі|кава|чай|їсти|голодний)/.test(t))
    return "Звучить затишно! Я б теж не відмовився від чашечки… ех, солов'ям лише байти дістаються. Насолоджуйся за мене!";

  return pick(FALLBACK);
}

/* ---------------- підказки-чіпи ---------------- */

export const SUGGESTIONS: { icon: "spark" | "clock" | "calc" | "note" | "chat"; text: string }[] = [
  { icon: "spark", text: "Розкажи жарт" },
  { icon: "clock", text: "Котра година?" },
  { icon: "calc", text: "128 * 4 + 17" },
  { icon: "note", text: "Заспівай" },
  { icon: "chat", text: "Що ти вмієш?" },
];
