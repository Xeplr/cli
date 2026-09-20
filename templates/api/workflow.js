// FLOWS — how @xeplr/workflow starts, in ONE place, for both ways it runs:
//
//   inside the API     bin/www calls this when WORKFLOW_PORT is blank
//   its own service    bin/workflow (npm run start-workflow) when it is set
//
// Either way: this app's own database (its tables beside the forms', with its
// own migration record), this app's tenancy (it creates no companies or
// workspaces of its own), and a permission check on every route — granted by
// @xeplr/workflow's migrations-auth, which XEPLR_AUTH_MIGRATIONS loads.
var { registerWorkflow } = require('@xeplr/workflow');

/** Runs workflow's migrations, and returns its flows router — already gated. */
module.exports = async function startWorkflow(memberGate) {
  var workflow = await registerWorkflow({
    applicationId: '__NAME__',
    db: {
      name: process.env.DB_API,
      connection: process.env.__PREFIX___CONNECTION,
      connectionName: 'workflow',
      migrationsTable: 'workflow_migrations'
    },
    tenantTables: false,
    access: true,
    mtMembershipGate: memberGate
  });
  return workflow.flowsRouter;
};
