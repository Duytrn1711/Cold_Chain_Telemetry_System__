const logisticsLabels = {
    PICKUP_REQUESTED: "Chờ điều xe lấy hàng",
    PICKUP_ASSIGNED: "Đang đi lấy hàng",
    PICKED_UP: "Hàng đã về kho",
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
let knownBatchCodes = null;
let refreshInProgress = false;
let noticeTimeout;
const pendingAssignments = new Map();

const safe = (value) => String(value ?? "—").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));

async function loadAssignedAssets() {
    const [vehicles, warehouses] = await Promise.all([api.get("/vehicles"), api.get("/warehouses")]);
    assignedAssets.vehicles = vehicles.success && Array.isArray(vehicles.data)
        ? [...new Map(vehicles.data.map((vehicle) => [String(vehicle.id), vehicle])).values()]
        : [];
    assignedAssets.warehouses = warehouses.success && Array.isArray(warehouses.data) ? warehouses.data : [];
}

function showNewBatchNotice(batches) {
    const notice = document.getElementById("batch-live-notice");
    if (!notice || !batches.length) return;
    const first = batches[0];
    const label = batches.length === 1
        ? `${first.external_batch_code} · ${first.product_name}`
        : `${batches.length} lô hàng mới`;
    notice.textContent = `Agri-Audit vừa gửi lô hàng: ${label}`;
    notice.hidden = false;
    clearTimeout(noticeTimeout);
    noticeTimeout = setTimeout(() => { notice.hidden = true; }, 10000);
    if ("Notification" in window && Notification.permission === "granted") {
        new Notification("Cold Chain nhận lô hàng mới", { body: label });
    }
}

async function loadAgriBatches({ quiet = false } = {}) {
    if (refreshInProgress) return;
    refreshInProgress = true;
    const body = document.getElementById("batch-table-body");
    if (!quiet) body.innerHTML = '<tr><td class="batch-message" colspan="8">Đang tải dữ liệu từ PostgreSQL...</td></tr>';
    try {
        const res = await api.get("/agri-batches");
        if (!res.success || !Array.isArray(res.data)) throw new Error(res.message || "Không thể tải danh sách lô hàng");
        const nextCodes = new Set(res.data.map((batch) => batch.external_batch_code).filter(Boolean));
        if (knownBatchCodes) {
            const incoming = res.data.filter((batch) => batch.external_batch_code && !knownBatchCodes.has(batch.external_batch_code));
            showNewBatchNotice(incoming);
        }
        knownBatchCodes = nextCodes;
        agriBatches = res.data;
        renderAgriBatches();
    } catch (error) {
        if (!quiet) body.innerHTML = `<tr><td class="batch-message" colspan="8">${safe(error.message || "Không thể kết nối API")}</td></tr>`;
    } finally {
        refreshInProgress = false;
    }
}

function batchAction(batch) {
    if (batch.logistics_status === "PICKUP_REQUESTED") {
        const vehicles = assignedAssets.vehicles.filter((vehicle) =>
            vehicle.status === "ACTIVE" && (!vehicle.active_batch_code || vehicle.active_batch_code === batch.external_batch_code));
        const warehouses = assignedAssets.warehouses.filter((warehouse) => warehouse.status === "ACTIVE");
        if (!vehicles.length) return "<span>Chưa có xe trống đang hoạt động</span>";
        if (!warehouses.length) return "<span>Chưa có kho đang hoạt động</span>";
        const selected = pendingAssignments.get(String(batch.id)) || {};
        return `<div class="batch-assignment">
            <select class="batch-assignment-vehicle" data-batch-id="${batch.id}" aria-label="Chọn xe lấy hàng">
                <option value="">Chọn xe lấy hàng</option>
                ${vehicles.map((vehicle) => `<option value="${vehicle.id}" ${String(selected.vehicleId) === String(vehicle.id) ? "selected" : ""}>${safe(vehicle.license_plate)} · #${safe(vehicle.id)}</option>`).join("")}
            </select>
            <select class="batch-assignment-warehouse" data-batch-id="${batch.id}" aria-label="Chọn kho tiếp nhận">
                <option value="">Chọn kho tiếp nhận</option>
                ${warehouses.map((warehouse) => `<option value="${warehouse.id}" ${String(selected.warehouseId) === String(warehouse.id) ? "selected" : ""}>${safe(warehouse.warehouse_name)}</option>`).join("")}
            </select>
            <button class="batch-action" data-batch-id="${batch.id}" data-action="assign-pickup" ${!selected.vehicleId || !selected.warehouseId ? "disabled" : ""}>Điều xe lấy hàng</button>
        </div>`;
    }

    const nextStatus = nextLogisticsStatus[batch.logistics_status];
    if (!nextStatus) return "<span>Không còn thao tác</span>";
    const text = {
        PICKUP_ASSIGNED: "Xác nhận hàng đã về kho",
        PICKED_UP: "Bàn giao kiểm định",
        DELIVERY_READY: "Xuất phát giao hàng",
        RETURN_READY: "Xuất phát hoàn hàng",
        OUT_FOR_DELIVERY: "Xác nhận đã giao",
        OUT_FOR_RETURN: "Xác nhận đã hoàn"
    }[batch.logistics_status];
    return `<button class="batch-action" data-batch-id="${batch.id}" data-next-status="${nextStatus}">${text}</button>`;
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
        const destination = isReturn ? `Hoàn về nông dân: ${batch.pickup_address}` :
            (batch.consumption_address || batch.consumption_point_name || "Đang chờ Agri cung cấp điểm tiêu thụ");
        const vehicle = assignedAssets.vehicles.find((item) => String(item.id) === String(batch.vehicle_id));
        return `<tr>
            <td><strong>${safe(batch.external_batch_code)}</strong><small>${safe(batch.product_name)}${batch.product_type ? ` · ${safe(batch.product_type)}` : ""}</small></td>
            <td>${safe(batch.producer_name)}<small>${safe(batch.producer_phone || batch.producer_email || "")}</small></td>
            <td>${safe(batch.pickup_address)}</td>
            <td>${safe(destination)}${batch.consumption_point_name && batch.consumption_address && !isReturn ? `<small>${safe(batch.consumption_point_name)}</small>` : ""}</td>
            <td>${safe(batch.quantity)} ${safe(batch.unit)}</td>
            <td><span class="batch-status">${safe(inspectionLabels[batch.inspection_decision] || batch.inspection_decision)}</span>${batch.decision_reason ? `<small>${safe(batch.decision_reason)}</small>` : ""}</td>
            <td>${safe(logisticsLabels[batch.logistics_status] || batch.logistics_status)}${batch.warehouse_id ? `<small>Điểm kiểm định #${safe(batch.warehouse_id)}</small>` : ""}</td>
            <td>${safe(vehicle?.license_plate || "Chưa gán xe")}<small>${batchAction(batch)}</small></td>
        </tr>`;
    }).join("");
}

async function updateAgriBatchStatus(batchId, nextStatus, assignment = {}) {
    const payload = { logistics_status: nextStatus };
    if (nextStatus === "PICKUP_ASSIGNED") {
        if (!assignment.vehicleId || !assignment.warehouseId) throw new Error("Hãy chọn xe và kho tiếp nhận trước khi điều phối");
        payload.vehicle_id = Number(assignment.vehicleId);
        payload.warehouse_id = Number(assignment.warehouseId);
    }
    const res = await api.request(`/agri-batches/${batchId}/logistics-status`, { method: "PATCH", body: JSON.stringify(payload) });
    if (!res.success) throw new Error(res.message || "Không cập nhật được trạng thái");
    pendingAssignments.delete(String(batchId));
    await loadAgriBatches();
}

document.addEventListener("DOMContentLoaded", async () => {
    try { await loadAssignedAssets(); } catch (error) { console.warn("Asset lists could not be loaded:", error); }
    await loadAgriBatches();
    window.setInterval(() => loadAgriBatches({ quiet: true }), 5000);
    document.getElementById("batch-status-filter").addEventListener("change", renderAgriBatches);
    document.getElementById("batch-search").addEventListener("input", renderAgriBatches);
    document.getElementById("batch-refresh").addEventListener("click", loadAgriBatches);
    document.getElementById("batch-table-body").addEventListener("change", (event) => {
        const select = event.target.closest(".batch-assignment-vehicle, .batch-assignment-warehouse");
        if (!select) return;
        const key = String(select.dataset.batchId);
        const selected = pendingAssignments.get(key) || {};
        if (select.classList.contains("batch-assignment-vehicle")) selected.vehicleId = select.value;
        else selected.warehouseId = select.value;
        pendingAssignments.set(key, selected);
        const action = document.querySelector(`button[data-batch-id="${CSS.escape(key)}"][data-action="assign-pickup"]`);
        if (action) action.disabled = !selected.vehicleId || !selected.warehouseId;
    });
    document.getElementById("batch-table-body").addEventListener("click", async (event) => {
        const button = event.target.closest("button[data-batch-id]");
        if (!button) return;
        button.disabled = true;
        try {
            if (button.dataset.action === "assign-pickup") {
                const assignment = pendingAssignments.get(String(button.dataset.batchId)) || {};
                await updateAgriBatchStatus(button.dataset.batchId, "PICKUP_ASSIGNED", assignment);
            } else {
                await updateAgriBatchStatus(button.dataset.batchId, button.dataset.nextStatus);
            }
        }
        catch (error) { window.alert(error.message); button.disabled = false; }
    });
});
