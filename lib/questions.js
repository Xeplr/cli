var crypto = require('crypto');
var { encrypt } = require('@xeplr/utils/isomorphic/crypto');

// A name that works as a folder, an npm package name, AND a database name.
//
// Must start with a letter and END with a letter or digit. A trailing dash
// passes as a folder name and then fails twice over: `@thing-/api` is not a
// legal package name, and `thing-_api` is a database name that has to be
// quoted everywhere it appears.
var NAME_RE = /^[a-z][a-z0-9-]{0,39}[a-z0-9]$/;

// Ports are taken a DECADE at a time — ui, auth, api — so two products can run
// side by side without either being renumbered. xeplr-bi holds 19100, workflow
// 19120.
var TAKEN_DECADES = [19100, 19120];

function envPrefix(name) {
  // yyan → YYAN, my-app → MY_APP. This becomes MY_APP_PORT and
  // MY_APP_CONNECTION, so it has to be a legal env var name.
  return name.toUpperCase().replace(/-/g, '_');
}

function secret() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Everything the generator needs, collected from the person running this.
 *
 * ASKS AS LITTLE AS POSSIBLE. Anything that can be computed is computed,
 * anything that can be generated is generated, and the one value that can be
 * neither — the database connection — is deliberately left blank rather than
 * guessed at. See lib/plan.js.
 */
async function collect(session, argvName) {
  // Generated up front: the connection below is encrypted with it.
  var encryptionKey = secret();

  var name = argvName;
  if (!name || NAME_RE.test(name) !== true) {
    name = await session.ask('Project name?', {
      default: argvName || undefined,
      validate: function (v) {
        return NAME_RE.test(v) ? true
          : 'Lowercase letters, numbers and dashes, starting with a letter.';
      }
    });
  }

  var decade = await session.ask('Port decade?', {
    default: '19140',
    validate: function (v) {
      if (!/^\d{4,5}0$/.test(v)) return 'A number ending in 0, e.g. 19140.';
      if (TAKEN_DECADES.indexOf(Number(v)) !== -1) {
        return Number(v) + ' is already used by another xeplr product.';
      }
      return true;
    }
  });

  var adminEmail = await session.ask('Super admin email?', {
    default: 'admin@' + name + '.local',
    validate: function (v) {
      return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v) ? true : 'That is not an email address.';
    }
  });

  var adminPassword = await session.ask('Super admin password?', {
    default: 'ChangeMe123',
    validate: function (v) {
      // These are substituted into SQL text by the migrator, so the characters
      // that would break that are refused here rather than at migrate time.
      if (v.length < 8) return 'At least 8 characters.';
      if (/["'\s$#]/.test(v)) return 'No quotes, spaces, $ or # — it is substituted into SQL.';
      return true;
    }
  });

  // ── the database ──────────────────────────────────────────────────────
  //
  // ASKED, not defaulted, and not left for the reader to do by hand either.
  // The rule is that a database location is never GUESSED — asking is the
  // opposite of guessing. Doing it here also spares everyone a long command
  // with two --package flags whose result has to be pasted into two places.
  //
  // Declining is fine: the settings are written blank with the command above
  // them, and the app refuses to start until they are filled in.
  var connection = '';
  var haveDb = await session.confirm('Set up the database connection now?', true);
  if (haveDb) {
    var dbHost = await session.ask('  Database host?', { default: 'localhost' });
    var dbPort = await session.ask('  Database port?', {
      default: '5432',
      validate: function (v) { return /^\d+$/.test(v) ? true : 'A number.'; }
    });
    var dbUser = await session.ask('  Database user?', { default: 'postgres' });
    var dbPass = await session.askSecret('  Database password?');

    // Host, port, user and password are encrypted TOGETHER into one string —
    // which is why a single setting is enough for the app to connect.
    connection = await encrypt(JSON.stringify({
      host: dbHost,
      port: Number(dbPort),
      user: dbUser,
      password: dbPass
    }), encryptionKey);
  }

  var base = Number(decade);

  return {
    connection: connection,
    name: name,
    prefix: envPrefix(name),
    ports: { ui: base, auth: base + 1, api: base + 2 },
    databases: { auth: name + '_auth', api: name + '_api' },
    admin: { email: adminEmail, password: adminPassword },

    // GENERATED, never asked. Nobody should be inventing these by hand, and a
    // prompt invites a weak answer or a reused one.
    secrets: { encryptionKey: encryptionKey, jwtSecret: secret() }
  };
}

module.exports = { collect: collect, envPrefix: envPrefix, NAME_RE: NAME_RE };
