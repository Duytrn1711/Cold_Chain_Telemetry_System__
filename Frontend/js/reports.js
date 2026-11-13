/**
 * Cold Chain Reports & Compliance Analytics Controller
 * Manages GDP audits, excursion incident analysis, MKT calculations & document generation
 */

let summaryData = null;
let facilityAuditList = [];
let complianceTrendChart = null;
let rootCausePieChart = null;

document.addEventListener("DOMContentLoaded", async () => {
    initReportDates();
    await loadReportsData();
    initReportCharts();
});

/**
 * Initialize default dates in custom report modal
 */
function initReportDates() {
    const today = new Date().toISOString().slice(0, 10);
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

    const startInput = document.getElementById("rep-start-date");
    const endInput = document.getElementById("rep-end-date");
    if (startInput) startInput.value = sevenDaysAgo;
    if (endInput) endInput.value = today;
}

/**
 * Load data for reports dashboard from database
 */
async function loadReportsData(period = null) {
    try {
        const periodSelect = document.getElementById("report-period-select");
        const currentPeriod = period !== null ? period : (periodSelect ? periodSelect.value : "all");
        
        const res = await api.get("/data/reports", { period: currentPeriod });

        if (res && res.success && res.data) {
            const reportData = res.data;
            facilityAuditList = reportData.facilityAuditList || [];
            updateExecutiveKPIs(reportData.overall);
            renderFacilityAuditTable();
            return;
        }
    } catch (err) {
        console.error("Could not load reports data from /data/reports:", err);
    }
}

/**
 * Update top KPI cards
 */
function updateExecutiveKPIs(overall) {
    if (!overall) return;

    const rateEl = document.getElementById("kpi-compliance-rate");
    if (rateEl) {
        rateEl.textContent = overall.complianceRate == null ? "—" : `${overall.complianceRate.toFixed(1)}%`;
    }

    const excEl = document.getElementById("kpi-excursions-total");
    if (excEl) {
        excEl.textContent = overall.totalExcursions !== undefined ? overall.totalExcursions : 0;
    }

    const mktEl = document.getElementById("kpi-mkt-value");
    if (mktEl) {
        mktEl.textContent = overall.avgTemp == null ? "—" : `${overall.avgTemp.toFixed(1)}°C`;
    }

    const auditCountEl = document.getElementById("kpi-audit-count");
    if (auditCountEl) {
        auditCountEl.textContent = overall.compliantAuditCount !== undefined ? overall.compliantAuditCount : 0;
    }
}

/**
 * Render facility performance comparison table
 */
function renderFacilityAuditTable() {
    const tbody = document.getElementById("facility-audit-tbody");
    if (!tbody) return;

    if (!facilityAuditList || facilityAuditList.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="10" style="text-align:center; padding:36px; color:#94a3b8;">
                    No cold chain telemetry records found in database for the selected period.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = facilityAuditList.map(row => {
        const isCompliant = row.status === "COMPLIANT";
        const badgeClass = row.status === "NO DATA" ? "badge-neutral" : (isCompliant ? "badge-online" : "badge-critical");
        const rateColor = row.compliance == null ? "#64748b" : (row.compliance >= 98.0 ? "#10b981" : (row.compliance >= 95.0 ? "#f59e0b" : "#ef4444"));

        return `
            <tr>
                <td>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span>${row.isVehicle ? '🚚' : '🏢'}</span>
                        <strong style="color:#0f172a;">${row.name}</strong>
                    </div>
                </td>
                <td>
                    <span style="font-size:12px; color:#64748b;">${row.category}</span>
                </td>
                <td style="font-weight:600;">${row.sensors} Nodes</td>
                <td style="font-family:'JetBrains Mono',monospace; font-size:12px;">${row.readings.toLocaleString()}</td>
                <td>
                    <strong style="color:${rateColor}; font-size:13px; font-family:'JetBrains Mono',monospace;">
                        ${row.compliance == null ? "—" : `${row.compliance.toFixed(1)}%`}
                    </strong>
                </td>
                <td style="font-size:12px; font-family:'JetBrains Mono',monospace; color:#475569;">
                    ${row.minTemp == null ? "—" : `${row.minTemp.toFixed(1)}°C`} - <span style="color:${row.maxTemp > 8.0 ? '#ef4444' : '#475569'}; font-weight:${row.maxTemp > 8.0 ? '700' : '400'}">${row.maxTemp == null ? "—" : `${row.maxTemp.toFixed(1)}°C`}</span>
                </td>
                <td>
                    <span style="font-weight:700; color:${row.excursions > 0 ? '#ef4444' : '#10b981'};">
                        ${row.excursions}
                    </span>
                </td>
                <td style="font-family:'JetBrains Mono',monospace; font-size:12px;">
                    ${row.mkt == null ? "—" : `${row.mkt.toFixed(1)}°C`}
                </td>
                <td>
                    <span class="badge ${badgeClass}">${row.status}</span>
                </td>
                <td>
                    <div style="display:flex; gap:6px;">
                        <button type="button" class="btn-table-action" style="color:#2563eb; border-color:#bfdbfe;" onclick="downloadReportDoc('${row.name.replace(/\s+/g, '_')}_Audit', 'pdf')">
                            📄 PDF
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join("");
}

/**
 * Period Selector Change
 */
async function changeReportPeriod() {
    const period = document.getElementById("report-period-select").value;
    showToast(`Loading database records for period: ${period}...`, "info");
    await loadReportsData(period);
}

/**
 * Export table to CSV
 */
function exportFacilityAuditReport() {
    if (!facilityAuditList || facilityAuditList.length === 0) {
        showToast("No compliance audit records found to export", "warning");
        return;
    }

    const headers = ["Entity Name", "Category", "Sensors", "Total Readings", "Compliant Readings", "Compliance Rate (%)", "Min Temp (C)", "Max Temp (C)", "Excursions", "MKT (C)", "Audit Status"];
    const rows = facilityAuditList.map(r => [
        `"${r.name}"`,
        `"${r.category}"`,
        r.sensors,
        r.readings,
        r.compliant_readings !== undefined ? r.compliant_readings : "",
        r.compliance == null ? "" : r.compliance.toFixed(1),
        r.minTemp == null ? "" : r.minTemp.toFixed(1),
        r.maxTemp == null ? "" : r.maxTemp.toFixed(1),
        r.excursions,
        r.mkt == null ? "" : r.mkt.toFixed(1),
        `"${r.status}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `coldchain_facility_audit_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast("✓ Facility audit report downloaded (CSV)", "success");
}

/**
 * Download standard report documents
 */
function downloadReportDoc(docName, format) {
    if (format === "pdf") {
        if (typeof window.generateAuditCertificate === "function") {
            window.generateAuditCertificate(docName.replace(/_/g, " "));
        } else {
            showToast(`Generating print-ready PDF: ${docName}...`, "info");
        }
    } else if (format === "xlsx" || format === "csv") {
        const item = facilityAuditList.find(r => r.name.replace(/\s+/g, '_') === docName.replace(/_Audit$/, "")) || facilityAuditList[0];
        const rows = [
            ["Cold Chain Telemetry Management System - Official Audit Record"],
            [`Entity: ${item ? item.name : docName}`, `Category: ${item ? item.category : ''}`, `Date: ${new Date().toISOString()}`],
            ["Configured Temperature Range: 2.0°C - 8.0°C"],
            [`Compliance Rate: ${item ? item.compliance == null ? "N/A" : item.compliance.toFixed(1) + '%' : 'N/A'}`, `Audit Status: ${item ? item.status : 'N/A'}`],
            [`Total Readings: ${item ? item.readings : 0}`, `Excursions: ${item ? item.excursions : 0}`, `Average: ${item && item.mkt != null ? item.mkt.toFixed(1) + '°C' : 'N/A'}`],
            [`Sensor Nodes: ${item ? item.sensors : 0}`, `Recorded Range: ${item && item.minTemp != null ? item.minTemp.toFixed(1) + '°C to ' + item.maxTemp.toFixed(1) + '°C' : 'N/A'}`]
        ];

        const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.join(",")).join("\n");
        const link = document.createElement("a");
        link.setAttribute("href", encodeURI(csvContent));
        link.setAttribute("download", `${docName}_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        showToast(`✓ Document downloaded: ${docName}.csv`, "success");
    }
}

/**
 * Modal helpers for custom report generation
 */
function openGenerateReportModal() {
    const modal = document.getElementById("generate-report-modal");
    if (modal) modal.classList.add("show");
}

function closeGenerateReportModal() {
    const modal = document.getElementById("generate-report-modal");
    if (modal) modal.classList.remove("show");
}

function handleGenerateReportSubmit(e) {
    e.preventDefault();
    const type = document.getElementById("rep-type-select").value;
    const start = document.getElementById("rep-start-date").value;
    const end = document.getElementById("rep-end-date").value;
    const format = document.getElementById("rep-export-format").value;

    closeGenerateReportModal();
    showToast(`Compiling ${type} from ${start} to ${end}...`, "info");

    setTimeout(() => {
        downloadReportDoc(`${type}_${start}_${end}`, format);
        showToast("✓ Custom cold chain report successfully generated & downloaded!", "success");
    }, 800);
}

/**
 * Initialize Analytics Charts
 */
function initReportCharts() {
    initComplianceTrendChart();
    initRootCauseChart();
}

function initComplianceTrendChart() {
    const canvas = document.getElementById("complianceTrendChart");
    if (!canvas) return;
    complianceTrendChart = new Chart(canvas, {
        type: "bar",
        data: {
            labels: facilityAuditList.map(row => row.name),
            datasets: [
                { type: "bar", label: "Measured excursions", data: facilityAuditList.map(row => Number(row.excursions || 0)), backgroundColor: "rgba(239,68,68,0.65)" },
                { type: "line", label: "Measured compliance (%)", data: facilityAuditList.map(row => row.compliance), borderColor: "#10b981", spanGaps: false }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true }, x: { grid: { display: false } } } }
    });
}

function initRootCauseChart() {
    const canvas = document.getElementById("rootCausePieChart");
    if (!canvas) return;
    api.get("/alerts").then(response => {
        const counts = {};
        (Array.isArray(response.data) ? response.data : []).forEach(alert => {
            const label = alert.alert_type || "Unclassified";
            counts[label] = (counts[label] || 0) + 1;
        });
        rootCausePieChart = new Chart(canvas, {
            type: "doughnut",
            data: { labels: Object.keys(counts), datasets: [{ data: Object.values(counts), backgroundColor: ["#f59e0b", "#ef4444", "#3b82f6", "#94a3b8"], borderWidth: 2, borderColor: "#ffffff" }] },
            options: { responsive: true, maintainAspectRatio: false, cutout: "65%", plugins: { legend: { display: true } } }
        });
    }).catch(error => console.error("Could not load alert categories:", error));
}
