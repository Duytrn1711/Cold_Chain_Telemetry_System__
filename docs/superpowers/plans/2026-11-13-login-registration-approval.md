# Login registration and approval implementation plan

## 1. Database and authentication API
- Add email and approval audit columns/indexes to fresh schema and a safe additive migration.
- Add registration validation, bcrypt hashing, duplicate handling, and PENDING state.
- Ensure login verifies credentials but issues tokens only for ACTIVE accounts.
- Add ADMIN-only registration queue and approve/reject endpoint; restrict role grants to STAFF/MANAGER.
- Register endpoints in auth router and update setup documentation.

## 2. Login and registration UI
- Replace technical bottom metrics and telemetry preview with company operations information.
- Remove unconfigured SSO buttons.
- Add an in-place registration form with role request, password confirmation, and pending-review feedback.
- Keep sign-in as the default view and preserve responsive styling.

## 3. Administrator approval UI
- Add an ADMIN-only page listing PENDING requests from the API.
- Let admins approve with the final STAFF/MANAGER role or reject; refresh the queue after each decision.
- Add admin-only sidebar navigation and responsive empty/error/loading states.

## 4. Verification
- Run `node --check` on modified JavaScript and `git diff --check`.
- Do not run automated tests under the session instruction.
- Confirm fresh schema and migration contain matching user columns and role/status behavior.
