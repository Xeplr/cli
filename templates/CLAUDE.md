# __NAME__

An xeplr app: `api/` (Node, @xeplr/base-apis, sign-in by @xeplr/auth) and `ui/` (React + Vite, @xeplr/ui-account).
Forms are **screens** made with @xeplr/ui-factory and served by @xeplr/factory. The sample is **Tasks**.

Read `api/node_modules/@xeplr/ui-factory/AUTHORING.md` for what screens, hooks and models mean. This file says where they go in **this** app.

## Create a new UI

A new UI is a **form**: a list, and an add / edit form it opens — on a page of its own (like Tasks) or in a popup — saved in its own table. Use the singular for `<form>` (`farming_department`), the plural for the page (`FarmingDepartments`).

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
6. **Route and side-rail item** — `ui/src/App.jsx`: import the list page, add `<Route path="/<forms>" element={<Forms />} />` next to `/tasks`, and a `drawerItems` entry `{ key: '<Forms>', icon, clickHandler }` — by **key**, with an **icon** (a collapsed rail shows icons only). Never write the label in code.
7. **The menu row** — `api/migrations-auth/000N_<forms>_menu.sql` (next free number): copy `0002_tasks_menu.sql`, its `name` being the **key** spelled exactly as in `drawerItems` — an unknown key is dropped silently. Set `label` only if it should read differently; people can rename it later in Configure UI → Menu. Then, in `api/`: `npm run migrate:auth`, and restart the sign-in service.
8. **Restart the API.** It publishes screens that were never published — creating the table — and logs `[api] published screens: <form>_edit, <form>_list`.
9. **Check** — open the page, New, fill in the form; the popup says "All changes saved" and the row is in the table.

Then change only what the request asks for:

| the request says… | change |
|---|---|
| a field, label, rule, dropdown, layout, colour | the screen JSON → validate → publish in Configure UI → Forms (or, never published yet, restart the API) |
| hide / filter rows on screen, an extra button on each row, fill in a value before saving, check something before Next moves on | front-end hooks — `ui/src/pages/Edit<Form>.jsx` (`get`, `save`, `delete`, `actions`, `step`) |
| must / only if / check against / email when / only managers see | server hooks — `api/screens/<form>/<form>.hooks.js` |
| store as / convert / comma-separated ↔ array / work out X from Y | server model — `api/screens/<form>/<form>.model.js` |
| a query in your own server code | `factory.table('<forms table>')` — this company, active rows, the model applied |

**Without code:** Super Admin can also make a form in **Configure UI → Forms** (settings menu, top right): New form (label + key) → design → Publish → Add to menu. It gets no page, hooks or model files; add them with the steps above when it needs them.

### The controls a field can be

`text` (default), `textarea`, `number`, `date`, `datetime`, `checkbox`, `dropdown`, `radio`, `multiselect`, `file`, plus `stepper` and `label`. The sample uses every one — read `api/screens/task/task.entity.json` for how each is written. Three are worth knowing about:

- **`multiselect`** — several ids in ONE text column, comma separated, and an array in your code. An option's id may not contain a comma.
- **`file`** — the column holds the **path**, never the file. Say which extensions (`"accept": ".pdf,.docx"`) and how large (`"maxSize": 10`, in MB); the API enforces both, by extension, and keeps the file under `FACTORY_FILES_DIR`. Uploading needs `multer` in `api/` (already in package.json).
- **`stepper`** — a journey across the top. Every other field says which step it is on (`"step": "Planning"`), and one without a `step` shows on every step. `step(ctx)` in the front-end hooks runs before each move: return `false` to stay, a step's key to go there, `ctx.disable(['planning'])` to rule steps out (struck through on the bar, passed over by Next and Back) and `ctx.enable()` to bring them back.

**A list opens its form on a page or in a popup** — `"openIn": "page"` in the entity spec, or Configure UI → Forms → the list. A page needs `onOpenRecord` on the list's page (where to navigate) and `onDone` on the form's page (where Done goes back to): `Tasks.jsx` and `EditTask.jsx` show both, with routes `/tasks/new` and `/tasks/:id` in `App.jsx`.

**Keys and labels.** A form's key names its screens and table and never changes once published; its label is the screens' name. A menu item's key (`menus.name`) is what `drawerItems` matches; its label is what the rail shows, renamed in Configure UI → Menu. Code only ever uses keys.

### The prompt

> Create a new UI for **farming departments**. One record is a farming department with: **Name** (required), **Region** (dropdown: North, South, East, West), **Area in acres** (number, at least 0), **Started on** (date), **Certifications** (choose several: Organic, Fair trade, Rainforest), **Inspection at** (date and time), **Licence** (file: .pdf or .jpg), **Notes** (long text). Show Name, Region and Area in the list. Follow "Create a new UI" in CLAUDE.md.

Replace the bold parts. Add behaviour in the same message if you want it — "a Mark active button on each row", "Region is required when Area is over 100", "store tags as an array".

## Rules

- **Records live in real tables, one column per field — never JSON.** A screen's design is the only JSON, in the `factory_screens` table.
- **Never rename a field that is already a column** — it would drop the column and its data. Add a new field instead.
- A published screen's design lives in the **database**. Editing its `.screen.json` changes nothing afterwards: publish the change in Configure UI → Forms.
- Every data address is under `/api` (a page and a data path must never collide). New routes go in `api/routes/index.js`, and `ui/vite.config.js` must proxy their prefix.
- Designing and publishing are **Super Admin only** (`api/routes/access.js`); every other route checks the permission catalog.
- The browser is not a security boundary: anything that must hold goes in server hooks.
- Hooks and models are **methods** calling `super` — never arrow-function properties.
- `authFetch` returns the parsed body, not a Response.
