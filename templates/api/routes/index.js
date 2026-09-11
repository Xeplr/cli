var express = require('express');
var { genericRoute } = require('@xeplr/base-apis');
var { Task } = require('../models');

var router = express.Router();

// PUBLIC — listed in app.js's auth.publicPaths. Whatever polls this has never
// signed in, so it has no token to send. It reports liveness and nothing else.
router.get('/health', function(req, res) {
  res.json({ status: 'ok' });
});

// GATED, like everything not named public.
router.get('/', function(req, res) {
  res.json({ service: 'api', status: 'running', name: '__NAME__-api' });
});

// Who is calling, and what they are allowed to reach. Both were put on the
// request by the auth gate, so this makes no call of its own.
router.get('/whoami', function(req, res) {
  res.json({ user: req.user, roles: (req.access || {}).roles || [] });
});

// ── tasks ────────────────────────────────────────────────────────────────
//
// MOUNTED UNDER /api, and that prefix matters. The browser asks the UI's dev
// server for BOTH its own pages and its data, and the dev server decides by
// path which to forward. Serve data at /tasks and the UI's own /tasks page is
// shadowed by it — opening that page shows raw JSON instead of the app.
//
// Keeping every data address under /api means a page path and a data path can
// never collide, whatever either is called later.
//
// FOUR ADDRESSES FROM ONE LINE. Hand genericRoute a model and it builds:
//
//   GET  /api/tasks         list, paginated  (?page=1&limit=50)
//   GET  /api/tasks/:id     one task
//   POST /api/tasks/save    create and update, in one transaction
//   POST /api/tasks/delete  soft delete by ids
//
// No handler is written for any of them. The model's own jsonSchema is what
// validates the incoming values, so the rules live in one place rather than
// being restated here.
router.use('/api/tasks', genericRoute({ key: 'task', model: Task }));

module.exports = router;
