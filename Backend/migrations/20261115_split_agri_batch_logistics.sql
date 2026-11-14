BEGIN;

CREATE TABLE IF NOT EXISTS cold_chain_batch_operations (
    batch_id BIGINT PRIMARY KEY REFERENCES agri_batches(id) ON DELETE CASCADE,
    external_batch_code VARCHAR(120) NOT NULL UNIQUE,
    producer_phone VARCHAR(40),
    producer_email VARCHAR(255),
    pickup_latitude DECIMAL(10, 7),
    pickup_longitude DECIMAL(10, 7),
    consumption_point_name VARCHAR(255),
    consumption_address TEXT,
    consumption_latitude DECIMAL(10, 7),
    consumption_longitude DECIMAL(10, 7),
    inspection_decision VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (inspection_decision IN ('PENDING', 'APPROVED', 'REJECTED')),
    decision_reason TEXT,
    logistics_status VARCHAR(30) NOT NULL DEFAULT 'PICKUP_REQUESTED'
        CHECK (logistics_status IN (
            'PICKUP_REQUESTED', 'PICKUP_ASSIGNED', 'PICKED_UP', 'AT_INSPECTION',
            'DELIVERY_READY', 'RETURN_READY', 'OUT_FOR_DELIVERY', 'OUT_FOR_RETURN',
            'DELIVERED', 'RETURNED', 'CANCELLED'
        )),
    warehouse_id BIGINT REFERENCES warehouse(id) ON DELETE SET NULL,
    vehicle_id BIGINT REFERENCES delivery_vehicle(id) ON DELETE SET NULL,
    source_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    decided_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

INSERT INTO cold_chain_batch_operations (
    batch_id, external_batch_code, producer_phone, producer_email,
    pickup_latitude, pickup_longitude, consumption_point_name, consumption_address,
    consumption_latitude, consumption_longitude, inspection_decision, decision_reason,
    logistics_status, warehouse_id, vehicle_id, source_payload,
    created_at, updated_at, decided_at, completed_at
)
SELECT id, external_batch_code, producer_phone, producer_email,
    pickup_latitude, pickup_longitude, consumption_point_name, consumption_address,
    consumption_latitude, consumption_longitude, inspection_decision, decision_reason,
    logistics_status, warehouse_id, vehicle_id, source_payload,
    created_at, updated_at, decided_at, completed_at
FROM agri_batches
ON CONFLICT (batch_id) DO NOTHING;

UPDATE agri_batches SET origin = pickup_address WHERE origin IS NULL;

ALTER TABLE agri_batch_events
    DROP CONSTRAINT IF EXISTS agri_batch_events_external_batch_code_fkey;
ALTER TABLE agri_batch_events
    ADD CONSTRAINT agri_batch_events_external_batch_code_fkey
    FOREIGN KEY (external_batch_code)
    REFERENCES cold_chain_batch_operations(external_batch_code) ON DELETE CASCADE;

DROP INDEX IF EXISTS idx_agri_batches_status_created;
DROP INDEX IF EXISTS idx_agri_batches_decision;

ALTER TABLE agri_batches
    DROP COLUMN IF EXISTS external_batch_code,
    DROP COLUMN IF EXISTS producer_phone,
    DROP COLUMN IF EXISTS producer_email,
    DROP COLUMN IF EXISTS pickup_address,
    DROP COLUMN IF EXISTS pickup_latitude,
    DROP COLUMN IF EXISTS pickup_longitude,
    DROP COLUMN IF EXISTS consumption_point_name,
    DROP COLUMN IF EXISTS consumption_address,
    DROP COLUMN IF EXISTS consumption_latitude,
    DROP COLUMN IF EXISTS consumption_longitude,
    DROP COLUMN IF EXISTS inspection_decision,
    DROP COLUMN IF EXISTS decision_reason,
    DROP COLUMN IF EXISTS logistics_status,
    DROP COLUMN IF EXISTS warehouse_id,
    DROP COLUMN IF EXISTS vehicle_id,
    DROP COLUMN IF EXISTS source_payload,
    DROP COLUMN IF EXISTS created_at,
    DROP COLUMN IF EXISTS updated_at,
    DROP COLUMN IF EXISTS decided_at,
    DROP COLUMN IF EXISTS completed_at;

ALTER TABLE agri_batches
    ALTER COLUMN product_name TYPE VARCHAR(200),
    ALTER COLUMN origin SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cold_chain_batch_ops_status_created
    ON cold_chain_batch_operations(logistics_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cold_chain_batch_ops_decision
    ON cold_chain_batch_operations(inspection_decision, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cold_chain_batch_ops_vehicle_status
    ON cold_chain_batch_operations(vehicle_id, logistics_status, updated_at DESC);

COMMIT;
