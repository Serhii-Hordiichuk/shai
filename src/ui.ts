import { ico } from "./icons";
import { t } from "./i18n";

export function el<T extends HTMLElement>(tag: string, cls?: string, html?: string): T {
  const e = document.createElement(tag) as T;
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

let toastWrap: HTMLElement | null = null;
export function toast(msg: string, kind: "info" | "ok" | "err" = "info"): void {
  if (!toastWrap) {
    toastWrap = el("div", "toast-wrap");
    document.body.appendChild(toastWrap);
  }
  const tn = el("div", `toast toast-${kind}`, `${ico(kind === "err" ? "alert" : kind === "ok" ? "check" : "info")}<span>${msg}</span>`);
  toastWrap.appendChild(tn);
  requestAnimationFrame(() => tn.classList.add("show"));
  setTimeout(() => {
    tn.classList.remove("show");
    setTimeout(() => tn.remove(), 250);
  }, 3400);
}

export class Modal {
  private ov: HTMLElement | null = null;
  onCloseCb?: () => void;
  private onKey = (e: KeyboardEvent) => { if (e.key === "Escape") this.close(); };

  open(opts: { title: string; body: string | HTMLElement; actions?: { label: string; kind?: "primary" | "danger" | "ghost"; onClick?: () => void }[]; onClose?: () => void }): void {
    this.close();
    const ov = el("div", "modal-ov");
    const card = el("div", "modal-card");
    card.innerHTML = `
      <div class="modal-head"><h3>${opts.title}</h3><button class="icon-btn modal-x" title="Close">${ico("close")}</button></div>
      <div class="modal-body"></div>
      <div class="modal-actions"></div>`;
    const body = card.querySelector(".modal-body")!;
    if (typeof opts.body === "string") body.innerHTML = opts.body;
    else body.appendChild(opts.body);
    const actions = card.querySelector(".modal-actions")!;
    for (const a of opts.actions ?? []) {
      const b = el("button", `btn btn-${a.kind ?? "ghost"}`, a.label);
      b.onclick = () => { a.onClick?.(); };
      actions.appendChild(b);
    }
    card.querySelector(".modal-x")!.addEventListener("click", () => this.close());
    ov.addEventListener("click", (e) => { if (e.target === ov) this.close(); });
    ov.appendChild(card);
    document.body.appendChild(ov);
    this.ov = ov;
    this.onCloseCb = opts.onClose;
    requestAnimationFrame(() => ov.classList.add("show"));
    document.addEventListener("keydown", this.onKey);
  }

  close(): void {
    if (!this.ov) return;
    this.ov.classList.remove("show");
    const node = this.ov;
    setTimeout(() => node.remove(), 200);
    this.ov = null;
    document.removeEventListener("keydown", this.onKey);
    this.onCloseCb?.();
  }
}

export const modal = new Modal();

export function confirmDialog(opts: { title: string; text: string; okText?: string; danger?: boolean }): Promise<boolean> {
  return new Promise((resolve) => {
    modal.open({
      title: opts.title,
      body: `<p class="confirm-text">${opts.text}</p>`,
      onClose: () => resolve(false),
      actions: [
        { label: t("Cancel"), kind: "ghost", onClick: () => modal.close() },
        {
          label: t(opts.okText ?? "Confirm"),
          kind: opts.danger ? "danger" : "primary",
          onClick: () => { modal.onCloseCb = undefined; modal.close(); resolve(true); },
        },
      ],
    });
  });
}

export function promptDialog(opts: { title: string; label: string; value?: string; placeholder?: string }): Promise<string | null> {
  return new Promise((resolve) => {
    const wrap = el("div", "prompt-wrap");
    wrap.innerHTML = `<label class="field-label">${t(opts.label)}</label><input class="text-input" value="${(opts.value ?? "").replace(/"/g, "&quot;")}" placeholder="${opts.placeholder ?? ""}" />`;
    const input = wrap.querySelector("input")!;
    modal.open({
      title: t(opts.title),
      body: wrap,
      onClose: () => resolve(null),
      actions: [
        { label: t("Cancel"), kind: "ghost", onClick: () => modal.close() },
        {
          label: t("Save"), kind: "primary",
          onClick: () => { const v = input.value.trim(); modal.onCloseCb = undefined; modal.close(); resolve(v); },
        },
      ],
    });
    setTimeout(() => { input.focus(); input.select(); }, 60);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { const v = input.value.trim(); modal.onCloseCb = undefined; modal.close(); resolve(v); }
    });
  });
}

export function openPopover(anchor: HTMLElement, content: HTMLElement, opts: { align?: "left" | "right"; width?: number; onClose?: () => void } = {}): () => void {
  closePopover();
  const pop = el("div", "dd-menu");
  pop.style.width = opts.width ? `${opts.width}px` : "";
  pop.appendChild(content);
  document.body.appendChild(pop);
  const rect = anchor.getBoundingClientRect();
  pop.style.top = `${rect.bottom + 8}px`;
  if (opts.align === "right") pop.style.right = `${Math.max(8, innerWidth - rect.right)}px`;
  else pop.style.left = `${Math.max(8, Math.min(rect.left, innerWidth - 340))}px`;
  pop.classList.add("show");

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    pop.classList.remove("show");
    setTimeout(() => pop.remove(), 160);
    document.removeEventListener("mousedown", onDown, true);
    document.removeEventListener("keydown", onKey);
    opts.onClose?.();
  };
  const onDown = (e: MouseEvent) => {
    const tg = e.target as Node;
    if (!pop.contains(tg) && !anchor.contains(tg)) close();
  };
  const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
  setTimeout(() => {
    document.addEventListener("mousedown", onDown, true);
    document.addEventListener("keydown", onKey);
  }, 0);
  (pop as any)._close = close;
  return close;
}

export function closePopover(): void {
  document.querySelectorAll(".dd-menu").forEach((n) => (n as any)._close?.());
}

export function switchEl(checked: boolean, onChange: (v: boolean) => void): HTMLElement {
  const sw = el("button", `sw${checked ? " on" : ""}`);
  sw.setAttribute("role", "switch");
  sw.setAttribute("aria-checked", String(checked));
  sw.innerHTML = `<span class="sw-thumb"></span>`;
  sw.addEventListener("click", () => {
    const next = !sw.classList.contains("on");
    sw.classList.toggle("on", next);
    sw.setAttribute("aria-checked", String(next));
    onChange(next);
  });
  return sw;
}

export function rangeEl(opts: { min: number; max: number; step: number; value: number; fmt?: (v: number) => string; onChange: (v: number) => void }): HTMLElement {
  const wrap = el("div", "range-wrap");
  const out = el("output", "range-out", opts.fmt ? opts.fmt(opts.value) : String(opts.value));
  const input = el("input") as HTMLInputElement;
  input.type = "range";
  input.min = String(opts.min);
  input.max = String(opts.max);
  input.step = String(opts.step);
  input.value = String(opts.value);
  const paint = () => {
    const p = ((+input.value - opts.min) / (opts.max - opts.min)) * 100;
    input.style.setProperty("--p", `${p}%`);
  };
  paint();
  input.addEventListener("input", () => {
    paint();
    out.textContent = opts.fmt ? opts.fmt(+input.value) : input.value;
    opts.onChange(+input.value);
  });
  wrap.append(input, out);
  return wrap;
}
