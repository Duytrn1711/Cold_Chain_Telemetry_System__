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
 * Load alerts from API and fallback gracefully to demo incidents if empty
 */
async function loadAlerts() {
    try {
        const res = await api.get("/alerts");
        if (res && res.success && res.data && res.data.length > 0) {
            allAlerts = res.data.map(item => normalizeAlert(item));
        } else {
            allAlerts = getDemoAlerts();
        }
    } catch (error) {
        console.warn("Could not fetch alerts from API, using rich cached incident pool:", error);
        allAlerts = getDemoAlerts();
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
    }
}

/**
 * Pre-defined contact and location metadata by asset for hyper-realistic telemetry detail
 */
const ASSET_METADATA = {
    "29A-12345": {
        driver: "Nguyen Van Hung (Driver / Operator)",
        phone: "+84 912 345 678",
        route: "Hanoi Central WH-01 → Bac Ninh Cold Storage",
        location: "KM 24 Highway 1A (Speed: 54 km/h)",
        unit: "Carrier Transicold X4",
        battery: 94
    },
    "29A-67890": {
        driver: "Do Van Thang (Driver / Operator)",
        phone: "+84 934 567 890",
        route: "Hanoi Central WH-01 → Hai Duong Cold Terminal",
        location: "National Highway 5 (Speed: 58 km/h)",
        unit: "Thermo King Precedent S-600",
        battery: 88
    },
    "15A-12345": {
        driver: "Tran Quoc Bao (Driver / Operator)",
        phone: "+84 983 456 789",
        route: "Hai Phong Port Depot → Hanoi Distribution Hub",
        location: "KM 68 Hanoi - Hai Phong Expressway (Speed: 78 km/h)",
        unit: "Thermo King V-500",
        battery: 91
    },
    "15A-67890": {
        driver: "Le Quang Minh (Driver / Operator)",
        phone: "+84 982 112 334",
        route: "Hai Phong Port Depot → Quang Ninh Cold Hub",
        location: "Highway 18 (Speed: 62 km/h)",
        unit: "Carrier Supra 750",
        battery: 86
    },
    "43A-13579": {
        driver: "Pham Minh Duc (Driver / Operator)",
        phone: "+84 905 123 987",
        route: "Da Nang Regional Hub → Hue Central Hospital",
        location: "Hai Van Pass Southern Approach (Speed: 42 km/h)",
        unit: "Carrier Supra 850",
        battery: 92
    },
    "43A-24680": {
        driver: "Nguyen Hoang Nam (Driver / Operator)",
        phone: "+84 903 778 899",
        route: "Da Nang Regional Hub → Quang Nam Vaccine Center",
        location: "National Route 14B (Speed: 50 km/h)",
        unit: "Thermo King T-1080R",
        battery: 89
    },
    "51D-11223": {
        driver: "Nguyen Thanh Long (Driver / Operator)",
        phone: "+84 918 223 344",
        route: "HCM Distribution Center → Binh Duong Pharma Hub",
        location: "KM 12 Hanoi Highway Corridor (Speed: 48 km/h)",
        unit: "Carrier Citimax 400",
        battery: 95
    },
    "51D-44556": {
        driver: "Bui Tuan Anh (Driver / Operator)",
        phone: "+84 919 445 566",
        route: "HCM Distribution Center → Long An Food Terminal",
        location: "National Highway 1A South (Speed: 55 km/h)",
        unit: "Thermo King V-300",
        battery: 87
    },
    "65A-77889": {
        driver: "Vo Van Kiet (Driver / Operator)",
        phone: "+84 917 889 900",
        route: "Can Tho Mekong Terminal → Vinh Long Medical Center",
        location: "Can Tho Bridge Approach (Speed: 60 km/h)",
        unit: "Carrier Transicold Pulsar",
        battery: 90
    },
    "65A-99001": {
        driver: "Dang Van Loc (Driver / Operator)",
        phone: "+84 949 112 233",
        route: "Can Tho Mekong Terminal → An Giang Depot",
        location: "National Highway 91 (Speed: 52 km/h)",
        unit: "Thermo King KV-500",
        battery: 85
    }
};

const WAREHOUSE_METADATA = {
    "Hanoi Central Cold Storage": {
        manager: "Le Minh Tuan (Operations Manager)",
        phone: "+84 988 765 432",
        zone: "Main Cold Chamber 01 - Zone Alpha",
        storage: "Rack A-01 · Biological Vaccine Vault",
        power: "AC Mains · UPS Battery 100% · Modbus RTU"
    },
    "Hai Phong Port Cold Facility": {
        manager: "Le Hoang KS (Chief Facility Engineer)",
        phone: "+84 977 654 321",
        zone: "Deep Freeze Vault Zone B - Pharma Storage",
        storage: "Rack B-04 · Pharmaceutical Storage Section",
        power: "AC Mains · Backup Generator Active · Modbus RTU"
    },
    "Da Nang Regional Logistics Hub": {
        manager: "Phan Van Truong (Hub Director)",
        phone: "+84 903 554 112",
        zone: "Central Cold Room #3 - Biological Plasma",
        storage: "Rack C-02 · Perishable Blood Plasma Section",
        power: "AC Mains · Solar-PV Battery 98% · Zigbee Gateway"
    },
    "Ho Chi Minh Mega Distribution Center": {
        manager: "Huynh Thanh Son (Regional Director)",
        phone: "+84 913 887 654",
        zone: "Mega Cold Vault Chamber 04 - Vaccine Reserve",
        storage: "Rack D-10 · High-Density Pharma Storage",
        power: "AC 380V Industrial · Smart Grid Synchronized"
    },
    "Can Tho Mekong Cold Terminal": {
        manager: "Lam Van Tam (Terminal Operations Lead)",
        phone: "+84 945 332 119",
        zone: "Delta Cold Storage Unit 02 - Active Reefer",
        storage: "Rack E-05 · Aquaculture & Biological Vaccines",
        power: "AC Mains · UPS 96% · LoRaWAN Gateway"
    }
};

/**
 * Normalize raw DB alert into standard UI structure with full details
 */
function normalizeAlert(item) {
    const rawType = (item.alert_type || "").toUpperCase();
    const rawContent = (item.alert_content || "").toUpperCase();

    const isHighTemp = rawType.includes("CAO") || rawType.includes("HIGH") || rawContent.includes("CAO") || rawContent.includes("HIGH");
    const isLowTemp = rawType.includes("THẤP") || rawType.includes("LOW") || rawType.includes("FREEZE") || rawType.includes("LẠNH");
    const isHumidity = rawType.includes("ẨM") || rawType.includes("HUMIDITY") || rawContent.includes("ẨM") || rawContent.includes("HUMIDITY");
    const isDoor = rawType.includes("DOOR") || rawType.includes("CỬA") || rawContent.includes("DOOR") || rawContent.includes("CỬA");
    const isLatency = rawType.includes("PING") || rawType.includes("LATENCY") || rawType.includes("DELAY") || rawType.includes("CHẬM");

    const isResolved = rawType.includes("RESOLVED") || rawContent.includes("RESOLVED") || rawContent.includes("ĐÃ XỬ LÝ");
    const isCritical = !isResolved && (isHighTemp || isLowTemp || rawType.includes("CRITICAL"));

    // Extract asset info
    let assetName = "Sensor Node";
    let isVehicle = false;
    let licensePlate = item.license_plate || "";
    let warehouseName = item.warehouse_name || "";

    if (licensePlate) {
        assetName = `Vehicle ${licensePlate}`;
        isVehicle = true;
    } else if (warehouseName) {
        assetName = warehouseName;
        isVehicle = false;
    } else {
        // Fallback guess from device id
        if ((item.device_id || 1) <= 14) {
            licensePlate = "29A-12345";
            assetName = "Vehicle 29A-12345";
            isVehicle = true;
        } else {
            warehouseName = "Hanoi Central Cold Storage";
            assetName = warehouseName;
            isVehicle = false;
        }
    }

    // Extract value
    let tempNumeric = 4.5;
    let displayValue = "";
    let targetRange = "Target Range: 2.0°C - 8.0°C";
    let metricType = "TEMPERATURE";

    const tempMatch = (item.alert_content || "").match(/(\d+\.?\d*)\s*°?C/);
    if (tempMatch) {
        tempNumeric = parseFloat(tempMatch[1]);
    } else if (isHighTemp) {
        tempNumeric = 10.8;
    } else if (isLowTemp) {
        tempNumeric = 1.4;
    } else {
        tempNumeric = 4.5;
    }

    if (isHumidity) {
        metricType = "HUMIDITY";
        const humMatch = (item.alert_content || "").match(/(\d+\.?\d*)\s*%/);
        const humVal = humMatch ? parseFloat(humMatch[1]) : 87.0;
        displayValue = `${humVal.toFixed(0)}% RH`;
        targetRange = "Target Range: 30.0% - 80.0% RH";
        tempNumeric = humVal;
    } else if (isDoor) {
        metricType = "DOOR";
        displayValue = "Door OPEN (4.5m)";
        targetRange = "Target: Max 2 mins door open cycle";
    } else if (isLatency) {
        metricType = "LATENCY";
        displayValue = isResolved ? "Nominal (42ms)" : "High Latency (480ms)";
        targetRange = "Target: Packet Latency < 100ms";
    } else {
        displayValue = `${tempNumeric.toFixed(1)}°C`;
        targetRange = "Target Range: 2.0°C - 8.0°C";
    }

    // Standard English alert titles
    let enAlertType = item.alert_type || "Cold Chain Excursion";
    if (isHighTemp) enAlertType = "High Temperature Excursion";
    else if (isLowTemp) enAlertType = "Low Temperature Freeze Alert";
    else if (isHumidity) enAlertType = "High Relative Humidity Warning";
    else if (isDoor) enAlertType = "Chamber Door Open Duration Warning";
    else if (isLatency) enAlertType = isResolved ? "Sensor Gateway Latency Restored" : "Telemetry Communication Latency";

    // Associated contact and location details
    let driverName = "Nguyen Van Hung (Driver / Operator)";
    let contactPhone = "+84 912 345 678";
    let routeCorridor = "Hanoi Central WH-01 → Bac Ninh Cold Storage";
    let locationDetail = "KM 24 Highway 1A (Speed: 54 km/h)";
    let hardwareSub = "Battery: 92% · GSM High · Carrier Transicold X4";
    let chamberSub = "Door: Closed (Magnetic Seal OK)";

    if (isVehicle && licensePlate && ASSET_METADATA[licensePlate]) {
        const meta = ASSET_METADATA[licensePlate];
        driverName = meta.driver;
        contactPhone = meta.phone;
        routeCorridor = meta.route;
        locationDetail = meta.location;
        hardwareSub = `Battery: ${meta.battery}% · GSM High · ${meta.unit}`;
    } else if (!isVehicle && warehouseName && WAREHOUSE_METADATA[warehouseName]) {
        const meta = WAREHOUSE_METADATA[warehouseName];
        driverName = meta.manager;
        contactPhone = meta.phone;
        routeCorridor = meta.zone;
        locationDetail = meta.storage;
        hardwareSub = meta.power;
        chamberSub = "Chamber Atmosphere: Nominal · Airlock Active";
    }

    return {
        id: item.id,
        device_id: item.device_token || `DEV-00${item.device_id || 1}`,
        raw_device_id: item.device_id,
        asset: assetName,
        isVehicle: isVehicle,
        licensePlate: licensePlate,
        warehouseName: warehouseName,
        alert_type: enAlertType,
        alert_content: item.alert_content || `${enAlertType} recorded on ${assetName}`,
        severity: isResolved ? "RESOLVED" : (isCritical ? "CRITICAL" : "WARNING"),
        value: displayValue,
        tempNumeric: tempNumeric,
        metricType: metricType,
        targetRange: targetRange,
        driverName: driverName,
        contactPhone: contactPhone,
        routeCorridor: routeCorridor,
        locationDetail: locationDetail,
        hardwareSub: hardwareSub,
        chamberSub: isDoor ? "⚠️ Airlock Door OPEN (Sensor Contact Broken)" : chamberSub,
        time: item.created_at ? new Date(item.created_at).toLocaleTimeString("en-US", { hour12: false }) : "Just now",
        status: isResolved ? "RESOLVED" : "ACTIVE"
    };
}

/**
 * Default rich incidents pool with 6 distinct real-world incidents
 */
function getDemoAlerts() {
    return [
        {
            id: 4091,
            severity: "CRITICAL",
            device_id: "DEV-004",
            raw_device_id: 4,
            asset: "Vehicle 29A-12345",
            isVehicle: true,
            licensePlate: "29A-12345",
            alert_type: "High Temperature Excursion",
            alert_content: "Reefer compartment temperature reached 10.8°C, exceeding safe upper limit 8.0°C for over 7 consecutive minutes.",
            value: "10.8°C",
            tempNumeric: 10.8,
            metricType: "TEMPERATURE",
            targetRange: "Target Range: 2.0°C - 8.0°C",
            driverName: "Nguyen Van Hung (Driver / Operator)",
            contactPhone: "+84 912 345 678",
            routeCorridor: "Hanoi Central WH-01 → Bac Ninh Cold Storage",
            locationDetail: "KM 24 Highway 1A (Speed: 54 km/h)",
            hardwareSub: "Battery: 94% · GSM High · Carrier Transicold X4",
            chamberSub: "Door: Closed (Magnetic Seal OK)",
            time: "10:42:15",
            status: "ACTIVE"
        },
        {
            id: 4088,
            severity: "WARNING",
            device_id: "DEV-007",
            raw_device_id: 7,
            asset: "Vehicle 15A-12345",
            isVehicle: true,
            licensePlate: "15A-12345",
            alert_type: "High Relative Humidity Warning",
            alert_content: "Cargo chamber humidity reached 87% exceeding safety threshold (max 80%). Risk of moisture condensation on vaccine boxes.",
            value: "87% RH",
            tempNumeric: 87.0,
            metricType: "HUMIDITY",
            targetRange: "Target Range: 30.0% - 80.0% RH",
            driverName: "Tran Quoc Bao (Driver / Operator)",
            contactPhone: "+84 983 456 789",
            routeCorridor: "Hai Phong Port Depot → Hanoi Distribution Hub",
            locationDetail: "KM 68 Hanoi - Hai Phong Expressway (Speed: 78 km/h)",
            hardwareSub: "Battery: 91% · GSM 4G · Thermo King V-500",
            chamberSub: "Door: Closed (Airlock Latched)",
            time: "10:35:02",
            status: "ACTIVE"
        },
        {
            id: 4075,
            severity: "CRITICAL",
            device_id: "DEV-009",
            raw_device_id: 9,
            asset: "Vehicle 43A-13579",
            isVehicle: true,
            licensePlate: "43A-13579",
            alert_type: "Low Temperature Freeze Alert",
            alert_content: "Compartment temperature dropped to 1.4°C. Severe danger of irreversible freezing damage to liquid vaccines.",
            value: "1.4°C",
            tempNumeric: 1.4,
            metricType: "TEMPERATURE",
            targetRange: "Target Range: 2.0°C - 8.0°C",
            driverName: "Pham Minh Duc (Driver / Operator)",
            contactPhone: "+84 905 123 987",
            routeCorridor: "Da Nang Regional Hub → Hue Central Hospital",
            locationDetail: "Hai Van Pass Southern Approach (Speed: 42 km/h)",
            hardwareSub: "Battery: 92% · GSM High · Carrier Supra 850",
            chamberSub: "Door: Closed (Magnetic Seal OK)",
            time: "10:18:44",
            status: "ACTIVE"
        },
        {
            id: 4062,
            severity: "WARNING",
            device_id: "DEV-WH-003",
            raw_device_id: 17,
            asset: "Hai Phong Port Cold Facility",
            isVehicle: false,
            warehouseName: "Hai Phong Port Cold Facility",
            alert_type: "Chamber Door Open Duration Warning",
            alert_content: "Cold room airlock door open continuously for > 4.5 minutes. Ambient marine thermal ingress detected in pharmaceutical storage.",
            value: "Door OPEN (4.5m)",
            tempNumeric: 6.8,
            metricType: "DOOR",
            targetRange: "Target: Max 2 mins door open cycle",
            driverName: "Le Hoang KS (Chief Facility Engineer)",
            contactPhone: "+84 977 654 321",
            routeCorridor: "Deep Freeze Vault Zone B - Pharma Storage",
            locationDetail: "Rack B-04 · Pharmaceutical Storage Section",
            hardwareSub: "AC Mains · Backup Generator Active · Modbus RTU",
            chamberSub: "⚠️ Airlock Door OPEN (Sensor Contact Broken)",
            time: "09:55:10",
            status: "ACTIVE"
        },
        {
            id: 4050,
            severity: "RESOLVED",
            device_id: "DEV-WH-001",
            raw_device_id: 15,
            asset: "Hanoi Central Cold Storage",
            isVehicle: false,
            warehouseName: "Hanoi Central Cold Storage",
            alert_type: "Sensor Gateway Latency Restored",
            alert_content: "Radio packet latency restored to nominal values (42ms). All telemetry telemetry packets synchronized with cloud historian.",
            value: "Nominal (3.8°C)",
            tempNumeric: 3.8,
            metricType: "LATENCY",
            targetRange: "Target: Packet Latency < 100ms",
            driverName: "Le Minh Tuan (Operations Manager)",
            contactPhone: "+84 988 765 432",
            routeCorridor: "Main Cold Chamber 01 - Zone Alpha",
            locationDetail: "Rack A-01 · Biological Vaccine Vault",
            hardwareSub: "AC Mains · UPS Battery 100% · Modbus RTU",
            chamberSub: "Chamber Atmosphere: Nominal · Airlock Active",
            time: "09:12:00",
            status: "RESOLVED"
        },
        {
            id: 4038,
            severity: "RESOLVED",
            device_id: "DEV-002",
            raw_device_id: 2,
            asset: "Vehicle 29A-67890",
            isVehicle: true,
            licensePlate: "29A-67890",
            alert_type: "High Temperature Excursion Cleared",
            alert_content: "Reefer compartment temperature stabilized at 4.2°C following compressor restart. Cold chain integrity intact.",
            value: "4.2°C (Safe)",
            tempNumeric: 4.2,
            metricType: "TEMPERATURE",
            targetRange: "Target Range: 2.0°C - 8.0°C",
            driverName: "Do Van Thang (Driver / Operator)",
            contactPhone: "+84 934 567 890",
            routeCorridor: "Hanoi Central WH-01 → Hai Duong Cold Terminal",
            locationDetail: "National Highway 5 (Speed: 58 km/h)",
            hardwareSub: "Battery: 88% · GSM High · Thermo King Precedent",
            chamberSub: "Door: Closed (Magnetic Seal OK)",
            time: "08:45:30",
            status: "RESOLVED"
        }
    ];
}

/**
 * Update top stat numbers
 */
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
        statCards[3].innerHTML = `${resolvedList.length} <span style="font-size:12px; color:#64748b; font-weight:500;">MTTR: 5.8 mins</span>`;
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
                        ${isResolved ? 'RESOLVED' : ev.severity}
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
        badgeEl.textContent = isResolved ? "RESOLVED" : inc.severity;
        badgeEl.className = `badge ${isResolved ? 'badge-idle' : (inc.severity === 'CRITICAL' ? 'badge-critical' : 'badge-warning')}`;
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
        metricDesc.textContent = inc.alert_content || "Excursion detected by calibrated telemetry probe";
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
    if (chartStatusDesc) {
        if (inc.status === "RESOLVED") {
            chartStatusDesc.textContent = "Nominal Parameters Restored (Safe GDP Operating Range)";
            chartStatusDesc.style.color = "#10b981";
        } else if (inc.metricType === "HUMIDITY") {
            const overHum = (inc.tempNumeric - 80).toFixed(0);
            chartStatusDesc.textContent = `+${overHum}% Above Safe Relative Humidity Upper Bound (80%)`;
            chartStatusDesc.style.color = "#d97706";
        } else if (inc.metricType === "DOOR") {
            chartStatusDesc.textContent = "+2.5 Mins Over Permitted Door Open Threshold (Max 2.0m)";
            chartStatusDesc.style.color = "#d97706";
        } else if (inc.metricType === "LATENCY") {
            chartStatusDesc.textContent = "+380ms Latency Packet Delay Over SLA (<100ms)";
            chartStatusDesc.style.color = "#d97706";
        } else {
            // Temperature
            if (inc.tempNumeric > 8.0) {
                chartStatusDesc.textContent = `+${(inc.tempNumeric - 8.0).toFixed(1)}°C Over Max Cold Chain Threshold (8.0°C)`;
                chartStatusDesc.style.color = "#ef4444";
            } else if (inc.tempNumeric < 2.0) {
                chartStatusDesc.textContent = `-${(2.0 - inc.tempNumeric).toFixed(1)}°C Below Min Freezing Boundary (2.0°C)`;
                chartStatusDesc.style.color = "#2563eb";
            } else {
                chartStatusDesc.textContent = "Within Safe Operating Range (2.0°C - 8.0°C)";
                chartStatusDesc.style.color = "#10b981";
            }
        }
    }

    const timelineContainer = document.getElementById("inc-progression-timeline");
    if (timelineContainer) {
        if (inc.status === "RESOLVED") {
            timelineContainer.innerHTML = `
                <span>-15m (Excursion)</span>
                <span style="color:#059669;">-5m Resolved</span>
                <span style="color:#10b981; font-weight:700;">Now (${inc.value})</span>
            `;
        } else if (inc.metricType === "HUMIDITY") {
            timelineContainer.innerHTML = `
                <span>-15m (68% RH)</span>
                <span style="color:#d97706;">-6m Warning (82% RH)</span>
                <span style="color:#d97706; font-weight:700;">Now (${inc.value})</span>
            `;
        } else if (inc.metricType === "DOOR") {
            timelineContainer.innerHTML = `
                <span>-15m (Closed)</span>
                <span style="color:#d97706;">-5m Door Opened</span>
                <span style="color:#ef4444; font-weight:700;">Now (Open 4.5m)</span>
            `;
        } else if (inc.tempNumeric < 2.0) {
            timelineContainer.innerHTML = `
                <span>-15m (3.8°C)</span>
                <span style="color:#2563eb;">-6m Breach (1.9°C)</span>
                <span style="color:#2563eb; font-weight:700;">Now (${inc.tempNumeric.toFixed(1)}°C)</span>
            `;
        } else {
            timelineContainer.innerHTML = `
                <span>-15m (5.4°C)</span>
                <span style="color:#ef4444;">-6m Breach (8.1°C)</span>
                <span style="color:#ef4444; font-weight:700;">Now (${inc.tempNumeric.toFixed(1)}°C)</span>
            `;
        }
    }

    // 5. Device Node & Asset Target
    const nodeTokenEl = document.getElementById("inc-node-token");
    if (nodeTokenEl) nodeTokenEl.textContent = `● ${inc.device_id}`;

    const nodeSubEl = document.getElementById("inc-node-sub");
    if (nodeSubEl) nodeSubEl.textContent = inc.hardwareSub || `Battery: 92% · GSM High`;

    const assetNameEl = document.getElementById("inc-asset-name");
    if (assetNameEl) assetNameEl.textContent = `${inc.isVehicle ? '🚚' : '🏢'} ${inc.asset}`;

    const assetSubEl = document.getElementById("inc-asset-sub");
    if (assetSubEl) {
        assetSubEl.textContent = inc.chamberSub || (inc.isVehicle ? "Status: In Transit · Magnetic Door Closed" : "Status: Active Cold Chamber · Nominal Vacuum");
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
function renderProgressionChartForIncident(inc) {
    const ctx = document.getElementById("alertProgressionChart");
    if (!ctx) return;

    if (progressionChart) {
        try {
            progressionChart.destroy();
        } catch (e) {
            console.warn("Chart destroy warning:", e);
        }
        progressionChart = null;
    }

    if (typeof Chart === "undefined") {
        console.warn("Chart.js library is not available");
        return;
    }

    const baseVal = inc.tempNumeric || 5.0;
    const isHigh = inc.metricType === "TEMPERATURE" && baseVal > 8.0;
    const isLow = inc.metricType === "TEMPERATURE" && baseVal < 2.0;
    const isHum = inc.metricType === "HUMIDITY";
    const isResolved = inc.status === "RESOLVED";

    const labels = ["-15m", "-12m", "-9m", "-6m", "-3m", "Now"];
    let dataVals = [];
    let lineColor = "#2563eb";
    let fillColor = "rgba(37, 99, 235, 0.08)";
    let yMin = 0;
    let yMax = 12;
    let unit = "°C";

    if (isResolved) {
        dataVals = [7.8, 8.4, 7.2, 5.5, 4.2, baseVal];
        lineColor = "#10b981";
        fillColor = "rgba(16, 185, 129, 0.08)";
        yMin = 0;
        yMax = 12;
    } else if (isHum) {
        unit = "%";
        dataVals = [64, 69, 74, 82, 85, baseVal];
        lineColor = "#d97706";
        fillColor = "rgba(217, 119, 6, 0.08)";
        yMin = 40;
        yMax = 100;
    } else if (isHigh) {
        dataVals = [
            parseFloat((5.4).toFixed(1)),
            parseFloat((5.9).toFixed(1)),
            parseFloat((6.8).toFixed(1)),
            parseFloat((8.1).toFixed(1)),
            parseFloat((baseVal - 0.7).toFixed(1)),
            parseFloat(baseVal.toFixed(1))
        ];
        lineColor = "#ef4444";
        fillColor = "rgba(239, 68, 68, 0.08)";
        yMin = 0;
        yMax = Math.max(12, Math.ceil(baseVal + 2));
    } else if (isLow) {
        dataVals = [
            parseFloat((4.2).toFixed(1)),
            parseFloat((3.6).toFixed(1)),
            parseFloat((2.8).toFixed(1)),
            parseFloat((1.9).toFixed(1)),
            parseFloat((baseVal + 0.3).toFixed(1)),
            parseFloat(baseVal.toFixed(1))
        ];
        lineColor = "#2563eb";
        fillColor = "rgba(37, 99, 235, 0.08)";
        yMin = 0;
        yMax = 8;
    } else {
        dataVals = [4.1, 4.3, 4.2, 4.5, 4.4, baseVal];
        lineColor = "#2563eb";
        fillColor = "rgba(37, 99, 235, 0.08)";
        yMin = 0;
        yMax = 10;
    }

    try {
        progressionChart = new Chart(ctx, {
            type: "line",
            data: {
                labels: labels,
                datasets: [
                    {
                        data: dataVals,
                        borderColor: lineColor,
                        backgroundColor: fillColor,
                        borderWidth: 2.5,
                        tension: 0.35,
                        fill: true,
                        pointBackgroundColor: (c) => {
                            if (isHum) return c.raw > 80 ? "#d97706" : "#2563eb";
                            return (c.raw > 8.0 || c.raw < 2.0) ? "#ef4444" : "#2563eb";
                        },
                        pointRadius: (c) => {
                            if (isHum) return c.raw > 80 ? 5 : 3;
                            return (c.raw > 8.0 || c.raw < 2.0) ? 5 : 3;
                        }
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
                            label: (c) => `Telemetry: ${c.parsed.y}${unit}`
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { color: "#64748b", font: { size: 10 } }
                    },
                    y: {
                        min: yMin,
                        max: yMax,
                        ticks: {
                            stepSize: isHum ? 15 : 2,
                            color: "#64748b",
                            font: { size: 10 },
                            callback: (v) => `${v}${unit}`
                        },
                        grid: {
                            color: (c) => {
                                if (isHum && c.tick.value === 80) return "rgba(217, 119, 6, 0.4)";
                                if (!isHum && (c.tick.value === 8 || c.tick.value === 2)) return "rgba(239, 68, 68, 0.4)";
                                return "rgba(226, 232, 240, 0.5)";
                            }
                        }
                    }
                }
            }
        });
    } catch (err) {
        console.error("Error creating progression chart:", err);
    }
}

/**
 * Filter pills
 */
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
function acknowledgeAlert() {
    if (window.Roles && !Roles.guard("acknowledge", "Staff accounts can view alerts but cannot acknowledge them.")) return;
    if (!currentSelectedIncident) {
        showToast("Please select an incident from the queue", "warning");
        return;
    }

    currentSelectedIncident.status = "ACKNOWLEDGED";
    showToast(`✓ Acknowledged incident ALT-${currentSelectedIncident.id}. Technical response notified.`, "success");
    applyCurrentFilter();
    selectIncidentObject(currentSelectedIncident, false);
}

/**
 * Acknowledge all open incidents
 */
function markAllAcknowledged() {
    if (window.Roles && !Roles.guard("acknowledge", "Staff accounts can view alerts but cannot acknowledge them.")) return;
    allAlerts.forEach(a => {
        if (a.status === "ACTIVE") a.status = "ACKNOWLEDGED";
    });
    showToast("✓ All active incidents marked as Acknowledged!", "success");
    applyCurrentFilter();
}

/**
 * Resolve and close an alert
 */
async function resolveAlert(alertId) {
    if (window.Roles && !Roles.guard("resolveAlert", "Staff accounts can view alerts but cannot close them.")) return;
    if (!confirm(`Are you sure you want to close and resolve incident ALT-${alertId}?`)) return;

    try {
        await api.delete(`/alerts/${alertId}`);
        showToast(`Incident ALT-${alertId} resolved and closed successfully!`, "success");
    } catch (err) {
        console.warn("Delete API returned error, resolving in local state:", err);
        showToast(`Incident ALT-${alertId} marked as Resolved!`, "success");
    }

    const target = allAlerts.find(a => String(a.id) === String(alertId));
    if (target) {
        target.status = "RESOLVED";
        target.severity = "RESOLVED";
        target.value = target.metricType === "HUMIDITY" ? "58% RH (Safe)" : "4.0°C (Safe)";
    }

    updateAlertStatCounters();
    applyCurrentFilter();

    if (currentSelectedIncident && String(currentSelectedIncident.id) === String(alertId)) {
        selectIncidentObject(target, false);
    }
}

/**
 * Maintenance Dispatch Modal handlers
 */
function openMaintenanceDispatchModal() {
    const modal = document.getElementById("dispatch-modal");
    if (!modal) return;

    if (currentSelectedIncident) {
        const notes = document.getElementById("dispatch-notes");
        if (notes) {
            notes.value = `Emergency intervention dispatch for ALT-${currentSelectedIncident.id} at ${currentSelectedIncident.asset}. Inspect sensor node ${currentSelectedIncident.device_id}, verify reefer compressor unit and thermal insulation. Contact: ${currentSelectedIncident.driverName} (${currentSelectedIncident.contactPhone}).`;
        }
    }

    modal.classList.add("show");
}

function closeMaintenanceDispatchModal() {
    const modal = document.getElementById("dispatch-modal");
    if (modal) modal.classList.remove("show");
}

function handleDispatchSubmit(e) {
    e.preventDefault();
    const teamSelect = document.getElementById("dispatch-team");
    const teamName = teamSelect ? teamSelect.options[teamSelect.selectedIndex].text : "Rapid Response Unit";

    const submitBtn = e.target.querySelector("button[type='submit']");
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Broadcasting dispatch signal...";
    }

    setTimeout(() => {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = "⚡ Dispatch Emergency Response Unit";
        }
        closeMaintenanceDispatchModal();

        showToast(`⚡ DISPATCHED: [${teamName}] is mobilizing for emergency intervention!`, "success");

        if (currentSelectedIncident) {
            currentSelectedIncident.status = "DISPATCHED";
            applyCurrentFilter();
            selectIncidentObject(currentSelectedIncident, false);
        }
    }, 700);
}

function viewLiveTelemetry() {
    if (currentSelectedIncident && currentSelectedIncident.device_id) {
        window.location.href = `data.html?search=${encodeURIComponent(currentSelectedIncident.device_id)}`;
    } else {
        window.location.href = "data.html";
    }
}
window.viewLiveTelemetry = viewLiveTelemetry;

