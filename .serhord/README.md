# 📁 .serhord — документація проєкту AI Studio

> Ця папка — єдине джерело правди для співрозробників.
> **Правило:** будь-яка зміна коду супроводжується записом у `DECISIONS.md` і `CHANGELOG.md`.

## Що тут лежить

| Файл | Про що |
|---|---|
| [STATUS.md](./STATUS.md) | Поточна стадія проєкту, що зроблено, над чим йде робота зараз |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Архітектура, модулі, потік даних, структура файлів |
| [DECISIONS.md](./DECISIONS.md) | Журнал рішень: **що** додано, **чому**, **як** реалізовано |
| [CHANGELOG.md](./CHANGELOG.md) | Історія версій (v1.0 → теперішня) |
| [ROADMAP.md](./ROADMAP.md) | Майбутні цілі та пріоритети |
| [CONVENTIONS.md](./CONVENTIONS.md) | Правила коду, неймінг, процеси — обов'язково до прочитання |
| [SKILLS.md](./SKILLS.md) | Які технології/скіли задіяні та де їх застосовано |
| [ONBOARDING.md](./ONBOARDING.md) | Як запустити проєкт і як додати свою фічу (покроково) |

## Мовна політика

- **Застосунок (UI, повідомлення, рушій, ТЗ всередині):** англійська — з v3.2.
- **Документація `.serhord/`:** українська (ця папка).
- **README / LICENSE / CONTRIBUTING (корінь репо):** англійська — для публічного GitHub.

## Проєкт коротко

**AI Studio** — AI-чат інтерфейс у стилі Qwen Studio з дзвінками як у Telegram.

- **Frontend:** чистий HTML5 / CSS3 / Vanilla JS (ES6+, TypeScript-синтаксис). Жодних React/Vue/Angular у логіці — React-файл `src/App.tsx` лише монтує vanilla-застосунок.
- **Backend:** TypeScript на Edge (Cloudflare Workers), папка `edge/` — проксі API, агрегація моделей, KV-кеш. Ключі вендорів не потрапляють у браузер.
- **Дані:** IndexedDB (кастомна обгортка `src/db.ts`) + Edge KV.
- **Дозволені бібліотеки:** лише легковагі zero-dep для Markdown/коду — `marked`, `highlight.js`.

## Швидкий старт

```bash
npm install       # встановити залежності
npm run dev       # локальний розвиток
npm run build     # продакшн-збірка
```

Деплой Edge-воркера:

```bash
cd edge
npx wrangler kv namespace create KV     # один раз
npx wrangler secret put OPENAI_API_KEY  # для кожного провайдера
npx wrangler deploy
```

## Статус: **v3.1 — завершено**
Детальніше → [STATUS.md](./STATUS.md)
