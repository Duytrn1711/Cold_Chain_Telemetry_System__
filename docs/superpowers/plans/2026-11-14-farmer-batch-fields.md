# Farmer Batch Fields Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the requested farmer fields in `agri_batches` and retain the Cold Chain workflow in a separate operations table.

**Architecture:** Keep only the farmer fields and a technical primary key in `agri_batches`; move logistics and integration metadata to `cold_chain_batch_operations`. Update backend queries to join both tables and preserve the current API response shape.

**Tech Stack:** PostgreSQL, Node.js, Express, `pg`.

**Spec:** `docs/superpowers/specs/2026-11-14-farmer-batch-fields.md`

## Global Constraints

- Migrate existing logistics values before dropping operational columns from `agri_batches`.
- Do not put database credentials in source or terminal output.
- Keep event idempotency and current logistics/inspection transitions intact.
- Farmer form itself is in the separate Agri-Audit repository; document the receiver contract here.

## Review Focus

- Reject missing/short required strings and non-positive quantities with HTTP 400.
- Accept optional/null dates, note, producer name, and farmer ID.
- Continue deriving pickup and farmer return location from `origin`.
- Keep legacy `pickup_address` payloads compatible when they also provide the required product fields.
- Preserve existing batch and event metadata on the Neon database.

---

### Task 1: Split farmer and logistics data

**Files:**
- Create: `Backend/migrations/20261115_split_agri_batch_logistics.sql`

**Interfaces:** `agri_batches` holds only the farmer fields plus technical `id`; the new operations table stores workflow details.

- [ ] Copy workflow data and update event foreign keys before dropping old columns.
- [ ] Apply the migration to Neon using the direct connection.
- [ ] Read back column metadata and row count; confirm batches and events remain.

### Task 2: Accept and persist the farmer payload

**Files:**
- Modify: `Backend/controllers/agri-batch.controller.js`
- Modify: `README.md`

**Interfaces:** The pickup API accepts farmer fields plus generated `event_id` and `batch_code`; operational responses join both tables.

- [ ] Validate the specified lengths, quantity, nullable fields, and integer `farmer_id`.
- [ ] Persist `origin`, `note`, and `farmer_id`; map `origin` to `pickup_address`.
- [ ] Preserve idempotent event handling and operational columns.
- [ ] Document the revised JSON contract for Agri-Audit.

### Task 3: Verify deployment readiness

**Files:** No additional files.

- [ ] Run Node syntax checks on edited backend files.
- [ ] Confirm Neon has the new columns and the pickup SQL can select/insert the new fields without printing secrets.
- [ ] Confirm Neon row counts were not changed by the schema migration itself.
