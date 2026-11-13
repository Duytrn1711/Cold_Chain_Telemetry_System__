const pool = require("../db");

const BATCH_FIELDS = `
    id, external_batch_code, product_name, product_type, producer_name,
    producer_phone, producer_email, pickup_address, pickup_latitude,
    pickup_longitude, consumption_point_name, consumption_address,
    consumption_latitude, consumption_longitude, quantity, unit,
    production_date, expiry_date, inspection_decision, decision_reason,
    logistics_status, warehouse_id, vehicle_id, source_payload,
    created_at, updated_at, decided_at, completed_at
`;

const INTEGRATION_TRANSITIONS = {
    PENDING: "AT_INSPECTION",
    APPROVED: "DELIVERY_READY",
    REJECTED: "RETURN_READY"
};

const OPERATOR_TRANSITIONS = {
    PICKUP_REQUESTED: ["PICKUP_ASSIGNED", "CANCELLED"],
    PICKUP_ASSIGNED: ["PICKED_UP", "CANCELLED"],
    PICKED_UP: ["AT_INSPECTION"],
    AT_INSPECTION: [],
    DELIVERY_READY: ["OUT_FOR_DELIVERY"],
    RETURN_READY: ["OUT_FOR_RETURN"],
    OUT_FOR_DELIVERY: ["DELIVERED"],
    OUT_FOR_RETURN: ["RETURNED"],
    DELIVERED: [],
    RETURNED: [],
    CANCELLED: []
};

function sendError(res, status, message) {
    return res.status(status).json({ success: false, data: null, message });
}

function requireAgriSecret(req, res, next) {
    const configuredSecret = process.env.AGRI_WEBHOOK_SECRET;
    const suppliedSecret = req.get("x-agri-webhook-secret");
    if (!configuredSecret) return sendError(res, 503, "Agri integration is not configured");
    if (!suppliedSecret || suppliedSecret !== configuredSecret) return sendError(res, 401, "Invalid integration credentials");
    next();
}

function validString(value, max = 500) {
    return typeof value === "string" && value.trim().length > 0 && value.trim().length <= max;
}

function validCoordinate(value, min, max) {
    return value === undefined || value === null || (Number.isFinite(Number(value)) && Number(value) >= min && Number(value) <= max);
}

function validCommonPayload(body) {
    return body && validString(body.event_id, 160) && validString(body.batch_code, 120);
}

function validatePickupPayload(body) {
    const qty = Number(body.quantity);
    return validCommonPayload(body) && validString(body.product_name, 255) &&
        validString(body.producer_name, 255) && validString(body.pickup_address, 2000) &&
        validString(body.unit, 30) && Number.isFinite(qty) && qty > 0 &&
        validCoordinate(body.pickup_latitude, -90, 90) && validCoordinate(body.pickup_longitude, -180, 180) &&
        validCoordinate(body.consumption_latitude, -90, 90) && validCoordinate(body.consumption_longitude, -180, 180);
}

function validateDecisionPayload(body) {
    const decision = String(body.decision || "").toUpperCase();
    return validCommonPayload(body) && ["APPROVED", "REJECTED"].includes(decision) &&
        (decision !== "REJECTED" || validString(body.reason, 4000)) &&
        (decision !== "APPROVED" || validString(body.consumption_address, 2000));
}

async function createPickupRequest(req, res) {
    const body = req.body || {};
    if (!validatePickupPayload(body)) return sendError(res, 400, "Invalid pickup request payload");

    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [body.event_id.trim()]);
        const seenEvent = await client.query("SELECT external_batch_code, event_type FROM agri_batch_events WHERE external_event_id = $1", [body.event_id.trim()]);
        if (seenEvent.rowCount) {
            if (seenEvent.rows[0].external_batch_code !== body.batch_code.trim() || seenEvent.rows[0].event_type !== "PICKUP_REQUESTED") {
                await client.query("ROLLBACK");
                return sendError(res, 409, "Event ID was already used for another operation or batch");
            }
            const existing = await client.query(`SELECT ${BATCH_FIELDS} FROM agri_batches WHERE external_batch_code = $1`, [body.batch_code.trim()]);
            await client.query("COMMIT");
            if (!existing.rowCount) return sendError(res, 409, "Event ID was already used for another operation or batch");
            return res.status(200).json({ success: true, data: existing.rows[0], duplicate: true });
        }

        const inserted = await client.query(`
            INSERT INTO agri_batches (
                external_batch_code, product_name, product_type, producer_name,
                producer_phone, producer_email, pickup_address, pickup_latitude,
                pickup_longitude, consumption_point_name, consumption_address,
                consumption_latitude, consumption_longitude, quantity, unit,
                production_date, expiry_date, source_payload
            ) VALUES (
                $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18::jsonb
            )
            ON CONFLICT (external_batch_code) DO UPDATE SET
                product_name = EXCLUDED.product_name,
                product_type = EXCLUDED.product_type,
                producer_name = EXCLUDED.producer_name,
                producer_phone = EXCLUDED.producer_phone,
                producer_email = EXCLUDED.producer_email,
                pickup_address = EXCLUDED.pickup_address,
                pickup_latitude = EXCLUDED.pickup_latitude,
                pickup_longitude = EXCLUDED.pickup_longitude,
                consumption_point_name = EXCLUDED.consumption_point_name,
                consumption_address = EXCLUDED.consumption_address,
                consumption_latitude = EXCLUDED.consumption_latitude,
                consumption_longitude = EXCLUDED.consumption_longitude,
                quantity = EXCLUDED.quantity,
                unit = EXCLUDED.unit,
                production_date = EXCLUDED.production_date,
                expiry_date = EXCLUDED.expiry_date,
                source_payload = EXCLUDED.source_payload,
                updated_at = CURRENT_TIMESTAMP
            WHERE agri_batches.logistics_status = 'PICKUP_REQUESTED'
              AND agri_batches.inspection_decision = 'PENDING'
            RETURNING ${BATCH_FIELDS}
        `, [
            body.batch_code.trim(), body.product_name.trim(), body.product_type || null,
            body.producer_name.trim(), body.producer_phone || null, body.producer_email || null,
            body.pickup_address.trim(), body.pickup_latitude ?? null, body.pickup_longitude ?? null,
            body.consumption_point_name || null, body.consumption_address || null,
            body.consumption_latitude ?? null, body.consumption_longitude ?? null,
            Number(body.quantity), body.unit.trim(), body.production_date || null,
            body.expiry_date || null, JSON.stringify(body)
        ]);
        if (!inserted.rowCount) {
            await client.query("ROLLBACK");
            return sendError(res, 409, "Batch already entered the logistics workflow");
        }
        await client.query(`
            INSERT INTO agri_batch_events (external_event_id, external_batch_code, event_type, payload)
            VALUES ($1, $2, 'PICKUP_REQUESTED', $3::jsonb)
        `, [body.event_id.trim(), body.batch_code.trim(), JSON.stringify(body)]);
        await client.query("COMMIT");
        return res.status(201).json({ success: true, data: inserted.rows[0], duplicate: false });
    } catch (error) {
        await client.query("ROLLBACK");
        console.error("Agri pickup webhook error:", error);
        if (error.code === "23505") return sendError(res, 409, "Batch or event ID already exists");
        return sendError(res, 500, "Could not save pickup request");
    } finally {
        client.release();
    }
}

async function updateInspectionDecision(req, res) {
    const body = req.body || {};
    const batchCode = req.params.batchCode;
    if (!validateDecisionPayload({ ...body, batch_code: batchCode })) return sendError(res, 400, "Invalid inspection decision payload");
    const decision = String(body.decision).toUpperCase();
    const nextStatus = INTEGRATION_TRANSITIONS[decision];
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [body.event_id.trim()]);
        const existingEvent = await client.query("SELECT external_batch_code, event_type FROM agri_batch_events WHERE external_event_id = $1", [body.event_id.trim()]);
        if (existingEvent.rowCount) {
            if (existingEvent.rows[0].external_batch_code !== batchCode || existingEvent.rows[0].event_type !== `INSPECTION_${decision}`) {
                await client.query("ROLLBACK");
                return sendError(res, 409, "Event ID was already used for another operation or batch");
            }
            const current = await client.query(`SELECT ${BATCH_FIELDS} FROM agri_batches WHERE external_batch_code = $1`, [batchCode]);
            await client.query("COMMIT");
            if (!current.rowCount) return sendError(res, 404, "Batch not found");
            return res.status(200).json({ success: true, data: current.rows[0], duplicate: true });
        }

        const current = await client.query("SELECT inspection_decision, logistics_status FROM agri_batches WHERE external_batch_code = $1 FOR UPDATE", [batchCode]);
        if (!current.rowCount) {
            await client.query("ROLLBACK");
            return sendError(res, 404, "Batch not found");
        }
        if (current.rows[0].inspection_decision !== "PENDING") {
            await client.query("ROLLBACK");
            return sendError(res, 409, "Inspection decision already recorded");
        }
        if (current.rows[0].logistics_status !== "AT_INSPECTION") {
            await client.query("ROLLBACK");
            return sendError(res, 409, "Inspection decision can only be recorded after the batch reaches inspection");
        }

        await client.query(`
            INSERT INTO agri_batch_events (external_event_id, external_batch_code, event_type, payload)
            VALUES ($1, $2, $3, $4::jsonb)
        `, [body.event_id.trim(), batchCode, `INSPECTION_${decision}`, JSON.stringify(body)]);
        const updated = await client.query(`
            UPDATE agri_batches SET inspection_decision = $2, logistics_status = $3,
                decision_reason = $4, decided_at = COALESCE($5::timestamptz, CURRENT_TIMESTAMP),
                consumption_point_name = COALESCE($6, consumption_point_name),
                consumption_address = COALESCE($7, consumption_address),
                consumption_latitude = COALESCE($8, consumption_latitude),
                consumption_longitude = COALESCE($9, consumption_longitude),
                updated_at = CURRENT_TIMESTAMP
            WHERE external_batch_code = $1
            RETURNING ${BATCH_FIELDS}
        `, [batchCode, decision, nextStatus, body.reason || null, body.decided_at || null,
            body.consumption_point_name || null, body.consumption_address || null,
            body.consumption_latitude ?? null, body.consumption_longitude ?? null]);
        await client.query("COMMIT");
        return res.json({ success: true, data: updated.rows[0], duplicate: false });
    } catch (error) {
        await client.query("ROLLBACK");
        console.error("Agri decision webhook error:", error);
        if (error.code === "23505") return sendError(res, 409, "Event ID already exists");
        return sendError(res, 500, "Could not save inspection decision");
    } finally {
        client.release();
    }
}

async function listBatches(req, res) {
    try {
        const params = [];
        let where = "";
        if (req.query.status && req.query.status !== "ALL") {
            params.push(req.query.status);
            where = `WHERE logistics_status = $${params.length}`;
        }
        const result = await pool.query(`SELECT ${BATCH_FIELDS} FROM agri_batches ${where} ORDER BY created_at DESC LIMIT 500`, params);
        return res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error("Agri batch list error:", error);
        return sendError(res, 500, "Could not load agricultural batches");
    }
}

async function getBatch(req, res) {
    try {
        const result = await pool.query(`SELECT ${BATCH_FIELDS} FROM agri_batches WHERE id = $1`, [req.params.id]);
        if (!result.rowCount) return sendError(res, 404, "Batch not found");
        return res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error("Agri batch detail error:", error);
        return sendError(res, 500, "Could not load agricultural batch");
    }
}

async function transitionBatch(req, res) {
    const nextStatus = String((req.body || {}).logistics_status || "").toUpperCase();
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const current = await client.query("SELECT * FROM agri_batches WHERE id = $1 FOR UPDATE", [req.params.id]);
        if (!current.rowCount) {
            await client.query("ROLLBACK");
            return sendError(res, 404, "Batch not found");
        }
        const batch = current.rows[0];
        if (!(OPERATOR_TRANSITIONS[batch.logistics_status] || []).includes(nextStatus)) {
            await client.query("ROLLBACK");
            return sendError(res, 409, `Transition ${batch.logistics_status} -> ${nextStatus} is not allowed`);
        }
        if (nextStatus === "OUT_FOR_DELIVERY" && batch.inspection_decision !== "APPROVED") {
            await client.query("ROLLBACK");
            return sendError(res, 409, "Only approved batches can be sent to the consumption point");
        }
        if (nextStatus === "OUT_FOR_RETURN" && batch.inspection_decision !== "REJECTED") {
            await client.query("ROLLBACK");
            return sendError(res, 409, "Only rejected batches can be returned to the producer");
        }

        const eventId = `cold-chain:${batch.id}:${Date.now()}:${nextStatus}`;
        await client.query(`
            INSERT INTO agri_batch_events (external_event_id, external_batch_code, event_type, payload)
            VALUES ($1, $2, $3, $4::jsonb)
        `, [eventId, batch.external_batch_code, `LOGISTICS_${nextStatus}`, JSON.stringify({
            status: nextStatus,
            warehouse_id: req.body.warehouse_id ?? null,
            vehicle_id: req.body.vehicle_id ?? null,
            note: req.body.note || null,
            changed_by: req.user.id
        })]);
        const updated = await client.query(`
            UPDATE agri_batches SET logistics_status = $2,
                warehouse_id = COALESCE($3, warehouse_id), vehicle_id = COALESCE($4, vehicle_id),
                completed_at = CASE WHEN $2 IN ('DELIVERED', 'RETURNED') THEN CURRENT_TIMESTAMP ELSE completed_at END,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $1 RETURNING ${BATCH_FIELDS}
        `, [batch.id, nextStatus, req.body.warehouse_id ?? null, req.body.vehicle_id ?? null]);
        await client.query("COMMIT");
        return res.json({ success: true, data: updated.rows[0] });
    } catch (error) {
        await client.query("ROLLBACK");
        console.error("Agri batch transition error:", error);
        return sendError(res, 500, "Could not update logistics status");
    } finally {
        client.release();
    }
}

module.exports = { requireAgriSecret, createPickupRequest, updateInspectionDecision, listBatches, getBatch, transitionBatch };
