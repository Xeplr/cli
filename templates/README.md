# __NAME__

An xeplr application, created by [`@xeplr/cli`](https://www.npmjs.com/package/@xeplr/cli).

```
__NAME__/
├─ api/        the API and the sign-in service          → api/README.md
├─ ui/         the React app                           → ui/README.md
└─ CLAUDE.md   how to change this app — for Claude, and a good read for people
```

## Start it

Needs **PostgreSQL** and **Redis** running.

```bash
cd api && npm run start-auth     # sign-in           http://localhost:__AUTH_PORT__
cd api && npm run start-api      # the API           http://localhost:__API_PORT__
cd ui  && npm run dev            # the app           http://localhost:__UI_PORT__
```

Open http://localhost:__UI_PORT__ and sign in as `__ADMIN_EMAIL__`.

## What is in it

- **Sign-in** — login, register, password reset, profile, and the admin screens for users, roles and permissions (`@xeplr/auth`, `@xeplr/ui-account`).
- **Tasks** — a sample built from screens: a list, and a form it opens in a popup, saved into an ordinary `tasks` table.
- **Configure UI** — in the settings menu, for Super Admin: every form (make one, design it, publish it, add it to the side rail) and the side rail itself (rename, reorder, hide).

## Create a new UI

- **Without code** — Configure UI → Forms → New form → design → Publish → Add to menu.
- **With Claude** — open Claude in this folder and give it (change the name and the fields):

  > Create a new UI for farming departments. One record is a farming department with: Name (required), Region (dropdown: North, South, East, West), Area in acres (number, at least 0), Started on (date), Notes (long text). Show Name, Region and Area in the list. Follow "Create a new UI" in CLAUDE.md.

## Rules this app follows

| Rule | Why |
|---|---|
| Records live in **real tables**, one column per field — never JSON. | Reports stay plain SQL. |
| A **key** and a **label**, everywhere: code uses keys (form keys, menu keys); people read labels, renamed in Configure UI. | Renaming what people see never breaks code. |
| **`REDIS_PREFIX`** in `api/development.env` is required and unique to this app. | Apps sharing a Redis would otherwise serve each other's sessions and permissions. |
| Designing and publishing forms is **Super Admin only**. | Publishing changes database tables. |
| Rules that must hold go in **server hooks**; the browser only shapes what people see and send. | The browser is not a security boundary. |
| Every data address is under **`/api`**. | A page and a data path must never collide. |

The full list, and where each piece lives, is in `CLAUDE.md`.
