# Building __NAME__, step by step

Everything it takes to grow this app into a full application — and, for each
step, whether it is a **click** (Configure UI, as Super Admin, no code) or
**code** (a function you write in `api/`, which the designer then lets you
pick from a dropdown).

The split is deliberate. **A screen holds no code**: what it looks like, its
fields and its rules are a document you design. What it **does** — a button
that changes a status, a list worked out from three tables, an email after a
save — is a function on the server, written once and **picked by name** in the
designer. So:

1. you write the function in `api/functions/` and restart the API;
2. it appears in the designer's dropdown for what it was written for;
3. you pick it, give it its values, and publish.

Publishing refuses a function nobody registered, one written for something
else, or a value it does not take — by name — so a mistake is found then, not
when somebody presses the button.

| | Step | How |
|---|---|---|
| 1 | [Lists other forms choose from](#1-masters--click) — departments, statuses | **Click** |
| 2 | [A form and its list](#2-a-form-and-its-list--click) — the records, in a real table | **Click** |
| 3 | [The side rail](#3-the-side-rail--click) | **Click** |
| 4 | [Who may do what](#4-who-may-do-what--click) | **Click** |
| 5 | [Forms one after another](#5-flows--click) | **Click** (plus a function to choose the next step) |
| 6 | [What the app does](#6-what-the-app-does--code-then-click) — buttons, worked-out lists, rules, emails | **Code**, then **click** |
| 7 | [What a screen cannot say yet](#7-what-a-screen-cannot-say-yet--code) — a page written by hand | **Code** |

Everything below is in **Configure UI**: the settings menu, top right, for
Super Admin only.

---

## 1. Masters — click

**Configure UI → Masters.** The small lists the rest of the app points at:
departments, statuses, categories. A master is an ordinary form with a flag,
so it has a table, a list and an edit form like any other. Make them first —
a dropdown on another table needs that table to exist.

## 2. A form and its list — click

**Configure UI → Forms → New form.**

1. Give it a **label** (what people read, renamed any time) and a **key**
   (`farming_department` — it names the table and never changes once
   published).
2. **Design → Form**: drag controls onto the sheet, or click one to add it.
   Select a control to set its label, field name, required, default, rules
   and look.
3. **Design → List**: which columns the list shows, its title, its look.
4. **Publish.** This creates the table — one column per field — or changes it
   to match. Removing a field asks first, because its column and data go.
5. **Add to menu.** It is now in the side rail, at `/forms/<key>`: the list,
   with New and Edit opening the form in a popup.

What a form can hold, all by clicking:

| | |
|---|---|
| **Inputs** | text, long text, number, date, date and time, tick box, dropdown, radio buttons, several from a list, file (gallery, camera, several), text with suggestions* |
| **Ready-made fields** | email, phone, website, LinkedIn, age, date of birth, gender, country, amount, percentage, yes / no, postal code — keyboard, format check and options included |
| **Rules** | required, min / max, length, pattern, file types and size — checked in the browser **and** on the server |
| **Dropdowns** | a fixed list of options, or the rows of another table (a master) |
| **Layout** | steps across the top (or tabs), headings and text, colours, fonts, sizes. On a phone the form stacks itself |
| **Rows that belong to it** | a **Form** control (Data → Form): another form drawn inside this one, saving into its own table — an order's lines |
| **Buttons, details, comments, worked-out lists*** | Actions → Buttons; Data → Details, Comments & history, List — see step 6 |

\* These run a function — step 6.

Change a published form at any time the same way: design, then **Publish**.
Never rename a field that is already a column (its data would be left
behind) — add a new field instead.

## 3. The side rail — click

**Configure UI → Menu**: rename, reorder and hide the side rail's items. The
label is what people read; the key underneath never changes, so renaming
breaks nothing.

## 4. Who may do what — click

**Admin** (settings menu): users, roles, and the permissions each role has.
Activate new accounts there. Designing and publishing forms stays Super Admin
only (`api/routes/access.js`).

A button only some people may press — Reopen, for managers — checks the
caller's roles inside its function (step 6, `system.access.roles`).

## 5. Flows — click

**Configure UI → Flows**: forms one after another — a sign-up, then its
documents, then a review. For each step: which form, what runs around its
records (its **events**, step 6), and where it goes once saved: another form,
the end, or **a function that decides** (`decide`, step 6). People start a
flow from **Flows** in the side rail; a half-done one can be left and resumed.

Not here: approvals (another person's turn, with an assignee and a timeout).

---

## 6. What the app does — code, then click

### The pattern, every time

1. **Write the function** in a file under `api/functions/`, for example
   `api/functions/orders.js`, and add `require('./orders')` to
   `api/functions/index.js`.
2. **Register it** with `@xeplr/actions` — a `name`, the **`event`** it is
   for (the table below), a `description` people read in the designer, and
   `execute`.
3. **Restart the API** (`npm run start-api`) — functions are loaded at start.
4. **Pick it** in the designer, where the table says. The dropdown offers only
   the functions written for that purpose; if there are none it says which
   event to register.
5. **Publish** the form.

```js
// api/functions/orders.js
var { register } = require('@xeplr/actions');

register({
  name: 'setOrderStatus',
  event: 'button',
  description: 'Sets the order status',
  execute: async function ({ input, system }) { /* … */ }
});
```

Every function runs **on the server**, sees only the signed-in person's
company, and can refuse with `ctx.reject('message', { field })` — the message
shows on that field.

### Which event, and where you pick it

| I want… | `event` | Pick it in the designer | Gets | Returns |
|---|---|---|---|---|
| **A button** — set a status, confirm, approve, merge | `button` | select a **Buttons** control (Actions → Buttons) → a button → **Runs** | `{ input, system }` — `input`: the button's values; `system`: `record`, `id`, `user`, `access`, `db`, `knex`, `reject` | `{ message }` — shown to the person |
| **A checklist or choice inside a button's popup** — the products still out | `buttonOptions` | the button → Ask first → Asks for → a checklist → **Entries from** | `ctx.record`, `ctx.id`, `ctx.field` | `[{ id, label, sub?, image? }]` |
| **A list worked out by you** — from several tables, with search, filter chips, KPI cards and a date range | `listRows` | select the **List** → **Rows from** (then Filter chips, KPI cards, Date range in the same panel) | `ctx.query` — `{ q, filter, kpi, from, to }`; on a record's screen `ctx.record` | `{ rows, counts: { chip: n }, kpis: { card: n } }` |
| **A hover box on a list cell** — the last activity | `rowDetails` | the List → a column drawn as activity → **Hover box from** | `ctx.id`, `ctx.column` | `[{ text, sub?, at? }]` |
| **What is known about a record** — its products, contact, delivery | `recordDetails` | a **Details** control (Data → Details) → **Details from** | `ctx.record`, `ctx.id`, `ctx.query.more` | `{ sections: [{ title, rows: [{ label, text }] }] }` |
| **Comments and history** on a record | `feedEntries` | a **Comments & history** control → **Entries from** | `ctx.record`, `ctx.id` | `[{ id, kind: 'comment' \| 'event', text, author?, at? }]` |
| **Suggestions as someone types** — a product from the shop | `suggest` | an **Autocomplete** field → **Suggestions from** | `ctx.query.q` | `[{ value, label?, sub?, fill? }]` |
| **A rule on save** — must / only if / check against, or work a value out | `beforeSave` | the form's designer, nothing selected → **Server rules** → **Before save** — it runs wherever the form is used | `ctx.values`, `ctx.isNew`, `ctx.previous` | the values to save; or `ctx.reject(…)` |
| **Something after a save** — an email, another record | `afterSave` | Server rules → **After save** | `ctx.result` (the saved row), `ctx.isNew` | — |
| **Only some rows** — a person sees their own | `beforeLoad` | Server rules → **Before load** | `ctx.query` (narrow it) | — |
| **A check before delete** | `beforeDelete` | Server rules → **Before delete** | `ctx.previous` | — (or `ctx.reject`) |
| **When load / save / delete failed** | `onError` | Server rules → **On error** | `ctx.error` | — |
| **Where a flow goes next** | `decide` | Configure UI → Flows → a step → **Let a function decide** | `ctx.values`, `ctx.targets` | one of `ctx.targets` |

Every `ctx` also has `user`, `access` (`{ roles }`), `tenant`, `knex` (the
database) and `db(table)` (a table, this company's active rows only).

### Recipes

**A row of status buttons — one function, not one per status.** Register it
with an `inputSchema` saying what it takes; `options` are the values allowed,
and the designer shows them as a dropdown per button:

```js
register({
  name: 'setOrderStatus', event: 'button',
  description: 'Sets the order status',
  inputSchema: [
    { name: 'status', type: 'string', required: true,
      options: [{ value: 'packed', label: 'Packed' }, { value: 'shipped', label: 'Shipped' }] },
    { name: 'note', type: 'string' }
  ],
  execute: async function ({ input, system }) {
    await system.db('orders').where('id', system.id).update({ status: input.status });
    return { message: 'Now ' + input.status };
  }
});
```

Then, on the order's form: **Actions → Buttons**, add *Packed* and *Shipped*,
both **Runs** `setOrderStatus`, with status `packed` / `shipped`. Still by
clicking, per button:

- **Ask first** — a confirmation, a note box (the function takes `note`),
  values to type (**Asks for** — a parcel's weight), photos (`files`).
- **Shows when / Greyed out when / Shown as the current choice when** — rules
  on the record (`status` equals `packed`). The server checks them again on
  the press, so a hidden button cannot be pressed by hand.
- **Opens** a form instead of running a function — an Edit button.

A button acts on the record the form has open — a saved one.

**A board — a list with chips and KPI cards:**

```js
register({
  name: 'orderBoard', event: 'listRows',
  description: 'Open orders, newest first',
  execute: async function (ctx) {
    var q = ctx.db('orders');
    if (ctx.query.filter === 'packed') q = q.where('status', 'packed');
    if (ctx.query.from) q = q.where('placedOn', '>=', ctx.query.from);
    var rows = await q.orderBy('placedOn', 'desc');
    return { rows: rows, counts: { all: rows.length, packed: rows.filter(function (r) { return r.status === 'packed'; }).length } };
  }
});
```

Then the form's **List** → **Rows from** `orderBoard`, add the chips (*All*,
*Packed*) and, if you want them, KPI cards and a date range. The text in each
cell is what the function wrote — format dates and money there.

**A rule that must hold:**

```js
register({
  name: 'checkCreditLimit', event: 'beforeSave',
  description: 'Refuses an order over the customer\'s credit limit',
  execute: async function (ctx) {
    var customer = await ctx.knex('customers').where('id', ctx.values.customerId).first();
    if (ctx.values.amount > customer.creditLimit) ctx.reject('Over the credit limit', { field: 'amount' });
    return ctx.values;
  }
});
```

Rules that must hold always go here, on the server — never only in the
browser, where a person can skip them.

**Storing a value differently from how it is shown** (an array kept as text,
a code in capitals): the form's server **model**, `api/screens/<form>/<form>.model.js`
— see "Create a new UI" in `CLAUDE.md`.

The full reference for each — every option of a button's popup, a list's
columns, cards instead of a table — is `ui/node_modules/@xeplr/ui-factory/AUTHORING.md`
and that package's README ("Buttons", "A list whose rows a function works
out", "What is known about a record", "Comments and history"). For the server
side: `api/node_modules/@xeplr/factory/README.md`, "Events" and "Buttons and
worked-out lists".

---

## 7. What a screen cannot say yet — code

These are not in Configure UI today. Each needs files in the project:

| I want… | What to write |
|---|---|
| **A screen that is not a form and its list** — a record's own view (its details, comments and buttons, with Edit opening the form), a board of its own, a Home page with tiles | the screen as a document in `api/screens/<name>/`, registered in `api/screens/index.js`; a page that loads it (copy `ui/src/pages/FormRecords.jsx`); its route in `ui/src/App.jsx`; a side-rail item and its menu row — the steps in "Create a new UI", `CLAUDE.md`. Once it is published, its look is designed in the designer like any other |
| **A record on a page of its own**, rather than in a popup | the list page and form page pattern of Tasks — `ui/src/pages/Tasks.jsx` and `EditTask.jsx` |
| **A field that shows, hides or fills itself as another changes** | the form's front-end hooks, in its page (`EditTask.jsx` shows where). Browser only — anything that must hold goes in `beforeSave` as well |
| **Charts and dashboards** | a page written by hand — there is no chart control yet |
| **Approvals** — another person's turn, with an assignee and a timeout | not in this app's flows |
| **An address of your own** in the API — a webhook, an export | `api/routes/index.js`, plus its `apis` row and role mappings in a migration under `api/migrations-auth/` |

A page written by hand is **web only**: list it in `ui/pages.json` under
`webOnly`, with the reason, so nobody is surprised that it is missing from a
phone app. The pre-commit hook warns about every one.

If a screen *nearly* says what you need, ask for the control to be added to
`@xeplr/ui-factory` instead of writing a page around it.

---

## With Claude

Every step above can also be asked for. Open Claude in this folder:

> Create a new UI for **farming departments** … Follow "Create a new UI" in CLAUDE.md.

and, for what a form does, say it in the same message — *"a Mark active button
on each row"*, *"refuse an Area over 10,000"*, *"email the manager after a
save"*. Claude writes the function, registers it under the right event and
names it in the screen, exactly as step 6 does by hand.
