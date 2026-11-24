/**
 * Alerts & Incidents JavaScript - Cold Chain Telemetry System
 * Enterprise-grade incident response, real-time alert triage & dispatch
 * English language synchronized
 */

let allAlerts = [];
let progressionChart = null;
let currentSelectedIncident = null;
let activeFilter = "ALL";
let searchQuery = "";

document.addEventListener("DOMContentLoaded", async () => {
    initAlertFilters();
    initSOPChecklist();
    initSearchInput();

    await loadAlerts();

    // Listen to global live telemetry stream events
    window.onTelemetryLiveUpdate = (packet) => {
        if (packet.alertGenerated) {
            console.log("Telemetry triggered new excursion alert:", packet.alertGenerated);
            loadAlerts();
        }
    };
});

/**
 * Quick search listener
 */
function initSearchInput() {
    const searchInput = document.getElementById("top-search-input");
    if (searchInput) {
        searchInput.addEventListener("input", (e) => {
            searchQuery = e.target.value.trim().toLowerCase();
            applyCurrentFilter();
        });
    }
}

/**
 * Load alerts persisted by the API
 */
async function loadAlerts() {
    try {
        const res = await api.get("/alerts");
        allAlerts = res && res.success && Array.isArray(res.data) ? res.data.map(item => normalizeAlert(item)) : [];
    } catch (error) {
        console.error("Could not fetch alerts from API:", error);
        allAlerts = [];
    }

    updateAlertStatCounters();
    applyCurrentFilter();

    // Check if URL has a specific alert ID to inspect (e.g. from Dashboard or link)
    const urlParams = new URLSearchParams(window.location.search);
    const queryId = urlParams.get("id");

    if (allAlerts.length > 0) {
        let toSelect = null;
        if (queryId) {
            toSelect = allAlerts.find(a => String(a.id) === String(queryId));
        }
        if (!toSelect && currentSelectedIncident) {
            toSelect = allAlerts.find(a => String(a.id) === String(currentSelectedIncident.id));
        }
        if (!toSelect) {
            toSelect = allAlerts[0];
        }
        selectIncidentObject(toSelect, false);
    } else {
        currentSelectedIncident = null;
        clearIncidentPanel();
    }
}

/**
 * Pre-defined contact and location metadata by asset for hyper-realistic telemetry detail
 */
function normalizeAlert(item) {
    const rawType = String(item.alert_type || "Alert");
    const normalizedType = rawType.toUpperCase();
    const isHigh = normalizedType.includes("HIGH") || normalizedType.includes("CAO");
    const isLow = normalizedType.includes("LOW") || normalizedType.includes("THẤP");
    const isHumidity = normalizedType.includes("HUMIDITY") || normalizedType.includes("ẨM");
    const isResolved = item.status === "RESOLVED";
    const asset = item.license_plate ? `Vehicle ${item.license_plate}` : (item.warehouse_name || item.device_token || `Device #${item.device_id}`);
    const value = item.temperature === null || item.temperature === undefined ? "—" : `${Number(item.temperature).toFixed(1)}°C`;
    return {
        id: item.id,
        device_id: item.device_token || `Device #${item.device_id}`,
        raw_device_id: item.device_id,
        asset,
        isVehicle: Boolean(item.license_plate),
        licensePlate: item.license_plate || "",
        warehouseName: item.warehouse_name || "",
        alert_type: rawType,
        alert_content: item.alert_content || "",
        severity: isResolved ? "RESOLVED" : (isHigh || isLow ? "CRITICAL" : "WARNING"),
        value,
        tempNumeric: item.temperature === null || item.temperature === undefined ? null : Number(item.temperature),
        metricType: isHumidity ? "HUMIDITY" : "TEMPERATURE",
        targetRange: isHumidity ? "Recorded humidity alert" : "Temperature range: 2.0°C–8.0°C",
        driverName: "",
        contactPhone: "",
        routeCorridor: "",
        locationDetail: "",
        hardwareSub: "",
        chamberSub: "",
        time: item.created_at ? new Date(item.created_at).toLocaleString() : "—",
        status: item.status || (isResolved ? "RESOLVED" : "OPEN")
    };
}

function clearIncidentPanel() {
    ["inc-node-token", "inc-node-sub", "inc-asset-name", "inc-asset-sub", "inc-contact-name", "inc-contact-phone", "inc-location-type", "inc-location-detail", "inc-location-sub", "inc-chart-status-desc", "inc-records-count", "inc-metric-title", "inc-metric-desc", "inc-breach-temp", "inc-time-now"].forEach((id) => {
        const element = document.getElementById(id);
        if (element) element.textContent = "—";
    });
    if (progressionChart) {
        progressionChart.destroy();
        progressionChart = null;
    }
}
function updateAlertStatCounters() {
    const activeList = allAlerts.filter(a => a.status !== "RESOLVED");
    const criticalList = activeList.filter(a => a.severity === "CRITICAL");
    const warningList = activeList.filter(a => a.severity === "WARNING");
    const resolvedList = allAlerts.filter(a => a.status === "RESOLVED");

    const statCards = document.querySelectorAll(".stat-card-value");
    if (statCards.length >= 4) {
        statCards[0].innerHTML = `${activeList.length} <span style="font-size:12px; color:#2563eb; font-weight:600;">Requires attention</span>`;
        statCards[1].innerHTML = `${criticalList.length} <span style="font-size:12px; color:#b91c1c; font-weight:600;">&gt;8°C or &lt;2°C</span>`;
        statCards[2].innerHTML = `${warningList.length} <span style="font-size:12px; color:#b45309; font-weight:600;">Threshold proximity</span>`;
        statCards[3].innerHTML = `${resolvedList.length} <span style="font-size:12px; color:#64748b; font-weight:500;">Resolved alerts</span>`;
    }

    const breachCountBadge = document.getElementById("breach-counter-badge");
    if (breachCountBadge) {
        breachCountBadge.textContent = `● ${criticalList.length} Active Breach${criticalList.length > 1 ? 'es' : ''}`;
    }

    const countTag = document.getElementById("inc-records-count");
    if (countTag) {
        countTag.textContent = `(${allAlerts.length} Records)`;
    }
}

/**
 * Filter incident list
 */
function applyCurrentFilter() {
    let filtered = allAlerts;

    if (activeFilter === "EXCURSION") {
        filtered = filtered.filter(a => 
            a.alert_type.toLowerCase().includes("temp") || 
            a.alert_type.toLowerCase().includes("excursion") || 
            a.alert_type.toLowerCase().includes("freeze") ||
            a.severity === "CRITICAL"
        );
    } else if (activeFilter === "EQUIPMENT") {
        filtered = filtered.filter(a => 
            a.alert_type.toLowerCase().includes("humidity") || 
            a.alert_type.toLowerCase().includes("ping") || 
            a.alert_type.toLowerCase().includes("latency") || 
            a.alert_type.toLowerCase().includes("door") || 
            a.alert_type.toLowerCase().includes("sensor")
        );
    }

    if (searchQuery) {
        filtered = filtered.filter(a => 
            String(a.id).toLowerCase().includes(searchQuery) ||
            a.device_id.toLowerCase().includes(searchQuery) ||
            a.asset.toLowerCase().includes(searchQuery) ||
            a.alert_type.toLowerCase().includes(searchQuery) ||
            (a.alert_content && a.alert_content.toLowerCase().includes(searchQuery))
        );
    }

    renderAlertsQueue(filtered);
}

/**
 * Render table rows
 */
function renderAlertsQueue(list) {
    const tbody = document.getElementById("alerts-queue-tbody");
    if (!tbody) return;

    if (!list || list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:32px; color:#94a3b8;">No incidents matching current filter.</td></tr>`;
        return;
    }

    tbody.innerHTML = list.map((ev) => {
        const isCritical = ev.severity === "CRITICAL";
        const isWarning = ev.severity === "WARNING";
        const isResolved = ev.status === "RESOLVED";
        const isAcknowledged = ev.status === "ACKNOWLEDGED";

        let badgeClass = "badge-neutral";
        if (isResolved) badgeClass = "badge-idle";
        else if (isCritical) badgeClass = "badge-critical";
        else if (isWarning) badgeClass = "badge-warning";

        const isSelected = currentSelectedIncident && String(currentSelectedIncident.id) === String(ev.id);

        return `
            <tr data-alert-id="${ev.id}" onclick="selectIncidentById('${ev.id}')" class="${isSelected ? 'row-selected' : ''}">
                <td>
                    <span class="badge ${badgeClass}">
                        <span class="badge-dot"></span>
                        ${isResolved ? 'RESOLVED' : (isAcknowledged ? 'ACKNOWLEDGED' : ev.severity)}
                    </span>
                </td>
                <td class="cell-code" style="font-weight:600;">${ev.device_id}</td>
                <td>
                    <div style="display:flex; align-items:center; gap:6px; font-weight:600;">
                        <span>${ev.isVehicle ? '🚚' : '🏢'}</span>
                        <span>${ev.asset}</span>
                    </div>
                </td>
                <td style="color:${isCritical ? '#b91c1c' : '#334155'}; font-weight:600;">
                    ${ev.alert_type}
                    <div style="font-size:11px; color:#64748b; font-weight:400;">${ev.alert_content || ''}</div>
                </td>
                <td>
                    <strong style="color:${isCritical ? '#ef4444' : (isWarning ? '#d97706' : '#10b981')}; font-size:13px; font-family:'JetBrains Mono',monospace;">
                        ${ev.value}
                    </strong>
                </td>
                <td style="color:#64748b; font-size:12px; white-space:nowrap;">
                    ${ev.time}
                </td>
                <td style="white-space:nowrap;">
                    <div style="display:flex; align-items:center; gap:6px;">
                        <button type="button" class="btn-table-action btn-inspect" onclick="event.stopPropagation(); selectIncidentById('${ev.id}')" title="Inspect alert details">
                            🔍 Details
                        </button>
                        ${!isResolved && window.Roles && Roles.can("resolveAlert") ? `
                            <button type="button" class="btn-table-action" style="color:#059669; border-color:#a7f3d0;" onclick="event.stopPropagation(); resolveAlert('${ev.id}')" title="Resolve incident">
                                ✓
                            </button>
                        ` : ""}
                    </div>
                </td>
            </tr>
        `;
    }).join("");
}

/**
 * Handle incident selection by ID (accepts string or number)
 */
function selectIncidentById(alertId, shouldScroll = true) {
    const inc = allAlerts.find(a => String(a.id) === String(alertId));
    if (inc) {
        selectIncidentObject(inc, shouldScroll);

        // Update URL query string without reloading
        try {
            const url = new URL(window.location.href);
            url.searchParams.set("id", inc.id);
            window.history.replaceState({}, "", url.toString());
        } catch (e) {
            // ignore URL history errors if embedded
        }
    }
}
window.selectIncidentById = selectIncidentById;

/**
 * Update the complete detail panel for selected incident
 */
function selectIncidentObject(inc, shouldScroll = true) {
    if (!inc) return;
    currentSelectedIncident = inc;

    // 1. Highlight clicked row in table
    const tbody = document.getElementById("alerts-queue-tbody");
    if (tbody) {
        const rows = tbody.querySelectorAll("tr");
        rows.forEach(r => {
            const rowId = r.getAttribute("data-alert-id");
            if (rowId && String(rowId) === String(inc.id)) {
                r.classList.add("row-selected");
            } else {
                r.classList.remove("row-selected");
            }
        });
    }

    // 2. Incident ID & Badge & Header Icon
    const titleEl = document.getElementById("inc-detail-id");
    if (titleEl) titleEl.textContent = `Incident Details: ALT-${inc.id}`;

    const iconEl = document.getElementById("inc-detail-icon");
    if (iconEl) {
        if (inc.status === "RESOLVED") iconEl.textContent = "🛡️";
        else if (inc.severity === "CRITICAL") iconEl.textContent = "🛑";
        else iconEl.textContent = "⚠️";
    }

    const badgeEl = document.getElementById("inc-detail-badge");
    if (badgeEl) {
        const isResolved = inc.status === "RESOLVED";
        const isAcknowledged = inc.status === "ACKNOWLEDGED";
        badgeEl.textContent = isResolved ? "RESOLVED" : (isAcknowledged ? "ACKNOWLEDGED" : inc.severity);
        badgeEl.className = `badge ${isResolved || isAcknowledged ? 'badge-idle' : (inc.severity === 'CRITICAL' ? 'badge-critical' : 'badge-warning')}`;
    }
    const acknowledgeButton = document.getElementById("acknowledge-alert-btn");
    if (acknowledgeButton) {
        const isAcknowledged = inc.status === "ACKNOWLEDGED";
        const isResolved = inc.status === "RESOLVED";
        acknowledgeButton.disabled = isAcknowledged || isResolved;
        acknowledgeButton.textContent = isResolved ? "✓ Resolved" : (isAcknowledged ? "✓ Acknowledged" : "✓ Acknowledge Alert");
    }

    // 3. Metric Card Styling & Content
    const metricCard = document.getElementById("inc-metric-card");
    const metricNameEl = document.getElementById("inc-metric-name");
    const metricTitle = document.getElementById("inc-metric-title");
    const metricDesc = document.getElementById("inc-metric-desc");
    const breachTempEl = document.getElementById("inc-breach-temp");
    const metricRangeEl = document.getElementById("inc-metric-range");

    if (metricCard) {
        if (inc.status === "RESOLVED") {
            metricCard.style.background = "#f0fdf4";
            metricCard.style.borderColor = "#bbf7d0";
        } else if (inc.severity === "CRITICAL") {
            metricCard.style.background = "#fff1f2";
            metricCard.style.borderColor = "#fecaca";
        } else {
            metricCard.style.background = "#fffbeb";
            metricCard.style.borderColor = "#fde68a";
        }
    }

    if (metricNameEl) {
        if (inc.status === "RESOLVED") {
            metricNameEl.textContent = "STATUS AUDIT METRIC";
            metricNameEl.style.color = "#166534";
        } else if (inc.severity === "CRITICAL") {
            metricNameEl.textContent = "CRITICAL BREACH METRIC";
            metricNameEl.style.color = "#991b1b";
        } else {
            metricNameEl.textContent = "PROXIMITY WARNING METRIC";
            metricNameEl.style.color = "#92400e";
        }
    }

    if (metricTitle) {
        metricTitle.textContent = inc.alert_type;
        if (inc.status === "RESOLVED") metricTitle.style.color = "#15803d";
        else if (inc.severity === "CRITICAL") metricTitle.style.color = "#b91c1c";
        else metricTitle.style.color = "#b45309";
    }

    if (metricDesc) {
        metricDesc.textContent = inc.alert_content || "";
        if (inc.status === "RESOLVED") metricDesc.style.color = "#166534";
        else if (inc.severity === "CRITICAL") metricDesc.style.color = "#991b1b";
        else metricDesc.style.color = "#92400e";
    }

    if (breachTempEl) {
        breachTempEl.textContent = inc.value;
        if (inc.status === "RESOLVED") breachTempEl.style.color = "#10b981";
        else if (inc.severity === "CRITICAL") breachTempEl.style.color = "#ef4444";
        else breachTempEl.style.color = "#d97706";
    }

    if (metricRangeEl) {
        metricRangeEl.textContent = inc.targetRange || "Target Range: 2.0°C - 8.0°C";
    }

    // 4. Chart Description & Timeline
    const chartStatusDesc = document.getElementById("inc-chart-status-desc");
    if (chartStatusDesc) chartStatusDesc.textContent = inc.tempNumeric === null ? "This alert has no numeric reading stored." : `${inc.metricType === "HUMIDITY" ? "Humidity" : "Temperature"} reading: ${inc.value}`;
    const timelineContainer = document.getElementById("inc-progression-timeline");
    if (timelineContainer) timelineContainer.textContent = inc.created_at || inc.time || "Recorded alert event";
    // 5. Device Node & Asset Target
    const nodeTokenEl = document.getElementById("inc-node-token");
    if (nodeTokenEl) nodeTokenEl.textContent = `● ${inc.device_id}`;

    const nodeSubEl = document.getElementById("inc-node-sub");
    if (nodeSubEl) nodeSubEl.textContent = inc.hardwareSub || "No additional device telemetry stored.";

    const assetNameEl = document.getElementById("inc-asset-name");
    if (assetNameEl) assetNameEl.textContent = `${inc.isVehicle ? '🚚' : '🏢'} ${inc.asset}`;

    const assetSubEl = document.getElementById("inc-asset-sub");
    if (assetSubEl) {
        assetSubEl.textContent = inc.chamberSub || "No additional asset status stored.";
        if (inc.chamberSub && inc.chamberSub.includes("OPEN")) {
            assetSubEl.style.color = "#dc2626";
        } else {
            assetSubEl.style.color = "#10b981";
        }
    }

    // 6. Contact Info
    const contactNameEl = document.getElementById("inc-contact-name");
    const contactPhoneEl = document.getElementById("inc-contact-phone");
    if (contactNameEl && contactPhoneEl) {
        contactNameEl.innerHTML = `👤 <strong>${inc.driverName}</strong>`;
        contactPhoneEl.textContent = `📞 ${inc.contactPhone}`;
        contactPhoneEl.href = `tel:${inc.contactPhone.replace(/\s+/g, '')}`;
    }

    // 7. Location / Corridor Info
    const locTypeEl = document.getElementById("inc-location-type");
    const locDetailEl = document.getElementById("inc-location-detail");
    const locSubEl = document.getElementById("inc-location-sub");
    if (locTypeEl && locDetailEl && locSubEl) {
        locTypeEl.innerHTML = inc.isVehicle ? `📍 <strong>TRANSIT CORRIDOR</strong>` : `📍 <strong>FACILITY STORAGE ZONE</strong>`;
        locDetailEl.textContent = inc.routeCorridor;
        locSubEl.textContent = inc.locationDetail;
    }

    // 8. Dynamic SOP Recommendations
    const sop1 = document.getElementById("sop-label-1");
    const sop2 = document.getElementById("sop-label-2");
    const sop3 = document.getElementById("sop-label-3");
    const sopCb1 = document.getElementById("sop-1");
    const sopCb2 = document.getElementById("sop-2");
    const sopCb3 = document.getElementById("sop-3");

    if (sop1 && sop2 && sop3) {
        if (inc.status === "RESOLVED") {
            sop1.textContent = "1. Confirm automated telemetry sensor handshake and ISO audit trail log entry.";
            sop2.textContent = "2. Verify internal cold chain documentation and sign off quality checkpoint.";
            sop3.textContent = "3. Technical order closed. Archive incident report into GDP compliance dossier.";
            if (sopCb1) sopCb1.checked = true;
            if (sopCb2) sopCb2.checked = true;
            if (sopCb3) sopCb3.checked = true;
        } else if (inc.metricType === "HUMIDITY") {
            sop1.textContent = "1. Instruct driver / floor operator to verify dehumidifier condensation drain cycle.";
            sop2.textContent = "2. Check silica desiccant pouches inside pharmaceutical cargo packaging crates.";
            sop3.textContent = "3. Schedule humidity capacitive probe calibration upon arrival at destination depot.";
            if (sopCb1) sopCb1.checked = false;
            if (sopCb2) sopCb2.checked = true;
            if (sopCb3) sopCb3.checked = false;
        } else if (inc.metricType === "DOOR") {
            sop1.textContent = "1. Contact facility floor personnel to physically inspect airlock roll-up door seal.";
            sop2.textContent = "2. Verify air curtain blower velocity across cold chamber entryway.";
            sop3.textContent = "3. Check loading dock security camera feed for physical cargo blockage.";
            if (sopCb1) sopCb1.checked = false;
            if (sopCb2) sopCb2.checked = false;
            if (sopCb3) sopCb3.checked = false;
        } else if (inc.tempNumeric < 2.0) {
            sop1.textContent = "1. Contact operator immediately to adjust reefer setpoint away from freezing limit (<2°C).";
            sop2.textContent = "2. Check evaporator airflow baffle vents to prevent localized cold-pocket frost formation.";
            sop3.textContent = "3. Verify liquid state of vaccine vials upon delivery (Ensure zero crystallization).";
            if (sopCb1) sopCb1.checked = false;
            if (sopCb2) sopCb2.checked = true;
            if (sopCb3) sopCb3.checked = false;
        } else {
            // High temp
            sop1.textContent = `1. Contact ${inc.driverName} immediately to verify reefer refrigeration compressor unit.`;
            sop2.textContent = `2. Verify thermal insulation and door magnetic sensor (${inc.chamberSub || 'Door CLOSED'}).`;
            sop3.textContent = `3. Prepare secondary active cooling transfer at destination hub if excursion > 15 mins.`;
            if (sopCb1) sopCb1.checked = false;
            if (sopCb2) sopCb2.checked = true;
            if (sopCb3) sopCb3.checked = false;
        }
    }

    // 9. Re-render Progression Chart
    renderProgressionChartForIncident(inc);

    // 10. Visual Pulse Animation on Detail Panel
    const panel = document.getElementById("incident-detail-panel");
    if (panel) {
        panel.classList.remove("panel-highlight-anim");
        void panel.offsetWidth; // Reflow
        panel.classList.add("panel-highlight-anim");

        // Scroll to detail panel smoothly on mobile / small screen layouts
        if (shouldScroll && window.innerWidth <= 1200) {
            panel.scrollIntoView({ behavior: "smooth", block: "start" });
        }
    }
}

/**
 * Progression curve chart for selected incident
 */
function renderProgressionChartForIncident(incident) {
    const canvas = document.getElementById("alertProgressionChart");
    if (!canvas) return;
    if (progressionChart) progressionChart.destroy();
    progressionChart = null;
    if (!incident || incident.tempNumeric === null || !Number.isFinite(incident.tempNumeric) || typeof Chart === "undefined") return;
    const label = incident.metricType === "HUMIDITY" ? "% RH" : "°C";
    progressionChart = new Chart(canvas, {
        type: "scatter",
        data: { datasets: [{ label: "Recorded alert reading", data: [{ x: incident.time, y: incident.tempNumeric }], backgroundColor: incident.severity === "CRITICAL" ? "#ef4444" : "#f59e0b", pointRadius: 6 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (context) => `${context.parsed.y}${label}` } } }, scales: { x: { type: "category" }, y: { ticks: { callback: (value) => `${value}${label}` } } } }
    });
}
function initAlertFilters() {
    const pills = document.querySelectorAll(".filter-pills-row .pill-btn");
    pills.forEach(pill => {
        pill.addEventListener("click", () => {
            pills.forEach(p => p.classList.remove("active"));
            pill.classList.add("active");
            activeFilter = pill.getAttribute("data-filter") || "ALL";
            applyCurrentFilter();
        });
    });
}

function initSOPChecklist() {
    const checkboxes = document.querySelectorAll(".sop-item input[type='checkbox']");
    checkboxes.forEach(cb => {
        cb.addEventListener("change", () => {
            if (cb.checked) {
                const label = cb.parentElement.querySelector("span") ? cb.parentElement.querySelector("span").textContent.trim() : "SOP Checkpoint";
                showToast(`Completed SOP step: ${label.slice(0, 45)}...`, "info");
            }
        });
    });
}



/**
 * Acknowledge incident
 */
async function acknowledgeAlert() {
    if (window.Roles && !Roles.guard("acknowledge", "Staff accounts can view alerts but cannot acknowledge them.")) return;
    if (!currentSelectedIncident) {
        showToast("Please select an incident from the queue", "warning");
        return;
    }

    try {
        const alertId = currentSelectedIncident.id;
        const response = await api.request(`/alerts/${alertId}/status`, { method: "PATCH", body: JSON.stringify({ status: "ACKNOWLEDGED" }) });
        if (!response.success) throw new Error(response.message || "Could not acknowledge alert");
        await loadAlerts();
        showToast(`Alert #${alertId} acknowledged and saved.`, "success");
    } catch (error) {
        showToast(error.message || "Could not acknowledge alert", "error");
    }
}

/**
 * Acknowledge all open incidents
 */
async function markAllAcknowledged() {
    if (window.Roles && !Roles.guard("acknowledge", "Staff accounts can view alerts but cannot acknowledge them.")) return;
    const button = document.getElementById("acknowledge-all-btn");
    if (button) button.disabled = true;
    try {
        const response = await api.request("/alerts/acknowledge-all", { method: "POST", body: JSON.stringify({}) });
        if (!response.success) throw new Error(response.message || "Could not acknowledge alerts");
        await loadAlerts();
        showToast(response.message || `Đã xác nhận ${response.data?.acknowledged_count || 0} cảnh báo đang mở`, "success");
    } catch (error) {
        showToast(error.message || "Could not acknowledge alerts", "error");
    } finally {
        if (button) button.disabled = false;
    }
}

/**
 * Resolve and close an alert
 */
async function resolveAlert(alertId) {
    if (window.Roles && !Roles.guard("resolveAlert", "Staff accounts can view alerts but cannot close them.")) return;
    if (!confirm(`Are you sure you want to close and resolve incident ALT-${alertId}?`)) return;

    try {
        const response = await api.request(`/alerts/${alertId}/status`, { method: "PATCH", body: JSON.stringify({ status: "RESOLVED" }) });
        if (!response.success) throw new Error(response.message || "Could not resolve alert");
        await loadAlerts();
        showToast(`Alert #${alertId} resolved and saved.`, "success");
    } catch (err) {
        showToast(err.message || "Could not resolve alert", "error");
    }
}

function viewLiveTelemetry() {
    if (currentSelectedIncident && currentSelectedIncident.device_id) {
        window.location.href = `data.html?search=${encodeURIComponent(currentSelectedIncident.device_id)}`;
    } else {
        window.location.href = "data.html";
    }
}
window.viewLiveTelemetry = viewLiveTelemetry;

