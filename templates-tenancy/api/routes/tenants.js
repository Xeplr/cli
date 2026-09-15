// THE TENANTS — what the picker lists and adds to (__MT_LEVEL_NAMES__), and
// the check that a caller belongs to the one their request names.
//
//   GET  /api/tenants/l1          the ones at that level the caller belongs to
//   POST /api/tenants/l1 { name } add one — and make the caller a member of it
//
// A level below the first lists only the children of the one chosen above it,
// which arrives as that level's header like on every other request.
//
// MEMBERSHIP lives in the sign-in database (userTenantsMapping): user, level,
// id, role. Adding one makes you its member. Super Admin sees and may enter
// every one.

var express = require('express');
var { getMtContext } = require('@xeplr/db');
var { generateId } = require('@xeplr/utils');
var { respond } = require('@xeplr/utils/lib/response');
var { HTTP, STATUS } = require('@xeplr/utils/isomorphic');
var authLib = require('@xeplr/auth');
var tenancy = require('../tenancy');
var { isSuperAdmin } = require('./access');
var appDatabase = require('../db/setup');

// The sign-in database, read directly — this app does not run the sign-in
// service in its own process, it only needs its membership table.
var auth = authLib.attach();

// Whoever creates one is its member, with this role: the outermost level's
// admin, a creator below it. Roles from @xeplr/factory's access migration.
var CREATOR_ROLE = { 1: 'CompanyAdmin' };
var DEEPER_ROLE = 'Creator';

var membership = null;

/**
 * Refuses a request naming a company (or any level) the caller is not a
 * member of — 403 "Not authorized for companyId …". A header that is absent
 * is let through: nothing is read or written without one anyway.
 */
async function memberGate(req, res, next) {
  if (isSuperAdmin(req)) return next();
  if (!membership) {
    await auth.ready();
    membership = authLib.mtMembershipMiddleware({ userTenantsMapping: auth.model('UserTenantsMapping') });
  }
  return membership(req, res, next);
}

function levelOf(key) {
  var level = tenancy.levels.filter(function(l) { return l.key === key; })[0];
  if (!level) throw status(HTTP.NOT_FOUND, 'No tenancy level "' + key + '"');
  return level;
}

/** The chosen parents, as mtIdN values — refusing if one is not chosen yet. */
function parentsOf(level) {
  var ctx = getMtContext();
  var index = Number(level.key.slice(1));
  var values = {};
  for (var i = 1; i < index; i++) {
    var parent = tenancy.levels[i - 1];
    if (!ctx['mtId' + i]) throw status(HTTP.BAD_REQUEST, 'Choose a ' + parent.label.toLowerCase() + ' first');
    values['mtId' + i] = ctx['mtId' + i];
  }
  return values;
}

var router = express.Router();
router.use(express.json());
router.use(memberGate);

router.get('/:level', handle(async function(req) {
  var level = levelOf(req.params.level);
  var knex = await appDatabase;
  var query = knex(level.table).select('id', 'name').where('isActive', true).where(parentsOf(level)).orderBy('name');
  if (!isSuperAdmin(req)) {
    await auth.ready();
    var ids = await auth.conn()('userTenantsMapping')
      .where({ userId: req.user.id, level: level.key, isActive: true })
      .pluck('value');
    query.whereIn('id', ids);
  }
  return query;
}));

router.post('/:level', handle(async function(req) {
  var level = levelOf(req.params.level);
  var name = String((req.body && req.body.name) || '').trim();
  if (!name || name.length > 200) throw status(HTTP.VALIDATION_ERROR, 'Give the ' + level.label.toLowerCase() + ' a name, up to 200 characters');
  var who = String(req.user.id).slice(0, 25);
  var now = new Date();
  var row = Object.assign({ id: generateId(), name: name, isActive: true, recordCreatedDate: now, recordModifiedDate: now, recordCreatedBy: who, recordModifiedBy: who }, parentsOf(level));

  var knex = await appDatabase;
  await knex(level.table).insert(row);

  await auth.ready();
  var conn = auth.conn();
  var roleName = CREATOR_ROLE[Number(level.key.slice(1))] || DEEPER_ROLE;
  var role = await conn('roles').where({ name: roleName, isActive: true }).first('id');
  await conn('userTenantsMapping').insert({
    id: generateId(), userId: req.user.id, level: level.key, value: row.id, roleId: role ? role.id : null,
    isActive: true, mtId1: '*', recordCreatedDate: now, recordModifiedDate: now, recordCreatedBy: who, recordModifiedBy: who
  });
  return [{ id: row.id, name: row.name }];
}));

function handle(fn) {
  return async function(req, res) {
    try {
      respond(res, HTTP.OK, STATUS.SUCCESS, 'success', { dataArray: (await fn(req)) || [] });
    } catch (err) {
      var code = err.status || HTTP.SERVER_ERROR;
      if (code >= 500) console.error('[tenants]', err);
      res.status(code).send({ code: code >= 500 ? STATUS.SERVER_ERROR : STATUS.BAD_REQUEST, message: code >= 500 ? 'Something went wrong' : err.message, error: null, dataArray: [] });
    }
  };
}

function status(code, message) {
  var e = new Error(message);
  e.status = code;
  return e;
}

module.exports = { router: router, memberGate: memberGate };
