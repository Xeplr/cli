// FLOWS — how @xeplr/workflow-api starts, inside this API.
//
//   ITS OWN DATABASE   DB_WORKFLOW, beside yours rather than in it — a
//                      sub-product embedded in an app gets a store of its own.
//                      Created and migrated on first start, with the same
//                      server login as the app (__PREFIX___CONNECTION).
//   ITS CLOCK          @xeplr/jobs, in a database of its own (DB_JOBS), also
//                      created and migrated on first start. Workflow runs no
//                      timer: a flow on a schedule is a job, and its timed work
//                      — a Wait box running out, a reminder, a run whose
//                      process died — is one system job, every minute.
//   THIS APP'S         it registers no tenancy of its own: flows and runs are
//   TENANCY            filtered by the levels this app registered (or none),
//                      behind this app's membership gate.
//   PERMISSIONS        every route checks the caller's ("List flows", "Start
//                      flow run"…), granted by @xeplr/workflow-api's
//                      migrations-auth, which XEPLR_AUTH_MIGRATIONS loads.
//
// A flow's "let a function decide" picks one of this app's functions
// (functions/), the same registry the screens' events use.
var { registerWorkflow } = require('@xeplr/workflow-api');
var engine = require('@xeplr/workflow-engine');
var jobs = require('@xeplr/jobs');

/** Creates and migrates workflow's and its jobs' databases, starts the clock, and returns the router — already gated. */
module.exports = async function startWorkflow(memberGate) {
  // What a job runs to start a scheduled flow, and to do the due work.
  engine.jobActions.forEach(function (a) { jobs.registerAction(a); });
  await jobs.init({
    database: process.env.DB_JOBS,
    connection: process.env.__PREFIX___CONNECTION,
    connectionName: 'jobs',
    migrate: true,
    // Only what workflow needs: no other actions offered to a job.
    defaultActions: false,
    // A finished job resumes the step that started it.
    onFinish: function (report) { return engine.jobFinished(report); }
  });

  var workflow = await registerWorkflow({
    applicationId: '__NAME__',
    db: {
      name: process.env.DB_WORKFLOW,
      connection: process.env.__PREFIX___CONNECTION,
      connectionName: 'workflow'
    },
    tenantTables: false,
    access: true,
    mtMembershipGate: memberGate,
    startJob: function (jobId, body) { return jobs.trigger(jobId, body, { triggerType: 'workflow' }); },
    keepSchedule: jobs.keepSchedule
  });

  jobs.startScheduler();
  return workflow.router;
};
