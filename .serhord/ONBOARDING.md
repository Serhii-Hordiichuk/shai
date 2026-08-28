# 🚀 Онбординг співрозробника

Ласкаво просимо! Це — покроковий вхід у проєкт.

---

## 1. Запуск (5 хвилин)

```bash
npm install
npm run dev      # → http://localhost:5173
npm run build    # перевірка типів + продакшн-збірка
```

Застосунок працює **без жодних ключів**: за замовчуванням активна модель
`Studio Local` (офлайн-рушій). Спробуйте: «порахуй (128 + 47) * 3», «жарт»,
«розкажи про архітектуру».

## 2. Карта коду (куди дивитися першим)

1. `src/app.ts` — **почніть звідси**: каркас, сайдбар, роутинг, налаштування.
2. `src/chat.ts` — серце чату: `ChatEngine.send()` — життєвий цикл повідомлення.
3. `src/api.ts` — мережа: `EdgeClient`, `parseSSE`, `webSearch`, каталог моделей.
4. `src/call.ts` — дзвінки: STT→API→TTS, barge-in, Canvas-аватар.
5. `edge/src/index.ts` — воркер: три ендпоінти, все коротко.
6. `.serhord/ARCHITECTURE.md` — схема потоків даних.

## 3. Рецепт: додати нового провайдера моделей

**Клієнт (прямий режим)** — `src/api.ts`:
1. Додайте запис у `PROVIDERS`: id, label, modelsUrl, chatUrl, keyEnv, normalize.
2. Якщо формат SSE нестандартний — своя гілка в `parseChatStream`.

**Edge (безпечний режим)** — `edge/src/providers.ts`:
3. Об'єкт `ProviderDef`: `modelsRequest(env)`, `mapModels(raw)`,
   `chatRequest(body, env)`, `normalize(event, data)`.
4. Якщо OpenAI-сумісний — просто `openaiLike("id", "Назва", "KEY_ENV", "https://…/v1")`.
5. Секрет: `npx wrangler secret put KEY_ENV`.

**Каталог моделей** оновиться автоматично: воркер опитає `/v1/models`,
клієнт закешує в IndexedDB.

## 4. Рецепт: додати іконку + UI-елемент

1. Намалюйте SVG 24×24 (stroke, `currentColor`) → додайте у `icons.ts`:
   `myIcon: S('<path d="…"/>')`.
2. Використання: `ico("myIcon")`.
3. Повторюваний компонент (кнопка/перемикач/картка) — функція у `ui.ts`,
   стилі у `index.css` з префіксом компонента (див. CONVENTIONS §2).

## 5. Рецепт: додати фічу в чат

1. Стан (якщо потрібен) — поле в `AppState` (chat.ts) + дефолт.
2. Логіка — метод у `ChatEngine`; реактивність через `store.watch`.
3. Якщо з'явився новий модуль — секція в `ARCHITECTURE.md`.
4. **Обов'язково:** запис у `DECISIONS.md` (що/чому/як) + рядок у `CHANGELOG.md`.
5. `npm run build` — без помилок.

## 6. Локальна розробка з реальними моделями

- **Швидко:** Налаштування → API → вставте ключ (Groq і Gemini мають щедрі
  безкоштовні тарифи) — клієнт перейде у прямий режим.
- **Правильно:** задеплойте воркер (`edge/README`-комента у `wrangler.toml`),
  вкажіть URL у Налаштуваннях → Edge-проксі. Ключі лишаться на сервері.
- **Ollama локально:** `OLLAMA_ORIGINS=* ollama serve`, URL `http://localhost:11434`.

## 7. Дебаг-поради

- Стримінг не йде? Відкрийте DevTools → Network → подивіться сирі SSE-рядки;
  контракт: `data: {"type":"delta","text":"…"}`.
- Моделі порожні? Перевірте кеш: DevTools → Application → IndexedDB → `models/list`
  (TTL 1 год; «Оновити список» у dropdown скидає).
- Дзвінок мовчить? Web Speech — лише Chromium; статус покаже причину.

## 8. Чек-лист перед пулл-реквестом

- [ ] `npm run build` проходить
- [ ] Запис у `DECISIONS.md` і `CHANGELOG.md`
- [ ] Нові CSS-змінні додано в **обидві** теми
- [ ] Тач-цілі ≥44px, перевірено на ≤380px
- [ ] Жодних `alert/confirm/prompt`, emoji-іконок, ключів у клієнті
