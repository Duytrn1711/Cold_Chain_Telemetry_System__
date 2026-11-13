const logisticsLabels = {
    PICKUP_REQUESTED: "Chờ điều xe lấy hàng",
    PICKUP_ASSIGNED: "Đã điều xe lấy hàng",
    PICKED_UP: "Đã lấy hàng",
    AT_INSPECTION: "Đã bàn giao kiểm định",
    DELIVERY_READY: "Đã duyệt · chờ giao điểm tiêu thụ",
    RETURN_READY: "Bị từ chối · chờ hoàn nông dân",
    OUT_FOR_DELIVERY: "Đang giao điểm tiêu thụ",
    OUT_FOR_RETURN: "Đang hoàn về nông dân",
    DELIVERED: "Đã giao điểm tiêu thụ",
    RETURNED: "Đã hoàn nông dân",
    CANCELLED: "Đã hủy"
};

const inspectionLabels = { PENDING: "Chờ kết quả", APPROVED: "Đạt", REJECTED: "Từ chối" };
const nextLogisticsStatus = {
    PICKUP_REQUESTED: "PICKUP_ASSIGNED",
    PICKUP_ASSIGNED: "PICKED_UP",
    PICKED_UP: "AT_INSPECTION",
    DELIVERY_READY: "OUT_FOR_DELIVERY",
    RETURN_READY: "OUT_FOR_RETURN",
    OUT_FOR_DELIVERY: "DELIVERED",
    OUT_FOR_RETURN: "RETURNED"
};
let agriBatches = [];
let assignedAssets = { vehicles: [], warehouses: [] };

const safe = (value) => String(value ?? "—").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));

async function loadAssignedAssets() {
    const [vehicles, warehouses] = await Promise.all([api.get("/vehicles"), api.get("/warehouses")]);
    assignedAssets.vehicles = vehicles.success && Array.isArray(vehicles.data) ? vehicles.data : [];
    assignedAssets.warehouses = warehouses.success && Array.isArray(warehouses.data) ? warehouses.data : [];
}

async function loadAgriBatches() {
    const body = document.getElementById("batch-table-body");
    body.innerHTML = '<tr><td class="batch-message" colspan="8">Đang tải dữ liệu từ PostgreSQL...</td></tr>';
    try {
        const res = await api.get("/agri-batches");
        if (!res.success || !Array.isArray(res.data)) throw new Error(res.message || "Không thể tải danh sách lô hàng");
        agriBatches = res.data;
        renderAgriBatches();
    } catch (error) {
        body.innerHTML = `<tr><td class="batch-message" colspan="8">${safe(error.message || "Không thể kết nối API")}</td></tr>`;
    }
}

function batchAction(batch) {
    const nextStatus = nextLogisticsStatus[batch.logistics_status];
    if (!nextStatus) return "<span>Không còn thao tác</span>";
    const disabled = ["PICKUP_ASSIGNED"].includes(batch.logistics_status) && assignedAssets.vehicles.length === 0;
    const text = {
        PICKUP_REQUESTED: "Chọn xe & điều phối",
        PICKUP_ASSIGNED: "Xác nhận đã lấy",
        PICKED_UP: "Bàn giao kiểm định",
        DELIVERY_READY: "Xuất phát giao hàng",
        RETURN_READY: "Xuất phát hoàn hàng",
        OUT_FOR_DELIVERY: "Xác nhận đã giao",
        OUT_FOR_RETURN: "Xác nhận đã hoàn"
    }[batch.logistics_status];
    return `<button class="batch-action" data-batch-id="${batch.id}" data-next-status="${nextStatus}" ${disabled ? "disabled title='Chưa có xe vận chuyển trong database'" : ""}>${text}</button>`;
}

function renderAgriBatches() {
    const query = document.getElementById("batch-search").value.trim().toLowerCase();
    const status = document.getElementById("batch-status-filter").value;
    const visible = agriBatches.filter((batch) => {
        const haystack = [batch.external_batch_code, batch.product_name, batch.producer_name, batch.pickup_address, batch.consumption_address].join(" ").toLowerCase();
        return (!query || haystack.includes(query)) && (status === "ALL" || batch.logistics_status === status);
    });
    const counts = new Map();
    agriBatches.forEach((item) => counts.set(item.logistics_status, (counts.get(item.logistics_status) || 0) + 1));
    document.getElementById("batch-counts").innerHTML = ["PICKUP_REQUESTED", "PICKED_UP", "DELIVERY_READY", "RETURN_READY", "DELIVERED", "RETURNED"].map((key) => `<div class="batch-count">${safe(logisticsLabels[key])}<strong>${counts.get(key) || 0}</strong></div>`).join("");
    const filter = document.getElementById("batch-status-filter");
    const previous = filter.value;
    filter.innerHTML = '<option value="ALL">Tất cả trạng thái</option>' + Object.entries(logisticsLabels).map(([key, label]) => `<option value="${key}">${safe(label)}</option>`).join("");
    filter.value = previous;

    const body = document.getElementById("batch-table-body");
    if (!visible.length) {
        body.innerHTML = `<tr><td class="batch-message" colspan="8">${agriBatches.length ? "Không có lô nào khớp bộ lọc." : "Chưa có lô hàng nào được Agri gửi sang Cold Chain."}</td></tr>`;
        return;
    }
    body.innerHTML = visible.map((batch) => {
        const isReturn = batch.inspection_decision === "REJECTED";
        const destination = isReturn ? `Hoàn về nông dân: ${batch.pickup_address}` : (batch.consumption_address || "Đang chờ Agri cung cấp điểm tiêu thụ");
        const vehicle = assignedAssets.vehicles.find((item) => String(item.id) === String(batch.vehicle_id));
        return `<tr>
            <td><strong>${safe(batch.external_batch_code)}</strong><small>${safe(batch.product_name)}${batch.product_type ? ` · ${safe(batch.product_type)}` : ""}</small></td>
            <td>${safe(batch.producer_name)}<small>${safe(batch.producer_phone || batch.producer_email || "")}</small></td>
            <td>${safe(batch.pickup_address)}</td>
            <td>${safe(destination)}${batch.consumption_point_name && !isReturn ? `<small>${safe(batch.consumption_point_name)}</small>` : ""}</td>
            <td>${safe(batch.quantity)} ${safe(batch.unit)}</td>
            <td><span class="batch-status">${safe(inspectionLabels[batch.inspection_decision] || batch.inspection_decision)}</span>${batch.decision_reason ? `<small>${safe(batch.decision_reason)}</small>` : ""}</td>
            <td>${safe(logisticsLabels[batch.logistics_status] || batch.logistics_status)}${batch.warehouse_id ? `<small>Điểm kiểm định #${safe(batch.warehouse_id)}</small>` : ""}</td>
            <td>${safe(vehicle?.license_plate || "Chưa gán xe")}<small>${batchAction(batch)}</small></td>
        </tr>`;
    }).join("");
}

async function updateAgriBatchStatus(batchId, nextStatus) {
    const payload = { logistics_status: nextStatus };
    const batch = agriBatches.find((item) => String(item.id) === String(batchId));
    if (batch.logistics_status === "PICKUP_REQUESTED") {
        if (!assignedAssets.vehicles.length) return;
        const vehicleId = window.prompt(`Nhập ID xe có trong hệ thống (${assignedAssets.vehicles.map((v) => `${v.id}: ${v.license_plate}`).join(", ")})`);
        if (!vehicleId || !assignedAssets.vehicles.some((v) => String(v.id) === vehicleId)) return;
        payload.vehicle_id = Number(vehicleId);
        const warehouseId = window.prompt(`Nhập ID kho/điểm kiểm định (${assignedAssets.warehouses.map((w) => `${w.id}: ${w.warehouse_name}`).join(", ")})`);
        if (warehouseId && assignedAssets.warehouses.some((w) => String(w.id) === warehouseId)) payload.warehouse_id = Number(warehouseId);
    }
    const res = await api.request(`/agri-batches/${batchId}/logistics-status`, { method: "PATCH", body: JSON.stringify(payload) });
    if (!res.success) throw new Error(res.message || "Không cập nhật được trạng thái");
    await loadAgriBatches();
}

document.addEventListener("DOMContentLoaded", async () => {
    try { await loadAssignedAssets(); } catch (error) { console.warn("Asset lists could not be loaded:", error); }
    await loadAgriBatches();
    document.getElementById("batch-status-filter").addEventListener("change", renderAgriBatches);
    document.getElementById("batch-search").addEventListener("input", renderAgriBatches);
    document.getElementById("batch-refresh").addEventListener("click", loadAgriBatches);
    document.getElementById("batch-table-body").addEventListener("click", async (event) => {
        const button = event.target.closest("button[data-batch-id]");
        if (!button) return;
        button.disabled = true;
        try { await updateAgriBatchStatus(button.dataset.batchId, button.dataset.nextStatus); }
        catch (error) { window.alert(error.message); button.disabled = false; }
    });
});
