# Farmer Batch Fields Design

## Goal

Accept the farmer-facing batch fields shown in the request while preserving the Cold Chain logistics and inspection workflow.

## Farmer-provided fields

Required: `product_name` (2–200 chars), `product_type` (2–200 chars), `origin` (2–200 chars), `quantity` (> 0), and `unit` (1–50 chars).

Optional: `production_date`, `expiry_date`, `note`, `producer_name`, and integer `farmer_id`.

`event_id` and `batch_code` remain system-generated integration metadata supplied by Agri-Audit, not fields the farmer must enter. `origin` is also mapped to `pickup_address` so existing pickup and return operations continue to work.

## Data model

`agri_batches` contains the ten farmer fields above plus a technical `id` primary key. Move integration identifiers, event history, inspection decisions, logistics status, vehicle/warehouse assignment, contact and destination details, source payload, and workflow timestamps into `cold_chain_batch_operations` / `agri_batch_events`. Migrate existing operational values before dropping those columns from `agri_batches`.

## Scope

Update the Cold Chain webhook receiver and API documentation. The Agri-Audit farmer form lives in a separate repository, so its UI must separately send the documented contract. Apply the data-preserving split migration to Neon after all backend queries use the operations table.

## Safety

The migration must preserve existing batch rows and move workflow values before dropping the former operational columns. Do not print database credentials.
