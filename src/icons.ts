/* Всі іконки — власноруч намальовані inline-SVG (stroke = currentColor) */

type P = { s?: number; sw?: number; cls?: string };
const w = (p: P, inner: string, vb = 24) =>
  `<svg class="${p.cls || ""}" width="${p.s || 20}" height="${p.s || 20}" viewBox="0 0 ${vb} ${vb}" fill="none" stroke="currentColor" stroke-width="${p.sw || 1.8}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;

export const iLogo = (p: P = {}) =>
  w(p, `<path d="M14.6 3.2c3.4 0 5.6 2.2 5.9 5l2.7 1.2-2.7 1.4c-.6 3.7-4.2 6.2-8.4 6.2H7l3.6-3.4c-2-1.7-2.3-4.9-.3-7.1 1.6-1.9 3.4-3.3 4.3-3.3Z"/><circle cx="17.2" cy="7.4" r=".9" fill="currentColor" stroke="none"/><path d="M3 20.8c2.6-2 5.4-2 8 0s5.4 2 8 0"/>`, 24);

export const iSend = (p: P = {}) =>
  w(p, `<path d="M4.4 11.2 19 4.6c.7-.3 1.4.4 1.1 1.1l-6.6 14.6c-.3.7-1.4.7-1.6-.1l-1.5-5a.9.9 0 0 0-.6-.6l-5-1.5c-.8-.2-.8-1.3-.4-1.9Z"/><path d="m10.4 13.6 3.4-3.4"/>`);

export const iStop = (p: P = {}) =>
  w(p, `<rect x="6.5" y="6.5" width="11" height="11" rx="2.4" fill="currentColor" stroke="none"/>`);

export const iPlus = (p: P = {}) => w(p, `<path d="M12 5v14M5 12h14"/>`);

export const iTrash = (p: P = {}) =>
  w(p, `<path d="M4.5 6.8h15M9.5 4h5M6.3 6.8l.8 12.4c.1 1 .9 1.8 2 1.8h5.8c1.1 0 1.9-.8 2-1.8l.8-12.4"/><path d="M10 10.6v6M14 10.6v6"/>`);

export const iCopy = (p: P = {}) =>
  w(p, `<rect x="8.6" y="8.6" width="11" height="11" rx="2.4"/><path d="M5.6 14.8c-.9 0-1.6-.7-1.6-1.6V6c0-.9.7-1.6 1.6-1.6h7.2c.9 0 1.6.7 1.6 1.6"/>`);

export const iCheck = (p: P = {}) => w(p, `<path d="m5 12.8 4.4 4.4L19 7.4"/>`);

export const iGear = (p: P = {}) =>
  w(p, `<circle cx="12" cy="12" r="3.1"/><path d="M12 3.2v2.1M12 18.7v2.1M3.2 12h2.1M18.7 12h2.1M5.8 5.8l1.5 1.5M16.7 16.7l1.5 1.5M18.2 5.8l-1.5 1.5M7.3 16.7l-1.5 1.5"/>`);

export const iMic = (p: P = {}) =>
  w(p, `<rect x="9.2" y="3.4" width="5.6" height="10.4" rx="2.8"/><path d="M6 11.4c0 3.3 2.7 6 6 6s6-2.7 6-6M12 17.4v3.2"/>`);

export const iClip = (p: P = {}) =>
  w(p, `<path d="m19.6 11.2-7.4 7.4a5 5 0 0 1-7-7l7.7-7.7a3.4 3.4 0 0 1 4.9 4.9l-7.8 7.7a1.9 1.9 0 0 1-2.6-2.6l7-7"/>`);

export const iImage = (p: P = {}) =>
  w(p, `<rect x="3.6" y="4.6" width="16.8" height="14.8" rx="2.6"/><circle cx="9" cy="9.6" r="1.5"/><path d="m4.6 16.6 4.5-4.2 3.4 3.1 3.2-2.8 3.7 3.5"/>`);

export const iChevD = (p: P = {}) => w(p, `<path d="m6 9.5 6 6 6-6"/>`);

export const iX = (p: P = {}) => w(p, `<path d="M6.2 6.2l11.6 11.6M17.8 6.2 6.2 17.8"/>`);

export const iInfo = (p: P = {}) =>
  w(p, `<circle cx="12" cy="12" r="8.6"/><path d="M12 11v5"/><circle cx="12" cy="7.8" r=".9" fill="currentColor" stroke="none"/>`);

export const iSpark = (p: P = {}) =>
  w(p, `<path d="M12 3.6c.5 3.9 2 5.5 6 6-4 .5-5.5 2.1-6 6-.5-3.9-2-5.5-6-6 4-.5 5.5-2.1 6-6Z"/><path d="M18.8 15.4c.3 1.8 1 2.5 2.6 2.8-1.6.3-2.3 1-2.6 2.8-.3-1.8-1-2.5-2.6-2.8 1.6-.3 2.3-1 2.6-2.8Z"/>`);

export const iHeart = (p: P = {}) =>
  w(p, `<path d="M12 19.6s-7.2-4.4-7.2-9.4c0-2.5 2-4.4 4.4-4.4 1.7 0 3 .9 3.8 2 .8-1.1 2.1-2 3.8-2 2.4 0 4.4 1.9 4.4 4.4 0 5-7.2 9.4-7.2 9.4Z"/>`);

export const iKey = (p: P = {}) =>
  w(p, `<circle cx="8" cy="14.4" r="4.2"/><path d="m11.2 11.2 8.2-8.2M16.4 6l2.4 2.4M13.8 8.6l2 2"/>`);

export const iDownload = (p: P = {}) =>
  w(p, `<path d="M12 4v10.4M7.6 10.4 12 14.8l4.4-4.4M4.6 18.6h14.8"/>`);

export const iEye = (p: P = {}) =>
  w(p, `<path d="M3 12s3.4-5.8 9-5.8S21 12 21 12s-3.4 5.8-9 5.8S3 12 3 12Z"/><circle cx="12" cy="12" r="2.6"/>`);

export const iEyeOff = (p: P = {}) =>
  w(p, `<path d="M4.6 4.6l14.8 14.8M9.6 6.3A9.6 9.6 0 0 1 12 6.2c5.6 0 9 5.8 9 5.8a16.6 16.6 0 0 1-3 3.4M6.2 8.3A15.4 15.4 0 0 0 3 12s3.4 5.8 9 5.8c1 0 2-.2 2.9-.5"/><path d="M10.2 10.4a2.6 2.6 0 0 0 3.5 3.5"/>`);

export const iCpu = (p: P = {}) =>
  w(p, `<rect x="6.6" y="6.6" width="10.8" height="10.8" rx="2"/><rect x="10" y="10" width="4" height="4" rx="1"/><path d="M9.4 3.4v3.2M14.6 3.4v3.2M9.4 17.4v3.2M14.6 17.4v3.2M3.4 9.4h3.2M3.4 14.6h3.2M17.4 9.4h3.2M17.4 14.6h3.2"/>`);

export const iCloud = (p: P = {}) =>
  w(p, `<path d="M7.2 17.6a4.2 4.2 0 0 1-.6-8.3 5.4 5.4 0 0 1 10.6 1.2 3.5 3.5 0 0 1-.9 6.9H7.2Z"/>`);

export const iBolt = (p: P = {}) =>
  w(p, `<path d="M12.8 3.4 5.6 13.2h4.6l-1 7.4 7.2-9.8h-4.6l1-7.4Z"/>`);

export const iLock = (p: P = {}) =>
  w(p, `<rect x="5.6" y="10.4" width="12.8" height="9.6" rx="2.4"/><path d="M8.6 10.4V8a3.4 3.4 0 0 1 6.8 0v2.4"/><circle cx="12" cy="15" r="1" fill="currentColor" stroke="none"/>`);

export const iRefresh = (p: P = {}) =>
  w(p, `<path d="M4.8 12a7.2 7.2 0 0 1 12.4-5l2.2 2.2M19.4 4.6v4.6h-4.6M19.2 12a7.2 7.2 0 0 1-12.4 5l-2.2-2.2M4.6 19.4v-4.6h4.6"/>`);

export const iSound = (p: P = {}) =>
  w(p, `<path d="M4.6 9.4v5.2h3.2L12.4 19V5L7.8 9.4H4.6Z"/><path d="M15.4 9a4.3 4.3 0 0 1 0 6M17.8 6.8a7.6 7.6 0 0 1 0 10.4"/>`);

export const iSoundOff = (p: P = {}) =>
  w(p, `<path d="M4.6 9.4v5.2h3.2L12.4 19V5L7.8 9.4H4.6Z"/><path d="m15.6 9.8 4.4 4.4M20 9.8l-4.4 4.4"/>`);

export const iMenu = (p: P = {}) => w(p, `<path d="M4 7h16M4 12h16M4 17h16"/>`);

export const iWave = (p: P = {}) =>
  w(p, `<path d="M4 12h2.2l2-5 3 10 2.6-8 1.8 3H20"/>`);

export const iGlobe = (p: P = {}) =>
  w(p, `<circle cx="12" cy="12" r="8.6"/><path d="M3.4 12h17.2M12 3.4c2.6 2.3 3.9 5.2 3.9 8.6s-1.3 6.3-3.9 8.6c-2.6-2.3-3.9-5.2-3.9-8.6s1.3-6.3 3.9-8.6Z"/>`);

export const iDoc = (p: P = {}) =>
  w(p, `<path d="M6 3.8h8l4 4v12.4H6z"/><path d="M14 3.8v4h4M9 12.4h6M9 15.6h6"/>`);

/* Логотип-марка у квадраті (для аватара бота) */
export const avatarMark = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13.6 4.6c2.8 0 4.6 1.8 4.9 4.1l2.3 1-2.3 1.2c-.5 3-3.4 5.1-6.9 5.1H7.9l3-2.8c-1.7-1.4-1.9-4-.3-5.9 1.3-1.5 2.4-2.7 3-2.7Z"/><circle cx="15.9" cy="8.1" r=".8" fill="currentColor" stroke="none"/></svg>`;
