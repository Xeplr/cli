# @xeplr/cli — map

`xeplr new <name>` asks a few questions and writes a whole xeplr app (api/ + ui/ + mobile/, sign-in,
factory forms, flows on workflow + jobs) from `templates/` (+ `templates-tenancy/` when tenancy is on);
`xeplr encrypt` redoes the DB connection string. It writes once into an empty folder and never updates
an existing app, so a template change reaches only apps generated after it.

## Where things are
- `bin/xeplr.js` — `main()`: `new` (collect → `plan.describe` → confirm → `generate` → `setup.run` → `nextSteps.describe`), `encrypt`, help
- `lib/questions.js` — `collect()`, `envPrefix()`, `databaseNames()` (api/auth/workflow/jobs DB names), `tenancyLevels()`, `secret()`, `NAME_RE`/`DB_NAME_RE`
- `lib/generate/index.js` — `substitutions()` (every `__TOKEN__`), `flowsSubstitutions()` (`__WF_README__`, `__WF_CLAUDE__` text), `tenancySubstitutions()` (`__MT_*__`, empty when off), `fill()` (unknown token throws; a line that is only an empty token is dropped), `generate()` (overlay tenancy files, `RENAME`, chmod `www` + pre-commit, makes absolute `api/data` = `__DATA_DIR__`), `isOccupied()`
- `lib/setup.js` — `steps()`/`run()`: npm install api + ui, then `npm run setup` only with a connection; `lib/plan.js`, `lib/nextSteps.js` — the printed plan and next steps; `lib/prompt.js` — `createSession()` (piped answers work)
- `lib/commands/encrypt.js` — `run()`, `parseFlags()`, `findEnvFile()`, `writeConnection()` (every connection setting)

## Templates → generated app
- Docs the app carries: `templates/README.md`, `templates/CLAUDE.md` (the app's own map + "Create a new UI" recipe), `templates/BUILDING.md` (click vs code, every function event), `templates/api/README.md`, `templates/ui/README.md`, `templates/mobile/README.md`, `templates/api/migrations/README.md` — change them with the features they describe
- `api/bin/www` — boot: connection check, `checkEnv`, `registerApplication('__NAME__')`, factory + app migrations, `db/setup`, `factory.init` + `publishScreens(screens.documents)`, `workflow.js`, `app()`
- `api/workflow.js` — `jobs.init({migrate:true, defaultActions:false, onFinish: engine.jobFinished})` with `engine.jobActions`, `registerWorkflow({tenantTables:false, access:true, startJob, keepSchedule: jobs.keepSchedule})`, `jobs.startScheduler()`
- `api/app.js` (createApp, `/api` → `factory.router`, member gate), `api/routes/index.js` (`/health`, `/whoami`, `/api/workflow`), `api/routes/flows.js` (`mount()` of the workflow router), `api/routes/access.js` (design/publish = Super Admin only)
- `api/screens/index.js` (`documents`, `models`), `api/screens/task/*` (sample entity, screens, model), `api/functions/index.js` (registered app functions), `api/models/index.js`, `api/db/setup.js`, `api/env.required.js`, `api/development.env.tpl`, `api/production.env.example`, `api/package.json`
- `api/migrations-auth/0001_home_menu`, `0002_tasks_menu`, `0003_configure_ui_menu`, `0005_flows_menu` (0004 is tenancy's `0004_switch_menu`)
- `ui/src/App.jsx` (routes `/home`, `/tasks`, `/forms/:form`, `/configure…`, `/flows`, `/journey/:flow`; `drawerItems`), `ui/src/menu.js` (menu keys, one place), `ui/src/main.jsx`, `ui/src/api/factory.js`, `ui/src/api/flows.js`, `ui/src/pages/*` (Tasks/EditTask sample, ConfigureUI, Forms, FormDesigner, FormRecords, Masters, MenuSettings, Flows, FlowsHome, FlowDesigner, Journey, Home), `ui/pages.json`, `ui/vite.config.js` (every API prefix proxied)
- `mobile/` — Expo app: `src/lib/app.js`, `src/app/_layout.jsx`, `login`, `index`, `forms/[form]`, `flows`, `journey/[flow]`
- `.githooks/pre-commit` — warns on web-only pages (never blocks)
- `templates-tenancy/` — `api/tenancy.js`, `api/routes/tenants.js` (`/api/tenants/l1`, `memberGate`), `api/migrations/0001_tenants.sql`, `api/migrations-auth/0004_switch_menu.sql`, `ui/src/tenancy.js`, `ui/src/pages/SelectScope.*`, `mobile/src/app/select.jsx`
- Renamed on write (`RENAME`): `development.env.tpl` → `development.env`, `dotenv.tpl` → `.env`, `gitignore.tpl` → `.gitignore` (npm will not pack the real names)

## Flow
`xeplr new demo` → `questions.collect()` → `generate(answers, target)`: walk `templates/` (+ `templates-tenancy/` overlay, same path replaces) → `fill(body, substitutions())` → write → `setup.run()` → `npm run setup` (create DBs, auth migrations).

## To change X, edit Y
- A new question / derived name → `lib/questions.js` → `collect()`, then the token in `substitutions()`
- A new placeholder → `lib/generate/index.js` → `substitutions()` (an unfilled one throws in `fill()`)
- Code only a multi-tenant app has → `templates-tenancy/` file or an `__MT_*__` token in `tenancySubstitutions()` (must expand to `''` when off)
- Generated boot order → `templates/api/bin/www`; workflow/jobs wiring → `templates/api/workflow.js`
- A new generated route → its template + `templates/api/migrations-auth/000N_*.sql` (and `ui/vite.config.js` prefix)
- A new side-rail item → `templates/ui/src/menu.js` + `App.jsx` `drawerItems` + a `menus` row (same key exactly)
- What a generated app tells Claude → `templates/CLAUDE.md` (+ `__WF_CLAUDE__` in `flowsSubstitutions()`)
- Install / setup steps → `lib/setup.js` → `steps()`

## Rules and traps
- Generated code is CommonJS + `var` (api); the CLI refuses an occupied folder before asking anything.
- No defaults for DB names, ports or data dir in generated code — all in `env.required.js`; `api/data` is written absolute.
- Generated scripts must not use unix-only env prefixes or shell out to `sh` (tests check).
- Every template feature change updates the template READMEs/CLAUDE.md/BUILDING.md in the same change (workspace rule).
- Flows' clock is `@xeplr/jobs` started in `workflow.js`; templates never add their own timers.

## Test
- `npm test` (`node --test test/*.test.js`) — `test/cli.test.js` generates real projects into temp dirs and checks tokens, renames, tenancy on/off, flows wiring, menus, pages.json, BUILDING.md, mobile. No DB or network.
