# @xeplr/cli

Creates a working xeplr application — an API, sign-in, and a UI — from a few
questions, installs it, and sets up its databases.

```bash
npx @xeplr/cli@latest new myapp
```

`@latest` makes npx fetch the newest version rather than one it cached earlier.

## What you get

```
myapp/
├─ api/     backend, sign-in, your data
└─ ui/      React frontend
```

Already working, with nothing to wire up:

- **Sign-in** — login, register, forgot and reset password, activation,
  profile, change password, and the admin screens for users, roles and
  permissions. You write none of them.
- **A guarded API** — every address needs a valid token. An address you want
  open is named explicitly; there is no way to leave the whole thing public by
  forgetting.
- **A sample built with the screen designer** — a task list whose New and Edit
  open the task form on a page of its own, filled in over three steps and saving
  as you type into an ordinary `tasks` table. It uses every control there is:
  text, dropdown, radio buttons, tick box, date, date and time, a multi-select
  and a file upload. Neither the list nor the form is written by hand: both are
  screens ([`@xeplr/ui-factory`](https://www.npmjs.com/package/@xeplr/ui-factory)),
  published when the API first starts.
- **Configure UI** for Super Admin, in the settings menu (top right) — not in
  the side rail, which is for the pages people use:
  - **Forms**: every UI in the app. New form (a **label** people see and a
    **key** that names its table), design its form and its list, publish (which
    creates or changes its table), open it, **add it to the side rail** — no
    code, no Claude needed.
  - **Menu**: rename, reorder and hide the side rail's items.

  Nobody else sees it, and the API refuses everyone else.
- **Flows, if you run Xeplr Workflow** — your forms one after another, where
  what someone fills in decides the next screen. Designed in Configure UI →
  Flows, walked at `/journey/<key>`, and resumable, since Workflow keeps the run.
- **Multi-tenancy, if you ask for it** — companies (or companies and
  workspaces, up to four levels). Every row is stamped with the one it was made
  in, every read sees only its rows, membership is checked on every request,
  and choosing one is the first screen after signing in.
- **A welcome screen** that checks it can reach everything and tells you which
  files to change first.
- **READMEs** at the project root and in `api/` and `ui/`: how to start it,
  every command, where things live, and the rules the app follows.
- **A `CLAUDE.md`** that tells Claude how to create a new UI in this app — the
  screens, the page with its front-end hooks, the server hooks and model, the
  route and menu entry — and a ready prompt (also shown beside the sample):

  > Create a new UI for farming departments. One record is a farming department
  > with: Name (required), Region (dropdown: North, South, East, West), Area in
  > acres (number, at least 0), Started on (date), Certifications (choose several:
  > Organic, Fair trade, Rainforest), Inspection at (date and time), Licence
  > (file: .pdf or .jpg), Notes (long text). Show Name, Region and Area in the
  > list. Follow "Create a new UI" in CLAUDE.md.

## Rules the generated app follows

These are architecture decisions, not defaults to tune — each one exists because the alternative failed quietly.

| Rule | Where | Why |
|---|---|---|
| **Records live in real tables, one column per field — never JSON.** | `@xeplr/factory` | `select * from tasks` and plain-SQL reports must work. Only a screen's *design* is JSON (the `factory_screens` table). |
| **A key and a label, everywhere.** A form's key (`farming_department`) names its screens and table and never changes once published; its label is renamed any time. A menu item's key (`menus.name`, used by `drawerItems` / `settingsOverrides` in `ui/src/App.jsx` and `ui/src/menu.js`) is what code matches; its label is what the rail shows. | `@xeplr/auth`, `@xeplr/ui-account` | Code must never break because someone renamed something people read. No label is written in code. |
| **`REDIS_PREFIX` is required and unique per app** (`api/development.env`, set to `<name>:`). | `@xeplr/auth`, `@xeplr/utils` | Two apps on one Redis under the shared default serve each other's sessions, menus and API permissions. Sign-in refuses to start without it, or with `xeplr:`. |
| **Designing, new forms and publishing are Super Admin only.** | `api/routes/access.js`, `@xeplr/auth` menu routes | Publishing changes database tables. Every other screen route checks the permission catalog. |
| **The browser is not a security boundary.** Front-end hooks (`ui/src/pages/Edit<Form>.jsx`) shape what people see and send; anything that must hold goes in server hooks (`api/screens/<form>/<form>.hooks.js`); data shape in the model (`<form>.model.js`). | `@xeplr/ui-factory`, `@xeplr/factory` | |
| **Every data address is under `/api`.** | `api/routes`, `ui/vite.config.js` | A page path and a data path must never collide. |
| **No guessed database names or connections.** | `api/development.env` | A wrong-but-present value starts cleanly and reads as empty data. |
| **Email is checked at start, never fatal.** The sign-in banner shows `email ✓ …` or `✗ NOT WORKING — reason`. | `@xeplr/auth` | Sign-in works without email; activation, invite and reset links cannot be sent until `EMAIL_PROVIDER` is set. |

## Before you start

- **Node.js** 18 or later
- **PostgreSQL**, running, with a user allowed to create databases
- **Redis**, running — sign-in sessions are kept there

```bash
# macOS
brew services start redis

# Linux
sudo systemctl start redis

# Windows — Redis has no native build, so Docker or WSL
docker run -d -p 6379:6379 redis
```

Without Redis, login appears to work and then every request is refused as
"Invalid or expired token". The sign-in service checks for it at startup and
refuses to start rather than let you meet that message.

Works on macOS, Linux and Windows. Nothing it generates depends on a unix
shell.

## Then

The installer has already run `npm install` in both halves and — when you gave
the database connection — `npm run setup`, which creates both databases, the
sign-in tables and the permissions. Start it:

```bash
cd myapp/api && npm run start-auth   # sign-in
cd myapp/api && npm run start-api    # your API — publishes the sample screens on first start
cd myapp/ui  && npm run dev          # the app
```

Open the UI and sign in with the account you named. As Super Admin you will
see **Configure UI** in the settings menu, top right.

**Use a new project name for a new app.** The name decides the database names
(`<name>_auth`, `<name>_api`); an existing database is kept as it is, with its
accounts — the super admin you enter is created only in a fresh one.

`xeplr new myapp --no-install` only writes the files; then run `npm install` in
`api` and `ui`, and `npm run setup` in `api`, yourself. If set-up stops part
way (Postgres not running, say), the installer says which step and the command
to run again.

## Creating a new UI

Two ways, both in the running app's project:

- **No code** — Configure UI → Forms → New form → design → Publish → Add to menu.
- **With Claude** — open Claude in the project folder and give it this (it is
  also beside the sample, with a Copy button):

  > Create a new UI for farming departments. One record is a farming department
  > with: Name (required), Region (dropdown: North, South, East, West), Area in
  > acres (number, at least 0), Started on (date), Certifications (choose several:
  > Organic, Fair trade, Rainforest), Inspection at (date and time), Licence
  > (file: .pdf or .jpg), Notes (long text). Show Name, Region and Area in the
  > list. Follow "Create a new UI" in CLAUDE.md.

  Claude follows `CLAUDE.md`: the screens and server hooks and model
  (`npx xeplr-factory screens … --no-pages`), the page with its front-end hooks,
  the route, the side-rail item and its menu row. Then restart the sign-in
  service and the API — the API publishes the new screens and creates the table.

## Commands in a generated project

| Where | Command | Does |
|---|---|---|
| `api/` | `npm run setup` | create both databases, the sign-in tables, permissions and menus |
| `api/` | `npm run start-auth` | the sign-in service |
| `api/` | `npm run start-api` | the API — runs migrations and publishes never-published screens on start |
| `api/` | `npm run migrate:auth` | apply new `migrations-auth/*.sql` (e.g. a new menu row) |
| `api/` | `npm run db:encrypt` | redo the encrypted database connection |
| `api/` | `npx xeplr-factory screens screens/<form>/<form>.entity.json -o screens/<form> --no-pages` | a form's screens, server hooks and model from its spec |
| `api/` | `npx xeplr-factory validate <screen>.json` | check a screen document |
| `ui/` | `npm run dev` | the app |

## Changing the database connection later

A password rotates, the database moves, or the first answer was wrong. From
the project's `api` folder:

```bash
npm run db:encrypt
```

It reads the encryption key out of your settings, asks for the database
details, and rewrites every connection setting for you.

The same thing without a project to run it in — before `npm install`, or from
any other folder — is `npx @xeplr/cli encrypt`. It asks for the key too, and
prints the result rather than writing it.

## If you skip the connection question

The setting is left **blank**, with `npx @xeplr/cli encrypt` written directly
above it in `api/development.env`.

That is deliberate. Host, port, user and password are encrypted together into a
single string, and a guessed value would start cleanly, migrate, serve traffic,
and read as *empty data* rather than as an error — the most expensive way for
this to go wrong. Until you fill it in, the app refuses to start and names the
setting.

The same rule applies to every database name and storage path in a xeplr app:
no defaults, ever.

## Questions it asks

| | |
|---|---|
| Project name | the folder, and the database prefix |
| Port decade | three consecutive ports — ui, sign-in, api |
| Super admin email | the account you sign in with |
| Super admin password | its password |
| Multi-tenant? | no — or the levels, outermost first: `company`, `company, workspace` |
| Flows — is Xeplr Workflow running? | no — or its address (`http://localhost:19122`) and its backend folder. Yes adds **Configure UI → Flows**, a `/journey/<key>` page, and `/api/flows` forwarded to Workflow |
| Database connection | host, port, user, password — or skip, and fill it in later |

Encryption keys and signing secrets are **generated, never asked**.

**Flows need Workflow to share the app's sign-in.** Workflow is a separate
service, not a package the project installs: set its `AUTH_URL` and
`AUTH_DB_NAME` to the new app's, and the app's sign-in service loads Workflow's
access rules from the folder you gave. The generated README says exactly which
values.

## Licence

MIT
