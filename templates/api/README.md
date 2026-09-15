# __NAME__ — api

The API (`@xeplr/base-apis`) and the sign-in service (`@xeplr/auth`), with this app's forms served by `@xeplr/factory`.

## Commands

| Command | Does |
|---|---|
| `npm run setup` | create both databases (`__NAME___auth`, `__NAME___api`), the sign-in tables, permissions and menus |
| `npm run start-auth` | the sign-in service, port __AUTH_PORT__ — refuses to start without Redis or `REDIS_PREFIX`; its banner says whether email works |
| `npm run start-api` | the API, port __API_PORT__ — runs `migrations/` and publishes never-published screens on start |
| `npm run migrate:auth` | apply new `migrations-auth/*.sql` (a new menu row, say), then restart sign-in |
| `npm run db:encrypt` | redo the encrypted database connection |
| `npm run check-env` | check every required setting is present |
| `npx xeplr-factory screens screens/<form>/<form>.entity.json -o screens/<form> --no-pages` | a form's screens, server hooks and model from its spec |
| `npx xeplr-factory validate <screen>.json` | check a screen document |

## Layout

| Path | What |
|---|---|
| `development.env` | every setting — ports, the encrypted connection, `REDIS_PREFIX`, secrets, the super admin, email |
| `env.required.js` | the settings that must be present; the API refuses to start and names any that are missing |
| `app.js` | the Express app: the auth gate, and the routes |
| `routes/index.js` | this app's own routes — every data address under `/api` |
| `routes/access.js` | who may design and publish forms (Super Admin) |
| `screens/` | the forms this app ships with: per form, its spec, list and edit screens, server hooks and model — registered in `screens/index.js` |
| `migrations/` | hand-written SQL for tables no form owns |
| `migrations-auth/` | this app's rows in the sign-in database — menus (by key), permissions |
| `models/` | models for hand-written tables |

## Settings to know

| Setting | |
|---|---|
| `REDIS_PREFIX` | **required, unique to this app** (`__NAME__:`) |
| `__PREFIX___CONNECTION`, `AUTH_DB_CONNECTION_INFO_ENCRYPTED` | the database, encrypted — `npm run db:encrypt` |
| `DB_API`, `AUTH_DB_NAME` | the two database names — never guessed |
| `AUTH_SUPER_ADMIN_EMAIL` / `_PASSWORD` | the first account — created once, when the sign-in database is first set up |
| `EMAIL_PROVIDER` and its settings | optional; without them sign-in works, but activation and reset links cannot be sent |
