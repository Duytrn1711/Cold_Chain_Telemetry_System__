-- Bounded telemetry store for explicitly simulated demo readings.
-- Keep it separate from `data` so generated values are never confused with sensor measurements.
CREATE TABLE IF NOT EXISTS telemetry_simulation (
    device_id BIGINT NOT NULL REFERENCES device(id) ON DELETE CASCADE,
    slot SMALLINT NOT NULL CHECK (slot >= 0 AND slot < 60),
    temperature NUMERIC(5, 2) NOT NULL,
    humidity NUMERIC(5, 2) NOT NULL CHECK (humidity >= 0 AND humidity <= 100),
    created_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (device_id, slot)
);

CREATE INDEX IF NOT EXISTS idx_telemetry_simulation_recent
    ON telemetry_simulation (device_id, created_at DESC);
