const pool = require("../db");

// GET /api/vehicles - Danh sách xe tải lạnh kèm thông tin kho và telemetry gần nhất
exports.getAllVehicles = async (req, res) => {
    try {
        const { status, warehouse_id, search } = req.query;

        let query = `
            SELECT 
                v.id,
                v.license_plate,
                v.warehouse_id,
                v.status,
                v.created_at,
                w.warehouse_name,
                d.id AS device_id,
                d.device_token,
                dt.temperature,
                dt.humidity,
                dt.created_at AS last_ping_time
            FROM delivery_vehicle v
            LEFT JOIN warehouse w ON v.warehouse_id = w.id
            LEFT JOIN device d ON d.vehicle_id = v.id
            LEFT JOIN (
                SELECT DISTINCT ON (device_id) device_id, temperature, humidity, created_at
                FROM data
                ORDER BY device_id, created_at DESC
            ) dt ON dt.device_id = d.id
            WHERE 1=1
        `;
        const params = [];

        if (status && status !== "ALL") {
            params.push(status);
            query += ` AND v.status = $${params.length}`;
        }

        if (warehouse_id) {
            params.push(warehouse_id);
            query += ` AND v.warehouse_id = $${params.length}`;
        }

        if (search) {
            params.push(`%${search}%`);
            query += ` AND v.license_plate ILIKE $${params.length}`;
        }

        query += ` ORDER BY v.id ASC`;

        const result = await pool.query(query, params);

        return res.json({
            success: true,
            data: result.rows,
            message: "Lấy danh sách xe tải lạnh thành công"
        });
    } catch (error) {
        console.error("Vehicle getAllVehicles error:", error);
        return res.status(500).json({
            success: false,
            data: null,
            message: "Lỗi máy chủ khi lấy danh sách xe tải"
        });
    }
};

// GET /api/vehicles/:id - Chi tiết xe tải và lịch sử telemetry gần nhất
exports.getVehicleById = async (req, res) => {
    try {
        const { id } = req.params;

        const vehicleRes = await pool.query(`
            SELECT 
                v.id,
                v.license_plate,
                v.warehouse_id,
                v.status,
                v.created_at,
                w.warehouse_name
            FROM delivery_vehicle v
            LEFT JOIN warehouse w ON v.warehouse_id = w.id
            WHERE v.id = $1
        `, [id]);

        if (vehicleRes.rows.length === 0) {
            return res.status(404).json({
                success: false,
                data: null,
                message: "Không tìm thấy xe tải lạnh"
            });
        }

        const vehicle = vehicleRes.rows[0];

        // Lấy tất cả thiết bị gán trên xe
        const deviceRes = await pool.query(`
            SELECT id, device_token, status, created_at
            FROM device
            WHERE vehicle_id = $1
            ORDER BY id ASC
        `, [id]);

        let telemetryHistory = [];
        let latestReading = null;

        if (deviceRes.rows.length > 0) {
            const historyRes = await pool.query(`
                SELECT dt.id, dt.device_id, d.device_token, dt.temperature, dt.humidity, dt.created_at
                FROM data dt
                JOIN device d ON dt.device_id = d.id
                WHERE d.vehicle_id = $1
                ORDER BY dt.created_at DESC
                LIMIT 50
            `, [id]);
            const rowsDesc = historyRes.rows;
            if (rowsDesc.length > 0) {
                latestReading = rowsDesc[0];
                // Sắp xếp tăng dần theo thời gian (cũ đến mới) cho biểu đồ chuỗi thời gian
                telemetryHistory = [...rowsDesc].reverse();
            }
        }

        return res.json({
            success: true,
            data: {
                ...vehicle,
                device: deviceRes.rows[0] || null,
                devices: deviceRes.rows,
                latestReading,
                telemetryHistory,
                recentPings: telemetryHistory.slice().reverse()
            },
            message: "Lấy chi tiết xe tải thành công"
        });
    } catch (error) {
        console.error("Vehicle getVehicleById error:", error);
        return res.status(500).json({
            success: false,
            data: null,
            message: "Lỗi máy chủ khi lấy chi tiết xe tải"
        });
    }
};

// POST /api/vehicles - Thêm xe tải lạnh mới
exports.createVehicle = async (req, res) => {
    try {
        const { license_plate, warehouse_id, status = "ACTIVE" } = req.body;

        if (!license_plate || !warehouse_id) {
            return res.status(400).json({
                success: false,
                data: null,
                message: "Vui lòng nhập biển số xe (license_plate) và chọn kho trực thuộc (warehouse_id)"
            });
        }

        // Kiểm tra trùng biển số xe
        const checkPlate = await pool.query("SELECT id FROM delivery_vehicle WHERE license_plate = $1", [license_plate]);
        if (checkPlate.rows.length > 0) {
            return res.status(400).json({
                success: false,
                data: null,
                message: "Biển số xe này đã tồn tại trong hệ thống"
            });
        }

        const maxIdRes = await pool.query("SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM delivery_vehicle");
        const nextId = maxIdRes.rows[0].next_id;

        const insertRes = await pool.query(`
            INSERT INTO delivery_vehicle (id, license_plate, warehouse_id, status, created_at)
            VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
            RETURNING *
        `, [nextId, license_plate, warehouse_id, status]);

        return res.status(201).json({
            success: true,
            data: insertRes.rows[0],
            message: "Tạo mới xe tải lạnh thành công"
        });
    } catch (error) {
        console.error("Vehicle createVehicle error:", error);
        return res.status(500).json({
            success: false,
            data: null,
            message: "Lỗi máy chủ khi tạo mới xe tải"
        });
    }
};

// PUT /api/vehicles/:id - Sửa thông tin xe tải
exports.updateVehicle = async (req, res) => {
    try {
        const { id } = req.params;
        const { license_plate, warehouse_id, status } = req.body;

        const checkRes = await pool.query("SELECT id FROM delivery_vehicle WHERE id = $1", [id]);
        if (checkRes.rows.length === 0) {
            return res.status(404).json({
                success: false,
                data: null,
                message: "Không tìm thấy xe tải cần sửa"
            });
        }

        const updateRes = await pool.query(`
            UPDATE delivery_vehicle 
            SET 
                license_plate = COALESCE($1, license_plate),
                warehouse_id = COALESCE($2, warehouse_id),
                status = COALESCE($3, status)
            WHERE id = $4
            RETURNING *
        `, [license_plate, warehouse_id, status, id]);

        return res.json({
            success: true,
            data: updateRes.rows[0],
            message: "Cập nhật xe tải thành công"
        });
    } catch (error) {
        console.error("Vehicle updateVehicle error:", error);
        return res.status(500).json({
            success: false,
            data: null,
            message: "Lỗi máy chủ khi cập nhật xe tải"
        });
    }
};

// DELETE /api/vehicles/:id - Xóa xe tải
exports.deleteVehicle = async (req, res) => {
    try {
        const { id } = req.params;

        // Bỏ liên kết thiết bị nếu có
        await pool.query("UPDATE device SET vehicle_id = NULL WHERE vehicle_id = $1", [id]);

        const deleteRes = await pool.query("DELETE FROM delivery_vehicle WHERE id = $1 RETURNING *", [id]);

        if (deleteRes.rows.length === 0) {
            return res.status(404).json({
                success: false,
                data: null,
                message: "Không tìm thấy xe tải cần xóa"
            });
        }

        return res.json({
            success: true,
            data: deleteRes.rows[0],
            message: "Xóa xe tải thành công"
        });
    } catch (error) {
        console.error("Vehicle deleteVehicle error:", error);
        return res.status(500).json({
            success: false,
            data: null,
            message: "Lỗi máy chủ khi xóa xe tải"
        });
    }
};
