/**
 * Warehouses JavaScript - Cold Chain Telemetry System
 * Real-time Chamber Temperature Profiles & Facility Management
 * Synchronized in English
 */

let allWarehouses = [];
let selectedWarehouseId = null;
let warehouseChart = null;

document.addEventListener("DOMContentLoaded", async () => {
    await loadWarehouses();
    initFilters();
    initModal();

    // Refresh from persisted telemetry after an API-confirmed reading.
    window.onTelemetryLiveUpdate = (packet) => {
        if (packet?.persisted) {
            const selected = allWarehouses.find((item) => String(item.id) === String(selectedWarehouseId));
            if (selected) renderWarehouseTempChart(selected);
        }
    };
});

async function loadWarehouses() {
    const tbody = document.getElementById("warehouses-tbody");
    if (!tbody) return;

    try {
        const res = await api.get("/warehouses");
        if (res.success && res.data) {
            allWarehouses = res.data;
            renderWarehousesTable(allWarehouses);

            const totalEl = document.getElementById("wh-total-count");
            if (totalEl) totalEl.textContent = allWarehouses.length;

            const onlineCount = allWarehouses.filter((warehouse) => Number(warehouse.online_device_count) > 0).length;
            const onlineEl = document.getElementById("wh-online-count");
            if (onlineEl) onlineEl.textContent = onlineCount;

            const badgeCount = document.getElementById("wh-badge-count");
            if (badgeCount) badgeCount.textContent = `${allWarehouses.length} Facilities`;

            if (allWarehouses.length > 0) {
                const toSelect = selectedWarehouseId 
                    ? (allWarehouses.find(w => w.id == selectedWarehouseId) || allWarehouses[0])
                    : allWarehouses[0];
                selectWarehouse(toSelect.id);
            }
        }
    } catch (error) {
        console.error("Error loading warehouses:", error);
        showToast("Unable to load cold storage facilities", "error");
    }
}

function renderWarehousesTable(list) {
    const tbody = document.getElementById("warehouses-tbody");
    if (!tbody) return;

    if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#94a3b8; padding:30px;">No cold storage facilities found</td></tr>`;
        return;
    }

    tbody.innerHTML = list.map((wh) => {
        const isSelected = wh.id == selectedWarehouseId;
        const code = `WH-0${wh.id}`;
        const devCount = Number(wh.device_count || 0);
        const vehCount = Number(wh.vehicle_count || 0);
        const avgTemp = wh.avg_temp === null || wh.avg_temp === undefined ? "—" : `${parseFloat(wh.avg_temp).toFixed(1)}°C`;
        const coords = (wh.latitude !== null && wh.longitude !== null)
            ? `${parseFloat(wh.latitude).toFixed(4)}, ${parseFloat(wh.longitude).toFixed(4)}`
            : "Coordinates not recorded";

        return `
            <tr class="${isSelected ? 'row-selected' : ''}" onclick="selectWarehouse(${wh.id})" style="cursor:pointer; transition:all 0.15s ease;">
                <td>
                    <div style="color:#2563eb; font-weight:700; font-size:12px;">${code}</div>
                    <div class="cell-bold" style="font-size:14px; margin-top:2px;">${wh.warehouse_name}</div>
                </td>
                <td>
                    <div style="font-size:12px; color:#475569;">${wh.warehouse_name}</div>
                    <div class="cell-subtext" style="font-family:'JetBrains Mono',monospace;">${coords}</div>
                </td>
                <td>
                    <span class="badge ${wh.status === 'ACTIVE' ? 'badge-active' : 'badge-idle'}">
                        <span class="badge-dot"></span>
                        ${wh.status}
                    </span>
                </td>
                <td>
                    <div style="font-weight:600; font-size:12px; color:#334155;">${devCount} Sensors · ${vehCount} Fleet</div>
                    <div class="cell-subtext" style="color:#64748b;">${devCount ? "Registered devices" : "No devices assigned"}</div>
                </td>
                <td>
                    <span class="temp-display temp-safe" style="font-family:'JetBrains Mono',monospace;">${avgTemp}</span>
                </td>
                <td>
                    <div style="display:flex; align-items:center; gap:6px;">
                        <button type="button" class="btn-table-action ${isSelected ? 'active' : ''}" onclick="event.stopPropagation(); window.location.href='warehouses-detail.html?id=${wh.id}'" title="View Facility Probes & Fleet">
                            Details
                        </button>
                        ${window.Roles && Roles.can("write") ? `
                        <button type="button" class="btn-table-action" onclick="event.stopPropagation(); openEditWarehouseModal(${wh.id})" title="Edit Facility" style="padding:4px 8px;">
                            ✏️
                        </button>` : ""}
                        ${window.Roles && Roles.can("delete") ? `
                        <button type="button" class="btn-table-action" onclick="event.stopPropagation(); confirmDeleteWarehouse(${wh.id})" title="Delete Facility" style="padding:4px 8px; color:#ef4444;">
                            🗑️
                        </button>` : ""}
                    </div>
                </td>
            </tr>
        `;
    }).join("");

    const paginationInfo = document.getElementById("wh-pagination-info");
    if (paginationInfo) {
        paginationInfo.textContent = `Showing 1 to ${list.length} of ${list.length} facilities`;
    }
}

function selectWarehouse(id) {
    selectedWarehouseId = id;
    const wh = allWarehouses.find(w => w.id == id);
    if (!wh) return;

    // Update table visual
    const rows = document.querySelectorAll("#warehouses-tbody tr");
    rows.forEach(r => r.classList.remove("row-selected"));
    
    // Update panel
    const badgeEl = document.getElementById("panel-wh-badge");
    if (badgeEl) badgeEl.textContent = `WH-0${wh.id} • ${wh.status}`;

    const nameEl = document.getElementById("panel-wh-name");
    if (nameEl) nameEl.textContent = wh.warehouse_name;

    const subEl = document.getElementById("panel-wh-sub");
    if (subEl) subEl.textContent = wh.status || "Status unavailable";

    const coordsEl = document.getElementById("panel-wh-coords");
    if (coordsEl) {
        coordsEl.textContent = wh.latitude !== null && wh.longitude !== null
            ? `${parseFloat(wh.latitude).toFixed(5)}, ${parseFloat(wh.longitude).toFixed(5)}`
            : "Coordinates not recorded";
    }

    const createdEl = document.getElementById("panel-wh-created");
    if (createdEl) {
        createdEl.textContent = wh.created_at ? new Date(wh.created_at).toLocaleDateString("vi-VN") : "—";
    }

    const vehEl = document.getElementById("panel-wh-vehicles");
    if (vehEl) vehEl.textContent = wh.vehicle_count ?? 0;

    const sensorEl = document.getElementById("panel-wh-sensors");
    if (sensorEl) sensorEl.textContent = wh.device_count ?? 0;

    const mapPin = document.getElementById("map-pin-label");
    if (mapPin) mapPin.textContent = `${wh.warehouse_name} • WH-0${wh.id}`;

    const chartTitle = document.getElementById("wh-chart-title");
    if (chartTitle) chartTitle.textContent = `${wh.warehouse_name} - Thermal Profile`;

    // Render / update warehouse chamber temperature profile chart
    renderWarehouseTempChart(wh);
}

/**
 * Render real-time chamber thermal curve for the selected facility (matching vehicles chart)
 */
async function renderWarehouseTempChart(warehouse) {
    const canvas = document.getElementById("warehouseTempChart");
    if (!canvas || typeof Chart === "undefined") return;
    if (warehouseChart) warehouseChart.destroy();
    try {
        const response = await api.get(`/warehouses/${warehouse.id}`);
        const readings = response.success ? response.data.telemetryHistory || [] : [];
        const labels = readings.map((item) => new Date(item.created_at).toLocaleString());
        const entities = [...new Set(readings.map((item) => item.device_token))];
        const colors = ["#2563eb", "#10b981", "#8b5cf6", "#f59e0b"];
        const legend = document.getElementById("warehouse-chart-legend");
        if (legend) legend.innerHTML = entities.map((token, index) => `<span style="display:flex;align-items:center;gap:4px;"><span style="width:8px;height:8px;border-radius:50%;background:${colors[index % colors.length]};"></span>${token}</span>`).join("");
        const datasets = entities.map((token, index) => ({
            label: token,
            data: readings.map((item) => item.device_token === token ? Number(item.temperature) : null),
            borderColor: colors[index % colors.length],
            backgroundColor: "transparent",
            tension: 0.25,
            spanGaps: false
        }));
        const subtitle = document.getElementById("wh-chart-subtitle");
        if (subtitle) subtitle.textContent = readings.length ? `${readings.length} readings stored for this warehouse` : "No telemetry readings are stored for this warehouse.";
        warehouseChart = new Chart(canvas, {
            type: "line",
            data: { labels, datasets },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: entities.length > 1 } }, scales: { y: { suggestedMin: 0, suggestedMax: 12, ticks: { callback: (value) => `${value}°C` } } } }
        });
    } catch (error) {
        console.error("Could not load warehouse telemetry:", error);
    }
}
function initFilters() {
    const searchInput = document.getElementById("wh-search-input");
    const statusSelect = document.getElementById("wh-status-filter");

    function applyFilter() {
        const search = (searchInput ? searchInput.value : "").trim().toLowerCase();
        const status = statusSelect ? statusSelect.value : "ALL";

        const filtered = allWarehouses.filter(wh => {
            const matchesSearch = !search || wh.warehouse_name.toLowerCase().includes(search);
            const matchesStatus = status === "ALL" || wh.status === status;
            return matchesSearch && matchesStatus;
        });

        renderWarehousesTable(filtered);
    }

    if (searchInput) searchInput.addEventListener("input", applyFilter);
    if (statusSelect) statusSelect.addEventListener("change", applyFilter);
}

function initModal() {
    const modal = document.getElementById("add-warehouse-modal");
    const openBtn = document.getElementById("btn-open-add-modal");
    const closeBtn = document.getElementById("modal-close-btn");
    const cancelBtn = document.getElementById("modal-cancel-btn");
    const form = document.getElementById("add-warehouse-form");

    if (!modal) return;

    const showModal = () => {
        if (window.Roles && !Roles.guard("write", "Staff accounts cannot add warehouses.")) return;
        modal.classList.add("active");
    };
    const hideModal = () => {
        modal.classList.remove("active");
        if (form) form.reset();
    };

    if (openBtn) openBtn.addEventListener("click", showModal);
    if (closeBtn) closeBtn.addEventListener("click", hideModal);
    if (cancelBtn) cancelBtn.addEventListener("click", hideModal);

    modal.addEventListener("click", (e) => {
        if (e.target === modal) hideModal();
    });

    if (form) {
        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            const name = document.getElementById("new-wh-name").value.trim();
            const lat = document.getElementById("new-wh-lat").value;
            const lng = document.getElementById("new-wh-lng").value;
            const status = document.getElementById("new-wh-status").value;
            const submitButton = form.querySelector('[type="submit"]');

            if (name.length < 2 || name.length > 255) {
                showToast("Tên kho cần có từ 2 đến 255 ký tự", "warning");
                return;
            }
            if (Boolean(lat) !== Boolean(lng)) {
                showToast("Hãy nhập cả vĩ độ và kinh độ, hoặc để trống cả hai", "warning");
                return;
            }
            const latitude = lat === "" ? null : Number(lat);
            const longitude = lng === "" ? null : Number(lng);
            if ((latitude !== null && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)) ||
                (longitude !== null && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180))) {
                showToast("Tọa độ không hợp lệ: vĩ độ từ -90 đến 90, kinh độ từ -180 đến 180", "warning");
                return;
            }

            if (submitButton) submitButton.disabled = true;
            try {
                const res = await api.post("/warehouses", {
                    warehouse_name: name,
                    latitude,
                    longitude,
                    status: status || "ACTIVE"
                });

                if (res.success) {
                    showToast("Warehouse registered successfully!", "success");
                    hideModal();
                    if (res.data?.id !== undefined) selectedWarehouseId = res.data.id;
                    await loadWarehouses();
                } else {
                    showToast(res.message || "Could not create warehouse", "error");
                }
            } catch (err) {
                console.error("Create warehouse error:", err);
                showToast(err.message || "Server error creating warehouse", "error");
            } finally {
                if (submitButton) submitButton.disabled = false;
            }
        });
    }
}

// Edit Warehouse handlers
window.openEditWarehouseModal = function(id) {
    if (window.Roles && !Roles.guard("write", "Staff accounts cannot edit warehouses.")) return;
    const wh = allWarehouses.find(w => w.id == id);
    if (!wh) return;

    document.getElementById("edit-wh-id").value = wh.id;
    document.getElementById("edit-wh-name").value = wh.warehouse_name;
    document.getElementById("edit-wh-lat").value = wh.latitude || "";
    document.getElementById("edit-wh-lng").value = wh.longitude || "";
    document.getElementById("edit-wh-status").value = wh.status || "ACTIVE";

    const modal = document.getElementById("edit-warehouse-modal");
    if (modal) modal.classList.add("active");
};

window.closeEditModal = function() {
    const modal = document.getElementById("edit-warehouse-modal");
    if (modal) modal.classList.remove("active");
};

document.addEventListener("DOMContentLoaded", () => {
    const editForm = document.getElementById("edit-warehouse-form");
    if (editForm) {
        editForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const id = document.getElementById("edit-wh-id").value;
            const name = document.getElementById("edit-wh-name").value.trim();
            const lat = document.getElementById("edit-wh-lat").value;
            const lng = document.getElementById("edit-wh-lng").value;
            const status = document.getElementById("edit-wh-status").value;

            try {
                const res = await api.put(`/warehouses/${id}`, {
                    warehouse_name: name,
                    latitude: lat ? parseFloat(lat) : null,
                    longitude: lng ? parseFloat(lng) : null,
                    status: status
                });

                if (res.success) {
                    showToast("Facility updated successfully!", "success");
                    closeEditModal();
                    await loadWarehouses();
                    selectWarehouse(id);
                } else {
                    showToast(res.message || "Failed to update facility", "error");
                }
            } catch (err) {
                showToast(err.message || "Error updating warehouse", "error");
            }
        });
    }
});

window.confirmDeleteWarehouse = async function(id) {
    if (window.Roles && !Roles.guard("delete", "Only administrators can delete warehouses.")) return;
    const wh = allWarehouses.find(w => w.id == id);
    const name = wh ? wh.warehouse_name : `#${id}`;
    if (!confirm(`Are you sure you want to delete warehouse "${name}"? This action cannot be undone.`)) {
        return;
    }

    try {
        const res = await api.delete(`/warehouses/${id}`);
        if (res.success) {
            showToast(`Warehouse "${name}" deleted successfully!`, "success");
            selectedWarehouseId = null;
            await loadWarehouses();
        } else {
            showToast(res.message || "Could not delete warehouse", "error");
        }
    } catch (err) {
        showToast(err.message || "Error deleting warehouse", "error");
    }
};

window.triggerGpsForSelectedWh = function() {
    const wh = allWarehouses.find(w => w.id == selectedWarehouseId) || allWarehouses[0];
    if (!wh) return;

    const coords = (wh.latitude && wh.longitude)
        ? `${parseFloat(wh.latitude).toFixed(4)}° N, ${parseFloat(wh.longitude).toFixed(4)}° E`
        : "Coordinates not recorded";

    if (typeof window.showGpsRadarModal === "function") {
        window.showGpsRadarModal(wh.warehouse_name, coords);
    } else {
        showToast(`Locating ${wh.warehouse_name} on satellite radar...`, "info");
    }
};

function exportWarehouseList() {
    if (window.Roles && !Roles.guard("export", "Staff accounts cannot export facility data.")) return;
    showToast("Exporting cold storage facility data...", "info");
    const headers = ["Facility ID", "Warehouse Name", "Latitude", "Longitude", "Status", "Sensors", "Docked Fleet"];
    const rows = allWarehouses.map(w => [
        `"WH-0${w.id}"`,
        `"${w.warehouse_name}"`,
        `"${w.latitude ?? ""}"`,
        `"${w.longitude ?? ""}"`,
        `"${w.status}"`,
        `"${w.device_count ?? 0}"`,
        `"${w.vehicle_count ?? 0}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const link = document.createElement("a");
    link.href = encodeURI(csvContent);
    link.download = `coldchain_warehouses_${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
    showToast("Warehouse dataset exported successfully!", "success");
}
window.exportWarehouseList = exportWarehouseList;
