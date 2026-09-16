// FLOWS — screens one after another, run by Xeplr Workflow.
//
// Workflow is a SEPARATE SERVICE (WORKFLOW_URL). This forwards /api/flows/…
// to its /flows/… unchanged, so the browser talks to one address and never
// learns another. Nothing is decided here: who may design or run a flow is
// Workflow's to check, against this app's own sign-in — which is why the
// caller's token and the tenant headers go through as they came.
//
// Mounted by routes/index.js, behind this app's own gate: a request that has
// not signed in never leaves this process.
var express = require('express');

var router = express.Router();

// The headers that carry who is asking, and for which company. Everything
// else (cookies, host, connection) belongs to this hop only.
var PASS = /^(authorization|content-type|accept|x-[a-z0-9-]+)$/i;

router.use(async function(req, res) {
  var base = String(process.env.WORKFLOW_URL || '').replace(/\/+$/, '');
  if (!base) {
    return res.status(503).json({ message: 'Flows are not set up: WORKFLOW_URL is empty in development.env' });
  }
  var headers = {};
  Object.keys(req.headers).forEach(function(name) {
    if (PASS.test(name)) headers[name] = req.headers[name];
  });
  var hasBody = req.method !== 'GET' && req.method !== 'HEAD';
  try {
    var answer = await fetch(base + '/flows' + req.url, {
      method: req.method,
      headers: headers,
      body: hasBody ? JSON.stringify(req.body || {}) : undefined
    });
    // A refreshed token from the sign-in service rides back to the browser.
    var fresh = answer.headers.get('x-new-token');
    if (fresh) res.set('X-New-Token', fresh);
    res.status(answer.status);
    res.type(answer.headers.get('content-type') || 'application/json');
    res.send(Buffer.from(await answer.arrayBuffer()));
  } catch (err) {
    res.status(502).json({ message: 'Workflow did not answer at ' + base + ' — is it running? (' + err.message + ')' });
  }
});

module.exports = router;
