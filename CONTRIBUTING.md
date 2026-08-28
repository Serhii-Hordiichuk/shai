# Contributing

Thanks for helping build shai! Please read the docs in [`.serhord/`](./.serhord) before your first PR (they are written in Ukrainian):

- [`CONVENTIONS.md`](./.serhord/CONVENTIONS.md) — coding rules, naming, process (**mandatory**)
- [`ONBOARDING.md`](./.serhord/ONBOARDING.md) — run the app, add a provider / icon / feature step-by-step
- [`DECISIONS.md`](./.serhord/DECISIONS.md) — why things are the way they are
- [`ROADMAP.md`](./.serhord/ROADMAP.md) — what's planned next

## Ground rules

1. **No UI frameworks** in app logic — Vanilla JS + DOM API only.
2. **No `alert/confirm/prompt`**, no emoji icons, no `eval`/`new Function`.
3. All icons are hand-drawn SVGs in `src/icons.ts`.
4. New CSS colors/shadows/radii go into **both** theme blocks as CSS variables.
5. Touch targets ≥ 44px; test at 380px width.
6. Every change gets a `what / why / how` entry in `DECISIONS.md` and a `CHANGELOG.md` line.
7. `npm run build` must pass with zero type errors.

Commit messages: `feat:` / `fix:` / `docs:` / `style:` + a short description.
