/**
 * Unified sidebar + role-based access (ADMIN > MANAGER > STAFF)
 */
const Roles = {
    RANK: { STAFF: 1, USER: 1, OPERATOR: 1, MANAGER: 2, ADMIN: 3 },

    current() {
        const user = (typeof api !== "undefined" && api.getCurrentUser) ? api.getCurrentUser() : null;
        return this.normalize(user && user.role);
    },

    normalize(role) {
        const raw = String(role || "STAFF").toUpperCase();
        if (raw === "ADMIN") return "ADMIN";
        if (raw === "MANAGER") return "MANAGER";
        return "STAFF";
    },

    rank(role) {
        return this.RANK[this.normalize(role)] || 1;
    },

    label(role) {
        const key = this.normalize(role);
        if (key === "ADMIN") return "Administrator";
        if (key === "MANAGER") return "Operations Manager";
        return "Staff";
    },

    initials(user) {
        const name = (user && (user.full_name || user.username)) || "U";
        const parts = String(name).trim().split(/\s+/);
        if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    },

    can(action) {
        const r = this.rank(this.current());
        switch (action) {
            case "view":
                return r >= 1;
            case "export":
            case "write":
            case "resolveAlert":
            case "acknowledge":
                return r >= 2;
            case "delete":
            case "settings":
            case "admin":
                return r >= 3;
            default:
                return r >= 3;
        }
    },

    guard(action, message) {
        if (this.can(action)) return true;
        if (typeof showToast === "function") {
            showToast(message || "Your role does not have permission for this action.", "warning");
        }
        return false;
    },

    isSubpage() {
        return window.location.pathname.includes("/pages/");
    },

    href(page) {
        const sub = this.isSubpage();
        if (page === "dashboard") return sub ? "../dashboard.html" : "dashboard.html";
        return sub ? `${page}.html` : `pages/${page}.html`;
    },

    activeKey() {
        const path = window.location.pathname.toLowerCase();
        if (path.includes("warehouse")) return "warehouses";
        if (path.includes("vehicle")) return "vehicles";
        if (path.includes("device")) return "devices";
        if (path.includes("data") || path.includes("telemetry")) return "data";
        if (path.includes("report")) return "reports";
        if (path.includes("alert")) return "alerts";
        return "dashboard";
    },

    icon(name) {
        const icons = {
            brand: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="2" x2="12" y2="22"></line><line x1="2" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line><line x1="19.07" y1="4.93" x2="4.93" y2="19.07"></line></svg>',
            dashboard: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>',
            warehouses: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>',
            vehicles: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>',
            devices: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9"></path><path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5"></path><circle cx="12" cy="12" r="2"></circle><path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5"></path><path d="M19.1 4.9C23 8.8 23 15.1 19.1 19"></path></svg>',
            data: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>',
            telemetry: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>',
            alerts: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>',
            reports: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>',
            settings: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>',
            logout: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>'
        };
        return icons[name] || "";
    },

    navItem(key, href, label, extra = "") {
        const active = this.activeKey() === key ? " active" : "";
        return `
            <li class="nav-item${active}">
                <a href="${href}">
                    <div class="nav-link-content">
                        ${this.icon(key)}
                        <span>${label}</span>
                    </div>
                    ${extra}
                </a>
            </li>
        `;
    },

    renderSidebar() {
        const aside = document.querySelector("aside.sidebar");
        if (!aside) return;

        const user = api.getCurrentUser() || { full_name: "User", role: "STAFF", username: "staff" };

        aside.innerHTML = `
            <div class="sidebar-brand">
                <div class="brand-icon">${this.icon("brand")}</div>
                <div class="brand-text">
                    <h1>Cold Chain</h1>
                    <span>TELEMETRY MANAGEMENT</span>
                </div>
            </div>
            <nav class="sidebar-nav">
                <div class="nav-section-title">MAIN</div>
                <ul class="nav-list">
                    ${this.navItem("dashboard", this.href("dashboard"), "Dashboard")}
                    ${this.navItem("warehouses", this.href("warehouses"), "Warehouses")}
                    ${this.navItem("vehicles", this.href("vehicles"), "Delivery Vehicles")}
                    ${this.navItem("devices", this.href("devices"), "Devices")}
                    ${this.navItem("data", this.href("data"), "Telemetry Data")}
                    ${this.navItem("alerts", this.href("alerts"), "Alerts", '<span class="nav-badge" id="nav-alert-count">3</span>')}
                </ul>
                <div class="nav-section-title">MANAGEMENT</div>
                <ul class="nav-list">
                    ${this.navItem("reports", this.href("reports"), "Reports")}
                </ul>
            </nav>
            <div class="sidebar-footer">
                <div class="user-profile">
                    <div class="user-info-row">
                        <div class="user-avatar" id="sidebar-user-avatar">${this.initials(user)}</div>
                        <div class="user-details">
                            <div class="user-name" id="sidebar-user-name">${user.full_name || user.username}</div>
                            <div class="user-role" id="sidebar-user-role">${this.label(user.role)}</div>
                        </div>
                    </div>
                    <button type="button" class="logout-btn" id="sidebar-logout-btn" title="Sign Out">
                        ${this.icon("logout")}
                    </button>
                </div>
            </div>
        `;
    },

    applyUi() {
        document.querySelectorAll("[data-role]").forEach((el) => {
            const need = el.getAttribute("data-role");
            if (!this.can(need)) {
                el.classList.add("role-hidden");
                el.setAttribute("hidden", "hidden");
            }
        });
    }
};

window.Roles = Roles;
