import { ico } from "./icons";
import { Store } from "./store";
import { IDB } from "./db";
import { Router } from "./router";
import { EdgeClient, STATIC_MODELS, PROVIDERS } from "./api";
import type { ModelInfo } from "./api";
import { ChatEngine, DEFAULT_SETTINGS, uid } from "./chat";
import type { AppState, ChatDoc, Settings } from "./chat";
import { localChat } from "./engine";
import { toast, confirmDialog, promptDialog, switchEl, rangeEl } from "./ui";
import { CallManager } from "./call";
import type { CallLine } from "./call";
import { renderMarkdown, escapeHtml } from "./render";
import type { Artifact } from "./render";

const F = "```";

const DOC_MD = `# Technical Specification: "Studio" AI Chat Interface

Visual language — a Qwen-style studio: three columns, calm focus on content. Calls follow the Telegram pattern: full-screen call, waves, timer, barge-in.

## 1. Hard constraints

- **Frontend:** pure HTML5 + CSS3 + Vanilla JS (ES Modules). No React/Vue/Angular in app logic. Dropdowns, modals, sliders, toasts are custom classes.
- **Backend:** TypeScript on Edge (Cloudflare Workers) only. No Node.js/Express.
- **Client data:** IndexedDB through a custom wrapper (module \`db.ts\`).

## 2. File layout

${F}
src/
├─ main.ts        # bootstrap (mount)
├─ app.ts         # orchestration: store, router, sidebar, views
├─ store.ts       # Proxy + Observer state manager
├─ router.ts      # custom hash router (#/c/:id, #/settings, #/docs)
├─ db.ts          # custom IndexedDB wrapper
├─ api.ts         # EdgeClient + hand-rolled SSE parser + web search
├─ engine.ts      # offline reply engine + chain of thought
├─ chat.ts        # class ChatEngine: streaming, artifacts, composer
├─ call.ts        # class CallManager: calls, barge-in, avatar
├─ render.ts      # Markdown + highlight.js + code blocks
├─ ui.ts          # modals, dropdowns, toasts, switches, sliders
├─ icons.ts       # every icon is a custom SVG
└─ index.css      # light/dark themes on CSS variables

edge/             # Cloudflare Worker (TypeScript)
├─ src/index.ts   # routes + model aggregation + KV cache
├─ src/router.ts  # class EdgeRouter
├─ src/providers.ts # vendor adapters (OpenAI/Anthropic/Google/…)
├─ wrangler.toml  # KV binding, compatibility_date
└─ tsconfig.json
${F}

## 3. Key classes

### \`class Store\` — Proxy-based state
${F}ts
const store = new Store<AppState>({ chats: [], settings, … });
store.on(path => render(path));            // Observer
store.state.modelId = "gemini-2.5-flash";  // → emit('modelId')
store.setDeep('settings', s => ({ ...s, theme: 'dark' }));
${F}

### \`class EdgeRouter\` (Edge, TypeScript)
${F}ts
const r = new EdgeRouter();
r.get('/api/health', () => json({ ok: true }));
r.get('/api/models', handleModels);   // aggregation + KV
r.post('/api/chat', handleChat);      // streaming proxy
export default { fetch: (req, env, ctx) => r.handle(req, env, ctx) };
${F}

### \`class ChatEngine\` — streaming and artifacts
${F}ts
const gen = client.chat(model, messages, { keys, signal, deep, webContext });
for await (const ev of gen) {
  if (ev.type === 'thinking') showThought(ev.text); // Deep Thinking
  if (ev.type === 'delta')    appendMarkdown(ev.text);
}
msg.arts = extractArtifacts(markdown); // → right panel
${F}

### \`class CallManager\` — Telegram-style calls
${F}
Mic → Web Speech (STT) → Edge API → TTS
      ↘ Web Audio: AnalyserNode → waves + barge-in
Video: <video> (local) + Canvas AI avatar (TTS lip-sync)
${F}

## 4. Edge function map

| Endpoint | Method | Behavior |
|---|---|---|
| \`/api/health\` | GET | worker liveness probe |
| \`/api/models\` | GET | aggregates \`/v1/models\` of every provider (OpenAI, Anthropic, Google, Mistral, Groq, Ollama), caches in KV for 1 hour, returns a single JSON |
| \`/api/chat\` | POST | accepts \`{provider, model, messages, stream, deep}\`, injects keys from ENV, routes to the vendor, normalizes SSE (\`delta\` / \`thinking\`) |

Keys live **only in the worker's ENV** — the client never sees them. Without a worker the app automatically falls back to "direct mode": keys from IndexedDB, vendor calls from the browser, or the offline engine.

## 5. Data storage

- **IndexedDB** (wrapper \`db.ts\`): conversations, settings, model cache, selected model.
- **Edge KV**: aggregated model list (TTL 3600 s).
- **Edge D1 / KV (optional)**: multi-tenant storage of user keys.

## 6. What works in this build

- Three columns: history + settings / chat / artifacts with live HTML preview in a sandboxed iframe
- Custom model dropdown with search and provider grouping
- "Web search" (real Wikipedia API lookups + sources under the reply) and "Deep thinking" (chain of thought: local steps or DeepSeek R1 \`reasoning_content\` / Gemini thinking) toggles
- Hand-rolled SSE parser, character-level streaming, Stop button
- Calls: voice and video, Web Audio waves, captions, barge-in, transcript in chat
- Composer voice input, images (file / paste / drag-and-drop), lightbox
- Light/dark themes on CSS variables, custom scrollbars, fully responsive
`;

export async function createStudio(root: HTMLElement): Promise<() => void> {
  const db = new IDB("ai-studio-db", ["chats", "settings", "models", "misc"]);
  const unsubs: (() => void)[] = [];

  const savedChats = (await db.get<ChatDoc[]>("chats", "all")) ?? [];
  const savedSettings = (await db.get<Settings>("settings", "app")) ?? null;
  const savedModel = (await db.get<string>("misc", "modelId")) ?? "studio-local";
  const savedModels = (await db.get<{ ts: number; models: ModelInfo[] }>("models", "list")) ?? null;

  const settings: Settings = { ...DEFAULT_SETTINGS, ...(savedSettings ?? {}) };
  let chats = savedChats;
  if (!chats.length) chats = [makeChat()];

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

  root.innerHTML = `
    <div class="app-shell">
      <div class="sidebar-scrim"></div>
      <aside class="sidebar">
        <div class="side-top">
          <a class="brand" href="#/">
            <span class="brand-mark">${ico("logo")}</span>
            <span class="brand-text">Studio<b>AI chat studio</b></span>
          </a>
          <button class="btn btn-primary btn-new">${ico("plus")} New chat</button>
          <div class="side-search">${ico("search")}<input placeholder="Search chats…" /></div>
        </div>
        <nav class="chat-list" aria-label="Chat history"></nav>
        <div class="side-nav">
          <a class="nav-item" href="#/settings" data-nav="settings">${ico("gear")}<span>Settings</span></a>
          <a class="nav-item" href="#/docs" data-nav="docs">${ico("doc")}<span>Architecture & Spec</span></a>
        </div>
        <div class="side-bottom">
          <button class="theme-btn" title="Toggle theme">${ico(settings.theme === "dark" ? "sun" : "moon")}<span>Theme</span></button>
          <div class="user-chip"><span class="user-dot"></span>Guest<span class="chip-note">${ico("db")} local</span></div>
        </div>
      </aside>
      <main class="main-col">
        <div class="view view-chat" data-view="chat"></div>
        <div class="view view-settings" data-view="settings" hidden></div>
        <div class="view view-docs" data-view="docs" hidden></div>
      </main>
      <aside class="art-panel">
        <div class="art-head">
          <h3>${ico("layers")} Artifacts <span class="art-count">0</span></h3>
          <button class="icon-btn art-close" title="Close panel">${ico("close")}</button>
        </div>
        <div class="art-body"></div>
      </aside>
    </div>`;

  const shell = root.querySelector(".app-shell") as HTMLElement;
  const chatListEl = root.querySelector(".chat-list") as HTMLElement;
  const searchInput = root.querySelector(".side-search input") as HTMLInputElement;
  const artBody = root.querySelector(".art-body") as HTMLElement;
  const artCount = root.querySelector(".art-count") as HTMLElement;
  const viewEls = {
    chat: root.querySelector('[data-view="chat"]') as HTMLElement,
    settings: root.querySelector('[data-view="settings"]') as HTMLElement,
    docs: root.querySelector('[data-view="docs"]') as HTMLElement,
  };

  function makeChat(): ChatDoc {
    const now = Date.now();
    return { id: uid(), title: "New chat", createdAt: now, updatedAt: now, msgs: [] };
  }

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
              { role: "system", content: "Answer in English, briefly (up to 2 sentences) — this is a voice call." },
              { role: "user", content: text },
            ], { keys: store.state.settings.keys, signal: ac.signal, deep: false })) {
              if (ev.type === "delta") out += ev.text;
              else if (ev.type === "error") throw new Error(ev.message);
            }
          } catch {
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

  function renderChatList(filter = ""): void {
    const term = filter.trim().toLowerCase();
    const items = store.state.chats
      .filter((c) => !term || c.title.toLowerCase().includes(term) || c.msgs.some((m) => m.content.toLowerCase().includes(term)))
      .sort((a, b) => b.updatedAt - a.updatedAt);
    chatListEl.innerHTML = "";
    if (!items.length) {
      chatListEl.innerHTML = `<div class="list-empty">${ico("search")} Nothing found</div>`;
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
            <span class="ci-time">${new Date(c.updatedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</span>
          </a>
          <span class="ci-actions">
            <button data-ciact="rename" title="Rename">${ico("edit")}</button>
            <button data-ciact="del" title="Delete">${ico("trash")}</button>
          </span>
        </div>`);
    }
  }

  function groupLabel(ts: number): string {
    const d = new Date(ts);
    const today = new Date();
    const yest = new Date(Date.now() - 864e5);
    if (d.toDateString() === today.toDateString()) return "Today";
    if (d.toDateString() === yest.toDateString()) return "Yesterday";
    return d.toLocaleDateString("en-US", { day: "numeric", month: "long" });
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
        const name = await promptDialog({ title: "Rename chat", label: "Title", value: chat.title });
        if (name) { chat.title = name; persist(); renderChatList(searchInput.value); }
      } else {
        const ok = await confirmDialog({ title: "Delete chat?", text: `"${escapeHtml(chat.title)}" will be deleted permanently.`, okText: "Delete", danger: true });
        if (!ok) return;
        store.state.chats = store.state.chats.filter((c) => c.id !== id);
        if (!store.state.chats.length) store.state.chats = [makeChat()];
        persist();
        if (store.state.activeId === id) router.navigate(`#/c/${store.state.chats[0].id}`);
        else renderChatList(searchInput.value);
        toast("Chat deleted", "ok");
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

  unsubs.push(store.watch(["chats", "activeId", "view"], () => renderChatList(searchInput.value)));
  unsubs.push(store.watch(["settings"], () => {
    void db.set("settings", "app", store.state.settings);
    applyTheme();
    const tb = root.querySelector(".theme-btn")!;
    tb.innerHTML = `${ico(store.state.settings.theme === "dark" ? "sun" : "moon")}<span>Theme</span>`;
  }));
  unsubs.push(store.watch(["sidebarOpen"], () => shell.classList.toggle("side-open", store.state.sidebarOpen)));
  unsubs.push(store.watch(["artOpen"], () => shell.classList.toggle("art-open", store.state.artOpen)));

  function applyTheme(): void {
    document.documentElement.dataset.theme = store.state.settings.theme;
    document.documentElement.style.setProperty("--fs", `${store.state.settings.fontSize}px`);
  }
  applyTheme();

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
        <div class="art-empty">${ico("layers")}<b>Nothing here yet</b><span>Ask the model to write code or an HTML page — artifacts will appear here with a live preview.</span></div>`;
      return;
    }
    if (!artSel || !artifacts.some((a) => a.id === artSel)) artSel = artifacts[0].id;
    const a = artifacts.find((x) => x.id === artSel)!;
    const isHtml = a.lang === "html";
    artBody.innerHTML = `
      <div class="art-list">${artifacts.map((x) => `
        <button class="art-item${x.id === artSel ? " active" : ""}" data-art="${x.id}">${ico(x.lang === "html" ? "globe" : "code")}<span class="ai-main"><b>${escapeHtml(x.title)}</b><small>${x.lang} · ${x.code.split("\n").length} lines</small></span></button>`).join("")}
      </div>
      <div class="art-view">
        <div class="art-tabs">
          <button class="art-tab on" data-tab="code">${ico("code")} Code</button>
          ${isHtml ? `<button class="art-tab" data-tab="prev">${ico("external")} Preview</button>` : ""}
          <span class="art-spacer"></span>
          <button class="icon-btn" data-artact="copy" title="Copy">${ico("copy")}</button>
          <button class="icon-btn" data-artact="dl" title="Download">${ico("download")}</button>
        </div>
        <div class="art-code" data-pane="code"><div class="cb-body"><div class="cb-num">${a.code.split("\n").map((_, i) => i + 1).join("\n")}</div><pre><code>${escapeHtml(a.code)}</code></pre></div></div>
        ${isHtml ? `<iframe class="art-preview" data-pane="prev" hidden sandbox="allow-scripts" title="Preview"></iframe>` : ""}
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
        void navigator.clipboard.writeText(a.code).then(() => toast("Code copied", "ok"));
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

  function showView(name: "chat" | "settings" | "docs"): void {
    store.state.view = name;
    store.state.sidebarOpen = false;
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
    .add("#/settings", () => { showView("settings"); renderSettings(); document.title = "Settings — AI Studio"; })
    .add("#/docs", () => { showView("docs"); document.title = "Architecture & Spec — AI Studio"; })
    .setFallback(() => router.navigate(`#/c/${store.state.chats[0].id}`));

  viewEls.docs.innerHTML = `<div class="doc-view"><div class="head-row"><button class="icon-btn view-burger" title="Menu">${ico("menu")}</button><span class="head-row-title">Architecture & Spec</span></div><div class="md-content">${renderMarkdown(DOC_MD)}</div></div>`;
  root.addEventListener("click", (e) => {
    if ((e.target as HTMLElement).closest(".view-burger")) store.state.sidebarOpen = true;
  });

  root.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest(".cb-copy") as HTMLElement | null;
    if (!btn) return;
    const code = btn.closest(".codeblock")?.querySelector("pre code")?.textContent ?? "";
    void navigator.clipboard.writeText(code).then(() => {
      btn.classList.add("ok");
      btn.textContent = "copied";
      setTimeout(() => { btn.classList.remove("ok"); btn.textContent = "copy"; }, 1400);
    });
  });

  function renderSettings(): void {
    const host = viewEls.settings;
    const s = () => store.state.settings;
    const set = (patch: Partial<Settings>) => store.setDeep("settings", (x) => ({ ...x, ...patch }));
    host.innerHTML = `
      <div class="set-view">
        <header class="set-head"><div class="head-row"><button class="icon-btn view-burger" title="Menu">${ico("menu")}</button><h2>${ico("gear")} Settings</h2></div><p>Edge proxy, API keys, voice, interface and data</p></header>
        <div class="set-tabs">
          <button class="set-tab on" data-tab="api">${ico("key")} Models & API</button>
          <button class="set-tab" data-tab="voice">${ico("mic")} Voice & Calls</button>
          <button class="set-tab" data-tab="ui">${ico("sun")} Interface</button>
          <button class="set-tab" data-tab="data">${ico("db")} Data</button>
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

    const api = host.querySelector('[data-panel="api"]')!;
    api.innerHTML = `
      <section class="set-card">
        <h3>Edge proxy (Cloudflare Workers)</h3>
        <p class="set-hint">Enter the URL of the worker deployed from <code>edge/</code> — keys stay on the server. Empty field = direct mode with the keys below.</p>
        <div class="edge-row">
          <input class="text-input" id="edge-url" placeholder="https://ai-studio-edge.example.workers.dev" value="${escapeHtml(s().edgeUrl)}" />
          <button class="btn btn-ghost" id="edge-test">${ico("bolt")} Check</button>
        </div>
        <div class="edge-status" id="edge-status"></div>
      </section>
      <section class="set-card">
        <h3>Provider API keys</h3>
        <p class="set-hint">Stored only in your browser (IndexedDB). Without keys the offline engine works.</p>
        <div class="keys-grid">${PROVIDERS.map((p) => `
          <div class="key-row">
            <label>${escapeHtml(p.name)}<a href="${p.keyUrl}" target="_blank" rel="noopener">get key ${ico("external")}</a></label>
            <div class="key-input">
              <input type="password" data-key="${p.id}" placeholder="${p.keyEnv}" value="${escapeHtml(s().keys[p.keyEnv] ?? "")}" />
              <button class="icon-btn eye-btn" title="Show/hide">${ico("key")}</button>
            </div>
          </div>`).join("")}
        </div>
      </section>
      <section class="set-card">
        <h3>Model catalog</h3>
        <p class="set-hint">Aggregation of <code>/v1/models</code> across all providers (via Edge or directly). Cached in IndexedDB.</p>
        <div class="edge-row">
          <button class="btn btn-primary" id="refresh-models">${ico("refresh")} Refresh model list</button>
          <span class="models-count">In catalog: <b>${store.state.models.length}</b></span>
        </div>
      </section>`;
    api.querySelector("#edge-url")!.addEventListener("change", (e) => set({ edgeUrl: (e.target as HTMLInputElement).value.trim() }));
    api.querySelector("#edge-test")!.addEventListener("click", async () => {
      const st = api.querySelector("#edge-status")!;
      st.textContent = "Checking…";
      st.className = "edge-status";
      const ok = await client.health();
      st.textContent = ok ? "Worker is up — keys live on the server, direct keys not needed." : "No connection. Check the URL and worker CORS.";
      st.classList.add(ok ? "ok" : "bad");
    });
    api.querySelectorAll("input[data-key]").forEach((inp) => {
      inp.addEventListener("change", () => {
        const p = PROVIDERS.find((x) => x.id === inp.getAttribute("data-key"))!;
        const keys = { ...s().keys, [p.keyEnv]: (inp as HTMLInputElement).value.trim() };
        set({ keys });
        toast(`${p.name} key saved locally`, "ok");
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
        toast(`Models found: ${models.length}`, "ok");
      } catch {
        toast("Failed to refresh the catalog", "err");
      } finally {
        btn.disabled = false;
      }
    });

    const voice = host.querySelector('[data-panel="voice"]')!;
    voice.innerHTML = `
      <section class="set-card">
        <h3>Speech recognition (STT)</h3>
        <div class="field"><span class="field-label">Dictation & call language</span>
          <select class="text-input" id="stt-lang">
            ${["en-US", "uk-UA", "pl-PL", "de-DE"].map((l) => `<option value="${l}"${s().sttLang === l ? " selected" : ""}>${l}</option>`).join("")}
          </select>
        </div>
      </section>
      <section class="set-card">
        <h3>Speech synthesis (TTS)</h3>
        <div class="field"><span class="field-label">Voice</span><select class="text-input" id="tts-voice"><option value="">System default</option></select></div>
        <div class="field"><span class="field-label">Speaking rate</span><div id="tts-rate"></div></div>
        <div class="field"><span class="field-label">Check</span><button class="btn btn-ghost" id="tts-test">${ico("volume")} Test voice</button></div>
      </section>
      <section class="set-card">
        <h3>Calls</h3>
        <div class="field"><span class="field-label">Barge-in — interrupt the AI with your voice</span><span id="barge"></span></div>
        <p class="set-hint">While the assistant speaks, microphone amplitude is analyzed; a loud phrase stops the synthesis.</p>
      </section>`;
    const voiceSel = voice.querySelector("#tts-voice") as HTMLSelectElement;
    const fillVoices = () => {
      const cur = s().ttsVoice;
      voiceSel.innerHTML = `<option value="">System default</option>` +
        window.speechSynthesis.getVoices().map((v) => `<option value="${escapeHtml(v.name)}"${v.name === cur ? " selected" : ""}>${escapeHtml(v.name)} (${v.lang})</option>`).join("");
    };
    fillVoices();
    window.speechSynthesis.onvoiceschanged = fillVoices;
    voice.querySelector("#stt-lang")!.addEventListener("change", (e) => set({ sttLang: (e.target as HTMLSelectElement).value }));
    voiceSel.addEventListener("change", () => set({ ttsVoice: voiceSel.value }));
    voice.querySelector("#tts-rate")!.appendChild(rangeEl({ min: 0.6, max: 1.6, step: 0.05, value: s().ttsRate, fmt: (v) => `${v.toFixed(2)}×`, onChange: (v) => set({ ttsRate: v }) }));
    voice.querySelector("#barge")!.appendChild(switchEl(s().bargeIn, (v) => set({ bargeIn: v })));
    voice.querySelector("#tts-test")!.addEventListener("click", () => {
      const u = new SpeechSynthesisUtterance("Hello! This is a speech synthesis test. I'm ready for a call.");
      u.lang = "en-US";
      u.rate = s().ttsRate;
      const v = window.speechSynthesis.getVoices().find((x) => x.name === s().ttsVoice) ?? window.speechSynthesis.getVoices().find((x) => x.lang.startsWith("en"));
      if (v) u.voice = v;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    });

    const uiP = host.querySelector('[data-panel="ui"]')!;
    uiP.innerHTML = `
      <section class="set-card">
        <h3>Theme</h3>
        <div class="theme-cards">
          <button class="theme-card${s().theme === "light" ? " on" : ""}" data-th="light"><span class="tc-prev tc-light"></span>Light</button>
          <button class="theme-card${s().theme === "dark" ? " on" : ""}" data-th="dark"><span class="tc-prev tc-dark"></span>Dark</button>
        </div>
      </section>
      <section class="set-card">
        <h3>Reading</h3>
        <div class="field"><span class="field-label">Message text size</span><div id="fs"></div></div>
        <div class="field"><span class="field-label">Show message timestamps</span><span id="sw-time"></span></div>
      </section>
      <section class="set-card">
        <h3>Composer & streaming</h3>
        <div class="field"><span class="field-label">Enter sends the message</span><span id="sw-enter"></span></div>
        <div class="field"><span class="field-label">Gradual typing (offline engine)</span><span id="sw-stream"></span></div>
        <div class="field"><span class="field-label">Notification sounds</span><span id="sw-sound"></span></div>
        <div class="field"><span class="field-label">Volume</span><div id="vol"></div></div>
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

    const dataP = host.querySelector('[data-panel="data"]')!;
    const msgsTotal = store.state.chats.reduce((n, c) => n + c.msgs.length, 0);
    const kb = Math.max(1, Math.round(JSON.stringify(store.state.chats).length / 1024));
    dataP.innerHTML = `
      <section class="set-card">
        <h3>Local storage (IndexedDB)</h3>
        <div class="stat-grid">
          <div class="stat"><b>${store.state.chats.length}</b><span>chats</span></div>
          <div class="stat"><b>${msgsTotal}</b><span>messages</span></div>
          <div class="stat"><b>${kb} KB</b><span>of data</span></div>
          <div class="stat"><b>${store.state.models.length}</b><span>models in catalog</span></div>
        </div>
      </section>
      <section class="set-card">
        <h3>Export & cleanup</h3>
        <div class="edge-row">
          <button class="btn btn-ghost" id="export-json">${ico("download")} Export JSON</button>
          <button class="btn btn-ghost danger-text" id="clear-chats">${ico("trash")} Clear all chats</button>
          <button class="btn btn-danger" id="wipe">${ico("alert")} Full reset</button>
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
      toast("Exported", "ok");
    });
    dataP.querySelector("#clear-chats")!.addEventListener("click", async () => {
      const ok = await confirmDialog({ title: "Clear chats?", text: "All chat history will be removed from IndexedDB. Settings are kept.", okText: "Clear", danger: true });
      if (!ok) return;
      store.state.chats = [makeChat()];
      persist();
      router.navigate(`#/c/${store.state.chats[0].id}`);
      renderSettings();
      toast("History cleared", "ok");
    });
    dataP.querySelector("#wipe")!.addEventListener("click", async () => {
      const ok = await confirmDialog({ title: "Full reset?", text: "Everything will be deleted: chats, settings, keys and the model cache. This cannot be undone.", okText: "Reset all", danger: true });
      if (!ok) return;
      await db.clear("chats");
      await db.clear("settings");
      await db.clear("models");
      await db.clear("misc");
      location.hash = "";
      location.reload();
    });
  }

  renderChatList();
  router.start();

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
