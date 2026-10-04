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
    password VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'USER',
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO warehouse
(id, warehouse_name, longitude, latitude, status)
VALUES
(1, 'Hanoi Central Cold Storage', 105.8342, 21.0278, 'ACTIVE'),
(2, 'Hai Phong Port Cold Facility', 106.6881, 20.8449, 'ACTIVE'),
(3, 'Da Nang Regional Logistics Hub', 108.2022, 16.0544, 'ACTIVE'),
(4, 'Ho Chi Minh Mega Distribution Center', 106.6297, 10.8231, 'ACTIVE'),
(5, 'Can Tho Mekong Cold Terminal', 105.7469, 10.0452, 'ACTIVE');

INSERT INTO delivery_vehicle
(id, license_plate, warehouse_id, status)
VALUES
(1, '29A-12345', 1, 'ACTIVE'),
(2, '29A-67890', 1, 'ACTIVE'),

(3, '15A-12345', 2, 'ACTIVE'),
(4, '15A-67890', 2, 'ACTIVE'),

(5, '43A-13579', 3, 'ACTIVE'),
(6, '43A-24680', 3, 'ACTIVE'),

(7, '51D-11223', 4, 'ACTIVE'),
(8, '51D-44556', 4, 'ACTIVE'),

(9, '65A-77889', 5, 'ACTIVE'),
(10, '65A-99001', 5, 'ACTIVE');

INSERT INTO device
(id, device_token, warehouse_id, vehicle_id, status)
VALUES
-- Vehicle Mobile Sensors
(1, 'DEVICE-TOKEN-001', 1, 1, 'ACTIVE'),
(2, 'DEVICE-TOKEN-002', 1, 2, 'ACTIVE'),
(3, 'DEVICE-TOKEN-003', 1, 2, 'ACTIVE'),
(4, 'DEVICE-TOKEN-004', 2, 3, 'ACTIVE'),
(5, 'DEVICE-TOKEN-005', 2, 4, 'ACTIVE'),
(6, 'DEVICE-TOKEN-006', 2, 4, 'ACTIVE'),
(7, 'DEVICE-TOKEN-007', 3, 5, 'ACTIVE'),
(8, 'DEVICE-TOKEN-008', 3, 6, 'ACTIVE'),
(9, 'DEVICE-TOKEN-009', 3, 6, 'ACTIVE'),
(10, 'DEVICE-TOKEN-010', 4, 7, 'ACTIVE'),
(11, 'DEVICE-TOKEN-011', 4, 7, 'ACTIVE'),
(12, 'DEVICE-TOKEN-012', 4, 8, 'ACTIVE'),
(13, 'DEVICE-TOKEN-013', 5, 9, 'ACTIVE'),
(14, 'DEVICE-TOKEN-014', 5, 10, 'ACTIVE'),
-- Warehouse Stationary Sensors (Chambers & Cold Rooms)
(15, 'DEV-WH-001', 1, NULL, 'ACTIVE'),
(16, 'DEV-WH-002', 1, NULL, 'ACTIVE'),
(17, 'DEV-WH-003', 2, NULL, 'ACTIVE'),
(18, 'DEV-WH-004', 2, NULL, 'ACTIVE'),
(19, 'DEV-WH-005', 3, NULL, 'ACTIVE'),
(20, 'DEV-WH-006', 3, NULL, 'ACTIVE'),
(21, 'DEV-WH-007', 4, NULL, 'ACTIVE'),
(22, 'DEV-WH-008', 4, NULL, 'ACTIVE'),
(23, 'DEV-WH-009', 5, NULL, 'ACTIVE'),
(24, 'DEV-WH-010', 5, NULL, 'ACTIVE');

INSERT INTO data
(id, device_id, temperature, humidity, created_at)
VALUES
(1, 1, 5.20, 78.50, '2026-09-16 08:00:00'),
(2, 2, 6.10, 80.20, '2026-09-16 08:05:00'),
(3, 3, 7.30, 82.10, '2026-09-16 08:10:00'),
(4, 4, 4.80, 76.40, '2026-09-16 08:15:00'),
(5, 5, 6.50, 79.30, '2026-09-16 08:20:00'),
(6, 6, 7.80, 83.20, '2026-09-16 08:25:00'),
(7, 7, 5.60, 77.80, '2026-09-16 08:30:00'),
(8, 8, 6.90, 81.50, '2026-09-16 08:35:00'),
(9, 9, 3.70, 75.60, '2026-09-16 08:40:00'),
(10, 10, 5.90, 80.10, '2026-09-16 08:45:00'),
(11, 11, 8.70, 84.50, '2026-09-16 08:50:00'),
(12, 12, 9.20, 85.10, '2026-09-16 08:55:00'),
(13, 13, 6.30, 79.80, '2026-09-16 09:00:00'),
(14, 14, 7.10, 81.20, '2026-09-16 09:05:00'),
(15, 1, 5.80, 78.90, '2026-09-16 09:10:00'),
(16, 2, 6.40, 80.50, '2026-09-16 09:15:00'),
(17, 5, 12.00, 86.30, '2026-09-16 09:20:00'),
(18, 8, 7.50, 82.40, '2026-09-16 09:25:00'),
(19, 10, 2.40, 74.80, '2026-09-16 09:30:00'),
(20, 13, 5.10, 77.60, '2026-09-16 09:35:00'),
-- Warehouse Readings (Chambers & Cold Rooms)
(21, 15, 3.40, 62.00, '2026-09-16 09:40:00'),
(22, 15, 3.60, 61.50, '2026-09-16 09:45:00'),
(23, 16, -20.50, 44.80, '2026-09-16 09:50:00'),
(24, 17, 4.10, 64.00, '2026-09-16 09:55:00'),
(25, 18, 3.90, 63.80, '2026-09-16 10:00:00'),
(26, 19, 2.80, 58.40, '2026-09-16 10:05:00'),
(27, 21, 3.70, 62.90, '2026-09-16 10:10:00'),
(28, 23, 3.80, 61.00, '2026-09-16 10:15:00'),
(29, 24, -18.40, 46.20, '2026-09-16 10:20:00');

INSERT INTO users
(id, username, password, full_name, role, status)
VALUES
(1, 'admin', 'admin123', 'Administrator', 'ADMIN', 'ACTIVE'),
(2, 'manager', 'manager123', 'Cold Chain Manager', 'MANAGER', 'ACTIVE'),
(3, 'user', 'user123', 'Operations Specialist', 'USER', 'ACTIVE'),
(4, 'staff', 'staff123', 'Warehouse Staff', 'STAFF', 'ACTIVE');

-- =========================================================
-- RESET DATA CŨ
-- =========================================================

TRUNCATE TABLE alert, data, device, delivery_vehicle, warehouse
RESTART IDENTITY CASCADE;


-- =========================================================
-- 1. WAREHOUSE
-- 10 KHO
-- =========================================================

INSERT INTO warehouse
(id, warehouse_name, longitude, latitude, status)
VALUES
(1, 'Hanoi Central Cold Storage', 105.8342, 21.0278, 'ACTIVE'),
(2, 'Hai Phong Port Cold Facility', 106.6881, 20.8449, 'ACTIVE'),
(3, 'Quang Ninh Cold Logistics Hub', 107.2925, 20.9710, 'ACTIVE'),
(4, 'Thanh Hoa Regional Cold Center', 105.7769, 19.8067, 'ACTIVE'),
(5, 'Da Nang Regional Logistics Hub', 108.2022, 16.0544, 'ACTIVE'),
(6, 'Quang Ngai Cold Storage', 108.8044, 15.1214, 'ACTIVE'),
(7, 'Ho Chi Minh Mega Distribution Center', 106.6297, 10.8231, 'ACTIVE'),
(8, 'Binh Duong Cold Chain Center', 106.6297, 11.3254, 'ACTIVE'),
(9, 'Dong Nai Distribution Hub', 107.1676, 10.9574, 'ACTIVE'),
(10, 'Can Tho Mekong Cold Terminal', 105.7469, 10.0452, 'ACTIVE');


-- =========================================================
-- 2. DELIVERY VEHICLE
-- 20 XE
-- MỖI KHO 2 XE
-- =========================================================

INSERT INTO delivery_vehicle
(id, license_plate, warehouse_id, status)
VALUES
(1,  '29A-12345', 1, 'ACTIVE'),
(2,  '29A-67890', 1, 'ACTIVE'),

(3,  '15A-12345', 2, 'ACTIVE'),
(4,  '15A-67890', 2, 'ACTIVE'),

(5,  '14A-13579', 3, 'ACTIVE'),
(6,  '14A-24680', 3, 'ACTIVE'),

(7,  '36A-11223', 4, 'ACTIVE'),
(8,  '36A-44556', 4, 'ACTIVE'),

(9,  '43A-13579', 5, 'ACTIVE'),
(10, '43A-24680', 5, 'ACTIVE'),

(11, '76A-11223', 6, 'ACTIVE'),
(12, '76A-44556', 6, 'ACTIVE'),

(13, '51D-11223', 7, 'ACTIVE'),
(14, '51D-44556', 7, 'ACTIVE'),

(15, '61A-12345', 8, 'ACTIVE'),
(16, '61A-67890', 8, 'ACTIVE'),

(17, '60A-13579', 9, 'ACTIVE'),
(18, '60A-24680', 9, 'ACTIVE'),

(19, '65A-77889', 10, 'ACTIVE'),
(20, '65A-99001', 10, 'ACTIVE');


-- =========================================================
-- 3. DEVICE
-- 40 DEVICE
--
-- MỖI KHO:
--   - 2 device cho 2 xe
--   - 2 device cố định tại kho
--
-- Tổng:
--   20 vehicle devices
--   20 warehouse devices
--   = 40 devices
-- =========================================================

INSERT INTO device
(id, device_token, warehouse_id, vehicle_id, status)
VALUES

-- KHO 1
(1,  'DEVICE-TOKEN-001', 1, 1, 'ACTIVE'),
(2,  'DEVICE-TOKEN-002', 1, 2, 'ACTIVE'),
(3,  'DEV-WH-001',        1, NULL, 'ACTIVE'),
(4,  'DEV-WH-002',        1, NULL, 'ACTIVE'),

-- KHO 2
(5,  'DEVICE-TOKEN-003', 2, 3, 'ACTIVE'),
(6,  'DEVICE-TOKEN-004', 2, 4, 'ACTIVE'),
(7,  'DEV-WH-003',        2, NULL, 'ACTIVE'),
(8,  'DEV-WH-004',        2, NULL, 'ACTIVE'),

-- KHO 3
(9,  'DEVICE-TOKEN-005', 3, 5, 'ACTIVE'),
(10, 'DEVICE-TOKEN-006', 3, 6, 'ACTIVE'),
(11, 'DEV-WH-005',        3, NULL, 'ACTIVE'),
(12, 'DEV-WH-006',        3, NULL, 'ACTIVE'),

-- KHO 4
(13, 'DEVICE-TOKEN-007', 4, 7, 'ACTIVE'),
(14, 'DEVICE-TOKEN-008', 4, 8, 'ACTIVE'),
(15, 'DEV-WH-007',        4, NULL, 'ACTIVE'),
(16, 'DEV-WH-008',        4, NULL, 'ACTIVE'),

-- KHO 5
(17, 'DEVICE-TOKEN-009', 5, 9, 'ACTIVE'),
(18, 'DEVICE-TOKEN-010', 5, 10, 'ACTIVE'),
(19, 'DEV-WH-009',        5, NULL, 'ACTIVE'),
(20, 'DEV-WH-010',        5, NULL, 'ACTIVE'),

-- KHO 6
(21, 'DEVICE-TOKEN-011', 6, 11, 'ACTIVE'),
(22, 'DEVICE-TOKEN-012', 6, 12, 'ACTIVE'),
(23, 'DEV-WH-011',        6, NULL, 'ACTIVE'),
(24, 'DEV-WH-012',        6, NULL, 'ACTIVE'),

-- KHO 7
(25, 'DEVICE-TOKEN-013', 7, 13, 'ACTIVE'),
(26, 'DEVICE-TOKEN-014', 7, 14, 'ACTIVE'),
(27, 'DEV-WH-013',        7, NULL, 'ACTIVE'),
(28, 'DEV-WH-014',        7, NULL, 'ACTIVE'),

-- KHO 8
(29, 'DEVICE-TOKEN-015', 8, 15, 'ACTIVE'),
(30, 'DEVICE-TOKEN-016', 8, 16, 'ACTIVE'),
(31, 'DEV-WH-015',        8, NULL, 'ACTIVE'),
(32, 'DEV-WH-016',        8, NULL, 'ACTIVE'),

-- KHO 9
(33, 'DEVICE-TOKEN-017', 9, 17, 'ACTIVE'),
(34, 'DEVICE-TOKEN-018', 9, 18, 'ACTIVE'),
(35, 'DEV-WH-017',        9, NULL, 'ACTIVE'),
(36, 'DEV-WH-018',        9, NULL, 'ACTIVE'),

-- KHO 10
(37, 'DEVICE-TOKEN-019', 10, 19, 'ACTIVE'),
(38, 'DEVICE-TOKEN-020', 10, 20, 'ACTIVE'),
(39, 'DEV-WH-019',        10, NULL, 'ACTIVE'),
(40, 'DEV-WH-020',        10, NULL, 'ACTIVE');


-- =========================================================
-- 4. TELEMETRY DATA
-- 40 DEVICE × 10 RECORD
-- = 400 RECORD
-- =========================================================

INSERT INTO data
(id, device_id, temperature, humidity, created_at)

SELECT
    ((d.id - 1) * 10) + t.n AS id,

    d.id AS device_id,

    CASE

        -- Một số device cố tình có nhiệt độ bất thường
        WHEN d.id IN (4, 16, 28, 40) AND t.n IN (3, 7)
            THEN -15.00 + (t.n * 0.5)

        WHEN d.id IN (8, 20, 32) AND t.n IN (4, 8)
            THEN 10.00 + t.n * 0.3

        WHEN d.id IN (12, 24, 36) AND t.n = 6
            THEN 9.50

        -- Các device còn lại nằm trong khoảng bình thường
        ELSE
            ROUND(
                (2.5 + ((d.id * 7 + t.n * 3) % 55) / 10.0)::numeric,
                2
            )

    END AS temperature,

    CASE

        -- Một số device có độ ẩm cao
        WHEN d.id IN (2, 6, 10, 14, 18, 22, 26, 30, 34, 38)
             AND t.n IN (3, 6, 9)
            THEN 82.00 + t.n

        ELSE
            ROUND(
                (60 + ((d.id * 5 + t.n * 4) % 190) / 10.0)::numeric,
                2
            )

    END AS humidity,

    TIMESTAMP '2026-10-01 08:00:00'
        + ((d.id - 1) * INTERVAL '20 minutes')
        + ((t.n - 1) * INTERVAL '10 minutes') AS created_at

FROM device d
CROSS JOIN generate_series(1, 10) AS t(n)

ORDER BY d.id, t.n;


-- =========================================================
-- 5. ALERT
-- TẠO ALERT DỰA TRÊN TELEMETRY
--
-- NHIỆT ĐỘ:
--   < 2°C
--   > 8°C
--
-- ĐỘ ẨM:
--   > 80%
-- =========================================================

INSERT INTO alert
(id, device_id, alert_type, alert_content, created_at)

SELECT
    ROW_NUMBER() OVER (ORDER BY x.created_at, x.data_id) AS id,

    x.device_id,

    x.alert_type,

    x.alert_content,

    x.created_at

FROM
(
    -- =========================================
    -- TEMPERATURE ALERT
    -- =========================================

    SELECT
        d.id AS data_id,
        d.device_id,
        'TEMPERATURE' AS alert_type,

        CASE
            WHEN d.temperature < 2 THEN
                'Temperature too low: '
                || d.temperature
                || '°C. Safe range is 2°C - 8°C.'

            WHEN d.temperature > 8 THEN
                'Temperature too high: '
                || d.temperature
                || '°C. Safe range is 2°C - 8°C.'
        END AS alert_content,

        d.created_at

    FROM data d

    WHERE d.temperature < 2
       OR d.temperature > 8


    UNION ALL


    -- =========================================
    -- HUMIDITY ALERT
    -- =========================================

    SELECT
        d.id AS data_id,
        d.device_id,
        'HUMIDITY' AS alert_type,

        'Humidity too high: '
        || d.humidity
        || '%. Warning threshold is 80% RH.'
        AS alert_content,

        d.created_at

    FROM data d

    WHERE d.humidity > 80

) x

ORDER BY x.created_at, x.data_id;