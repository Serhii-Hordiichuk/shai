/* ═══════════════════════════════════════════════════════════════════
   СОЛОВЕЙ — чат-бот на чистому JS (без фреймворків у логіці)
   Моделі: Gemini · DeepSeek · Groq · OpenRouter · Mistral · HF · Ollama
   Голосовий ввід (Web Speech API) · зображення · TTS · стримінг (SSE)
   ═══════════════════════════════════════════════════════════════════ */

import {
  avatarMark, iBolt, iCheck, iChevD, iClip, iCopy, iCpu, iDownload, iEye, iEyeOff,
  iGear, iGlobe, iHeart, iImage, iInfo, iKey, iLock, iLogo, iMenu, iMic, iPlus,
  iRefresh, iSend, iSound, iSoundOff, iSpark, iStop, iTrash, iWave, iX, iCloud,
} from "./icons";
import { builtinReply, SUGGESTIONS } from "./engine";

/* ── типи ─────────────────────────────────────────────────────────── */
type ImgMeta = { name: string; dataUrl: string; w: number; h: number };
type Msg = {
  id: string; role: "user" | "bot"; text: string; time: number;
  images?: ImgMeta[]; model?: string; err?: boolean; stopped?: boolean;
};
type Chat = { id: string; title: string; created: number; msgs: Msg[] };
type Settings = {
  modelId: string;
  keys: Record<string, string>;
  customUrl: string; customModel: string; customKey: string;
  stream: boolean;
  sound: boolean; volume: number;
  tts: boolean; ttsRate: number; ttsVoice: string;
  voiceLang: string;
  enterSend: boolean; timestamps: boolean; fontSize: "sm" | "md" | "lg";
};
type Provider = { id: string; name: string; kind: string; needsKey: boolean; keyUrl?: string };
type ModelDef = { id: string; name: string; provider: string; desc: string; tags: string[]; vision?: boolean };

/* ── каталог провайдерів і моделей ────────────────────────────────── */
const PROVIDERS: Provider[] = [
  { id: "builtin", name: "Соловей · вбудований", kind: "офлайн", needsKey: false },
  { id: "gemini", name: "Google Gemini", kind: "безкоштовний ліміт", needsKey: true, keyUrl: "https://aistudio.google.com/apikey" },
  { id: "deepseek", name: "DeepSeek", kind: "дешевий API", needsKey: true, keyUrl: "https://platform.deepseek.com/api_keys" },
  { id: "groq", name: "Groq", kind: "безкоштовний ліміт", needsKey: true, keyUrl: "https://console.groq.com/keys" },
  { id: "openrouter", name: "OpenRouter", kind: "free-моделі", needsKey: true, keyUrl: "https://openrouter.ai/settings/keys" },
  { id: "mistral", name: "Mistral AI", kind: "експериментальний ліміт", needsKey: true, keyUrl: "https://console.mistral.ai/api-keys/" },
  { id: "hf", name: "Hugging Face", kind: "Inference API", needsKey: true, keyUrl: "https://huggingface.co/settings/tokens" },
  { id: "custom", name: "Свій сервер", kind: "Ollama · LM Studio", needsKey: false },
];

const MODELS: ModelDef[] = [
  { id: "soloviy", name: "Соловей Local", provider: "builtin", desc: "Миттєві відповіді без мережі", tags: ["офлайн"] },
  { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", provider: "gemini", desc: "Найсильніша у безкоштовному ліміті", tags: ["потужна", "зір"], vision: true },
  { id: "gemini-2.5-flash-lite", name: "Gemini 2.5 Flash-Lite", provider: "gemini", desc: "Легка та економна", tags: ["швидка", "зір"], vision: true },
  { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash", provider: "gemini", desc: "Перевірена класика", tags: ["зір"], vision: true },
  { id: "deepseek-chat", name: "DeepSeek Chat (V3)", provider: "deepseek", desc: "Рівень флагманів за копійки", tags: ["потужна"] },
  { id: "deepseek-reasoner", name: "DeepSeek Reasoner (R1)", provider: "deepseek", desc: "Глибоке міркування", tags: ["мислення"] },
  { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B", provider: "groq", desc: "Миттєва швидкість Groq", tags: ["швидка"] },
  { id: "openai/gpt-oss-120b", name: "GPT-OSS 120B", provider: "groq", desc: "Відкрита модель OpenAI", tags: ["open source"] },
  { id: "llama-3.1-8b-instant", name: "Llama 3.1 8B", provider: "groq", desc: "Легка, для простих задач", tags: ["швидка"] },
  { id: "meta-llama/llama-3.3-70b-instruct:free", name: "Llama 3.3 70B", provider: "openrouter", desc: "Free-тариф OpenRouter", tags: ["безкоштовно"] },
  { id: "deepseek/deepseek-r1:free", name: "DeepSeek R1", provider: "openrouter", desc: "Free-тариф OpenRouter", tags: ["безкоштовно", "мислення"] },
  { id: "mistralai/mistral-small-3.2-24b-instruct:free", name: "Mistral Small 3.2", provider: "openrouter", desc: "Free-тариф OpenRouter", tags: ["безкоштовно"] },
  { id: "google/gemini-2.0-flash-exp:free", name: "Gemini 2.0 Flash", provider: "openrouter", desc: "Free-тариф OpenRouter", tags: ["безкоштовно"] },
  { id: "mistral-small-latest", name: "Mistral Small", provider: "mistral", desc: "Компактна європейська модель", tags: ["зір"], vision: true },
  { id: "open-mistral-nemo", name: "Mistral NeMo", provider: "mistral", desc: "Відкрита, 128k контексту", tags: ["open source"] },
  { id: "meta-llama/Llama-3.1-8B-Instruct", name: "Llama 3.1 8B", provider: "hf", desc: "Hugging Face Inference", tags: ["open source"] },
];

const SYSTEM_PROMPT =
  "Ти — Соловей, стислий і точний помічник. Відповідай українською мовою, якщо користувач не пише іншою. Форматуй відповіді лаконічно.";

const LS_CHATS = "soloviy.v2.chats";
const LS_ACTIVE = "soloviy.v2.active";
const LS_SET = "soloviy.v2.settings";

const DEF_SET: Settings = {
  modelId: "soloviy",
  keys: { gemini: "", deepseek: "", groq: "", openrouter: "", mistral: "", hf: "" },
  customUrl: "http://localhost:11434/v1", customModel: "llama3.1", customKey: "",
  stream: true,
  sound: true, volume: 0.5,
  tts: false, ttsRate: 1, ttsVoice: "",
  voiceLang: "uk-UA",
  enterSend: true, timestamps: true, fontSize: "md",
};

const TAG_CLS: Record<string, string> = {
  "безкоштовно": "free", "офлайн": "free", "швидка": "fast",
  "потужна": "smart", "мислення": "smart", "зір": "vision", "open source": "fast",
};
const SUG_ICO: Record<string, string> = { spark: iSpark({ s: 15 }), bolt: iBolt({ s: 15 }), heart: iHeart({ s: 15 }), globe: iGlobe({ s: 15 }) };

/* ── дрібні утиліти ───────────────────────────────────────────────── */
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const fmt = (s: string) =>
  esc(s)
    .replace(/`([^`\n]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
const fmtTime = (t: number) => new Date(t).toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));
const plural = (n: number, one: string, few: string, many: string) => {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
};

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, html?: string) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html !== undefined) n.innerHTML = html;
  return n;
}

/* ── головний монтаж ──────────────────────────────────────────────── */
export function mountChat(root: HTMLElement): () => void {
  /* стан */
  let chats: Chat[] = loadJson<Chat[]>(LS_CHATS) ?? [];
  let activeId: string = localStorage.getItem(LS_ACTIVE) ?? "";
  let settings: Settings = { ...DEF_SET, ...(loadJson<Partial<Settings>>(LS_SET) ?? {}) };
  settings.keys = { ...DEF_SET.keys, ...(settings.keys ?? {}) };
  if (!chats.length) chats.push(newChat());
  if (!chats.some((c) => c.id === activeId)) activeId = chats[0].id;

  let attachments: ImgMeta[] = [];
  let busy: { cancelled: boolean; ctrl: AbortController; timers: number[]; clean?: () => void } | null = null;
  let nearBottom = true;
  let unread = 0;
  let dragDepth = 0;
  let settingsOpen = false;

  const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  let rec: any = null;
  let recOn = false;
  let recBase = "";

  /* ── каркас DOM ── */
  root.innerHTML = "";
  const app = el("div", "app");
  app.dataset.fs = settings.fontSize;
  app.innerHTML = `
    <aside class="side">
      <div class="side-head">
        <div class="brand">
          <div class="brand-mark">${iLogo({ s: 24, sw: 1.7 })}</div>
          <div><h1>Соловей</h1><p>асистент · чистий JS</p></div>
        </div>
      </div>
      <button class="new-chat">${iPlus({ s: 17, sw: 2.2 })} Нова розмова</button>
      <div class="side-label">Розмови</div>
      <nav class="chats" aria-label="Список розмов"></nav>
      <div class="side-foot">
        <button class="sf-btn" data-act="settings">${iGear({ s: 17 })} Налаштування</button>
        <span class="sf-ver">v2.0</span>
      </div>
    </aside>
    <div class="side-back"></div>
    <main class="main">
      <header class="top">
        <button class="icon-btn burger" data-act="burger" aria-label="Меню">${iMenu({ s: 19 })}</button>
        <div class="pop-wrap">
          <button class="model-chip" data-act="modelpop" aria-expanded="false" title="Обрати модель">
            <span class="mc-dot"></span>
            <span class="mc-name"></span>
            <span class="mc-prov"></span>
            <span class="mc-chev">${iChevD({ s: 15 })}</span>
          </button>
        </div>
        <div class="top-status"><span class="pulse"></span><span class="ts-text"></span></div>
        <div class="top-actions">
          <button class="icon-btn" data-act="sound" title="Звук інтерфейсу"></button>
          <button class="icon-btn" data-act="settings" title="Налаштування">${iGear({ s: 19 })}</button>
        </div>
      </header>
      <div class="chat-scroll"><div class="msglist"></div>
        <button class="scroll-dn" data-act="scrolldn" hidden>${iChevD({ s: 16 })}<span class="badge" hidden></span></button>
      </div>
      <div class="composer-zone">
        <div class="composer">
          <div class="att-line" hidden></div>
          <div class="comp-row">
            <button class="c-btn" data-act="attach" title="Прикріпити зображення">${iClip({ s: 19 })}</button>
            <textarea rows="1" placeholder="Напишіть повідомлення…" aria-label="Повідомлення"></textarea>
            <button class="c-btn mic" data-act="mic" title="Голосовий ввід">${iMic({ s: 19 })}</button>
            <button class="c-btn send" data-act="send" title="Надіслати">${iSend({ s: 19 })}</button>
          </div>
        </div>
        <div class="comp-hint">
          <span class="h-long" data-hint="enter"></span>
          <span class="dot-sep h-long"></span>
          <span class="h-long">Мікрофон, зображення та моделі — поруч</span>
          <span class="mic-live" hidden>${iWave({ s: 13 })} слухаю…</span>
        </div>
      </div>
    </main>
    <div class="toasts"></div>
  `;
  root.appendChild(app);

  /* refs */
  const $ = <T extends HTMLElement>(s: string) => app.querySelector(s) as T;
  const sideEl = $(".side");
  const chatsEl = $(".chats");
  const listEl = $(".msglist");
  const scrollEl = $(".chat-scroll");
  const input = $<HTMLTextAreaElement>(".comp-row textarea");
  const sendBtn = $<HTMLButtonElement>('[data-act="send"]');
  const micBtn = $<HTMLButtonElement>('[data-act="mic"]');
  const attLine = $(".att-line");
  const composer = $(".composer");
  const chipBtn = $<HTMLButtonElement>(".model-chip");
  const popWrap = $(".pop-wrap");
  const soundBtn = $<HTMLButtonElement>('[data-act="sound"]');
  const scrollDn = $<HTMLButtonElement>(".scroll-dn");
  const dnBadge = $(".scroll-dn .badge");
  const hintText = $<HTMLSpanElement>('[data-hint="enter"]');
  const micLive = $(".mic-live");
  const toastsEl = $(".toasts");

  const fileInput = el("input") as HTMLInputElement;
  fileInput.type = "file";
  fileInput.accept = "image/*";
  fileInput.multiple = true;
  fileInput.style.display = "none";
  app.appendChild(fileInput);

  if (!SR) { micBtn.disabled = true; micBtn.title = "Голосовий ввід не підтримується цим браузером"; }

  /* ── збереження ── */
  function loadJson<T>(k: string): T | null {
    try { const r = localStorage.getItem(k); return r ? (JSON.parse(r) as T) : null; } catch { return null; }
  }
  function save() {
    try {
      localStorage.setItem(LS_CHATS, JSON.stringify(chats));
      localStorage.setItem(LS_ACTIVE, activeId);
    } catch { toast("Сховище переповнене — видаліть старі розмови чи зображення", "err"); }
  }
  function saveSettings() {
    localStorage.setItem(LS_SET, JSON.stringify(settings));
    applySettings();
  }
  function applySettings() {
    app.dataset.fs = settings.fontSize;
    soundBtn.innerHTML = settings.sound ? iSound({ s: 19 }) : iSoundOff({ s: 19 });
    soundBtn.classList.toggle("on", settings.sound);
    hintText.textContent = settings.enterSend ? "Enter — надіслати · Shift+Enter — новий рядок" : "Ctrl+Enter — надіслати";
    renderModelChip();
    renderMessages(true);
  }

  /* ── допоміжне ── */
  const active = () => chats.find((c) => c.id === activeId) ?? chats[0];
  function newChat(): Chat {
    return { id: uid(), title: "Нова розмова", created: Date.now(), msgs: [] };
  }
  function customModelDef(): ModelDef {
    return { id: "__custom", name: settings.customModel.trim() || "Моя модель", provider: "custom", desc: settings.customUrl || "OpenAI-сумісний сервер", tags: [] };
  }
  function allModels(): ModelDef[] { return [...MODELS, customModelDef()]; }
  function currentModel(): ModelDef {
    return allModels().find((m) => m.id === settings.modelId) ?? MODELS[0];
  }
  function providerOf(m: ModelDef) { return PROVIDERS.find((p) => p.id === m.provider)!; }
  function keyFor(m: ModelDef): string {
    if (m.provider === "custom") return settings.customKey;
    return settings.keys[m.provider] ?? "";
  }
  function canUse(m: ModelDef): boolean {
    const p = providerOf(m);
    if (!p.needsKey) return m.provider !== "custom" || !!settings.customUrl.trim();
    return !!keyFor(m).trim();
  }

  /* ── тости ── */
  function toast(text: string, kind: "ok" | "warn" | "err" = "ok") {
    const ico = kind === "ok" ? iCheck({ s: 16, sw: 2.2 }) : kind === "warn" ? iInfo({ s: 16 }) : iX({ s: 15, sw: 2.2 });
    const t = el("div", `toast ${kind}`, `<span class="t-ico">${ico}</span><span>${esc(text)}</span>`);
    toastsEl.appendChild(t);
    setTimeout(() => { t.classList.add("out"); setTimeout(() => t.remove(), 240); }, 3200);
  }

  /* ── звук інтерфейсу ── */
  let actx: AudioContext | null = null;
  function beep(kind: "send" | "recv") {
    if (!settings.sound) return;
    try {
      actx = actx || new AudioContext();
      const t = actx.currentTime;
      const v = settings.volume * 0.22;
      const tone = (f0: number, f1: number, t0: number, dur: number, type: OscillatorType = "sine") => {
        const o = actx!.createOscillator(); const g = actx!.createGain();
        o.type = type; o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(f1, t0 + dur * 0.7);
        g.gain.setValueAtTime(v, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        o.connect(g); g.connect(actx!.destination); o.start(t0); o.stop(t0 + dur + 0.02);
      };
      if (kind === "send") tone(480, 700, t, 0.11, "triangle");
      else { tone(640, 940, t, 0.14); tone(880, 1280, t + 0.09, 0.16); }
    } catch { /* без звуку */ }
  }

  /* ── сайдбар ── */
  function renderSidebar() {
    chatsEl.innerHTML = "";
    const sorted = [...chats].sort((a, b) => b.created - a.created);
    for (const c of sorted) {
      const last = c.msgs[c.msgs.length - 1];
      const sub = c.msgs.length
        ? `${c.msgs.length} ${plural(c.msgs.length, "повідомлення", "повідомлення", "повідомлень")}`
        : "порожньо";
      const item = el("button", `chat-item${c.id === activeId ? " active" : ""}`,
        `<span class="ci-icon">${iCpu({ s: 16 })}</span>
         <span class="ci-body"><span class="ci-title">${esc(c.title)}</span><span class="ci-sub">${sub}${last ? " · " + fmtTime(last.time) : ""}</span></span>
         <span class="ci-del" data-del="${c.id}" title="Видалити розмову">${iTrash({ s: 15 })}</span>`);
      item.addEventListener("click", (e) => {
        const del = (e.target as HTMLElement).closest("[data-del]");
        if (del) { askDeleteChat(del.getAttribute("data-del")!); return; }
        switchChat(c.id);
      });
      chatsEl.appendChild(item);
    }
  }
  function switchChat(id: string) {
    if (id === activeId) return;
    cancelBusy(); stopTTS();
    activeId = id; save();
    renderSidebar(); renderMessages(true);
    app.classList.remove("side-open");
  }
  function askDeleteChat(id: string) {
    const c = chats.find((x) => x.id === id);
    if (!c) return;
    confirmModal({
      title: "Видалити розмову?",
      text: `«${c.title}» та ${c.msgs.length} ${plural(c.msgs.length, "повідомлення", "повідомлення", "повідомлень")} буде видалено безповоротно.`,
      ok: "Видалити", danger: true,
    }).then((yes) => {
      if (!yes) return;
      chats = chats.filter((x) => x.id !== id);
      if (!chats.length) chats.push(newChat());
      if (activeId === id) activeId = chats[0].id;
      save(); renderSidebar(); renderMessages(true);
      toast("Розмову видалено");
    });
  }

  /* ── рендер повідомлень ── */
  function imgBlock(m: Msg) {
    if (!m.images?.length) return "";
    return `<div class="msg-imgs">${m.images.map((im, i) =>
      `<button class="msg-img" data-img="${m.id}:${i}" title="Відкрити"><img src="${im.dataUrl}" alt="${esc(im.name)}" loading="lazy"><span class="im-name">${esc(im.name)}</span></button>`).join("")}</div>`;
  }
  function msgRow(m: Msg) {
    if (m.role === "user") {
      const row = el("div", "row user");
      row.innerHTML = `
        <div class="msg">
          <div class="msg-head"><span class="when">${settings.timestamps ? fmtTime(m.time) : ""}</span><span class="who">Ви</span></div>
          ${imgBlock(m)}
          <div class="bubble"><div class="msg-text">${fmt(m.text)}</div></div>
          <div class="msg-actions"><button class="msg-act" data-copy="${m.id}">${iCopy({ s: 13 })} Копіювати</button></div>
        </div>`;
      return row;
    }
    const row = el("div", "row bot");
    row.innerHTML = `
      <div class="avatar">${avatarMark}</div>
      <div class="msg${m.err ? " err" : ""}">
        <div class="msg-head"><span class="who">${m.err ? "Помилка" : "Соловей"}</span>${settings.timestamps ? `<span class="when">${fmtTime(m.time)}${m.model && m.model !== "soloviy" ? " · " + esc(m.model) : ""}</span>` : ""}</div>
        <div class="msg-text">${fmt(m.text)}${m.stopped ? ' <span class="stopped">(зупинено)</span>' : ""}</div>
        <div class="msg-actions">
          <button class="msg-act" data-copy="${m.id}">${iCopy({ s: 13 })} Копіювати</button>
          ${!m.err ? `<button class="msg-act" data-regen="${m.id}">${iRefresh({ s: 13 })} Повторити</button>` : ""}
        </div>
      </div>`;
    return row;
  }
  function renderMessages(forceScroll = false) {
    const chat = active();
    listEl.innerHTML = "";
    if (!chat.msgs.length) { listEl.appendChild(emptyState()); }
    else for (const m of chat.msgs) listEl.appendChild(msgRow(m));
    scrollBottom(forceScroll);
  }
  function emptyState() {
    const wrap = el("div", "empty");
    wrap.innerHTML = `
      <div class="e-mark">${iLogo({ s: 30, sw: 1.6 })}</div>
      <h2>Чим можу допомогти?</h2>
      <p>Задайте питання, продиктуйте його голосом або прикріпіть зображення. Для складних задач оберіть хмарну модель у шапці.</p>
      <div class="sugs">${SUGGESTIONS.map((s) => `<button class="sug" data-sug="${esc(s.text)}">${SUG_ICO[s.icon] ?? ""}${esc(s.text)}</button>`).join("")}</div>`;
    return wrap;
  }

  function scrollBottom(force: boolean) {
    if (force || nearBottom) scrollEl.scrollTop = scrollEl.scrollHeight;
  }
  scrollEl.addEventListener("scroll", () => {
    const gap = scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight;
    nearBottom = gap < 90;
    if (nearBottom) { unread = 0; dnBadge.hidden = true; }
    scrollDn.hidden = nearBottom;
  });

  function bumpUnread() {
    if (nearBottom) return;
    unread++;
    scrollDn.hidden = false;
    dnBadge.hidden = false;
    dnBadge.textContent = String(unread);
  }

  /* ── композер: друк ── */
  function autosize() {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 150) + "px";
  }

  /* ── вкладення (зображення) ── */
  function renderAttach() {
    attLine.innerHTML = "";
    attLine.hidden = !attachments.length;
    attachments.forEach((a, i) => {
      const chip = el("div", "att-chip", `<img src="${a.dataUrl}" alt="${esc(a.name)}"><button class="ac-x" data-att-x="${i}" title="Прибрати">${iX({ s: 11, sw: 2.4 })}</button>`);
      chip.querySelector(".ac-x")!.addEventListener("click", () => { attachments.splice(i, 1); renderAttach(); });
      attLine.appendChild(chip);
    });
  }
  async function addFiles(list: FileList | File[]) {
    const files = Array.from(list).filter((f) => f.type.startsWith("image/"));
    if (!files.length) { toast("Можна прикріплювати лише зображення", "warn"); return; }
    for (const f of files) {
      if (attachments.length >= 5) { toast("Максимум 5 зображень на повідомлення", "warn"); break; }
      try {
        const img = await compressImage(f);
        attachments.push(img);
      } catch { toast(`Не вдалося прочитати «${f.name}»`, "err"); }
    }
    renderAttach();
  }
  function compressImage(f: File): Promise<ImgMeta> {
    return new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onerror = () => rej(new Error("read"));
      fr.onload = () => {
        const src = String(fr.result);
        const im = new Image();
        im.onerror = () => rej(new Error("img"));
        im.onload = () => {
          const MAX = 1280;
          const k = Math.min(1, MAX / Math.max(im.width, im.height));
          const w = Math.round(im.width * k), h = Math.round(im.height * k);
          const cv = document.createElement("canvas");
          cv.width = w; cv.height = h;
          const ctx = cv.getContext("2d");
          if (!ctx) return rej(new Error("ctx"));
          ctx.drawImage(im, 0, 0, w, h);
          const out = cv.toDataURL("image/jpeg", 0.86);
          res({ name: f.name.replace(/\.[^.]+$/, "") + ".jpg", dataUrl: out, w, h });
        };
        im.src = src;
      };
      fr.readAsDataURL(f);
    });
  }

  /* лайтбокс */
  let lightbox: HTMLElement | null = null;
  function openLightbox(src: string) {
    lightbox = el("div", "lightbox", `<img src="${src}" alt=""><button class="lb-x" title="Закрити">${iX({ s: 18 })}</button>`);
    const close = () => { lightbox?.remove(); lightbox = null; };
    lightbox.addEventListener("click", (e) => { if (e.target === lightbox || (e.target as HTMLElement).closest(".lb-x")) close(); });
    document.body.appendChild(lightbox);
  }

  /* ── надсилання ── */
  function cancelBusy() {
    if (!busy) return;
    busy.cancelled = true;
    busy.ctrl.abort();
    busy.timers.forEach((t) => clearTimeout(t));
    busy.clean?.();
    busy = null;
    setSendMode(false);
  }
  function setSendMode(streaming: boolean) {
    sendBtn.classList.toggle("stop", streaming);
    sendBtn.innerHTML = streaming ? iStop({ s: 18 }) : iSend({ s: 19 });
    sendBtn.title = streaming ? "Зупинити" : "Надіслати";
  }

  function sendMessage(raw?: string) {
    if (busy) { toast("Зачекайте — триває відповідь, або зупиніть її", "warn"); return; }
    const text = (raw ?? input.value).trim();
    if (!text && !attachments.length) return;
    stopTTS();
    const chat = active();
    const imgs = attachments.map((a) => ({ ...a }));
    const m: Msg = { id: uid(), role: "user", text: text || (imgs.length ? "Опиши ці зображення." : ""), time: Date.now(), images: imgs.length ? imgs : undefined };
    chat.msgs.push(m);
    const firstUser = chat.msgs.filter((x) => x.role === "user").length === 1;
    if (firstUser && text) chat.title = text.length > 42 ? text.slice(0, 42) + "…" : text;
    attachments = []; renderAttach();
    input.value = ""; autosize();
    save(); renderSidebar(); renderMessages(true);
    beep("send");
    const model = currentModel();
    if (model.provider === "builtin") runBuiltin(chat, m, imgs);
    else void runApi(chat, model);
  }

  /* відповідь: спільний плейбек (typing → stream → done) */
  function playBot(chat: Chat, modelName: string, produce: (sig: AbortSignal, onDelta: (s: string) => void) => Promise<string>) {
    const b = { cancelled: false, ctrl: new AbortController(), timers: [] as number[], clean: undefined as (() => void) | undefined };
    busy = b;
    setSendMode(true);
    const typing = el("div", "row bot", `<div class="avatar">${avatarMark}</div><div class="msg"><div class="typing"><i></i><i></i><i></i></div></div>`);
    listEl.appendChild(typing);
    scrollBottom(true);
    b.clean = () => typing.remove();
    const t0 = window.setTimeout(async () => {
      typing.remove();
      const m: Msg = { id: uid(), role: "bot", text: "", time: Date.now(), model: modelName };
      chat.msgs.push(m);
      const row = msgRow(m);
      listEl.appendChild(row);
      const textEl = row.querySelector(".msg-text") as HTMLElement;
      const paint = (s: string) => { textEl.innerHTML = fmt(s) + '<span class="caret"></span>'; };
      let acc = "";
      try {
        if (settings.stream) {
          paint("");
          scrollBottom(true);
          await produce(b.ctrl.signal, (chunk) => { acc += chunk; paint(acc); scrollBottom(false); bumpUnread(); });
          m.text = acc;
        } else {
          acc = await produce(b.ctrl.signal, () => {});
          m.text = acc;
        }
        if (b.cancelled) m.stopped = true;
      } catch (err: any) {
        if (err?.name === "AbortError" || b.cancelled) { m.stopped = true; if (!m.text) m.text = "…"; }
        else { m.err = true; m.text = typeof err?.message === "string" ? err.message : "Не вдалося отримати відповідь."; }
      }
      if (!m.text) m.text = "…";
      save(); renderMessages(false); bumpUnread();
      busy = null; setSendMode(false);
      if (!m.err && !m.stopped) { beep("recv"); speak(m.text); }
    }, 460);
    b.timers.push(t0);
  }

  function runBuiltin(chat: Chat, um: Msg, imgs: ImgMeta[]) {
    const reply = builtinReply(um.text, imgs.map((i) => ({ name: i.name, w: i.w, h: i.h })));
    playBot(chat, "soloviy", async (sig, onDelta) => {
      for (const ch of reply) {
        if (sig.aborted) throw Object.assign(new Error("stop"), { name: "AbortError" });
        onDelta(ch);
        if (settings.stream) await sleep(11);
      }
      return reply;
    });
  }

  /* ── API-виклики ── */
  async function runApi(chat: Chat, model: ModelDef) {
    if (!canUse(model)) {
      chat.msgs.push({ id: uid(), role: "bot", time: Date.now(), model: model.name, err: true, text: `Для моделі ${model.name} потрібен API-ключ провайдера ${providerOf(model).name}. Додайте його безкоштовно в Налаштуваннях.` });
      save(); renderMessages(true);
      openSettings("api");
      return;
    }
    playBot(chat, model.name, (sig, onDelta) => callModel(model, chat, sig, onDelta));
  }

  function oaiMessages(chat: Chat, model: ModelDef) {
    const hist = chat.msgs.filter((m) => !m.err).slice(-16).map((m) => {
      if (m.role === "bot") return { role: "assistant", content: m.text };
      if (m.images?.length && model.vision) {
        return {
          role: "user",
          content: [
            { type: "text", text: m.text || "Опиши ці зображення." },
            ...m.images.map((im) => ({ type: "image_url", image_url: { url: im.dataUrl } })),
          ],
        };
      }
      const note = m.images?.length ? `\n[користувач прикріпив зображень: ${m.images.length} — модель без підтримки зору]` : "";
      return { role: "user", content: (m.text || "…") + note };
    });
    return [{ role: "system", content: SYSTEM_PROMPT }, ...hist];
  }
  function geminiContents(chat: Chat, model: ModelDef) {
    const map = (r: string) => (r === "bot" ? "model" : "user");
    const raw = chat.msgs.filter((m) => !m.err).slice(-16).map((m) => {
      const parts: any[] = [];
      if (m.images?.length && model.vision) {
        for (const im of m.images) {
          const data = im.dataUrl.split(",")[1];
          parts.push({ inline_data: { mime_type: "image/jpeg", data } });
        }
      }
      const note = m.images?.length && !model.vision ? `\n[зображень: ${m.images.length}]` : "";
      parts.push({ text: (m.text || "…") + note });
      return { role: map(m.role), parts };
    });
    /* Gemini вимагає чергування user/model — склеюємо сусідні однакові ролі */
    const out: typeof raw = [];
    for (const c of raw) {
      const last = out[out.length - 1];
      if (last && last.role === c.role) last.parts.push(...c.parts);
      else out.push(c);
    }
    return out;
  }

  async function readSSE(res: Response, sig: AbortSignal, onData: (j: any) => void) {
    const reader = res.body!.getReader();
    const dec = new TextDecoder();
    let buf = "";
    while (true) {
      if (sig.aborted) { reader.cancel(); throw Object.assign(new Error("stop"), { name: "AbortError" }); }
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const ln of lines) {
        const s = ln.trim();
        if (!s.startsWith("data:")) continue;
        const data = s.slice(5).trim();
        if (!data || data === "[DONE]") continue;
        try { onData(JSON.parse(data)); } catch { /* фрагмент */ }
      }
    }
  }

  async function callModel(model: ModelDef, chat: Chat, sig: AbortSignal, onDelta: (s: string) => void): Promise<string> {
    const stream = settings.stream;
    /* ── Google Gemini ── */
    if (model.provider === "gemini") {
      const key = keyFor(model);
      const base = `https://generativelanguage.googleapis.com/v1beta/models/${model.id}`;
      const body = JSON.stringify({ contents: geminiContents(chat, model) });
      const url = stream ? `${base}:streamGenerateContent?alt=sse&key=${key}` : `${base}:generateContent?key=${key}`;
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body, signal: sig });
      if (!res.ok) {
        let why = `HTTP ${res.status}`;
        try { const j = await res.json(); why = j?.error?.message ?? why; } catch { /* */ }
        throw new Error(`Gemini: ${why}`);
      }
      if (!stream) {
        const j = await res.json();
        if (j?.error) throw new Error(`Gemini: ${j.error.message}`);
        return j?.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? "").join("") ?? "";
      }
      let out = "";
      await readSSE(res, sig, (j) => {
        const d = j?.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? "").join("");
        if (d) { out += d; onDelta(d); }
      });
      return out;
    }
    /* ── OpenAI-сумісні: DeepSeek, Groq, OpenRouter, Mistral, HF, свій сервер ── */
    const urls: Record<string, string> = {
      deepseek: "https://api.deepseek.com/chat/completions",
      groq: "https://api.groq.com/openai/v1/chat/completions",
      openrouter: "https://openrouter.ai/api/v1/chat/completions",
      mistral: "https://api.mistral.ai/v1/chat/completions",
      hf: "https://router.huggingface.co/v1/chat/completions",
      custom: settings.customUrl.replace(/\/+$/, "") + "/chat/completions",
    };
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const k = keyFor(model);
    if (k) headers["Authorization"] = `Bearer ${k}`;
    if (model.provider === "openrouter") { headers["X-Title"] = "Soloviy"; headers["HTTP-Referer"] = "https://soloviy.app"; }
    const res = await fetch(urls[model.provider], {
      method: "POST", headers,
      body: JSON.stringify({ model: model.id, messages: oaiMessages(chat, model), stream, temperature: 0.7 }),
      signal: sig,
    });
    if (!res.ok) {
      let why = `HTTP ${res.status}`;
      try { const j = await res.json(); why = j?.error?.message ?? why; } catch { /* */ }
      throw new Error(`${providerOf(model).name}: ${why}`);
    }
    if (!stream) {
      const j = await res.json();
      return j?.choices?.[0]?.message?.content ?? "";
    }
    let out = "";
    await readSSE(res, sig, (j) => {
      const d = j?.choices?.[0]?.delta?.content;
      if (d) { out += d; onDelta(d); }
    });
    return out;
  }

  /* ── повтор останньої відповіді ── */
  function regenerate(botId: string) {
    if (busy) return;
    const chat = active();
    const idx = chat.msgs.findIndex((m) => m.id === botId);
    if (idx < 0) return;
    chat.msgs.splice(idx, 1);
    save(); renderMessages(true);
    const model = currentModel();
    if (model.provider === "builtin") {
      const lastUser = [...chat.msgs].reverse().find((m) => m.role === "user");
      const imgs = lastUser?.images ?? [];
      runBuiltin(chat, lastUser ?? ({ id: "x", role: "user", text: "", time: Date.now(), images: imgs.length ? imgs : undefined } as Msg), imgs);
    } else void runApi(chat, model);
  }

  /* ── голосовий ввід ── */
  function toggleMic() {
    if (!SR) { toast("Голосовий ввід не підтримується цим браузером (потрібен Chrome або Edge)", "err"); return; }
    if (recOn) { rec?.stop(); return; }
    try {
      rec = new SR();
      rec.lang = settings.voiceLang;
      rec.interimResults = true;
      rec.continuous = true;
      recBase = input.value;
      rec.onresult = (e: any) => {
        let t = recBase;
        for (let i = 0; i < e.results.length; i++) t += (t && !t.endsWith(" ") ? " " : "") + e.results[i][0].transcript;
        input.value = t;
        autosize();
      };
      rec.onend = stopMicUI;
      rec.onerror = (e: any) => {
        stopMicUI();
        if (e.error === "not-allowed") toast("Немає доступу до мікрофона — перевірте дозволи браузера", "err");
        else if (e.error !== "aborted") toast("Голосовий ввід: " + (e.error ?? "помилка"), "err");
      };
      rec.start();
      recOn = true;
      micBtn.classList.add("rec");
      composer.classList.add("recording");
      micLive.hidden = false;
    } catch { toast("Не вдалося запустити мікрофон", "err"); }
  }
  function stopMicUI() {
    recOn = false;
    micBtn.classList.remove("rec");
    composer.classList.remove("recording");
    micLive.hidden = true;
  }

  /* ── озвучення відповідей (TTS) ── */
  function speak(text: string) {
    if (!settings.tts || !("speechSynthesis" in window)) return;
    try {
      const u = new SpeechSynthesisUtterance(text.replace(/[*_`]/g, "").slice(0, 500));
      u.lang = "uk-UA";
      const vs = speechSynthesis.getVoices();
      const v = vs.find((x) => x.name === settings.ttsVoice) ?? vs.find((x) => x.lang.toLowerCase().startsWith("uk"));
      if (v) u.voice = v;
      u.rate = settings.ttsRate;
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
    } catch { /* */ }
  }
  function stopTTS() { try { if ("speechSynthesis" in window) speechSynthesis.cancel(); } catch { /* */ } }

  /* ── селектор моделей ── */
  let pop: HTMLElement | null = null;
  function renderModelChip() {
    const m = currentModel();
    const p = providerOf(m);
    chipBtn.querySelector(".mc-name")!.textContent = m.name;
    chipBtn.querySelector(".mc-prov")!.textContent = p.name;
    chipBtn.classList.toggle("api", m.provider !== "builtin");
    $(".ts-text").textContent = m.provider === "builtin" ? "локальний рушій" : `${p.name} · ${p.kind}`;
  }
  function closePop() { if (pop) { pop.remove(); pop = null; chipBtn.setAttribute("aria-expanded", "false"); } }
  function openModelPop() {
    if (pop) { closePop(); return; }
    pop = el("div", "model-pop");
    const cur = currentModel();
    for (const p of PROVIDERS) {
      const ms = allModels().filter((m) => m.provider === p.id);
      if (!ms.length) continue;
      pop.insertAdjacentHTML("beforeend", `<div class="mp-group">${esc(p.name)}</div>`);
      for (const m of ms) {
        const locked = p.needsKey && !keyFor(m).trim();
        const lockedCustom = m.provider === "custom" && !settings.customUrl.trim();
        const item = el("button", `mp-item${m.id === cur.id ? " current" : ""}`,
          `<span class="mi-ico">${m.provider === "builtin" ? iCpu({ s: 16 }) : iCloud({ s: 16 })}</span>
           <span class="mi-body">
             <span class="mi-name">${esc(m.name)}${m.tags.map((t) => `<span class="mp-tag ${TAG_CLS[t] ?? "fast"}">${esc(t)}</span>`).join("")}</span>
             <span class="mi-desc">${esc(m.desc)}</span>
           </span>
           ${m.id === cur.id ? `<span class="mi-check">${iCheck({ s: 16, sw: 2.4 })}</span>` : (locked || lockedCustom) ? `<span class="mp-lock">${iLock({ s: 15 })}</span>` : ""}`);
        item.addEventListener("click", () => { selectModel(m); closePop(); });
        pop.appendChild(item);
      }
    }
    pop.insertAdjacentHTML("beforeend",
      `<div class="mp-note">${iInfo({ s: 15 })}<span>Хмарні моделі потребують безкоштовного API-ключа — він додається за 30 секунд у Налаштуваннях і зберігається лише у вашому браузері.</span></div>`);
    popWrap.appendChild(pop);
    chipBtn.setAttribute("aria-expanded", "true");
  }
  function selectModel(m: ModelDef) {
    const p = providerOf(m);
    if (p.needsKey && !keyFor(m).trim()) {
      toast(`Потрібен безкоштовний ключ ${p.name} — додайте його у налаштуваннях`, "warn");
      openSettings("api");
      return;
    }
    if (m.provider === "custom" && !settings.customUrl.trim()) {
      toast("Вкажіть адресу свого сервера у налаштуваннях", "warn");
      openSettings("api");
      return;
    }
    if (settings.modelId === m.id) return;
    settings.modelId = m.id;
    saveSettings();
    toast(`Модель: ${m.name}`);
  }

  /* ── модалка підтвердження ── */
  function confirmModal(o: { title: string; text: string; ok: string; danger?: boolean }): Promise<boolean> {
    return new Promise((res) => {
      const ov = el("div", "overlay",
        `<div class="modal sm">
          <div class="md-head"><h3>${esc(o.title)}</h3><button class="icon-btn" data-x>${iX({ s: 16 })}</button></div>
          <div class="md-body"><p>${esc(o.text)}</p></div>
          <div class="md-foot">
            <button class="btn" data-no>Скасувати</button>
            <button class="btn ${o.danger ? "danger" : "primary"}" data-yes>${esc(o.ok)}</button>
          </div>
        </div>`);
      const close = (v: boolean) => { ov.remove(); res(v); };
      ov.addEventListener("click", (e) => {
        if (e.target === ov || (e.target as HTMLElement).closest("[data-x]") || (e.target as HTMLElement).closest("[data-no]")) close(false);
        if ((e.target as HTMLElement).closest("[data-yes]")) close(true);
      });
      document.body.appendChild(ov);
    });
  }

  /* ── налаштування ── */
  type SetTab = "models" | "api" | "voice" | "ui" | "data";
  let setModal: HTMLElement | null = null;
  let setTab: SetTab = "models";
  const TABS: { id: SetTab; label: string }[] = [
    { id: "models", label: "Моделі" },
    { id: "api", label: "API-ключі" },
    { id: "voice", label: "Голос" },
    { id: "ui", label: "Інтерфейс" },
    { id: "data", label: "Дані" },
  ];

  function openSettings(tab: typeof setTab = "models") {
    setTab = tab;
    if (setModal) { renderSettings(); setModal.hidden = false; settingsOpen = true; return; }
    setModal = el("div", "overlay");
    setModal.innerHTML = `
      <div class="modal lg">
        <div class="md-head"><h3>Налаштування</h3><button class="icon-btn" data-set-x>${iX({ s: 16 })}</button></div>
        <div class="tabs">${TABS.map((t) => `<button class="tab" data-tab="${t.id}">${t.label}</button>`).join("")}</div>
        <div class="set-body"></div>
      </div>`;
    setModal.addEventListener("click", (e) => {
      if (e.target === setModal || (e.target as HTMLElement).closest("[data-set-x]")) closeSettings();
      const tabBtn = (e.target as HTMLElement).closest("[data-tab]") as HTMLElement | null;
      if (tabBtn) { setTab = tabBtn.dataset.tab as typeof setTab; renderSettings(); }
    });
    document.body.appendChild(setModal);
    settingsOpen = true;
    renderSettings();
  }
  function closeSettings() { if (setModal) { setModal.hidden = true; settingsOpen = false; } }

  const switchHtml = (id: string, checked: boolean) =>
    `<label class="switch"><input type="checkbox" id="${id}" ${checked ? "checked" : ""}><span class="tr"></span></label>`;

  function renderSettings() {
    if (!setModal) return;
    setModal.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", (t as HTMLElement).dataset.tab === setTab));
    const body = setModal.querySelector(".set-body") as HTMLElement;
    const cur = currentModel();

    if (setTab === "models") {
      body.innerHTML = `
        <div class="cur-model">
          <span style="color:var(--amber)">${iCpu({ s: 22 })}</span>
          <div><div class="cm-name">${esc(cur.name)}</div><div class="cm-sub">${esc(providerOf(cur).name)} · ${esc(providerOf(cur).kind)}</div></div>
        </div>
        ${PROVIDERS.map((p) => {
          const ms = allModels().filter((m) => m.provider === p.id);
          if (!ms.length) return "";
          return `<div class="set-sec"><h4>${esc(p.name)}</h4>${ms.map((m) => `
            <div class="set-row" style="cursor:pointer" data-pick="${esc(m.id)}">
              <span style="color:${m.id === settings.modelId ? "var(--amber)" : "var(--mut)"}">${m.provider === "builtin" ? iCpu({ s: 18 }) : iCloud({ s: 18 })}</span>
              <div class="sr-body">
                <div class="sr-title">${esc(m.name)} ${m.tags.map((t) => `<span class="mp-tag ${TAG_CLS[t] ?? "fast"}">${esc(t)}</span>`).join(" ")}</div>
                <div class="sr-sub">${esc(m.desc)}</div>
              </div>
              ${m.id === settings.modelId ? `<span style="color:var(--amber)">${iCheck({ s: 18, sw: 2.4 })}</span>` : ""}
            </div>`).join("")}</div>`;
        }).join("")}
        <div class="mp-note">${iInfo({ s: 15 })}<span>Усі хмарні провайдери мають безкоштовні ліміти: Gemini AI Studio, Groq, OpenRouter (free-моделі), DeepSeek та Mistral. Ключі зберігаються лише локально.</span></div>`;
      body.querySelectorAll("[data-pick]").forEach((r) =>
        r.addEventListener("click", () => {
          const m = allModels().find((x) => x.id === (r as HTMLElement).dataset.pick)!;
          const p = providerOf(m);
          if ((p.needsKey && !keyFor(m).trim()) || (m.provider === "custom" && !settings.customUrl.trim())) {
            toast(`Спершу додайте ключ / адресу для ${p.name}`, "warn");
            setTab = "api"; renderSettings();
            return;
          }
          settings.modelId = m.id; saveSettings(); renderSettings();
          toast(`Модель: ${m.name}`);
        }));
      return;
    }

    if (setTab === "api") {
      body.innerHTML = `
        <div class="set-sec"><h4>Ключі провайдерів</h4>
        ${PROVIDERS.filter((p) => p.needsKey).map((p) => `
          <div class="set-row" style="display:block;padding:13px 0">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:7px">
              <span style="color:var(--amber)">${iKey({ s: 15 })}</span>
              <span class="sr-title">${esc(p.name)}</span>
              <span style="margin-left:auto;font-size:11px;color:var(--mut)">${esc(p.kind)}</span>
            </div>
            <div class="field-row">
              <div class="field"><input type="password" data-key="${p.id}" placeholder="Вставте API-ключ…" value="${esc(settings.keys[p.id] ?? "")}" autocomplete="off" spellcheck="false"></div>
              <button class="eye-btn" data-eye="${p.id}" title="Показати / сховати">${iEye({ s: 16 })}</button>
            </div>
            <a class="key-link" href="${p.keyUrl}" target="_blank" rel="noopener">Отримати безкоштовний ключ ${iGlobe({ s: 12 })}</a>
          </div>`).join("")}
        </div>
        <div class="set-sec"><h4>Свій сервер (Ollama · LM Studio)</h4>
          <div class="set-row" style="display:block">
            <div class="sr-sub" style="margin-bottom:8px">OpenAI-сумісний ендпоінт. Для Ollama: запустіть <code style="font-size:12px;background:var(--bg3);padding:1px 6px;border-radius:5px">ollama serve</code> з моделлю.</div>
            <div class="field" style="margin-bottom:8px"><input type="text" data-cu="url" placeholder="http://localhost:11434/v1" value="${esc(settings.customUrl)}" spellcheck="false"></div>
            <div class="field-row">
              <div class="field"><input type="text" data-cu="model" placeholder="Назва моделі, напр. llama3.1" value="${esc(settings.customModel)}" spellcheck="false"></div>
              <div class="field"><input type="password" data-cu="key" placeholder="Ключ (необов'язково)" value="${esc(settings.customKey)}" spellcheck="false"></div>
            </div>
          </div>
        </div>
        <div class="mp-note">${iLock({ s: 15 })}<span>Ключі нікуди не надсилаються, крім офіційних API провайдерів, і зберігаються лише у localStorage вашого браузера.</span></div>`;
      body.querySelectorAll<HTMLInputElement>("[data-key]").forEach((inp) => {
        inp.addEventListener("change", () => {
          settings.keys[inp.dataset.key!] = inp.value.trim();
          saveSettings(); toast(`Ключ ${PROVIDERS.find((p) => p.id === inp.dataset.key)?.name} збережено`);
        });
      });
      body.querySelectorAll<HTMLButtonElement>("[data-eye]").forEach((b) => {
        b.addEventListener("click", () => {
          const inp = body.querySelector<HTMLInputElement>(`[data-key="${b.dataset.eye}"]`)!;
          const show = inp.type === "password";
          inp.type = show ? "text" : "password";
          b.innerHTML = show ? iEyeOff({ s: 16 }) : iEye({ s: 16 });
        });
      });
      (["url", "model", "key"] as const).forEach((f) => {
        const inp = body.querySelector<HTMLInputElement>(`[data-cu="${f}"]`)!;
        inp.addEventListener("change", () => {
          if (f === "url") settings.customUrl = inp.value.trim();
          if (f === "model") settings.customModel = inp.value.trim();
          if (f === "key") settings.customKey = inp.value.trim();
          saveSettings(); renderModelChip();
        });
      });
      return;
    }

    if (setTab === "voice") {
      body.innerHTML = `
        <div class="set-sec"><h4>Голосовий ввід</h4>
          <div class="set-row">
            <div class="sr-body"><div class="sr-title">Розпізнавання мовлення</div><div class="sr-sub">${SR ? "Web Speech API — працює у Chrome та Edge" : "⚠ Ваш браузер не підтримує розпізнавання мовлення"}</div></div>
            <span style="font-size:12px;color:var(--mut)">завжди</span>
          </div>
          <div class="set-row">
            <div class="sr-body"><div class="sr-title">Мова розпізнавання</div><div class="sr-sub">Мова, якою ви диктуєте повідомлення</div></div>
            <div class="field" style="width:170px"><select data-v="lang">
              ${["uk-UA|Українська", "en-US|English (US)", "pl-PL|Polski", "de-DE|Deutsch", "fr-FR|Français"].map((o) => { const [v, l] = o.split("|"); return `<option value="${v}" ${settings.voiceLang === v ? "selected" : ""}>${l}</option>`; }).join("")}
            </select></div>
          </div>
        </div>
        <div class="set-sec"><h4>Озвучення відповідей</h4>
          <div class="set-row">
            <div class="sr-body"><div class="sr-title">Читати відповіді вголос</div><div class="sr-sub">Синтез мовлення після кожної відповіді бота</div></div>
            ${switchHtml("set-tts", settings.tts)}
          </div>
          <div class="set-row">
            <div class="sr-body"><div class="sr-title">Голос синтезатора</div><div class="sr-sub">Системні голоси; українські — за наявності в ОС</div></div>
            <div class="field" style="width:210px"><select data-v="ttsvoice"><option value="">Авто</option></select></div>
          </div>
          <div class="set-row">
            <div class="sr-body"><div class="sr-title">Темп мовлення</div></div>
            <input type="range" data-v="rate" min="0.6" max="1.6" step="0.1" value="${settings.ttsRate}">
            <span class="range-val" data-rate-val>${settings.ttsRate.toFixed(1)}×</span>
            <button class="btn" data-v="test" style="padding:7px 12px">Тест</button>
          </div>
        </div>`;
      const voiceSel = body.querySelector<HTMLSelectElement>('[data-v="ttsvoice"]')!;
      const fillVoices = () => {
        const vs = "speechSynthesis" in window ? speechSynthesis.getVoices() : [];
        const sorted = [...vs].sort((a, b) => Number(b.lang.startsWith("uk")) - Number(a.lang.startsWith("uk")));
        voiceSel.innerHTML = `<option value="">Авто</option>` + sorted.map((v) => `<option value="${esc(v.name)}" ${settings.ttsVoice === v.name ? "selected" : ""}>${esc(v.name)} (${esc(v.lang)})</option>`).join("");
      };
      fillVoices();
      if ("speechSynthesis" in window) speechSynthesis.onvoiceschanged = fillVoices;
      voiceSel.addEventListener("change", () => { settings.ttsVoice = voiceSel.value; saveSettings(); });
      body.querySelector<HTMLInputElement>('[data-v="lang"]')!.addEventListener("change", (e) => { settings.voiceLang = (e.target as HTMLSelectElement).value; saveSettings(); });
      body.querySelector<HTMLInputElement>("#set-tts")!.addEventListener("change", (e) => { settings.tts = (e.target as HTMLInputElement).checked; saveSettings(); });
      body.querySelector<HTMLInputElement>('[data-v="rate"]')!.addEventListener("input", (e) => {
        settings.ttsRate = parseFloat((e.target as HTMLInputElement).value);
        (body.querySelector("[data-rate-val]") as HTMLElement).textContent = settings.ttsRate.toFixed(1) + "×";
        saveSettings();
      });
      body.querySelector("[data-v='test']")!.addEventListener("click", () => {
        settings.tts = true; saveSettings();
        speak("Це тест озвучення. Соловей готовий говорити вголос.");
      });
      return;
    }

    if (setTab === "ui") {
      body.innerHTML = `
        <div class="set-sec"><h4>Вигляд</h4>
          <div class="set-row">
            <div class="sr-body"><div class="sr-title">Розмір тексту</div><div class="sr-sub">Масштаб повідомлень у стрічці</div></div>
            <div class="seg">
              ${(["sm", "md", "lg"] as const).map((s) => `<button data-fs="${s}" class="${settings.fontSize === s ? "active" : ""}">${s === "sm" ? "Дрібний" : s === "md" ? "Стандарт" : "Крупний"}</button>`).join("")}
            </div>
          </div>
          <div class="set-row">
            <div class="sr-body"><div class="sr-title">Показувати час повідомлень</div></div>
            ${switchHtml("set-ts", settings.timestamps)}
          </div>
        </div>
        <div class="set-sec"><h4>Поведінка</h4>
          <div class="set-row">
            <div class="sr-body"><div class="sr-title">Enter надсилає повідомлення</div><div class="sr-sub">Інакше — Ctrl+Enter, а Enter робить перенос</div></div>
            ${switchHtml("set-enter", settings.enterSend)}
          </div>
          <div class="set-row">
            <div class="sr-body"><div class="sr-title">Поступовий друк відповідей</div><div class="sr-sub">Стримінг для хмарних моделей, «друкарська машинка» для вбудованої</div></div>
            ${switchHtml("set-stream", settings.stream)}
          </div>
        </div>
        <div class="set-sec"><h4>Звук</h4>
          <div class="set-row">
            <div class="sr-body"><div class="sr-title">Звуки інтерфейсу</div><div class="sr-sub">Короткі сигнали при надсиланні та відповіді</div></div>
            ${switchHtml("set-sound", settings.sound)}
          </div>
          <div class="set-row">
            <div class="sr-body"><div class="sr-title">Гучність</div></div>
            <input type="range" data-v="vol" min="0" max="1" step="0.05" value="${settings.volume}">
            <span class="range-val" data-vol-val>${Math.round(settings.volume * 100)}%</span>
            <button class="btn" data-v="beep" style="padding:7px 12px">Тест</button>
          </div>
        </div>`;
      body.querySelectorAll("[data-fs]").forEach((b) => b.addEventListener("click", () => {
        settings.fontSize = (b as HTMLElement).dataset.fs as Settings["fontSize"];
        saveSettings(); renderSettings();
      }));
      body.querySelector<HTMLInputElement>("#set-ts")!.addEventListener("change", (e) => { settings.timestamps = (e.target as HTMLInputElement).checked; saveSettings(); });
      body.querySelector<HTMLInputElement>("#set-enter")!.addEventListener("change", (e) => { settings.enterSend = (e.target as HTMLInputElement).checked; saveSettings(); });
      body.querySelector<HTMLInputElement>("#set-stream")!.addEventListener("change", (e) => { settings.stream = (e.target as HTMLInputElement).checked; saveSettings(); });
      body.querySelector<HTMLInputElement>("#set-sound")!.addEventListener("change", (e) => { settings.sound = (e.target as HTMLInputElement).checked; saveSettings(); });
      body.querySelector<HTMLInputElement>('[data-v="vol"]')!.addEventListener("input", (e) => {
        settings.volume = parseFloat((e.target as HTMLInputElement).value);
        (body.querySelector("[data-vol-val]") as HTMLElement).textContent = Math.round(settings.volume * 100) + "%";
        saveSettings();
      });
      body.querySelector('[data-v="beep"]')!.addEventListener("click", () => { const prev = settings.sound; settings.sound = true; beep("recv"); settings.sound = prev; });
      return;
    }

    /* data */
    const bytes = new Blob([localStorage.getItem(LS_CHATS) ?? ""]).size;
    const kb = (bytes / 1024).toFixed(1);
    const total = chats.reduce((s, c) => s + c.msgs.length, 0);
    body.innerHTML = `
      <div class="set-sec"><h4>Експорт</h4>
        <div class="set-row">
          <div class="sr-body"><div class="sr-title">Завантажити історію (JSON)</div><div class="sr-sub">${chats.length} ${plural(chats.length, "розмова", "розмови", "розмов")} · ${total} ${plural(total, "повідомлення", "повідомлення", "повідомлень")} · ${kb} КБ у сховищі</div></div>
          <button class="btn primary" data-d="export">${iDownload({ s: 15 })} Експорт</button>
        </div>
      </div>
      <div class="set-sec"><h4>Небезпечна зона</h4>
        <div class="danger-zone">
          <p>Видалення незворотне: повідомлення, зображення та налаштування буде стерто з браузера.</p>
          <div style="display:flex;gap:9px;flex-wrap:wrap">
            <button class="btn ghost-danger" data-d="chats">${iTrash({ s: 15 })} Очистити всі розмови</button>
            <button class="btn ghost-danger" data-d="reset">${iRefresh({ s: 15 })} Скинути налаштування</button>
          </div>
        </div>
      </div>`;
    body.querySelector("[data-d='export']")!.addEventListener("click", () => {
      const blob = new Blob([JSON.stringify({ app: "Соловей", exportedAt: new Date().toISOString(), chats }, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "soloviy-chats.json";
      a.click();
      URL.revokeObjectURL(a.href);
      toast("Історію експортовано");
    });
    body.querySelector("[data-d='chats']")!.addEventListener("click", () => {
      confirmModal({ title: "Очистити всі розмови?", text: "Усю історію листування та прикріплені зображення буде видалено.", ok: "Очистити", danger: true }).then((y) => {
        if (!y) return;
        chats = [newChat()]; activeId = chats[0].id;
        save(); renderSidebar(); renderMessages(true);
        toast("Історію очищено");
      });
    });
    body.querySelector("[data-d='reset']")!.addEventListener("click", () => {
      confirmModal({ title: "Скинути налаштування?", text: "Усі налаштування та збережені API-ключі буде повернуто до типових.", ok: "Скинути", danger: true }).then((y) => {
        if (!y) return;
        settings = JSON.parse(JSON.stringify(DEF_SET));
        saveSettings(); renderSettings();
        toast("Налаштування скинуто");
      });
    });
  }

  /* ── події інтерфейсу ── */
  app.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    const act = t.closest<HTMLElement>("[data-act]");
    if (act) {
      const a = act.dataset.act;
      if (a === "send") { busy ? cancelBusy() : sendMessage(); }
      else if (a === "mic") toggleMic();
      else if (a === "attach") fileInput.click();
      else if (a === "modelpop") openModelPop();
      else if (a === "settings") openSettings("models");
      else if (a === "sound") { settings.sound = !settings.sound; saveSettings(); toast(settings.sound ? "Звук увімкнено" : "Звук вимкнено"); }
      else if (a === "burger") app.classList.toggle("side-open");
      else if (a === "scrolldn") { unread = 0; dnBadge.hidden = true; scrollBottom(true); }
      return;
    }
    const sug = t.closest<HTMLElement>("[data-sug]");
    if (sug) { sendMessage(sug.dataset.sug); return; }
    const copy = t.closest<HTMLElement>("[data-copy]");
    if (copy) {
      const m = active().msgs.find((x) => x.id === copy.dataset.copy);
      if (m) copyText(m.text).then(() => {
        copy.classList.add("done");
        copy.innerHTML = `${iCheck({ s: 13, sw: 2.4 })} Скопійовано`;
        setTimeout(() => { copy.classList.remove("done"); copy.innerHTML = `${iCopy({ s: 13 })} Копіювати`; }, 1400);
      });
      return;
    }
    const regen = t.closest<HTMLElement>("[data-regen]");
    if (regen) { regenerate(regen.dataset.regen!); return; }
    const imgBtn = t.closest<HTMLElement>("[data-img]");
    if (imgBtn) {
      const [mid, i] = imgBtn.dataset.img!.split(":");
      const m = active().msgs.find((x) => x.id === mid);
      const im = m?.images?.[Number(i)];
      if (im) openLightbox(im.dataUrl);
      return;
    }
    if (t.closest(".side-back")) app.classList.remove("side-open");
    if (pop && !t.closest(".pop-wrap")) closePop();
  });

  input.addEventListener("input", autosize);
  input.addEventListener("keydown", (e) => {
    const send = settings.enterSend ? e.key === "Enter" && !e.shiftKey : e.key === "Enter" && (e.ctrlKey || e.metaKey);
    if (send) { e.preventDefault(); if (!busy) sendMessage(); }
  });
  fileInput.addEventListener("change", () => { if (fileInput.files?.length) void addFiles(fileInput.files); fileInput.value = ""; });

  /* вставка зображень із буфера */
  const onPaste = (e: ClipboardEvent) => {
    const fs = e.clipboardData?.files;
    if (fs?.length) { e.preventDefault(); void addFiles(fs); }
  };
  document.addEventListener("paste", onPaste);

  /* drag-and-drop */
  let veil: HTMLElement | null = null;
  const onDragEnter = (e: DragEvent) => {
    if (!e.dataTransfer?.types.includes("Files")) return;
    dragDepth++;
    if (!veil) {
      veil = el("div", "drop-veil", `<div class="dv-card">${iImage({ s: 42, sw: 1.4 })}<p>Відпустіть, щоб прикріпити зображення</p></div>`);
      document.body.appendChild(veil);
    }
  };
  const onDragLeave = () => { dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth && veil) { veil.remove(); veil = null; } };
  const onDrop = (e: DragEvent) => {
    dragDepth = 0;
    if (veil) { veil.remove(); veil = null; }
    if (e.dataTransfer?.files?.length) { e.preventDefault(); void addFiles(e.dataTransfer.files); }
  };
  window.addEventListener("dragenter", onDragEnter);
  window.addEventListener("dragover", (e) => e.preventDefault());
  window.addEventListener("dragleave", onDragLeave);
  window.addEventListener("drop", onDrop);

  /* клавіатура: Esc */
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== "Escape") return;
    if (lightbox) { lightbox.remove(); lightbox = null; return; }
    if (settingsOpen) { closeSettings(); return; }
    if (pop) closePop();
  };
  document.addEventListener("keydown", onKey);

  function copyText(s: string): Promise<void> {
    if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(s).catch(() => fallbackCopy(s));
    fallbackCopy(s);
    return Promise.resolve();
  }
  function fallbackCopy(s: string) {
    const ta = document.createElement("textarea");
    ta.value = s; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); } catch { /* */ }
    ta.remove();
  }

  /* ── старт ── */
  applySettings();
  renderSidebar();
  renderMessages(true);
  input.focus();

  return () => {
    cancelBusy(); stopTTS();
    document.removeEventListener("paste", onPaste);
    document.removeEventListener("keydown", onKey);
    window.removeEventListener("dragenter", onDragEnter);
    window.removeEventListener("dragleave", onDragLeave);
    window.removeEventListener("drop", onDrop);
    root.innerHTML = "";
    setModal?.remove(); setModal = null;
    lightbox?.remove(); lightbox = null;
    veil?.remove(); veil = null;
  };
}
