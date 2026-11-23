const pool = require("../db");
const LIVE_DEVICE_WINDOW_MS = 90 * 1000;

function addLiveConnectionState(rows) {
    const now = Date.now();
    return rows.map((device) => {
        const lastReadingTime = device.last_reading_time ? new Date(device.last_reading_time).getTime() : NaN;
        const hasRecentReading = Number.isFinite(lastReadingTime) && now - lastReadingTime >= 0 && now - lastReadingTime <= LIVE_DEVICE_WINDOW_MS;
        const isOnline = device.status === "ACTIVE" && hasRecentReading;
        return {
            ...device,
            is_online: isOnline,
            data_source: device.is_simulated ? "SIMULATED" : (isOnline ? "LIVE" : "NONE"),
            connection_status: isOnline ? "ONLINE" : "OFFLINE"
        };
    });
}
exports.addLiveConnectionState = addLiveConnectionState;

// GET /api/devices - Lấy danh sách thiết bị cảm biến IoT
exports.getAllDevices = async (req, res) => {
    try {
        const { status, warehouse_id, vehicle_id, search } = req.query;

        let query = `
            SELECT 
                d.id,
                d.device_token,
                d.warehouse_id,
                d.vehicle_id,
                d.status,
                d.created_at,
                w.warehouse_name,
                v.license_plate,
                latest.temperature,
                latest.humidity,
                latest.created_at AS last_reading_time,
                latest.is_simulated
            FROM device d
            LEFT JOIN warehouse w ON d.warehouse_id = w.id
            LEFT JOIN delivery_vehicle v ON d.vehicle_id = v.id
            LEFT JOIN LATERAL (
                SELECT temperature, humidity, created_at, is_simulated
                FROM (
                    SELECT temperature, humidity, created_at, FALSE AS is_simulated FROM data WHERE device_id=d.id
                    UNION ALL
                    SELECT temperature, humidity, created_at, TRUE AS is_simulated FROM telemetry_simulation WHERE device_id=d.id
                ) readings
                ORDER BY created_at DESC LIMIT 1
            ) latest ON TRUE
            WHERE 1=1
        `;
        const params = [];

        if (status && status !== "ALL") {
            params.push(status);
            query += ` AND d.status = $${params.length}`;
        }

        if (warehouse_id) {
            params.push(warehouse_id);
            query += ` AND d.warehouse_id = $${params.length}`;
        }

        if (vehicle_id) {
            params.push(vehicle_id);
            query += ` AND d.vehicle_id = $${params.length}`;
        }

        if (search) {
            params.push(`%${search}%`);
            query += ` AND (d.device_token ILIKE $${params.length} OR w.warehouse_name ILIKE $${params.length} OR v.license_plate ILIKE $${params.length})`;
        }

        query += ` ORDER BY d.id ASC`;

        const result = await pool.query(query, params);

        return res.json({
            success: true,
            data: addLiveConnectionState(result.rows),
            message: "Lấy danh sách thiết bị IoT thành công"
        });
    } catch (error) {
        console.error("Device getAllDevices error:", error);
        return res.status(500).json({
            success: false,
            data: null,
            message: "Lỗi máy chủ khi lấy danh sách thiết bị"
        });
    }
};

// GET /api/devices/:id - Lấy chi tiết thiết bị kèm telemetry history
exports.getDeviceById = async (req, res) => {
    try {
        const { id } = req.params;

        const deviceRes = await pool.query(`
            SELECT 
                d.id,
                d.device_token,
                d.warehouse_id,
                d.vehicle_id,
                d.status,
                d.created_at,
                w.warehouse_name,
                v.license_plate
            FROM device d
            LEFT JOIN warehouse w ON d.warehouse_id = w.id
            LEFT JOIN delivery_vehicle v ON d.vehicle_id = v.id
            WHERE d.id = $1
        `, [id]);

        if (deviceRes.rows.length === 0) {
            return res.status(404).json({
                success: false,
                data: null,
                message: "Không tìm thấy thiết bị IoT"
            });
        }

        const device = deviceRes.rows[0];

        // Chọn 30 bản ghi mới nhất, rồi sắp xếp tăng dần để biểu đồ chạy trái sang phải.
        const historyRes = await pool.query(`
            SELECT id, temperature, humidity, created_at, is_simulated
            FROM (
                SELECT id::text AS id, temperature, humidity, created_at, FALSE AS is_simulated
                FROM data
                WHERE device_id = $1
                UNION ALL
                SELECT ('SIM-' || device_id::text || '-' || floor(extract(epoch FROM created_at) * 1000)::bigint::text) AS id,
                    temperature, humidity, created_at, TRUE AS is_simulated
                FROM telemetry_simulation
                WHERE device_id = $1
            ) all_readings
            ORDER BY created_at DESC, id DESC
            LIMIT 30
        `, [id]);

        historyRes.rows.reverse();
        const lastReading = historyRes.rows.length > 0 ? historyRes.rows[historyRes.rows.length - 1] : null;
        const [deviceWithLiveState] = addLiveConnectionState([{
            ...device,
            last_reading_time: lastReading?.created_at || null,
            is_simulated: lastReading?.is_simulated === true
        }]);
        return res.json({
            success: true,
            data: {
                ...deviceWithLiveState,
                history: historyRes.rows,
                latestReading: lastReading
            },
            message: "Lấy thông tin thiết bị thành công"
        });
    } catch (error) {
        console.error("Device getDeviceById error:", error);
        return res.status(500).json({
            success: false,
            data: null,
            message: "Lỗi máy chủ khi lấy chi tiết thiết bị"
        });
    }
};

// POST /api/devices - Đăng ký thiết bị cảm biến IoT mới
exports.createDevice = async (req, res) => {
    try {
        const { device_token, warehouse_id, vehicle_id, status = "ACTIVE" } = req.body;

        if (!device_token) {
            return res.status(400).json({
                success: false,
                data: null,
                message: "Mã thiết bị (device_token) không được để trống"
            });
        }

        // Kiểm tra trùng token
        const checkToken = await pool.query("SELECT id FROM device WHERE device_token = $1", [device_token]);
        if (checkToken.rows.length > 0) {
            return res.status(400).json({
                success: false,
                data: null,
                message: "Mã thiết bị (device_token) này đã tồn tại"
            });
        }

        const maxIdRes = await pool.query("SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM device");
        const nextId = maxIdRes.rows[0].next_id;

        const insertRes = await pool.query(`
            INSERT INTO device (id, device_token, warehouse_id, vehicle_id, status, created_at)
            VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
            RETURNING *
        `, [nextId, device_token, warehouse_id || null, vehicle_id || null, status]);

        return res.status(201).json({
            success: true,
            data: insertRes.rows[0],
            message: "Đăng ký thiết bị cảm biến thành công"
        });
    } catch (error) {
        console.error("Device createDevice error:", error);
        return res.status(500).json({
            success: false,
            data: null,
            message: "Lỗi máy chủ khi tạo mới thiết bị"
        });
    }
};

// PUT /api/devices/:id - Cập nhật thiết bị cảm biến
exports.updateDevice = async (req, res) => {
    try {
        const { id } = req.params;
        const { device_token, warehouse_id, vehicle_id, status } = req.body;

        const checkRes = await pool.query("SELECT id FROM device WHERE id = $1", [id]);
        if (checkRes.rows.length === 0) {
            return res.status(404).json({
                success: false,
                data: null,
                message: "Không tìm thấy thiết bị cần sửa"
            });
        }

        const updateRes = await pool.query(`
            UPDATE device 
            SET 
                device_token = COALESCE($1, device_token),
                warehouse_id = $2,
                vehicle_id = $3,
                status = COALESCE($4, status)
            WHERE id = $5
            RETURNING *
        `, [device_token, warehouse_id || null, vehicle_id || null, status, id]);

        return res.json({
            success: true,
            data: updateRes.rows[0],
            message: "Cập nhật thiết bị thành công"
        });
    } catch (error) {
        console.error("Device updateDevice error:", error);
        return res.status(500).json({
            success: false,
            data: null,
            message: "Lỗi máy chủ khi cập nhật thiết bị"
        });
    }
};

// DELETE /api/devices/:id - Xóa thiết bị
exports.deleteDevice = async (req, res) => {
    try {
        const { id } = req.params;

        // Xóa alert và data của device trước để tránh ràng buộc khóa ngoại
        await pool.query("DELETE FROM alert WHERE device_id = $1", [id]);
        await pool.query("DELETE FROM data WHERE device_id = $1", [id]);

        const deleteRes = await pool.query("DELETE FROM device WHERE id = $1 RETURNING *", [id]);

        if (deleteRes.rows.length === 0) {
            return res.status(404).json({
                success: false,
                data: null,
                message: "Không tìm thấy thiết bị cần xóa"
            });
        }

        return res.json({
            success: true,
            data: deleteRes.rows[0],
            message: "Xóa thiết bị thành công"
        });
    } catch (error) {
        console.error("Device deleteDevice error:", error);
        return res.status(500).json({
            success: false,
            data: null,
            message: "Lỗi máy chủ khi xóa thiết bị"
        });
    }
};
