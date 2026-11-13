-- =========================================
-- 1. WAREHOUSE
-- =========================================
CREATE TABLE warehouse (
    id BIGINT PRIMARY KEY,
    warehouse_name VARCHAR(255) NOT NULL,
    longitude DECIMAL(10, 7),
    latitude DECIMAL(10, 7),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- =========================================
-- 2. DELIVERY VEHICLE
-- =========================================
CREATE TABLE delivery_vehicle (
    id BIGINT PRIMARY KEY,
    license_plate VARCHAR(20) NOT NULL UNIQUE,
    warehouse_id BIGINT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_vehicle_warehouse
        FOREIGN KEY (warehouse_id)
        REFERENCES warehouse(id)
);


-- =========================================
-- 3. DEVICE
-- =========================================
CREATE TABLE device (
    id BIGINT PRIMARY KEY,
    device_token VARCHAR(255) NOT NULL UNIQUE,
    warehouse_id BIGINT,
    vehicle_id BIGINT,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_device_warehouse
        FOREIGN KEY (warehouse_id)
        REFERENCES warehouse(id),

    CONSTRAINT fk_device_vehicle
        FOREIGN KEY (vehicle_id)
        REFERENCES delivery_vehicle(id)
);


-- =========================================
-- 4. DATA
-- =========================================
CREATE TABLE data (
    id BIGINT PRIMARY KEY,
    device_id BIGINT NOT NULL,
    temperature DECIMAL(5, 2),
    humidity DECIMAL(5, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_data_device
        FOREIGN KEY (device_id)
        REFERENCES device(id)
);


-- =========================================
-- 5. ALERT
-- =========================================
CREATE TABLE alert (
    id BIGINT PRIMARY KEY,
    device_id BIGINT NOT NULL,
    alert_type VARCHAR(50) NOT NULL,
    alert_content TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    acknowledged_by BIGINT,
    acknowledged_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_alert_device
        FOREIGN KEY (device_id)
        REFERENCES device(id)
);

-- =========================================
-- 6. USER
-- =========================================
CREATE TABLE users (
    id BIGINT PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    email VARCHAR(255),
    password VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'USER',
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    reviewed_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX users_email_lower_unique ON users (LOWER(email)) WHERE email IS NOT NULL;

-- Fresh installs start with empty operational tables. Create an administrator
-- with Backend/scripts/bootstrap-admin.js after setting bootstrap credentials.
