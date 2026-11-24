-- Store battery and GPS speed telemetry when a sensor reports it.
-- Existing historical records remain NULL and are displayed as unavailable.
ALTER TABLE data
    ADD COLUMN IF NOT EXISTS battery_percent NUMERIC(5, 2)
        CHECK (battery_percent IS NULL OR (battery_percent >= 0 AND battery_percent <= 100)),
    ADD COLUMN IF NOT EXISTS speed_kmh NUMERIC(6, 2)
        CHECK (speed_kmh IS NULL OR (speed_kmh >= 0 AND speed_kmh <= 250));

ALTER TABLE telemetry_simulation
    ADD COLUMN IF NOT EXISTS battery_percent NUMERIC(5, 2)
        CHECK (battery_percent IS NULL OR (battery_percent >= 0 AND battery_percent <= 100)),
    ADD COLUMN IF NOT EXISTS speed_kmh NUMERIC(6, 2)
        CHECK (speed_kmh IS NULL OR (speed_kmh >= 0 AND speed_kmh <= 250));
