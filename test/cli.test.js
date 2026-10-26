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
    databases: { auth: 'demo_auth', api: 'demo_api', workflow: 'demo_workflow' },
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

test('every name the CLI allows gives database names @xeplr/db will create', function () {
  // NAME_RE allows dashes and refuses underscores; ensureDatabase refuses
  // dashes. So "x-doit" once gave x-doit_auth and set-up died with
  // "Unsafe database name".
  assert.deepStrictEqual(questions.databaseNames('x-doit'), { auth: 'x_doit_auth', api: 'x_doit_api', workflow: 'x_doit_workflow' });
  ['yyan', 'my-app', 'a1', 'smart-asset-management'].forEach(function (name) {
    var db = questions.databaseNames(name);
    assert.match(db.auth, questions.DB_NAME_RE, name + ' → ' + db.auth);
    assert.match(db.api, questions.DB_NAME_RE, name + ' → ' + db.api);
    assert.match(db.workflow, questions.DB_NAME_RE, name + ' → ' + db.workflow);
  });
});

test('the settings name the databases the CLI planned, not ones built from the raw name', function () {
  var dir = path.join(tmpdir(), 'my-app');
  generate.generate(answers({ name: 'my-app', prefix: 'MY_APP', databases: questions.databaseNames('my-app') }), dir);
  ['development.env', 'production.env.example'].forEach(function (file) {
    var env = fs.readFileSync(path.join(dir, 'api', file), 'utf8');
    assert.match(env, /^DB_API=my_app_api$/m, file);
    assert.match(env, /^AUTH_DB_NAME=my_app_auth$/m, file);
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
  assert.match(fs.readFileSync(path.join(dir, 'api', 'development.env'), 'utf8'), /XEPLR_AUTH_MIGRATIONS=\.\/node_modules\/@xeplr\/factory\/migrations-auth,\.\/node_modules\/@xeplr\/workflow-api\/migrations-auth,\.\/migrations-auth/);
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

test('every app has flows, run by @xeplr/workflow-api inside the API, in a database of its own', function () {
  var dir = path.join(tmpdir(), 'demo');
  var result = generate.generate(answers({ tenancy: [] }), dir);
  var read = function (rel) { return fs.readFileSync(path.join(dir, rel), 'utf8'); };

  ['api/routes/flows.js', 'api/workflow.js', 'api/functions/index.js', 'ui/src/api/flows.js', 'ui/src/pages/Flows.jsx', 'ui/src/pages/FlowsHome.jsx', 'ui/src/pages/FlowDesigner.jsx', 'ui/src/pages/Journey.jsx'].forEach(function (rel) {
    assert.ok(result.written.indexOf(rel) !== -1, rel + ' is written');
  });
  // The free, public packages — 1.1 is where a flow's arrow can let a
  // function decide; factory 2 is where a screen's events are functions
  // picked by name. The paid designer (@xeplr/ui-workflow) is not here.
  var apiPkg = read('api/package.json');
  assert.match(apiPkg, /"@xeplr\/workflow-api": "\^1\.1\.0"/);
  assert.match(apiPkg, /"@xeplr\/factory": "\^2\.0\.0"/);
  assert.match(apiPkg, /"@xeplr\/actions": "\^1\.4\.0"/);
  assert.doesNotMatch(apiPkg, /"@xeplr\/workflow"/, 'not the old private package');
  assert.doesNotMatch(read('ui/package.json'), /ui-workflow/, 'not the paid designer');

  // ITS OWN DATABASE — a sub-product embedded in an app gets a store of its
  // own (DB_WORKFLOW), named by the library, never a share of the app's.
  var start = read('api/workflow.js');
  assert.match(start, /require\('@xeplr\/workflow-api'\)/);
  assert.match(start, /name: process\.env\.DB_WORKFLOW,/);
  assert.doesNotMatch(start, /DB_API/);
  assert.match(start, /connection: process\.env\.DEMO_CONNECTION,/);
  assert.match(start, /tenantTables: false,/);
  assert.match(start, /access: true,/);
  assert.match(read('api/env.required.js'), /require\('@xeplr\/workflow-api'\)\.embedRequiredEnv/);
  assert.match(read('api/development.env'), /\nDB_WORKFLOW=demo_workflow\n/);
  assert.match(read('api/development.env'), /XEPLR_AUTH_MIGRATIONS=\.\/node_modules\/@xeplr\/factory\/migrations-auth,\.\/node_modules\/@xeplr\/workflow-api\/migrations-auth,\.\/migrations-auth/);

  // ONE WAY TO RUN IT: inside the API. No own-port mode, no second process.
  var www = read('api/bin/www');
  assert.match(www, /require\('\.\.\/routes\/flows'\)\.mount\(await require\('\.\.\/workflow'\)\(buildApp\.memberGate\)\)/);
  assert.doesNotMatch(www, /WORKFLOW_PORT/);
  assert.ok(result.written.indexOf('api/bin/workflow') === -1, 'no separate workflow process');
  assert.doesNotMatch(apiPkg, /start-workflow/);
  assert.match(read('api/routes/index.js'), /router\.use\('\/api\/workflow', require\('\.\/flows'\)\)/);
  assert.match(read('ui/src/api/flows.js'), /base: '\/api\/workflow'/);

  // FUNCTIONS, NOT HOOK FILES: the app's code is registered by event and
  // picked by name — before any screen that names one can be published.
  var fns = read('api/functions/index.js');
  assert.match(fns, /name: 'tidyTaskTitle',\s+event: 'beforeSave'/);
  assert.match(fns, /name: 'byPriority',\s+event: 'decide'/);
  assert.ok(www.indexOf("require('../functions')") !== -1 && www.indexOf("require('../functions')") < www.indexOf('publishScreens'), 'functions load before screens publish');
  assert.doesNotMatch(www, /hooks:/);
  assert.ok(result.written.every(function (f) { return !/\.hooks\.js$/.test(f); }), 'no hook files');
  assert.deepStrictEqual(JSON.parse(read('api/screens/task/task-edit.screen.json')).events, { beforeSave: 'tidyTaskTitle' });

  // THE FREE DESIGNER: @xeplr/ui-factory's FlowDesigner — each screen's
  // events and navigation — with the selected step and tab in the address.
  var designer = read('ui/src/pages/FlowDesigner.jsx');
  assert.match(designer, /import \{ FlowDesignerPage \} from '@xeplr\/ui-factory'/);
  assert.match(designer, /<FlowDesignerPage factory=\{factory\} flows=\{flows\} flowKey=\{flow\} urlKey="flow" \/>/);
  // The API validates a screen with @xeplr/ui-factory/model, so ITS copy must
  // never be older than the browser's.
  assert.match(apiPkg, /"@xeplr\/ui-factory": "\^1\.7\.1"/);
  assert.match(read('ui/package.json'), /"@xeplr\/ui-factory": "\^1\.7\.1"/);
  assert.match(read('ui/vite.config.js'), /host: '127\.0\.0\.1'/, 'reachable on 127.0.0.1, not ::1 alone');

  // The generated app must not carry a hand-rolled version of any of it. An
  // app is generated once and then lives its own life: glue copied into it
  // can never be fixed centrally, so a control type added to the factory
  // would never reach an app made last month. If this fails, the thing it is
  // testing belongs in a package.
  // MASTERS — the lists the rest of the app points at, gathered in the admin
  // section. Which forms are masters is the package's answer, not the app's:
  // grouping two screens into a form and reading the flag is identical
  // everywhere, so the page reads `masters` and does no grouping itself.
  assert.ok(result.written.indexOf('ui/src/pages/Masters.jsx') !== -1, 'the masters page is written');
  var mastersPage = read('ui/src/pages/Masters.jsx');
  assert.match(mastersPage, /useScreenSource\(factory/);
  assert.match(mastersPage, /\bmasters\b/);
  assert.doesNotMatch(mastersPage, /_edit|_list/, 'the app does not group screens into forms itself');
  assert.match(read('ui/src/pages/ConfigureUI.jsx'), /id: 'masters'/);

  var uiPages = result.written.filter(function (f) { return /^ui\/src\/pages\//.test(f); });
  assert.ok(uiPages.indexOf('ui/src/pages/ScreenEditor.jsx') === -1, 'the screen editor is not copied into the app');
  assert.doesNotMatch(designer, /inputNodes|loadScreen|listScreens|loadFlow/, 'the app does not load or derive anything itself');

  // A new flow is created through the flows API, keyed from its name.
  var flowsPage = read('ui/src/pages/Flows.jsx');
  assert.match(flowsPage, /flows\.createFlow\(\{ key: flowKey\(label\), name: label \}\)/);
  assert.doesNotMatch(flowsPage, /ui-workflow|saveWorkflow/);

  // No own-port mode left anywhere: one way to run it.
  var env = read('api/development.env');
  assert.doesNotMatch(env, /WORKFLOW_PORT|WORKFLOW_URL/);
  assert.doesNotMatch(read('ui/.env'), /WORKFLOW_URL/);
  assert.doesNotMatch(read('ui/vite.config.js'), /WORKFLOW_URL/);
  var prod = read('api/production.env.example');
  assert.doesNotMatch(prod, /WORKFLOW_PORT/);
  assert.match(prod, /^DB_WORKFLOW=demo_workflow$/m);
  assert.match(prod, /^ENCRYPTION_KEY=$/m, 'no secret in the example');
  assert.match(read('api/.gitignore'), /^development\.env$/m);
  assert.match(read('api/.gitignore'), /^production\.env$/m);
  assert.doesNotMatch(read('README.md'), /start-workflow|WORKFLOW_PORT|location \/api\/workflow\//);
  assert.doesNotMatch(read('api/routes/flows.js'), /fetch\(|WORKFLOW_PORT/, 'no forwarding to another server');

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
  ['## Create a new UI', '.entity.json', '--no-pages', 'api/screens/index.js', 'Edit<Form>.jsx', 'drawerItems', 'migrate:auth', '.model.js', '.functions.js', 'api/functions/index.js', '### The prompt', 'factory.table('].forEach(function (s) {
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
