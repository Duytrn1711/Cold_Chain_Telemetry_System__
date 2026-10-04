const pool = require("../db");

// GET /api/warehouses - Lấy danh sách kho lạnh
exports.getAllWarehouses = async (req, res) => {
    try {
        const { status, search } = req.query;

        let query = `
            SELECT 
                w.id,
                w.warehouse_name,
                w.longitude,
                w.latitude,
                w.status,
                w.created_at,
                COUNT(DISTINCT v.id) AS vehicle_count,
                COUNT(DISTINCT d.id) AS device_count,
                COALESCE(ROUND(AVG(dt.temperature), 1), 3.8) AS avg_temp
            FROM warehouse w
            LEFT JOIN delivery_vehicle v ON v.warehouse_id = w.id
            LEFT JOIN device d ON d.warehouse_id = w.id
            LEFT JOIN (
                SELECT DISTINCT ON (device_id) device_id, temperature 
                FROM data 
                ORDER BY device_id, created_at DESC
            ) dt ON dt.device_id = d.id
            WHERE 1=1
        `;
        const params = [];

        if (status && status !== "ALL") {
            params.push(status);
            query += ` AND w.status = $${params.length}`;
        }

        if (search) {
            params.push(`%${search}%`);
            query += ` AND w.warehouse_name ILIKE $${params.length}`;
        }

        query += ` GROUP BY w.id, w.warehouse_name, w.longitude, w.latitude, w.status, w.created_at ORDER BY w.id ASC`;

        const result = await pool.query(query, params);

        return res.json({
            success: true,
            data: result.rows,
            message: "Lấy danh sách kho lạnh thành công"
        });
    } catch (error) {
        console.error("Warehouse getAllWarehouses error:", error);
        return res.status(500).json({
            success: false,
            data: null,
            message: "Lỗi máy chủ khi lấy danh sách kho lạnh"
        });
    }
};

// GET /api/warehouses/:id - Lấy chi tiết kho lạnh kèm thiết bị & xe
exports.getWarehouseById = async (req, res) => {
    try {
        const { id } = req.params;

        const warehouseRes = await pool.query(`
            SELECT id, warehouse_name, longitude, latitude, status, created_at
            FROM warehouse 
            WHERE id = $1
        `, [id]);

        if (warehouseRes.rows.length === 0) {
            return res.status(404).json({
                success: false,
                data: null,
                message: "Không tìm thấy kho lạnh"
            });
        }

        const warehouse = warehouseRes.rows[0];

        // Lấy danh sách xe trực thuộc kho
        const vehiclesRes = await pool.query(`
            SELECT id, license_plate, status, created_at
            FROM delivery_vehicle
            WHERE warehouse_id = $1
            ORDER BY id ASC
        `, [id]);

        // Lấy danh sách thiết bị gắn tại kho
        const devicesRes = await pool.query(`
            SELECT 
                d.id,
                d.device_token,
                d.status,
                d.created_at,
                dt.temperature,
                dt.humidity
            FROM device d
            LEFT JOIN (
                SELECT DISTINCT ON (device_id) device_id, temperature, humidity
                FROM data
                ORDER BY device_id, created_at DESC
            ) dt ON dt.device_id = d.id
            WHERE d.warehouse_id = $1
            ORDER BY d.id ASC
        `, [id]);

        return res.json({
            success: true,
            data: {
                ...warehouse,
                vehicles: vehiclesRes.rows,
                devices: devicesRes.rows
            },
            message: "Lấy chi tiết kho thành công"
        });
    } catch (error) {
        console.error("Warehouse getWarehouseById error:", error);
        return res.status(500).json({
            success: false,
            data: null,
            message: "Lỗi máy chủ khi lấy chi tiết kho"
        });
    }
};

// POST /api/warehouses - Thêm mới kho lạnh
exports.createWarehouse = async (req, res) => {
    try {
        const { warehouse_name, longitude, latitude, status = "ACTIVE" } = req.body;

        if (!warehouse_name) {
            return res.status(400).json({
                success: false,
                data: null,
                message: "Tên kho lạnh không được để trống"
            });
        }

        const maxIdRes = await pool.query("SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM warehouse");
        const nextId = maxIdRes.rows[0].next_id;

        const insertRes = await pool.query(`
            INSERT INTO warehouse (id, warehouse_name, longitude, latitude, status, created_at)
            VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
            RETURNING *
        `, [nextId, warehouse_name, longitude || null, latitude || null, status]);

        return res.status(201).json({
            success: true,
            data: insertRes.rows[0],
            message: "Tạo kho lạnh mới thành công"
        });
    } catch (error) {
        console.error("Warehouse createWarehouse error:", error);
        return res.status(500).json({
            success: false,
            data: null,
            message: "Lỗi máy chủ khi tạo mới kho"
        });
    }
};

// PUT /api/warehouses/:id - Sửa thông tin kho lạnh
exports.updateWarehouse = async (req, res) => {
    try {
        const { id } = req.params;
        const { warehouse_name, longitude, latitude, status } = req.body;

        const checkRes = await pool.query("SELECT id FROM warehouse WHERE id = $1", [id]);
        if (checkRes.rows.length === 0) {
            return res.status(404).json({
                success: false,
                data: null,
                message: "Không tìm thấy kho cần cập nhật"
            });
        }

        const updateRes = await pool.query(`
            UPDATE warehouse 
            SET 
                warehouse_name = COALESCE($1, warehouse_name),
                longitude = COALESCE($2, longitude),
                latitude = COALESCE($3, latitude),
                status = COALESCE($4, status)
            WHERE id = $5
            RETURNING *
        `, [warehouse_name, longitude, latitude, status, id]);

        return res.json({
            success: true,
            data: updateRes.rows[0],
            message: "Cập nhật kho lạnh thành công"
        });
    } catch (error) {
        console.error("Warehouse updateWarehouse error:", error);
        return res.status(500).json({
            success: false,
            data: null,
            message: "Lỗi máy chủ khi cập nhật kho"
        });
    }
};

// DELETE /api/warehouses/:id - Xóa kho lạnh
exports.deleteWarehouse = async (req, res) => {
    try {
        const { id } = req.params;

        // Kiểm tra ràng buộc khóa ngoại
        const [vehCheck, devCheck] = await Promise.all([
            pool.query("SELECT COUNT(*) FROM delivery_vehicle WHERE warehouse_id = $1", [id]),
            pool.query("SELECT COUNT(*) FROM device WHERE warehouse_id = $1", [id])
        ]);

        if (parseInt(vehCheck.rows[0].count, 10) > 0 || parseInt(devCheck.rows[0].count, 10) > 0) {
            return res.status(400).json({
                success: false,
                data: null,
                message: "Không thể xóa kho vì đang có xe tải hoặc thiết bị IoT gán vào kho này"
            });
        }

        const deleteRes = await pool.query("DELETE FROM warehouse WHERE id = $1 RETURNING *", [id]);

        if (deleteRes.rows.length === 0) {
            return res.status(404).json({
                success: false,
                data: null,
                message: "Không tìm thấy kho để xóa"
            });
        }

        return res.json({
            success: true,
            data: deleteRes.rows[0],
            message: "Xóa kho lạnh thành công"
        });
    } catch (error) {
        console.error("Warehouse deleteWarehouse error:", error);
        return res.status(500).json({
            success: false,
            data: null,
            message: "Lỗi máy chủ khi xóa kho"
        });
    }
};
