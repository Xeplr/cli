// TENANCY — the levels this app's data belongs to, outermost first
// (__MT_LEVEL_NAMES__).
//
// Every row a screen saves is stamped with the chosen one(s) in mtId1… and
// every read sees only those rows. The UI registers the SAME levels
// (ui/src/tenancy.js) so its requests carry the same headers; keep the two in
// step if you ever change them.
//
//   levels  one entry per level: its header, the column name it stands for,
//           and the table its choices live in
//   slots   the shape @xeplr/db's registerMTs takes
module.exports = __MT_TENANCY_JSON__;
