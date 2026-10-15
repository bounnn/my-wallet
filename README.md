# My Wallet

A personal money tracker that runs entirely on your device. It's a PWA with no backend and no account: all data lives in the browser's IndexedDB. It only runs once added to the home screen.

Live at **https://bounnn.github.io/my-wallet/**

## Features

- **Home**: the selected wallet's balance for the month, with transactions grouped by day
- **Add**: income and expense entry with a built-in calculator keypad, category, wallet and date
- **Report**: spending by category (donut) and by month (bars), with per-category totals
- **Plan**: savings goals (adding money to a goal is a transaction) and monthly budgets that can span several categories
- **Settings**: wallets, categories, backup to a JSON file, restore, and erasing all data
- **Several wallets**: each has its own currency and starting balance; home, report and plan show one wallet at a time
- **Home screen only**: in a browser tab the app shows an install page instead (install prompt on Android and desktop, Share → Add to Home Screen steps on iPhone, open-in-browser steps for LINE, Facebook and Instagram)
- **Works offline**: the service worker caches the whole app

## Tech stack

- [Nuxt 4](https://nuxt.com) in SPA mode (`ssr: false`)
- [Nuxt UI 4](https://ui.nuxt.com) and Tailwind CSS 4, dark mode only
- [Dexie](https://dexie.org) for IndexedDB storage, with live queries
- [Valibot](https://valibot.dev) for validating backup files
- [@vite-pwa/nuxt](https://vite-pwa-org.netlify.app/frameworks/nuxt) for the manifest, icons and service worker
- [Bun](https://bun.sh) as the package manager

## Getting started

```bash
bun install
bun run dev
```

The app runs at `http://localhost:3000`. The service worker is enabled in dev too.

The home screen check is off in dev so the app works in a browser tab; open `/install` to see the install page. To try the check itself, run `bun run generate && bun run preview`.

## Scripts

| Command            | What it does                         |
| ------------------ | ------------------------------------ |
| `bun run dev`      | Start the dev server                 |
| `bun run generate` | Build the static site into `.output/public` |
| `bun run preview`  | Preview the production build         |

App icons are generated from `public/logo.svg` (see `pwa-assets.config.ts`).

## Project layout

```
app/
  pages/        home (index), add, report, plan, settings, welcome, install
  components/   modals, charts, keypad, rows and cards
  composables/  live queries, active wallet, backup, viewport helpers
  utils/        db schema (db.ts), data writes (wallets, categories, transactions,
                goals, budgets), backup, money, dates, calculator, install checks
  middleware/   sends browser tabs to the install page and first-time users to welcome
```

## Data

- Everything is stored locally in IndexedDB. Clearing site data or uninstalling the app erases it, so use **Settings → Back up data** regularly.
- On iPhone, Safari and the home screen app keep separate storage, so data entered in Safari doesn't carry over. The install page offers a backup when Safari has data.
- Database writes go through the functions in `app/utils/` (`wallets`, `categories`, `transactions`, `goals`, `budgets`); writes that touch several tables run in one `db.transaction`.
- Amounts are stored as integers in the currency's minor units (cents for USD, none for JPY).
- Schema changes go through Dexie versions in `app/utils/db.ts`; bump the version and add an upgrade when changing a table.
- Backup files carry a `version` (see `app/utils/backup.ts`) and older versions keep restoring.

## To do

> Make it work, make it right, make it fast.

**Make it work** is done: every page works end to end. The next step is **make it right** by following the standard practice of each framework and tool.

### Make it right

**Tooling**

- [ ] Add [`@nuxt/eslint`](https://eslint.nuxt.com) and a `lint` script
- [ ] Add a `typecheck` script (`nuxi typecheck` with `vue-tsc`)
- [ ] Run lint and typecheck in the deploy workflow before building, so a broken build never ships

**Tests**

- [ ] Set up Vitest with [`@nuxt/test-utils`](https://nuxt.com/docs/getting-started/testing)
- [ ] Unit test the pure utils: `money`, `calc`, `date`, `goals`, `categoryStyle`, `install`
- [ ] Test Dexie upgrades and the backup round trip (export, then restore) with `fake-indexeddb`, including restoring v1 backups

**Nuxt UI**

- [x] Build the forms in modals and on `/add` with `UForm` and Valibot schemas, instead of checking fields by hand, so errors show on each field
- [ ] Review overlays against the Nuxt UI pattern (`useOverlay` for modals opened from code)

**Nuxt**

- [x] Set a page title on each page with `useHead` / `useSeoMeta`, and `lang` on `<html>`
- [x] Split the largest pages (`add.vue`, `plan.vue`) into smaller components
- [x] Remove the empty `server/` folder (the app has no backend)

**Data (Dexie)**

- [x] Move database writes out of pages and components (11 files write directly) into one data layer in `utils/`, so rules like deleting a wallet together with its transactions, goals and budgets live in one place
- [x] Check that every write touching more than one table runs inside `db.transaction`

### Make it fast

- [ ] Measure first (Lighthouse, Vue DevTools), then optimize what shows up

## Deployment

Every push to `main` builds the app with `nuxi generate` and publishes it to GitHub Pages (`.github/workflows/deploy.yml`). The build sets `NUXT_APP_BASE_URL` to `/<repo>/` so routes, the manifest and the service worker work under the repo path.
