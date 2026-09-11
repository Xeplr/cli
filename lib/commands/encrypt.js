var fs = require('fs');
var path = require('path');
var { encrypt } = require('@xeplr/utils/isomorphic/crypto');

// Where a settings file usually is, relative to wherever this was run.
// Running it from the project root and from inside api/ are both normal.
var CANDIDATES = ['development.env', path.join('api', 'development.env')];

function findEnvFile(cwd) {
  for (var i = 0; i < CANDIDATES.length; i++) {
    var full = path.join(cwd, CANDIDATES[i]);
    if (fs.existsSync(full)) return full;
  }
  return null;
}

function readSetting(file, name) {
  var line = fs.readFileSync(file, 'utf8')
    .split('\n')
    .find(function (l) { return l.indexOf(name + '=') === 0; });
  return line ? line.slice(name.length + 1).trim() : null;
}

/**
 * Rewrite every setting that holds a connection string.
 *
 * BOTH of them, always. The two settings name the same server, and a project
 * where only one was updated fails halfway through setup — the sign-in
 * database is created and the app's own is not, or the reverse — which reads
 * as a broken install rather than as a half-finished edit.
 */
function writeConnection(file, value) {
  var body = fs.readFileSync(file, 'utf8');
  var updated = [];
  body = body.split('\n').map(function (line) {
    var m = line.match(/^([A-Z0-9_]*CONNECTION[A-Z0-9_]*)=/);
    if (!m) return line;
    updated.push(m[1]);
    return m[1] + '=' + value;
  }).join('\n');
  fs.writeFileSync(file, body);
  return updated;
}

/**
 * `xeplr encrypt` — turn database details into the single string the settings
 * file holds, and optionally write it straight in.
 *
 * Exists because the details change: a password rotates, the database moves,
 * or the first answer was simply wrong. Without this the only way back is a
 * long npx command with two --package flags whose output has to be pasted into
 * two places — which is exactly the kind of step people get wrong at the point
 * they are already frustrated.
 */
function parseFlags(argv) {
  var flags = {};
  (argv || []).forEach(function (arg, i) {
    var m = arg.match(/^--([a-z-]+)(?:=(.*))?$/);
    if (!m) return;
    var value = m[2] !== undefined ? m[2] : (argv[i + 1] || '');
    // A flag whose "value" is the next flag was given with nothing after it.
    flags[m[1]] = /^--/.test(value) ? '' : value;
  });
  return flags;
}

/**
 * Ask, unless it was already given on the command line.
 *
 * Every value here can arrive either way, so the same command serves somebody
 * typing at a terminal and a script that has no terminal to type at. A
 * password on a command line is visible in shell history and in the process
 * list, so the prompt stays the default and the flag is the opt-in.
 */
function given(flags, name, fallback) {
  return Object.prototype.hasOwnProperty.call(flags, name) ? flags[name] : fallback;
}

async function run(session, argv, cwd) {
  cwd = cwd || process.cwd();
  var flags = parseFlags(argv);
  var envFile = findEnvFile(cwd);

  // The key must match the one the project already uses, or nothing it wrote
  // before can be read back. So it is taken FROM the project rather than
  // asked for, whenever there is a project to take it from.
  var key = given(flags, 'key', null);
  if (!key && envFile) {
    key = readSetting(envFile, 'ENCRYPTION_KEY');
    if (key) console.log('\n  Using ENCRYPTION_KEY from ' + path.relative(cwd, envFile));
  }
  if (!key) {
    console.log('\n  No settings file found here, so the key has to be given.');
    key = await session.ask('  ENCRYPTION_KEY?', {
      validate: function (v) { return v.length >= 16 ? true : 'That looks too short.'; }
    });
  }

  var host = given(flags, 'host', null) ||
    await session.ask('  Database host?', { default: 'localhost' });

  var port = given(flags, 'port', null) ||
    await session.ask('  Database port?', {
      default: '5432',
      validate: function (v) { return /^\d+$/.test(v) ? true : 'A number.'; }
    });

  var user = given(flags, 'user', null) ||
    await session.ask('  Database user?', { default: 'postgres' });

  // hasOwnProperty rather than a truthiness check: --password= with nothing
  // after it means an EMPTY password, which some local installs really do
  // have, and must not silently turn into a prompt.
  var password = Object.prototype.hasOwnProperty.call(flags, 'password')
    ? flags.password
    : await session.askSecret('  Database password?');

  var value = await encrypt(JSON.stringify({
    host: host, port: Number(port), user: user, password: password
  }), key);

  console.log('\n  Encrypted connection:\n');
  console.log('  ' + value + '\n');

  if (!envFile) {
    console.log('  Paste it into every *_CONNECTION setting in your');
    console.log('  development.env, and into AUTH_DB_CONNECTION_INFO_ENCRYPTED.\n');
    return 0;
  }

  var write = Object.prototype.hasOwnProperty.call(flags, 'no-write') ? false
    : Object.prototype.hasOwnProperty.call(flags, 'write') ? true
    : await session.confirm('  Write it into ' + path.relative(cwd, envFile) + ' now?', true);
  if (!write) {
    console.log('\n  Left alone. Paste it in yourself when ready.\n');
    return 0;
  }

  var updated = writeConnection(envFile, value);
  console.log('\n  Updated ' + updated.length + ' settings: ' + updated.join(', ') + '\n');
  return 0;
}

module.exports = { run: run, parseFlags: parseFlags, findEnvFile: findEnvFile, writeConnection: writeConnection };
