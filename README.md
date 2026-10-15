# My Wallet

A personal money tracker that runs entirely on your device. It's an installable PWA with no backend and no account: all data lives in the browser's IndexedDB.

Live at **https://bounnn.github.io/my-wallet/**

## Features

- **Home**: the selected wallet's balance for the month, with transactions grouped by day
- **Add**: income and expense entry with a built-in calculator keypad, category, wallet and date
- **Report**: spending by category (donut) and by month (bars), with per-category totals
- **Plan**: savings goals (adding money to a goal is a transaction) and monthly budgets that can span several categories
- **Settings**: wallets, categories, backup to a JSON file, restore, and erasing all data
- **Several wallets**: each has its own currency and starting balance; home, report and plan show one wallet at a time
- **Works offline**: installable to the home screen, and the service worker caches the whole app

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
  pages/        home (index), add, report, plan, settings, welcome
  components/   modals, charts, keypad, rows and cards
  composables/  live queries, active wallet, backup, viewport helpers
  utils/        db schema (db.ts), backup, money, dates, calculator
  middleware/   sends first-time users to the welcome page
```

## Data

- Everything is stored locally in IndexedDB. Clearing site data or uninstalling the app erases it, so use **Settings → Back up data** regularly.
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
- [ ] Unit test the pure utils: `money`, `calc`, `date`, `goal`, `category`
- [ ] Test Dexie upgrades and the backup round trip (export, then restore) with `fake-indexeddb`, including restoring v1 backups

**Nuxt UI**

- [ ] Build the forms in modals and on `/add` with `UForm` and Valibot schemas, instead of checking fields by hand, so errors show on each field
- [ ] Review overlays against the Nuxt UI pattern (`useOverlay` for modals opened from code)

**Nuxt**

- [ ] Set a page title on each page with `useHead` / `useSeoMeta`, and `lang` on `<html>`
- [ ] Split the largest pages (`add.vue`, `plan.vue`) into smaller components
- [ ] Remove the empty `server/` folder (the app has no backend)

**Data (Dexie)**

- [ ] Move database writes out of pages and components (11 files write directly) into one data layer in `utils/`, so rules like deleting a wallet together with its transactions, goals and budgets live in one place
- [ ] Check that every write touching more than one table runs inside `db.transaction`

### Make it fast

- [ ] Measure first (Lighthouse, Vue DevTools), then optimize what shows up

## Deployment

Every push to `main` builds the app with `nuxi generate` and publishes it to GitHub Pages (`.github/workflows/deploy.yml`). The build sets `NUXT_APP_BASE_URL` to `/<repo>/` so routes, the manifest and the service worker work under the repo path.
