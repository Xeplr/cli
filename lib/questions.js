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

// ── tenancy ──────────────────────────────────────────────────────────────
//
// At most four levels — @xeplr/db has four tenant columns (mtId1-4) — named
// outermost first: "company", or "company, workspace".
var LEVEL_RE = /^[a-z][a-z ]{0,30}[a-z]$/;

function plural(word) {
  if (/[^aeiou]y$/.test(word)) return word.slice(0, -1) + 'ies';
  if (/(s|x|z|ch|sh)$/.test(word)) return word + 'es';
  return word + 's';
}

/**
 * "company, business unit" → one entry per level, every name derived once:
 *   { key: 'l2', label: 'Business unit', name: 'businessUnitId',
 *     header: 'x-business-unit-id', table: 'business_units' }
 *
 * @returns {object[]}  or throws, with a sentence to show
 */
function tenancyLevels(text) {
  var words = String(text || '').split(',').map(function (w) { return w.trim().toLowerCase().replace(/\s+/g, ' '); }).filter(Boolean);
  if (!words.length) throw new Error('Name at least one level, e.g. company.');
  if (words.length > 4) throw new Error('At most four levels.');
  words.forEach(function (w) {
    if (!LEVEL_RE.test(w)) throw new Error('"' + w + '" — letters and spaces only, e.g. company or business unit.');
  });
  if (new Set(words).size !== words.length) throw new Error('Each level needs a different name.');
  return words.map(function (w, i) {
    var parts = w.split(' ');
    var camel = parts[0] + parts.slice(1).map(function (p) { return p[0].toUpperCase() + p.slice(1); }).join('');
    return {
      key: 'l' + (i + 1),
      label: w[0].toUpperCase() + w.slice(1),
      name: camel + 'Id',
      header: 'x-' + parts.join('-') + '-id',
      table: parts.slice(0, -1).concat(plural(parts[parts.length - 1])).join('_')
    };
  });
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

  // ── tenancy ───────────────────────────────────────────────────────────
  //
  // Whether data belongs to companies (or workspaces, or both). Off, the app
  // has no tenancy at all. On, every row is stamped with the company it was
  // made in, every query sees only that company's rows, and picking one is
  // the first screen after signing in.
  var tenancy = [];
  var multiTenant = await session.confirm('Multi-tenant — does data belong to companies (or similar)?', false);
  if (multiTenant) {
    var levelsText = await session.ask('  Tenancy levels, outermost first?', {
      default: 'company',
      validate: function (v) {
        try { tenancyLevels(v); return true; } catch (err) { return err.message; }
      }
    });
    tenancy = tenancyLevels(levelsText);
  }

  // ── flows ─────────────────────────────────────────────────────────────
  // Nothing to ask: every app has flows, run by @xeplr/workflow inside its own
  // API and database (see lib/generate's flowsSubstitutions).

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
    tenancy: tenancy,

    // GENERATED, never asked. Nobody should be inventing these by hand, and a
    // prompt invites a weak answer or a reused one.
    secrets: { encryptionKey: encryptionKey, jwtSecret: secret() }
  };
}

module.exports = { collect: collect, envPrefix: envPrefix, tenancyLevels: tenancyLevels, NAME_RE: NAME_RE };
