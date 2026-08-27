/* Кастомні SVG-елементи, намальовані вручну (stroke 1.8, round caps) */

const S = (inner: string, vb = "0 0 24 24") =>
  `<svg viewBox="${vb}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;

export const icons = {
  bird: (cls = "") => `
    <svg class="${cls}" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M30 12c6 0 10 4 10.5 9L46 23l-5.5 2.5c-1 6.5-7.5 11-15 11H12l7-6.5c-3.5-3-4-8.5-.5-12.5C21.5 14 26 12 30 12Z" fill="rgba(255,180,84,0.12)"/>
      <circle cx="34" cy="20" r="1.9" fill="currentColor" stroke="none"/>
      <path d="M23 23c4-1 7 2 6.4 6.2"/>
      <path d="M24 36.5V41M30 36.5V41"/>
      <path d="M7 41c12-1.4 24-1.4 36-1"/>
      <path d="M13 38.5c-2-3.5-6-4-7.5-2 1.5 2.8 5 3.4 7.5 2Z" fill="rgba(67,221,176,0.25)"/>
    </svg>`,

  birdBig: () => `
    <svg viewBox="0 0 120 120" fill="none" aria-hidden="true">
      <circle cx="60" cy="60" r="56" stroke="rgba(67,221,176,0.25)" stroke-width="1.5" stroke-dasharray="3 7" stroke-linecap="round"/>
      <circle cx="60" cy="60" r="44" fill="rgba(18,51,64,0.5)" stroke="rgba(255,180,84,0.35)" stroke-width="1.5"/>
      <g stroke="#ffb454" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
        <path d="M66 40c9 0 15 6 15.7 13.5L90 57l-8.3 3.7C80.3 70.5 70.5 77 59 77H38l10.5-9.7C43.2 62.8 42.5 54.5 47.7 48.5 52.2 43 59 40 66 40Z" fill="rgba(255,180,84,0.12)"/>
        <path d="M55.5 55.7c6-1.5 10.5 3 9.6 9.3"/>
        <path d="M57 77v6M66 77v6"/>
        <path d="M32 83c18-2 36-2 54-1.5"/>
      </g>
      <circle cx="72" cy="52" r="2.6" fill="#ffb454"/>
      <path d="M41 79.5c-3-5.2-9-6-11.2-3 2.2 4.2 7.5 5.1 11.2 3Z" fill="rgba(67,221,176,0.3)" stroke="#43ddb0" stroke-width="1.8" stroke-linejoin="round"/>
      <g stroke="#43ddb0" stroke-width="2" stroke-linecap="round" opacity="0.8">
        <path d="M97 34l2.4 5 5 2.4-5 2.4-2.4 5-2.4-5-5-2.4 5-2.4 2.4-5Z" fill="rgba(67,221,176,0.15)"/>
        <path d="M24 30v6M21 33h6"/>
      </g>
      <circle cx="93" cy="74" r="2.2" fill="#ff7a6b"/>
    </svg>`,

  feather: (color = "#43ddb0") => `
    <svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M19.5 4.5C13 6 7.5 12 6 18.5c5.5-1 11-5.5 13.5-14Z" fill="${color}22"/>
      <path d="M5 20 18 6"/>
      <path d="M9.5 15.5H14M12 12.5h4M14.5 9.5h3.5"/>
    </svg>`,

  send: S(`<path d="M4 12.5 20 4.5l-5.5 15.5-3.2-6.3L4 12.5Z"/><path d="M11.3 13.7 20 4.5"/>`),
  plus: S(`<path d="M12 5v14M5 12h14"/>`),
  trash: S(`<path d="M4.5 7h15M9.5 7V5h5v2M6.5 7l1 13h9l1-13M10 11v6M14 11v6"/>`),
  menu: S(`<path d="M4 7h16M4 12h10M4 17h16"/>`),
  close: S(`<path d="M6 6l12 12M18 6 6 18"/>`),
  checks: S(`<path d="M2.5 13.2l3.6 3.6L14 9"/><path d="M9.5 13.5l3.3 3.3L21.5 8"/>`),
  copy: S(`<rect x="9" y="9" width="11" height="11" rx="2.5"/><path d="M5.5 14.5h-1a1.5 1.5 0 0 1-1.5-1.5V5a2 2 0 0 1 2-2h8a1.5 1.5 0 0 1 1.5 1.5v1"/>`),
  soundOn: S(`<path d="M4 10v4h3l4.5 3.5v-11L7 10H4Z" fill="currentColor" fill-opacity="0.15"/><path d="M15 9.3c1.6 1.5 1.6 3.9 0 5.4M17.8 6.8c3 2.8 3 7.6 0 10.4"/>`),
  soundOff: S(`<path d="M4 10v4h3l4.5 3.5v-11L7 10H4Z" fill="currentColor" fill-opacity="0.15"/><path d="M15.5 10l5 4.5M20.5 10l-5 4.5"/>`),
  spark: S(`<path d="M12 3.5 13.9 10l6.6 2-6.6 2L12 20.5 10.1 14l-6.6-2 6.6-2L12 3.5Z"/>`),
  smile: S(`<circle cx="12" cy="12" r="8.5"/><path d="M8.7 14.2c.9 1.1 2 1.7 3.3 1.7s2.4-.6 3.3-1.7"/><path d="M9.2 9.6h.01M14.8 9.6h.01" stroke-width="2.6"/>`),
  info: S(`<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 7.8h.01" stroke-width="2.4"/>`),
  warn: S(`<path d="M12 4 2.8 19.5h18.4L12 4Z"/><path d="M12 10v4.2M12 17h.01" stroke-width="2.4"/>`),
  arrowDown: S(`<path d="M12 5v14M6 13l6 6 6-6"/>`),
  heart: S(`<path d="M12 20s-7.5-4.6-9-9.3C2 7.6 4 5 6.8 5c2 0 3.6 1.2 5.2 3.4C13.6 6.2 15.2 5 17.2 5 20 5 22 7.6 21 10.7c-1.5 4.7-9 9.3-9 9.3Z" fill="currentColor" fill-opacity="0.25"/>`),
  note: S(`<path d="M9 18.5V6.5l9-2.5v12"/><circle cx="6.5" cy="18.5" r="2.5"/><circle cx="15.5" cy="16" r="2.5"/>`),
  calc: S(`<rect x="5" y="3.5" width="14" height="17" rx="2.5"/><path d="M8.5 7.5h7M8.5 12h.01M12 12h.01M15.5 12h.01M8.5 15.5h.01M12 15.5h.01M15.5 15.5h7" /><path d="M15.5 15.5h.01"/>`),
  clock: S(`<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>`),
  chat: S(`<path d="M20 12c0 4.4-3.6 8-8 8-1 0-2-.2-2.9-.5L4 21l1.6-4.4C4.6 15.2 4 13.7 4 12c0-4.4 3.6-8 8-8s8 3.6 8 8Z"/><path d="M8.5 10.5h7M8.5 13.5h4.5"/>`),
};

/* Хвилі-еквалайзер для амбієнтного фону */
export function wavesHTML(): string {
  const bars = Array.from({ length: 42 }, (_, i) => {
    const h = 18 + Math.round(46 * Math.abs(Math.sin(i * 0.55)));
    return `<span class="wbar" style="height:${h}px;animation-delay:${(i % 9) * 0.22}s;animation-duration:${2 + (i % 5) * 0.4}s"></span>`;
  }).join("");
  return `<div class="waves" aria-hidden="true">${bars}</div>`;
}

/* Пір'їни для амбієнтного фону */
export function feathersHTML(): string {
  const colors = ["#43ddb0", "#ffb454", "#ff7a6b", "#43ddb0", "#ffb454"];
  return (
    `<div class="ambient" aria-hidden="true">` +
    colors.map((c, i) => `<div class="feather f${i + 1}">${icons.feather(c)}</div>`).join("") +
    wavesHTML() +
    `</div>`
  );
}
