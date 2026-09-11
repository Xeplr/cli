-- The sample table.
--
-- `id` is varchar(25) because ids are minted by the framework
-- (@xeplr/utils' generateId) rather than by the database.
--
-- `isActive` is what makes a delete SOFT: the generic delete route sets it
-- false and every query filters on it, so a deleted row stops appearing
-- without ever leaving the table.

CREATE TABLE IF NOT EXISTS "tasks" (
  "id"                  varchar(25) PRIMARY KEY,
  "title"               varchar(200) NOT NULL,
  "description"         varchar(1000),
  "status"              varchar(20) NOT NULL DEFAULT 'todo',
  "dueDate"             date,
  "isActive"            boolean DEFAULT true,
  "recordCreatedDate"   timestamptz,
  "recordModifiedDate"  timestamptz,
  "recordCreatedBy"     varchar(25),
  "recordModifiedBy"    varchar(25)
);

CREATE INDEX IF NOT EXISTS "tasks_status_idx" ON "tasks" ("status");
