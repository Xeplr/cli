// FLOWS — screens one after another, run by Xeplr Workflow (@xeplr/workflow).
//
// WHERE IT RUNS. By default INSIDE THIS API, in this app's own database:
// bin/www starts it (registerWorkflow) after the screens and plugs its flows
// router in here. With WORKFLOW_PORT set in development.env / production.env it
// runs as its own service instead (npm run start-workflow → bin/workflow), at
// the SAME path — /api/workflow/flows — and this route answers 404 so a
// misrouted request says where it should have gone. The front door routes
// /api/workflow to it: ui/.env WORKFLOW_URL for Vite, nginx in production.
//
//   ONE DATABASE     workflow's tables (workflows, workflow_steps,
//                    workflow_runs…) sit beside the forms' tables, with their
//                    own migration record (workflow_migrations).
//   THIS APP'S       embedded workflow registers no tenancy of its own. Its
//   TENANCY          rows are filtered by the levels this app registered — or
//                    none, in an app without tenancy — and the membership gate
//                    below is the app's own. It never creates companies or
//                    workspaces tables.
//   PERMISSIONS      every route checks the caller's permissions ("List flows",
//                    "Start flow run"…), granted by @xeplr/workflow's
//                    migrations-auth — in XEPLR_AUTH_MIGRATIONS.
//
// Mounted by routes/index.js at /api/workflow, behind this app's auth gate.
// Everything Workflow serves lives under it:
//   /api/workflow/flows       the flows people walk through (Journey)
//   /api/workflow/workflows   the designer's document API
//   /api/workflow/actions     what a step can DO, for the palette
var express = require('express');

var router = express.Router();
var workflow = null;

router.use(function(req, res, next) {
  if (process.env.WORKFLOW_PORT) {
    return res.status(404).json({ message: 'Workflow runs on its own port (WORKFLOW_PORT) — route /api/workflow there (ui/.env WORKFLOW_URL, or nginx)' });
  }
  // Only before startup has finished — bin/www mounts it before listening.
  if (!workflow) return res.status(503).json({ message: 'Flows are still starting' });
  return workflow(req, res, next);
});

/** bin/www hands over registerWorkflow's router, already gated. */
router.mount = function(workflowRouter) {
  workflow = workflowRouter;
};

module.exports = router;
