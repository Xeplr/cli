var { spawn } = require('child_process');
var path = require('path');

/**
 * The steps that turn written files into a project that starts: packages
 * installed, both databases created, sign-in tables and permissions in place.
 *
 * The database step needs the connection. Without one it is left out, and
 * nextSteps says how to finish.
 */
function steps(answers, target) {
  var api = path.join(target, 'api');
  var ui = path.join(target, 'ui');
  var list = [
    { label: 'Installing the API packages', cwd: api, args: ['install'] },
    { label: 'Installing the UI packages', cwd: ui, args: ['install'] }
  ];
  if (answers.connection) {
    list.push({ label: 'Creating the databases, sign-in tables and permissions', cwd: api, args: ['run', 'setup'] });
  }
  return list;
}

/**
 * npm, streaming its output as it goes — an install is minutes of silence
 * otherwise, and its own error text is the most useful thing to see if it
 * fails.
 *
 * shell on Windows only: npm is npm.cmd there, and Node refuses to spawn a
 * .cmd without a shell. Nowhere else does anything go through one.
 */
function npm(args, cwd, runner) {
  if (runner) return runner(args, cwd);
  return new Promise(function (resolve) {
    var child = spawn('npm', args, { cwd: cwd, stdio: 'inherit', shell: process.platform === 'win32' });
    child.on('error', function (err) { console.error('  ' + err.message); resolve(1); });
    child.on('exit', function (code) { resolve(code === null ? 1 : code); });
  });
}

/**
 * @param options.runner  (args, cwd) → Promise<exit code>; for tests
 * @param options.log     line printer (default console.log)
 * @returns {Promise<{ ok: boolean, databases: boolean, failed?: object }>}
 */
async function run(answers, target, options) {
  options = options || {};
  var log = options.log || console.log;
  var list = steps(answers, target);
  for (var i = 0; i < list.length; i++) {
    var step = list[i];
    log('\n  ' + step.label + '…  (npm ' + step.args.join(' ') + ', in ' + path.relative(process.cwd(), step.cwd) + ')\n');
    var code = await npm(step.args, step.cwd, options.runner);
    if (code !== 0) return { ok: false, databases: false, failed: step };
  }
  return { ok: true, databases: !!answers.connection };
}

module.exports = { run: run, steps: steps };
