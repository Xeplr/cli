var fs = require('fs');
var path = require('path');

var TEMPLATES = path.join(__dirname, '..', '..', 'templates');

// Files that exist ONLY in a multi-tenant app — the company tables, the picker,
// the membership check. Laid over templates/ when tenancy is on; a file here
// with the same path as one there replaces it.
var TENANCY_TEMPLATES = path.join(__dirname, '..', '..', 'templates-tenancy');

// Files that exist ONLY in an app connected to Xeplr Workflow — the route that
// forwards flows to it, the designer, and the page a journey runs on.
var FLOWS_TEMPLATES = path.join(__dirname, '..', '..', 'templates-flows');

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
  }, tenancySubstitutions(answers.tenancy || []), flowsSubstitutions(answers.workflow || null, answers));
}

/**
 * The lines an app connected to Xeplr Workflow has, and one without it does
 * not. Like tenancy, every token exists either way and expands to nothing when
 * flows are off, so no template needs a condition of its own.
 */
function flowsSubstitutions(workflow, answers) {
  var on = Boolean(workflow);
  return {
    __WF_ENV__: on ? [
      '# ── Flows (Xeplr Workflow) ──',
      '# Your forms, one after another — Workflow runs the journey. It is a separate',
      '# service: start it, and point it at THIS app\'s sign-in (see README, "Flows").',
      'WORKFLOW_URL=' + workflow.url,
      ''
    ].join('\n') : '',
    // Workflow's access rules — who may design a flow, who may run one — are
    // loaded by this app's sign-in service, after the app's own.
    __WF_AUTH_MIGRATIONS__: on && workflow.dir ? ',' + workflow.dir + '/migrations-auth' : '',
    __WF_REQUIRED_ENV__: on ? "  // Where Xeplr Workflow is — flows are forwarded to it.\n  'WORKFLOW_URL'," : '',
    __WF_API_ROUTE__: on ? [
      '// Flows go to Xeplr Workflow (WORKFLOW_URL), behind this app\'s own gate.',
      "router.use('/api/flows', require('./flows'));"
    ].join('\n') : '',
    __WF_UI_IMPORTS__: on ? [
      "import FlowDesigner from './pages/FlowDesigner.jsx'",
      "import Journey from './pages/Journey.jsx'"
    ].join('\n') : '',
    __WF_UI_ROUTES__: on ? [
      '        <Route path="/configure/flows/:flow" element={<FlowDesigner />} />',
      '        {/* A journey: its run id joins the address once it starts, so it can be resumed. */}',
      '        <Route path="/journey/:flow" element={<Journey />} />',
      '        <Route path="/journey/:flow/:run" element={<Journey />} />'
    ].join('\n') : '',
    __WF_TAB_IMPORT__: on ? "import Flows from './Flows.jsx'" : '',
    __WF_TAB__: on ? "  { id: 'flows', label: 'Flows', Page: Flows }," : '',
    __WF_TAB_NOTE__: on ? '//   Flows  forms one after another — what is filled in decides the next; run by Xeplr Workflow' : '',
    __WF_README__: on ? flowsReadme(workflow, answers) : '',
    __WF_CLAUDE__: on ? [
      '**Flows** — forms one after another, run by Xeplr Workflow (`WORKFLOW_URL`). Design them in Configure UI → Flows, never in code: a flow is data in Workflow, reached through `/api/flows`, and walked at `/journey/<key>`. An arrow tests one field of the screen it leaves; a form that is a step must be published first.',
      ''
    ].join('\n') : ''
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

/**
 * The README's Flows section — what a flow is, and the one thing that has to
 * be true for it to work: Workflow and this app share a sign-in.
 */
function flowsReadme(workflow, answers) {
  return [
    '## Flows',
    '',
    'Your forms, one after another: what someone fills in on one decides which comes next. Design one in **Configure UI → Flows**, publish it, and open it at `/journey/<key>`. The run id joins the address once it starts, so a journey can be reloaded, left, or handed to someone else and opened on the step it is on.',
    '',
    'Flows are run by **Xeplr Workflow**, a separate service at `WORKFLOW_URL` (' + workflow.url + '). The API forwards `/api/flows/…` to it unchanged; each screen still saves into its own table.',
    '',
    'Workflow keeps every journey inside a **company and a workspace** — the two levels it registers — which is why this app has exactly those: a flow is made, and a run started, in the company and workspace picked after signing in.',
    '',
    '**Workflow must use this app\'s sign-in.** In Workflow\'s own `development.env`:',
    '',
    '```sh',
    'AUTH_URL=http://localhost:' + answers.ports.auth + '      # this app\'s sign-in service',
    'AUTH_DB_NAME=' + answers.name + '_auth               # and its database',
    'REDIS_PREFIX=' + answers.name + ':',
    '```',
    '',
    'If Workflow\'s database server is not this app\'s, also set `AUTH_DB_CONNECTION_INFO_ENCRYPTED` in Workflow to this app\'s server, encrypted with **Workflow\'s** `ENCRYPTION_KEY` (`npm run db:encrypt` in Workflow\'s backend). Otherwise every flow call fails with *database "' + answers.name + '_auth" does not exist*.',
    '',
    workflow.dir
      ? 'Its access rules — who may design a flow, who may run one — are loaded by this app\'s sign-in service from `' + workflow.dir + '/migrations-auth` (in `XEPLR_AUTH_MIGRATIONS`). Restart the sign-in service after changing it.'
      : 'Its access rules — who may design a flow, who may run one — live in Workflow\'s `backend/migrations-auth`. Add that folder to `XEPLR_AUTH_MIGRATIONS` in `api/development.env` (comma separated, after `./migrations-auth`) and restart the sign-in service; until then, flows answer 403.',
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

  // Workflow files every flow and run under a company; an app without
  // companies would build, start, and then refuse every flow it tried to make.
  if (answers.workflow) {
    var q = require('../questions');
    if (!q.sameLevels(answers.tenancy || [], q.tenancyLevels(q.WORKFLOW_LEVELS))) {
      throw new Error('Flows need the same multi-tenancy as Xeplr Workflow — levels "' + q.WORKFLOW_LEVELS + '" — because Workflow keeps every journey inside a company and a workspace.');
    }
  }

  var subs = substitutions(answers);
  var written = [];

  var sources = {};
  walk(TEMPLATES).forEach(function (src) { sources[path.relative(TEMPLATES, src)] = src; });
  if (answers.tenancy && answers.tenancy.length) {
    walk(TENANCY_TEMPLATES).forEach(function (src) { sources[path.relative(TENANCY_TEMPLATES, src)] = src; });
  }
  if (answers.workflow) {
    walk(FLOWS_TEMPLATES).forEach(function (src) { sources[path.relative(FLOWS_TEMPLATES, src)] = src; });
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
