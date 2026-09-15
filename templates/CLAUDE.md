# __NAME__

An xeplr app: `api/` (Node, @xeplr/base-apis, sign-in by @xeplr/auth) and `ui/` (React + Vite, @xeplr/ui-account).
Forms are **screens** made with @xeplr/ui-factory and served by @xeplr/factory. The sample is **Tasks**.

Read `api/node_modules/@xeplr/ui-factory/AUTHORING.md` for what screens, hooks and models mean. This file says where they go in **this** app.

## Create a new UI

A new UI is a **form**: a list, and an add / edit form it opens in a popup, saved in its own table. Use the singular for `<form>` (`farming_department`), the plural for the page (`FarmingDepartments`).

Create every file below — the hooks and the model run the defaults (`super`) until the request needs more.

1. **The spec** — `api/screens/<form>/<form>.entity.json`: the name and the fields in reading order. Copy `api/screens/task/task.entity.json`; the format is "The entity spec" in AUTHORING.md. A dropdown on another form's table needs that form to exist first.
2. **Screens + server files** — from `api/`:
   ```sh
   npx xeplr-factory screens screens/<form>/<form>.entity.json -o screens/<form> --no-pages
   npx xeplr-factory validate screens/<form>/<form>-edit.screen.json
   npx xeplr-factory validate screens/<form>/<form>-list.screen.json
   ```
   Writes `<form>-list.screen.json`, `<form>-edit.screen.json`, `<form>.hooks.js` (server hooks), `<form>.model.js` (server model).
3. **Register them** in `api/screens/index.js`: both screens in `documents` (edit before list), `<form>_edit: require('./<form>/<form>.hooks')` in `hooks`, `require('./<form>/<form>.model')` in `models`.
4. **The form's page, with the front-end hooks** — `ui/src/pages/Edit<Form>.jsx`: copy `EditTask.jsx`; rename `TaskHooks` → `<Form>Hooks`, `taskHooks` → `<form>Hooks`, `'task_edit'` → `'<form>_edit'`. Keep every method calling `super`.
5. **The list's page** — `ui/src/pages/<Forms>.jsx`: copy `Tasks.jsx`; load `'<form>_list'`, import `<form>Hooks` from `./Edit<Form>.jsx`, drop `TasksHelp`.
6. **Route and side-rail item** — `ui/src/App.jsx`: import the list page, add `<Route path="/<forms>" element={<Forms />} />` next to `/tasks`, and a `drawerItems` entry with an **icon** (a collapsed rail shows icons only).
7. **The menu row** — `api/migrations-auth/000N_<forms>_menu.sql` (next free number): copy `0002_tasks_menu.sql`, with the item's name spelled **exactly** as in `drawerItems` — an unknown name is dropped silently. Then, in `api/`: `npm run migrate:auth`, and restart the sign-in service (menus are cached for 10 minutes).
8. **Restart the API.** It publishes screens that were never published — creating the table — and logs `[api] published screens: <form>_edit, <form>_list`.
9. **Check** — open the page, New, fill in the form; the popup says "All changes saved" and the row is in the table.

Then change only what the request asks for:

| the request says… | change |
|---|---|
| a field, label, rule, dropdown, layout, colour | the screen JSON → validate → publish on the Forms page (or, never published yet, restart the API) |
| hide / filter rows on screen, an extra button on each row, fill in a value before saving | front-end hooks — `ui/src/pages/Edit<Form>.jsx` |
| must / only if / check against / email when / only managers see | server hooks — `api/screens/<form>/<form>.hooks.js` |
| store as / convert / comma-separated ↔ array / work out X from Y | server model — `api/screens/<form>/<form>.model.js` |
| a query in your own server code | `factory.table('<forms table>')` — this company, active rows, the model applied |

**Without code:** Super Admin can also make a form on the **Forms** page (New form → design → Publish → Open). It gets no page, hooks or model files; add them with the steps above when it needs them.

### The prompt

> Create a new UI for **farming departments**. One record is a farming department with: **Name** (required), **Region** (dropdown: North, South, East, West), **Area in acres** (number, at least 0), **Started on** (date), **Notes** (long text). Show Name, Region and Area in the list. Follow "Create a new UI" in CLAUDE.md.

Replace the bold parts. Add behaviour in the same message if you want it — "a Mark active button on each row", "Region is required when Area is over 100", "store tags as an array".

## Rules

- **Records live in real tables, one column per field — never JSON.** A screen's design is the only JSON, in the `factory_screens` table.
- **Never rename a field that is already a column** — it would drop the column and its data. Add a new field instead.
- A published screen's design lives in the **database**. Editing its `.screen.json` changes nothing afterwards: publish the change on the Forms page.
- Every data address is under `/api` (a page and a data path must never collide). New routes go in `api/routes/index.js`, and `ui/vite.config.js` must proxy their prefix.
- Designing and publishing are **Super Admin only** (`api/routes/access.js`); every other route checks the permission catalog.
- The browser is not a security boundary: anything that must hold goes in server hooks.
- Hooks and models are **methods** calling `super` — never arrow-function properties.
- `authFetch` returns the parsed body, not a Response.
