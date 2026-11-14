const pool = require("../db");

// GET /api/data/summary - Thống kê tổng hợp số liệu cho dashboard & report
exports.getSummary = async (req, res) => {
    try {
        // Đếm số lượng thực thể
        const [warehouseRes, vehicleRes, deviceRes, alertRes, shipmentRes] = await Promise.all([
            pool.query("SELECT COUNT(*) AS total, COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END) as active FROM warehouse"),
            pool.query(`SELECT COUNT(*) AS total,
                COUNT(*) FILTER (WHERE status = 'ACTIVE') AS active,
                (SELECT COUNT(DISTINCT vehicle_id) FROM cold_chain_batch_operations
                    WHERE vehicle_id IS NOT NULL AND logistics_status IN ('PICKUP_ASSIGNED', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'OUT_FOR_RETURN')) AS in_transit
                FROM delivery_vehicle`),
            pool.query("SELECT COUNT(*) AS total, COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END) as active FROM device"),
            pool.query(`SELECT COUNT(*) AS total,
                COUNT(*) FILTER (WHERE UPPER(alert_type) LIKE '%HIGH%' OR UPPER(alert_type) LIKE '%CAO%' OR UPPER(alert_type) LIKE '%LOW%' OR UPPER(alert_type) LIKE '%THẤP%') AS critical,
                COUNT(*) FILTER (WHERE UPPER(alert_type) NOT LIKE '%HIGH%' AND UPPER(alert_type) NOT LIKE '%CAO%' AND UPPER(alert_type) NOT LIKE '%LOW%' AND UPPER(alert_type) NOT LIKE '%THẤP%') AS warning
                FROM alert`),
            pool.query(`SELECT logistics_status, COUNT(*) AS count FROM cold_chain_batch_operations GROUP BY logistics_status`)
        ]);

        // Tính tỷ lệ tuân thủ nhiệt độ chuẩn (2.0°C - 8.0°C)
        const complianceRes = await pool.query(`
            SELECT 
                COUNT(*) AS total_readings,
                COUNT(CASE WHEN temperature >= 2.0 AND temperature <= 8.0 THEN 1 END) AS compliant_readings,
                COUNT(CASE WHEN temperature > 8.0 THEN 1 END) AS high_excursions,
                COUNT(CASE WHEN temperature < 2.0 THEN 1 END) AS low_excursions,
                AVG(temperature) AS avg_temp,
                AVG(humidity) AS avg_humidity
            FROM data
        `);

        const totalReadings = parseInt(complianceRes.rows[0].total_readings || 0, 10);
        const compliantReadings = parseInt(complianceRes.rows[0].compliant_readings || 0, 10);
        const complianceRate = totalReadings > 0
            ? parseFloat(((compliantReadings / totalReadings) * 100).toFixed(1))
            : null;

        // Lấy chuỗi dữ liệu 12 mốc thời gian gần nhất cho biểu đồ dashboard
        const chartRes = await pool.query(`
            SELECT 
                d.id,
                d.temperature,
                d.humidity,
                d.created_at,
                dev.device_token,
                COALESCE(w.warehouse_name, v.license_plate, dev.device_token) AS entity_name,
                CASE WHEN v.id IS NOT NULL THEN 'vehicle' WHEN w.id IS NOT NULL THEN 'warehouse' ELSE 'device' END AS entity_type
            FROM data d
            JOIN device dev ON d.device_id = dev.id
            LEFT JOIN warehouse w ON dev.warehouse_id = w.id
            LEFT JOIN delivery_vehicle v ON dev.vehicle_id = v.id
            ORDER BY d.created_at DESC
            LIMIT 24
        `);

        const latestChartPoints = [...chartRes.rows].reverse();
        const activeDeviceRes = await pool.query(`
            SELECT COUNT(*) FILTER (WHERE latest.temperature < 2 OR latest.temperature > 8 OR latest.humidity > 80) AS warning,
                   COUNT(*) FILTER (WHERE latest.created_at IS NULL OR latest.created_at < CURRENT_TIMESTAMP - INTERVAL '1 hour') AS offline
            FROM device dev
            LEFT JOIN LATERAL (
                SELECT temperature, humidity, created_at FROM data WHERE device_id = dev.id
                ORDER BY created_at DESC LIMIT 1
            ) latest ON TRUE
            WHERE dev.status = 'ACTIVE'
        `);
        const shipmentCounts = Object.fromEntries(shipmentRes.rows.map(row => [row.logistics_status, parseInt(row.count, 10)]));

        return res.json({
            success: true,
            data: {
                warehouses: {
                    total: parseInt(warehouseRes.rows[0].total || 0, 10),
                    active: parseInt(warehouseRes.rows[0].active || 0, 10)
                },
                vehicles: {
                    total: parseInt(vehicleRes.rows[0].total || 0, 10),
                    active: parseInt(vehicleRes.rows[0].active || 0, 10),
                    in_transit: parseInt(vehicleRes.rows[0].in_transit || 0, 10),
                    idle: Math.max(0, parseInt(vehicleRes.rows[0].total || 0, 10) - parseInt(vehicleRes.rows[0].in_transit || 0, 10))
                },
                devices: {
                    total: parseInt(deviceRes.rows[0].total || 0, 10),
                    active: parseInt(deviceRes.rows[0].active || 0, 10),
                    warning: parseInt(activeDeviceRes.rows[0].warning || 0, 10),
                    offline: parseInt(activeDeviceRes.rows[0].offline || 0, 10)
                },
                alerts: {
                    total: parseInt(alertRes.rows[0].total || 0, 10),
                    critical: parseInt(alertRes.rows[0].critical || 0, 10),
                    warning: parseInt(alertRes.rows[0].warning || 0, 10)
                },
                compliance: {
                    rate: complianceRate,
                    avg_temp: complianceRes.rows[0].avg_temp === null ? null : parseFloat(complianceRes.rows[0].avg_temp).toFixed(1),
                    avg_humidity: complianceRes.rows[0].avg_humidity === null ? null : parseFloat(complianceRes.rows[0].avg_humidity).toFixed(1),
                    high_excursions: parseInt(complianceRes.rows[0].high_excursions || 0, 10),
                    low_excursions: parseInt(complianceRes.rows[0].low_excursions || 0, 10)
                },
                agriBatches: shipmentCounts,
                chartPoints: latestChartPoints
            },
            message: "Lấy dữ liệu tổng hợp thành công"
        });
    } catch (error) {
        console.error("Data summary error:", error);
        return res.status(500).json({
            success: false,
            data: null,
            message: "Lỗi máy chủ khi lấy dữ liệu tổng quan"
        });
    }
};

// GET /api/data - Lấy danh sách telemetry có bộ lọc & phân trang
exports.getAllData = async (req, res) => {
    try {
        const { device_id, warehouse_id, vehicle_id, page = 1, limit = 25 } = req.query;
        const offset = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);

        let query = `
            SELECT 
                d.id,
                d.device_id,
                d.temperature,
                d.humidity,
                d.created_at,
                dev.device_token,
                dev.status AS device_status,
                dev.warehouse_id,
                dev.vehicle_id,
                w.warehouse_name,
                v.license_plate
            FROM data d
            JOIN device dev ON d.device_id = dev.id
            LEFT JOIN warehouse w ON dev.warehouse_id = w.id
            LEFT JOIN delivery_vehicle v ON dev.vehicle_id = v.id
            WHERE 1=1
        `;
        const params = [];

        if (device_id) {
            params.push(device_id);
            query += ` AND d.device_id = $${params.length}`;
        }
        if (warehouse_id) {
            params.push(warehouse_id);
            query += ` AND dev.warehouse_id = $${params.length}`;
        }
        if (vehicle_id) {
            params.push(vehicle_id);
            query += ` AND dev.vehicle_id = $${params.length}`;
        }

        // Đếm tổng số bản ghi
        const countQuery = `SELECT COUNT(*) FROM (${query}) AS filtered_data`;
        const countRes = await pool.query(countQuery, params);
        const total = parseInt(countRes.rows[0].count, 10);

        query += ` ORDER BY d.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(parseInt(limit, 10), offset);

        const dataRes = await pool.query(query, params);

        return res.json({
            success: true,
            data: {
                list: dataRes.rows,
                total,
                page: parseInt(page, 10),
                limit: parseInt(limit, 10),
                totalPages: Math.ceil(total / parseInt(limit, 10))
            },
            message: "Lấy danh sách dữ liệu telemetry thành công"
        });
    } catch (error) {
        console.error("Data getAllData error:", error);
        return res.status(500).json({
            success: false,
            data: null,
            message: "Lỗi máy chủ khi lấy dữ liệu telemetry"
        });
    }
};

// GET /api/data/device/:deviceId - Lấy dữ liệu telemetry theo thiết bị
exports.getDeviceData = async (req, res) => {
    try {
        const { deviceId } = req.params;
        const { limit = 50 } = req.query;

        const result = await pool.query(`
            SELECT 
                d.id,
                d.device_id,
                d.temperature,
                d.humidity,
                d.created_at
            FROM data d
            WHERE d.device_id = $1
            ORDER BY d.created_at ASC
            LIMIT $2
        `, [deviceId, parseInt(limit, 10)]);

        return res.json({
            success: true,
            data: result.rows,
            message: "Lấy lịch sử dữ liệu thiết bị thành công"
        });
    } catch (error) {
        console.error("Data getDeviceData error:", error);
        return res.status(500).json({
            success: false,
            data: null,
            message: "Lỗi máy chủ khi lấy dữ liệu theo thiết bị"
        });
    }
};

// POST /api/data - Tiếp nhận dữ liệu telemetry từ cảm biến
exports.createData = async (req, res) => {
    try {
        const { device_id, temperature, humidity } = req.body;

        const tempValue = Number(temperature);
        const humidityValue = humidity === undefined || humidity === null || humidity === "" ? null : Number(humidity);
        if (!device_id || temperature === undefined || !Number.isFinite(tempValue) || tempValue < -100 || tempValue > 100 ||
            (humidityValue !== null && (!Number.isFinite(humidityValue) || humidityValue < 0 || humidityValue > 100))) {
            return res.status(400).json({
                success: false,
                data: null,
                message: "Provide a device_id, temperature from -100 to 100 °C, and optional humidity from 0 to 100%"
            });
        }

        // Lấy ID tự tăng an toàn chống race condition
        let record = null;
        for (let attempt = 0; attempt < 5; attempt++) {
            try {
                const maxIdRes = await pool.query("SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM data");
                const nextId = Number(maxIdRes.rows[0].next_id) + attempt;

                const insertRes = await pool.query(`
                    INSERT INTO data (id, device_id, temperature, humidity, created_at)
                    VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
                    RETURNING *
                `, [nextId, device_id, tempValue, humidityValue]);
                record = insertRes.rows[0];
                break;
            } catch (err) {
                if (err.code === "23505" && attempt < 4) {
                    await new Promise(r => setTimeout(r, 40 * (attempt + 1)));
                    continue;
                }
                throw err;
            }
        }

        // Tự động kiểm tra ngưỡng nhiệt độ an toàn chuỗi lạnh (2.0°C - 8.0°C)
        const tempVal = tempValue;
        if (tempVal < 2.0 || tempVal > 8.0) {
            const isHigh = tempVal > 8.0;
            const alertType = isHigh ? "NHIỆT ĐỘ QUÁ CAO" : "NHIỆT ĐỘ QUÁ THẤP";
            const alertContent = `Phát hiện: Thiết bị #${device_id} có nhiệt độ ${tempVal.toFixed(2)}°C vượt ngưỡng an toàn chuỗi lạnh (2.0°C - 8.0°C).`;

            for (let aAttempt = 0; aAttempt < 5; aAttempt++) {
                try {
                    const maxAlertId = await pool.query("SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM alert");
                    await pool.query(`
                        INSERT INTO alert (id, device_id, alert_type, alert_content, created_at)
                        VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
                    `, [Number(maxAlertId.rows[0].next_id) + aAttempt, device_id, alertType, alertContent]);
                    break;
                } catch (aErr) {
                    if (aErr.code === "23505" && aAttempt < 4) {
                        await new Promise(r => setTimeout(r, 40 * (aAttempt + 1)));
                        continue;
                    }
                    throw aErr;
                }
            }
        }

        return res.status(201).json({
            success: true,
            data: record,
            message: "Tiếp nhận dữ liệu telemetry thành công"
        });
    } catch (error) {
        console.error("Data createData error:", error);
        return res.status(500).json({
            success: false,
            data: null,
            message: "Lỗi máy chủ khi tiếp nhận dữ liệu telemetry"
        });
    }
};

// GET /api/data/reports - Thống kê báo cáo tuân thủ từ database cho từng kho và xe
// Tỷ lệ tuân thủ = (Số dữ liệu hợp lệ [2.0°C - 8.0°C] / Tổng số dữ liệu) * 100%
// Nếu >= 98% -> 'COMPLIANT', ngược lại < 98% -> 'REVIEW REQUIRED'
exports.getReportsData = async (req, res) => {
    try {
        const { period } = req.query;

        let dateFilter = "";
        if (period === "today") {
            dateFilter = " AND dt.created_at >= CURRENT_DATE";
        } else if (period === "week") {
            dateFilter = " AND dt.created_at >= (CURRENT_TIMESTAMP - INTERVAL '7 days')";
        } else if (period === "month") {
            dateFilter = " AND dt.created_at >= (CURRENT_TIMESTAMP - INTERVAL '30 days')";
        } else if (period === "quarter") {
            dateFilter = " AND dt.created_at >= (CURRENT_TIMESTAMP - INTERVAL '90 days')";
        }

        // 1. Dữ liệu báo cáo tuân thủ từng kho (thiết bị cố định tại kho: vehicle_id IS NULL)
        const warehouseQuery = `
            SELECT 
                w.id,
                w.warehouse_name,
                COUNT(DISTINCT d.id) AS sensor_count,
                COUNT(dt.id) AS total_readings,
                COUNT(CASE WHEN dt.temperature >= 2.0 AND dt.temperature <= 8.0 THEN 1 END) AS compliant_readings,
                COUNT(CASE WHEN dt.temperature < 2.0 OR dt.temperature > 8.0 THEN 1 END) AS excursion_readings,
                COALESCE(MIN(dt.temperature), 0) AS min_temp,
                COALESCE(MAX(dt.temperature), 0) AS max_temp,
                COALESCE(AVG(dt.temperature), 0) AS avg_temp
            FROM warehouse w
            LEFT JOIN device d ON (d.warehouse_id = w.id AND d.vehicle_id IS NULL)
            LEFT JOIN data dt ON (dt.device_id = d.id ${dateFilter})
            GROUP BY w.id, w.warehouse_name
            ORDER BY w.id ASC
        `;

        // 2. Dữ liệu báo cáo tuân thủ từng xe (thiết bị gắn trên xe)
        const vehicleQuery = `
            SELECT 
                v.id,
                v.license_plate,
                COUNT(DISTINCT d.id) AS sensor_count,
                COUNT(dt.id) AS total_readings,
                COUNT(CASE WHEN dt.temperature >= 2.0 AND dt.temperature <= 8.0 THEN 1 END) AS compliant_readings,
                COUNT(CASE WHEN dt.temperature < 2.0 OR dt.temperature > 8.0 THEN 1 END) AS excursion_readings,
                COALESCE(MIN(dt.temperature), 0) AS min_temp,
                COALESCE(MAX(dt.temperature), 0) AS max_temp,
                COALESCE(AVG(dt.temperature), 0) AS avg_temp
            FROM delivery_vehicle v
            LEFT JOIN device d ON d.vehicle_id = v.id
            LEFT JOIN data dt ON (dt.device_id = d.id ${dateFilter})
            GROUP BY v.id, v.license_plate
            ORDER BY v.id ASC
        `;

        const [warehouseRes, vehicleRes] = await Promise.all([
            pool.query(warehouseQuery),
            pool.query(vehicleQuery)
        ]);

        // Định dạng dữ liệu từng kho
        const warehouses = warehouseRes.rows.map(w => {
            const total = parseInt(w.total_readings, 10);
            const compliant = parseInt(w.compliant_readings, 10);
            const complianceRate = total > 0 
                ? parseFloat(((compliant / total) * 100).toFixed(1)) 
                : null;
            // So với 98%: nếu >= 98% gán COMPLIANT, thấp hơn gán REVIEW REQUIRED
            const status = complianceRate === null ? "NO DATA" : complianceRate >= 98.0 ? "COMPLIANT" : "REVIEW REQUIRED";

            return {
                id: `WH-${w.id}`,
                raw_id: w.id,
                name: w.warehouse_name,
                category: "Warehouse Storage",
                isVehicle: false,
                sensors: parseInt(w.sensor_count || 0, 10),
                readings: total,
                compliant_readings: compliant,
                compliance: complianceRate,
                minTemp: total > 0 ? parseFloat(parseFloat(w.min_temp).toFixed(1)) : null,
                maxTemp: total > 0 ? parseFloat(parseFloat(w.max_temp).toFixed(1)) : null,
                excursions: parseInt(w.excursion_readings || 0, 10),
                mkt: total > 0 ? parseFloat(parseFloat(w.avg_temp).toFixed(1)) : null,
                status
            };
        });

        // Định dạng dữ liệu từng xe
        const vehicles = vehicleRes.rows.map(v => {
            const total = parseInt(v.total_readings, 10);
            const compliant = parseInt(v.compliant_readings, 10);
            const complianceRate = total > 0 
                ? parseFloat(((compliant / total) * 100).toFixed(1)) 
                : null;
            // So với 98%: nếu >= 98% gán COMPLIANT, thấp hơn gán REVIEW REQUIRED
            const status = complianceRate === null ? "NO DATA" : complianceRate >= 98.0 ? "COMPLIANT" : "REVIEW REQUIRED";

            return {
                id: `VEH-${v.id}`,
                raw_id: v.id,
                name: `Vehicle ${v.license_plate}`,
                category: "Refrigerated Transit",
                isVehicle: true,
                sensors: parseInt(v.sensor_count || 0, 10),
                readings: total,
                compliant_readings: compliant,
                compliance: complianceRate,
                minTemp: total > 0 ? parseFloat(parseFloat(v.min_temp).toFixed(1)) : null,
                maxTemp: total > 0 ? parseFloat(parseFloat(v.max_temp).toFixed(1)) : null,
                excursions: parseInt(v.excursion_readings || 0, 10),
                mkt: total > 0 ? parseFloat(parseFloat(v.avg_temp).toFixed(1)) : null,
                status
            };
        });

        const facilityAuditList = [...warehouses, ...vehicles];

        // Thống kê tổng hợp toàn hệ thống (Executive KPIs)
        const totalAllReadings = facilityAuditList.reduce((sum, r) => sum + r.readings, 0);
        const totalCompliantReadings = facilityAuditList.reduce((sum, r) => sum + r.compliant_readings, 0);
        const totalExcursions = facilityAuditList.reduce((sum, r) => sum + r.excursions, 0);
        const overallComplianceRate = totalAllReadings > 0 
            ? parseFloat(((totalCompliantReadings / totalAllReadings) * 100).toFixed(1)) 
            : null;

        const activeEntities = facilityAuditList.filter(r => r.readings > 0 && r.mkt !== null);
        const overallAvgTemp = totalAllReadings > 0
            ? parseFloat((activeEntities.reduce((sum, r) => sum + r.mkt * r.readings, 0) / totalAllReadings).toFixed(1))
            : null;
        const compliantAuditCount = facilityAuditList.filter(r => r.status === "COMPLIANT").length;

        return res.json({
            success: true,
            data: {
                overall: {
                    complianceRate: overallComplianceRate,
                    totalExcursions,
                    avgTemp: overallAvgTemp,
                    compliantAuditCount,
                    totalFacilities: facilityAuditList.length
                },
                facilityAuditList,
                warehouses,
                vehicles
            },
            message: "Lấy báo cáo tuân thủ kho & xe thành công"
        });
    } catch (error) {
        console.error("Reports getReportsData error:", error);
        return res.status(500).json({
            success: false,
            data: null,
            message: "Lỗi máy chủ khi lấy dữ liệu báo cáo"
        });
    }
};


