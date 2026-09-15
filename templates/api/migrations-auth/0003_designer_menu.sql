-- "Designer" — the drawer item for designing screens (ui/src/pages/Designer.jsx).
--
-- NOT public: Publish changes database tables, so only the roles that hold
-- @xeplr/factory's design permission see the item. The API refuses everyone
-- else anyway ("Access denied: Publish factory screen"); this keeps the menu
-- honest about it.
--
-- The name must match ui/src/App.jsx's drawerItems entry EXACTLY.

INSERT INTO "menus" (id, name, "menuGroup", "isPublic", "isActive", "mtId1", "recordCreatedDate", "recordModifiedDate")
SELECT encode(gen_random_bytes(12), 'hex'), 'Designer', '', false, true, '*', now(), now()
WHERE NOT EXISTS (SELECT 1 FROM "menus" WHERE name = 'Designer');

INSERT INTO "menuRolesMapping" (id, "roleId", "menuId", "isActive", "mtId1", "recordCreatedDate", "recordModifiedDate")
SELECT encode(gen_random_bytes(12), 'hex'), r.id, m.id, true, '*', now(), now()
FROM "roles" r CROSS JOIN "menus" m
WHERE r.name IN ('Super Admin', 'CompanyAdmin')
  AND m.name = 'Designer'
  AND NOT EXISTS (SELECT 1 FROM "menuRolesMapping" x WHERE x."roleId" = r.id AND x."menuId" = m.id);
