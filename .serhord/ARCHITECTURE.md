# 🏗 Архітектура AI Studio

## Принцип

**Один vanilla-застосунок, жодного фреймворка в логіці.** React (`src/App.tsx`) існує лише
як точка монтування середовища Vite — весь застосунок будує `mountApp()` зі `src/app.ts`
через DOM API. Усі модулі — ES Modules, спілкуються через store та події.

## Структура файлів

```
├── index.html              # шрифти Unbounded+Manrope, favicon, meta
├── edge/                   # Edge-бекенд (TypeScript, Cloudflare Workers)
│   ├── src/index.ts        # вхідна точка: health / models / chat
│   ├── src/router.ts       # class EdgeRouter — маршрутизація + CORS
│   ├── src/providers.ts    # адаптери 8 вендорів, нормалізація SSE
│   ├── wrangler.toml       # конфіг деплою, KV-прив'язка
│   └── tsconfig.json
├── src/
│   ├── App.tsx             # тонка обгортка: монтує vanilla-застосунок
│   ├── app.ts              # ОРКЕСТРАТОР: shell, сайдбар, налаштування, ТЗ, дзвінки
│   ├── chat.ts             # class ChatEngine: стримінг, артефакти, композер
│   ├── call.ts             # class CallManager: дзвінки, barge-in, Canvas-аватар
│   ├── store.ts            # клас Store: Proxy + Observer, підписки на шляхи
│   ├── router.ts           # клас Router: власний hash-роутер
│   ├── db.ts               # клас IDB: обгортка IndexedDB
│   ├── api.ts              # EdgeClient + parseSSE + webSearch + каталог моделей
│   ├── render.ts           # marked + hljs, кастомні блоки коду, артефакти
│   ├── engine.ts           # офлайн-рушій: мат-парсер, ланцюжок думок, знання
│   ├── ui.ts               # модалки, dropdown, тости, тумблери, слайдери
│   ├── icons.ts            # 50+ власних SVG-іконок
│   └── index.css           # дизайн-система: теми, компоненти, адаптив
└── .serhord/               # ця документація
```

## Потоки даних

### Повідомлення користувача → відповідь

```
композер (chat.ts)
  → store.state.chats (Proxy) ──watch──> рендер сайдбару (app.ts)
  → persist() ──> db.set("chats","all") ──> IndexedDB
  → ChatEngine.send():
      1. [webSearch?] Wikipedia API → джерела під повідомленням
      2. model.provider === "local" ? локальний генератор : EdgeClient.chat()
      3. EdgeClient: edgeUrl ? Edge-проксі : прямий виклик вендора
      4. parseSSE() → події delta/thinking → поступовий рендер Markdown
      5. extractArtifacts() → права панель
      6. finalize → IndexedDB, тост, звук
```

### Модельний запит (Edge)

```
браузер ──POST /api/chat {provider, model, messages}──> worker
worker: byId(provider).chatRequest(body, ENV)  // ключ з ENV, не з клієнта
worker ──fetch──> вендор (OpenAI/Anthropic/Gemini/...)
worker: provider.normalize(event, data) → єдиний SSE-формат {type, text}
браузер: parseSSE() → onEvent
```

### Стан застосунку

```
Store<AppState> (Proxy)
  ├── watch(["chats","activeId","view"], cb)   // сайдбар
  ├── watch(["settings"], cb)                  // теми, persist
  ├── watch(["modelId","models"], cb)          // селектор
  └── watch(["sidebarOpen"], cb) / ["artOpen"] // drawer'и
```

## Ключові класи

| Клас | Файл | Відповідальність |
|---|---|---|
| `Store<T>` | store.ts | Реактивний стан: `set`, `setDeep`, `watch(path[], cb)`; підписки знімаються |
| `Router` | router.ts | `add("#/c/:id", fn)`, `navigate()`, `resolve()`; подія `hashchange` |
| `IDB` | db.ts | `get(store,key)`, `set(store,key,val)`; версіонування БД, апгрейд-хук |
| `EdgeClient` | api.ts | `fetchModels(keys)`, `chat(model, msgs, opts)` → `AsyncGenerator<StreamEvent>` |
| `ChatEngine` | chat.ts | Життєвий цикл повідомлення: стримінг, веб-пошук, думки, артефакти, диктовка, зображення |
| `CallManager` | call.ts | `start(kind)`, STT/TTS-цикл, barge-in через AnalyserNode, `end(log)` → стенограма |
| `EdgeRouter` | edge/router.ts | Патерни `:param`, CORS-префлайт, JSON-помилки |

## Чому така розбивка

- **app.ts ≠ chat.ts**: оркестрація (каркас, роутинг, налаштування) відокремлена від
  доменної логіки чату — можна замінити рушій чату, не чіпаючи shell.
- **api.ts не знає про DOM**: чисті мережеві примітиви — тестуються окремо.
- **render.ts ізольований**: зміна бібліотеки Markdown = зміна одного файлу.
- **engine.ts синхронний і без мережі**: офлайн-режим і дзвінки отримують відповіді
  миттєво, без залежності від API.
