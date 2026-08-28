<p align="center">
  <img src="https://img.shields.io/badge/frontend-vanilla%20js-3178c6?style=for-the-badge" alt="Vanilla JS" />
  <img src="https://img.shields.io/badge/backend-edge%20typescript-059669?style=for-the-badge" alt="Edge TypeScript" />
  <img src="https://img.shields.io/badge/workers-cloudflare-f38020?style=for-the-badge" alt="Cloudflare Workers" />
  <img src="https://img.shields.io/badge/license-MIT-e5484d?style=for-the-badge" alt="MIT License" />
</p>

<h1 align="center">AI Studio</h1>

<p align="center">
  <b>Qwen-style AI chat interface · Telegram-style voice & video calls · Artifacts panel</b><br/>
  Built with pure HTML5, CSS3 and Vanilla JS (ES2022). No UI frameworks. Edge backend in TypeScript.
</p>

---

## What you get

**Chat**
- Token-level **SSE streaming** with a hand-rolled parser, Stop button and throttled Markdown re-render
- **Model selector** with search and provider grouping — Gemini, DeepSeek (incl. R1 reasoning), Groq, OpenRouter, Mistral, Anthropic, OpenAI, Ollama
- **Web search** toggle — live Wikipedia lookups, sources rendered under the answer and injected into the prompt
- **Deep thinking** toggle — chain-of-thought panel (local steps, DeepSeek `reasoning_content`, Gemini thinking)
- Markdown + syntax-highlighted code blocks with copy buttons and line numbers
- **Artifacts**: code blocks become artifacts with a sandboxed live HTML preview, copy & download
- Images: file picker, clipboard paste, drag-and-drop — sent to vision models
- Composer voice dictation (Web Speech API)
- Offline engine (`Studio Local`): safe math parser, jokes, facts — works with zero keys

**Calls (Telegram-style)**
- Full-screen voice & video calls: timer, live captions, mic/camera toggles
- **Barge-in** — the AI stops speaking when you talk (microphone amplitude analysis via Web Audio)
- Canvas AI avatar: mic spectrum ring, TTS lip-sync, pulse rings
- Call transcript is appended to the chat

**System**
- Custom **Proxy + Observer state manager**, custom **hash router**, custom **IndexedDB** wrapper
- Light/dark themes on CSS variables, custom scrollbars, fully responsive (380px → 4K)
- 50+ hand-drawn SVG icons, custom dropdowns / modals / toasts / switches / sliders
- In-app **Architecture & Spec** page (Settings → Architecture & Spec)

## Stack

| Layer | Tech |
|---|---|
| UI | HTML5 · CSS3 (variables, `clamp()`, container-safe) · Vanilla JS ES Modules |
| Markdown / code | `marked` + tree-shaken `highlight.js` (the only allowed deps) |
| State | `Store<T>` — Proxy + Observer |
| Routing | Hash router (`#/c/:id`, `#/settings`, `#/docs`) |
| Storage | IndexedDB (client) · Edge KV (model cache) |
| Backend | TypeScript on Cloudflare Workers — API proxy, model aggregation, key vault |
| Voice | Web Speech (STT/TTS) · Web Audio (analyser, barge-in, signals) · Canvas avatar |

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build → dist/
```

Works out of the box with the offline engine. To unlock cloud models, either:

1. **Direct mode** — Settings → Models & API → paste a provider key (Gemini and Groq have generous free tiers). Keys stay in your browser (IndexedDB).
2. **Edge mode (recommended)** — deploy the worker and point Settings → Edge proxy at it. Keys live in worker secrets, never in the browser.

```bash
cd edge
npx wrangler kv namespace create KV        # once — put the id into wrangler.toml
npx wrangler secret put GOOGLE_API_KEY     # repeat per provider
npx wrangler deploy
```

**Ollama (local models):** `OLLAMA_ORIGINS=* ollama serve`, then set `OLLAMA_URL=http://localhost:11434` in Settings.

## Project structure

```
src/            frontend (vanilla JS, ES Modules)
  app.ts        orchestration: shell, sidebar, settings, spec page
  chat.ts       ChatEngine — streaming, artifacts, composer
  call.ts       CallManager — calls, barge-in, avatar
  api.ts        EdgeClient, SSE parser, vendor adapters, web search
  store.ts      Proxy + Observer state
  router.ts     hash router
  db.ts         IndexedDB wrapper
  engine.ts     offline engine + chain of thought
  render.ts     Markdown + code blocks + artifacts
  ui.ts         modals, dropdowns, toasts, switches, sliders
  icons.ts      hand-drawn SVG set
  index.css     design system, themes, responsive
edge/           Cloudflare Worker (TypeScript)
.serhord/       project documentation (in Ukrainian)
```

## Browser notes

- Speech recognition & TTS voices require a Chromium-based browser; everything else works everywhere.
- Direct Ollama from the browser needs CORS enabled on the Ollama server (`OLLAMA_ORIGINS=*`), or use the Edge proxy.

## Documentation

Deep docs for co-developers live in [`.serhord/`](./.serhord) (Ukrainian): status, architecture, decision log (what / why / how), changelog, roadmap, conventions, onboarding recipes.

## License

[MIT](./LICENSE) © AI Studio Contributors
