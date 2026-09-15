-- "__MT_SWITCH_NAME__" — the drawer item that goes back to the picker.
--
-- Public: everybody who signs in works inside one, so everybody can change it.
-- The name is the KEY: it must match ui/src/App.jsx's drawerItems `key` EXACTLY.
-- What people read is the label, changed in Configure UI → Menu.

INSERT INTO "menus" (id, name, "menuGroup", "isPublic", "isActive", "mtId1", "recordCreatedDate", "recordModifiedDate")
SELECT encode(gen_random_bytes(12), 'hex'), '__MT_SWITCH_NAME__', '', true, true, '*', now(), now()
WHERE NOT EXISTS (SELECT 1 FROM "menus" WHERE name = '__MT_SWITCH_NAME__');

UPDATE "menus" SET "isPublic" = true WHERE name = '__MT_SWITCH_NAME__';
