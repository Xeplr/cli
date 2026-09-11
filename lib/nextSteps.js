/**
 * What to do now that the files exist.
 *
 * Printed at the end because the one thing a generator cannot do for you is
 * the database connection — and a project that looks finished but will not
 * start is worse than one that says what is left.
 */
function describe(answers, dir) {
  var p = answers.prefix;
  var head = ['', '  Created ' + dir, ''];

  if (!answers.connection) {
    head = head.concat([
      '  ONE THING LEFT — your database connection:',
      '',
      '    cd ' + answers.name + '/api  &&  npm install  &&  npm run db:encrypt',
      '',
      '  It asks for your database details and fills them in for you.',
      ''
    ]);
  }

  return head.concat([
    '  Then:',
    '',
    '    cd ' + answers.name + '/api   &&  npm install  &&  npm run setup',
    '    npm run start-auth            # sign-in, port ' + answers.ports.auth,
    '    npm run start-api             # your API, port ' + answers.ports.api,
    '',
    '    cd ../ui                      &&  npm install',
    '    npm run dev                   # the app, port ' + answers.ports.ui,
    '',
    '  Then open http://localhost:' + answers.ports.ui + ' and sign in as',
    '  ' + answers.admin.email + '.',
    ''
  ]).join('\n');
}

module.exports = { describe: describe };
