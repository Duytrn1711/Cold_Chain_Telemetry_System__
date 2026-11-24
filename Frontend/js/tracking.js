const trackingSafe = (value) => String(value ?? "—").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
const trackingStatusLabels = {
    PICKUP_ASSIGNED: "Đang lấy hàng từ nông dân",
    OUT_FOR_DELIVERY: "Đang giao đến điểm tiêu thụ",
    OUT_FOR_RETURN: "Đang hoàn hàng về nông dân"
};
let trackingLoading = false;

async function loadMovingBatches() {
    if (trackingLoading) return;
    trackingLoading = true;
    const body = document.getElementById("tracking-body");
    try {
        const response = await api.get("/tracking");
        if (!response.success || !Array.isArray(response.data)) throw new Error(response.message || "Không thể tải lộ trình");
        const batches = response.data;
        document.getElementById("tracking-count").textContent = batches.length;
        document.getElementById("tracking-updated").textContent = `Cập nhật ${new Date().toLocaleTimeString()}`;
        if (!batches.length) {
            body.innerHTML = '<tr><td class="tracking-message" colspan="5">Hiện không có lô hàng nào đang vận chuyển.</td></tr>';
            return;
        }
        body.innerHTML = batches.map((batch) => {
            return `<tr>
                <td><strong>${trackingSafe(batch.external_batch_code)}</strong><small>${trackingSafe(batch.product_name)}${batch.product_type ? ` · ${trackingSafe(batch.product_type)}` : ""}</small></td>
                <td>${trackingSafe(batch.quantity)} ${trackingSafe(batch.unit)}</td>
                <td><span class="tracking-status">${trackingSafe(trackingStatusLabels[batch.logistics_status] || batch.logistics_status)}</span></td>
                <td><strong>${trackingSafe(batch.license_plate)}</strong></td>
                <td><div class="tracking-route"><span>${trackingSafe(batch.route_origin)}</span><span class="tracking-route-arrow" aria-label="Đến">→</span><span>${trackingSafe(batch.route_destination || "Chưa có điểm đến")}</span></div></td>
            </tr>`;
        }).join("");
    } catch (error) {
        body.innerHTML = `<tr><td class="tracking-message" colspan="5">${trackingSafe(error.message || "Không thể tải lô hàng đang vận chuyển")}</td></tr>`;
    } finally {
        trackingLoading = false;
    }
}

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("tracking-refresh")?.addEventListener("click", loadMovingBatches);
    loadMovingBatches();
    window.setInterval(loadMovingBatches, 5000);
});
