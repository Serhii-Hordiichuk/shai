/* ============================================================
   CallManager — голосові та відеодзвінки у стилі Telegram.
   Web Audio (хвилі + barge-in), Web Speech STT → API → TTS.
   ============================================================ */
import { ico } from "./icons";
import { el } from "./ui";

export interface CallLine { who: "me" | "ai"; text: string }

export interface CallDeps {
  sttLang: string;
  ttsVoice: string;
  ttsRate: number;
  bargeIn: boolean;
  getReply: (text: string) => Promise<string>;
  onEnd: (lines: CallLine[], sec: number, kind: "audio" | "video") => void;
  onError: (msg: string) => void;
}

const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60).toString().padStart(2, "0");
  const s = Math.floor(sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export class CallManager {
  private overlay: HTMLElement | null = null;
  private stream: MediaStream | null = null;
  private ac: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private rec: any = null;
  private kind: "audio" | "video" = "audio";
  private state: "connecting" | "active" | "closed" = "connecting";
  private startedAt = 0;
  private timerInt = 0;
  private raf = 0;
  private lines: CallLine[] = [];
  private speaking = false;
  private micOn = true;
  private camOn = true;
  private busy = false;
  private loudFrames = 0;
  private talkAmp = 0;
  private phase = 0;
  private canvas: HTMLCanvasElement | null = null;
  private ringBuf: Uint8Array | null = null;
  private captionEl: HTMLElement | null = null;
  private statusEl: HTMLElement | null = null;
  private videoEl: HTMLVideoElement | null = null;
  private destroyed = false;

  constructor(private deps: CallDeps) {}

  async start(kind: "audio" | "video"): Promise<void> {
    this.kind = kind;
    this.buildOverlay();
    this.setStatus("З'єднання…");
    this.ringBeep();
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: kind === "video" ? { width: 640, height: 480 } : false,
      });
      if (this.destroyed) { this.stopTracks(); return; }
      this.activate();
    } catch (e: any) {
      this.setStatus("Немає доступу до мікрофона");
      this.showError(e?.name === "NotAllowedError"
        ? "Браузер заблокував мікрофон. Дозвольте доступ у налаштуваннях сайту й повторіть."
        : "Не вдалося отримати мікрофон. Перевірте, чи під'єднаний пристрій.");
    }
  }

  private buildOverlay(): void {
    this.end(false);
    const ov = el("div", "call-overlay");
    ov.innerHTML = `
      <div class="call-bg"></div>
      <div class="call-card">
        <div class="call-stage">
          <div class="call-remote">
            <div class="avatar-wrap"><canvas class="avatar-canvas"></canvas></div>
            <div class="call-name">Studio AI</div>
            <div class="call-status">З'єднання…</div>
            <div class="call-caption"><span class="cap-who"></span><span class="cap-text"></span></div>
          </div>
          <video class="call-local" muted playsinline ${this.kind === "audio" ? "hidden" : ""}></video>
        </div>
        <div class="call-controls">
          <button class="call-btn" data-act="mic" title="Мікрофон">${ico("mic")}</button>
          ${this.kind === "video" ? `<button class="call-btn" data-act="cam" title="Камера">${ico("video")}</button>` : ""}
          <button class="call-btn call-end" data-act="end" title="Завершити">${ico("phoneEnd")}</button>
        </div>
        <div class="call-hint">${SR ? "Говоріть — асистент почує і відповість голосом" : "Web Speech API недоступний у цьому браузері — спробуйте Chrome"}</div>
      </div>`;
    document.body.appendChild(ov);
    requestAnimationFrame(() => ov.classList.add("show"));
    this.overlay = ov;
    this.statusEl = ov.querySelector(".call-status");
    this.captionEl = ov.querySelector(".call-caption");
    this.canvas = ov.querySelector(".avatar-canvas");
    const video = ov.querySelector("video")!;
    this.videoEl = video;
    ov.querySelector(".call-controls")!.addEventListener("click", (e) => {
      const btn = (e.target as HTMLElement).closest("button");
      const act = btn?.getAttribute("data-act");
      if (act === "mic") this.toggleMic(btn!);
      else if (act === "cam") this.toggleCam(btn!);
      else if (act === "end") this.end(true);
    });
  }

  private activate(): void {
    this.state = "active";
    this.startedAt = Date.now();
    // Web Audio: аналізатор мікрофона
    this.ac = new AudioContext();
    const src = this.ac.createMediaStreamSource(this.stream!);
    this.analyser = this.ac.createAnalyser();
    this.analyser.fftSize = 256;
    this.ringBuf = new Uint8Array(this.analyser.frequencyBinCount);
    src.connect(this.analyser);

    if (this.kind === "video" && this.videoEl) {
      this.videoEl.srcObject = this.stream;
      this.videoEl.play().catch(() => {});
    }
    // таймер
    const timerEl = this.statusEl!;
    this.timerInt = window.setInterval(() => {
      if (this.state === "active" && !this.busy && !this.speaking) {
        timerEl.textContent = fmtTime((Date.now() - this.startedAt) / 1000);
      }
    }, 500);
    timerEl.textContent = "00:00";

    if (SR) this.startSTT();
    this.loop();
    this.setCaption("ai", "Привіт! Я на зв'язку — говоріть.");
    void this.speak("Привіт! Я на зв'язку. Чим можу допомогти?");
  }

  /* ---------- STT ---------- */
  private startSTT(): void {
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = this.deps.sttLang;
    let finalChunk = "";
    rec.onresult = (e: any) => {
      let interim = "";
      let final = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) final += r[0].transcript;
        else interim += r[0].transcript;
      }
      if (interim) this.setCaption("me", interim, true);
      if (final.trim()) {
        finalChunk += final;
        clearTimeout((this as any)._ft);
        (this as any)._ft = setTimeout(() => {
          const text = finalChunk.trim();
          finalChunk = "";
          if (text) void this.onUserSpeech(text);
        }, 400);
      }
    };
    rec.onerror = (e: any) => {
      if (e.error === "not-allowed") this.setStatus("Мікрофон заблоковано");
    };
    rec.onend = () => {
      if (this.state === "active" && !this.destroyed) {
        try { rec.start(); } catch { /* already started */ }
      }
    };
    try { rec.start(); } catch { /* noop */ }
    this.rec = rec;
  }

  private async onUserSpeech(text: string): Promise<void> {
    if (this.speaking) this.stopSpeaking(); // barge-in за фактом репліки
    this.setCaption("me", text);
    this.lines.push({ who: "me", text });
    this.busy = true;
    this.setStatus("Асистент думає…");
    try {
      const reply = await this.deps.getReply(text);
      if (this.destroyed) return;
      this.lines.push({ who: "ai", text: reply });
      this.setCaption("ai", reply.length > 140 ? reply.slice(0, 137) + "…" : reply);
      this.setStatus("Говорить асистент…");
      await this.speak(reply);
    } catch (e: any) {
      this.setCaption("ai", "Вибачте, не почув відповідь. Спробуйте ще раз.");
    } finally {
      this.busy = false;
      if (this.state === "active") this.setStatus(fmtTime((Date.now() - this.startedAt) / 1000));
    }
  }

  /* ---------- TTS ---------- */
  private speak(text: string): Promise<void> {
    return new Promise((resolve) => {
      const synth = window.speechSynthesis;
      if (!synth || this.destroyed) { resolve(); return; }
      synth.cancel();
      const plain = text.replace(/[*_`#>\[\]()]/g, "").replace(/\n+/g, ". ").slice(0, 600);
      const u = new SpeechSynthesisUtterance(plain);
      u.lang = "uk-UA";
      u.rate = this.deps.ttsRate;
      const voices = synth.getVoices();
      const v = voices.find((x) => x.name === this.deps.ttsVoice) ?? voices.find((x) => x.lang.startsWith("uk"));
      if (v) u.voice = v;
      u.onstart = () => { this.speaking = true; };
      const done = () => {
        this.speaking = false;
        this.talkAmp = 0;
        resolve();
      };
      u.onend = done;
      u.onerror = done;
      synth.speak(u);
    });
  }

  private stopSpeaking(): void {
    try { window.speechSynthesis.cancel(); } catch { /* noop */ }
    this.speaking = false;
  }

  /* ---------- Анімація аватара + barge-in ---------- */
  private loop = (): void => {
    if (this.destroyed) return;
    this.raf = requestAnimationFrame(this.loop);
    this.phase += 0.02;

    // barge-in: аналіз амплітуди мікрофона під час мовлення ШІ
    if (this.analyser && this.ringBuf) {
      this.analyser.getByteFrequencyData(this.ringBuf as unknown as Uint8Array<ArrayBuffer>);
      let sum = 0;
      for (let i = 2; i < this.ringBuf.length; i++) sum += this.ringBuf[i];
      const level = sum / (this.ringBuf.length * 255);
      if (this.speaking && this.deps.bargeIn && this.micOn) {
        this.loudFrames = level > 0.16 ? this.loudFrames + 1 : 0;
        if (this.loudFrames > 10) {
          this.loudFrames = 0;
          this.stopSpeaking();
          this.setCaption("me", "…(перервано)", true);
        }
      }
      this.userLevel = level;
    }
    // псевдо-амплітуда голосу ШІ (синхронізована з TTS)
    this.talkAmp += ((this.speaking ? 0.35 + Math.abs(Math.sin(this.phase * 3.1)) * 0.5 : 0) - this.talkAmp) * 0.12;
    this.drawAvatar();
  };
  private userLevel = 0;

  private drawAvatar(): void {
    const cv = this.canvas;
    if (!cv) return;
    const dpr = window.devicePixelRatio || 1;
    const size = cv.clientWidth || 220;
    if (cv.width !== size * dpr) { cv.width = size * dpr; cv.height = size * dpr; }
    const g = cv.getContext("2d");
    if (!g) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, size, size);
    const cx = size / 2, cy = size / 2;
    const R = size / 2 - 26;
    const dark = document.documentElement.dataset.theme === "dark";

    // зовнішнє кільце — спектр мікрофона користувача
    const bars = 56;
    for (let i = 0; i < bars; i++) {
      const a = (i / bars) * Math.PI * 2 - Math.PI / 2;
      const freq = this.ringBuf ? this.ringBuf[2 + Math.floor((i / bars) * (this.ringBuf.length - 10))] / 255 : 0;
      const len = 4 + freq * 22 + Math.sin(this.phase * 2 + i) * 1.5;
      const x1 = cx + Math.cos(a) * (R + 6);
      const y1 = cy + Math.sin(a) * (R + 6);
      const x2 = cx + Math.cos(a) * (R + 6 + len);
      const y2 = cy + Math.sin(a) * (R + 6 + len);
      g.strokeStyle = `rgba(45, 181, 158, ${0.25 + freq * 0.75})`;
      g.lineWidth = 2.4;
      g.lineCap = "round";
      g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
    }
    // пульсуючі кільця стану
    for (let k = 0; k < 3; k++) {
      const p = (this.phase * 0.5 + k / 3) % 1;
      g.strokeStyle = `rgba(97, 92, 237, ${(1 - p) * 0.35})`;
      g.lineWidth = 1.5;
      g.beginPath();
      g.arc(cx, cy, 40 + p * (R - 34), 0, Math.PI * 2);
      g.stroke();
    }
    // ядро-аватар (lip-sync: scale від talkAmp)
    const r = 42 + this.talkAmp * 16;
    const grad = g.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.2, cx, cy, r);
    grad.addColorStop(0, "#8b86ff");
    grad.addColorStop(1, "#4a44c9");
    g.fillStyle = grad;
    g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
    // «очі»
    const blink = Math.sin(this.phase * 0.7) > 0.985 ? 0.15 : 1;
    g.fillStyle = "rgba(255,255,255,0.92)";
    g.beginPath(); g.ellipse(cx - 13, cy - 6, 4.5, 4.5 * blink, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(cx + 13, cy - 6, 4.5, 4.5 * blink, 0, 0, Math.PI * 2); g.fill();
    // «рот» — дуга, що розкривається під час мовлення
    g.strokeStyle = "rgba(255,255,255,0.92)";
    g.lineWidth = 3;
    g.lineCap = "round";
    g.beginPath();
    const open = 2 + this.talkAmp * 12;
    g.ellipse(cx, cy + 14, 11, open, 0, 0.15 * Math.PI, 0.85 * Math.PI);
    g.stroke();
    // індикатор «думає»
    if (this.busy) {
      for (let d = 0; d < 3; d++) {
        const dy = Math.sin(this.phase * 6 + d) * 3;
        g.fillStyle = "rgba(255,255,255,0.85)";
        g.beginPath(); g.arc(cx - 10 + d * 10, cy + 34 + dy, 2.4, 0, Math.PI * 2); g.fill();
      }
    }
  }

  /* ---------- Керування ---------- */
  private toggleMic(btn: HTMLElement): void {
    this.micOn = !this.micOn;
    this.stream?.getAudioTracks().forEach((t) => (t.enabled = this.micOn));
    btn.classList.toggle("off", !this.micOn);
    btn.innerHTML = ico(this.micOn ? "mic" : "micOff");
    this.setStatus(this.micOn ? fmtTime((Date.now() - this.startedAt) / 1000) : "Мікрофон вимкнено");
  }

  private toggleCam(btn: HTMLElement): void {
    this.camOn = !this.camOn;
    this.stream?.getVideoTracks().forEach((t) => (t.enabled = this.camOn));
    btn.classList.toggle("off", !this.camOn);
    btn.innerHTML = ico(this.camOn ? "video" : "videoOff");
    if (this.videoEl) this.videoEl.hidden = !this.camOn || this.kind !== "video";
  }

  private setStatus(t: string): void { if (this.statusEl) this.statusEl.textContent = t; }
  private setCaption(who: "me" | "ai", text: string, interim = false): void {
    if (!this.captionEl) return;
    this.captionEl.classList.add("show");
    this.captionEl.classList.toggle("interim", interim);
    this.captionEl.querySelector(".cap-who")!.textContent = who === "me" ? "Ви" : "AI";
    this.captionEl.querySelector(".cap-text")!.textContent = text;
  }

  private showError(msg: string): void {
    this.setStatus("Помилка");
    this.deps.onError(msg);
  }

  private ringBeep(): void {
    try {
      const ac = new AudioContext();
      const now = ac.currentTime;
      for (let i = 0; i < 2; i++) {
        const o = ac.createOscillator();
        const g = ac.createGain();
        o.frequency.value = 440 + i * 120;
        o.type = "sine";
        g.gain.setValueAtTime(0.0001, now + i * 0.5);
        g.gain.exponentialRampToValueAtTime(0.06, now + i * 0.5 + 0.05);
        g.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.5 + 0.4);
        o.connect(g).connect(ac.destination);
        o.start(now + i * 0.5); o.stop(now + i * 0.5 + 0.45);
      }
      setTimeout(() => ac.close(), 1600);
    } catch { /* noop */ }
  }

  private stopTracks(): void {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
  }

  end(log: boolean): void {
    if (this.destroyed && !log) return;
    if (!this.overlay && !this.startedAt) return; // свіжий екземпляр — немає чого завершувати
    const sec = this.startedAt ? (Date.now() - this.startedAt) / 1000 : 0;
    const lines = this.lines;
    const kind = this.kind;
    this.destroyed = true;
    this.state = "closed";
    cancelAnimationFrame(this.raf);
    clearInterval(this.timerInt);
    try { this.rec?.stop(); } catch { /* noop */ }
    this.stopSpeaking();
    this.stopTracks();
    try { this.ac?.close(); } catch { /* noop */ }
    if (this.overlay) {
      const node = this.overlay;
      node.classList.remove("show");
      setTimeout(() => node.remove(), 250);
      this.overlay = null;
    }
    if (log && lines.length) this.deps.onEnd(lines, sec, kind);
  }
}

/* ---------- Швидка диктовка в композер ---------- */
export function dictate(
  lang: string,
  onText: (text: string, isFinal: boolean) => void,
  onDone: () => void
): (() => void) | null {
  if (!SR) return null;
  const rec = new SR();
  rec.continuous = false;
  rec.interimResults = true;
  rec.lang = lang;
  rec.onresult = (e: any) => {
    let text = "";
    let final = false;
    for (let i = 0; i < e.results.length; i++) {
      text += e.results[i][0].transcript;
      if (e.results[i].isFinal) final = true;
    }
    onText(text, final);
  };
  rec.onend = onDone;
  rec.onerror = onDone;
  try { rec.start(); } catch { onDone(); }
  return () => { try { rec.stop(); } catch { /* noop */ } };
}
