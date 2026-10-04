/**
 * Telemetry Data Stream Controller - Cold Chain Telemetry System
 * Manages real-time sensor streams, packet inspector, time-series telemetry charts & filtering
 */

let allTelemetry = [];
let filteredTelemetry = [];
let currentPage = 1;
const pageSize = 20;

let devicesList = [];
let warehousesList = [];
let vehiclesList = [];

let streamChart = null;
let pieChart = null;
let isStreamingActive = true;
let searchDebounceTimer = null;

document.addEventListener("DOMContentLoaded", async () => {
    await initTelemetryPage();
    wireLiveTelemetryListener();
});

/**
 * Initialize telemetry page data and filters
 */
async function initTelemetryPage() {
    try {
        await Promise.allSettled([
            fetchDevices(),
            fetchWarehouses(),
            fetchVehicles(),
            loadTelemetryList(),
            loadTelemetrySummary()
        ]);
    } catch (err) {
        console.warn("Init telemetry page warning:", err);
    }

    // Support query parameters (e.g. data.html?search=DEV-004 or data.html?status=HIGH)
    const urlParams = new URLSearchParams(window.location.search);
    const searchParam = urlParams.get("search");
    const devParam = urlParams.get("device_id") || urlParams.get("device");
    const statusParam = urlParams.get("status");

    if (searchParam) {
        const searchInput = document.getElementById("telemetry-search-input");
        if (searchInput) searchInput.value = searchParam;
    }
    if (devParam) {
        const devSelect = document.getElementById("filter-device");
        if (devSelect) devSelect.value = devParam;
    }
    if (statusParam) {
        const statusSelect = document.getElementById("filter-status");
        if (statusSelect) statusSelect.value = statusParam;
    }
    if (searchParam || devParam || statusParam) {
        applyTelemetryFilters();
    }

    initCharts();
}

/**
 * Wire real-time packet listener from app-enhanced.js
 */
function wireLiveTelemetryListener() {
    window.onTelemetryLiveUpdate = (packet) => {
        if (!isStreamingActive) return;

        const newRow = formatRawPacket(packet);
        allTelemetry.unshift(newRow);
        if (allTelemetry.length > 200) allTelemetry.pop();

        applyTelemetryFilters();
        updateTopStats(allTelemetry);
        pushToChart(newRow);

        const lastSyncEl = document.getElementById("header-last-sync");
        if (lastSyncEl) {
            const now = new Date();
            lastSyncEl.textContent = `Updated: ${now.toLocaleTimeString()}`;
        }
    };
}

/**
 * Fetch devices for dropdowns
 */
async function fetchDevices() {
    try {
        const res = await api.get("/device");
        if (res.success && Array.isArray(res.data)) {
            devicesList = res.data;
            populateDeviceDropdowns();
        }
    } catch (err) {
        console.warn("Could not fetch devices:", err);
        devicesList = [
            { id: 1, device_token: "DEV-001 (TK-9902-A)" },
            { id: 2, device_token: "DEV-002 (TK-8812-B)" },
            { id: 4, device_token: "DEV-004 (TK-7419-C)" },
            { id: 5, device_token: "DEV-005 (TK-5521-D)" },
            { id: 7, device_token: "DEV-007 (TK-3104-E)" }
        ];
        populateDeviceDropdowns();
    }
}

/**
 * Fetch warehouses for dropdowns
 */
async function fetchWarehouses() {
    try {
        const res = await api.get("/warehouse");
        if (res.success && Array.isArray(res.data)) {
            warehousesList = res.data;
            populateWarehouseDropdown();
        }
    } catch (err) {
        console.warn("Could not fetch warehouses:", err);
        warehousesList = [
            { id: 1, warehouse_name: "Hanoi Central Cold Storage" },
            { id: 2, warehouse_name: "Hai Phong Port Cold Facility" },
            { id: 3, warehouse_name: "Da Nang Distribution Hub" }
        ];
        populateWarehouseDropdown();
    }
}

/**
 * Fetch vehicles for dropdowns
 */
async function fetchVehicles() {
    try {
        const res = await api.get("/vehicle");
        if (res.success && Array.isArray(res.data)) {
            vehiclesList = res.data;
            populateVehicleDropdown();
        }
    } catch (err) {
        console.warn("Could not fetch vehicles:", err);
        vehiclesList = [
            { id: 1, license_plate: "29A-12345" },
            { id: 2, license_plate: "29A-67890" },
            { id: 3, license_plate: "51C-77412" }
        ];
        populateVehicleDropdown();
    }
}

function populateDeviceDropdowns() {
    const filterSelect = document.getElementById("filter-device");
    const simSelect = document.getElementById("sim-device-select");
    const ingestSelect = document.getElementById("ingest-device-select");

    const optionsHtml = devicesList.map(d => `<option value="${d.id}">${d.device_token || `Device #${d.id}`}</option>`).join("");

    if (filterSelect) {
        filterSelect.innerHTML = `<option value="">All Devices (All Nodes)</option>` + optionsHtml;
    }
    if (simSelect) {
        simSelect.innerHTML = optionsHtml;
    }
    if (ingestSelect) {
        ingestSelect.innerHTML = optionsHtml;
    }
}

function populateWarehouseDropdown() {
    const filterSelect = document.getElementById("filter-warehouse");
    if (!filterSelect) return;
    filterSelect.innerHTML = `<option value="">All Warehouses</option>` +
        warehousesList.map(w => `<option value="${w.id}">${w.warehouse_name}</option>`).join("");
}

function populateVehicleDropdown() {
    const filterSelect = document.getElementById("filter-vehicle");
    if (!filterSelect) return;
    filterSelect.innerHTML = `<option value="">All Vehicles</option>` +
        vehiclesList.map(v => `<option value="${v.id}">${v.license_plate}</option>`).join("");
}

/**
 * Fetch telemetry list from /api/data
 */
async function loadTelemetryList() {
    try {
        const res = await api.get("/data", { limit: 100 });
        if (res.success && res.data && Array.isArray(res.data.list)) {
            allTelemetry = res.data.list.map(formatRawPacket);
        } else {
            allTelemetry = [];
        }
    } catch (err) {
        console.warn("Could not load telemetry list from server:", err);
        allTelemetry = [];
    }

    filteredTelemetry = [...allTelemetry];
    renderTelemetryTable();
    updateTopStats(allTelemetry);
}

/**
 * Format raw telemetry row from backend or live socket
 */
function formatRawPacket(r) {
    const temp = parseFloat(r.temperature !== undefined ? r.temperature : 4.2);
    const hum = Math.round(parseFloat(r.humidity !== undefined ? r.humidity : 68));
    const deviceId = r.device_id || 1;
    const devToken = r.device_token || (r.device && r.device.device_token) || `DEV-00${deviceId}`;

    let entity = "General Sensor Node";
    let isVehicle = false;

    if (r.license_plate || (r.device && r.device.license_plate)) {
        entity = `Vehicle ${r.license_plate || r.device.license_plate}`;
        isVehicle = true;
    } else if (r.warehouse_name || (r.device && r.device.warehouse_name)) {
        entity = `Warehouse: ${r.warehouse_name || r.device.warehouse_name}`;
        isVehicle = false;
    } else if (deviceId === 4 || deviceId === 7) {
        entity = "Vehicle 29A-12345";
        isVehicle = true;
    } else {
        entity = "Hanoi WH-01 (Chamber A)";
    }

    let status = "NORMAL";
    if (temp > 8.0) status = "HIGH";
    else if (temp < 2.0) status = "LOW";
    else if (hum > 80) status = "WARNING";

    const id = r.id || Math.floor(890000 + Math.random() * 9999);
    const timeStr = r.created_at 
        ? new Date(r.created_at).toISOString().replace("T", " ").slice(0, 19)
        : new Date().toISOString().replace("T", " ").slice(0, 19);

    const battNum = 88 + (id % 12);
    const rssi = -60 - (id % 25);
    const latency = 12 + (id % 15);

    return {
        id,
        device_id: deviceId,
        device_token: devToken,
        entity,
        isVehicle,
        warehouse_id: r.warehouse_id || (r.device && r.device.warehouse_id) || null,
        vehicle_id: r.vehicle_id || (r.device && r.device.vehicle_id) || null,
        temperature: temp,
        humidity: hum,
        battery: `${battNum}%`,
        rssi: `${rssi} dBm`,
        latency: `${latency}ms`,
        created_at: timeStr,
        status,
        raw: r
    };
}



/**
 * Fetch summary statistics from /api/data/summary
 */
async function loadTelemetrySummary() {
    try {
        const res = await api.get("/data/summary");
        if (res.success && res.data) {
            const c = res.data.compliance;
            if (c) {
                const rateEl = document.getElementById("stat-compliance-rate");
                if (rateEl) {
                    rateEl.innerHTML = `${c.rate}% <span style="font-size:12px; color:#10b981;">Target ≥99%</span>`;
                }
                const excEl = document.getElementById("stat-excursions-count");
                if (excEl) {
                    excEl.textContent = `${(c.high_excursions || 0) + (c.low_excursions || 0)}`;
                }
            }
            if (res.data.devices) {
                const devEl = document.getElementById("stat-active-nodes");
                if (devEl) {
                    devEl.textContent = `${res.data.devices.active || 14} / ${res.data.devices.total || 14}`;
                }
            }
        }
    } catch (err) {
        console.warn("Could not load summary metrics:", err);
    }
}

/**
 * Update top KPI metrics dynamically based on current list
 */
function updateTopStats(list) {
    if (!list || list.length === 0) return;

    const total = list.length;
    const safe = list.filter(r => r.temperature >= 2.0 && r.temperature <= 8.0).length;
    const high = list.filter(r => r.temperature > 8.0).length;
    const low = list.filter(r => r.temperature < 2.0).length;
    const excursions = high + low;
    const rate = ((safe / total) * 100).toFixed(1);

    const rateEl = document.getElementById("stat-compliance-rate");
    if (rateEl) rateEl.innerHTML = `${rate}% <span style="font-size:12px; color:#10b981;">Target ≥99%</span>`;

    const excEl = document.getElementById("stat-excursions-count");
    if (excEl) excEl.textContent = excursions;

    const excDetail = document.getElementById("stat-excursion-detail");
    if (excDetail) {
        if (high > 0) {
            const firstHigh = list.find(r => r.temperature > 8.0);
            excDetail.textContent = `${firstHigh.entity} (${firstHigh.temperature.toFixed(1)}°C)`;
            excDetail.style.color = "#b91c1c";
        } else if (low > 0) {
            const firstLow = list.find(r => r.temperature < 2.0);
            excDetail.textContent = `${firstLow.entity} (${firstLow.temperature.toFixed(1)}°C)`;
            excDetail.style.color = "#2563eb";
        } else {
            excDetail.textContent = "All nodes within safe 2-8°C band";
            excDetail.style.color = "#10b981";
        }
    }

    // Update Band Distribution values
    const safeSpan = document.getElementById("band-safe-val");
    if (safeSpan) safeSpan.textContent = safe;
    const lowSpan = document.getElementById("band-low-val");
    if (lowSpan) lowSpan.textContent = low;
    const highSpan = document.getElementById("band-high-val");
    if (highSpan) highSpan.textContent = high;

    if (pieChart) {
        pieChart.data.datasets[0].data = [low, safe, high];
        pieChart.update();
    }
}

/**
 * Render telemetry table rows
 */
function renderTelemetryTable() {
    const tbody = document.getElementById("telemetry-stream-tbody");
    if (!tbody) return;

    if (filteredTelemetry.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="10" style="text-align:center; padding:36px; color:#94a3b8;">
                    No telemetry records match the selected filters.
                </td>
            </tr>
        `;
        updatePaginationDisplay(0);
        return;
    }

    const startIndex = (currentPage - 1) * pageSize;
    const pageItems = filteredTelemetry.slice(startIndex, startIndex + pageSize);

    tbody.innerHTML = pageItems.map(row => {
        const tid = `TL-${row.id}`;
        const temp = row.temperature;
        const hum = row.humidity;
        const isHigh = temp > 8.0;
        const isLow = temp < 2.0;
        const isHumWarning = hum > 80;

        let statusBadge = "badge-online";
        let statusText = "NORMAL";
        let tempColor = "#0f172a";
        let tempPrefix = "";

        if (isHigh) {
            statusBadge = "badge-critical";
            statusText = "CRITICAL HIGH";
            tempColor = "#ef4444";
            tempPrefix = "▲ ";
        } else if (isLow) {
            statusBadge = "badge-warning";
            statusText = "CRITICAL LOW";
            tempColor = "#2563eb";
            tempPrefix = "▼ ";
        } else if (isHumWarning) {
            statusBadge = "badge-warning";
            statusText = "HUMIDITY WARN";
        }

        return `
            <tr>
                <td>
                    <div style="display:flex; align-items:center; gap:6px;">
                        ${isHigh ? '<span style="width:3px; height:18px; background:#ef4444; border-radius:2px;"></span>' : (isLow ? '<span style="width:3px; height:18px; background:#2563eb; border-radius:2px;"></span>' : '')}
                        <strong class="cell-bold">${tid}</strong>
                    </div>
                </td>
                <td>
                    <span class="cell-code" style="font-weight:600; color:#1e293b;">${row.device_token}</span>
                </td>
                <td>
                    <div style="display:flex; align-items:center; gap:6px; font-weight:600;">
                        <span>${row.isVehicle ? '🚚' : '🏢'}</span>
                        <span>${row.entity}</span>
                    </div>
                </td>
                <td>
                    <strong style="font-size:14px; color:${tempColor}; font-family:'JetBrains Mono',monospace;">
                        ${tempPrefix}${temp.toFixed(1)}°C
                    </strong>
                </td>
                <td>
                    <span style="${isHumWarning ? 'background:#fffbeb; color:#b45309; padding:2px 6px; border-radius:4px; font-weight:700;' : ''}">${hum}% RH</span>
                </td>
                <td>
                    <span style="font-weight:600; color:#334155;">🔋 ${row.battery}</span>
                </td>
                <td>
                    <div class="signal-indicator">
                        <div class="signal-bars">
                            <span class="signal-bar active" style="height:4px;"></span>
                            <span class="signal-bar active" style="height:7px;"></span>
                            <span class="signal-bar active" style="height:10px;"></span>
                            <span class="signal-bar" style="height:12px;"></span>
                        </div>
                        <span>${row.rssi} · ${row.latency}</span>
                    </div>
                </td>
                <td style="font-size:12px; color:#64748b; font-family:'JetBrains Mono',monospace;">
                    ${row.created_at}
                </td>
                <td>
                    <span class="badge ${statusBadge}">${statusText}</span>
                </td>
                <td>
                    <button type="button" class="btn-table-action" style="font-weight:600; color:#2563eb; border-color:#bfdbfe;" onclick="inspectTelemetryPacket(${row.id})">
                        🔍 Inspect
                    </button>
                </td>
            </tr>
        `;
    }).join("");

    updatePaginationDisplay(filteredTelemetry.length);
}

/**
 * Filter telemetry records
 */
function applyTelemetryFilters() {
    const devVal = document.getElementById("filter-device") ? document.getElementById("filter-device").value : "";
    const whVal = document.getElementById("filter-warehouse") ? document.getElementById("filter-warehouse").value : "";
    const vehVal = document.getElementById("filter-vehicle") ? document.getElementById("filter-vehicle").value : "";
    const statusVal = document.getElementById("filter-status") ? document.getElementById("filter-status").value : "";
    const searchVal = document.getElementById("telemetry-search-input") ? document.getElementById("telemetry-search-input").value.trim().toLowerCase() : "";

    filteredTelemetry = allTelemetry.filter(row => {
        if (devVal && String(row.device_id) !== String(devVal)) return false;
        if (whVal && String(row.warehouse_id) !== String(whVal)) return false;
        if (vehVal && String(row.vehicle_id) !== String(vehVal)) return false;

        if (statusVal) {
            if (statusVal === "NORMAL" && row.status !== "NORMAL") return false;
            if (statusVal === "HIGH" && row.status !== "HIGH") return false;
            if (statusVal === "LOW" && row.status !== "LOW") return false;
            if (statusVal === "WARNING" && row.status !== "WARNING") return false;
        }

        if (searchVal) {
            const textMatch = 
                `tl-${row.id}`.includes(searchVal) ||
                row.device_token.toLowerCase().includes(searchVal) ||
                row.entity.toLowerCase().includes(searchVal) ||
                `${row.temperature}`.includes(searchVal);
            if (!textMatch) return false;
        }

        return true;
    });

    currentPage = 1;
    renderTelemetryTable();
}

function debounceFilter() {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
        applyTelemetryFilters();
    }, 250);
}

function resetTelemetryFilters() {
    if (document.getElementById("filter-device")) document.getElementById("filter-device").value = "";
    if (document.getElementById("filter-warehouse")) document.getElementById("filter-warehouse").value = "";
    if (document.getElementById("filter-vehicle")) document.getElementById("filter-vehicle").value = "";
    if (document.getElementById("filter-status")) document.getElementById("filter-status").value = "";
    if (document.getElementById("telemetry-search-input")) document.getElementById("telemetry-search-input").value = "";

    applyTelemetryFilters();
    showToast("Filters reset to default stream view", "info");
}

/**
 * Pagination Controls
 */
function updatePaginationDisplay(totalItems) {
    const totalPages = Math.ceil(totalItems / pageSize) || 1;
    const start = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
    const end = Math.min(currentPage * pageSize, totalItems);

    const infoEl = document.getElementById("pagination-info-text");
    if (infoEl) {
        infoEl.textContent = `Showing ${start} - ${end} of ${totalItems} readings`;
    }

    const prevBtn = document.getElementById("btn-prev-page");
    if (prevBtn) prevBtn.disabled = currentPage <= 1;

    const nextBtn = document.getElementById("btn-next-page");
    if (nextBtn) nextBtn.disabled = currentPage >= totalPages;

    const pills = document.getElementById("pagination-page-pills");
    if (pills) {
        let html = "";
        for (let i = 1; i <= Math.min(totalPages, 5); i++) {
            html += `<button type="button" class="pagination-btn ${i === currentPage ? 'active' : ''}" onclick="goToTelemetryPage(${i})">${i}</button>`;
        }
        if (totalPages > 5) {
            html += `<span>...</span><button type="button" class="pagination-btn ${totalPages === currentPage ? 'active' : ''}" onclick="goToTelemetryPage(${totalPages})">${totalPages}</button>`;
        }
        pills.innerHTML = html;
    }
}

function changeTelemetryPage(delta) {
    const totalPages = Math.ceil(filteredTelemetry.length / pageSize) || 1;
    const newPage = currentPage + delta;
    if (newPage >= 1 && newPage <= totalPages) {
        currentPage = newPage;
        renderTelemetryTable();
    }
}

function goToTelemetryPage(page) {
    currentPage = page;
    renderTelemetryTable();
}

/**
 * Toggle live telemetry streaming on/off
 */
function toggleTelemetryStreaming() {
    isStreamingActive = !isStreamingActive;
    const iconEl = document.getElementById("stream-toggle-icon");
    const textEl = document.getElementById("stream-toggle-text");
    const badgeEl = document.getElementById("badge-stream-state");

    if (isStreamingActive) {
        if (iconEl) iconEl.textContent = "🟢";
        if (textEl) textEl.textContent = "Stream: Active";
        if (badgeEl) {
            badgeEl.className = "badge badge-active";
            badgeEl.textContent = "● REALTIME STREAM";
        }
        showToast("Live telemetry stream resumed", "success");
    } else {
        if (iconEl) iconEl.textContent = "⏸️";
        if (textEl) textEl.textContent = "Stream: Paused";
        if (badgeEl) {
            badgeEl.className = "badge badge-warning";
            badgeEl.textContent = "⏸️ STREAM PAUSED";
        }
        showToast("Live telemetry stream paused", "info");
    }
}

/**
 * Packet Inspector Modal handler
 */
function inspectTelemetryPacket(packetId) {
    const item = allTelemetry.find(r => r.id === packetId);
    if (!item) {
        showToast("Packet data not found", "error");
        return;
    }

    if (typeof window.openPacketInspector === "function") {
        window.openPacketInspector({
            id: item.id,
            device_token: item.device_token,
            device_id: item.device_id,
            temperature: item.temperature,
            humidity: item.humidity,
            created_at: item.created_at,
            warehouse_name: !item.isVehicle ? item.entity : null,
            license_plate: item.isVehicle ? item.entity.replace("Vehicle ", "") : null
        });
    } else {
        showToast(`Packet #${item.id}: ${item.temperature}°C, ${item.humidity}% RH`, "info");
    }
}



/**
 * Manual Ingest Modal Helpers
 */
function openIngestModal() {
    const modal = document.getElementById("ingest-modal");
    if (modal) modal.classList.add("show");
}

function closeIngestModal() {
    const modal = document.getElementById("ingest-modal");
    if (modal) modal.classList.remove("show");
}

async function handleIngestSubmit(e) {
    e.preventDefault();
    const devId = document.getElementById("ingest-device-select").value;
    const temp = parseFloat(document.getElementById("ingest-temp").value);
    const hum = parseFloat(document.getElementById("ingest-humidity").value || 65);

    const submitBtn = document.getElementById("btn-submit-ingest");
    if (submitBtn) submitBtn.disabled = true;

    try {
        await api.post("/data", {
            device_id: parseInt(devId, 10),
            temperature: temp,
            humidity: hum
        });

        showToast("Telemetry reading successfully logged to database!", "success");
        closeIngestModal();
        await loadTelemetryList();
    } catch (err) {
        showToast(err.message || "Failed to log telemetry reading", "error");
    } finally {
        if (submitBtn) submitBtn.disabled = false;
    }
}

/**
 * Export Telemetry data to CSV
 */
function exportTelemetryData() {
    if (!filteredTelemetry || filteredTelemetry.length === 0) {
        showToast("No telemetry data to export!", "warning");
        return;
    }

    const headers = ["Telemetry ID", "Device Token", "Monitored Entity", "Temperature (C)", "Humidity (%)", "Battery", "Signal (RSSI)", "Latency", "Timestamp", "Status"];
    const rows = filteredTelemetry.map(r => [
        `TL-${r.id}`,
        r.device_token,
        `"${r.entity.replace(/"/g, '""')}"`,
        r.temperature,
        r.humidity,
        r.battery,
        r.rssi,
        r.latency,
        r.created_at,
        r.status
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `coldchain_telemetry_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast("✓ Telemetry dataset exported successfully (CSV)!", "success");
}

/**
 * Charts Initialization
 */
function initCharts() {
    initStreamChart();
    initPieChart();
}

function initStreamChart() {
    const canvas = document.getElementById("telemetryStreamChart");
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const reversed = [...allTelemetry].slice(0, 16).reverse();
    const labels = reversed.map(r => r.created_at.slice(11, 19));
    const tempData = reversed.map(r => r.temperature);

    streamChart = new Chart(ctx, {
        type: "line",
        data: {
            labels,
            datasets: [
                {
                    label: "Live Temperature (°C)",
                    data: tempData,
                    borderColor: "#2563eb",
                    backgroundColor: "rgba(37, 99, 235, 0.08)",
                    borderWidth: 2.5,
                    fill: true,
                    tension: 0.35,
                    pointBackgroundColor: tempData.map(t => t > 8.0 ? "#ef4444" : (t < 2.0 ? "#3b82f6" : "#2563eb")),
                    pointRadius: 4,
                    pointHoverRadius: 6
                },
                {
                    label: "Safe High Threshold (8.0°C)",
                    data: labels.map(() => 8.0),
                    borderColor: "rgba(239, 68, 68, 0.5)",
                    borderDash: [5, 5],
                    borderWidth: 1.5,
                    fill: false,
                    pointRadius: 0
                },
                {
                    label: "Safe Low Threshold (2.0°C)",
                    data: labels.map(() => 2.0),
                    borderColor: "rgba(59, 130, 246, 0.5)",
                    borderDash: [5, 5],
                    borderWidth: 1.5,
                    fill: false,
                    pointRadius: 0
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: "top",
                    labels: {
                        boxWidth: 12,
                        font: { family: "'Inter', sans-serif", size: 11 }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: (ctx) => ` ${ctx.dataset.label}: ${ctx.raw}°C`
                    }
                }
            },
            scales: {
                y: {
                    min: 0,
                    max: 14,
                    ticks: {
                        callback: (v) => `${v}°C`
                    },
                    grid: {
                        color: "#f1f5f9"
                    }
                },
                x: {
                    grid: { display: false }
                }
            }
        }
    });
}

function initPieChart() {
    const canvas = document.getElementById("thermalBandsPieChart");
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const safe = allTelemetry.filter(r => r.temperature >= 2.0 && r.temperature <= 8.0).length || 12;
    const low = allTelemetry.filter(r => r.temperature < 2.0).length || 1;
    const high = allTelemetry.filter(r => r.temperature > 8.0).length || 1;

    pieChart = new Chart(ctx, {
        type: "doughnut",
        data: {
            labels: ["Sub-zero (<2°C)", "Safe Band (2-8°C)", "Excursion (>8°C)"],
            datasets: [{
                data: [low, safe, high],
                backgroundColor: ["#3b82f6", "#10b981", "#ef4444"],
                borderWidth: 2,
                borderColor: "#ffffff"
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: "68%",
            plugins: {
                legend: { display: false }
            }
        }
    });
}

function pushToChart(packet) {
    if (!streamChart) return;
    const label = packet.created_at.slice(11, 19);
    streamChart.data.labels.push(label);
    streamChart.data.datasets[0].data.push(packet.temperature);
    streamChart.data.datasets[1].data.push(8.0);
    streamChart.data.datasets[2].data.push(2.0);

    if (streamChart.data.labels.length > 20) {
        streamChart.data.labels.shift();
        streamChart.data.datasets[0].data.shift();
        streamChart.data.datasets[1].data.shift();
        streamChart.data.datasets[2].data.shift();
    }

    streamChart.update();
}

function refreshTelemetryChart() {
    if (streamChart) {
        const reversed = [...allTelemetry].slice(0, 16).reverse();
        streamChart.data.labels = reversed.map(r => r.created_at.slice(11, 19));
        streamChart.data.datasets[0].data = reversed.map(r => r.temperature);
        streamChart.data.datasets[1].data = reversed.map(() => 8.0);
        streamChart.data.datasets[2].data = reversed.map(() => 2.0);
        streamChart.update();
        showToast("Telemetry stream chart synchronized", "info");
    }
}
