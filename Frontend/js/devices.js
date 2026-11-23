/**
 * Devices JavaScript - Cold Chain Telemetry System
 */

let allDevices = [];
let devTelemetryChart = null;
let deviceFiltersReady = false;
let deviceRefreshRunning = false;

document.addEventListener("DOMContentLoaded", async () => {
    await loadDevices();
    await populateDeviceAssignments();
    initDeviceFilters();
    initRegisterModal();
    initTabs();
    renderDeviceDetailChart();
    window.setInterval(() => loadDevices(true), 1000);
});

async function populateDeviceAssignments() {
    try {
        const [warehouseResponse, vehicleResponse] = await Promise.all([api.get("/warehouses"), api.get("/vehicles")]);
        const warehouses = warehouseResponse.success ? warehouseResponse.data : [];
        const vehicles = vehicleResponse.success ? vehicleResponse.data : [];
        const warehouseOptions = '<option value="">-- No warehouse assignment --</option>' + warehouses.map((item) => `<option value="${item.id}">${item.warehouse_name}</option>`).join("");
        const vehicleOptions = '<option value="">-- No vehicle assignment --</option>' + vehicles.map((item) => `<option value="${item.id}">${item.license_plate}</option>`).join("");
        ["reg-wh-id", "edit-dev-wh"].forEach((id) => { const element = document.getElementById(id); if (element) element.innerHTML = warehouseOptions; });
        ["reg-veh-id", "edit-dev-veh"].forEach((id) => { const element = document.getElementById(id); if (element) element.innerHTML = vehicleOptions; });
    } catch (error) {
        console.error("Could not load assignment lists:", error);
    }
}

async function loadDevices(silent = false) {
    const tbody = document.getElementById("devices-tbody");
    if (!tbody || deviceRefreshRunning) return;
    deviceRefreshRunning = true;

    try {
        const res = await api.get("/devices");
        if (res.success && res.data) {
            allDevices = res.data;
            const total = document.getElementById("device-total-count");
            const active = document.getElementById("device-active-count");
            const excursions = document.getElementById("device-excursion-count");
            if (total) total.textContent = String(allDevices.length);
            const onlineDevices = allDevices.filter((item) => item.is_online === true);
            const excursionDevices = onlineDevices.filter((item) => item.temperature != null && (Number(item.temperature) < 2 || Number(item.temperature) > 8));
            if (active) active.textContent = String(onlineDevices.length);
            if (excursions) excursions.textContent = String(excursionDevices.length);
            const countByFilter = {
                ALL: allDevices.length,
                ONLINE: onlineDevices.length,
                WARNING: excursionDevices.length,
                OFFLINE: allDevices.length - onlineDevices.length
            };
            document.querySelectorAll(".filter-pills-row .pill-btn[data-filter]").forEach((button) => {
                const key = button.dataset.filter;
                const label = button.dataset.label || button.textContent.replace(/\s*\(.*\)$/, "").replace(/[●•]/g, "").trim();
                button.dataset.label = label;
                button.textContent = `${label} (${countByFilter[key] ?? 0})`;
            });
            const countTag = document.getElementById("device-count-tag");
            const pagination = document.getElementById("device-pagination-info");
            if (countTag) countTag.textContent = `(${allDevices.length} database records)`;
            if (pagination) pagination.textContent = `Showing ${allDevices.length} of ${allDevices.length} registered devices`;
            if (deviceFiltersReady) applyDeviceFilters();
            else renderDevicesTable(allDevices);
        }
    } catch (error) {
        console.error("Error loading devices:", error);
        if (!silent) showToast("Unable to load devices list", "error");
    } finally {
        deviceRefreshRunning = false;
    }
}

function renderDevicesTable(list) {
    const tbody = document.getElementById("devices-tbody");
    if (!tbody) return;
    if (!list.length) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:30px;color:#64748b;">No registered devices match this filter.</td></tr>';
        return;
    }
    tbody.innerHTML = list.map((device) => {
        const isOnline = device.is_online === true;
        const temperature = isOnline && device.temperature !== null && device.temperature !== undefined ? Number(device.temperature) : null;
        const excursion = temperature !== null && (temperature < 2 || temperature > 8);
        const entity = device.warehouse_name || device.license_plate || "Unassigned";
        const kind = device.warehouse_name ? "Warehouse" : (device.license_plate ? "Delivery vehicle" : "Unassigned");
        const temperatureText = temperature === null ? "No live data" : `${temperature.toFixed(1)}°C`;
        const humidity = isOnline && device.humidity !== null && device.humidity !== undefined ? Number(device.humidity) : null;
        const humidityText = humidity === null ? "—" : `${humidity.toFixed(1)}%`;
        const registeredActive = String(device.status || "").toUpperCase() === "ACTIVE";
        const state = isOnline ? "ONLINE" : (registeredActive ? "OFFLINE" : "INACTIVE");
        const stateClass = isOnline ? (excursion ? "badge-warning" : "badge-online") : "badge-neutral";
        return `<tr>
            <td><strong class="cell-code">${device.id}</strong></td>
            <td class="cell-code">${device.device_token}</td>
            <td class="cell-bold">${entity}</td>
            <td><span class="badge badge-neutral">${kind}</span></td>
            <td style="color:#64748b">Not collected</td>
            <td style="color:#64748b">Not collected</td>
            <td><span class="temp-display ${excursion ? "temp-danger" : (isOnline ? "temp-safe" : "")}">${temperatureText}</span></td>
            <td>${humidityText}</td>
            <td><span class="badge ${stateClass}">${state}</span></td>
            <td><div style="display:flex;gap:6px;">
                <button type="button" class="btn-table-action" onclick="window.location.href='devices-detail.html?id=${device.id}'">Details</button>
                ${window.Roles && Roles.can("write") ? `<button type="button" class="btn-table-action" onclick="openEditDeviceModal(${device.id})">Edit</button>` : ""}
                ${window.Roles && Roles.can("delete") ? `<button type="button" class="btn-table-action" onclick="confirmDeleteDevice(${device.id})">Delete</button>` : ""}
            </div></td>
        </tr>`;
    }).join("");
}
async function renderDeviceDetailChart() {
    const canvas = document.getElementById("deviceTelemetryChart");
    if (!canvas || typeof Chart === "undefined") return;
    if (devTelemetryChart) devTelemetryChart.destroy();
    try {
        const response = await api.get("/data", { limit: 24 });
        const points = response.success && response.data?.list ? [...response.data.list].reverse() : [];
        const labels = points.map((point) => new Date(point.created_at).toLocaleString());
        devTelemetryChart = new Chart(canvas, {
            type: "line",
            data: { labels, datasets: [{ label: "Recorded temperature (°C)", data: points.map((point) => Number(point.temperature)), borderColor: "#2563eb", backgroundColor: "rgba(37, 99, 235, 0.08)", fill: true, spanGaps: false }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: true } }, scales: { y: { suggestedMin: 0, suggestedMax: 12, ticks: { callback: (value) => `${value}°C` } } } }
        });
    } catch (error) {
        console.error("Could not load device telemetry chart:", error);
    }
}
function initDeviceFilters() {
    const searchInput = document.getElementById("dev-search-input");
    const pills = document.querySelectorAll(".filter-pills-row .pill-btn");
    const assignSelect = document.getElementById("dev-assign-filter");

    const filter = applyDeviceFilters;
    deviceFiltersReady = true;

    if (searchInput) searchInput.addEventListener("input", filter);
    pills.forEach(p => {
        p.addEventListener("click", () => {
            pills.forEach(x => x.classList.remove("active"));
            p.classList.add("active");
            filter();
        });
    });
    if (assignSelect) assignSelect.addEventListener("change", filter);
}

function applyDeviceFilters() {
    const query = (document.getElementById("dev-search-input")?.value || "").trim().toLowerCase();
    const assignSelect = document.getElementById("dev-assign-filter");
    const assignment = assignSelect?.value || "ALL";
    const activePill = document.querySelector(".filter-pills-row .pill-btn.active");
    const pillValue = activePill?.dataset.filter || "ALL";
    let filtered = allDevices.filter((device) => {
        const matchesSearch = !query || String(device.device_token || "").toLowerCase().includes(query) ||
            String(device.warehouse_name || "").toLowerCase().includes(query) || String(device.license_plate || "").toLowerCase().includes(query);
        const matchesAssignment = assignment === "ALL" || (assignment === "WAREHOUSE" && Boolean(device.warehouse_id)) || (assignment === "VEHICLE" && Boolean(device.vehicle_id));
        const matchesPill = pillValue === "ALL" ||
            (pillValue === "ONLINE" && device.is_online === true) ||
            (pillValue === "OFFLINE" && device.is_online !== true) ||
            (pillValue === "WARNING" && device.is_online === true && device.temperature != null && (Number(device.temperature) < 2 || Number(device.temperature) > 8));
        return matchesSearch && matchesAssignment && matchesPill;
    });
    renderDevicesTable(filtered);
}

function initRegisterModal() {
    if (window.Roles && !Roles.can("write")) {
        const openBtnEarly = document.getElementById("btn-open-register-modal");
        if (openBtnEarly) openBtnEarly.classList.add("role-hidden");
    }
    const modal = document.getElementById("register-device-modal");
    const openBtn = document.getElementById("btn-open-register-modal");
    const closeBtn = document.getElementById("reg-modal-close");
    const cancelBtn = document.getElementById("reg-modal-cancel");
    const form = document.getElementById("register-device-form");

    if (!modal) return;

    const show = () => modal.classList.add("active");
    const hide = () => { modal.classList.remove("active"); if (form) form.reset(); };

    if (openBtn) openBtn.addEventListener("click", show);
    if (closeBtn) closeBtn.addEventListener("click", hide);
    if (cancelBtn) cancelBtn.addEventListener("click", hide);

    modal.addEventListener("click", (e) => { if (e.target === modal) hide(); });

    if (form) {
        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            const token = document.getElementById("reg-token").value.trim();
            const whId = document.getElementById("reg-wh-id").value;
            const vehId = document.getElementById("reg-veh-id").value;
            const status = document.getElementById("reg-status").value;

            if (!token) {
                showToast("Please enter a device token", "warning");
                return;
            }

            try {
                const res = await api.post("/devices", {
                    device_token: token,
                    warehouse_id: whId ? parseInt(whId, 10) : null,
                    vehicle_id: vehId ? parseInt(vehId, 10) : null,
                    status
                });

                if (res.success) {
                    showToast("Sensor device registered successfully!", "success");
                    hide();
                    await loadDevices();
                } else {
                    showToast(res.message || "Failed to register device", "error");
                }
            } catch (err) {
                showToast(err.message || "Server error", "error");
            }
        });
    }

    // Edit Device Form Submit
    const editForm = document.getElementById("edit-device-form");
    if (editForm) {
        editForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const id = document.getElementById("edit-dev-id").value;
            const token = document.getElementById("edit-dev-token").value.trim();
            const whId = document.getElementById("edit-dev-wh").value;
            const vehId = document.getElementById("edit-dev-veh").value;
            const status = document.getElementById("edit-dev-status").value;

            try {
                const res = await api.put(`/devices/${id}`, {
                    device_token: token,
                    warehouse_id: whId ? parseInt(whId, 10) : null,
                    vehicle_id: vehId ? parseInt(vehId, 10) : null,
                    status
                });

                if (res.success) {
                    showToast(`Device "${token}" updated successfully!`, "success");
                    closeEditDeviceModal();
                    await loadDevices();
                } else {
                    showToast(res.message || "Failed to update device", "error");
                }
            } catch (err) {
                showToast(err.message || "Error updating device", "error");
            }
        });
    }
}

window.openEditDeviceModal = function(id) {
    if (window.Roles && !Roles.guard("write", "Staff accounts cannot edit devices.")) return;
    const dev = allDevices.find(d => d.id == id);
    if (!dev) {
        showToast("Device information not found", "warning");
        return;
    }

    document.getElementById("edit-dev-id").value = dev.id;
    document.getElementById("edit-dev-token").value = dev.device_token;
    document.getElementById("edit-dev-wh").value = dev.warehouse_id || "";
    document.getElementById("edit-dev-veh").value = dev.vehicle_id || "";
    document.getElementById("edit-dev-status").value = dev.status || "ACTIVE";

    const modal = document.getElementById("edit-device-modal");
    if (modal) modal.classList.add("show");
};

window.closeEditDeviceModal = function() {
    const modal = document.getElementById("edit-device-modal");
    if (modal) modal.classList.remove("show");
};

window.confirmDeleteDevice = async function(id) {
    if (window.Roles && !Roles.guard("delete", "Only administrators can delete devices.")) return;
    const dev = allDevices.find(d => d.id == id);
    const token = dev ? dev.device_token : `#${id}`;

    if (!confirm(`Are you sure you want to delete sensor device "${token}"?\nAll associated telemetry records and alerts will be removed from the system.`)) {
        return;
    }

    try {
        const res = await api.delete(`/devices/${id}`);
        if (res.success) {
            showToast(`Sensor device "${token}" deleted successfully!`, "success");
            await loadDevices();
        } else {
            showToast(res.message || "Unable to delete device", "error");
        }
    } catch (err) {
        showToast(err.message || "Error deleting device", "error");
    }
};

window.calibrateSensorNode = function() {
    showToast("Calibration control is not connected to a device service.", "warning");
};

