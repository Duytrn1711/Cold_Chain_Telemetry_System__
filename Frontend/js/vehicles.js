/**
 * Delivery Vehicles JavaScript - Cold Chain Telemetry System
 * Live Database Telemetry & Profile Chart Visualization
 */

let allVehicles = [];
let selectedVehicleId = null;
let vehicleProfileChart = null;

document.addEventListener("DOMContentLoaded", async () => {
    await loadVehicles();
    initVehicleFilters();
});

async function loadVehicles() {
    try {
        const res = await api.get("/vehicles");
        if (res.success && res.data) {
            allVehicles = res.data;
            const countEl = document.getElementById("count-all-fleet");
            if (countEl) countEl.textContent = allVehicles.length;

            updateFleetComplianceGrade();
            renderVehicleNodes(allVehicles);

            // Select active or first vehicle by default
            if (allVehicles.length > 0) {
                const target = selectedVehicleId ? (allVehicles.find(v => v.id == selectedVehicleId) || allVehicles[0]) : allVehicles[0];
                await selectVehicle(target.id);
            }
        }
    } catch (error) {
        console.error("Error loading vehicles:", error);
        showToast("Unable to load fleet vehicles list", "error");
    }
}

function updateFleetComplianceGrade() {
    const gradeEl = document.getElementById("v-fleet-compliance-grade");
    if (!gradeEl) return;
    if (allVehicles.length === 0) {
        gradeEl.textContent = "--";
        return;
    }
    const withTemp = allVehicles.filter(v => v.temperature !== null && v.temperature !== undefined);
    if (withTemp.length === 0) {
        gradeEl.textContent = "100%";
        return;
    }
    const compliant = withTemp.filter(v => {
        const t = parseFloat(v.temperature);
        return t >= 2.0 && t <= 8.0;
    });
    const pct = ((compliant.length / withTemp.length) * 100).toFixed(1);
    gradeEl.textContent = `${pct}%`;
    gradeEl.style.color = pct >= 98 ? "#10b981" : "#ef4444";
}

function renderVehicleNodes(list) {
    const container = document.getElementById("fleet-nodes-list");
    if (!container) return;

    const renderedTag = document.getElementById("rendered-fleet-nodes-tag");
    if (renderedTag) renderedTag.textContent = `${list.length} OF ${allVehicles.length} UNITS`;

    if (list.length === 0) {
        container.innerHTML = `<div style="padding:30px; text-align:center; color:#94a3b8;">No matching vehicles found</div>`;
        return;
    }

    container.innerHTML = list.map((veh) => {
        const isSelected = veh.id == selectedVehicleId;
        const temp = veh.temperature !== null && veh.temperature !== undefined ? parseFloat(veh.temperature) : null;
        const isExcursion = temp !== null && (temp > 8.0 || temp < 2.0);
        const badgeClass = temp === null ? "badge-offline" : (isExcursion ? "badge-critical" : "badge-online");
        const tempText = temp !== null 
            ? `${temp.toFixed(1)}°C ${isExcursion ? 'ALERT' : 'NORMAL'}`
            : "NO SENSOR";
        const subNote = isExcursion 
            ? (temp > 8.0 ? "High temp spike" : "Low freeze risk") 
            : (temp !== null ? "Safe band · 2°C - 8°C" : "No device reading");
        const depot = veh.warehouse_name ? veh.warehouse_name : "Central Depot";

        return `
            <div class="fleet-node-item ${isSelected ? 'active' : ''}" onclick="selectVehicle(${veh.id})">
                <div class="node-top-row">
                    <div class="node-plate-group">
                        <span class="node-plate">${veh.license_plate}</span>
                        <span class="badge badge-transit" style="font-size:10px;">${veh.status === 'ACTIVE' ? 'IN TRANSIT' : 'IDLE'}</span>
                    </div>
                    <span class="badge ${badgeClass}" style="font-size:11px;">
                        <span class="badge-dot"></span>
                        ${tempText}
                    </span>
                </div>
                <div class="node-subtext">${subNote}</div>
                <div class="node-depot-row">
                    <span>🏢 ${depot}</span>
                </div>
            </div>
        `;
    }).join("");
}

async function selectVehicle(id) {
    selectedVehicleId = id;
    const veh = allVehicles.find(v => v.id == id);
    if (!veh) return;

    // Highlight node item in list
    renderVehicleNodes(allVehicles);

    // Update Header basic info
    const plateEl = document.getElementById("v-detail-plate");
    if (plateEl) plateEl.textContent = `Vehicle ${veh.license_plate}`;

    const subtitleEl = document.getElementById("v-detail-subtitle");
    if (subtitleEl) {
        subtitleEl.textContent = `Assigned Depot: ${veh.warehouse_name || 'Central Facility'} · Status: ${veh.status || 'ACTIVE'} · Unit: Cold Transport Reefer`;
    }

    try {
        // Fetch real database vehicle detail & telemetry history
        const res = await api.get(`/vehicles/${id}`);
        if (!res.success || !res.data) {
            showToast("Failed to load vehicle telemetry", "error");
            return;
        }

        const detail = res.data;
        const device = detail.device;
        const reading = detail.latestReading;
        const history = detail.telemetryHistory || [];
        const pings = detail.recentPings || history.slice().reverse();

        // Update Stat Tiles
        const tempTile = document.getElementById("v-stat-temp-tile");
        const tempStat = document.getElementById("v-stat-temp");
        const tempSub = document.getElementById("v-stat-temp-sub");
        const humStat = document.getElementById("v-stat-hum");
        const humSub = document.getElementById("v-stat-hum-sub");
        const nodeStat = document.getElementById("v-stat-node");
        const nodeSub = document.getElementById("v-stat-node-sub");
        const statusBadge = document.getElementById("v-detail-status-badge");

        if (reading && reading.temperature !== null) {
            const tempVal = parseFloat(reading.temperature);
            const humVal = reading.humidity !== null ? parseFloat(reading.humidity) : null;
            const isHigh = tempVal > 8.0;
            const isLow = tempVal < 2.0;

            if (tempStat) tempStat.textContent = `${tempVal.toFixed(1)}°C`;
            if (humStat) humStat.textContent = humVal !== null ? `${humVal.toFixed(1)}%` : "--%";
            if (humSub) humSub.textContent = humVal && (humVal < 60 || humVal > 85) ? "Sub-optimal humidity" : "Safe (60-85%)";

            if (isHigh) {
                if (tempTile) {
                    tempTile.style.borderColor = "#fecaca";
                    tempTile.style.backgroundColor = "#fff1f2";
                }
                if (tempStat) tempStat.style.color = "#ef4444";
                if (tempSub) {
                    tempSub.style.color = "#b91c1c";
                    tempSub.style.fontWeight = "600";
                    tempSub.textContent = `↑ +${(tempVal - 8.0).toFixed(1)}°C over limit`;
                }
                if (statusBadge) {
                    statusBadge.className = "badge badge-critical";
                    statusBadge.style.background = "";
                    statusBadge.style.color = "";
                    statusBadge.textContent = "In Transit - High Alert";
                }
            } else if (isLow) {
                if (tempTile) {
                    tempTile.style.borderColor = "#bfdbfe";
                    tempTile.style.backgroundColor = "#eff6ff";
                }
                if (tempStat) tempStat.style.color = "#2563eb";
                if (tempSub) {
                    tempSub.style.color = "#1d4ed8";
                    tempSub.style.fontWeight = "600";
                    tempSub.textContent = `↓ ${(2.0 - tempVal).toFixed(1)}°C under min`;
                }
                if (statusBadge) {
                    statusBadge.className = "badge badge-critical";
                    statusBadge.style.background = "#dbeafe";
                    statusBadge.style.color = "#1d4ed8";
                    statusBadge.textContent = "In Transit - Freeze Risk";
                }
            } else {
                if (tempTile) {
                    tempTile.style.borderColor = "#e2e8f0";
                    tempTile.style.backgroundColor = "#f8fafc";
                }
                if (tempStat) tempStat.style.color = "#10b981";
                if (tempSub) {
                    tempSub.style.color = "#059669";
                    tempSub.style.fontWeight = "600";
                    tempSub.textContent = "✓ Safe Range (2°C - 8°C)";
                }
                if (statusBadge) {
                    statusBadge.className = "badge badge-online";
                    statusBadge.style.background = "";
                    statusBadge.style.color = "";
                    statusBadge.textContent = "In Transit - Normal";
                }
            }
        } else {
            if (tempTile) {
                tempTile.style.borderColor = "#e2e8f0";
                tempTile.style.backgroundColor = "#f8fafc";
            }
            if (tempStat) {
                tempStat.textContent = "--";
                tempStat.style.color = "#64748b";
            }
            if (tempSub) {
                tempSub.textContent = "No data recorded";
                tempSub.style.color = "#64748b";
            }
            if (humStat) humStat.textContent = "--";
            if (statusBadge) {
                statusBadge.className = "badge badge-offline";
                statusBadge.textContent = "No Data";
            }
        }

        if (nodeStat) nodeStat.textContent = device ? device.device_token : "N/A";
        if (nodeSub) nodeSub.textContent = device ? `● ${device.status || 'ACTIVE'}` : "Not Assigned";

        // Update Route info
        const originTitle = document.getElementById("v-route-origin-title");
        const originSub = document.getElementById("v-route-origin-sub");
        const destTitle = document.getElementById("v-route-dest-title");
        const destSub = document.getElementById("v-route-dest-sub");
        const routeCode = document.getElementById("v-route-code-tag");

        if (originTitle) originTitle.textContent = `Origin: ${detail.warehouse_name || 'Central Hub'}`;
        if (originSub) originSub.textContent = `Depot ID #${detail.warehouse_id || '1'} · Active Gate`;
        if (destTitle) destTitle.textContent = `Destination: Regional Distribution Point`;
        if (destSub) destSub.textContent = `Cold Chain Monitored Run`;
        if (routeCode) routeCode.textContent = `Route #TR-${detail.id.toString().padStart(3, '0')}`;

        // Update Chart Subtitle
        const chartTitle = document.getElementById("v-chart-title");
        const chartSubtitle = document.getElementById("v-chart-subtitle");
        if (chartTitle) chartTitle.textContent = `Vehicle ${detail.license_plate} - Temperature Profile`;

        if (history.length > 0) {
            const temps = history.map(h => parseFloat(h.temperature));
            const minT = Math.min(...temps);
            const maxT = Math.max(...temps);
            const breaches = history.filter(h => {
                const t = parseFloat(h.temperature);
                return t < 2.0 || t > 8.0;
            });

            if (breaches.length > 0) {
                if (chartSubtitle) {
                    chartSubtitle.innerHTML = `<span style="color:#ef4444; font-weight:600;">⚠️ ${breaches.length} excursion point(s) detected!</span> Min: ${minT.toFixed(1)}°C · Max: ${maxT.toFixed(1)}°C (${history.length} database readings)`;
                }
            } else {
                if (chartSubtitle) {
                    chartSubtitle.innerHTML = `<span style="color:#10b981; font-weight:600;">✓ All readings compliant</span> Min: ${minT.toFixed(1)}°C · Max: ${maxT.toFixed(1)}°C (${history.length} database readings)`;
                }
            }
        } else {
            if (chartSubtitle) {
                chartSubtitle.textContent = "No telemetry points found in database for this vehicle.";
            }
        }

        // Render Database Telemetry Chart
        renderVehicleProfileChart(detail.license_plate, history);

        // Render Telemetry Ping History Table
        renderPingHistoryTable(pings, device);

    } catch (err) {
        console.error("Error in selectVehicle:", err);
        showToast("Error retrieving vehicle telemetry: " + err.message, "error");
    }
}

function renderVehicleProfileChart(plate, history = []) {
    const ctx = document.getElementById("vehicleProfileChart");
    if (!ctx) return;

    if (vehicleProfileChart) {
        vehicleProfileChart.destroy();
        vehicleProfileChart = null;
    }

    if (!history || history.length === 0) {
        vehicleProfileChart = new Chart(ctx, {
            type: "line",
            data: {
                labels: ["No Data"],
                datasets: [{
                    label: "Reefer Temperature (°C)",
                    data: [0],
                    borderColor: "#cbd5e1",
                    borderDash: [5, 5],
                    fill: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: { enabled: false }
                },
                scales: {
                    y: { min: 0, max: 10 }
                }
            }
        });
        return;
    }

    // Format labels: HH:mm
    const labels = history.map((item, idx) => {
        const d = new Date(item.created_at);
        if (isNaN(d.getTime())) return `P${idx + 1}`;
        const h = String(d.getHours()).padStart(2, '0');
        const m = String(d.getMinutes()).padStart(2, '0');
        return `${h}:${m}`;
    });

    const temps = history.map(item => parseFloat(item.temperature));
    const hasBreach = temps.some(t => t > 8.0 || t < 2.0);

    // Calculate dynamic Y-axis min/max to fit database values accurately
    const minVal = Math.min(...temps, 2.0);
    const maxVal = Math.max(...temps, 8.0);
    const yMin = Math.floor(Math.min(minVal - 2, 0));
    const yMax = Math.ceil(Math.max(maxVal + 2, 10));

    vehicleProfileChart = new Chart(ctx, {
        type: "line",
        data: {
            labels: labels,
            datasets: [
                {
                    label: "Reefer Temperature (°C)",
                    data: temps,
                    borderColor: hasBreach ? "#ef4444" : "#2563eb",
                    backgroundColor: hasBreach ? "rgba(239, 68, 68, 0.08)" : "rgba(37, 99, 235, 0.08)",
                    borderWidth: 2.5,
                    tension: 0.3,
                    fill: true,
                    pointBackgroundColor: (context) => {
                        const val = context.raw;
                        if (val > 8.0) return "#ef4444"; // red for high breach
                        if (val < 2.0) return "#3b82f6"; // blue for freezing breach
                        return "#10b981"; // green for safe 2-8°C
                    },
                    pointBorderColor: "#ffffff",
                    pointBorderWidth: 2,
                    pointRadius: (context) => {
                        const val = context.raw;
                        return (val > 8.0 || val < 2.0) ? 6 : 4;
                    },
                    pointHoverRadius: 7
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
                    padding: 10,
                    callbacks: {
                        label: (ctx) => {
                            const val = ctx.parsed.y;
                            let note = "";
                            if (val > 8.0) note = " ⚠️ (Thermal Excursion High)";
                            else if (val < 2.0) note = " ❄️ (Freezing Excursion Low)";
                            else note = " ✓ (Safe Band: 2°C - 8°C)";
                            return ` Temp: ${val.toFixed(2)}°C${note}`;
                        },
                        afterLabel: (ctx) => {
                            const item = history[ctx.dataIndex];
                            if (item && item.humidity !== null && item.humidity !== undefined) {
                                return ` Humidity: ${parseFloat(item.humidity).toFixed(1)}%`;
                            }
                            return "";
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: "#64748b", font: { size: 11 } }
                },
                y: {
                    min: yMin,
                    max: yMax,
                    ticks: {
                        stepSize: yMax - yMin > 20 ? 4 : 2,
                        color: "#64748b",
                        callback: (v) => `${v}°C`
                    },
                    grid: {
                        color: (c) => (c.tick.value === 2 || c.tick.value === 8 ? "rgba(37,99,235,0.35)" : "rgba(226,232,240,0.6)"),
                        lineWidth: (c) => (c.tick.value === 2 || c.tick.value === 8 ? 2 : 1)
                    }
                }
            }
        }
    });
}

function renderPingHistoryTable(pings = [], device = null) {
    const tbody = document.getElementById("v-ping-history-tbody");
    if (!tbody) return;

    const nodeTag = document.getElementById("v-history-node-tag");
    if (nodeTag) {
        nodeTag.textContent = device ? `Device: ${device.device_token}` : "Device: Unassigned";
    }

    const countTag = document.getElementById("v-ping-count-tag");
    if (countTag) {
        countTag.textContent = `Showing last ${pings.length} sensor heartbeats from database`;
    }

    if (!pings || pings.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#94a3b8; padding:20px;">No telemetry history logged</td></tr>`;
        return;
    }

    tbody.innerHTML = pings.map(ping => {
        const temp = parseFloat(ping.temperature);
        const hum = ping.humidity !== null ? parseFloat(ping.humidity) : null;
        const d = new Date(ping.created_at);
        const timeStr = isNaN(d.getTime()) ? (ping.created_at || "--") : d.toLocaleTimeString();

        let tempClass = "temp-safe";
        let statusBadge = `<span class="badge badge-active">NOM</span>`;
        if (temp > 8.0) {
            tempClass = "temp-danger";
            statusBadge = `<span class="badge badge-critical">HIGH</span>`;
        } else if (temp < 2.0) {
            tempClass = "temp-danger";
            statusBadge = `<span class="badge badge-critical" style="background:#dbeafe; color:#1d4ed8; border:1px solid #bfdbfe;">LOW</span>`;
        }

        const devToken = ping.device_token || (device ? device.device_token : "DEV-NODE");

        return `
            <tr>
                <td style="${temp > 8.0 || temp < 2.0 ? 'color:#ef4444; font-weight:600;' : ''}">${timeStr}</td>
                <td><span class="temp-display ${tempClass}">${temp.toFixed(2)}°C</span></td>
                <td>${hum !== null ? hum.toFixed(1) + '%' : '--'}</td>
                <td class="cell-code">${devToken}</td>
                <td>${statusBadge}</td>
            </tr>
        `;
    }).join("");
}

function initVehicleFilters() {
    const searchInput = document.getElementById("veh-search-input");
    const pills = document.querySelectorAll(".filter-pills-row .pill-btn");

    pills.forEach(pill => {
        pill.addEventListener("click", () => {
            pills.forEach(p => p.classList.remove("active"));
            pill.classList.add("active");

            const filter = pill.getAttribute("data-filter");
            if (filter === "ALL") {
                renderVehicleNodes(allVehicles);
            } else if (filter === "TRANSIT") {
                renderVehicleNodes(allVehicles.filter(v => v.status === "ACTIVE"));
            } else if (filter === "IDLE") {
                renderVehicleNodes(allVehicles.filter(v => v.status !== "ACTIVE"));
            } else if (filter === "WARNING") {
                renderVehicleNodes(allVehicles.filter(v => {
                    if (v.temperature === null || v.temperature === undefined) return false;
                    const t = parseFloat(v.temperature);
                    return t < 2.0 || t > 8.0;
                }));
            }
        });
    });

    if (searchInput) {
        searchInput.addEventListener("input", (e) => {
            const query = e.target.value.trim().toLowerCase();
            const filtered = allVehicles.filter(v => v.license_plate.toLowerCase().includes(query));
            renderVehicleNodes(filtered);
        });
    }
}

function exportVehicleTelemetry() {
    if (window.Roles && !Roles.guard("export", "Staff accounts cannot export telemetry logs.")) return;
    showToast("Exporting fleet telemetry log to CSV...", "info");
    const headers = ["Vehicle ID", "License Plate", "Depot", "Status", "Current Temp", "Device Node"];
    const rows = allVehicles.map(v => [
        `"VEH-${v.id}"`,
        `"${v.license_plate}"`,
        `"${v.warehouse_name || 'Hanoi Hub'}"`,
        `"${v.status}"`,
        `"${v.temperature || '4.6'}°C"`,
        `"${v.device_token || 'DEV-001'}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const link = document.createElement("a");
    link.href = encodeURI(csvContent);
    link.download = `fleet_telemetry_${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
    showToast("Fleet telemetry log exported successfully!", "success");
}

// Modal Handlers & CRUD Logic for Vehicles
document.addEventListener("DOMContentLoaded", () => {
    // Add Vehicle Form Submit
    const addForm = document.getElementById("add-vehicle-form");
    if (addForm) {
        addForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const plate = document.getElementById("new-veh-plate").value.trim();
            const whId = document.getElementById("new-veh-wh").value;
            const status = document.getElementById("new-veh-status").value;

            if (!plate) {
                showToast("Please enter a license plate", "warning");
                return;
            }

            try {
                const res = await api.post("/vehicles", {
                    license_plate: plate,
                    warehouse_id: parseInt(whId, 10),
                    status: status
                });

                if (res.success) {
                    showToast(`Vehicle "${plate}" added successfully!`, "success");
                    closeAddVehicleModal();
                    await loadVehicles();
                    if (res.data) selectVehicle(res.data.id);
                } else {
                    showToast(res.message || "Failed to add vehicle", "error");
                }
            } catch (err) {
                showToast(err.message || "Error creating vehicle", "error");
            }
        });
    }

    // Edit Vehicle Form Submit
    const editForm = document.getElementById("edit-vehicle-form");
    if (editForm) {
        editForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const id = document.getElementById("edit-veh-id").value;
            const plate = document.getElementById("edit-veh-plate").value.trim();
            const whId = document.getElementById("edit-veh-wh").value;
            const status = document.getElementById("edit-veh-status").value;

            try {
                const res = await api.put(`/vehicles/${id}`, {
                    license_plate: plate,
                    warehouse_id: parseInt(whId, 10),
                    status: status
                });

                if (res.success) {
                    showToast(`Vehicle "${plate}" updated successfully!`, "success");
                    closeEditVehicleModal();
                    await loadVehicles();
                    selectVehicle(id);
                } else {
                    showToast(res.message || "Failed to update vehicle", "error");
                }
            } catch (err) {
                showToast(err.message || "Error updating vehicle", "error");
            }
        });
    }
});

window.openAddVehicleModal = function() {
    if (window.Roles && !Roles.guard("write", "Staff accounts can view fleet data only.")) return;
    const modal = document.getElementById("add-vehicle-modal");
    if (modal) {
        const form = document.getElementById("add-vehicle-form");
        if (form) form.reset();
        modal.classList.add("show");
    }
};

window.closeAddVehicleModal = function() {
    const modal = document.getElementById("add-vehicle-modal");
    if (modal) modal.classList.remove("show");
};

window.openEditVehicleModal = function(id) {
    if (window.Roles && !Roles.guard("write", "Staff accounts cannot edit vehicles.")) return;
    const veh = allVehicles.find(v => v.id == id);
    if (!veh) {
        showToast("Please select a vehicle to edit", "warning");
        return;
    }

    document.getElementById("edit-veh-id").value = veh.id;
    document.getElementById("edit-veh-plate").value = veh.license_plate;
    if (veh.warehouse_id) {
        document.getElementById("edit-veh-wh").value = veh.warehouse_id;
    }
    document.getElementById("edit-veh-status").value = veh.status || "ACTIVE";

    const modal = document.getElementById("edit-vehicle-modal");
    if (modal) modal.classList.add("show");
};

window.closeEditVehicleModal = function() {
    const modal = document.getElementById("edit-vehicle-modal");
    if (modal) modal.classList.remove("show");
};

window.confirmDeleteVehicle = async function(id) {
    if (window.Roles && !Roles.guard("delete", "Only administrators can delete fleet vehicles.")) return;
    const veh = allVehicles.find(v => v.id == id);
    const plate = veh ? veh.license_plate : `#${id}`;

    if (!confirm(`Are you sure you want to remove vehicle "${plate}" from the fleet?\nAll associated historical references will be preserved.`)) {
        return;
    }

    try {
        const res = await api.delete(`/vehicles/${id}`);
        if (res.success) {
            showToast(`Vehicle "${plate}" deleted successfully!`, "success");
            selectedVehicleId = null;
            await loadVehicles();
        } else {
            showToast(res.message || "Unable to delete vehicle", "error");
        }
    } catch (err) {
        showToast(err.message || "Server error while deleting vehicle", "error");
    }
};
