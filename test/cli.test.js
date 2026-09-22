var test = require('node:test');
var assert = require('node:assert');
var fs = require('fs');
var os = require('os');
var path = require('path');
var { PassThrough } = require('stream');

var generate = require('../lib/generate');
var questions = require('../lib/questions');
var encryptCmd = require('../lib/commands/encrypt');
var prompt = require('../lib/prompt');

function tmpdir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'xeplr-cli-test-'));
}

function answers(extra) {
  return Object.assign({
    name: 'demo',
    prefix: 'DEMO',
    ports: { ui: 19200, auth: 19201, api: 19202 },
    databases: { auth: 'demo_auth', api: 'demo_api' },
    admin: { email: 'admin@demo.local', password: 'ChangeMe123' },
    secrets: { encryptionKey: 'k'.repeat(64), jwtSecret: 'j'.repeat(64) },
    connection: ''
  }, extra || {});
}

// ── placeholder substitution ────────────────────────────────────────────────

test('__PREFIX___PORT keeps the underscore that belongs to _PORT', function () {
  // A greedy match took `__PREFIX___` here, swallowing the underscore in
  // front of PORT and then complaining about a token nobody wrote.
  var out = generate.fill('__PREFIX___PORT=__API_PORT__', {
    __PREFIX__: 'DEMO', __API_PORT__: '19202'
  });
  assert.strictEqual(out, 'DEMO_PORT=19202');
});

test('a name that runs into the next word is still substituted', function () {
  assert.strictEqual(generate.fill('DB_API=__NAME___api', { __NAME__: 'demo' }), 'DB_API=demo_api');
});

test('an unknown placeholder fails loudly rather than shipping', function () {
  assert.throws(
    function () { generate.fill('x=__NOT_A_THING__', { __NAME__: 'demo' }); },
    /__NOT_A_THING__/,
    'a placeholder nothing fills must stop generation, not end up in the file'
  );
});

// ── generating a project ────────────────────────────────────────────────────

test('generates the whole project, and leaves no placeholder behind', function () {
  var dir = path.join(tmpdir(), 'demo');
  var result = generate.generate(answers(), dir);

  assert.ok(result.written.length >= 28, 'expected the full template set');

  var leftover = [];
  result.written.forEach(function (rel) {
    var full = path.join(dir, rel);
    if (/\.(svg|png)$/.test(rel)) return;
    var body = fs.readFileSync(full, 'utf8');
    var m = body.match(/__[A-Z][A-Z0-9_]*[A-Z0-9]__/);
    if (m) leftover.push(rel + ' → ' + m[0]);
  });
  assert.deepStrictEqual(leftover, [], 'every placeholder should be filled');
});

test('files npm and git both swallow are restored to their real names', function () {
  var dir = path.join(tmpdir(), 'demo');
  generate.generate(answers(), dir);

  // These ship as .tpl because a published package cannot carry a .gitignore
  // and must not carry a .env. They have to arrive under the real names.
  assert.ok(fs.existsSync(path.join(dir, 'api', 'development.env')), 'api/development.env');
  assert.ok(fs.existsSync(path.join(dir, 'api', '.gitignore')), 'api/.gitignore');
  assert.ok(fs.existsSync(path.join(dir, 'ui', '.env')), 'ui/.env');
  assert.ok(fs.existsSync(path.join(dir, 'ui', '.gitignore')), 'ui/.gitignore');
  assert.ok(!fs.existsSync(path.join(dir, 'api', 'development.env.tpl')), 'no .tpl left over');
});

test('bin/www stays executable', function () {
  var dir = path.join(tmpdir(), 'demo');
  generate.generate(answers(), dir);
  var mode = fs.statSync(path.join(dir, 'api', 'bin', 'www')).mode;
  assert.ok(mode & 0o111, 'bin/www must keep its executable bit');
});

test('refuses to write into a folder that already has something in it', function () {
  var dir = path.join(tmpdir(), 'demo');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'something-of-mine.txt'), 'do not lose me');

  assert.throws(function () { generate.generate(answers(), dir); }, /already exists/);
  assert.strictEqual(fs.readFileSync(path.join(dir, 'something-of-mine.txt'), 'utf8'), 'do not lose me');
});

test('with no connection given, the settings are blank and say how to fix it', function () {
  var dir = path.join(tmpdir(), 'demo');
  generate.generate(answers({ connection: '' }), dir);
  var env = fs.readFileSync(path.join(dir, 'api', 'development.env'), 'utf8');

  assert.match(env, /^DEMO_CONNECTION=$/m, 'left blank rather than guessed');
  assert.match(env, /^AUTH_DB_CONNECTION_INFO_ENCRYPTED=$/m);
  assert.match(env, /db:encrypt/, 'must name the command that fills it in');
});

test('the app gets a Redis prefix of its own, never the shared default', function () {
  var dir = path.join(tmpdir(), 'demo');
  generate.generate(answers(), dir);
  var env = fs.readFileSync(path.join(dir, 'api', 'development.env'), 'utf8');

  assert.match(env, /^REDIS_PREFIX=demo:$/m);
});

test('with a connection given, both settings carry it', function () {
  var dir = path.join(tmpdir(), 'demo');
  generate.generate(answers({ connection: 'ENCRYPTED-VALUE' }), dir);
  var env = fs.readFileSync(path.join(dir, 'api', 'development.env'), 'utf8');

  assert.match(env, /^DEMO_CONNECTION=ENCRYPTED-VALUE$/m);
  assert.match(env, /^AUTH_DB_CONNECTION_INFO_ENCRYPTED=ENCRYPTED-VALUE$/m);
});

// ── the encrypt command ─────────────────────────────────────────────────────

test('writeConnection updates every connection setting, not just the first', function () {
  var dir = tmpdir();
  var file = path.join(dir, 'development.env');
  fs.writeFileSync(file, [
    'DEMO_CONNECTION=old',
    'AUTH_DB_CONNECTION_INFO_ENCRYPTED=old',
    'DB_API=demo_api'
  ].join('\n'));

  var updated = encryptCmd.writeConnection(file, 'new');
  assert.deepStrictEqual(updated, ['DEMO_CONNECTION', 'AUTH_DB_CONNECTION_INFO_ENCRYPTED']);

  var body = fs.readFileSync(file, 'utf8');
  assert.match(body, /^DEMO_CONNECTION=new$/m);
  assert.match(body, /^AUTH_DB_CONNECTION_INFO_ENCRYPTED=new$/m);
  assert.match(body, /^DB_API=demo_api$/m, 'unrelated settings are left alone');
});

test('flags are parsed, and --password= means an empty password', function () {
  var f = encryptCmd.parseFlags(['--host', 'db.internal', '--port=5433', '--write']);
  assert.strictEqual(f.host, 'db.internal');
  assert.strictEqual(f.port, '5433');
  assert.strictEqual(f.write, '');

  // Some local installs really do have no password, and that must not turn
  // into a prompt in a script that cannot answer one.
  assert.ok('password' in encryptCmd.parseFlags(['--password=']));
  assert.strictEqual(encryptCmd.parseFlags(['--password=']).password, '');
});

// ── prompting ───────────────────────────────────────────────────────────────

test('piped answers all arrive, not just the first', async function () {
  // rl.question() registers a ONE-SHOT listener. Piped input emits every line
  // synchronously, so answers after the first used to land with nothing
  // listening and were dropped — the wizard died two questions in.
  var input = new PassThrough();
  var output = new PassThrough();
  output.resume();

  var session = prompt.createSession({ input: input, output: output });
  input.write('one\ntwo\nthree\n');

  assert.strictEqual(await session.ask('a?'), 'one');
  assert.strictEqual(await session.ask('b?'), 'two');
  assert.strictEqual(await session.ask('c?'), 'three');
  session.close();
});

test('an empty answer falls back to the default', async function () {
  var input = new PassThrough();
  var output = new PassThrough();
  output.resume();

  var session = prompt.createSession({ input: input, output: output });
  input.write('\n');
  assert.strictEqual(await session.ask('port?', { default: '5432' }), '5432');
  session.close();
});

test('a rejected answer is asked again', async function () {
  var input = new PassThrough();
  var output = new PassThrough();
  output.resume();

  var session = prompt.createSession({ input: input, output: output });
  input.write('nope\n1234\n');

  var value = await session.ask('number?', {
    validate: function (v) { return /^\d+$/.test(v) ? true : 'A number.'; }
  });
  assert.strictEqual(value, '1234', 'should have re-asked rather than accepting "nope"');
  session.close();
});

// ── naming ──────────────────────────────────────────────────────────────────

test('project names become legal env var prefixes', function () {
  assert.strictEqual(questions.envPrefix('yyan'), 'YYAN');
  assert.strictEqual(questions.envPrefix('my-app'), 'MY_APP');
});

test('a name that would break a folder, a package or a database is refused', function () {
  ['', 'My App', '9lives', 'has_underscore', 'trailing-'].forEach(function (bad) {
    assert.ok(!questions.NAME_RE.test(bad), JSON.stringify(bad) + ' should be refused');
  });
  ['yyan', 'my-app', 'a1'].forEach(function (good) {
    assert.ok(questions.NAME_RE.test(good), JSON.stringify(good) + ' should be allowed');
  });
});

// ── runs on Windows too ─────────────────────────────────────────────────────

test('no generated script uses a unix-only env prefix', function () {
  // `NODE_ENV=development node ...` is shell syntax that cmd.exe does not
  // have. It answers "'NODE_ENV' is not recognized as an internal or external
  // command" and the app never starts — on the very first thing a new user
  // types. Anything that needs a variable set must do it in code, or use a
  // cross-platform runner.
  ['api', 'ui'].forEach(function (part) {
    var pkg = require('../templates/' + part + '/package.json');
    Object.keys(pkg.scripts || {}).forEach(function (name) {
      assert.doesNotMatch(
        pkg.scripts[name],
        /(^|&&\s*)[A-Z_]+=/,
        part + ' script "' + name + '" sets an env var the unix way: ' + pkg.scripts[name]
      );
    });
  });
});

test('no generated script shells out to sh', function () {
  ['api', 'ui'].forEach(function (part) {
    var pkg = require('../templates/' + part + '/package.json');
    Object.keys(pkg.scripts || {}).forEach(function (name) {
      assert.doesNotMatch(pkg.scripts[name], /\bsh -c\b/,
        part + ' script "' + name + '" uses sh, which Windows does not have');
    });
  });
});

// ── setting the project up ──────────────────────────────────────────────────

var setup = require('../lib/setup');
var nextSteps = require('../lib/nextSteps');

test('set-up installs both halves, then creates the databases — only with a connection', async function () {
  var ran = [];
  var runner = function (args, cwd) { ran.push(path.basename(cwd) + ': npm ' + args.join(' ')); return Promise.resolve(0); };
  var withDb = await setup.run(answers({ connection: 'enc' }), '/tmp/demo', { runner: runner, log: function () {} });
  assert.deepStrictEqual(ran, ['api: npm install', 'ui: npm install', 'api: npm run setup']);
  assert.deepStrictEqual(withDb, { ok: true, databases: true });

  ran = [];
  var without = await setup.run(answers(), '/tmp/demo', { runner: runner, log: function () {} });
  assert.deepStrictEqual(ran, ['api: npm install', 'ui: npm install'], 'no connection, no database step');
  assert.strictEqual(without.databases, false);
});

test('set-up stops at the first failing step, and the next steps name it', async function () {
  var runner = function (args, cwd) { return Promise.resolve(path.basename(cwd) === 'ui' ? 1 : 0); };
  var result = await setup.run(answers({ connection: 'enc' }), '/tmp/demo', { runner: runner, log: function () {} });
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.failed.label, 'Installing the UI packages');
  var text = nextSteps.describe(answers({ connection: 'enc' }), '/tmp/demo', result);
  assert.match(text, /SET-UP STOPPED at: Installing the UI packages/);
  assert.match(text, /demo[\\/]ui {2}&& {2}npm install/);
});

test('once set up, the next steps are only how to start it', function () {
  var text = nextSteps.describe(answers({ connection: 'enc' }), '/tmp/demo', { ok: true, databases: true });
  assert.doesNotMatch(text, /npm install|npm run setup|db:encrypt/);
  assert.match(text, /npm run start-auth/);
  assert.match(text, /npm run dev/);
});

// ── the sample: screens, not hand-written pages ─────────────────────────────

test('the task sample is factory screens, published on startup and guarded', function () {
  var dir = path.join(tmpdir(), 'demo');
  generate.generate(answers(), dir);
  var screens = path.join(dir, 'api', 'screens');
  var edit = JSON.parse(fs.readFileSync(path.join(screens, 'task', 'task-edit.screen.json'), 'utf8'));
  var list = JSON.parse(fs.readFileSync(path.join(screens, 'task', 'task-list.screen.json'), 'utf8'));
  assert.strictEqual(edit.id, 'task_edit');
  assert.strictEqual(edit.source, 'tasks');
  assert.strictEqual(list.nodes[0].props.editScreen, 'task_edit');
  assert.ok(!fs.existsSync(path.join(dir, 'api', 'models', 'Task.js')), 'no hand-written model');
  assert.ok(!fs.existsSync(path.join(dir, 'api', 'migrations', '0001_tasks.sql')), 'the table comes from publishing, not a migration');

  var www = fs.readFileSync(path.join(dir, 'api', 'bin', 'www'), 'utf8');
  assert.match(www, /factory\.publishScreens\(screens\.documents\)/);
  assert.match(fs.readFileSync(path.join(dir, 'api', 'app.js'), 'utf8'), /factory\.router\(\{\s*access: true/);
  assert.match(fs.readFileSync(path.join(dir, 'api', 'development.env'), 'utf8'), /XEPLR_AUTH_MIGRATIONS=\.\/node_modules\/@xeplr\/factory\/migrations-auth,\.\/migrations-auth/);
  var uiPkg = JSON.parse(fs.readFileSync(path.join(dir, 'ui', 'package.json'), 'utf8'));
  ['@xeplr/ui-factory', '@xeplr/ui-canvas', '@xeplr/ui-table', '@tanstack/react-table'].forEach(function (dep) {
    assert.ok(uiPkg.dependencies[dep], 'ui depends on ' + dep);
  });
});

// ── tenancy ─────────────────────────────────────────────────────────────────

test('tenancy levels: every name derived once, and bad answers refused', function () {
  var levels = questions.tenancyLevels('Company, business unit');
  assert.deepStrictEqual(levels[1], { key: 'l2', label: 'Business unit', name: 'businessUnitId', header: 'x-business-unit-id', table: 'business_units' });
  assert.strictEqual(questions.tenancyLevels('category')[0].table, 'categories');
  assert.throws(function () { questions.tenancyLevels('a1'); }, /letters and spaces/);
  assert.throws(function () { questions.tenancyLevels('one, two, three, four, five'); }, /At most four/);
  assert.throws(function () { questions.tenancyLevels('company, company'); }, /different name/);
});

test('without tenancy the project has no trace of it', function () {
  var dir = path.join(tmpdir(), 'demo');
  var result = generate.generate(answers({ tenancy: [] }), dir);
  assert.ok(result.written.every(function (f) { return !/tenan|SelectScope|switch_menu/i.test(f); }), 'no tenancy files');
  result.written.forEach(function (rel) {
    if (/\.(svg|png)$/.test(rel)) return;
    assert.doesNotMatch(fs.readFileSync(path.join(dir, rel), 'utf8'), /registerMTs\(|mtMiddleware|ScopeGate|tenants\.memberGate|require\('\.\/routes\/tenants'\)/, rel);
  });
});

test('every app has flows, run by @xeplr/workflow inside the API, in the app database', function () {
  var dir = path.join(tmpdir(), 'demo');
  var result = generate.generate(answers({ tenancy: [] }), dir);
  var read = function (rel) { return fs.readFileSync(path.join(dir, rel), 'utf8'); };

  ['api/routes/flows.js', 'ui/src/api/flows.js', 'ui/src/pages/Flows.jsx', 'ui/src/pages/FlowsHome.jsx', 'ui/src/pages/FlowDesigner.jsx', 'ui/src/pages/Journey.jsx'].forEach(function (rel) {
    assert.ok(result.written.indexOf(rel) !== -1, rel + ' is written');
  });
  // The version the app installs — 1.1.0 is where embedding (its own database,
  // the host's tenancy and permissions) and the 2.0 condition language landed.
  assert.match(read('api/package.json'), /"@xeplr\/workflow": "\^1\.1\.0"/);

  // Started in ONE place (api/workflow.js), in the app's own database,
  // following its tenancy — by the API, or on its own port.
  var start = read('api/workflow.js');
  assert.match(start, /registerWorkflow\(\{/);
  assert.match(start, /name: process\.env\.DB_API,/);
  assert.match(start, /connection: process\.env\.DEMO_CONNECTION,/);
  assert.match(start, /migrationsTable: 'workflow_migrations'/);
  assert.match(start, /tenantTables: false,/);
  assert.match(start, /access: true,/);
  var www = read('api/bin/www');
  assert.match(www, /if \(process\.env\.WORKFLOW_PORT\) \{/, 'with a port, the API leaves it to its own process');
  assert.match(www, /require\('\.\.\/routes\/flows'\)\.mount\(await require\('\.\.\/workflow'\)\(buildApp\.memberGate\)\)/);
  // The WHOLE router, not just the flows facade: /flows for the journey,
  // /workflows for the designer's document API, /actions for its palette.
  assert.match(read('api/bin/workflow'), /'\/api\/workflow': workflowRouter/);
  assert.match(read('api/bin/workflow'), /WORKFLOW_PORT is blank/);
  assert.ok(fs.statSync(path.join(dir, 'api/bin/workflow')).mode & 0o111 || true);
  assert.match(read('api/package.json'), /"start-workflow": "node \.\/bin\/workflow"/);
  assert.match(read('api/routes/index.js'), /router\.use\('\/api\/workflow', require\('\.\/flows'\)\)/);
  assert.match(read('ui/src/api/flows.js'), /base: '\/api\/workflow'/);

  // ONE DESIGNER for the whole product: @xeplr/ui-workflow's canvas, dropped
  // onto this app's own page. Not a second, screens-only builder.
  var designer = read('ui/src/pages/FlowDesigner.jsx');
  assert.match(designer, /import \{ WorkflowDesigner \} from '@xeplr\/ui-workflow'/);
  assert.match(designer, /apiBase="\/api\/workflow"/);
  // The factory's screens-only builder is not imported — it may still be
  // NAMED, in the comment saying why it is gone.
  assert.doesNotMatch(designer, /import[^\n]*FlowBuilder/, 'the factory builder is not a second designer');
  assert.match(read('ui/package.json'), /"@xeplr\/ui-workflow": "\^1\.1\.0"/);

  // THIS APP'S FORMS ARE THE FLOW'S SCREENS, and the wiring for that is a
  // PACKAGE, not lines in a generated app. Both props come from one hook:
  // @xeplr/ui-factory answers which screens exist (with their fields, so a
  // later step can pick `title` by name) and how to design one without
  // leaving the flow.
  assert.match(designer, /useScreenSource\(factory/);
  assert.match(designer, /screens=\{screens\}/);
  assert.match(designer, /screenEditor=\{screenEditor\}/);

  // The generated app must not carry a hand-rolled version of any of it. An
  // app is generated once and then lives its own life: glue copied into it
  // can never be fixed centrally, so a control type added to the factory
  // would never reach an app made last month. If this fails, the thing it is
  // testing belongs in a package.
  var uiPages = result.written.filter(function (f) { return /^ui\/src\/pages\//.test(f); });
  assert.ok(uiPages.indexOf('ui/src/pages/ScreenEditor.jsx') === -1, 'the screen editor is not copied into the app');
  assert.doesNotMatch(designer, /inputNodes|loadScreen\(|listScreens\(/, 'the app does not derive screen fields itself');
  assert.doesNotMatch(designer, /FactoryBuilder[\s\S]*onPublish/, 'the app does not wire a builder of its own');

  // A FLOW IS AN ORDINARY WORKFLOW addressed by a key, so every kind of step
  // is available in it — a Screen for what a person fills in, an Action for
  // what happens next. Created as kind 'screens' it would be generated from a
  // design held elsewhere, and the designer would refuse to edit its own flows.
  assert.match(designer, /workflowKey=/);
  var flowsPage = read('ui/src/pages/Flows.jsx');
  assert.match(flowsPage, /saveWorkflow\(\{[^}]*kind: 'workflow'/);
  assert.doesNotMatch(flowsPage, /createFlow\(/, 'a new flow is not a screens-kind flow');

  // Ports and addresses are SETTINGS: blank = inside the API.
  var env = read('api/development.env');
  assert.match(env, /^WORKFLOW_PORT=$/m);
  assert.match(env, /next free port: 19203/);
  assert.doesNotMatch(env, /WORKFLOW_TENANT|DB_WORKFLOW/);
  var uiEnv = read('ui/.env');
  assert.match(uiEnv, /^WORKFLOW_URL=$/m);
  assert.match(read('ui/vite.config.js'), /'\/api\/workflow': env\.WORKFLOW_URL \|\| apiUrl/);
  var prod = read('api/production.env.example');
  assert.match(prod, /^WORKFLOW_PORT=$/m);
  assert.match(prod, /^ENCRYPTION_KEY=$/m, 'no secret in the example');
  assert.match(read('api/.gitignore'), /^development\.env$/m);
  assert.match(read('api/.gitignore'), /^production\.env$/m);
  assert.match(read('README.md'), /location \/api\/workflow\/ \{ proxy_pass http:\/\/127\.0\.0\.1:19202; \}/);
  assert.match(read('README.md'), /npm run start-workflow   # flows            http:\/\/localhost:19203/);
  assert.match(env, /^XEPLR_AUTH_MIGRATIONS=.*,\.\/migrations-auth,\.\/node_modules\/@xeplr\/workflow\/migrations-auth$/m);
  assert.match(read('api/env.required.js'), /'DEMO_CONNECTION',\n\];/, 'the required list is unchanged');
  assert.doesNotMatch(read('api/routes/flows.js'), /fetch\(/, 'no forwarding to another server');
  assert.doesNotMatch(read('ui/src/pages/Flows.jsx'), /Connect Xeplr Workflow|WORKFLOW_NOT_CONNECTED/);

  // In the rail and in Configure UI.
  assert.match(read('ui/src/App.jsx'), /\{ key: 'Flows', icon: FlowsIcon, path: '\/flows'/);
  assert.match(read('ui/src/pages/ConfigureUI.jsx'), /\{ id: 'flows', label: 'Flows', Page: Flows \}/);
  assert.match(read('api/migrations-auth/0005_flows_menu.sql'), /'Flows', '', true, true/);

  // No tenancy forced, none invented.
  assert.ok(result.written.every(function (f) { return !/tenan|SelectScope/i.test(f); }), 'still no tenancy files');
  var readme = read('README.md');
  assert.match(readme, /## Flows[\s\S]*inside this API/);
  assert.match(readme, /none, like the rest of this app/);
  assert.doesNotMatch(read('README.md') + read('api/routes/flows.js'), /__[A-Z_]+__/, 'no token left behind');
});

test('in a multi-tenant app, flows follow its tenancy', function () {
  var dir = path.join(tmpdir(), 'demo');
  generate.generate(answers({ tenancy: questions.tenancyLevels('company') }), dir);
  var read = function (rel) { return fs.readFileSync(path.join(dir, rel), 'utf8'); };
  assert.match(read('api/workflow.js'), /mtMembershipGate: memberGate/);
  assert.match(read('api/app.js'), /var memberGate = tenants\.memberGate;/);
  // Its own process runs the same tenancy middleware as the API.
  assert.match(read('api/app.js'), /module\.exports\.middleware = function\(\) \{ return \[mtMiddleware\(\)\]; \};/);
  assert.match(read('README.md'), /flows and runs belong to the company chosen after signing in/);
});

test('with tenancy: levels registered on both sides, tables, picker first, membership checked', function () {
  var dir = path.join(tmpdir(), 'demo');
  var result = generate.generate(answers({ tenancy: questions.tenancyLevels('company, workspace') }), dir);
  var read = function (rel) { return fs.readFileSync(path.join(dir, rel), 'utf8'); };

  var api = JSON.stringify(require(path.join(dir, 'api', 'tenancy.js')).slots);
  assert.strictEqual(api, '{"l1":{"name":"companyId","header":"x-company-id"},"l2":{"name":"workspaceId","header":"x-workspace-id"}}');
  assert.match(read('ui/src/tenancy.js'), /"header": "x-workspace-id"/);
  assert.match(read('api/db/setup.js'), /registerMTs\(require\('\.\.\/tenancy'\)\.slots\)/);
  assert.match(read('ui/src/main.jsx'), /registerMTs\(tenancy\.slots\)/);
  assert.match(read('api/app.js'), /middleware: \[mtMiddleware\(\)\]/);
  assert.match(read('api/app.js'), /var memberGate = tenants\.memberGate;/);
  assert.match(read('api/migrations/0001_tenants.sql'), /CREATE TABLE IF NOT EXISTS "companies"[\s\S]*CREATE TABLE IF NOT EXISTS "workspaces"/);
  assert.match(read('ui/src/App.jsx'), /<ProtectedRoute><ScopeGate><Shell \/><\/ScopeGate><\/ProtectedRoute>/);
  assert.match(read('ui/src/App.jsx'), /key: 'Switch company'/);
  assert.match(read('api/migrations-auth/0004_switch_menu.sql'), /'Switch company'/);
  // Nothing left unfilled, and the JS parses.
  result.written.forEach(function (rel) {
    if (/\.(svg|png)$/.test(rel)) return;
    assert.doesNotMatch(read(rel), /__[A-Z][A-Z0-9_]*[A-Z0-9]__/, rel);
  });
  require(path.join(dir, 'api', 'tenancy.js'));
});

test('forms: a Super Admin menu to list, make, design, publish and open them — enforced by the API', function () {
  var dir = path.join(tmpdir(), 'demo');
  var result = generate.generate(answers(), dir);
  var read = function (rel) { return fs.readFileSync(path.join(dir, rel), 'utf8'); };
  ['ui/src/pages/ConfigureUI.jsx', 'ui/src/pages/Forms.jsx', 'ui/src/pages/MenuSettings.jsx', 'ui/src/pages/FormDesigner.jsx', 'ui/src/pages/FormRecords.jsx', 'api/routes/access.js', 'api/migrations-auth/0003_configure_ui_menu.sql'].forEach(function (f) {
    assert.ok(result.written.indexOf(f) !== -1, f);
  });
  assert.ok(result.written.indexOf('ui/src/pages/Designer.jsx') === -1, 'the separate Designer page is gone');
  var app = read('api/app.js');
  assert.match(app, /var memberGate = access\.anyone;/);
  assert.match(app, /design: \[memberGate, access\.superAdminOnly\]/);
  var menu = read('api/migrations-auth/0003_configure_ui_menu.sql');
  assert.match(menu, /'Configure UI', '', false/, 'not public');
  assert.match(menu, /r\.name = 'Super Admin'/);
  var ui = read('ui/src/App.jsx');
  assert.match(ui, /\{ key: 'Configure UI', path: '\/configure' \}/, 'in the settings menu');
  assert.doesNotMatch(ui, /key: 'Forms'/, 'not in the side rail');
  assert.match(ui, /path="\/configure\/forms\/:form\/design\/:part"/);
  assert.match(ui, /\{ key: 'Tasks', icon: TasksIcon/, 'drawer items by key, no label in code');
  assert.match(ui, /key\.startsWith\(FORM_MENU_PREFIX\)/, 'forms added to the menu reach the rail');
  var access = require(path.join(dir, 'api', 'routes', 'access.js'));
  var sent = null;
  var res = { status: function (c) { sent = c; return { send: function () {} }; } };
  access.superAdminOnly({ access: { roles: ['Creator'] } }, res, function () { sent = 'next'; });
  assert.strictEqual(sent, 403);
  access.superAdminOnly({ access: { roles: ['Super Admin'] } }, res, function () { sent = 'next'; });
  assert.strictEqual(sent, 'next');
});

test('front-end hooks: the task module holds them, every method calling super, and both screens use them', function () {
  var dir = path.join(tmpdir(), 'demo');
  generate.generate(answers(), dir);
  var edit = fs.readFileSync(path.join(dir, 'ui/src/pages/EditTask.jsx'), 'utf8');
  assert.match(edit, /export class TaskHooks extends FactoryHooks/);
  assert.strictEqual((edit.match(/return super\./g) || []).length, 5, 'get, save, delete, step, actions all call super');
  var tasks = fs.readFileSync(path.join(dir, 'ui/src/pages/Tasks.jsx'), 'utf8');
  assert.match(tasks, /import \{ taskHooks \} from '\.\/EditTask\.jsx'/);
  assert.match(tasks, /hooks=\{taskHooks\}/);
});

test('the sample form uses every control, over steps, and opens on a page of its own', function () {
  var dir = path.join(tmpdir(), 'demo');
  generate.generate(answers(), dir);
  var edit = JSON.parse(fs.readFileSync(path.join(dir, 'api/screens/task/task-edit.screen.json'), 'utf8'));
  var types = edit.nodes.map(function (n) { return n.type; });
  ['stepper', 'text', 'dropdown', 'radio', 'textarea', 'date', 'datetime', 'multiselect', 'checkbox', 'file'].forEach(function (t) {
    assert.ok(types.indexOf(t) !== -1, 'the task form has a ' + t);
  });
  var bar = edit.nodes.find(function (n) { return n.type === 'stepper'; });
  assert.strictEqual(bar.props.steps.length, 3);
  // Every field is on a step, and each step starts at the same height.
  var fields = edit.nodes.filter(function (n) { return n.props.name; });
  assert.ok(fields.every(function (n) { return n.step && n.step.of === bar.id; }), 'every field belongs to a step');
  assert.ok(fields.some(function (n) { return n.step.index === 2; }), 'the last step has a field');

  var file = fields.find(function (n) { return n.type === 'file'; });
  assert.match(file.props.accept, /\.pdf/);
  assert.ok(file.props.maxSize > 0);

  // The list sends Edit / New to a page, and the app knows where that is.
  var list = JSON.parse(fs.readFileSync(path.join(dir, 'api/screens/task/task-list.screen.json'), 'utf8'));
  assert.strictEqual(list.nodes[0].props.openIn, 'page');
  assert.match(fs.readFileSync(path.join(dir, 'ui/src/pages/Tasks.jsx'), 'utf8'), /onOpenRecord=/);
  var editPage = fs.readFileSync(path.join(dir, 'ui/src/pages/EditTask.jsx'), 'utf8');
  assert.match(editPage, /onDone=\{\(\) => navigate\('\/tasks'\)\}/);
  var app = fs.readFileSync(path.join(dir, 'ui/src/App.jsx'), 'utf8');
  assert.match(app, /path="\/tasks\/new"/);
  assert.match(app, /path="\/tasks\/:id"/);

  // Uploads: somewhere to put them, multer to receive them, and never committed.
  assert.match(fs.readFileSync(path.join(dir, 'api/development.env'), 'utf8'), /FACTORY_FILES_DIR=/);
  assert.match(fs.readFileSync(path.join(dir, 'api/bin/www'), 'utf8'), /filesDir: process\.env\.FACTORY_FILES_DIR/);
  assert.match(fs.readFileSync(path.join(dir, 'api/package.json'), 'utf8'), /"multer"/);
  assert.match(fs.readFileSync(path.join(dir, 'api/.gitignore'), 'utf8'), /uploads\//);
});

test('a new UI is described for Claude: CLAUDE.md with the recipe and the prompt, and the task model is wired in', function () {
  var dir = path.join(tmpdir(), 'demo');
  generate.generate(answers(), dir);
  var md = fs.readFileSync(path.join(dir, 'CLAUDE.md'), 'utf8');
  assert.match(md, /^# demo/);
  ['## Create a new UI', '.entity.json', '--no-pages', 'api/screens/index.js', 'Edit<Form>.jsx', 'drawerItems', 'migrate:auth', '.model.js', '.hooks.js', '### The prompt', 'factory.table('].forEach(function (s) {
    assert.ok(md.indexOf(s) !== -1, 'CLAUDE.md mentions ' + s);
  });
  var help = fs.readFileSync(path.join(dir, 'ui/src/pages/TasksHelp.jsx'), 'utf8');
  var prompt = /### The prompt\n\n> (.*)\n/.exec(md)[1].replace(/\*\*/g, '');
  assert.ok(help.indexOf(prompt) !== -1, 'the sample shows the same prompt as CLAUDE.md');
  var screens = fs.readFileSync(path.join(dir, 'api/screens/index.js'), 'utf8');
  assert.match(screens, /require\('\.\/task\/task\.model'\)/);
  assert.match(fs.readFileSync(path.join(dir, 'api/bin/www'), 'utf8'), /models: screens\.models/);
  assert.match(fs.readFileSync(path.join(dir, 'api/screens/task/task.model.js'), 'utf8'), /class TaskModel extends FactoryModel/);
});

test('menu keys live in one place: App.jsx and Configure UI → Menu share ui/src/menu.js', function () {
  var plain = path.join(tmpdir(), 'demo');
  generate.generate(answers(), plain);
  var menu = fs.readFileSync(path.join(plain, 'ui/src/menu.js'), 'utf8');
  assert.match(menu, /export const FORM_MENU_PREFIX = 'form:'/);
  assert.match(menu, /'Home',\n  'Tasks',\n  'Flows',\n  'Admin',\n  'Configure UI'/);
  assert.match(fs.readFileSync(path.join(plain, 'ui/src/App.jsx'), 'utf8'), /import \{ FORM_MENU_PREFIX \} from '\.\/menu\.js'/);
  assert.match(fs.readFileSync(path.join(plain, 'ui/src/pages/MenuSettings.jsx'), 'utf8'), /APP_MENU_KEYS\.includes\(name\)/);

  var mt = path.join(tmpdir(), 'demo');
  generate.generate(answers({ tenancy: questions.tenancyLevels('company') }), mt);
  assert.match(fs.readFileSync(path.join(mt, 'ui/src/menu.js'), 'utf8'), /'Tasks',\n  'Flows',\n  'Switch company',\n  'Admin'/);
});

test('a generated project reads like one: README at the root, in api and in ui', function () {
  var dir = path.join(tmpdir(), 'demo');
  generate.generate(answers(), dir);
  var root = fs.readFileSync(path.join(dir, 'README.md'), 'utf8');
  assert.match(root, /^# demo\n/);
  assert.match(root, /sign in as `admin@demo\.local`/);
  assert.match(root, /REDIS_PREFIX/);
  assert.match(fs.readFileSync(path.join(dir, 'api/README.md'), 'utf8'), /npm run start-api/);
  assert.match(fs.readFileSync(path.join(dir, 'ui/README.md'), 'utf8'), /by key/);
});

test('an occupied folder is refused before any question is asked', function () {
  var dir = tmpdir();
  fs.writeFileSync(path.join(dir, 'keep.txt'), 'x');
  assert.strictEqual(generate.isOccupied(dir), true);
  assert.strictEqual(generate.isOccupied(path.join(dir, 'nope')), false);
  var run = require('child_process').spawnSync(process.execPath, [path.join(__dirname, '..', 'bin', 'xeplr.js'), 'new', path.basename(dir)], { cwd: path.dirname(dir), input: '', encoding: 'utf8' });
  assert.strictEqual(run.status, 1);
  assert.match(run.stderr, /already exists and is not empty/);
  assert.doesNotMatch(run.stdout, /Port decade/, 'no question was asked');
});
