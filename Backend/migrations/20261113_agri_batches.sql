ALTER TABLE alert ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'OPEN';
ALTER TABLE alert ADD COLUMN IF NOT EXISTS acknowledged_by BIGINT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE alert ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMPTZ;
ALTER TABLE alert ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS agri_batches (
    id BIGSERIAL PRIMARY KEY,
    external_batch_code VARCHAR(120) NOT NULL UNIQUE,
    product_name VARCHAR(255) NOT NULL,
    product_type VARCHAR(120),
    producer_name VARCHAR(255) NOT NULL,
    producer_phone VARCHAR(40),
    producer_email VARCHAR(255),
    pickup_address TEXT NOT NULL,
    pickup_latitude DECIMAL(10, 7),
    pickup_longitude DECIMAL(10, 7),
    consumption_point_name VARCHAR(255),
    consumption_address TEXT,
    consumption_latitude DECIMAL(10, 7),
    consumption_longitude DECIMAL(10, 7),
    quantity DECIMAL(14, 3) NOT NULL CHECK (quantity > 0),
    unit VARCHAR(30) NOT NULL,
    production_date DATE,
    expiry_date DATE,
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

CREATE INDEX IF NOT EXISTS idx_agri_batches_status_created
    ON agri_batches (logistics_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agri_batches_decision
    ON agri_batches (inspection_decision, created_at DESC);

CREATE TABLE IF NOT EXISTS agri_batch_events (
    id BIGSERIAL PRIMARY KEY,
    external_event_id VARCHAR(160) NOT NULL UNIQUE,
    external_batch_code VARCHAR(120) NOT NULL REFERENCES agri_batches(external_batch_code) ON DELETE CASCADE,
    event_type VARCHAR(40) NOT NULL,
    payload JSONB NOT NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_agri_batch_events_batch
    ON agri_batch_events (external_batch_code, received_at DESC);
