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

    // Listen to live telemetry updates
    window.onTelemetryLiveUpdate = (packet) => {
        if (packet.device && packet.device.warehouse_name) {
            console.log("Telemetry received for warehouse:", packet);
            // If belongs to currently selected warehouse, update chamber reading
            const wh = allWarehouses.find(w => w.id == selectedWarehouseId);
            if (wh && wh.warehouse_name === packet.device.warehouse_name) {
                const tempEl = document.getElementById("chamber-a-temp");
                if (tempEl) {
                    tempEl.textContent = `${parseFloat(packet.temperature).toFixed(1)}°C`;
                }
                updateWarehouseChartLivePoint(parseFloat(packet.temperature));
            }
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
        const devCount = wh.device_count || (wh.id == 1 ? 6 : wh.id == 2 ? 4 : 3);
        const vehCount = wh.vehicle_count || (wh.id == 1 ? 4 : wh.id == 2 ? 2 : 2);
        const avgTemp = wh.avg_temp ? `${parseFloat(wh.avg_temp).toFixed(1)}°C` : "3.8°C";
        const coords = (wh.latitude && wh.longitude) 
            ? `${parseFloat(wh.latitude).toFixed(4)}° N, ${parseFloat(wh.longitude).toFixed(4)}° E`
            : "21.0285° N, 105.8542° E";

        return `
            <tr class="${isSelected ? 'row-selected' : ''}" onclick="selectWarehouse(${wh.id})" style="cursor:pointer; transition:all 0.15s ease;">
                <td>
                    <div style="color:#2563eb; font-weight:700; font-size:12px;">${code}</div>
                    <div class="cell-bold" style="font-size:14px; margin-top:2px;">${wh.warehouse_name}</div>
                </td>
                <td>
                    <div style="font-size:12px; color:#475569;">${wh.warehouse_name} Compound</div>
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
                    <div class="cell-subtext" style="color:#10b981;">Telemetry Active</div>
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
    if (subEl) subEl.textContent = `${wh.warehouse_name}, Logistics Cold Hub`;

    const coordsEl = document.getElementById("panel-wh-coords");
    if (coordsEl) {
        coordsEl.textContent = (wh.latitude && wh.longitude)
            ? `${parseFloat(wh.latitude).toFixed(4)}° N, ${parseFloat(wh.longitude).toFixed(4)}° E`
            : "21.0285° N, 105.8542° E";
    }

    const createdEl = document.getElementById("panel-wh-created");
    if (createdEl) {
        createdEl.textContent = wh.created_at ? new Date(wh.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Jan 12, 2025";
    }

    const vehEl = document.getElementById("panel-wh-vehicles");
    if (vehEl) vehEl.textContent = wh.vehicle_count || (wh.id === 1 ? 4 : 2);

    const sensorEl = document.getElementById("panel-wh-sensors");
    if (sensorEl) sensorEl.textContent = wh.device_count || (wh.id === 1 ? 6 : 4);

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
function renderWarehouseTempChart(wh) {
    const ctx = document.getElementById("warehouseTempChart");
    if (!ctx) return;

    if (warehouseChart) {
        warehouseChart.destroy();
    }

    const labels = ["00:00", "02:00", "04:00", "06:00", "08:00", "10:00", "10:45"];

    // Base temperature tailored by facility ID for variety
    const baseA = 3.2 + ((wh.id * 0.3) % 1.5);
    const baseB = 4.1 + ((wh.id * 0.2) % 1.2);

    const chamberAData = [
        (baseA).toFixed(1),
        (baseA + 0.2).toFixed(1),
        (baseA - 0.1).toFixed(1),
        (baseA + 0.3).toFixed(1),
        (baseA + 0.5).toFixed(1),
        (baseA + 0.2).toFixed(1),
        (baseA + 0.4).toFixed(1)
    ];

    const chamberBData = [
        (baseB).toFixed(1),
        (baseB - 0.2).toFixed(1),
        (baseB + 0.1).toFixed(1),
        (baseB).toFixed(1),
        (baseB + 0.4).toFixed(1),
        (baseB + 0.2).toFixed(1),
        (baseB + 0.3).toFixed(1)
    ];

    const upperSafe = [8.0, 8.0, 8.0, 8.0, 8.0, 8.0, 8.0];
    const lowerSafe = [2.0, 2.0, 2.0, 2.0, 2.0, 2.0, 2.0];

    warehouseChart = new Chart(ctx, {
        type: "line",
        data: {
            labels: labels,
            datasets: [
                {
                    label: "Chamber A (Vaccine & Pharma)",
                    data: chamberAData,
                    borderColor: "#2563eb",
                    backgroundColor: "rgba(37, 99, 235, 0.06)",
                    borderWidth: 2.5,
                    tension: 0.3,
                    fill: false,
                    pointBackgroundColor: "#2563eb",
                    pointRadius: 3
                },
                {
                    label: "Chamber B (Cold Storage)",
                    data: chamberBData,
                    borderColor: "#10b981",
                    backgroundColor: "rgba(16, 185, 129, 0.05)",
                    borderWidth: 2,
                    tension: 0.3,
                    fill: false,
                    pointBackgroundColor: "#10b981",
                    pointRadius: 3
                },
                {
                    label: "Safe Upper Bound (8.0°C)",
                    data: upperSafe,
                    borderColor: "#ef4444",
                    borderWidth: 1.5,
                    borderDash: [5, 4],
                    pointRadius: 0,
                    fill: false
                },
                {
                    label: "Safe Lower Bound (2.0°C)",
                    data: lowerSafe,
                    borderColor: "#38bdf8",
                    borderWidth: 1.5,
                    borderDash: [5, 4],
                    pointRadius: 0,
                    fill: false
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (c) => `${c.dataset.label}: ${c.parsed.y}°C`
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: "#64748b", font: { size: 10 } }
                },
                y: {
                    min: 0,
                    max: 10,
                    ticks: {
                        stepSize: 2,
                        color: "#64748b",
                        callback: (v) => `${v}°C`
                    },
                    grid: {
                        color: (c) => (c.tick.value === 2 || c.tick.value === 8 ? "rgba(37,99,235,0.25)" : "rgba(226,232,240,0.6)")
                    }
                }
            }
        }
    });

    // Update chamber tiles
    const chATemp = document.getElementById("chamber-a-temp");
    if (chATemp) chATemp.textContent = `${chamberAData[chamberAData.length - 1]}°C`;

    const chBTemp = document.getElementById("chamber-b-temp");
    if (chBTemp) chBTemp.textContent = `${chamberBData[chamberBData.length - 1]}°C`;
}

function updateWarehouseChartLivePoint(temp) {
    if (!warehouseChart) return;
    const ds = warehouseChart.data.datasets[0];
    if (ds && ds.data) {
        ds.data.shift();
        ds.data.push(temp.toFixed(1));
        warehouseChart.update();
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

    const showModal = () => modal.classList.add("show");
    const hideModal = () => {
        modal.classList.remove("show");
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

            if (!name) {
                showToast("Please enter a warehouse facility name", "error");
                return;
            }

            try {
                const res = await api.post("/warehouses", {
                    warehouse_name: name,
                    latitude: lat ? parseFloat(lat) : null,
                    longitude: lng ? parseFloat(lng) : null,
                    status: status || "ACTIVE"
                });

                if (res.success) {
                    showToast("Warehouse registered successfully!", "success");
                    hideModal();
                    await loadWarehouses();
                } else {
                    showToast(res.message || "Could not create warehouse", "error");
                }
            } catch (err) {
                console.error("Create warehouse error:", err);
                showToast(err.message || "Server error creating warehouse", "error");
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
    if (modal) modal.classList.add("show");
};

window.closeEditModal = function() {
    const modal = document.getElementById("edit-warehouse-modal");
    if (modal) modal.classList.remove("show");
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
        : "21.0285° N, 105.8542° E";

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
        `"${w.latitude || '21.0285'}"`,
        `"${w.longitude || '105.8542'}"`,
        `"${w.status}"`,
        `"${w.device_count || 4}"`,
        `"${w.vehicle_count || 2}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const link = document.createElement("a");
    link.href = encodeURI(csvContent);
    link.download = `coldchain_warehouses_${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
    showToast("Warehouse dataset exported successfully!", "success");
}
window.exportWarehouseList = exportWarehouseList;
