var createApp = require('@xeplr/base-apis/express');
var routes = require('./routes');

// No `|| __API_PORT__` fallback — the port is required in env.required.js, so a
// default could only ever fire in a process that skipped that check.
var port = process.env.__PREFIX___PORT;

module.exports = function buildApp(extraRoutes) {
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
    routes: Object.assign({}, extraRoutes || {}, { '/': routes })
  });
};
