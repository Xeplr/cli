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
