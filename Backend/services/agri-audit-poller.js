const crypto = require("crypto");
const pool = require("../db");

const DEFAULT_INTERVAL_MS = 5_000;
let timer;
let running = false;
let cachedAccessToken = null;
let cachedTokenExpiresAt = 0;

function stableEventId(kind, batchCode, status = "") {
    const digest = crypto.createHash("sha256").update(`${batchCode}:${status}`).digest("hex").slice(0, 40);
    return `agri-poll:${kind}:${digest}`;
}

async function requestJson(url, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        const body = await response.json().catch(() => null);
        if (!response.ok) {
            const error = new Error(`Agri-Audit returned HTTP ${response.status}`);
            error.status = response.status;
            throw error;
        }
        return body;
    } finally {
        clearTimeout(timeout);
    }
}

async function getAgriBatches(config) {
    async function login() {
        const result = await requestJson(`${config.baseUrl}/auth/login-auditor`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ identifier: config.identifier, password: config.password })
        });
        if (!result || typeof result.access_token !== "string" || !result.access_token) {
            throw new Error("Agri-Audit admin login response did not include an access token");
        }
        cachedAccessToken = result.access_token;
        cachedTokenExpiresAt = Date.now() + 50 * 60 * 1000;
    }

    if (!cachedAccessToken || Date.now() >= cachedTokenExpiresAt) await login();
    let batches;
    try {
        batches = await requestJson(`${config.baseUrl}/batches`, {
            headers: { Authorization: `Bearer ${cachedAccessToken}` }
        });
    } catch (error) {
        if (error.status !== 401) throw error;
        cachedAccessToken = null;
        cachedTokenExpiresAt = 0;
        await login();
        batches = await requestJson(`${config.baseUrl}/batches`, {
            headers: { Authorization: `Bearer ${cachedAccessToken}` }
        });
    }
    if (!Array.isArray(batches)) throw new Error("Agri-Audit batch list response was not an array");
    return batches;
}

function hasValidBatch(batch) {
    return batch && typeof batch.batch_code === "string" && batch.batch_code.trim() &&
        typeof batch.product_name === "string" && batch.product_name.trim().length >= 2 &&
        typeof batch.product_type === "string" && batch.product_type.trim().length >= 2 &&
        typeof batch.origin === "string" && batch.origin.trim().length >= 2 &&
        Number.isFinite(Number(batch.quantity)) && Number(batch.quantity) > 0 &&
        typeof batch.unit === "string" && batch.unit.trim();
}

function firstText(...values) {
    return values.find((value) => typeof value === "string" && value.trim())?.trim() || null;
}

function extractDestination(batch) {
    const destination = batch.destination && typeof batch.destination === "object" ? batch.destination : {};
    const consumptionPoint = batch.consumption_point && typeof batch.consumption_point === "object"
        ? batch.consumption_point : {};
    return {
        name: firstText(batch.consumption_point_name, batch.destination_name, batch.destination_point_name,
            typeof batch.consumption_point === "string" ? batch.consumption_point : null,
            destination.name, destination.point_name, consumptionPoint.name),
        address: firstText(batch.consumption_address, batch.destination_address, batch.destination_point_address,
            batch.consumption_point_address, destination.address, destination.full_address, consumptionPoint.address),
        latitude: batch.consumption_latitude ?? batch.destination_latitude ?? destination.latitude ?? consumptionPoint.latitude ?? null,
        longitude: batch.consumption_longitude ?? batch.destination_longitude ?? destination.longitude ?? consumptionPoint.longitude ?? null
    };
}

async function syncDecisionIfReady(client, batchCode, batch, operation) {
    const auditStatus = String(batch.status || "").toUpperCase();
    const decision = auditStatus === "AUDITED" ? "APPROVED" : auditStatus === "REJECTED" ? "REJECTED" : null;
    if (!decision || operation.logistics_status !== "AT_INSPECTION" || operation.inspection_decision !== "PENDING") return false;

    const eventId = stableEventId("decision", batchCode, auditStatus);
    await client.query(`INSERT INTO agri_batch_events (external_event_id, external_batch_code, event_type, payload)
        VALUES ($1,$2,$3,$4::jsonb) ON CONFLICT (external_event_id) DO NOTHING`, [
        eventId, batchCode, `INSPECTION_${decision}`, JSON.stringify(batch)
    ]);
    await client.query(`UPDATE cold_chain_batch_operations SET
        inspection_decision=$2,
        logistics_status=$3,
        decision_reason=$4,
        decided_at=COALESCE($5::timestamptz,CURRENT_TIMESTAMP),
        consumption_point_name=COALESCE($6,consumption_point_name),
        consumption_address=COALESCE($7,consumption_address),
        updated_at=CURRENT_TIMESTAMP
        WHERE external_batch_code=$1`, [
        batchCode,
        decision,
        decision === "APPROVED" ? "DELIVERY_READY" : "RETURN_READY",
        batch.reason || batch.decision_reason || null,
        batch.audit_date || null,
        batch.consumption_point_name || null,
        batch.consumption_address || null
    ]);
    return true;
}

async function syncOneBatch(batch) {
    if (!hasValidBatch(batch)) return "invalid";
    const batchCode = batch.batch_code.trim();
    const destination = extractDestination(batch);
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [batchCode]);
        const existing = await client.query(`SELECT o.batch_id, o.logistics_status, o.inspection_decision
            FROM cold_chain_batch_operations o WHERE o.external_batch_code=$1 FOR UPDATE`, [batchCode]);

        if (!existing.rowCount) {
            const inserted = await client.query(`INSERT INTO agri_batches
                (product_name,product_type,origin,note,farmer_id,producer_name,quantity,unit,production_date,expiry_date)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`, [
                batch.product_name.trim(), batch.product_type.trim(), batch.origin.trim(), batch.note || null,
                Number.isSafeInteger(batch.farmer_id) ? batch.farmer_id : null,
                typeof batch.producer_name === "string" ? batch.producer_name.trim().slice(0, 255) || null : null,
                Number(batch.quantity), batch.unit.trim().slice(0, 50),
                batch.production_date || null, batch.expiry_date || null
            ]);
            const batchId = inserted.rows[0].id;
            await client.query(`INSERT INTO cold_chain_batch_operations
                (batch_id,external_batch_code,consumption_point_name,consumption_address,consumption_latitude,consumption_longitude,source_payload)
                VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)`, [batchId, batchCode, destination.name,
                destination.address, destination.latitude, destination.longitude, JSON.stringify(batch)]);
            await client.query(`INSERT INTO agri_batch_events (external_event_id,external_batch_code,event_type,payload)
                VALUES ($1,$2,'PICKUP_REQUESTED',$3::jsonb) ON CONFLICT (external_event_id) DO NOTHING`, [
                stableEventId("created", batchCode), batchCode, JSON.stringify(batch)
            ]);
            await client.query("COMMIT");
            return "imported";
        }

        const operation = existing.rows[0];
        if (destination.name || destination.address || destination.latitude !== null || destination.longitude !== null) {
            await client.query(`UPDATE cold_chain_batch_operations SET
                consumption_point_name=COALESCE($2,consumption_point_name),
                consumption_address=COALESCE($3,consumption_address),
                consumption_latitude=COALESCE($4,consumption_latitude),
                consumption_longitude=COALESCE($5,consumption_longitude),
                source_payload=$6::jsonb, updated_at=CURRENT_TIMESTAMP
                WHERE external_batch_code=$1`, [batchCode, destination.name, destination.address,
                destination.latitude, destination.longitude, JSON.stringify(batch)]);
        }
        const applied = await syncDecisionIfReady(client, batchCode, batch, operation);
        await client.query("COMMIT");
        return applied ? "decision" : "existing";
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

async function pollOnce() {
    if (running) return;
    const baseUrl = (process.env.AGRI_AUDIT_API_URL || "").trim().replace(/\/+$/, "");
    const identifier = process.env.AGRI_AUDIT_AUDITOR_IDENTIFIER || process.env.AGRI_AUDIT_ADMIN_IDENTIFIER;
    const password = process.env.AGRI_AUDIT_AUDITOR_PASSWORD || process.env.AGRI_AUDIT_ADMIN_PASSWORD;
    if (!baseUrl || !identifier || !password) return;

    running = true;
    try {
        const batches = await getAgriBatches({ baseUrl, identifier, password });
        const summary = { imported: 0, decisions: 0, existing: 0, invalid: 0, failed: 0 };
        for (const batch of batches) {
            try {
                const result = await syncOneBatch(batch);
                if (result === "imported") summary.imported += 1;
                else if (result === "decision") summary.decisions += 1;
                else if (result === "invalid") summary.invalid += 1;
                else summary.existing += 1;
            } catch (error) {
                summary.failed += 1;
                console.error("Agri-Audit batch sync failed:", error.code || error.status || "unknown");
            }
        }
        if (summary.imported || summary.decisions || summary.invalid || summary.failed) {
            console.info("Agri-Audit polling completed:", summary);
        }
    } catch (error) {
        console.error("Agri-Audit polling failed:", error.code || error.status || error.message);
    } finally {
        running = false;
    }
}

function startAgriAuditPoller() {
    const configured = Number.parseInt(process.env.AGRI_AUDIT_POLL_INTERVAL_MS || `${DEFAULT_INTERVAL_MS}`, 10);
    const interval = Number.isFinite(configured) && configured >= 15_000 ? configured : DEFAULT_INTERVAL_MS;
    if (timer) clearInterval(timer);
    void pollOnce();
    timer = setInterval(pollOnce, interval);
    timer.unref?.();
}

module.exports = { startAgriAuditPoller, pollOnce, syncOneBatch };
