BEGIN;

-- Consolidate legacy operational roles into the single STAFF role.
-- Safe to rerun: rows already using STAFF are not changed.
UPDATE users
SET role = 'STAFF'
WHERE UPPER(BTRIM(role)) IN ('MANAGER', 'OPERATOR');

COMMIT;
