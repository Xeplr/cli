# @xeplr/cli

Creates a working xeplr application — an API, sign-in, and a UI — from four
questions.

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
- **A sample form** — a table, a model, one line of routing, and a page, with
  instructions beside it showing how to add your own.
- **A welcome screen** that checks it can reach everything and tells you which
  files to change first.

## Before you start

- **Node.js** 18 or later
- **PostgreSQL**, running, with a user allowed to create databases

Works on macOS, Linux and Windows. Nothing it generates depends on a unix
shell.

## Then

```bash
cd myapp/api
npm install
npm run setup        # creates both databases and their tables
npm run start-auth   # sign-in
npm run start-api    # your API

cd ../ui
npm install
npm run dev
```

Open the UI and sign in with the account you named.

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

Encryption keys and signing secrets are **generated, never asked**.

## Licence

MIT
