const pool = require("../db");

const BATCH_FIELDS = `
    b.id, o.external_batch_code, b.product_name, b.product_type, b.origin, b.note, b.farmer_id,
    b.producer_name, o.producer_phone, o.producer_email, b.origin AS pickup_address,
    o.pickup_latitude, o.pickup_longitude, o.consumption_point_name, o.consumption_address,
    o.consumption_latitude, o.consumption_longitude, b.quantity, b.unit,
    b.production_date, b.expiry_date, o.inspection_decision, o.decision_reason,
    o.logistics_status, o.warehouse_id, o.vehicle_id, o.source_payload,
    o.created_at, o.updated_at, o.decided_at, o.completed_at
`;
const BATCH_FROM = `agri_batches b JOIN cold_chain_batch_operations o ON o.batch_id = b.id`;

const INTEGRATION_TRANSITIONS = { PENDING: "AT_INSPECTION", APPROVED: "DELIVERY_READY", REJECTED: "RETURN_READY" };
const OPERATOR_TRANSITIONS = {
    PICKUP_REQUESTED: ["PICKUP_ASSIGNED", "CANCELLED"], PICKUP_ASSIGNED: ["PICKED_UP", "CANCELLED"],
    PICKED_UP: ["AT_INSPECTION"], AT_INSPECTION: [], DELIVERY_READY: ["OUT_FOR_DELIVERY"],
    RETURN_READY: ["OUT_FOR_RETURN"], OUT_FOR_DELIVERY: ["DELIVERED"], OUT_FOR_RETURN: ["RETURNED"],
    DELIVERED: [], RETURNED: [], CANCELLED: []
};

function sendError(res, status, message) { return res.status(status).json({ success: false, data: null, message }); }
function requireAgriSecret(req, res, next) {
    const configuredSecret = process.env.AGRI_WEBHOOK_SECRET;
    const suppliedSecret = req.get("x-agri-webhook-secret");
    if (!configuredSecret) return sendError(res, 503, "Agri integration is not configured");
    if (!suppliedSecret || suppliedSecret !== configuredSecret) return sendError(res, 401, "Invalid integration credentials");
    next();
}
function validString(value, max = 500) { return typeof value === "string" && value.trim().length > 0 && value.trim().length <= max; }
function validStringRange(value, min, max) { return typeof value === "string" && value.trim().length >= min && value.trim().length <= max; }
function validOptionalDate(value) {
    if (value === undefined || value === null || value === "") return true;
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
function validCommonPayload(body) { return body && validString(body.event_id, 160) && validString(body.batch_code, 120); }
function validatePickupPayload(body) {
    const qty = Number(body.quantity);
    return validCommonPayload(body) && validStringRange(body.product_name, 2, 200) &&
        validStringRange(body.product_type, 2, 200) && validStringRange(body.origin, 2, 200) &&
        validString(body.unit, 50) && Number.isFinite(qty) && qty > 0 &&
        (body.note === undefined || body.note === null || typeof body.note === "string") &&
        (body.producer_name === undefined || body.producer_name === null ||
            (typeof body.producer_name === "string" && body.producer_name.trim().length <= 255)) &&
        (body.farmer_id === undefined || body.farmer_id === null || (Number.isSafeInteger(body.farmer_id) && body.farmer_id > 0)) &&
        validOptionalDate(body.production_date) && validOptionalDate(body.expiry_date);
}
function validateDecisionPayload(body) {
    const decision = String(body.decision || "").toUpperCase();
    return validCommonPayload(body) && ["APPROVED", "REJECTED"].includes(decision) &&
        (decision !== "REJECTED" || validString(body.reason, 4000)) &&
        (decision !== "APPROVED" || validString(body.consumption_address, 2000));
}
async function selectBatch(client, batchCode) {
    return client.query(`SELECT ${BATCH_FIELDS} FROM ${BATCH_FROM} WHERE o.external_batch_code = $1`, [batchCode]);
}

async function createPickupRequest(req, res) {
    const body = req.body || {};
    if (!validatePickupPayload(body)) return sendError(res, 400, "Invalid pickup request payload");
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const eventId = body.event_id.trim();
        const batchCode = body.batch_code.trim();
        await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [eventId]);
        const seenEvent = await client.query("SELECT external_batch_code, event_type FROM agri_batch_events WHERE external_event_id = $1", [eventId]);
        if (seenEvent.rowCount) {
            if (seenEvent.rows[0].external_batch_code !== batchCode || seenEvent.rows[0].event_type !== "PICKUP_REQUESTED") {
                await client.query("ROLLBACK");
                return sendError(res, 409, "Event ID was already used for another operation or batch");
            }
            const existing = await selectBatch(client, batchCode);
            await client.query("COMMIT");
            if (!existing.rowCount) return sendError(res, 409, "Event ID was already used for another operation or batch");
            return res.status(200).json({ success: true, data: existing.rows[0], duplicate: true });
        }

        const existingOps = await client.query(`SELECT batch_id, logistics_status, inspection_decision
            FROM cold_chain_batch_operations WHERE external_batch_code = $1 FOR UPDATE`, [batchCode]);
        if (existingOps.rowCount && (existingOps.rows[0].logistics_status !== "PICKUP_REQUESTED" || existingOps.rows[0].inspection_decision !== "PENDING")) {
            await client.query("ROLLBACK");
            return sendError(res, 409, "Batch already entered the logistics workflow");
        }
        const origin = body.origin.trim();
        const producerName = typeof body.producer_name === "string" && body.producer_name.trim() ? body.producer_name.trim() : null;
        const note = typeof body.note === "string" && body.note.trim() ? body.note.trim() : null;
        let batchId;
        if (existingOps.rowCount) {
            batchId = existingOps.rows[0].batch_id;
            await client.query(`UPDATE agri_batches SET product_name=$2, product_type=$3, origin=$4,
                note=$5, farmer_id=$6, producer_name=$7, quantity=$8, unit=$9,
                production_date=$10, expiry_date=$11 WHERE id=$1`, [batchId, body.product_name.trim(), body.product_type.trim(), origin,
                note, body.farmer_id ?? null, producerName, Number(body.quantity), body.unit.trim(), body.production_date || null, body.expiry_date || null]);
            await client.query(`UPDATE cold_chain_batch_operations SET source_payload=$2::jsonb, updated_at=CURRENT_TIMESTAMP
                WHERE batch_id=$1`, [batchId, JSON.stringify(body)]);
        } else {
            const inserted = await client.query(`INSERT INTO agri_batches
                (product_name, product_type, origin, note, farmer_id, producer_name, quantity, unit, production_date, expiry_date)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`, [body.product_name.trim(), body.product_type.trim(), origin,
                note, body.farmer_id ?? null, producerName, Number(body.quantity), body.unit.trim(), body.production_date || null, body.expiry_date || null]);
            batchId = inserted.rows[0].id;
            await client.query(`INSERT INTO cold_chain_batch_operations (batch_id, external_batch_code, source_payload)
                VALUES ($1,$2,$3::jsonb)`, [batchId, batchCode, JSON.stringify(body)]);
        }
        await client.query(`INSERT INTO agri_batch_events (external_event_id, external_batch_code, event_type, payload)
            VALUES ($1,$2,'PICKUP_REQUESTED',$3::jsonb)`, [eventId, batchCode, JSON.stringify(body)]);
        const result = await selectBatch(client, batchCode);
        await client.query("COMMIT");
        return res.status(existingOps.rowCount ? 200 : 201).json({ success: true, data: result.rows[0], duplicate: false });
    } catch (error) {
        await client.query("ROLLBACK");
        console.error("Agri pickup webhook error:", error);
        if (error.code === "23505") return sendError(res, 409, "Batch or event ID already exists");
        return sendError(res, 500, "Could not save pickup request");
    } finally { client.release(); }
}

async function updateInspectionDecision(req, res) {
    const body = req.body || {};
    const batchCode = req.params.batchCode;
    if (!validateDecisionPayload({ ...body, batch_code: batchCode })) return sendError(res, 400, "Invalid inspection decision payload");
    const decision = String(body.decision).toUpperCase();
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [body.event_id.trim()]);
        const existingEvent = await client.query("SELECT external_batch_code, event_type FROM agri_batch_events WHERE external_event_id=$1", [body.event_id.trim()]);
        if (existingEvent.rowCount) {
            if (existingEvent.rows[0].external_batch_code !== batchCode || existingEvent.rows[0].event_type !== `INSPECTION_${decision}`) {
                await client.query("ROLLBACK");
                return sendError(res, 409, "Event ID was already used for another operation or batch");
            }
            const current = await selectBatch(client, batchCode);
            await client.query("COMMIT");
            if (!current.rowCount) return sendError(res, 404, "Batch not found");
            return res.status(200).json({ success: true, data: current.rows[0], duplicate: true });
        }
        const current = await client.query(`SELECT o.inspection_decision, o.logistics_status FROM cold_chain_batch_operations o
            WHERE o.external_batch_code=$1 FOR UPDATE`, [batchCode]);
        if (!current.rowCount) { await client.query("ROLLBACK"); return sendError(res, 404, "Batch not found"); }
        if (current.rows[0].inspection_decision !== "PENDING") { await client.query("ROLLBACK"); return sendError(res, 409, "Inspection decision already recorded"); }
        if (current.rows[0].logistics_status !== "AT_INSPECTION") { await client.query("ROLLBACK"); return sendError(res, 409, "Inspection decision can only be recorded after the batch reaches inspection"); }
        await client.query(`INSERT INTO agri_batch_events (external_event_id, external_batch_code, event_type, payload)
            VALUES ($1,$2,$3,$4::jsonb)`, [body.event_id.trim(), batchCode, `INSPECTION_${decision}`, JSON.stringify(body)]);
        await client.query(`UPDATE cold_chain_batch_operations SET inspection_decision=$2, logistics_status=$3,
            decision_reason=$4, decided_at=COALESCE($5::timestamptz,CURRENT_TIMESTAMP),
            consumption_point_name=COALESCE($6,consumption_point_name), consumption_address=COALESCE($7,consumption_address),
            consumption_latitude=COALESCE($8,consumption_latitude), consumption_longitude=COALESCE($9,consumption_longitude),
            updated_at=CURRENT_TIMESTAMP WHERE external_batch_code=$1`, [batchCode, decision, INTEGRATION_TRANSITIONS[decision],
            body.reason || null, body.decided_at || null, body.consumption_point_name || null, body.consumption_address || null,
            body.consumption_latitude ?? null, body.consumption_longitude ?? null]);
        const updated = await selectBatch(client, batchCode);
        await client.query("COMMIT");
        return res.json({ success: true, data: updated.rows[0], duplicate: false });
    } catch (error) {
        await client.query("ROLLBACK");
        console.error("Agri decision webhook error:", error);
        if (error.code === "23505") return sendError(res, 409, "Event ID already exists");
        return sendError(res, 500, "Could not save inspection decision");
    } finally { client.release(); }
}

async function listBatches(req, res) {
    try {
        const params = [];
        const where = req.query.status && req.query.status !== "ALL" ? (params.push(req.query.status), `WHERE o.logistics_status=$${params.length}`) : "";
        const result = await pool.query(`SELECT ${BATCH_FIELDS} FROM ${BATCH_FROM} ${where} ORDER BY o.created_at DESC LIMIT 500`, params);
        return res.json({ success: true, data: result.rows });
    } catch (error) { console.error("Agri batch list error:", error); return sendError(res, 500, "Could not load agricultural batches"); }
}
async function getBatch(req, res) {
    try {
        const result = await pool.query(`SELECT ${BATCH_FIELDS} FROM ${BATCH_FROM} WHERE b.id=$1`, [req.params.id]);
        if (!result.rowCount) return sendError(res, 404, "Batch not found");
        return res.json({ success: true, data: result.rows[0] });
    } catch (error) { console.error("Agri batch detail error:", error); return sendError(res, 500, "Could not load agricultural batch"); }
}
async function transitionBatch(req, res) {
    const nextStatus = String((req.body || {}).logistics_status || "").toUpperCase();
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const current = await client.query(`SELECT b.id, o.* FROM agri_batches b JOIN cold_chain_batch_operations o ON o.batch_id=b.id
            WHERE b.id=$1 FOR UPDATE OF o`, [req.params.id]);
        if (!current.rowCount) { await client.query("ROLLBACK"); return sendError(res, 404, "Batch not found"); }
        const batch = current.rows[0];
        if (!(OPERATOR_TRANSITIONS[batch.logistics_status] || []).includes(nextStatus)) {
            await client.query("ROLLBACK"); return sendError(res, 409, `Transition ${batch.logistics_status} -> ${nextStatus} is not allowed`);
        }
        if (nextStatus === "PICKUP_ASSIGNED") {
            const vehicleId = Number(req.body.vehicle_id);
            const warehouseId = Number(req.body.warehouse_id);
            if (!Number.isSafeInteger(vehicleId) || vehicleId <= 0 || !Number.isSafeInteger(warehouseId) || warehouseId <= 0) {
                await client.query("ROLLBACK");
                return sendError(res, 400, "Choose an active vehicle and receiving warehouse");
            }
            const vehicle = await client.query("SELECT id FROM delivery_vehicle WHERE id=$1 AND status='ACTIVE' FOR UPDATE", [vehicleId]);
            if (!vehicle.rowCount) {
                await client.query("ROLLBACK");
                return sendError(res, 409, "Selected vehicle is not active");
            }
            const occupied = await client.query(`SELECT batch_id FROM cold_chain_batch_operations
                WHERE vehicle_id=$1 AND batch_id<>$2
                AND logistics_status IN ('PICKUP_ASSIGNED','PICKED_UP','OUT_FOR_DELIVERY','OUT_FOR_RETURN')
                LIMIT 1`, [vehicleId, batch.id]);
            if (occupied.rowCount) {
                await client.query("ROLLBACK");
                return sendError(res, 409, "Selected vehicle is already assigned to another active batch");
            }
            const warehouse = await client.query("SELECT id FROM warehouse WHERE id=$1 AND status='ACTIVE'", [warehouseId]);
            if (!warehouse.rowCount) {
                await client.query("ROLLBACK");
                return sendError(res, 409, "Selected receiving warehouse is not active");
            }
        }
        if (nextStatus === "OUT_FOR_DELIVERY" && batch.inspection_decision !== "APPROVED") {
            await client.query("ROLLBACK"); return sendError(res, 409, "Only approved batches can be sent to the consumption point");
        }
        if (nextStatus === "OUT_FOR_DELIVERY" && !batch.consumption_address) {
            await client.query("ROLLBACK"); return sendError(res, 409, "Agri-Audit has not provided the consumption address");
        }
        if (nextStatus === "OUT_FOR_RETURN" && batch.inspection_decision !== "REJECTED") {
            await client.query("ROLLBACK"); return sendError(res, 409, "Only rejected batches can be returned to the producer");
        }
        const eventId = `cold-chain:${batch.id}:${Date.now()}:${nextStatus}`;
        await client.query(`INSERT INTO agri_batch_events (external_event_id, external_batch_code, event_type, payload)
            VALUES ($1,$2,$3,$4::jsonb)`, [eventId, batch.external_batch_code, `LOGISTICS_${nextStatus}`, JSON.stringify({
            status: nextStatus, warehouse_id: req.body.warehouse_id ?? null, vehicle_id: req.body.vehicle_id ?? null,
            note: req.body.note || null, changed_by: req.user.id
        })]);
        await client.query(`UPDATE cold_chain_batch_operations SET logistics_status=$2,
            warehouse_id=COALESCE($3,warehouse_id), vehicle_id=COALESCE($4,vehicle_id),
            completed_at=CASE WHEN $5 IN ('DELIVERED','RETURNED') THEN CURRENT_TIMESTAMP ELSE completed_at END,
            updated_at=CURRENT_TIMESTAMP WHERE batch_id=$1`, [batch.id, nextStatus, req.body.warehouse_id ?? null, req.body.vehicle_id ?? null, nextStatus]);
        const updated = await client.query(`SELECT ${BATCH_FIELDS} FROM ${BATCH_FROM} WHERE b.id=$1`, [batch.id]);
        await client.query("COMMIT");
        return res.json({ success: true, data: updated.rows[0] });
    } catch (error) {
        await client.query("ROLLBACK"); console.error("Agri batch transition error:", error);
        return sendError(res, 500, "Could not update logistics status");
    } finally { client.release(); }
}

module.exports = { requireAgriSecret, createPickupRequest, updateInspectionDecision, listBatches, getBatch, transitionBatch };
