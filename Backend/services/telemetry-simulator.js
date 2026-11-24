const pool = require("../db");

const TICK_MS = Math.max(1000, Number(process.env.TELEMETRY_SIMULATOR_INTERVAL_MS) || 1000);
const DEVICE_LIMIT = Math.max(1, Math.min(40, Number(process.env.TELEMETRY_SIMULATOR_DEVICE_LIMIT) || 40));
const states = new Map();
let timer = null;
let running = false;

function hashToken(token) {
    let hash = 2166136261;
    for (const char of token) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
    return hash >>> 0;
}

function nextReading(device) {
    let state = states.get(device.id);
    if (!state) {
        const seed = hashToken(device.device_token);
        state = {
            temperature: 3.5 + (seed % 420) / 100,
            humidity: 58 + ((seed >>> 8) % 1800) / 100,
            battery: 72 + ((seed >>> 16) % 2800) / 100,
            speed: 0
        };
    }
    state.temperature = Math.max(2.2, Math.min(7.8, state.temperature + (Math.random() - 0.5) * 0.24));
    state.humidity = Math.max(50, Math.min(85, state.humidity + (Math.random() - 0.5) * 2));
    state.battery = Math.max(5, state.battery - Math.random() * 0.001);
    if (device.is_transit) {
        const nextSpeed = state.speed === 0 ? 28 + Math.random() * 22 : state.speed + (Math.random() - 0.5) * 8;
        state.speed = Math.max(12, Math.min(82, nextSpeed));
    } else {
        state.speed = 0;
    }
    states.set(device.id, state);
    return state;
}

async function publishTick() {
    if (running) return;
    running = true;
    try {
        const configuredArduinoToken = String(process.env.ARDUINO_DEVICE_TOKEN || "").trim();
        const result = await pool.query(`
            SELECT d.id, d.device_token,
                EXISTS (
                    SELECT 1 FROM cold_chain_batch_operations o
                    WHERE o.vehicle_id = d.vehicle_id
                      AND o.logistics_status IN ('PICKUP_ASSIGNED','OUT_FOR_DELIVERY','OUT_FOR_RETURN')
                ) AS is_transit
            FROM device d
            WHERE d.status='ACTIVE'
              AND UPPER(d.device_token) NOT LIKE 'ARDUINO%'
              AND ($1 = '' OR d.device_token <> $1)
            ORDER BY d.id
            LIMIT $2
        `, [configuredArduinoToken, DEVICE_LIMIT]);
        if (!result.rowCount) return;

        const now = new Date();
        const slot = Math.floor(now.getTime() / 1000) % 60;
        const ids = [];
        const slots = [];
        const temperatures = [];
        const humidities = [];
        const batteries = [];
        const speeds = [];
        const timestamps = [];
        for (const device of result.rows) {
            const reading = nextReading(device);
            ids.push(device.id);
            slots.push(slot);
            temperatures.push(reading.temperature.toFixed(2));
            humidities.push(reading.humidity.toFixed(2));
            batteries.push(reading.battery.toFixed(2));
            speeds.push(reading.speed.toFixed(2));
            timestamps.push(now);
        }

        await pool.query(`
            INSERT INTO telemetry_simulation (device_id, slot, temperature, humidity, battery_percent, speed_kmh, created_at)
            SELECT device_id, slot, temperature, humidity, battery_percent, speed_kmh, created_at
            FROM UNNEST($1::bigint[], $2::smallint[], $3::numeric[], $4::numeric[], $5::numeric[], $6::numeric[], $7::timestamptz[])
                AS incoming(device_id, slot, temperature, humidity, battery_percent, speed_kmh, created_at)
            ON CONFLICT (device_id, slot) DO UPDATE SET
                temperature=EXCLUDED.temperature,
                humidity=EXCLUDED.humidity,
                battery_percent=EXCLUDED.battery_percent,
                speed_kmh=EXCLUDED.speed_kmh,
                created_at=EXCLUDED.created_at
        `, [ids, slots, temperatures, humidities, batteries, speeds, timestamps]);
    } catch (error) {
        console.error("Telemetry simulator tick failed:", error.code || error.message);
        if (error.code === "42P01" && timer) {
            clearInterval(timer);
            timer = null;
            console.error("Telemetry simulator stopped; apply the telemetry simulation migration first.");
        }
    } finally {
        running = false;
    }
}

function startTelemetrySimulator() {
    if (String(process.env.TELEMETRY_SIMULATOR_ENABLED).toLowerCase() !== "true") {
        console.log("Telemetry simulator disabled");
        return;
    }
    if (timer) return;
    console.log(`Telemetry simulator enabled (up to ${DEVICE_LIMIT} non-Arduino devices, every ${TICK_MS} ms)`);
    publishTick();
    timer = setInterval(publishTick, TICK_MS);
    timer.unref?.();
}

module.exports = { startTelemetrySimulator };
