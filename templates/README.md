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

Flows (Xeplr Workflow) run **inside the API** — nothing else to start. To run
them as their own service instead, see "Where each address goes" below.

## Where each address goes

The browser only ever calls **paths** on the app's own address — never a port.
What serves each path is decided in ONE place per environment: Vite's dev proxy
locally (`ui/vite.config.js`, from `ui/.env`), nginx in production.

| path | served by | local (`ui/.env`) | production (nginx) |
|---|---|---|---|
| `/auth/api/…` | the sign-in service | `AUTH_URL` | `127.0.0.1:<AUTH_PORT>` |
| `/api/workflow/…` | flows — `@xeplr/workflow` | `WORKFLOW_URL`, or `API_URL` when blank | the workflow process, or the API when it runs inside |
| `/api/…`, `/health`, `/whoami` | the API | `API_URL` | `127.0.0.1:<__PREFIX___PORT>` |

**Workflow on its own port.** Set `WORKFLOW_PORT` in `api/development.env`
(this app's next free port is __NEXT_PORT__), set `WORKFLOW_URL` in `ui/.env` to
`http://localhost:__NEXT_PORT__`, and start it beside the API:

```bash
cd api && npm run start-workflow   # flows            http://localhost:__NEXT_PORT__
```

Same database, same sign-in, same permissions and the same `/api/workflow/…`
paths — only the process differs. Leave `WORKFLOW_PORT` blank and it runs inside
the API again.

### Production

`api/production.env.example` lists every setting (copy it to
`api/production.env`, fill in, start with `NODE_ENV=production`). Build the UI
(`cd ui && npm run build`) and let nginx serve it and route the paths — the
more specific `/api/workflow/` first:

```nginx
server {
  server_name app.example.com;
  root /srv/__NAME__/ui/dist;

  location /auth/api/     { proxy_pass http://127.0.0.1:__AUTH_PORT__; }
  location /api/workflow/ { proxy_pass http://127.0.0.1:__API_PORT__; }   # or WORKFLOW_PORT when it runs on its own
  location /api/          { proxy_pass http://127.0.0.1:__API_PORT__; }
  location = /health      { proxy_pass http://127.0.0.1:__API_PORT__; }
  location = /whoami      { proxy_pass http://127.0.0.1:__API_PORT__; }
  location /              { try_files $uri /index.html; }   # the React app's own pages
}
```

Every one of these checks the same sign-in token, so one login covers them all.

## What is in it

- **Sign-in** — login, register, password reset, profile, and the admin screens for users, roles and permissions (`@xeplr/auth`, `@xeplr/ui-account`).
- **Tasks** — a sample built from screens: a list, and a form it opens on a page of its own, saved into an ordinary `tasks` table. The form is filled in over three steps and uses every control there is — text, a dropdown, radio buttons, a tick box, a date, a date and time, several tags at once, and a file.
- **Configure UI** — in the settings menu, for Super Admin: every form (make one, design it, publish it, add it to the side rail) and the side rail itself (rename, reorder, hide).

## Create a new UI

- **Without code** — Configure UI → Forms → New form → design → Publish → Add to menu.
- **With Claude** — open Claude in this folder and give it (change the name and the fields):

  > Create a new UI for farming departments. One record is a farming department with: Name (required), Region (dropdown: North, South, East, West), Area in acres (number, at least 0), Started on (date), Notes (long text). Show Name, Region and Area in the list. Follow "Create a new UI" in CLAUDE.md.

__WF_README__
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
