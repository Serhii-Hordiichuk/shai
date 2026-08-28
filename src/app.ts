/* ============================================================
   app.ts — точка входу Vanilla-застосунку: store, router,
   IndexedDB, сайдбар, артефакти, налаштування, сторінка ТЗ.
   ============================================================ */
import { ico } from "./icons";
import { Store } from "./store";
import { IDB } from "./db";
import { Router } from "./router";
import { EdgeClient, STATIC_MODELS, PROVIDERS, providerName } from "./api";
import type { ModelInfo } from "./api";
import { ChatEngine, DEFAULT_SETTINGS, uid } from "./chat";
import type { AppState, ChatDoc, Settings } from "./chat";
import { localChat } from "./engine";
import { el, toast, confirmDialog, promptDialog, switchEl, rangeEl } from "./ui";
import { CallManager } from "./call";
import type { CallLine } from "./call";
import { renderMarkdown, escapeHtml } from "./render";
import type { Artifact } from "./render";

const F = "```";

/* ================= ТЗ / документація ================= */
const DOC_MD = `# Технічне завдання: AI-чат інтерфейс «Studio»

Візуал — студія в стилі Qwen: три колонки, стриманий фокус на контенті. Дзвінки — за зразком Telegram: повноекранний виклик, хвилі, таймер, barge-in.

## 1. Жорсткі обмеження

- **Frontend:** чистий HTML5 + CSS3 + Vanilla JS (ES Modules). Без React/Vue/Angular у логіці застосунку. Dropdown, модалки, слайдери, тости — кастомні класи.
- **Backend:** лише TypeScript на Edge (Cloudflare Workers). Без Node.js/Express.
- **Дані клієнта:** IndexedDB через власну обгортку (модуль \`db.ts\`).

## 2. Структура файлів

${F}
src/
├─ main.ts        # bootstrap (монтування)
├─ app.ts         # оркестрація: store, router, сайдбар, вʼюхи
├─ store.ts       # State-менеджер на Proxy + Observer
├─ router.ts      # власний hash-роутер (#/c/:id, #/settings, #/docs)
├─ db.ts          # кастомна обгортка IndexedDB
├─ api.ts         # EdgeClient + власний SSE-парсер + веб-пошук
├─ engine.ts      # офлайн-рушій відповідей + ланцюжок думок
├─ chat.ts        # class ChatEngine: стримінг, артефакти, композер
├─ call.ts        # class CallManager: дзвінки, barge-in, аватар
├─ render.ts      # Markdown + highlight.js + блоки коду
├─ ui.ts          # модалки, dropdown, тости, тумблери, слайдери
├─ icons.ts       # всі іконки — кастомні SVG
└─ index.css      # теми light/dark на CSS-змінних

edge/             # Cloudflare Worker (TypeScript)
├─ src/index.ts   # routes + агрегація моделей + KV-кеш
├─ src/router.ts  # class EdgeRouter
├─ src/providers.ts # адаптери вендорів (OpenAI/Anthropic/Google/…)
├─ wrangler.toml  # KV-байндінги, compatibility_date
└─ tsconfig.json
${F}

## 3. Ключові класи

### \`class Store\` — стан на Proxy
${F}ts
const store = new Store<AppState>({ chats: [], settings, … });
store.on(path => render(path));      // Observer
store.state.modelId = "gemini-2.5-flash"; // → emit('modelId')
store.setDeep('settings', s => ({ ...s, theme: 'dark' }));
${F}

### \`class EdgeRouter\` (Edge, TypeScript)
${F}ts
const r = new EdgeRouter();
r.get('/api/health', () => json({ ok: true }));
r.get('/api/models', handleModels);   // агрегація + KV
r.post('/api/chat', handleChat);      // проксі зі стримінгом
export default { fetch: (req, env, ctx) => r.handle(req, env, ctx) };
${F}

### \`class ChatEngine\` — стримінг і артефакти
${F}ts
const gen = client.chat(model, messages, { keys, signal, deep, webContext });
for await (const ev of gen) {
  if (ev.type === 'thinking') showThought(ev.text); // Deep Thinking
  if (ev.type === 'delta')    appendMarkdown(ev.text);
}
msg.arts = extractArtifacts(markdown); // → права панель
${F}

### \`class CallManager\` — дзвінки як у Telegram
${F}
MediaRecorder/Mic → Web Speech (STT) → Edge API → TTS
                 ↘ Web Audio: AnalyserNode → хвилі + barge-in
Відео: <video> (локальне) + Canvas-аватар ШІ (lip-sync за TTS)
${F}

## 4. Схема Edge-функцій

| Ендпоїнт | Метод | Дія |
|---|---|---|
| \`/api/health\` | GET | перевІрка життєздатності воркера |
| \`/api/models\` | GET | агрегує \`/v1/models\` усіх провайдерів (OpenAI, Anthropic, Google, Mistral, Groq, Ollama), кешує у KV на 1 год, віддає єдиний JSON |
| \`/api/chat\` | POST | приймає \`{provider, model, messages, stream, deep}\`, підставляє ключі з ENV, маршрутизує до вендора, нормалізує SSE (\`delta\` / \`thinking\`) |

Ключі живуть **лише в ENV воркера** — клієнт їх не бачить. Без воркера застосунок автоматично переходить у «прямий режим»: ключі з IndexedDB, виклики вендорів з браузера, або офлайн-рушій.

## 5. Збереження даних

- **IndexedDB** (обгортка \`db.ts\`): розмови, налаштування, кеш моделей, обрана модель.
- **Edge KV**: агрегований список моделей (TTL 3600 c).
- **Edge D1 / KV (опційно)**: мульти-тенантне зберігання ключів користувачів.

## 6. Що вже працює в цьому білді

- Три колонки: історія + налаштування / чат / артефакти з live-превʼю HTML у sandbox-iframe
- Кастомний dropdown вибору моделі з пошуком і групуванням за провайдерами
- Тогли «Веб-пошук» (реальний пошук Wikipedia API + джерела під відповіддю) та «Глибоке мислення» (ланцюжок думок: локальні кроки або \`reasoning_content\` DeepSeek R1 / Gemini thinking)
- Власний SSE-парсер, стримінг посимвольно, кнопка «Зупинити»
- Дзвінки: голос і відео, хвилі Web Audio, субтитри, barge-in, стенограма в чат
- Голосове введення в композер, зображення (файл / вставка / drag-and-drop), lightbox
- Теми light/dark на CSS-змінних, кастомний скролбар, повний адаптив
`;

/* ================= монтаж ================= */
export async function createStudio(root: HTMLElement): Promise<() => void> {
  const db = new IDB("ai-studio-db", ["chats", "settings", "models", "misc"]);
  const unsubs: (() => void)[] = [];

  // --- завантаження персисту ---
  const savedChats = (await db.get<ChatDoc[]>("chats", "all")) ?? [];
  const savedSettings = (await db.get<Settings>("settings", "app")) ?? null;
  const savedModel = (await db.get<string>("misc", "modelId")) ?? "studio-local";
  const savedModels = (await db.get<{ ts: number; models: ModelInfo[] }>("models", "list")) ?? null;

  const settings: Settings = { ...DEFAULT_SETTINGS, ...(savedSettings ?? {}) };
  let chats = savedChats;
  if (!chats.length) {
    chats = [makeChat()];
  }

  const cachedModels = (savedModels?.models ?? []).filter((m) => m.provider !== "local");
  const mergedModels = (() => {
    const seen = new Set<string>();
    return [...STATIC_MODELS.filter((m) => m.provider === "local"), ...cachedModels, ...STATIC_MODELS.filter((m) => m.provider !== "local")]
      .filter((m) => (seen.has(m.id) ? false : (seen.add(m.id), true)));
  })();

  const store = new Store<AppState>({
    ready: true,
    chats,
    activeId: chats[0].id,
    settings,
    models: mergedModels,
    modelId: savedModel,
    webSearch: false,
    deepThink: false,
    artOpen: false,
    sidebarOpen: false,
    view: "chat",
  });
  if (!store.state.models.some((m) => m.id === store.state.modelId)) store.state.modelId = "studio-local";

  const client = new EdgeClient(() => store.state.settings.edgeUrl);
  const persist = () => void db.set("chats", "all", store.state.chats);

  // --- shell ---
  root.innerHTML = `
    <div class="app-shell">
      <div class="sidebar-scrim"></div>
      <aside class="sidebar">
        <div class="side-top">
          <a class="brand" href="#/">
            <span class="brand-mark">${ico("logo")}</span>
            <span class="brand-text">Studio<b>AI-чат студія</b></span>
          </a>
          <button class="btn btn-primary btn-new">${ico("plus")} Нова розмова</button>
          <div class="side-search">${ico("search")}<input placeholder="Пошук розмов…" /></div>
        </div>
        <nav class="chat-list" aria-label="Історія розмов"></nav>
        <div class="side-nav">
          <a class="nav-item" href="#/settings" data-nav="settings">${ico("gear")}<span>Налаштування</span></a>
          <a class="nav-item" href="#/docs" data-nav="docs">${ico("doc")}<span>Архітектура і ТЗ</span></a>
        </div>
        <div class="side-bottom">
          <button class="theme-btn" title="Перемкнути тему">${ico(settings.theme === "dark" ? "sun" : "moon")}<span>Тема</span></button>
          <div class="user-chip"><span class="user-dot"></span>Гість<span class="chip-note">${ico("db")} локально</span></div>
        </div>
      </aside>
      <main class="main-col">
        <div class="view view-chat" data-view="chat"></div>
        <div class="view view-settings" data-view="settings" hidden></div>
        <div class="view view-docs" data-view="docs" hidden></div>
      </main>
      <aside class="art-panel">
        <div class="art-head">
          <h3>${ico("layers")} Артефакти <span class="art-count">0</span></h3>
          <button class="icon-btn art-close" title="Закрити панель">${ico("close")}</button>
        </div>
        <div class="art-body"></div>
      </aside>
    </div>`;

  const shell = root.querySelector(".app-shell") as HTMLElement;
  const sidebar = root.querySelector(".sidebar") as HTMLElement;
  const chatListEl = root.querySelector(".chat-list") as HTMLElement;
  const searchInput = root.querySelector(".side-search input") as HTMLInputElement;
  const artPanel = root.querySelector(".art-panel") as HTMLElement;
  const artBody = root.querySelector(".art-body") as HTMLElement;
  const artCount = root.querySelector(".art-count") as HTMLElement;
  const viewEls = {
    chat: root.querySelector('[data-view="chat"]') as HTMLElement,
    settings: root.querySelector('[data-view="settings"]') as HTMLElement,
    docs: root.querySelector('[data-view="docs"]') as HTMLElement,
  };

  function makeChat(): ChatDoc {
    const now = Date.now();
    return { id: uid(), title: "Нова розмова", createdAt: now, updatedAt: now, msgs: [] };
  }

  /* ---------- ChatEngine (один на застосунок) ---------- */
  const router = new Router();
  let callMgr: CallManager | null = null;
  const engine = new ChatEngine(viewEls.chat, {
    store, db, client,
    router,
    persist,
    refreshArtifacts,
    startCall: (kind) => {
      callMgr?.end(false);
      callMgr = new CallManager({
        sttLang: store.state.settings.sttLang,
        ttsVoice: store.state.settings.ttsVoice,
        ttsRate: store.state.settings.ttsRate,
        bargeIn: store.state.settings.bargeIn,
        getReply: async (text) => {
          const model = store.state.models.find((m) => m.id === store.state.modelId) ?? STATIC_MODELS[0];
          if (model.provider === "local") return localChat(text).text;
          const ac = new AbortController();
          let out = "";
          try {
            for await (const ev of client.chat(model, [
              { role: "system", content: "Відповідай українською, стисло (до 2 речень) — це голосовий дзвінок." },
              { role: "user", content: text },
            ], { keys: store.state.settings.keys, signal: ac.signal, deep: false })) {
              if (ev.type === "delta") out += ev.text;
              else if (ev.type === "error") throw new Error(ev.message);
            }
          } catch (e: any) {
            return localChat(text).text;
          }
          return out || localChat(text).text;
        },
        onEnd: (lines: CallLine[], sec, k) => engine.addCallLog(lines, sec, k),
        onError: (m) => toast(m, "err"),
      });
      void callMgr.start(kind);
    },
  });

  /* ---------- сайдбар ---------- */
  function renderChatList(filter = ""): void {
    const term = filter.trim().toLowerCase();
    const items = store.state.chats
      .filter((c) => !term || c.title.toLowerCase().includes(term) || c.msgs.some((m) => m.content.toLowerCase().includes(term)))
      .sort((a, b) => b.updatedAt - a.updatedAt);
    chatListEl.innerHTML = "";
    if (!items.length) {
      chatListEl.innerHTML = `<div class="list-empty">${ico("search")} Нічого не знайдено</div>`;
      return;
    }
    let lastGroup = "";
    for (const c of items) {
      const g = groupLabel(c.updatedAt);
      if (g !== lastGroup) {
        chatListEl.insertAdjacentHTML("beforeend", `<div class="list-group">${g}</div>`);
        lastGroup = g;
      }
      const active = c.id === store.state.activeId && store.state.view === "chat" ? " active" : "";
      chatListEl.insertAdjacentHTML("beforeend", `
        <div class="chat-item${active}" data-id="${c.id}">
          <a class="ci-main" href="#/c/${c.id}">
            <span class="ci-title">${escapeHtml(c.title)}</span>
            <span class="ci-time">${new Date(c.updatedAt).toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" })}</span>
          </a>
          <span class="ci-actions">
            <button data-ciact="rename" title="Перейменувати">${ico("edit")}</button>
            <button data-ciact="del" title="Видалити">${ico("trash")}</button>
          </span>
        </div>`);
    }
  }

  function groupLabel(ts: number): string {
    const d = new Date(ts);
    const today = new Date();
    const yest = new Date(Date.now() - 864e5);
    if (d.toDateString() === today.toDateString()) return "Сьогодні";
    if (d.toDateString() === yest.toDateString()) return "Вчора";
    return d.toLocaleDateString("uk-UA", { day: "numeric", month: "long" });
  }

  chatListEl.addEventListener("click", async (e) => {
    const act = (e.target as HTMLElement).closest("[data-ciact]") as HTMLElement | null;
    const item = (e.target as HTMLElement).closest(".chat-item") as HTMLElement | null;
    if (!item) return;
    const id = item.getAttribute("data-id")!;
    if (act) {
      e.preventDefault();
      e.stopPropagation();
      const chat = store.state.chats.find((c) => c.id === id);
      if (!chat) return;
      if (act.getAttribute("data-ciact") === "rename") {
        const name = await promptDialog({ title: "Перейменувати розмову", label: "Назва", value: chat.title });
        if (name) { chat.title = name; persist(); renderChatList(searchInput.value); }
      } else {
        const ok = await confirmDialog({ title: "Видалити розмову?", text: `«${escapeHtml(chat.title)}» буде видалено безповоротно.`, okText: "Видалити", danger: true });
        if (!ok) return;
        store.state.chats = store.state.chats.filter((c) => c.id !== id);
        if (!store.state.chats.length) store.state.chats = [makeChat()];
        persist();
        if (store.state.activeId === id) router.navigate(`#/c/${store.state.chats[0].id}`);
        else renderChatList(searchInput.value);
        toast("Розмову видалено", "ok");
      }
      return;
    }
    store.state.sidebarOpen = false;
  });

  searchInput.addEventListener("input", () => renderChatList(searchInput.value));
  root.querySelector(".btn-new")!.addEventListener("click", () => {
    const c = makeChat();
    store.state.chats = [c, ...store.state.chats];
    persist();
    router.navigate(`#/c/${c.id}`);
  });
  root.querySelector(".theme-btn")!.addEventListener("click", () => {
    const next = store.state.settings.theme === "dark" ? "light" : "dark";
    store.setDeep("settings", (s) => ({ ...s, theme: next }));
  });
  root.querySelector(".sidebar-scrim")!.addEventListener("click", () => { store.state.sidebarOpen = false; });
  root.querySelector(".art-close")!.addEventListener("click", () => { store.state.artOpen = false; });

  /* ---------- реактивність ---------- */
  unsubs.push(store.watch(["chats", "activeId", "view"], () => renderChatList(searchInput.value)));
  unsubs.push(store.watch(["settings"], () => {
    void db.set("settings", "app", store.state.settings);
    applyTheme();
    const tb = root.querySelector(".theme-btn")!;
    tb.innerHTML = `${ico(store.state.settings.theme === "dark" ? "sun" : "moon")}<span>Тема</span>`;
  }));
  unsubs.push(store.watch(["sidebarOpen"], () => shell.classList.toggle("side-open", store.state.sidebarOpen)));
  unsubs.push(store.watch(["artOpen"], () => shell.classList.toggle("art-open", store.state.artOpen)));

  function applyTheme(): void {
    document.documentElement.dataset.theme = store.state.settings.theme;
    document.documentElement.style.setProperty("--fs", `${store.state.settings.fontSize}px`);
  }
  applyTheme();

  /* ---------- артефакти ---------- */
  let artifacts: Artifact[] = [];
  let artSel = "";
  function refreshArtifacts(): void {
    const chat = store.state.chats.find((c) => c.id === store.state.activeId);
    const map = new Map<string, Artifact>();
    for (const m of chat?.msgs ?? []) for (const a of m.arts ?? []) map.set(a.id, a);
    artifacts = [...map.values()].sort((a, b) => b.ts - a.ts);
    artCount.textContent = String(artifacts.length);
    if (artifacts.length && !store.state.artOpen) store.state.artOpen = true;
    renderArtifacts();
  }

  function renderArtifacts(): void {
    if (!artifacts.length) {
      artBody.innerHTML = `
        <div class="art-list"></div>
        <div class="art-empty">${ico("layers")}<b>Поки порожньо</b><span>Попросіть модель написати код або HTML-сторінку — артефакти з'являться тут із live-превʼю.</span></div>`;
      return;
    }
    if (!artSel || !artifacts.some((a) => a.id === artSel)) artSel = artifacts[0].id;
    const a = artifacts.find((x) => x.id === artSel)!;
    const isHtml = a.lang === "html";
    artBody.innerHTML = `
      <div class="art-list">${artifacts.map((x) => `
        <button class="art-item${x.id === artSel ? " active" : ""}" data-art="${x.id}">${ico(x.lang === "html" ? "globe" : "code")}<span class="ai-main"><b>${escapeHtml(x.title)}</b><small>${x.lang} · ${x.code.split("\n").length} рядк.</small></span></button>`).join("")}
      </div>
      <div class="art-view">
        <div class="art-tabs">
          <button class="art-tab on" data-tab="code">${ico("code")} Код</button>
          ${isHtml ? `<button class="art-tab" data-tab="prev">${ico("external")} Превʼю</button>` : ""}
          <span class="art-spacer"></span>
          <button class="icon-btn" data-artact="copy" title="Копіювати">${ico("copy")}</button>
          <button class="icon-btn" data-artact="dl" title="Завантажити">${ico("download")}</button>
        </div>
        <div class="art-code" data-pane="code"><div class="cb-body"><div class="cb-num">${a.code.split("\n").map((_, i) => i + 1).join("\n")}</div><pre><code>${escapeHtml(a.code)}</code></pre></div></div>
        ${isHtml ? `<iframe class="art-preview" data-pane="prev" hidden sandbox="allow-scripts" title="Превʼю"></iframe>` : ""}
      </div>`;
  }

  artBody.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    const item = t.closest(".art-item") as HTMLElement | null;
    if (item) { artSel = item.getAttribute("data-art")!; renderArtifacts(); return; }
    const tab = t.closest(".art-tab") as HTMLElement | null;
    if (tab) {
      artBody.querySelectorAll(".art-tab").forEach((x) => x.classList.remove("on"));
      tab.classList.add("on");
      const which = tab.getAttribute("data-tab")!;
      const code = artBody.querySelector('[data-pane="code"]') as HTMLElement;
      const prev = artBody.querySelector('[data-pane="prev"]') as HTMLIFrameElement | null;
      code.hidden = which !== "code";
      if (prev) {
        prev.hidden = which !== "prev";
        if (which === "prev") {
          const a = artifacts.find((x) => x.id === artSel)!;
          prev.srcdoc = a.code;
        }
      }
      return;
    }
    const act = t.closest("[data-artact]") as HTMLElement | null;
    if (act) {
      const a = artifacts.find((x) => x.id === artSel)!;
      if (act.getAttribute("data-artact") === "copy") {
        void navigator.clipboard.writeText(a.code).then(() => toast("Код скопійовано", "ok"));
      } else {
        const blob = new Blob([a.code], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `artifact-${a.id}.${a.lang === "typescript" ? "ts" : a.lang}`;
        link.click();
        URL.revokeObjectURL(url);
      }
    }
  });

  /* ---------- роутер і вʼюхи ---------- */
  function showView(name: "chat" | "settings" | "docs"): void {
    store.state.view = name;
    store.state.sidebarOpen = false; // на мобільних drawer зачиняється
    for (const [k, v] of Object.entries(viewEls)) v.hidden = k !== name;
    root.querySelectorAll(".nav-item").forEach((n) => n.classList.toggle("active", n.getAttribute("data-nav") === name));
  }

  router
    .add("#/c/:id", (p) => {
      const chat = store.state.chats.find((c) => c.id === p.id);
      if (!chat) { router.navigate(`#/c/${store.state.chats[0]?.id ?? ""}`); return; }
      store.state.activeId = chat.id;
      showView("chat");
      engine.renderChat();
      refreshArtifacts();
      document.title = `${chat.title} — AI Studio`;
    })
    .add("#/settings", () => { showView("settings"); renderSettings(); document.title = "Налаштування — AI Studio"; })
    .add("#/docs", () => { showView("docs"); document.title = "Архітектура і ТЗ — AI Studio"; })
    .setFallback(() => router.navigate(`#/c/${store.state.chats[0].id}`));

  /* ---------- сторінка ТЗ ---------- */
  viewEls.docs.innerHTML = `<div class="doc-view"><div class="head-row"><button class="icon-btn view-burger" title="Меню">${ico("menu")}</button><span class="head-row-title">Архітектура і ТЗ</span></div><div class="md-content">${renderMarkdown(DOC_MD)}</div></div>`;
  root.addEventListener("click", (e) => {
    if ((e.target as HTMLElement).closest(".view-burger")) store.state.sidebarOpen = true;
  });

  /* ---------- делегування копіювання коду (доки/налаштування) ---------- */
  root.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest(".cb-copy") as HTMLElement | null;
    if (!btn) return;
    const code = btn.closest(".codeblock")?.querySelector("pre code")?.textContent ?? "";
    void navigator.clipboard.writeText(code).then(() => {
      btn.classList.add("ok");
      btn.textContent = "скопійовано";
      setTimeout(() => { btn.classList.remove("ok"); btn.textContent = "копіювати"; }, 1400);
    });
  });

  /* ---------- налаштування ---------- */
  function renderSettings(): void {
    const host = viewEls.settings;
    const s = () => store.state.settings;
    const set = (patch: Partial<Settings>) => store.setDeep("settings", (x) => ({ ...x, ...patch }));
    host.innerHTML = `
      <div class="set-view">
        <header class="set-head"><div class="head-row"><button class="icon-btn view-burger" title="Меню">${ico("menu")}</button><h2>${ico("gear")} Налаштування</h2></div><p>Edge-проксі, API-ключі, голос, інтерфейс і дані</p></header>
        <div class="set-tabs">
          <button class="set-tab on" data-tab="api">${ico("key")} Моделі та API</button>
          <button class="set-tab" data-tab="voice">${ico("mic")} Голос і дзвінки</button>
          <button class="set-tab" data-tab="ui">${ico("sun")} Інтерфейс</button>
          <button class="set-tab" data-tab="data">${ico("db")} Дані</button>
        </div>
        <div class="set-panel" data-panel="api"></div>
        <div class="set-panel" data-panel="voice" hidden></div>
        <div class="set-panel" data-panel="ui" hidden></div>
        <div class="set-panel" data-panel="data" hidden></div>
      </div>`;
    const panels = host.querySelectorAll(".set-panel");
    host.querySelectorAll(".set-tab").forEach((t) =>
      t.addEventListener("click", () => {
        host.querySelectorAll(".set-tab").forEach((x) => x.classList.remove("on"));
        t.classList.add("on");
        panels.forEach((p) => (p as HTMLElement).hidden = p.getAttribute("data-panel") !== t.getAttribute("data-tab"));
      })
    );

    /* --- API --- */
    const api = host.querySelector('[data-panel="api"]')!;
    api.innerHTML = `
      <section class="set-card">
        <h3>Edge-проксі (Cloudflare Workers)</h3>
        <p class="set-hint">Вкажіть URL задеплоєного воркера з <code>edge/</code> — ключі лишаться на сервері. Порожнє поле = прямий режим із ключами нижче.</p>
        <div class="edge-row">
          <input class="text-input" id="edge-url" placeholder="https://ai-studio-edge.example.workers.dev" value="${escapeHtml(s().edgeUrl)}" />
          <button class="btn btn-ghost" id="edge-test">${ico("bolt")} Перевірити</button>
        </div>
        <div class="edge-status" id="edge-status"></div>
      </section>
      <section class="set-card">
        <h3>API-ключі провайдерів</h3>
        <p class="set-hint">Зберігаються лише у вашому браузері (IndexedDB). Без ключів працює офлайн-рушій.</p>
        <div class="keys-grid">${PROVIDERS.map((p) => `
          <div class="key-row">
            <label>${escapeHtml(p.name)}<a href="${p.keyUrl}" target="_blank" rel="noopener">отримати ключ ${ico("external")}</a></label>
            <div class="key-input">
              <input type="password" data-key="${p.id}" placeholder="${p.keyEnv}" value="${escapeHtml(s().keys[p.keyEnv] ?? "")}" />
              <button class="icon-btn eye-btn" title="Показати/сховати">${ico("key")}</button>
            </div>
          </div>`).join("")}
        </div>
      </section>
      <section class="set-card">
        <h3>Каталог моделей</h3>
        <p class="set-hint">Агрегація <code>/v1/models</code> усіх провайдерів (через Edge або напряму). Кешується в IndexedDB.</p>
        <div class="edge-row">
          <button class="btn btn-primary" id="refresh-models">${ico("refresh")} Оновити список моделей</button>
          <span class="models-count">У каталозі: <b>${store.state.models.length}</b></span>
        </div>
      </section>`;
    api.querySelector("#edge-url")!.addEventListener("change", (e) => set({ edgeUrl: (e.target as HTMLInputElement).value.trim() }));
    api.querySelector("#edge-test")!.addEventListener("click", async () => {
      const st = api.querySelector("#edge-status")!;
      st.textContent = "Перевіряю…";
      st.className = "edge-status";
      const ok = await client.health();
      st.textContent = ok ? "Воркер відповідає — ключі на сервері, прямі ключі не потрібні." : "Немає з'єднання. Перевірте URL і CORS воркера.";
      st.classList.add(ok ? "ok" : "bad");
    });
    api.querySelectorAll("input[data-key]").forEach((inp) => {
      inp.addEventListener("change", () => {
        const p = PROVIDERS.find((x) => x.id === inp.getAttribute("data-key"))!;
        const keys = { ...s().keys, [p.keyEnv]: (inp as HTMLInputElement).value.trim() };
        set({ keys });
        toast(`Ключ ${p.name} збережено локально`, "ok");
      });
    });
    api.querySelectorAll(".eye-btn").forEach((b) =>
      b.addEventListener("click", () => {
        const inp = b.parentElement!.querySelector("input") as HTMLInputElement;
        inp.type = inp.type === "password" ? "text" : "password";
      })
    );
    api.querySelector("#refresh-models")!.addEventListener("click", async (e) => {
      const btn = e.currentTarget as HTMLButtonElement;
      btn.disabled = true;
      try {
        const models = await client.fetchModels(s().keys);
        store.state.models = models;
        void db.set("models", "list", { ts: Date.now(), models });
        api.querySelector(".models-count b")!.textContent = String(models.length);
        toast(`Моделей знайдено: ${models.length}`, "ok");
      } catch {
        toast("Не вдалося оновити каталог", "err");
      } finally {
        btn.disabled = false;
      }
    });

    /* --- Голос --- */
    const voice = host.querySelector('[data-panel="voice"]')!;
    voice.innerHTML = `
      <section class="set-card">
        <h3>Розпізнавання мовлення (STT)</h3>
        <div class="field"><span class="field-label">Мова диктовки та дзвінків</span>
          <select class="text-input" id="stt-lang">
            ${["uk-UA", "en-US", "pl-PL", "de-DE"].map((l) => `<option value="${l}"${s().sttLang === l ? " selected" : ""}>${l}</option>`).join("")}
          </select>
        </div>
      </section>
      <section class="set-card">
        <h3>Синтез мовлення (TTS)</h3>
        <div class="field"><span class="field-label">Голос</span><select class="text-input" id="tts-voice"><option value="">Системний</option></select></div>
        <div class="field"><span class="field-label">Темп мовлення</span><div id="tts-rate"></div></div>
        <div class="field"><span class="field-label">Перевірка</span><button class="btn btn-ghost" id="tts-test">${ico("volume")} Озвучити тест</button></div>
      </section>
      <section class="set-card">
        <h3>Дзвінки</h3>
        <div class="field"><span class="field-label">Barge-in — переривати ШІ своїм голосом</span><span id="barge"></span></div>
        <p class="set-hint">Під час мовлення асистента аналізується амплітуда мікрофона; гучна репліка зупиняє синтез.</p>
      </section>`;
    const voiceSel = voice.querySelector("#tts-voice") as HTMLSelectElement;
    const fillVoices = () => {
      const cur = s().ttsVoice;
      voiceSel.innerHTML = `<option value="">Системний</option>` +
        window.speechSynthesis.getVoices().map((v) => `<option value="${escapeHtml(v.name)}"${v.name === cur ? " selected" : ""}>${escapeHtml(v.name)} (${v.lang})</option>`).join("");
    };
    fillVoices();
    window.speechSynthesis.onvoiceschanged = fillVoices;
    voice.querySelector("#stt-lang")!.addEventListener("change", (e) => set({ sttLang: (e.target as HTMLSelectElement).value }));
    voiceSel.addEventListener("change", () => set({ ttsVoice: voiceSel.value }));
    voice.querySelector("#tts-rate")!.appendChild(rangeEl({ min: 0.6, max: 1.6, step: 0.05, value: s().ttsRate, fmt: (v) => `${v.toFixed(2)}×`, onChange: (v) => set({ ttsRate: v }) }));
    voice.querySelector("#barge")!.appendChild(switchEl(s().bargeIn, (v) => set({ bargeIn: v })));
    voice.querySelector("#tts-test")!.addEventListener("click", () => {
      const u = new SpeechSynthesisUtterance("Привіт! Це тест синтезу мовлення. Я готовий до дзвінка.");
      u.lang = "uk-UA";
      u.rate = s().ttsRate;
      const v = window.speechSynthesis.getVoices().find((x) => x.name === s().ttsVoice) ?? window.speechSynthesis.getVoices().find((x) => x.lang.startsWith("uk"));
      if (v) u.voice = v;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    });

    /* --- Інтерфейс --- */
    const uiP = host.querySelector('[data-panel="ui"]')!;
    uiP.innerHTML = `
      <section class="set-card">
        <h3>Тема</h3>
        <div class="theme-cards">
          <button class="theme-card${s().theme === "light" ? " on" : ""}" data-th="light"><span class="tc-prev tc-light"></span>Світла</button>
          <button class="theme-card${s().theme === "dark" ? " on" : ""}" data-th="dark"><span class="tc-prev tc-dark"></span>Темна</button>
        </div>
      </section>
      <section class="set-card">
        <h3>Читання</h3>
        <div class="field"><span class="field-label">Розмір тексту повідомлень</span><div id="fs"></div></div>
        <div class="field"><span class="field-label">Показувати час повідомлень</span><span id="sw-time"></span></div>
      </section>
      <section class="set-card">
        <h3>Композер і стримінг</h3>
        <div class="field"><span class="field-label">Enter надсилає повідомлення</span><span id="sw-enter"></span></div>
        <div class="field"><span class="field-label">Поступовий друк (офлайн-рушій)</span><span id="sw-stream"></span></div>
        <div class="field"><span class="field-label">Звуки сповіщень</span><span id="sw-sound"></span></div>
        <div class="field"><span class="field-label">Гучність</span><div id="vol"></div></div>
      </section>`;
    uiP.querySelectorAll(".theme-card").forEach((c) =>
      c.addEventListener("click", () => {
        set({ theme: c.getAttribute("data-th") as "light" | "dark" });
        uiP.querySelectorAll(".theme-card").forEach((x) => x.classList.toggle("on", x === c));
      })
    );
    uiP.querySelector("#fs")!.appendChild(rangeEl({ min: 13, max: 19, step: 1, value: s().fontSize, fmt: (v) => `${v}px`, onChange: (v) => set({ fontSize: v }) }));
    uiP.querySelector("#sw-time")!.appendChild(switchEl(s().showTime, (v) => set({ showTime: v })));
    uiP.querySelector("#sw-enter")!.appendChild(switchEl(s().enterSend, (v) => set({ enterSend: v })));
    uiP.querySelector("#sw-stream")!.appendChild(switchEl(s().stream, (v) => set({ stream: v })));
    uiP.querySelector("#sw-sound")!.appendChild(switchEl(s().sound, (v) => set({ sound: v })));
    uiP.querySelector("#vol")!.appendChild(rangeEl({ min: 0, max: 1, step: 0.05, value: s().volume, fmt: (v) => `${Math.round(v * 100)}%`, onChange: (v) => set({ volume: v }) }));

    /* --- Дані --- */
    const dataP = host.querySelector('[data-panel="data"]')!;
    const msgsTotal = store.state.chats.reduce((n, c) => n + c.msgs.length, 0);
    const kb = Math.max(1, Math.round(JSON.stringify(store.state.chats).length / 1024));
    dataP.innerHTML = `
      <section class="set-card">
        <h3>Локальне сховище (IndexedDB)</h3>
        <div class="stat-grid">
          <div class="stat"><b>${store.state.chats.length}</b><span>розмов</span></div>
          <div class="stat"><b>${msgsTotal}</b><span>повідомлень</span></div>
          <div class="stat"><b>${kb} КБ</b><span>даних</span></div>
          <div class="stat"><b>${store.state.models.length}</b><span>моделей у каталозі</span></div>
        </div>
      </section>
      <section class="set-card">
        <h3>Експорт і очищення</h3>
        <div class="edge-row">
          <button class="btn btn-ghost" id="export-json">${ico("download")} Експорт у JSON</button>
          <button class="btn btn-ghost danger-text" id="clear-chats">${ico("trash")} Очистити всі розмови</button>
          <button class="btn btn-danger" id="wipe">${ico("alert")} Повне скидання</button>
        </div>
      </section>`;
    dataP.querySelector("#export-json")!.addEventListener("click", () => {
      const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), settings: s(), chats: store.state.chats }, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "ai-studio-export.json";
      a.click();
      URL.revokeObjectURL(url);
      toast("Експортовано", "ok");
    });
    dataP.querySelector("#clear-chats")!.addEventListener("click", async () => {
      const ok = await confirmDialog({ title: "Очистити розмови?", text: "Усю історію чатів буде видалено з IndexedDB. Налаштування залишаться.", okText: "Очистити", danger: true });
      if (!ok) return;
      store.state.chats = [makeChat()];
      persist();
      router.navigate(`#/c/${store.state.chats[0].id}`);
      renderSettings();
      toast("Історію очищено", "ok");
    });
    dataP.querySelector("#wipe")!.addEventListener("click", async () => {
      const ok = await confirmDialog({ title: "Повне скидання?", text: "Буде видалено все: розмови, налаштування, ключі та кеш моделей. Дію неможливо скасувати.", okText: "Скинути все", danger: true });
      if (!ok) return;
      await db.clear("chats");
      await db.clear("settings");
      await db.clear("models");
      await db.clear("misc");
      location.hash = "";
      location.reload();
    });
  }

  /* ---------- старт ---------- */
  renderChatList();
  router.start();

  // фонове оновлення каталогу моделей, якщо є ключі або edge
  if (settings.edgeUrl || Object.values(settings.keys).some(Boolean)) {
    client.fetchModels(store.state.settings.keys)
      .then((models) => {
        if (models.length > 1) {
          store.state.models = models;
          void db.set("models", "list", { ts: Date.now(), models });
        }
      })
      .catch(() => {});
  }

  return () => {
    callMgr?.end(false);
    router.destroy();
    unsubs.forEach((u) => u());
    root.innerHTML = "";
  };
}
