const pool = require("../db");

// GET /api/alerts/summary - alerts awaiting acknowledgement for the navigation badge.
exports.getAlertSummary = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT COUNT(*) FILTER (WHERE status = 'OPEN')::INT AS active_count
            FROM alert
        `);
        return res.json({ success: true, data: { active_count: result.rows[0].active_count } });
    } catch (error) {
        console.error("Alert summary error:", error.code || "unknown");
        return res.status(500).json({ success: false, data: null, message: "Không thể tải tổng số cảnh báo" });
    }
};

// GET /api/alerts - Lấy danh sách sự cố và cảnh báo
exports.getAllAlerts = async (req, res) => {
    try {
        const { device_id, limit = 50 } = req.query;

        let query = `
            SELECT 
                a.id,
                a.device_id,
                a.alert_type,
                a.alert_content,
                a.status,
                a.acknowledged_by,
                a.acknowledged_at,
                a.resolved_at,
                a.created_at,
                dev.device_token,
                dev.warehouse_id,
                dev.vehicle_id,
                w.warehouse_name,
                v.license_plate
            FROM alert a
            JOIN device dev ON a.device_id = dev.id
            LEFT JOIN warehouse w ON dev.warehouse_id = w.id
            LEFT JOIN delivery_vehicle v ON dev.vehicle_id = v.id
            WHERE 1=1
        `;
        const params = [];

        if (device_id) {
            params.push(device_id);
            query += ` AND a.device_id = $${params.length}`;
        }

        query += ` ORDER BY a.created_at DESC LIMIT $${params.length + 1}`;
        params.push(parseInt(limit, 10));

        const result = await pool.query(query, params);

        const rows = result.rows.map(row => {
            let tempVal = null;
            const m = (row.alert_content || "").match(/(?:ghi nhận|nhiệt độ|reading|reported|temperature)\s*[:#]?\s*(-?\d+(?:\.\d+)?)\s*°?C/i) || 
                      (row.alert_content || "").match(/(-?\d+(?:\.\d+)?)\s*°?C/i);
            if (m) {
                tempVal = parseFloat(m[1]);
            }
            return {
                ...row,
                temperature: tempVal
            };
        });

        return res.json({
            success: true,
            data: rows,
            message: "Lấy danh sách cảnh báo thành công"
        });
    } catch (error) {
        console.error("Alert getAllAlerts error:", error);
        return res.status(500).json({
            success: false,
            data: null,
            message: "Lỗi máy chủ khi lấy danh sách cảnh báo"
        });
    }
};

// GET /api/alerts/:id - Lấy chi tiết một cảnh báo
exports.getAlertById = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(`
            SELECT 
                a.id,
                a.device_id,
                a.alert_type,
                a.alert_content,
                a.status,
                a.acknowledged_by,
                a.acknowledged_at,
                a.resolved_at,
                a.created_at,
                dev.device_token,
                dev.warehouse_id,
                dev.vehicle_id,
                w.warehouse_name,
                v.license_plate
            FROM alert a
            JOIN device dev ON a.device_id = dev.id
            LEFT JOIN warehouse w ON dev.warehouse_id = w.id
            LEFT JOIN delivery_vehicle v ON dev.vehicle_id = v.id
            WHERE a.id = $1
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                data: null,
                message: "Không tìm thấy cảnh báo"
            });
        }

        const alert = result.rows[0];
        let tempVal = null;
        const m = (alert.alert_content || "").match(/(?:ghi nhận|nhiệt độ|reading|reported|temperature)\s*[:#]?\s*(-?\d+(?:\.\d+)?)\s*°?C/i) || 
                  (alert.alert_content || "").match(/(-?\d+(?:\.\d+)?)\s*°?C/i);
        if (m) {
            tempVal = parseFloat(m[1]);
        }

        return res.json({
            success: true,
            data: {
                ...alert,
                temperature: tempVal
            },
            message: "Lấy chi tiết cảnh báo thành công"
        });
    } catch (error) {
        console.error("Alert getAlertById error:", error);
        return res.status(500).json({
            success: false,
            data: null,
            message: "Lỗi máy chủ khi lấy chi tiết cảnh báo"
        });
    }
};

exports.updateAlertStatus = async (req, res) => {
    const { id } = req.params;
    const nextStatus = String((req.body || {}).status || "").toUpperCase();
    if (!/^\d{1,19}$/.test(String(id)) || !["RESOLVED", "ACKNOWLEDGED"].includes(nextStatus)) {
        return res.status(400).json({ success: false, data: null, message: "Mã cảnh báo hoặc trạng thái không hợp lệ" });
    }
    try {
        const result = await pool.query(`
            UPDATE alert
            SET status = $2::VARCHAR,
                acknowledged_by = COALESCE(acknowledged_by, $3::BIGINT),
                acknowledged_at = COALESCE(acknowledged_at, CURRENT_TIMESTAMP),
                resolved_at = CASE WHEN $2::VARCHAR = 'RESOLVED'::VARCHAR THEN CURRENT_TIMESTAMP ELSE resolved_at END
            WHERE id = $1::BIGINT AND status <> 'RESOLVED'::VARCHAR
            RETURNING id, status, acknowledged_by, acknowledged_at, resolved_at
        `, [id, nextStatus, req.user.id]);
        if (!result.rowCount) {
            const current = await pool.query("SELECT id, status, acknowledged_by, acknowledged_at, resolved_at FROM alert WHERE id = $1::BIGINT", [id]);
            if (!current.rowCount) return res.status(404).json({ success: false, data: null, message: "Không tìm thấy cảnh báo" });
            return res.json({ success: true, data: current.rows[0], message: "Cảnh báo đã được xử lý" });
        }
        return res.json({ success: true, data: result.rows[0], message: "Cập nhật trạng thái cảnh báo thành công" });
    } catch (error) {
        console.error("Alert status update error:", error.code || "unknown");
        return res.status(500).json({ success: false, data: null, message: "Không thể cập nhật trạng thái cảnh báo" });
    }
};

exports.acknowledgeAllAlerts = async (req, res) => {
    try {
        const result = await pool.query(`
            UPDATE alert
            SET status = 'ACKNOWLEDGED'::VARCHAR,
                acknowledged_by = COALESCE(acknowledged_by, $1::BIGINT),
                acknowledged_at = COALESCE(acknowledged_at, CURRENT_TIMESTAMP)
            WHERE status = 'OPEN'::VARCHAR
            RETURNING id
        `, [req.user.id]);
        return res.json({
            success: true,
            data: { acknowledged_count: result.rowCount },
            message: `Đã xác nhận ${result.rowCount} cảnh báo đang mở`
        });
    } catch (error) {
        console.error("Acknowledge all alerts error:", error.code || "unknown");
        return res.status(500).json({ success: false, data: null, message: "Không thể xác nhận các cảnh báo" });
    }
};

// POST /api/alerts - Tạo mới cảnh báo
exports.createAlert = async (req, res) => {
    try {
        const { device_id, alert_type, alert_content } = req.body;

        if (!device_id || !alert_type || !alert_content) {
            return res.status(400).json({
                success: false,
                data: null,
                message: "Vui lòng nhập đầy đủ device_id, alert_type và alert_content"
            });
        }

        const maxIdRes = await pool.query("SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM alert");
        const nextId = maxIdRes.rows[0].next_id;

        const insertRes = await pool.query(`
            INSERT INTO alert (id, device_id, alert_type, alert_content, created_at)
            VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
            RETURNING *
        `, [nextId, device_id, alert_type, alert_content]);

        return res.status(201).json({
            success: true,
            data: insertRes.rows[0],
            message: "Tạo cảnh báo thành công"
        });
    } catch (error) {
        console.error("Alert createAlert error:", error);
        return res.status(500).json({
            success: false,
            data: null,
            message: "Lỗi máy chủ khi tạo cảnh báo"
        });
    }
};

// DELETE /api/alerts/:id - Xóa / Đã xử lý cảnh báo
exports.deleteAlert = async (req, res) => {
    try {
        const { id } = req.params;

        const deleteRes = await pool.query("DELETE FROM alert WHERE id = $1 RETURNING *", [id]);

        if (deleteRes.rows.length === 0) {
            return res.status(404).json({
                success: false,
                data: null,
                message: "Không tìm thấy cảnh báo cần xử lý"
            });
        }

        return res.json({
            success: true,
            data: deleteRes.rows[0],
            message: "Cảnh báo đã được giải quyết / xóa thành công"
        });
    } catch (error) {
        console.error("Alert deleteAlert error:", error);
        return res.status(500).json({
            success: false,
            data: null,
            message: "Lỗi máy chủ khi xóa cảnh báo"
        });
    }
};
