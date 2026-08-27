/* ============================================================
   СОЛОВЕЙ — увесь застосунок на чистому JS (без фреймворків)
   DOM будується вручну, стан живе у localStorage
   ============================================================ */
import { icons, feathersHTML } from "./icons";
import { getBotReply, SUGGESTIONS } from "./engine";

type Role = "user" | "bot";
interface Msg { id: string; role: Role; text: string; time: number }
interface Chat { id: string; title: string; messages: Msg[]; createdAt: number }

const LS_CHATS = "solovey.chats.v1";
const LS_ACTIVE = "solovey.active.v1";
const LS_SOUND = "solovey.sound.v1";

const EMOJIS = ["😀", "😂", "😍", "🤔", "👍", "🙌", "🔥", "🎉", "❤️", "😎", "🤯", "😴", "🥳", "😇", "🤝", "✨", "🌙", "☕", "🍕", "🎧", "🐦", "🌿", "💡", "🚀"];

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36));
const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
const fmtTime = (t: number) => new Intl.DateTimeFormat("uk-UA", { hour: "2-digit", minute: "2-digit" }).format(t);
const fmtListTime = (t: number | null) => {
  if (!t) return "";
  const d = new Date(t), now = new Date();
  return d.toDateString() === now.toDateString()
    ? fmtTime(t)
    : new Intl.DateTimeFormat("uk-UA", { day: "2-digit", month: "2-digit" }).format(t);
};

export function initChat(root: HTMLElement): () => void {
  /* ---------------- стан ---------------- */
  let chats: Chat[] = loadChats();
  let activeId: string = localStorage.getItem(LS_ACTIVE) ?? chats[0].id;
  if (!chats.some((c) => c.id === activeId)) activeId = chats[0].id;
  let soundOn = localStorage.getItem(LS_SOUND) !== "0";
  let pending = 0;
  let unread = 0;
  let scrolledUp = false;

  function loadChats(): Chat[] {
    try {
      const raw = localStorage.getItem(LS_CHATS);
      if (raw) {
        const parsed = JSON.parse(raw) as Chat[];
        if (Array.isArray(parsed) && parsed.length) return parsed;
      }
    } catch { /* ігноруємо пошкоджені дані */ }
    return [{ id: uid(), title: "Нова розмова", messages: [], createdAt: Date.now() }];
  }
  const save = () => {
    try {
      localStorage.setItem(LS_CHATS, JSON.stringify(chats));
      localStorage.setItem(LS_ACTIVE, activeId);
    } catch { /* приватний режим тощо */ }
  };
  const activeChat = (): Chat => chats.find((c) => c.id === activeId) ?? chats[0];

  /* ---------------- каркас DOM ---------------- */
  root.innerHTML = `
    ${feathersHTML()}
    <div class="stage">
      <div class="shell" id="shell">
        <aside class="sidebar">
          <div class="brand">
            <div class="brand-mark" style="color:var(--amber)">${icons.bird()}</div>
            <div>
              <div class="brand-name">Соловей</div>
              <div class="brand-sub">чат-бот • pure js</div>
            </div>
            <span class="brand-tag">SVG</span>
          </div>
          <button class="new-chat" id="newChatBtn">${icons.plus}Нова розмова</button>
          <div class="list-label">Розмови</div>
          <div class="chatlist scrollzone" id="chatlist"></div>
          <div class="side-foot">
            <span class="made">${icons.heart}зроблено з любов'ю</span>
            <span class="mini-ver">v1.0</span>
          </div>
        </aside>

        <section class="main">
          <header class="topbar">
            <button class="icon-btn menu-btn" id="menuBtn" title="Меню">${icons.menu}</button>
            <div class="bot-id">
              <div class="bot-ava" style="color:var(--amber)">${icons.bird()}<span class="status-dot"></span></div>
              <div>
                <div class="bot-name">Соловей</div>
                <div class="bot-status" id="botStatus">
                  <span class="eq" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
                  <span id="statusText">онлайн · відповідає миттєво</span>
                </div>
              </div>
            </div>
            <div class="top-actions">
              <button class="icon-btn" id="infoBtn" title="Про бота">${icons.info}</button>
              <button class="icon-btn ${soundOn ? "sound-on" : ""}" id="soundBtn" title="Звук">${soundOn ? icons.soundOn : icons.soundOff}</button>
              <button class="icon-btn" id="clearBtn" title="Очистити розмову">${icons.trash}</button>
            </div>
          </header>

          <div class="chat-scroll scrollzone" id="scroller">
            <div class="msglist" id="msglist"></div>
            <button class="jump-btn" id="jumpBtn" title="До нових повідомлень">
              ${icons.arrowDown}<span class="jump-badge" id="jumpBadge" hidden>0</span>
            </button>
          </div>

          <div class="chips" id="chips"></div>

          <footer class="composer">
            <div class="composer-box">
              <div class="emoji-wrap">
                <button class="icon-btn" id="emojiBtn" title="Емодзі">${icons.smile}</button>
                <div class="emoji-pop" id="emojiPop">
                  ${EMOJIS.map((e) => `<button type="button" data-e="${e}" title="${e}">${e}</button>`).join("")}
                </div>
              </div>
              <textarea id="input" rows="1" placeholder="Напиши Солов'ю повідомлення…"></textarea>
              <button class="send-btn" id="sendBtn" disabled title="Надіслати">${icons.send}</button>
            </div>
            <div class="hint-line"><b>Enter</b> — надіслати · <b>Shift + Enter</b> — новий рядок</div>
          </footer>
        </section>
      </div>
      <div class="backdrop" id="backdrop"></div>
    </div>
    <div class="toasts" id="toasts"></div>
  `;

  /* ---------------- посилання на елементи ---------------- */
  const $ = <T extends HTMLElement>(sel: string) => root.querySelector(sel) as T;
  const shell = $("#shell");
  const chatlist = $("#chatlist");
  const msglist = $("#msglist");
  const scroller = $("#scroller");
  const jumpBtn = $("#jumpBtn");
  const jumpBadge = $("#jumpBadge");
  const chipsEl = $("#chips");
  const input = $<HTMLTextAreaElement>("#input");
  const sendBtn = $<HTMLButtonElement>("#sendBtn");
  const emojiBtn = $("#emojiBtn");
  const emojiPop = $("#emojiPop");
  const statusEl = $("#botStatus");
  const statusText = $("#statusText");
  const toastsEl = $("#toasts");

  /* ---------------- звук (WebAudio) ---------------- */
  let audio: AudioContext | null = null;
  function tone(f0: number, f1: number, at: number, dur: number, type: OscillatorType, vol: number) {
    if (!audio) return;
    const t0 = audio.currentTime + at;
    const osc = audio.createOscillator();
    const g = audio.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t0);
    osc.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(audio.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }
  function play(kind: "send" | "receive") {
    if (!soundOn) return;
    try {
      audio = audio ?? new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      if (audio.state === "suspended") void audio.resume();
      if (kind === "send") tone(620, 920, 0, 0.1, "triangle", 0.09);
      else { tone(1350, 1850, 0, 0.07, "sine", 0.08); tone(1850, 2350, 0.1, 0.09, "sine", 0.07); }
    } catch { /* тиша — теж музика */ }
  }

  /* ---------------- тости ---------------- */
  function toast(text: string) {
    const el = document.createElement("div");
    el.className = "toast";
    el.innerHTML = `${icons.checks}<span>${escapeHtml(text)}</span>`;
    toastsEl.appendChild(el);
    setTimeout(() => { el.classList.add("out"); setTimeout(() => el.remove(), 260); }, 2100);
  }

  /* ---------------- модалки ---------------- */
  function openModal(inner: string): () => void {
    const ov = document.createElement("div");
    ov.className = "overlay";
    ov.innerHTML = `<div class="modal">${inner}</div>`;
    root.appendChild(ov);
    const close = () => { ov.remove(); document.removeEventListener("keydown", onKey); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    ov.addEventListener("click", (e) => { if (e.target === ov || (e.target as HTMLElement).closest("[data-close]")) close(); });
    return close;
  }

  /* ---------------- рендер бічного списку ---------------- */
  function renderChats() {
    chatlist.innerHTML = chats
      .map((c, i) => {
        const last = c.messages[c.messages.length - 1];
        const preview = last ? `${last.role === "user" ? "Ти: " : ""}${last.text.replace(/\n+/g, " ")}` : "Порожньо — почнімо!";
        return `
        <button class="chat-item ${c.id === activeId ? "active" : ""}" data-id="${c.id}" style="animation-delay:${Math.min(i * 40, 320)}ms">
          <span class="chat-item-top">
            <span class="chat-item-title">${escapeHtml(c.title)}</span>
            <span class="chat-item-time">${fmtListTime(last ? last.time : c.createdAt)}</span>
          </span>
          <span class="chat-item-preview">${escapeHtml(preview)}</span>
          <span class="chat-del" data-del="${c.id}" title="Видалити розмову">${icons.trash}</span>
        </button>`;
      })
      .join("");
  }

  /* ---------------- рендер повідомлень ---------------- */
  function msgHTML(m: Msg): string {
    if (m.role === "user")
      return `<div class="msg user"><div class="bubble">
        <div class="txt">${escapeHtml(m.text)}</div>
        <div class="meta"><span>${fmtTime(m.time)}</span>${icons.checks}</div>
      </div></div>`;
    return `<div class="msg bot"><div class="ava" style="color:var(--amber)">${icons.bird()}</div>
      <div class="bubble">
        <button class="copy-btn" data-copy="${m.id}" title="Копіювати">${icons.copy}</button>
        <div class="txt">${escapeHtml(m.text)}</div>
        <div class="meta"><span>${fmtTime(m.time)}</span></div>
      </div></div>`;
  }

  function renderMessages() {
    pending = 0;
    unread = 0;
    updateJump();
    setTyping(false);
    const chat = activeChat();
    if (!chat.messages.length) {
      msglist.innerHTML = `
        <div class="empty">
          <div class="empty-bird">${icons.birdBig()}</div>
          <h2>Почнімо <em>спілкування</em></h2>
          <p>Я — Соловей, чат-бот на чистому HTML, CSS та JavaScript. Напиши привіт, попроси жарт, дай математичний приклад — або обери підказку нижче.</p>
        </div>`;
    } else {
      msglist.innerHTML = chat.messages.map(msgHTML).join("");
    }
    requestAnimationFrame(() => scrollBottom(false));
  }

  function scrollBottom(smooth: boolean) {
    scroller.scrollTo({ top: scroller.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }

  function updateJump() {
    jumpBtn.classList.toggle("show", scrolledUp);
    jumpBadge.hidden = unread === 0;
    jumpBadge.textContent = String(Math.min(unread, 9));
  }

  function setTyping(on: boolean) {
    statusEl.classList.toggle("typing", on);
    statusText.textContent = on ? "друкує відповідь…" : "онлайн · відповідає миттєво";
  }

  /* ---------------- копіювання ---------------- */
  function copyText(text: string) {
    const done = () => toast("Скопійовано в буфер обміну");
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
    } else fallbackCopy(text, done);
  }
  function fallbackCopy(text: string, done: () => void) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); done(); } catch { toast("Не вдалося скопіювати"); }
    ta.remove();
  }

  /* ---------------- надсилання та відповідь бота ---------------- */
  let typingRow: HTMLElement | null = null;

  function ensureTypingRow() {
    if (typingRow && typingRow.isConnected) return;
    typingRow = document.createElement("div");
    typingRow.className = "msg bot";
    typingRow.innerHTML = `<div class="ava" style="color:var(--amber)">${icons.bird()}</div><div class="bubble typing-bubble"><i></i><i></i><i></i></div>`;
    msglist.appendChild(typingRow);
    if (!scrolledUp) scrollBottom(true);
  }
  function dropTypingRow() {
    typingRow?.remove();
    typingRow = null;
  }

  function typewriter(el: HTMLElement, full: string, onDone: () => void) {
    const txtEl = el.querySelector(".txt") as HTMLElement;
    const caret = document.createElement("span");
    caret.className = "caret";
    txtEl.textContent = "";
    txtEl.appendChild(caret);
    const step = full.length > 170 ? 3 : full.length > 90 ? 2 : 1;
    let i = 0;
    const tick = () => {
      i = Math.min(full.length, i + step);
      txtEl.textContent = full.slice(0, i);
      txtEl.appendChild(caret);
      if (!scrolledUp) scrollBottom(false);
      if (i < full.length) setTimeout(tick, 16);
      else { caret.remove(); onDone(); }
    };
    tick();
  }

  function send(raw: string) {
    const text = raw.trim();
    if (!text) return;
    emojiPop.classList.remove("open");

    const chat = activeChat();
    const userMsg: Msg = { id: uid(), role: "user", text, time: Date.now() };
    chat.messages.push(userMsg);
    if (chat.title === "Нова розмова") chat.title = text.length > 32 ? text.slice(0, 32) + "…" : text;
    save();
    renderChats();

    msglist.querySelector(".empty")?.remove();
    const el = document.createElement("div");
    el.innerHTML = msgHTML(userMsg);
    msglist.appendChild(el.firstElementChild as HTMLElement);
    scrollBottom(true);

    input.value = "";
    autosize();
    sendBtn.disabled = true;
    play("send");

    /* --- бот думає й друкує --- */
    const targetId = chat.id;
    const reply = getBotReply(text);
    const delay = 650 + Math.min(1400, reply.length * 12);

    pending++;
    setTyping(true);
    if (activeId === targetId) ensureTypingRow();

    setTimeout(() => {
      const target = chats.find((c) => c.id === targetId);
      if (!target) return;
      const botMsg: Msg = { id: uid(), role: "bot", text: reply, time: Date.now() };
      target.messages.push(botMsg);
      save();
      renderChats();
      pending = Math.max(0, pending - 1);
      if (pending === 0) setTyping(false);

      if (activeId === targetId) {
        dropTypingRow();
        const node = document.createElement("div");
        node.innerHTML = msgHTML(botMsg);
        const bubbleEl = node.firstElementChild as HTMLElement;
        msglist.appendChild(bubbleEl);
        play("receive");
        if (scrolledUp) { unread++; updateJump(); }
        typewriter(bubbleEl, reply, () => { if (pending === 0) dropTypingRow(); });
      }
    }, delay);
  }

  /* ---------------- події ---------------- */
  chatlist.addEventListener("click", (e) => {
    const del = (e.target as HTMLElement).closest<HTMLElement>("[data-del]");
    if (del) {
      e.stopPropagation();
      const id = del.dataset.del!;
      chats = chats.filter((c) => c.id !== id);
      if (!chats.length) chats.push({ id: uid(), title: "Нова розмова", messages: [], createdAt: Date.now() });
      if (activeId === id) activeId = chats[0].id;
      save();
      renderChats();
      renderMessages();
      return;
    }
    const item = (e.target as HTMLElement).closest<HTMLElement>(".chat-item");
    if (item && item.dataset.id !== activeId) {
      activeId = item.dataset.id!;
      save();
      renderChats();
      renderMessages();
      shell.classList.remove("side-open");
    }
  });

  msglist.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>("[data-copy]");
    if (!btn) return;
    const m = activeChat().messages.find((x) => x.id === btn.dataset.copy);
    if (m) copyText(m.text);
  });

  $("#newChatBtn").addEventListener("click", () => {
    const c: Chat = { id: uid(), title: "Нова розмова", messages: [], createdAt: Date.now() };
    chats.unshift(c);
    activeId = c.id;
    save();
    renderChats();
    renderMessages();
    shell.classList.remove("side-open");
    input.focus();
  });

  $("#menuBtn").addEventListener("click", () => shell.classList.toggle("side-open"));
  $("#backdrop").addEventListener("click", () => shell.classList.remove("side-open"));

  $("#clearBtn").addEventListener("click", () => {
    if (!activeChat().messages.length) { toast("Розмова і так порожня"); return; }
    const close = openModal(`
      <div class="modal-head">
        <div class="modal-ico warn">${icons.warn}</div>
        <div>
          <h3>Очистити розмову?</h3>
          <p>Усі повідомлення з «${escapeHtml(activeChat().title)}» буде видалено безповоротно. Соловей, звісно, образиться, але пробачить.</p>
        </div>
        <button class="icon-btn modal-close" data-close title="Закрити">${icons.close}</button>
      </div>
      <div class="modal-actions">
        <button class="mbtn ghost" data-close>Скасувати</button>
        <button class="mbtn danger" id="confirmClear">Очистити</button>
      </div>`);
    $("#confirmClear").addEventListener("click", () => {
      activeChat().messages = [];
      save();
      renderChats();
      renderMessages();
      toast("Розмову очищено");
      close();
    });
  });

  $("#infoBtn").addEventListener("click", () => {
    openModal(`
      <div class="modal-head">
        <div class="modal-ico info" style="color:var(--amber);border-color:rgba(255,180,84,.4);background:rgba(255,180,84,.12)">${icons.bird()}</div>
        <div>
          <h3>Про Солов'я</h3>
          <p>Чат-бот, написаний на чистому HTML, CSS та JavaScript — без жодного фреймворка. Кожна іконка намальована вручну як SVG.</p>
        </div>
        <button class="icon-btn modal-close" data-close title="Закрити">${icons.close}</button>
      </div>
      <ul class="about-list">
        <li>${icons.spark}<span>Жарти, час, погода, пісні та математика — усе в одному птахові</span></li>
        <li>${icons.chat}<span>Кілька розмов із збереженням у localStorage вашого браузера</span></li>
        <li>${icons.note}<span>Звукові сигнали через WebAudio — вимикаються однією кнопкою</span></li>
      </ul>
      <div class="about-ver">v1.0 · HTML + CSS + JS + SVG</div>`);
  });

  const soundBtn = $("#soundBtn");
  soundBtn.addEventListener("click", () => {
    soundOn = !soundOn;
    localStorage.setItem(LS_SOUND, soundOn ? "1" : "0");
    soundBtn.classList.toggle("sound-on", soundOn);
    soundBtn.innerHTML = soundOn ? icons.soundOn : icons.soundOff;
    toast(soundOn ? "Звук увімкнено" : "Звук вимкнено");
    if (soundOn) play("receive");
  });

  /* чіпи-підказки */
  chipsEl.innerHTML = SUGGESTIONS.map(
    (s, i) => `<button class="chip" data-say="${escapeHtml(s.text)}" style="animation-delay:${200 + i * 70}ms">${icons[s.icon]}<span>${escapeHtml(s.text)}</span></button>`
  ).join("");
  chipsEl.addEventListener("click", (e) => {
    const chip = (e.target as HTMLElement).closest<HTMLElement>("[data-say]");
    if (chip) send(chip.dataset.say!);
  });

  /* композер */
  function autosize() {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 132) + "px";
    sendBtn.disabled = !input.value.trim();
  }
  input.addEventListener("input", autosize);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input.value);
    }
  });
  sendBtn.addEventListener("click", () => send(input.value));

  /* емодзі */
  emojiBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    emojiPop.classList.toggle("open");
  });
  emojiPop.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>("[data-e]");
    if (!b) return;
    e.stopPropagation();
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    input.value = input.value.slice(0, start) + b.dataset.e + input.value.slice(end);
    input.selectionStart = input.selectionEnd = start + (b.dataset.e!.length);
    input.focus();
    autosize();
  });
  const closeEmoji = () => emojiPop.classList.remove("open");
  document.addEventListener("click", closeEmoji);

  /* скрол + кнопка «донизу» */
  scroller.addEventListener("scroll", () => {
    const d = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;
    scrolledUp = d > 170;
    if (!scrolledUp) unread = 0;
    updateJump();
  });
  jumpBtn.addEventListener("click", () => {
    unread = 0;
    updateJump();
    scrollBottom(true);
  });

  /* ---------------- старт ---------------- */
  renderChats();
  renderMessages();
  input.focus();

  return () => {
    document.removeEventListener("click", closeEmoji);
    root.innerHTML = "";
  };
}
