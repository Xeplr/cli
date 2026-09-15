/**
 * What the generator is about to do, printed before it does any of it.
 *
 * A generator that writes 30 files and then tells you is one you have to undo
 * by hand when an answer was wrong. This is the last point where "no" is free.
 */
function describe(answers) {
  var L = [];
  var p = answers.prefix;

  L.push('');
  L.push('  ' + answers.name + '/');
  L.push('  ├─ api/     backend, on port ' + answers.ports.api);
  L.push('  └─ ui/      frontend, on port ' + answers.ports.ui);
  L.push('');
  L.push('  Sign-in runs alongside the API on port ' + answers.ports.auth + '.');
  L.push('');
  L.push('  Databases (created for you on first run):');
  L.push('    ' + answers.databases.auth + '    accounts, roles, permissions');
  L.push('    ' + answers.databases.api + '     your own data');
  L.push('');
  L.push('  You will sign in as ' + answers.admin.email + '.');
  L.push('');
  if (answers.tenancy && answers.tenancy.length) {
    L.push('  Multi-tenant: ' + answers.tenancy.map(function (l) { return l.label.toLowerCase() + ' (' + l.header + ')'; }).join(' → ') + '.');
    L.push('  Choosing one is the first screen after signing in.');
  } else {
    L.push('  Not multi-tenant: data belongs to the app as a whole.');
  }
  L.push('');
  L.push('  Settings written for you:');
  L.push('    ' + p + '_PORT, AUTH_PORT, AUTH_URL, DB_API, AUTH_DB_NAME');
  L.push('    REDIS_PREFIX                            ' + answers.name + ':');
  L.push('    ENCRYPTION_KEY and AUTH_JWT_SECRET      generated, not asked');
  L.push('    AUTH_SUPER_ADMIN_EMAIL / _PASSWORD      from your answers');
  L.push('');
  if (answers.connection) {
    L.push('    ' + p + '_CONNECTION                        encrypted from your answers');
    L.push('');
  } else {
    L.push('');
    L.push('  Left BLANK, for you to fill in:');
    L.push('    ' + p + '_CONNECTION and AUTH_DB_CONNECTION_INFO_ENCRYPTED');
    L.push('');
    L.push('  Run `npx @xeplr/cli encrypt` in the project to fill them in.');
    L.push('  Until then the app refuses to start and names them.');
    L.push('');
  }
  return L.join('\n');
}

module.exports = { describe: describe };
