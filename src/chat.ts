import { ico } from "./icons";
import type { Store } from "./store";
import type { IDB } from "./db";
import type { Router } from "./router";
import { EdgeClient, webSearch, providerName, STATIC_MODELS, KEY_ENV } from "./api";
import type { ModelInfo, ChatMsg, StreamEvent, WebSource } from "./api";
import { renderMarkdown, extractArtifacts, escapeHtml } from "./render";
import type { Artifact } from "./render";
import { localChat, thinkSteps, sourcesContext } from "./engine";
import { el, toast, openPopover } from "./ui";
import { dictate } from "./call";
import type { CallLine } from "./call";
import { t, applyI18n, getLang } from "./i18n";
import type { Lang } from "./i18n";

export interface Msg {
  id: string;
  role: "user" | "assistant";
  content: string;
  ts: number;
  images?: string[];
  thinking?: string;
  sources?: WebSource[];
  model?: string;
  err?: string;
  arts?: Artifact[];
}
export interface ChatDoc {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  msgs: Msg[];
}
export interface Settings {
  lang: Lang;
  edgeUrl: string;
  keys: Record<string, string>;
  sttLang: string;
  ttsVoice: string;
  ttsRate: number;
  bargeIn: boolean;
  theme: "light" | "dark";
  fontSize: number;
  enterSend: boolean;
  showTime: boolean;
  stream: boolean;
  sound: boolean;
  volume: number;
}
export const DEFAULT_SETTINGS: Settings = {
  lang: "en",
  edgeUrl: "",
  keys: {},
  sttLang: "en-US",
  ttsVoice: "",
  ttsRate: 1,
  bargeIn: true,
  theme: "dark",
  fontSize: 15,
  enterSend: true,
  showTime: true,
  stream: true,
  sound: true,
  volume: 0.6,
};
export interface AppState {
  ready: boolean;
  chats: ChatDoc[];
  activeId: string;
  settings: Settings;
  models: ModelInfo[];
  modelId: string;
  webSearch: boolean;
  deepThink: boolean;
  artOpen: boolean;
  sidebarOpen: boolean;
  sideCollapsed: boolean;
  view: string;
}
export const uid = (): string => Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const fmtTime = (ts: number) =>
  new Date(ts).toLocaleTimeString(getLang() === "uk" ? "uk-UA" : "en-US", { hour: "2-digit", minute: "2-digit" });

export interface ChatCtx {
  store: Store<AppState>;
  db: IDB;
  client: EdgeClient;
  router: Router;
  persist: () => void;
  refreshArtifacts: () => void;
  startCall: (kind: "audio" | "video") => void;
}

const SUGGESTIONS = [
  { icon: "code", text: "Explain how SSE streaming works with a code example" },
  { icon: "wand", text: "Build an HTML page with a Pomodoro timer" },
  { icon: "spark", text: "Walk me through the architecture of this app" },
  { icon: "brain", text: "Calculate (128 + 47) * 3 and explain the order of operations" },
];

function ping(ctx: ChatCtx, kind: "send" | "recv"): void {
  const s = ctx.store.state.settings;
  if (!s.sound) return;
  try {
    const ac = new AudioContext();
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = "sine";
    o.frequency.value = kind === "send" ? 660 : 520;
    const now = ac.currentTime;
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.05 * s.volume, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
    o.connect(g).connect(ac.destination);
    o.start(now);
    o.stop(now + 0.25);
    setTimeout(() => ac.close(), 400);
  } catch { /* noop */ }
}

export class ChatEngine {
  private topbar!: HTMLElement;
  private listEl!: HTMLElement;
  private scroller!: HTMLElement;
  private ta!: HTMLTextAreaElement;
  private sendBtn!: HTMLButtonElement;
  private modelBtn!: HTMLElement;
  private pending: string[] = [];
  private chipsEl!: HTMLElement;
  private controller: AbortController | null = null;
  private fileInput!: HTMLInputElement;
  private dictStop: (() => void) | null = null;

  constructor(private host: HTMLElement, private ctx: ChatCtx) {
    this.build();
    this.bind();
  }

  private build(): void {
    this.host.innerHTML = `
      <div class="chat-top">
        <button class="icon-btn sidebar-burger" data-i18n-title="Menu" title="Menu">${ico("menu")}</button>
        <button class="model-btn" data-i18n-title="Choose model" title="Choose model"><span class="model-dot"></span><span class="model-label">…</span>${ico("chevronDown")}</button>
        <div class="top-toggles">
          <button class="pill-toggle" data-flag="webSearch" data-i18n-title="Search the web for sources before answering" title="Search the web for sources before answering">${ico("globe")}<span data-i18n="Web search">Web search</span></button>
          <button class="pill-toggle" data-flag="deepThink" data-i18n-title="Show the model's chain of thought" title="Show the model's chain of thought">${ico("brain")}<span data-i18n="Deep thinking">Deep thinking</span></button>
        </div>
        <div class="top-actions">
          <button class="icon-btn call-direct" data-act="call-audio" data-i18n-title="Voice call" title="Voice call">${ico("phone")}</button>
          <button class="icon-btn call-direct" data-act="call-video" data-i18n-title="Video call" title="Video call">${ico("video")}</button>
          <button class="icon-btn call-more" data-act="call-menu" data-i18n-title="Call" title="Call">${ico("phone")}</button>
        </div>
      </div>
      <div class="msg-scroll"><div class="msg-list"></div>
        <button class="jump-btn" data-i18n-title="Scroll to bottom" title="Scroll to bottom">${ico("arrowDown")}<span class="jump-count" hidden>0</span></button>
      </div>
      <div class="composer">
        <div class="comp-chips" hidden></div>
        <div class="comp-box">
          <textarea class="comp-ta" rows="1" data-i18n-ph="Message…" placeholder="Message…" title="Enter to send, Shift+Enter for a new line"></textarea>
          <div class="comp-btns">
            <button class="icon-btn" data-act="attach" data-i18n-title="Attach image" title="Attach image">${ico("image")}</button>
            <button class="icon-btn mic-btn" data-act="dictate" data-i18n-title="Voice input" title="Voice input">${ico("mic")}</button>
            <button class="send-btn" data-act="send" data-i18n-title="Send" title="Send">${ico("send")}</button>
          </div>
        </div>
        <div class="comp-hint"><span class="hint-model"></span><span data-i18n="AI may be wrong — double-check important info">AI may be wrong — double-check important info</span></div>
      </div>
      <div class="drop-veil" hidden><div class="drop-card">${ico("image")}<b data-i18n="Drop images to attach">Drop images to attach</b></div></div>
      <input type="file" accept="image/*" multiple hidden />`;
    this.topbar = this.host.querySelector(".chat-top")!;
    this.listEl = this.host.querySelector(".msg-list")!;
    this.scroller = this.host.querySelector(".msg-scroll")!;
    this.ta = this.host.querySelector(".comp-ta")!;
    this.sendBtn = this.host.querySelector(".send-btn")!;
    this.modelBtn = this.host.querySelector(".model-btn")!;
    this.chipsEl = this.host.querySelector(".comp-chips")!;
    this.fileInput = this.host.querySelector("input[type=file]")!;
  }

  private bind(): void {
    const { store } = this.ctx;

    this.topbar.querySelector(".sidebar-burger")!.addEventListener("click", () => {
      if (innerWidth <= 920) store.state.sidebarOpen = !store.state.sidebarOpen;
      else store.state.sideCollapsed = !store.state.sideCollapsed;
    });
    this.modelBtn.addEventListener("click", () => this.openModelMenu());
    this.topbar.querySelectorAll(".pill-toggle").forEach((b) =>
      b.addEventListener("click", () => {
        const flag = b.getAttribute("data-flag") as "webSearch" | "deepThink";
        store.state[flag] = !store.state[flag];
      })
    );
    this.topbar.querySelector('[data-act="call-audio"]')!.addEventListener("click", () => this.ctx.startCall("audio"));
    this.topbar.querySelector('[data-act="call-video"]')!.addEventListener("click", () => this.ctx.startCall("video"));
    this.topbar.querySelector('[data-act="call-menu"]')!.addEventListener("click", (e) => {
      const menu = el("div", "dd-callmenu");
      menu.innerHTML = `
        <button class="dd-item" data-kind="audio">${ico("phone")}<span class="dd-name">${t("Voice call")}</span></button>
        <button class="dd-item" data-kind="video">${ico("video")}<span class="dd-name">${t("Video call")}</span></button>`;
      const close = openPopover(e.currentTarget as HTMLElement, menu, { align: "right", width: 224 });
      menu.addEventListener("click", (ev) => {
        const item = (ev.target as HTMLElement).closest(".dd-item") as HTMLElement | null;
        if (!item) return;
        close();
        this.ctx.startCall(item.getAttribute("data-kind") as "audio" | "video");
      });
    });

    this.ta.addEventListener("input", () => this.autosize());
    this.ta.addEventListener("keydown", (e) => {
      const enterSend = store.state.settings.enterSend;
      if (e.key === "Enter" && ((enterSend && !e.shiftKey) || (!enterSend && (e.ctrlKey || e.metaKey)))) {
        e.preventDefault();
        this.submit();
      }
    });
    this.sendBtn.addEventListener("click", () => {
      if (this.controller) this.stop();
      else this.submit();
    });
    this.host.querySelector('[data-act="attach"]')!.addEventListener("click", () => this.fileInput.click());
    this.fileInput.addEventListener("change", () => {
      void this.addFiles(this.fileInput.files);
      this.fileInput.value = "";
    });
    const micBtn = this.host.querySelector(".mic-btn")!;
    micBtn.addEventListener("click", () => this.toggleDictate(micBtn as HTMLElement));

    this.ta.addEventListener("paste", (e) => {
      const files = Array.from(e.clipboardData?.files ?? []).filter((f) => f.type.startsWith("image/"));
      if (files.length) { e.preventDefault(); void this.addFiles(files); }
    });
    const veil = this.host.querySelector(".drop-veil") as HTMLElement;
    let dragDepth = 0;
    this.host.addEventListener("dragenter", (e) => {
      e.preventDefault();
      dragDepth++;
      veil.hidden = false;
    });
    this.host.addEventListener("dragover", (e) => e.preventDefault());
    this.host.addEventListener("dragleave", () => {
      dragDepth = Math.max(0, dragDepth - 1);
      if (!dragDepth) veil.hidden = true;
    });
    this.host.addEventListener("drop", (e) => {
      e.preventDefault();
      dragDepth = 0;
      veil.hidden = true;
      void this.addFiles(e.dataTransfer?.files);
    });

    this.listEl.addEventListener("click", (e) => {
      const tg = e.target as HTMLElement;
      const actBtn = tg.closest("[data-mact]") as HTMLElement | null;
      if (actBtn) {
        const id = actBtn.closest(".msg")?.getAttribute("data-id") ?? "";
        this.msgAction(actBtn.getAttribute("data-mact")!, id);
        return;
      }
      const thumb = tg.closest(".thumb") as HTMLElement | null;
      if (thumb) {
        const img = el("div", "lightbox");
        img.innerHTML = `<img src="${thumb.getAttribute("data-src")}" alt=""/>`;
        img.addEventListener("click", () => img.remove());
        document.body.appendChild(img);
        return;
      }
      const think = tg.closest(".think-head") as HTMLElement | null;
      if (think) {
        think.closest(".think-card")?.classList.toggle("open");
        return;
      }
      const sugg = tg.closest(".sugg-card") as HTMLElement | null;
      if (sugg) { void this.send(sugg.getAttribute("data-text") ?? "", []); }
      const chip = tg.closest(".cb-copy") as HTMLElement | null;
      if (chip) {
        const block = chip.closest(".codeblock")?.querySelector("pre code")?.textContent ?? "";
        void this.copyText(block);
        chip.classList.add("ok");
        chip.textContent = t("copied");
        setTimeout(() => { chip.classList.remove("ok"); chip.textContent = t("copy"); }, 1500);
        return;
      }
      const openArt = tg.closest(".cb-open") as HTMLElement | null;
      if (openArt) {
        this.ctx.store.state.artOpen = true;
        this.ctx.refreshArtifacts();
      }
    });

    const jump = this.host.querySelector(".jump-btn") as HTMLElement;
    const count = jump.querySelector(".jump-count") as HTMLElement;
    this.scroller.addEventListener("scroll", () => {
      const near = this.nearBottom();
      jump.classList.toggle("show", !near);
      if (near) count.hidden = true;
    });
    jump.addEventListener("click", () => this.scrollBottom(true));

    store.watch(["modelId", "models"], () => this.syncModelBtn());
    store.watch(["webSearch", "deepThink"], () => this.syncToggles());
    this.syncToggles();
  }

  applyLang(): void {
    applyI18n(this.host);
    this.syncModelBtn();
    this.renderChat();
  }

  private openModelMenu(): void {
    const { store, client } = this.ctx;
    const wrap = el("div", "dd-models");
    const q = el<HTMLInputElement>("input", "dd-search");
    q.placeholder = t("Search models…");
    const body = el("div", "dd-body");
    wrap.append(q, body);
    const render = () => {
      const term = q.value.trim().toLowerCase();
      const groups = new Map<string, ModelInfo[]>();
      for (const m of store.state.models) {
        if (term && !(m.name + m.id + m.provider).toLowerCase().includes(term)) continue;
        const key = providerName(m.provider);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(m);
      }
      body.innerHTML = "";
      if (!groups.size) body.innerHTML = `<div class="dd-empty">${t("Nothing found")}</div>`;
      for (const [name, list] of groups) {
        body.insertAdjacentHTML("beforeend", `<div class="dd-group">${escapeHtml(name)}</div>`);
        for (const m of list) {
          const active = m.id === store.state.modelId ? " active" : "";
          const locked = m.provider !== "local" && !store.state.settings.keys[KEY_ENV[m.provider]] && !store.state.settings.edgeUrl ? " locked" : "";
          body.insertAdjacentHTML("beforeend", `
            <button class="dd-item${active}${locked}" data-model="${escapeHtml(m.id)}">
              <span class="dd-name">${escapeHtml(m.name)}${locked ? `<span class="dd-lock" title="${t("API key or Edge worker required")}">${ico("key")}</span>` : ""}</span>
              ${m.tag ? `<span class="dd-tag">${escapeHtml(t(m.tag))}</span>` : ""}
              ${active ? `<span class="dd-check">${ico("check")}</span>` : ""}
            </button>`);
        }
      }
    };
    q.addEventListener("input", render);
    body.addEventListener("click", (e) => {
      const item = (e.target as HTMLElement).closest(".dd-item") as HTMLElement | null;
      if (!item) return;
      const id = item.getAttribute("data-model")!;
      store.state.modelId = id;
      void this.ctx.db.set("misc", "modelId", id);
      this.syncModelBtn();
      toast(`${t("Model:")} ${store.state.models.find((m) => m.id === id)?.name ?? id}`, "ok");
      closeNow();
    });
    const foot = el("div", "dd-foot");
    foot.innerHTML = `<button class="btn btn-ghost btn-sm">${ico("refresh")} ${t("Refresh list")}</button><a class="btn btn-ghost btn-sm" href="#/settings">${ico("gear")} ${t("Settings")}</a>`;
    wrap.appendChild(foot);
    foot.querySelector("button")!.addEventListener("click", async () => {
      (foot.querySelector("button") as HTMLButtonElement).disabled = true;
      try {
        const models = await client.fetchModels(store.state.settings.keys);
        store.state.models = models;
        void this.ctx.db.set("models", "list", { ts: Date.now(), models });
        render();
        toast(`${t("Models found:")} ${models.length}`, "ok");
      } catch {
        toast(t("Couldn't refresh models"), "err");
      } finally {
        (foot.querySelector("button") as HTMLButtonElement).disabled = false;
      }
    });
    render();
    const closeNow = openPopover(this.modelBtn, wrap, { width: 330 });
  }

  private syncModelBtn(): void {
    const { store } = this.ctx;
    const m = store.state.models.find((x) => x.id === store.state.modelId) ?? STATIC_MODELS[0];
    this.modelBtn.querySelector(".model-label")!.textContent = m.name;
    this.modelBtn.setAttribute("title", `${m.name} · ${providerName(m.provider)}`);
    const hint = this.host.querySelector(".hint-model")!;
    hint.textContent = m.name;
  }

  private syncToggles(): void {
    const s = this.ctx.store.state;
    this.topbar.querySelectorAll(".pill-toggle").forEach((b) => {
      const flag = b.getAttribute("data-flag") as "webSearch" | "deepThink";
      b.classList.toggle("on", s[flag]);
    });
  }

  private async addFiles(files?: FileList | File[] | null): Promise<void> {
    const list = Array.from(files ?? []).filter((f) => f.type.startsWith("image/"));
    if (!list.length) return;
    for (const f of list.slice(0, 4 - this.pending.length)) {
      const data = await fileToDataUrl(f);
      if (data) this.pending.push(data);
    }
    this.renderChips();
  }

  private renderChips(): void {
    this.chipsEl.innerHTML = "";
    this.chipsEl.hidden = !this.pending.length;
    this.pending.forEach((src, i) => {
      const chip = el("div", "comp-chip");
      chip.innerHTML = `<img src="${src}" alt=""/><button title="Remove">${ico("close")}</button>`;
      chip.querySelector("button")!.addEventListener("click", () => {
        this.pending.splice(i, 1);
        this.renderChips();
      });
      this.chipsEl.appendChild(chip);
    });
  }

  private toggleDictate(btn: HTMLElement): void {
    if (this.dictStop) {
      this.dictStop();
      this.dictStop = null;
      btn.classList.remove("listening");
      return;
    }
    const stop = dictate(
      this.ctx.store.state.settings.sttLang,
      (text, isFinal) => {
        if (isFinal) this.ta.value = (this.ta.value ? this.ta.value.replace(/\s*$/, " ") : "") + text;
        else if (!this.ta.dataset.base) { this.ta.dataset.base = this.ta.value; this.ta.value = text; }
        else this.ta.value = this.ta.dataset.base + (this.ta.dataset.base ? " " : "") + text;
        this.autosize();
      },
      () => {
        this.dictStop = null;
        btn.classList.remove("listening");
        this.ta.dataset.base = "";
        this.ta.focus();
      }
    );
    if (!stop) {
      toast(t("Web Speech API isn't available in this browser"), "err");
      return;
    }
    this.dictStop = stop;
    btn.classList.add("listening");
  }

  private autosize(): void {
    this.ta.style.height = "auto";
    this.ta.style.height = Math.min(this.ta.scrollHeight, 160) + "px";
  }

  renderChat(): void {
    const chat = this.activeChat();
    this.listEl.innerHTML = "";
    if (!chat) return;
    if (!chat.msgs.length) {
      this.listEl.appendChild(this.emptyState());
      return;
    }
    for (const m of chat.msgs) this.listEl.appendChild(this.msgEl(m));
    this.scrollBottom(false);
  }

  private activeChat(): ChatDoc | undefined {
    const s = this.ctx.store.state;
    return s.chats.find((c) => c.id === s.activeId);
  }

  private emptyState(): HTMLElement {
    const wrap = el("div", "empty-state");
    wrap.innerHTML = `
      <div class="greet-mark">${ico("logo")}</div>
      <h2 class="greet-title">${t("How can I help?")}</h2>
      <p class="greet-sub">${t("Pick a model, turn on web search or deep thinking — or start with a suggestion")}</p>
      <div class="sugg-grid">${SUGGESTIONS.map((s) => `
        <button class="sugg-card" data-text="${escapeHtml(t(s.text))}">${ico(s.icon)}<span>${escapeHtml(t(s.text))}</span></button>`).join("")}
      </div>`;
    return wrap;
  }

  private msgEl(m: Msg): HTMLElement {
    const row = el("div", `msg ${m.role === "user" ? "user" : "bot"}${m.err ? " has-err" : ""}`);
    row.setAttribute("data-id", m.id);
    if (m.role === "user") {
      const imgs = m.images?.length
        ? `<div class="msg-images">${m.images.map((s) => `<span class="thumb" data-src="${s}"><img src="${s}" alt="" loading="lazy"/></span>`).join("")}</div>`
        : "";
      row.innerHTML = `
        <div class="msg-body">
          <div class="bubble">${imgs}<div class="bubble-text">${escapeHtml(m.content).replace(/\n/g, "<br>")}</div></div>
          <div class="msg-meta">${this.ctx.store.state.settings.showTime ? fmtTime(m.ts) : ""}</div>
        </div>`;
      return row;
    }
    const nSrc = m.sources?.length ?? 0;
    const src = nSrc
      ? `<div class="src-row"><span class="src-note">${ico("globe")} ${nSrc} ${t(nSrc === 1 ? "source" : "sources")}</span>${m.sources!.map((s, i) => `<a class="src-chip" href="${s.url}" target="_blank" rel="noopener"><b>${i + 1}</b>${escapeHtml(s.title)}</a>`).join("")}</div>`
      : "";
    const think = m.thinking
      ? `<div class="think-card"><div class="think-head">${ico("brain")}<span>${t("Chain of thought")}</span>${ico("chevronDown")}</div><div class="think-body">${escapeHtml(m.thinking).replace(/\n/g, "<br>")}</div></div>`
      : "";
    const content = m.content ? renderMarkdown(m.content) : "";
    const errHtml = m.err ? `<div class="msg-err">${ico("alert")}<span>${escapeHtml(m.err)}</span><button class="btn btn-sm btn-ghost" data-mact="retry">${t("Retry")}</button></div>` : "";
    const meta = m.model ? `<span class="meta-model">${escapeHtml(m.model)}</span>` : "";
    row.innerHTML = `
      <div class="msg-avatar" title="${t("Assistant")}">${ico("spark")}</div>
      <div class="msg-body">
        ${src}${think}
        <div class="msg-content">${content}</div>
        ${errHtml}
        <div class="msg-meta">${meta}${this.ctx.store.state.settings.showTime ? `<span>${fmtTime(m.ts)}</span>` : ""}</div>
        ${m.content && !m.err ? `<div class="msg-actions">
          <button class="ma-btn" data-mact="copy" title="${t("Copy")}">${ico("copy")}</button>
          <button class="ma-btn" data-mact="tts" title="${t("Read aloud")}">${ico("volume")}</button>
          <button class="ma-btn" data-mact="regen" title="${t("Regenerate")}">${ico("refresh")}</button>
        </div>` : ""}
      </div>`;
    return row;
  }

  private msgAction(act: string, id: string): void {
    const chat = this.activeChat();
    const m = chat?.msgs.find((x) => x.id === id);
    if (!chat || !m) return;
    if (act === "copy") void this.copyText(m.content);
    if (act === "tts") this.speak(m.content);
    if (act === "regen") void this.regenerate(id);
    if (act === "retry") void this.regenerate(id);
  }

  private async copyText(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      toast(t("Copied to clipboard"), "ok");
    } catch {
      toast(t("Couldn't copy"), "err");
    }
  }

  private speak(text: string): void {
    const s = this.ctx.store.state.settings;
    const synth = window.speechSynthesis;
    if (!synth) return;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/[*_`#>]/g, "").slice(0, 800));
    u.lang = getLang() === "uk" ? "uk-UA" : "en-US";
    u.rate = s.ttsRate;
    const v = synth.getVoices().find((x) => x.name === s.ttsVoice) ?? synth.getVoices().find((x) => x.lang.startsWith(getLang() === "uk" ? "uk" : "en"));
    if (v) u.voice = v;
    synth.speak(u);
  }

  private submit(): void {
    const text = this.ta.value.trim();
    if (!text && !this.pending.length) return;
    void this.send(text || t("Describe these images"), this.pending);
    this.pending = [];
    this.renderChips();
    this.ta.value = "";
    this.ta.dataset.base = "";
    this.autosize();
  }

  async send(text: string, images: string[]): Promise<void> {
    const { store } = this.ctx;
    const chat = this.activeChat();
    if (!chat) return;

    if (!chat.msgs.length) {
      chat.title = text.length > 38 ? text.slice(0, 35) + "…" : text;
    }
    const userMsg: Msg = { id: uid(), role: "user", content: text, ts: Date.now(), images: images.length ? images : undefined };
    chat.msgs.push(userMsg);
    chat.updatedAt = Date.now();
    this.ctx.persist();

    if (this.listEl.querySelector(".empty-state")) this.listEl.innerHTML = "";
    this.listEl.appendChild(this.msgEl(userMsg));
    this.scrollBottom(true);
    ping(this.ctx, "send");

    const wantWeb = store.state.webSearch;
    const deep = store.state.deepThink;
    let sources: WebSource[] = [];
    let webContext = "";

    const aiId = uid();
    const aiMsg: Msg = { id: aiId, role: "assistant", content: "", ts: Date.now(), model: store.state.modelId };
    chat.msgs.push(aiMsg);

    const row = el("div", "msg bot streaming");
    row.setAttribute("data-id", aiId);
    row.innerHTML = `
      <div class="msg-avatar">${ico("spark")}</div>
      <div class="msg-body">
        <div class="src-row" hidden></div>
        <div class="think-card${deep ? " active open" : ""}" ${deep ? "" : "hidden"}>
          <div class="think-head">${ico("brain")}<span>${t("Chain of thought")}</span><span class="think-dots"><i></i><i></i><i></i></span>${ico("chevronDown")}</div>
          <div class="think-body"></div>
        </div>
        <div class="msg-content"><span class="stream-caret"></span></div>
      </div>`;
    this.listEl.appendChild(row);
    this.scrollBottom(true);

    const srcRow = row.querySelector(".src-row") as HTMLElement;
    const thinkCard = row.querySelector(".think-card") as HTMLElement;
    const thinkBody = thinkCard.querySelector(".think-body") as HTMLElement;
    const contentEl = row.querySelector(".msg-content") as HTMLElement;

    if (wantWeb) {
      srcRow.hidden = false;
      srcRow.innerHTML = `<span class="src-note src-busy">${ico("globe")} ${t("Searching the web…")}</span>`;
      try {
        sources = await webSearch(text);
      } catch { sources = []; }
      const n = sources.length;
      srcRow.innerHTML = n
        ? `<span class="src-note">${ico("globe")} ${n} ${t(n === 1 ? "source" : "sources")}</span>` + sources.map((s, i) => `<a class="src-chip" href="${s.url}" target="_blank" rel="noopener"><b>${i + 1}</b>${escapeHtml(s.title)}</a>`).join("")
        : `<span class="src-note">${ico("globe")} ${t("Nothing found — answering without context")}</span>`;
      webContext = sourcesContext(sources);
      this.scrollBottom(true);
    }

    const model = store.state.models.find((m) => m.id === store.state.modelId) ?? STATIC_MODELS[0];
    this.controller = new AbortController();
    const sig = this.controller.signal;
    this.sendBtn.classList.add("busy");
    this.sendBtn.innerHTML = ico("stop");
    this.sendBtn.title = t("Stop");

    let raw = "";
    let thinkRaw = "";
    let lastPaint = 0;
    const paint = (force = false) => {
      const now = Date.now();
      if (!force && now - lastPaint < 90) return;
      lastPaint = now;
      contentEl.innerHTML = (raw ? renderMarkdown(raw) : "") + `<span class="stream-caret"></span>`;
      if (this.nearBottom()) this.scrollBottom(false);
    };
    const paintThink = () => {
      thinkBody.textContent = thinkRaw;
    };

    try {
      const gen = model.provider === "local"
        ? this.localStream(text, { images, sources, deep, sig })
        : this.ctx.client.chat(model, this.history(chat), {
            keys: store.state.settings.keys, signal: sig, deep, webContext: webContext || undefined,
          });
      for await (const ev of gen) {
        if (ev.type === "thinking") {
          thinkCard.hidden = false;
          thinkCard.classList.add("active", "open");
          thinkRaw += ev.text;
          paintThink();
        } else if (ev.type === "delta") {
          raw += ev.text;
          paint();
        } else if (ev.type === "error") {
          throw new Error(ev.message);
        }
      }
      paint(true);
    } catch (e: any) {
      if (sig.aborted || e?.name === "AbortError") {
        if (raw) raw += `\n\n*${t("— stopped by user")}*`;
      } else {
        aiMsg.err = e?.message || t("Unknown error");
      }
    } finally {
      this.controller = null;
      this.sendBtn.classList.remove("busy");
      this.sendBtn.innerHTML = ico("send");
      this.sendBtn.title = t("Send");
    }

    aiMsg.content = raw;
    aiMsg.thinking = thinkRaw || undefined;
    aiMsg.sources = sources.length ? sources : undefined;
    aiMsg.ts = Date.now();
    if (raw) aiMsg.arts = extractArtifacts(raw, aiMsg.ts);
    chat.updatedAt = Date.now();
    this.ctx.persist();

    const finalEl = this.msgEl(aiMsg);
    row.replaceWith(finalEl);
    if (this.nearBottom()) this.scrollBottom(true);
    if (raw) {
      ping(this.ctx, "recv");
      if (aiMsg.arts?.length) {
        this.ctx.refreshArtifacts();
        toast(`${t("Artifacts added:")} ${aiMsg.arts.length}`, "ok");
      }
    }
  }

  private history(chat: ChatDoc): ChatMsg[] {
    const sys: ChatMsg[] = [{ role: "system", content: "You are shai, a helpful assistant. Answer in English, concise and to the point. Format replies in Markdown, code in fenced blocks with the language tag." }];
    const hist: ChatMsg[] = chat.msgs
      .filter((m) => !m.err && m.content)
      .slice(-16)
      .map((m) => ({ role: m.role, content: m.content, images: m.role === "user" ? m.images : undefined }));
    return [...sys, ...hist];
  }

  private async *localStream(
    text: string,
    opts: { images: string[]; sources: WebSource[]; deep: boolean; sig: AbortSignal }
  ): AsyncGenerator<StreamEvent> {
    const s = this.ctx.store.state.settings;
    if (opts.deep) {
      for (const step of thinkSteps(text, { sources: opts.sources.length || undefined, images: opts.images.length || undefined })) {
        if (opts.sig.aborted) throw Object.assign(new Error("stop"), { name: "AbortError" });
        yield { type: "thinking", text: "→ " + step + "\n" };
        await sleep(380);
      }
    }
    const res = localChat(text, { images: opts.images.length || undefined, sources: opts.sources });
    if (s.stream) {
      for (let i = 0; i < res.text.length; i += 3) {
        if (opts.sig.aborted) throw Object.assign(new Error("stop"), { name: "AbortError" });
        yield { type: "delta", text: res.text.slice(i, i + 3) };
        await sleep(12);
      }
    } else {
      yield { type: "delta", text: res.text };
    }
  }

  stop(): void {
    this.controller?.abort();
  }

  private async regenerate(aiId: string): Promise<void> {
    const chat = this.activeChat();
    if (!chat) return;
    const idx = chat.msgs.findIndex((m) => m.id === aiId);
    if (idx < 0) return;
    let userText = "";
    for (let i = idx - 1; i >= 0; i--) {
      if (chat.msgs[i].role === "user") { userText = chat.msgs[i].content; break; }
    }
    chat.msgs.splice(idx, 1);
    this.ctx.persist();
    this.renderChat();
    if (userText) await this.send(userText, []);
  }

  addCallLog(lines: CallLine[], sec: number, kind: "audio" | "video"): void {
    const chat = this.activeChat();
    if (!chat) return;
    const mm = Math.floor(sec / 60).toString().padStart(2, "0");
    const ss = Math.floor(sec % 60).toString().padStart(2, "0");
    const body = lines.map((l) => `- **${t(l.who === "me" ? "You" : "Assistant")}**: ${l.text}`).join("\n");
    chat.msgs.push({
      id: uid(), role: "assistant", ts: Date.now(),
      content: `**${t(kind === "video" ? "Video call ended" : "Voice call ended")}** · ${t("duration")} ${mm}:${ss}\n\n**${t("Transcript")}:**\n${body}`,
    });
    chat.updatedAt = Date.now();
    this.ctx.persist();
    if (this.ctx.store.state.activeId === chat.id) this.renderChat();
    toast(t("Call transcript added to the chat"), "ok");
  }

  private nearBottom(): boolean {
    return this.scroller.scrollHeight - this.scroller.scrollTop - this.scroller.clientHeight < 130;
  }
  private scrollBottom(smooth: boolean): void {
    this.scroller.scrollTo({ top: this.scroller.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }
}

function fileToDataUrl(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 1280;
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * k);
        c.height = Math.round(img.height * k);
        c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = () => resolve(null);
      img.src = String(reader.result);
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}
