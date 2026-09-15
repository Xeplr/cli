# @xeplr/cli

Creates a working xeplr application — an API, sign-in, and a UI — from a few
questions, installs it, and sets up its databases.

```bash
npx @xeplr/cli new myapp
```

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
  open the task form in a popup, saving as you type into an ordinary `tasks`
  table. Neither is written by hand: both are screens
  ([`@xeplr/ui-factory`](https://www.npmjs.com/package/@xeplr/ui-factory)),
  published when the API first starts.
- **A Designer page** — move, add and restyle fields, then Publish; the table
  gains its new columns as you do. Only the admin roles see it, and the API
  refuses everyone else.
- **Multi-tenancy, if you ask for it** — companies (or companies and
  workspaces, up to four levels). Every row is stamped with the one it was made
  in, every read sees only its rows, membership is checked on every request,
  and choosing one is the first screen after signing in.
- **A welcome screen** that checks it can reach everything and tells you which
  files to change first.

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

Open the UI and sign in with the account you named.

`xeplr new myapp --no-install` only writes the files; then run `npm install` in
`api` and `ui`, and `npm run setup` in `api`, yourself. If set-up stops part
way (Postgres not running, say), the installer says which step and the command
to run again.

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
| Database connection | host, port, user, password — or skip, and fill it in later |

Encryption keys and signing secrets are **generated, never asked**.

## Licence

MIT
