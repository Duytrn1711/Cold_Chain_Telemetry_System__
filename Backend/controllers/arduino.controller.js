const crypto = require("crypto");
const pool = require("../db");

function authorizeArduino(req, res, next) {
    const expected = process.env.ARDUINO_INGEST_TOKEN || "";
    if (!expected) {
        return res.status(503).json({ success: false, data: null, message: "Arduino ingestion is not configured" });
    }

    const authorization = req.get("authorization") || "";
    const supplied = req.get("x-arduino-token") || authorization.replace(/^Bearer\s+/i, "");
    const expectedBuffer = Buffer.from(expected);
    const suppliedBuffer = Buffer.from(supplied);
    const valid = expectedBuffer.length === suppliedBuffer.length && crypto.timingSafeEqual(expectedBuffer, suppliedBuffer);
    if (!valid) return res.status(401).json({ success: false, data: null, message: "Invalid Arduino integration token" });
    next();
}

async function insertWithGeneratedId(client, table, columns, values) {
    const columnNames = columns.join(", ");
    const valueParams = values.map((_, index) => `$${index + 2}`);
    for (let attempt = 0; attempt < 5; attempt += 1) {
        await client.query("SAVEPOINT generated_id_insert");
        try {
            const idResult = await client.query(`SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM ${table}`);
            const id = idResult.rows[0].next_id;
            const inserted = await client.query(
                `INSERT INTO ${table} (id, ${columnNames}) VALUES ($1, ${valueParams.join(", ")}) RETURNING *`,
                [id, ...values]
            );
            await client.query("RELEASE SAVEPOINT generated_id_insert");
            return inserted.rows[0];
        } catch (error) {
            await client.query("ROLLBACK TO SAVEPOINT generated_id_insert");
            await client.query("RELEASE SAVEPOINT generated_id_insert");
            if (error.code !== "23505" || attempt === 4) throw error;
        }
    }
    throw new Error("Could not allocate a database ID");
}

exports.authorizeArduino = authorizeArduino;

exports.ingestTelemetry = async (req, res) => {
    const body = req.body || {};
    const configuredToken = String(process.env.ARDUINO_DEVICE_TOKEN || "").trim();
    const suppliedDeviceToken = typeof body.device_token === "string" ? body.device_token.trim() : "";
    const deviceToken = suppliedDeviceToken || configuredToken;
    const temperature = Number(body.temperature);
    const humidity = body.humidity === undefined || body.humidity === null || body.humidity === ""
        ? 0 : Number(body.humidity);
    const batteryPercent = body.battery_percent === undefined || body.battery_percent === null || body.battery_percent === ""
        ? null : Number(body.battery_percent);
    const speedKmh = body.speed_kmh === undefined || body.speed_kmh === null || body.speed_kmh === ""
        ? null : Number(body.speed_kmh);
    const warehouseId = process.env.ARDUINO_WAREHOUSE_ID ? Number(process.env.ARDUINO_WAREHOUSE_ID) : null;
    const vehicleId = process.env.ARDUINO_VEHICLE_ID ? Number(process.env.ARDUINO_VEHICLE_ID) : null;

    if (!deviceToken || deviceToken.length > 255) {
        return res.status(400).json({ success: false, data: null, message: "Provide a device_token (or configure ARDUINO_DEVICE_TOKEN)" });
    }
    if (!Number.isFinite(temperature) || temperature < -100 || temperature > 100 ||
        !Number.isFinite(humidity) || humidity < 0 || humidity > 100 ||
        (batteryPercent !== null && (!Number.isFinite(batteryPercent) || batteryPercent < 0 || batteryPercent > 100)) ||
        (speedKmh !== null && (!Number.isFinite(speedKmh) || speedKmh < 0 || speedKmh > 250))) {
        return res.status(400).json({ success: false, data: null, message: "Invalid telemetry: temperature -100..100°C, humidity and battery 0..100%, speed 0..250 km/h" });
    }
    if ((warehouseId !== null && (!Number.isSafeInteger(warehouseId) || warehouseId <= 0)) ||
        (vehicleId !== null && (!Number.isSafeInteger(vehicleId) || vehicleId <= 0)) ||
        (warehouseId !== null && vehicleId !== null)) {
        return res.status(503).json({ success: false, data: null, message: "Configure at most one valid Arduino warehouse or vehicle assignment" });
    }

    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`arduino-device:${deviceToken}`]);
        let device = await client.query("SELECT id, status FROM device WHERE device_token = $1 FOR UPDATE", [deviceToken]);
        if (!device.rowCount) {
            // The legacy single-Arduino bridge may auto-register its configured device.
            // Additional sensors must first be registered in Device Management and assigned there.
            if (deviceToken !== configuredToken) {
                await client.query("ROLLBACK");
                return res.status(404).json({ success: false, data: null, message: "Unknown device token; register the device before sending telemetry" });
            }
            const insertedDevice = await insertWithGeneratedId(client, "device",
                ["device_token", "warehouse_id", "vehicle_id", "status", "created_at"],
                [deviceToken, warehouseId, vehicleId, "ACTIVE", new Date()]);
            device = { rows: [insertedDevice], rowCount: 1 };
        }
        if (device.rows[0].status !== "ACTIVE") {
            await client.query("ROLLBACK");
            return res.status(409).json({ success: false, data: null, message: "Arduino device is inactive" });
        }

        const record = await insertWithGeneratedId(client, "data",
            ["device_id", "temperature", "humidity", "battery_percent", "speed_kmh", "created_at"],
            [device.rows[0].id, temperature, humidity, batteryPercent, speedKmh, new Date()]);

        if (temperature < 2 || temperature > 8) {
            const isHigh = temperature > 8;
            const alertType = isHigh ? "NHIỆT ĐỘ QUÁ CAO" : "NHIỆT ĐỘ QUÁ THẤP";
            const alertContent = `Arduino ${deviceToken} ghi nhận ${temperature.toFixed(2)}°C, ngoài ngưỡng an toàn 2.0–8.0°C.`;
            const activeAlert = await client.query(`
                SELECT id FROM alert
                WHERE device_id = $1 AND alert_type = $2 AND status <> 'RESOLVED'
                LIMIT 1 FOR UPDATE
            `, [device.rows[0].id, alertType]);
            if (!activeAlert.rowCount) {
                await insertWithGeneratedId(client, "alert",
                    ["device_id", "alert_type", "alert_content", "created_at"],
                    [device.rows[0].id, alertType, alertContent, new Date()]);
            }
        }

        await client.query("COMMIT");
        return res.status(201).json({
            success: true,
            data: { device_id: device.rows[0].id, device_token: deviceToken, temperature: record.temperature, humidity: record.humidity, battery_percent: record.battery_percent, speed_kmh: record.speed_kmh, created_at: record.created_at },
            message: "Arduino telemetry stored; a new device was registered automatically when needed"
        });
    } catch (error) {
        await client.query("ROLLBACK");
        console.error("Arduino telemetry ingestion failed:", error.code || "unknown");
        return res.status(500).json({ success: false, data: null, message: "Could not store Arduino telemetry" });
    } finally {
        client.release();
    }
};
