var path = require('path');

/**
 * What to do now that the files exist — and, when the installer set the
 * project up itself, only what is left.
 *
 * @param setup  the result of lib/setup.js, or null when it was not run
 */
function describe(answers, dir, setup) {
  var api = answers.name + '/api';
  var head = ['', '  Created ' + dir, ''];
  var installed = setup && (setup.ok || (setup.failed && setup.failed.args[0] !== 'install'));

  if (setup && !setup.ok) {
    head = head.concat([
      '  SET-UP STOPPED at: ' + setup.failed.label,
      '  The messages above say why. Fix that, then run it again:',
      '',
      '    cd ' + path.join(answers.name, path.basename(setup.failed.cwd)) + '  &&  npm ' + setup.failed.args.join(' '),
      ''
    ]);
  }

  if (!answers.connection) {
    head = head.concat([
      '  ONE THING LEFT — your database connection:',
      '',
      '    cd ' + api + '  &&  ' + (installed ? '' : 'npm install  &&  ') + 'npm run db:encrypt  &&  npm run setup',
      '',
      '  It asks for your database details and fills them in for you.',
      ''
    ]);
  }

  var ready = setup && setup.ok && setup.databases;
  var start = ready ? ['  Start it — three terminals:', ''] : ['  Then:', ''];
  if (!ready && answers.connection) {
    start.push('    cd ' + api + '   &&  npm install  &&  npm run setup');
    start.push('    cd ../ui' + ' '.repeat(Math.max(1, api.length - 5)) + '&&  npm install');
    start.push('');
  }

  return head.concat(start, [
    '    cd ' + api + '  &&  npm run start-auth     # sign-in, port ' + answers.ports.auth,
    '    cd ' + api + '  &&  npm run start-api      # your API, port ' + answers.ports.api,
    '    cd ' + answers.name + '/ui   &&  npm run dev            # the app, port ' + answers.ports.ui,
    '',
    '  Sign-in needs Redis running. Then open http://localhost:' + answers.ports.ui,
    '  and sign in as ' + answers.admin.email + '.',
    ''
  ]).join('\n');
}

module.exports = { describe: describe };
