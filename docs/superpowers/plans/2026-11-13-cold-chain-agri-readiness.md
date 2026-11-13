# Cold Chain Agri Logistics Readiness Implementation Plan

> **For agentic workers:** Implement natively in the current session, task by task. No subagents. Automated tests are out of scope unless the user asks for them.

**Goal:** Prepare Cold Chain to receive agricultural batch pickup/decision events, track pickup, inspection transfer, delivery to the producer-selected destination or return, and render operational data from PostgreSQL without frontend demo fallbacks.

**Architecture:** Add a Cold Chain-owned shipment record linked by a unique external Agri batch code; a future Agri sender can submit idempotent REST events to Cold Chain using a configured integration secret. Cold Chain owns logistics statuses, dispatch fields, and event history, while inspection approval/rejection remains Agri-owned. Existing dashboards and pages must query APIs and show empty/error states rather than invented values.

**Tech Stack:** Existing Node.js CommonJS, Express 5, PostgreSQL (`pg`), plain HTML/CSS/JavaScript, Fetch wrapper, and Chart.js.

**Spec:** User request in this conversation; Agri-Audit interoperability is deferred to the Agri repository.

## Global Constraints

- Only modify `Cold_Chain_Telemetry_System`.
- Preserve existing API behavior except where removing fabricated fallback values.
- Do not use mock/sample fallbacks for operational UI data.
- Do not add or run automated tests unless requested.
- Do not claim Agri is connected until its sender is configured to call the Cold Chain integration contract.

## Review Focus

- Duplicate/retried external Agri events must not create duplicate shipment records.
- Invalid or replayed inspection transitions must not send a shipment to the wrong destination.
- Rejected lots must be assigned the producer return address; approved lots use the Agri-selected consumption address.
- Empty database/query failures must never appear as fabricated readings, alerts, routes, or asset counts.
- Integration secrets and user credentials must not fall back to hard-coded production secrets.

---

### Task 1: Shipment data model and integration API

**Files:** `Backend/schema.sql`, `Backend/controllers/shipment.controller.js`, `Backend/routes/shipment.routes.js`, `Backend/app.js`, `Backend/.env.example`, `README.md`.

**Interfaces:** Add `agri_batch` with unique `external_batch_code`, product, producer/contact, pickup address, selected consumption address, quantity/unit, inspection decision, logistics status, optional assigned vehicle/warehouse, timestamps and reason. Add append-only `agri_batch_event` keyed by external event ID. Expose authenticated-by-secret webhook endpoints to create/update a batch and submit approval/rejection decisions; expose JWT-protected list/detail/status-transition endpoints to operators.

- [ ] Add relational tables and indexes without destructive truncation of existing operational tables.
- [ ] Validate webhook secret from environment, payload schema, idempotency key, and permitted status transitions.
- [ ] Persist batch changes and event history transactionally.
- [ ] Mount routes and document exact event payload, statuses, and required environment variables.
- [ ] Provide status transitions for requested pickup, assigned, picked up, at inspection, approved for delivery, return requested, delivered, returned, and cancelled.

### Task 2: PostgreSQL-backed logistics interface

**Files:** New `Frontend/pages/agri-batches.html`, `Frontend/js/agri-batches.js`, shared navigation in frontend pages, existing dashboard summary/report controllers and scripts.

**Interfaces:** Add `/api/agri-batches` and `/api/agri-batches/:id` reads plus operator status updates. Summary includes real shipment counts by logistics/inspection status. UI shows farmer, pickup point, destination/return point, product/quantity, decision, assigned vehicle, and current logistics status.

- [ ] Add the operational shipment page and navigation entry.
- [ ] Load shipment list/detail from API; allow only valid next-step status updates.
- [ ] Replace fixed dashboard shipment/device/alert counts and hardcoded fallback chart points with PostgreSQL aggregates.
- [ ] Render clear empty/error states when tables contain no records or API requests fail.

### Task 3: Remove frontend mock-data paths

**Files:** `Frontend/js/alerts.js`, `dashboard.js`, `data.js`, `devices.js`, `vehicles.js`, `warehouses.js`, `reports.js`, `Frontend/pages/*.html`, `Backend/controllers/data.controller.js`, affected controllers.

- [ ] Remove hardcoded alert, telemetry, vehicle, route, chart, and dropdown fallback records.
- [ ] Remove made-up battery/RSSI/latency, current timestamps, and random telemetry evolution where those values are not stored in PostgreSQL.
- [ ] Replace static example values in HTML with neutral loading/empty labels and populate form options from APIs.
- [ ] Ensure telemetry summaries, reports, and alert metrics are calculated from persisted rows only.
- [ ] Make report filters and exports reflect actual database rows and timestamps.

### Task 4: Operational documentation and review

**Files:** `README.md`, `docs/superpowers/plans/2026-11-13-cold-chain-agri-readiness.md`.

- [ ] Document schema setup/migration safety, environment configuration, webhook contract, logistics lifecycle, and the requirement for Agri to send events before end-to-end integration works.
- [ ] Review changed files for remaining operational mock fallbacks and paths that still fabricate values.
- [ ] Check JavaScript syntax and inspect the final diff; no automated tests are run under the current instruction.

