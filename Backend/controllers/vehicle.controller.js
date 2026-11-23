const pool = require("../db");
const { addLiveConnectionState } = require("./device.controller");

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
                sensor.device_id,
                sensor.device_token,
                sensor.device_status,
                sensor.temperature,
                sensor.humidity,
                sensor.last_ping_time,
                shipment.external_batch_code AS active_batch_code,
                shipment.product_name AS shipment_product_name,
                shipment.quantity AS shipment_quantity,
                shipment.unit AS shipment_unit,
                shipment.logistics_status AS shipment_status,
                shipment.inspection_decision,
                shipment.pickup_address AS shipment_pickup_address,
                shipment.route_origin AS shipment_route_origin,
                shipment.route_destination AS shipment_destination,
                shipment.receiving_warehouse_name,
                shipment.updated_at AS shipment_updated_at
            FROM delivery_vehicle v
            LEFT JOIN warehouse w ON v.warehouse_id = w.id
            LEFT JOIN LATERAL (
                SELECT d.id AS device_id, d.device_token, d.status AS device_status,
                    latest.temperature, latest.humidity, latest.created_at AS last_ping_time
                FROM device d
                LEFT JOIN LATERAL (
                    SELECT temperature, humidity, created_at
                    FROM data WHERE device_id = d.id
                    ORDER BY created_at DESC, id DESC LIMIT 1
                ) latest ON TRUE
                WHERE d.vehicle_id = v.id
                ORDER BY latest.created_at DESC NULLS LAST, d.id ASC
                LIMIT 1
            ) sensor ON TRUE
            LEFT JOIN LATERAL (
                SELECT o.external_batch_code, o.logistics_status, o.inspection_decision,
                    b.origin AS pickup_address, o.consumption_address, b.product_name,
                    b.quantity, b.unit, wh.warehouse_name AS receiving_warehouse_name, o.updated_at,
                    CASE WHEN o.logistics_status IN ('OUT_FOR_DELIVERY','DELIVERY_READY') THEN wh.warehouse_name
                         WHEN o.logistics_status IN ('OUT_FOR_RETURN','RETURN_READY') THEN COALESCE(wh.warehouse_name, b.origin)
                         ELSE b.origin END AS route_origin,
                    CASE WHEN o.logistics_status IN ('OUT_FOR_DELIVERY','DELIVERY_READY') THEN o.consumption_address
                         WHEN o.logistics_status IN ('OUT_FOR_RETURN','RETURN_READY') THEN b.origin
                         WHEN o.logistics_status IN ('PICKUP_ASSIGNED','PICKED_UP','AT_INSPECTION') THEN wh.warehouse_name
                         ELSE o.consumption_address END AS route_destination
                FROM cold_chain_batch_operations o
                JOIN agri_batches b ON b.id = o.batch_id
                LEFT JOIN warehouse wh ON wh.id = o.warehouse_id
                WHERE o.vehicle_id = v.id AND o.logistics_status IN (
                    'PICKUP_ASSIGNED','PICKED_UP','AT_INSPECTION','DELIVERY_READY','RETURN_READY','OUT_FOR_DELIVERY','OUT_FOR_RETURN'
                )
                ORDER BY o.updated_at DESC LIMIT 1
            ) shipment ON TRUE
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

        const vehicles = result.rows.map((vehicle) => {
            const [deviceState] = addLiveConnectionState([{
                device_token: vehicle.device_token,
                status: vehicle.device_status,
                last_reading_time: vehicle.last_ping_time
            }]);
            const moving = ["PICKUP_ASSIGNED", "OUT_FOR_DELIVERY", "OUT_FOR_RETURN"].includes(vehicle.shipment_status);
            const operationalStatus = moving ? "IN_TRANSIT" : (vehicle.status === "IDLE" ? "IDLE" : "ACTIVE");
            return { ...vehicle, registered_status: vehicle.status, status: operationalStatus, device_is_online: deviceState.is_online, shipment_is_moving: moving };
        });

        return res.json({
            success: true,
            data: vehicles,
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

        const shipmentRes = await pool.query(`
            SELECT b.id, o.external_batch_code, b.product_name, b.producer_name, o.inspection_decision,
                o.logistics_status, b.origin AS pickup_address,
                b.quantity, b.unit, o.updated_at, o.consumption_address,
                wh.warehouse_name AS receiving_warehouse_name,
                CASE WHEN o.logistics_status IN ('OUT_FOR_DELIVERY','DELIVERY_READY') THEN wh.warehouse_name
                     WHEN o.logistics_status IN ('OUT_FOR_RETURN','RETURN_READY') THEN COALESCE(wh.warehouse_name,b.origin)
                     ELSE b.origin END AS route_origin,
                CASE WHEN o.logistics_status IN ('OUT_FOR_DELIVERY','DELIVERY_READY') THEN o.consumption_address
                     WHEN o.logistics_status IN ('OUT_FOR_RETURN','RETURN_READY') THEN b.origin
                     WHEN o.logistics_status IN ('PICKUP_ASSIGNED','PICKED_UP','AT_INSPECTION') THEN wh.warehouse_name
                     ELSE o.consumption_address END AS route_destination
            FROM cold_chain_batch_operations o
            JOIN agri_batches b ON b.id = o.batch_id
            LEFT JOIN warehouse wh ON wh.id=o.warehouse_id
            WHERE o.vehicle_id = $1 AND o.logistics_status IN (
                'PICKUP_ASSIGNED','PICKED_UP','AT_INSPECTION','DELIVERY_READY','RETURN_READY','OUT_FOR_DELIVERY','OUT_FOR_RETURN'
            )
            ORDER BY o.updated_at DESC LIMIT 1
        `, [id]);

        // Lấy tất cả thiết bị gán trên xe
        const deviceRes = await pool.query(`
            SELECT d.id, d.device_token, d.status, d.created_at,
                latest.temperature, latest.humidity, latest.created_at AS last_reading_time
            FROM device d
            LEFT JOIN LATERAL (
                SELECT temperature, humidity, created_at
                FROM data
                WHERE device_id = d.id
                ORDER BY created_at DESC, id DESC
                LIMIT 1
            ) latest ON TRUE
            WHERE d.vehicle_id = $1
            ORDER BY d.id ASC
        `, [id]);
        const liveDevices = addLiveConnectionState(deviceRes.rows);
        const currentShipment = shipmentRes.rows[0] || null;
        const isMoving = Boolean(currentShipment && ["PICKUP_ASSIGNED", "OUT_FOR_DELIVERY", "OUT_FOR_RETURN"].includes(currentShipment.logistics_status));
        const registeredStatus = vehicle.status;
        vehicle.status = isMoving ? "IN_TRANSIT" : (registeredStatus === "IDLE" ? "IDLE" : "ACTIVE");

        let telemetryHistory = [];
        let latestReading = null;
        let primaryDevice = null;

        if (deviceRes.rows.length > 0) {
            primaryDevice = liveDevices.find((device) => device.is_online) || liveDevices[0];
            const historyRes = await pool.query(`
                SELECT dt.id, dt.device_id, d.device_token, dt.temperature, dt.humidity, dt.created_at
                FROM data dt
                JOIN device d ON dt.device_id = d.id
                WHERE d.vehicle_id = $1 AND d.id = $2
                ORDER BY dt.created_at DESC
                LIMIT 50
            `, [id, primaryDevice.id]);
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
                device: primaryDevice,
                devices: liveDevices,
                latestReading,
                telemetryHistory,
                recentPings: telemetryHistory.slice().reverse(),
                currentShipment,
                shipment_is_moving: isMoving,
                registered_status: registeredStatus
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
        const licensePlate = typeof req.body.license_plate === "string" ? req.body.license_plate.trim().toUpperCase() : "";
        const warehouseId = Number(req.body.warehouse_id);
        const status = String(req.body.status || "ACTIVE").trim().toUpperCase();

        if (licensePlate.length < 4 || licensePlate.length > 20 || !Number.isSafeInteger(warehouseId) || warehouseId <= 0) {
            return res.status(400).json({
                success: false,
                data: null,
                message: "Vui lòng nhập biển số xe hợp lệ (4–20 ký tự) và chọn kho trực thuộc"
            });
        }
        if (!["ACTIVE", "IN_TRANSIT", "IDLE"].includes(status)) {
            return res.status(400).json({ success: false, data: null, message: "Trạng thái xe không hợp lệ" });
        }

        const warehouse = await pool.query("SELECT id FROM warehouse WHERE id = $1", [warehouseId]);
        if (!warehouse.rowCount) {
            return res.status(400).json({ success: false, data: null, message: "Kho được chọn không tồn tại. Hãy tải lại danh sách kho." });
        }

        // Kiểm tra trùng biển số xe
        const checkPlate = await pool.query("SELECT id FROM delivery_vehicle WHERE UPPER(license_plate) = $1", [licensePlate]);
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
        `, [nextId, licensePlate, warehouseId, status]);

        return res.status(201).json({
            success: true,
            data: insertRes.rows[0],
            message: "Tạo mới xe tải lạnh thành công"
        });
    } catch (error) {
        console.error("Vehicle createVehicle error:", error);
        if (error.code === "23505") {
            return res.status(409).json({ success: false, data: null, message: "Biển số xe này đã tồn tại trong hệ thống" });
        }
        if (error.code === "23503") {
            return res.status(400).json({ success: false, data: null, message: "Kho được chọn không tồn tại. Hãy tải lại danh sách kho." });
        }
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
