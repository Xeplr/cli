var createApp = require('@xeplr/base-apis/express');
var factory = require('@xeplr/factory');
var routes = require('./routes');
var access = require('./routes/access');
__MT_APP_REQUIRE__

// Every screen route first checks the caller may use the request's
// __MT_MEMBER_NOUN__.
var memberGate = __MT_MEMBER_GATE__;

// No `|| __API_PORT__` fallback — the port is required in env.required.js, so a
// default could only ever fire in a process that skipped that check.
var port = process.env.__PREFIX___PORT;

module.exports = buildApp;
// bin/www and bin/workflow hand the same gate to the flows router they start,
// and bin/workflow runs the same request middleware (tenancy) as this app.
module.exports.memberGate = memberGate;
module.exports.middleware = function() { return __MT_MIDDLEWARE_LIST__; };

function buildApp(extraRoutes) {
  return createApp(port, '__NAME___api', {
    // Every route needs a valid token, checked against the auth service at
    // AUTH_URL. This app names no `middleware` of its own — it takes the
    // framework's gate rather than writing one.
    auth: {
      // The only exception, and it earns it: a health check has no token to
      // send. Prefixes, so '/health' also covers '/health/anything'.
      publicPaths: ['/health']
    },
    log: { logDir: process.env.LOG_DIR || './logs' },
__MT_APP_MIDDLEWARE__
    routes: Object.assign({}, extraRoutes || {}, {
      '/': routes,
__MT_APP_ROUTES__

      // THE SCREENS — every form, one set of routes:
      //   /api/factory/screens/...   designs: load, save draft, publish
      //   /api/factory/records/...   a screen's records: list, one, save, delete
      //
      // access: true — each route answers only a caller whose permissions name
      // it ("Save factory record", "Publish factory screen", ...). Granted to
      // Super Admin and CompanyAdmin (everything), Creator (use the screens) and
      // Viewer (read) by node_modules/@xeplr/factory/migrations-auth.
      '/api': factory.router({
        access: true,
        auth: {
          view: memberGate,
          write: memberGate,
          // Designing, new forms and publishing change tables: Super Admin
          // only (routes/access.js).
          design: [memberGate, access.superAdminOnly]
        }
      })
    })
  });
}
