const pool = require("../db");

// GET /api/tracking: active batches with an assigned vehicle, excluding completed/cancelled loads.
exports.getMovingBatches = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                o.external_batch_code,
                b.product_name,
                b.product_type,
                b.quantity,
                b.unit,
                b.origin AS pickup_address,
                o.consumption_address,
                o.logistics_status,
                o.updated_at,
                v.license_plate,
                CASE
                    WHEN o.logistics_status IN ('DELIVERY_READY', 'RETURN_READY', 'OUT_FOR_DELIVERY', 'OUT_FOR_RETURN')
                        THEN COALESCE(w.warehouse_name, b.origin)
                    ELSE b.origin
                END AS route_origin,
                CASE
                    WHEN o.logistics_status IN ('DELIVERY_READY', 'OUT_FOR_DELIVERY') THEN o.consumption_address
                    WHEN o.logistics_status IN ('RETURN_READY', 'OUT_FOR_RETURN') THEN b.origin
                    ELSE w.warehouse_name
                END AS route_destination
            FROM cold_chain_batch_operations o
            JOIN agri_batches b ON b.id = o.batch_id
            JOIN delivery_vehicle v ON v.id = o.vehicle_id
            LEFT JOIN warehouse w ON w.id = o.warehouse_id
            WHERE o.logistics_status IN (
                'PICKUP_ASSIGNED', 'PICKED_UP', 'AT_INSPECTION',
                'DELIVERY_READY', 'RETURN_READY', 'OUT_FOR_DELIVERY', 'OUT_FOR_RETURN'
            )
            ORDER BY o.updated_at DESC, o.external_batch_code
        `);

        return res.json({
            success: true,
            data: result.rows,
            message: "Lấy danh sách lô đang vận chuyển thành công"
        });
    } catch (error) {
        console.error("Moving batch tracking error:", error.code || "unknown");
        return res.status(500).json({ success: false, data: null, message: "Không thể tải lộ trình lô hàng" });
    }
};
