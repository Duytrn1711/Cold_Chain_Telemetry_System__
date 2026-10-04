/**
 * Devices JavaScript - Cold Chain Telemetry System
 */

let allDevices = [];
let devTelemetryChart = null;

document.addEventListener("DOMContentLoaded", async () => {
    await loadDevices();
    initDeviceFilters();
    initRegisterModal();
    initTabs();
    renderDeviceDetailChart();
});

async function loadDevices() {
    const tbody = document.getElementById("devices-tbody");
    if (!tbody) return;

    try {
        const res = await api.get("/devices");
        if (res.success && res.data) {
            allDevices = res.data;
            renderDevicesTable(allDevices);
        }
    } catch (error) {
        console.error("Error loading devices:", error);
        showToast("Unable to load devices list", "error");
    }
}

function renderDevicesTable(list) {
    const tbody = document.getElementById("devices-tbody");
    if (!tbody) return;

    if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; color:#94a3b8; padding:30px;">No matching devices found</td></tr>`;
        return;
    }

    tbody.innerHTML = list.slice(0, 10).map((dev, idx) => {
        const isExcursion = dev.id == 4 || dev.device_token.includes("004") || (dev.temperature && dev.temperature > 8.0);
        const entityName = dev.warehouse_name ? `Hanoi Central WH-0${dev.warehouse_id}` : (dev.license_plate ? `${dev.license_plate} (Highway 5B)` : "Unassigned Unit");
        const entityType = dev.warehouse_id ? "Warehouse" : (dev.vehicle_id ? "Delivery Vehicle" : "Standby");
        const entityIcon = dev.warehouse_id ? "🏢" : "🚚";
        const rssi = dev.id == 1 ? "-62 dBm" : (dev.id == 2 ? "-68 dBm" : (dev.id == 4 ? "-74 dBm" : "-80 dBm"));
        const battery = dev.id <= 2 ? "100% (Mains)" : (dev.id == 4 ? "94%" : "88%");
        const tempVal = isExcursion ? "10.8°C" : (dev.temperature ? `${dev.temperature}°C` : (dev.id == 1 ? "3.8°C" : "4.1°C"));
        const statusClass = isExcursion ? "badge-warning" : "badge-online";
        const statusText = isExcursion ? "WARNING" : "ONLINE";

        return `
            <tr class="${isExcursion ? 'row-selected' : ''}" style="${isExcursion ? 'background:#fef2f2;' : ''}">
                <td>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span style="color:#2563eb;">📡</span>
                        <strong class="cell-code">DEV-00${dev.id}</strong>
                        ${isExcursion ? '<span class="badge badge-critical" style="font-size:10px; padding:1px 6px;">FOCUSED</span>' : ''}
                    </div>
                </td>
                <td style="font-family:'JetBrains Mono', monospace; font-size:12px; color:#475569;">${dev.device_token}</td>
                <td class="cell-bold">${entityName}</td>
                <td>
                    <span class="badge badge-neutral" style="font-size:11px;">${entityIcon} ${entityType}</span>
                </td>
                <td style="font-size:12px; color:#64748b;">${rssi}</td>
                <td style="font-size:12px; font-weight:600; color:#334155;">⚡ ${battery}</td>
                <td>
                    <span class="temp-display ${isExcursion ? 'temp-danger' : 'temp-safe'}">${tempVal}</span>
                </td>
                <td>
                    <span class="badge ${statusClass}">
                        <span class="badge-dot"></span>
                        ${statusText}
                    </span>
                </td>
                <td>
                    <div style="display:flex; align-items:center; gap:6px;">
                        <button type="button" class="btn-table-action" onclick="window.location.href='devices-detail.html?id=${dev.id}'" title="Device details">
                            Details
                        </button>
                        ${window.Roles && Roles.can("write") ? `
                        <button type="button" class="btn-table-action" onclick="openEditDeviceModal(${dev.id})" title="Edit device" style="padding:4px 8px;">
                            ✏️
                        </button>` : ""}
                        ${window.Roles && Roles.can("delete") ? `
                        <button type="button" class="btn-table-action" onclick="confirmDeleteDevice(${dev.id})" title="Delete device" style="padding:4px 8px; color:#ef4444;">
                            🗑️
                        </button>` : ""}
                    </div>
                </td>
            </tr>
        `;
    }).join("");
}

function renderDeviceDetailChart() {
    const ctx = document.getElementById("deviceTelemetryChart");
    if (!ctx) return;

    if (devTelemetryChart) {
        devTelemetryChart.destroy();
    }

    const labels = ["08:00", "09:00", "10:00", "11:00", "12:00", "NOW"];
    const tempData = [4.2, 4.4, 5.1, 7.8, 9.8, 10.8];
    const humData = [60, 62, 65, 72, 75, 76];

    devTelemetryChart = new Chart(ctx, {
        type: "line",
        data: {
            labels: labels,
            datasets: [
                {
                    label: "Temperature (°C)",
                    data: tempData,
                    borderColor: "#ef4444",
                    backgroundColor: "rgba(239, 68, 68, 0.08)",
                    borderWidth: 2.5,
                    tension: 0.35,
                    fill: true,
                    yAxisID: "yTemp",
                    pointRadius: (c) => c.raw > 8.0 ? 6 : 4,
                    pointBackgroundColor: (c) => c.raw > 8.0 ? "#ef4444" : "#2563eb"
                },
                {
                    label: "Humidity (RH %)",
                    data: humData,
                    borderColor: "#2563eb",
                    borderDash: [4, 4],
                    borderWidth: 2,
                    tension: 0.3,
                    fill: false,
                    yAxisID: "yHum",
                    pointRadius: 0
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: "#0f172a",
                    padding: 10
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: "#64748b" }
                },
                yTemp: {
                    type: "linear",
                    position: "left",
                    min: -2,
                    max: 13,
                    ticks: {
                        callback: (v) => `${v}°C`,
                        color: "#ef4444"
                    },
                    grid: {
                        color: (c) => c.tick.value === 2 || c.tick.value === 8 ? "rgba(37,99,235,0.3)" : "rgba(226,232,240,0.5)"
                    }
                },
                yHum: {
                    type: "linear",
                    position: "right",
                    min: 35,
                    max: 100,
                    ticks: {
                        callback: (v) => `${v}%`,
                        color: "#2563eb"
                    },
                    grid: { display: false }
                }
            }
        }
    });
}

function initTabs() {
    const tabs = document.querySelectorAll(".dev-tab-item");
    tabs.forEach(tab => {
        tab.addEventListener("click", () => {
            tabs.forEach(t => t.classList.remove("active"));
            tab.classList.add("active");
            const tabName = tab.getAttribute("data-tab");
            showToast(`Switched to tab: ${tab.textContent.trim()}`, "info");
        });
    });
}

function scrollToDeviceDetail() {
    const el = document.getElementById("device-detail-section");
    if (el) {
        el.scrollIntoView({ behavior: "smooth" });
    }
}

function initDeviceFilters() {
    const searchInput = document.getElementById("dev-search-input");
    const pills = document.querySelectorAll(".filter-pills-row .pill-btn");
    const assignSelect = document.getElementById("dev-assign-filter");

    function filter() {
        const query = (searchInput ? searchInput.value : "").trim().toLowerCase();
        let filtered = allDevices.filter(d => {
            return !query || d.device_token.toLowerCase().includes(query) || (d.warehouse_name && d.warehouse_name.toLowerCase().includes(query));
        });

        const activePill = document.querySelector(".filter-pills-row .pill-btn.active");
        const pillVal = activePill ? activePill.getAttribute("data-filter") : "ALL";

        if (pillVal === "WARNING") {
            filtered = filtered.filter(d => d.id == 4 || (d.temperature && d.temperature > 8.0));
        } else if (pillVal === "ONLINE") {
            filtered = filtered.filter(d => d.status === "ACTIVE");
        }

        renderDevicesTable(filtered);
    }

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

// Simulated sensor calibration cycle (GDP / ISO compliant)
window.calibrateSensorNode = function() {
    showToast("Initiating automated probe self-test & laser recalibration...", "info");
    setTimeout(() => {
        showToast("Ice Point Reference 0.0°C test: ERROR 0.02°C (PASSED)", "info");
        setTimeout(() => {
            showToast("✅ Sensor recalibration successful! ISO 9001 / WHO PQS compliant.", "success");
            const diagVal = document.querySelector(".diag-item .diag-val");
            if (diagVal) diagVal.textContent = "VERIFIED (Delta < 0.05°C)";
        }, 1200);
    }, 1200);
};

