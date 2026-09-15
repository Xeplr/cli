-- "Forms" — the drawer item for every form in the app: see them, make a new
-- one, design it, publish it (ui/src/pages/Forms.jsx).
--
-- SUPER ADMIN ONLY: publishing changes database tables. The API refuses
-- everyone else as well (api/routes/access.js); this keeps the menu honest
-- about it.
--
-- The name must match ui/src/App.jsx's drawerItems entry EXACTLY.

INSERT INTO "menus" (id, name, "menuGroup", "isPublic", "isActive", "mtId1", "recordCreatedDate", "recordModifiedDate")
SELECT encode(gen_random_bytes(12), 'hex'), 'Forms', '', false, true, '*', now(), now()
WHERE NOT EXISTS (SELECT 1 FROM "menus" WHERE name = 'Forms');

INSERT INTO "menuRolesMapping" (id, "roleId", "menuId", "isActive", "mtId1", "recordCreatedDate", "recordModifiedDate")
SELECT encode(gen_random_bytes(12), 'hex'), r.id, m.id, true, '*', now(), now()
FROM "roles" r CROSS JOIN "menus" m
WHERE r.name = 'Super Admin'
  AND m.name = 'Forms'
  AND NOT EXISTS (SELECT 1 FROM "menuRolesMapping" x WHERE x."roleId" = r.id AND x."menuId" = m.id);
