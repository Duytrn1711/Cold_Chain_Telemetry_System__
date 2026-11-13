# Login registration and approval design

## Intent
Update the login page so its company-facing area describes Cold Chain operations instead of database and integration labels. Add public account registration with administrator approval before any new account can sign in.

## Goals
- Keep sign-in and registration on the same page with a clear toggle.
- Accept STAFF and MANAGER requests only; public registration can never create ADMIN accounts.
- Store password hashes, email, requested role, and PENDING status in PostgreSQL.
- Provide ADMIN-only review actions to approve (with STAFF or MANAGER role) or reject requests.
- Prevent non-active accounts from receiving JWTs.

## Non-goals
- No SSO, email verification, password recovery, or notification service.
- No public ADMIN registration or automatic role grants.

## Approaches and decision
1. Put sign-in and registration on one page, toggled in place; add a dedicated admin approval page. This keeps the login entry point compact and makes the status visible.
2. Put registration on a separate public page. This is simpler per page but separates the requested account flow from sign-in.

Use approach 1, as the user asked for the login UI and registration flow together. Registration roles are limited to STAFF/MANAGER; an administrator chooses the final role at approval.

## Implementation
- Add email and approval audit fields to the fresh users schema and an additive migration for existing databases.
- Add public registration and admin-only list/decision endpoints.
- Build an admin approval queue and show it only in ADMIN navigation.
- Remove technical platform badges, telemetry preview claims, and unconfigured SSO controls from the login screen; use company operations information instead.
- Keep registration and approval feedback tied to API/database responses.

## Constraints
- Follow the existing Express/PostgreSQL/JWT/bcryptjs stack.
- Existing admin accounts remain active; migration must not reset existing data.
- Verify JavaScript syntax and diff formatting. Automated tests are not run per the session instruction.
