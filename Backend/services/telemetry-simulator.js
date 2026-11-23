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
        state = { temperature: 3.5 + (seed % 420) / 100, humidity: 58 + ((seed >>> 8) % 1800) / 100 };
    }
    state.temperature = Math.max(2.2, Math.min(7.8, state.temperature + (Math.random() - 0.5) * 0.24));
    state.humidity = Math.max(50, Math.min(85, state.humidity + (Math.random() - 0.5) * 2));
    states.set(device.id, state);
    return state;
}

async function publishTick() {
    if (running) return;
    running = true;
    try {
        const configuredArduinoToken = String(process.env.ARDUINO_DEVICE_TOKEN || "").trim();
        const result = await pool.query(`
            SELECT id, device_token
            FROM device
            WHERE status='ACTIVE'
              AND UPPER(device_token) NOT LIKE 'ARDUINO%'
              AND ($1 = '' OR device_token <> $1)
            ORDER BY id
            LIMIT $2
        `, [configuredArduinoToken, DEVICE_LIMIT]);
        if (!result.rowCount) return;

        const now = new Date();
        const slot = Math.floor(now.getTime() / 1000) % 60;
        const ids = [];
        const slots = [];
        const temperatures = [];
        const humidities = [];
        const timestamps = [];
        for (const device of result.rows) {
            const reading = nextReading(device);
            ids.push(device.id);
            slots.push(slot);
            temperatures.push(reading.temperature.toFixed(2));
            humidities.push(reading.humidity.toFixed(2));
            timestamps.push(now);
        }

        await pool.query(`
            INSERT INTO telemetry_simulation (device_id, slot, temperature, humidity, created_at)
            SELECT device_id, slot, temperature, humidity, created_at
            FROM UNNEST($1::bigint[], $2::smallint[], $3::numeric[], $4::numeric[], $5::timestamptz[])
                AS incoming(device_id, slot, temperature, humidity, created_at)
            ON CONFLICT (device_id, slot) DO UPDATE SET
                temperature=EXCLUDED.temperature,
                humidity=EXCLUDED.humidity,
                created_at=EXCLUDED.created_at
        `, [ids, slots, temperatures, humidities, timestamps]);
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
