var fs = require('fs');
var path = require('path');

var TEMPLATES = path.join(__dirname, '..', '..', 'templates');

// Files whose names cannot ship as-is. `.env` and `.gitignore` are both
// swallowed on the way here — npm refuses to pack a .gitignore, and an .env in
// a published package is a mistake waiting to happen — so they travel under a
// safe name and are restored on the way out.
var RENAME = {
  'development.env.tpl': 'development.env',
  'dotenv.tpl': '.env',
  'gitignore.tpl': '.gitignore'
};

// Everything the templates can refer to. One table, so a placeholder that is
// never filled shows up as a missing key rather than as the literal
// __SOMETHING__ in a generated file.
function substitutions(answers) {
  return {
    __NAME__: answers.name,
    __PREFIX__: answers.prefix,
    __UI_PORT__: String(answers.ports.ui),
    __AUTH_PORT__: String(answers.ports.auth),
    __API_PORT__: String(answers.ports.api),
    __ENCRYPTION_KEY__: answers.secrets.encryptionKey,
    __JWT_SECRET__: answers.secrets.jwtSecret,
    __ADMIN_EMAIL__: answers.admin.email,
    __ADMIN_PASSWORD__: answers.admin.password,
    __DB_CONNECTION__: answers.connection || '',
    __CONNECTION_NOTE__: connectionNote(answers)
  };
}

/**
 * The comment above the connection setting.
 *
 * Two different situations, and a reader in the second one needs a command
 * rather than an explanation of why the line is empty.
 */
function connectionNote(answers) {
  if (answers.connection) {
    return [
      '# ── Where the databases are ──',
      '# Host, port, user and password, encrypted together from what you told',
      '# the installer. One value is enough because everything needed is inside',
      '# it. Both settings use the same server.',
      '#',
      '# CHANGED? From the api folder, this replaces both lines for you:',
      '#',
      '#   npm run db:encrypt'
    ].join('\n');
  }
  return [
    '# ═══════════════════════════════════════════════════════════════════════',
    '#  FILL THESE IN BEFORE STARTING ANYTHING',
    '#',
    '#  From the api folder, after `npm install`, this fills both lines in:',
    '#',
    '#    npm run db:encrypt',
    '#',
    '#  Before installing, or from anywhere else:',
    '#',
    '#    npx @xeplr/cli encrypt',
    '#',
    '#  Blank on purpose. A guessed database location starts cleanly, migrates,',
    '#  serves traffic, and reads as EMPTY DATA rather than as an error — so',
    '#  nothing is guessed. Until these are filled in the app refuses to start',
    '#  and names them.',
    '# ═══════════════════════════════════════════════════════════════════════'
  ].join('\n');
}

function fill(body, subs) {
  // The inner name must START and END with a letter or digit.
  //
  // Without that, a greedy match on `__PREFIX___PORT` takes `__PREFIX___` —
  // swallowing the underscore that belongs to `_PORT` — and then complains
  // about a token nobody wrote. Anchoring both ends makes `__PREFIX__` the
  // only possible match, leaving `_PORT` alone.
  return body.replace(/__([A-Z][A-Z0-9_]*[A-Z0-9])__/g, function (token) {
    // An unknown placeholder is a bug in the templates, and leaving it in the
    // generated file would be found much later by somebody who did not write
    // it. Fail here, naming the token.
    if (!(token in subs)) throw new Error('Template refers to ' + token + ', which nothing fills in');
    return subs[token];
  });
}

function isBinary(file) {
  return /\.(png|jpe?g|gif|ico|woff2?|ttf)$/i.test(file);
}

function walk(dir) {
  var out = [];
  fs.readdirSync(dir).forEach(function (entry) {
    var full = path.join(dir, entry);
    if (fs.statSync(full).isDirectory()) return out.push.apply(out, walk(full));
    out.push(full);
  });
  return out;
}

/**
 * Write the project.
 *
 * REFUSES TO OVERWRITE. Generating into a folder that already has something in
 * it is how somebody loses work they had not committed, and the check is one
 * line.
 *
 * @param {object} answers  from lib/questions.js
 * @param {string} target   absolute path of the folder to create
 * @returns {{ written: string[] }}
 */
function generate(answers, target) {
  if (fs.existsSync(target) && fs.readdirSync(target).length > 0) {
    throw new Error(target + ' already exists and is not empty.');
  }

  var subs = substitutions(answers);
  var written = [];

  walk(TEMPLATES).forEach(function (src) {
    var rel = path.relative(TEMPLATES, src);
    var dir = path.dirname(rel);
    var base = path.basename(rel);
    var outName = RENAME[base] || base;
    var dest = path.join(target, dir, outName);

    fs.mkdirSync(path.dirname(dest), { recursive: true });

    if (isBinary(src)) {
      fs.copyFileSync(src, dest);
    } else {
      fs.writeFileSync(dest, fill(fs.readFileSync(src, 'utf8'), subs));
    }

    // bin/www is executed directly, so it has to keep the bit that says so.
    if (outName === 'www') fs.chmodSync(dest, 0o755);

    written.push(path.join(dir, outName));
  });

  return { written: written.sort() };
}

module.exports = { generate: generate, substitutions: substitutions, fill: fill };
