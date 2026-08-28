# 🛠 Скіли та технології

Де і як застосовано кожен скіл у проєкті — шпаргалка для співрозробників і рев'ю.

---

## Frontend

| Скіл | Застосування |
|---|---|
| **HTML5** | Семантична розмітка, `<aside>/<nav>/<main>`, атрибути `role="switch"`, `aria-checked`, sandbox-iframe для артефактів |
| **CSS3, змінні, theming** | Дизайн-система light/dark на `--*` змінних; `color-mix()`, `clamp()`, `min()`, `env(safe-area-inset-*)`, `100dvh`, `backdrop-filter`, `grid-template-columns` з анімацією |
| **CSS-анімації** | `@keyframes` (fadeUp, pulse, dotJump, micPulse, spin, floaty), cubic-bezier-переходи drawer'ів, bottom-sheet трансформації |
| **Responsive** | Fluid-типографіка через `clamp()`, брейкпоінти 380/460/560/640/920/1180px, `pointer: coarse`, орієнтація-запити |
| **Vanilla JS (ES6+)** | Класи, Proxy/Reflect, AsyncGenerator, AbortController, делегування подій, ES Modules, Web Components-патерни без бібліотек |
| **TypeScript** | `strict`-режим, уніони подій (`StreamEvent`), дженеріки (`Store<T>`, `IDB`), сумісність з marked v15 renderer API |
| **Web Speech API** | Continuous STT у дзвінках і диктовці, TTS з вибором системного голосу |
| **Web Audio API** | AnalyserNode (barge-in + спектр аватара), осциляторні сигнали UI/дзвінка |
| **Canvas 2D** | Аватар ШІ: спектральне кільце, lip-sync, моргання, пульс-кільця |
| **getUserMedia** | Мікрофон + камера для дзвінків, mute через `track.enabled` |
| **IndexedDB** | Кастомна Promise-обгортка, object stores, версіонування/апгрейд |
| **Fetch + Streams** | `getReader()` + `TextDecoder` — власний SSE-парсер; скасування через `AbortSignal` |
| **Drag & Drop / Clipboard** | Зображення: file input, paste, drop з прев'ю-вуаллю; `navigator.clipboard` |

## Backend (Edge)

| Скіл | Застосування |
|---|---|
| **TypeScript на Edge** | Cloudflare Workers: `fetch`-хендлер, `ExecutionContext.waitUntil` |
| **Роутинг** | Власний `EdgeRouter` з патернами `:param` і CORS-префлайтом |
| **KV** | Кеш агрегації моделей (TTL 1 год), ключ `models:v1` |
| **Проксі-патерн** | Ключі вендорів у ENV; нормалізація SSE 8 форматів у один |
| **Адаптери** | OpenAI-like (5 вендорів) + Anthropic Messages API + Gemini streamGenerateContent + Ollama |

## Архітектурні скіли

- **State management** — Proxy + Observer з path-підписками (без deep-proxy)
- **Мікро-архітектура** — поділ оркестрація (`app.ts`) / домен (`chat.ts`) / інфраструктура (`store/router/db/api`)
- **Стримінг-пайплайни** — AsyncGenerator від джерела до DOM з проміжним рендером Markdown (throttle 90 мс)
- **Graceful degradation** — Edge → прямі ключі → офлайн; зрозумілі помилки з retry
- **Доступність** — ролі, focus-стани, Esc закриває все, тач-цілі 44px+

## Дозволені zero-dep бібліотеки (ТЗ)

- `marked` — Markdown→HTML (кастомний renderer для код-блоків)
- `highlight.js/lib/core` — tree-shaken підсвітка (10 мов, без решти пакету)

## Чого свідомо НEMAЄ

- Жодних UI-фреймворків, state-бібліотек, іконок-пакетів, CSS-фреймворків
- Жодного `eval`/`new Function`
- Жодних ключів вендорів у клієнтському бандлі — тільки в ENV воркера
