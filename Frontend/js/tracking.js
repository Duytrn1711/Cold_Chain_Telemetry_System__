const trackingSafe = (value) => String(value ?? "—").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
const trackingStatusLabels = {
    PICKUP_ASSIGNED: "Xe đang đến lấy hàng",
    PICKED_UP: "Đã lấy hàng · đang về kho",
    AT_INSPECTION: "Đã đến điểm kiểm định",
    DELIVERY_READY: "Đạt kiểm định · chờ giao",
    RETURN_READY: "Không đạt · chờ hoàn hàng",
    OUT_FOR_DELIVERY: "Đang giao đến điểm tiêu thụ",
    OUT_FOR_RETURN: "Đang hoàn hàng về nông dân"
};
let trackingLoading = false;
let movingBatches = [];

function renderMovingBatches() {
    const body = document.getElementById("tracking-body");
    const query = (document.getElementById("tracking-search")?.value || "").trim().toLocaleLowerCase("vi");
    const filtered = movingBatches.filter((batch) => [
        batch.external_batch_code, batch.product_name, batch.product_type,
        batch.license_plate, batch.route_origin, batch.route_destination
    ].some((value) => String(value || "").toLocaleLowerCase("vi").includes(query)));
    document.getElementById("tracking-count").textContent = query ? `${filtered.length} / ${movingBatches.length}` : movingBatches.length;
    if (!filtered.length) {
        body.innerHTML = `<tr><td class="tracking-message" colspan="5">${query ? "Không tìm thấy lô hàng phù hợp." : "Hiện không có lô hàng nào đang được theo dõi."}</td></tr>`;
        return;
    }
    body.innerHTML = filtered.map((batch) => `<tr>
        <td><strong>${trackingSafe(batch.external_batch_code)}</strong><small>${trackingSafe(batch.product_name)}${batch.product_type ? ` · ${trackingSafe(batch.product_type)}` : ""}</small></td>
        <td>${trackingSafe(batch.quantity)} ${trackingSafe(batch.unit)}</td>
        <td><span class="tracking-status">${trackingSafe(trackingStatusLabels[batch.logistics_status] || batch.logistics_status)}</span></td>
        <td><strong>${trackingSafe(batch.license_plate)}</strong></td>
        <td><div class="tracking-route"><span>${trackingSafe(batch.route_origin)}</span><span class="tracking-route-arrow" aria-label="Đến">→</span><span>${trackingSafe(batch.route_destination || "Chưa có điểm đến")}</span></div></td>
    </tr>`).join("");
}

async function loadMovingBatches() {
    if (trackingLoading) return;
    trackingLoading = true;
    const body = document.getElementById("tracking-body");
    try {
        const response = await api.get("/tracking");
        if (!response.success || !Array.isArray(response.data)) throw new Error(response.message || "Không thể tải lộ trình");
        movingBatches = response.data;
        document.getElementById("tracking-updated").textContent = `Cập nhật ${new Date().toLocaleTimeString()}`;
        renderMovingBatches();
    } catch (error) {
        body.innerHTML = `<tr><td class="tracking-message" colspan="5">${trackingSafe(error.message || "Không thể tải lô hàng đang vận chuyển")}</td></tr>`;
    } finally {
        trackingLoading = false;
    }
}

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("tracking-refresh")?.addEventListener("click", loadMovingBatches);
    document.getElementById("tracking-search")?.addEventListener("input", renderMovingBatches);
    loadMovingBatches();
    window.setInterval(loadMovingBatches, 5000);
});
