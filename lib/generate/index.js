var fs = require('fs');
var path = require('path');

var TEMPLATES = path.join(__dirname, '..', '..', 'templates');

// Files that exist ONLY in a multi-tenant app — the company tables, the picker,
// the membership check. Laid over templates/ when tenancy is on; a file here
// with the same path as one there replaces it.
var TENANCY_TEMPLATES = path.join(__dirname, '..', '..', 'templates-tenancy');

// Files whose names cannot ship as-is. `.env` and `.gitignore` are both
// swallowed on the way here — npm refuses to pack a .gitignore, and an .env in
// a published package is a mistake waiting to happen — so they travel under a
// safe name and are restored on the way out.
var RENAME = {
  'development.env.tpl': 'development.env',
  'dotenv.tpl': '.env',
  'gitignore.tpl': '.gitignore'
};

// Everything the templates can refer to. One table, so a placeholder that is
// never filled shows up as a missing key rather than as the literal
// __SOMETHING__ in a generated file.
function substitutions(answers) {
  return Object.assign({
    __NAME__: answers.name,
    __DB_API__: answers.databases.api,
    __DB_AUTH__: answers.databases.auth,
    __DB_WORKFLOW__: answers.databases.workflow,
    __PREFIX__: answers.prefix,
    __UI_PORT__: String(answers.ports.ui),
    __AUTH_PORT__: String(answers.ports.auth),
    __API_PORT__: String(answers.ports.api),
    __ENCRYPTION_KEY__: answers.secrets.encryptionKey,
    __JWT_SECRET__: answers.secrets.jwtSecret,
    __ADMIN_EMAIL__: answers.admin.email,
    __ADMIN_PASSWORD__: answers.admin.password,
    __DB_CONNECTION__: answers.connection || '',
    __CONNECTION_NOTE__: connectionNote(answers)
  }, tenancySubstitutions(answers.tenancy || []), flowsSubstitutions(answers));
}

/**
 * FLOWS ARE IN EVERY APP, and so is what runs them: @xeplr/workflow, started
 * INSIDE the API (bin/www → registerWorkflow) in the app's own database. There
 * is no Workflow server to run, no port, no setting and nothing to connect, so
 * nothing here depends on an answer — these tokens only carry text.
 */
function flowsSubstitutions(answers) {
  return {
    __WF_README__: flowsReadme(answers),
    __WF_CLAUDE__: [
      '**Flows** — forms one after another, run by `@xeplr/workflow-api` INSIDE this API (bin/www starts it, workflow.js) in a database of its own (`DB_WORKFLOW`). Design them in Configure UI → Flows, never in code: a flow is data, reached through `/api/workflow/flows`, and walked at `/journey/<key>`. After a step, a flow goes to a screen, lets one of the app\'s `decide` functions choose, or finishes. Workflow follows this app\'s tenancy — it never creates companies or workspaces of its own.',
      '',
      '**Functions** — the code around a form\'s records lives in `api/functions/`, registered with `@xeplr/actions` under the event it is for (`beforeLoad`, `beforeSave`, `afterSave`, `beforeDelete`, `onError`, or `decide` for a flow), and is picked BY NAME in the screen\'s `events` or a flow step\'s navigation. There are no hook files. A screen naming a function nobody registered is refused at publish.',
      ''
    ].join('\n')
  };
}

/**
 * The code a multi-tenant app has and a plain one does not.
 *
 * Every token exists in both, so a template can use it unconditionally: in a
 * plain app each expands to nothing, and a line holding only that token is
 * removed rather than left blank (see fill).
 */
function tenancySubstitutions(levels) {
  var on = levels.length > 0;
  var slots = {};
  levels.forEach(function (l) { slots[l.key] = { name: l.name, header: l.header }; });
  var first = levels[0];
  return {
    __MT_TENANCY_JSON__: JSON.stringify({ levels: levels, slots: slots }, null, 2),
    __MT_LEVEL_NAMES__: levels.map(function (l) { return l.label.toLowerCase(); }).join(' → '),
    __MT_SWITCH_NAME__: on ? 'Switch ' + first.label.toLowerCase() : '',
    __MT_TABLES_SQL__: levels.map(tenantTableSql).join('\n'),

    // api/db/setup.js
    __MT_DB_REGISTER__: on ? [
      '',
      '// TENANCY — the levels data belongs to (' + levels.map(function (l) { return l.label.toLowerCase(); }).join(', ') + '), from tenancy.js.',
      '// The UI registers the same ones, so its requests carry the same headers.',
      "require('@xeplr/db').registerMTs(require('../tenancy').slots);"
    ].join('\n') : '',

    // api/app.js
    __MT_APP_REQUIRE__: on ? [
      "var { mtMiddleware } = require('@xeplr/db');",
      "var tenants = require('./routes/tenants');"
    ].join('\n') : '',
    __MT_APP_MIDDLEWARE__: on ? [
      '    // Puts the request\'s ' + levels.map(function (l) { return l.header; }).join(' / ') + ' on every query: rows are',
      '    // stamped with it on insert, and only its rows are read.',
      '    middleware: [mtMiddleware()],'
    ].join('\n') : '',
    __MT_APP_ROUTES__: on ? [
      '      // The ' + levels.map(function (l) { return l.table; }).join(' / ') + ' the picker lists and adds to.',
      "      '/api/tenants': tenants.router,"
    ].join('\n') : '',
    __MT_MEMBER_GATE__: on ? 'tenants.memberGate' : 'access.anyone',
    __MT_MEMBER_NOUN__: on ? levels.map(function (l) { return l.label.toLowerCase(); }).join(' and ') : 'data (no tenancy: nothing to check)',

    // ui/src/main.jsx
    __MT_UI_IMPORTS__: on ? [
      "import { registerMTs } from '@xeplr/ui-account'",
      "import { tenancy } from './tenancy.js'"
    ].join('\n') : '',
    __MT_UI_REGISTER__: on ? [
      '',
      '// TENANCY — the same levels as the API. authFetch then sends the chosen',
      '// ' + levels.map(function (l) { return l.label.toLowerCase(); }).join(' and ') + ' on every request.',
      'registerMTs(tenancy.slots)'
    ].join('\n') : '',

    // ui/src/App.jsx
    __MT_APP_UI_IMPORTS__: on ? "import SelectScope, { ScopeGate } from './pages/SelectScope.jsx'" : '',
    __MT_MENU_KEY__: on ? "  'Switch " + first.label.toLowerCase() + "'," : '',
    __MT_DRAWER_ITEM__: on ? "    { key: 'Switch " + first.label.toLowerCase() + "', icon: SwitchIcon, clickHandler: () => navigate('/select') }," : '',
    __MT_SWITCH_ICON__: on ? [
      'const SwitchIcon = (',
      '  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"',
      '       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">',
      '    <path d="M17 1l4 4-4 4" /><path d="M3 11V9a4 4 0 0 1 4-4h14" />',
      '    <path d="M7 23l-4-4 4-4" /><path d="M21 13v2a4 4 0 0 1-4 4H3" />',
      '  </svg>',
      ')',
      ''
    ].join('\n') : '',
    __MT_SELECT_ROUTE__: on ? [
      '      {/* Picking the ' + levels.map(function (l) { return l.label.toLowerCase(); }).join(' and ') + ' — signed in, but outside the gate below. */}',
      '      <Route element={<ProtectedRoute><Shell /></ProtectedRoute>}>',
      '        <Route path="/select" element={<SelectScope />} />',
      '      </Route>',
      ''
    ].join('\n') : '',
    __MT_GATE_OPEN__: on ? '<ScopeGate>' : '',
    __MT_GATE_CLOSE__: on ? '</ScopeGate>' : ''
  };
}

/** The README's Flows section. */
function flowsReadme(answers) {
  var tenancy = answers.tenancy || [];
  return [
    '## Flows',
    '',
    'Your forms, one after another. Design one in **Configure UI → Flows**: pick the screens, and for each one say what runs around its records (its **events**) and where the journey goes once it is saved — a screen, a **function that decides**, or the end. Publish it, and people start it from **Flows** in the side rail (or at `/journey/<key>`). The run id joins the address once it starts, so a journey can be reloaded, left, or handed to someone else and opened on the step it is on.',
    '',
    'Flows are run by **`@xeplr/workflow-api`**, **inside this API** — `bin/www` starts it after the screens. Nothing else to start:',
    '',
    '| | |',
    '|---|---|',
    '| **Database** | its own, `DB_WORKFLOW` (`' + answers.databases.workflow + '`), beside this app\'s — a sub-product embedded in an app keeps its tables apart. Created and migrated the first time the API starts. Each screen still saves into its own table in `DB_API`. |',
    '| **Tenancy** | ' + (tenancy.length
      ? 'this app\'s — flows and runs belong to the ' + tenancy.map(function (l) { return l.label.toLowerCase(); }).join(' and ') + ' chosen after signing in, checked by the same membership gate as everything else.'
      : 'none, like the rest of this app — flows belong to the whole app.') + ' Workflow never creates companies or workspaces of its own. |',
    '| **Permissions** | each route checks the caller\'s (`List flows`, `Start flow run`, `Publish flow`…), granted by `@xeplr/workflow-api`\'s `migrations-auth`, which `XEPLR_AUTH_MIGRATIONS` loads. |',
    '',
    '## Functions — your code, picked by name',
    '',
    'Code around a form\'s records — a check on save, an email after, a list narrowed to the user\'s own — is a **function** in `api/functions/`, registered with `@xeplr/actions` under the **event** it is for. A screen names it in its `events`; a flow step names a `decide` function to choose where to go next. The designer shows each event only the functions written for it, with what they are handed and return; the code stays in `api/functions/` and runs on the server.',
    '',
    '| event | runs | return |',
    '|---|---|---|',
    '| `beforeLoad` | before records are read | nothing, or a narrower `ctx.query` |',
    '| `beforeSave` | before a record is written | the values to save; `ctx.reject(message, { field })` refuses |',
    '| `afterSave` | once it is saved | (ignored) |',
    '| `beforeDelete` | before a delete | nothing; `ctx.reject` refuses |',
    '| `onError` | when load / save / delete failed | (ignored) |',
    '| `decide` | a flow step is done | the next step\'s key |',
    '',
    '`api/functions/index.js` registers two to start from: `tidyTaskTitle` (Tasks\' `beforeSave`) and `byPriority` (a `decide`). A screen that names a function nobody registered is refused when it is published, by name.',
    ''
  ].join('\n');
}

/** One level's own table: what the picker lists. Its parents' ids in mtIdN. */
function tenantTableSql(level, i) {
  var parents = i === 0 ? 'none — the outermost level' : i === 1 ? 'mtId1 holds the one above' : 'mtId1–mtId' + i + ' hold the ones above';
  return [
    '-- ' + level.label + ' (' + level.key + ', header ' + level.header + ') — parents: ' + parents + '.',
    'CREATE TABLE IF NOT EXISTS "' + level.table + '" (',
    '  "id"                  varchar(25) PRIMARY KEY,',
    '  "name"                varchar(200) NOT NULL,',
    '  "isActive"            boolean DEFAULT true,',
    '  "mtId1"               varchar(25),',
    '  "mtId2"               varchar(25),',
    '  "mtId3"               varchar(25),',
    '  "mtId4"               varchar(25),',
    '  "recordCreatedDate"   timestamptz DEFAULT now(),',
    '  "recordModifiedDate"  timestamptz DEFAULT now(),',
    '  "recordCreatedBy"     varchar(25),',
    '  "recordModifiedBy"    varchar(25)',
    ');',
    ''
  ].join('\n');
}

/**
 * The comment above the connection setting.
 *
 * Two different situations, and a reader in the second one needs a command
 * rather than an explanation of why the line is empty.
 */
function connectionNote(answers) {
  if (answers.connection) {
    return [
      '# ── Where the databases are ──',
      '# Host, port, user and password, encrypted together from what you told',
      '# the installer. One value is enough because everything needed is inside',
      '# it. Both settings use the same server.',
      '#',
      '# CHANGED? From the api folder, this replaces both lines for you:',
      '#',
      '#   npm run db:encrypt'
    ].join('\n');
  }
  return [
    '# ═══════════════════════════════════════════════════════════════════════',
    '#  FILL THESE IN BEFORE STARTING ANYTHING',
    '#',
    '#  From the api folder, after `npm install`, this fills both lines in:',
    '#',
    '#    npm run db:encrypt',
    '#',
    '#  Before installing, or from anywhere else:',
    '#',
    '#    npx @xeplr/cli encrypt',
    '#',
    '#  Blank on purpose. A guessed database location starts cleanly, migrates,',
    '#  serves traffic, and reads as EMPTY DATA rather than as an error — so',
    '#  nothing is guessed. Until these are filled in the app refuses to start',
    '#  and names them.',
    '# ═══════════════════════════════════════════════════════════════════════'
  ].join('\n');
}

function fill(body, subs) {
  // A line holding nothing but a token that expands to nothing goes entirely —
  // the plain app's files read as if the tenancy lines were never there.
  body = body.replace(/^[ \t]*(__[A-Z][A-Z0-9_]*[A-Z0-9]__)[ \t]*\r?\n/gm, function (line, token) {
    return subs[token] === '' ? '' : line;
  });
  // The inner name must START and END with a letter or digit.
  //
  // Without that, a greedy match on `__PREFIX___PORT` takes `__PREFIX___` —
  // swallowing the underscore that belongs to `_PORT` — and then complains
  // about a token nobody wrote. Anchoring both ends makes `__PREFIX__` the
  // only possible match, leaving `_PORT` alone.
  return body.replace(/__([A-Z][A-Z0-9_]*[A-Z0-9])__/g, function (token) {
    // An unknown placeholder is a bug in the templates, and leaving it in the
    // generated file would be found much later by somebody who did not write
    // it. Fail here, naming the token.
    if (!(token in subs)) throw new Error('Template refers to ' + token + ', which nothing fills in');
    return subs[token];
  });
}

function isBinary(file) {
  return /\.(png|jpe?g|gif|ico|woff2?|ttf)$/i.test(file);
}

function walk(dir) {
  var out = [];
  fs.readdirSync(dir).forEach(function (entry) {
    var full = path.join(dir, entry);
    if (fs.statSync(full).isDirectory()) return out.push.apply(out, walk(full));
    out.push(full);
  });
  return out;
}

/**
 * Write the project.
 *
 * REFUSES TO OVERWRITE. Generating into a folder that already has something in
 * it is how somebody loses work they had not committed, and the check is one
 * line.
 *
 * @param {object} answers  from lib/questions.js
 * @param {string} target   absolute path of the folder to create
 * @returns {{ written: string[] }}
 */
function generate(answers, target) {
  if (isOccupied(target)) {
    throw new Error(target + ' already exists and is not empty.');
  }

  var subs = substitutions(answers);
  var written = [];

  var sources = {};
  walk(TEMPLATES).forEach(function (src) { sources[path.relative(TEMPLATES, src)] = src; });
  if (answers.tenancy && answers.tenancy.length) {
    walk(TENANCY_TEMPLATES).forEach(function (src) { sources[path.relative(TENANCY_TEMPLATES, src)] = src; });
  }

  Object.keys(sources).forEach(function (rel) {
    var src = sources[rel];
    var dir = path.dirname(rel);
    var base = path.basename(rel);
    var outName = RENAME[base] || base;
    var dest = path.join(target, dir, outName);

    fs.mkdirSync(path.dirname(dest), { recursive: true });

    if (isBinary(src)) {
      fs.copyFileSync(src, dest);
    } else {
      fs.writeFileSync(dest, fill(fs.readFileSync(src, 'utf8'), subs));
    }

    // bin/www is executed directly, so it has to keep the bit that says so.
    //
    // Wrapped because this is a unix idea. Windows has no executable bit —
    // chmod there only touches the read-only flag — and a filesystem that
    // refuses it entirely must not take the whole generation down over a
    // permission that platform does not use.
    if (outName === 'www') {
      try { fs.chmodSync(dest, 0o755); } catch (err) { /* not a unix filesystem */ }
    }

    written.push(path.join(dir, outName));
  });

  return { written: written.sort() };
}

/** A folder that exists and has something in it — generating there could overwrite work. */
function isOccupied(target) {
  return fs.existsSync(target) && fs.readdirSync(target).length > 0;
}

module.exports = { isOccupied: isOccupied, generate: generate, substitutions: substitutions, fill: fill };
