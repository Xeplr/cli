# __NAME__ — ui

The React app (Vite), using `@xeplr/ui-account` for sign-in and the app shell and `@xeplr/ui-factory` for forms.

```bash
npm run dev       # http://localhost:__UI_PORT__
npm run build     # → dist/
```

`.env` holds the port and where the sign-in service and the API are; `vite.config.js` proxies `/auth/api` to sign-in and `/api` (and `/health`, `/whoami`) to the API. A new data prefix must be added there too.

## Layout

| Path | What |
|---|---|
| `src/main.jsx` | `ThemeProvider` (required — the theme's colours exist only inside it) and `AccessProvider` |
| `src/App.jsx` | routes, the side rail (`drawerItems`) and the settings menu (`settingsOverrides`) — **by key**, never by label |
| `src/menu.js` | every menu key this app uses; forms added to the menu are `form:<key>` |
| `src/api/factory.js` | the calls to the API's forms routes |
| `src/pages/Tasks.jsx` | the sample list. It opens records on a **page** (`onOpenRecord` → `/tasks/new`, `/tasks/:id`), and `EditTask.jsx` is that page — it also holds the task form's **front-end hooks** (`TaskHooks extends FactoryHooks` — every method calls `super`, including `step`, run before a stepper moves) and sends **Done** back to the list |
| `src/pages/ConfigureUI.jsx` | Configure UI (Super Admin): `Forms.jsx` and `MenuSettings.jsx` tabs; `FormDesigner.jsx` designs one form |
| `src/pages/FormRecords.jsx` | opens any published form — what a form added to the menu links to |

## Rules

- `authFetch` returns the **parsed body**, not a Response — no `.json()`.
- A side-rail item needs an **icon** (a collapsed rail shows icons only) and its key must exist as a menu row, or it is dropped silently.
- Set page backgrounds on a container inside the theme, never on `body`.
