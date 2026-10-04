/**
 * API Service for Cold Chain Telemetry System
 * Centralized fetch wrapper with JWT authentication header handling and error routing
 */

const API_BASE_URL = window.location.port === "3000" 
    ? "/api" 
    : "http://localhost:3000/api";

const api = {
    getToken() {
        return localStorage.getItem("coldchain_token") || sessionStorage.getItem("coldchain_token");
    },

    setToken(token, remember = true) {
        if (remember) {
            localStorage.setItem("coldchain_token", token);
        } else {
            sessionStorage.setItem("coldchain_token", token);
        }
    },

    getCurrentUser() {
        const userStr = localStorage.getItem("coldchain_user") || sessionStorage.getItem("coldchain_user");
        try {
            return userStr ? JSON.parse(userStr) : null;
        } catch (e) {
            return null;
        }
    },

    setCurrentUser(user, remember = true) {
        const str = JSON.stringify(user);
        if (remember) {
            localStorage.setItem("coldchain_user", str);
        } else {
            sessionStorage.setItem("coldchain_user", str);
        }
    },

    logout() {
        localStorage.removeItem("coldchain_token");
        localStorage.removeItem("coldchain_user");
        sessionStorage.removeItem("coldchain_token");
        sessionStorage.removeItem("coldchain_user");
        
        // Determine correct login path depending on current subfolder
        const isSubpage = window.location.pathname.includes("/pages/");
        window.location.href = isSubpage ? "../login.html" : "login.html";
    },

    async request(endpoint, options = {}) {
        const url = endpoint.startsWith("http") ? endpoint : `${API_BASE_URL}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;
        
        const headers = {
            "Content-Type": "application/json",
            ...options.headers
        };

        const token = this.getToken();
        if (token) {
            headers["Authorization"] = `Bearer ${token}`;
        }

        try {
            const response = await fetch(url, {
                ...options,
                headers
            });

            if (response.status === 401) {
                // Unauthorized - redirect to login unless already there
                if (!window.location.pathname.endsWith("login.html")) {
                    this.logout();
                }
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.message || "Session expired. Please sign in again.");
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error(`API Error [${endpoint}]:`, error);
            throw error;
        }
    },

    get(endpoint, params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const fullEndpoint = queryString ? `${endpoint}?${queryString}` : endpoint;
        return this.request(fullEndpoint, { method: "GET" });
    },

    post(endpoint, body = {}) {
        return this.request(endpoint, {
            method: "POST",
            body: JSON.stringify(body)
        });
    },

    put(endpoint, body = {}) {
        return this.request(endpoint, {
            method: "PUT",
            body: JSON.stringify(body)
        });
    },

    delete(endpoint) {
        return this.request(endpoint, { method: "DELETE" });
    }
};

// Global Toast / Notification helper
function showToast(message, type = "info") {
    let container = document.getElementById("toast-container");
    if (!container) {
        container = document.createElement("div");
        container.id = "toast-container";
        container.style.position = "fixed";
        container.style.top = "20px";
        container.style.right = "20px";
        container.style.zIndex = "9999";
        container.style.display = "flex";
        container.style.flexDirection = "column";
        container.style.gap = "10px";
        document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    toast.className = `toast-notification toast-${type}`;
    toast.style.minWidth = "280px";
    toast.style.padding = "12px 18px";
    toast.style.borderRadius = "8px";
    toast.style.fontSize = "14px";
    toast.style.fontWeight = "500";
    toast.style.boxShadow = "0 4px 14px rgba(0, 0, 0, 0.12)";
    toast.style.transition = "all 0.3s ease";
    toast.style.display = "flex";
    toast.style.alignItems = "center";
    toast.style.justifyContent = "space-between";
    toast.style.animation = "slideIn 0.3s ease";

    if (type === "success") {
        toast.style.backgroundColor = "#10b981";
        toast.style.color = "#ffffff";
    } else if (type === "error") {
        toast.style.backgroundColor = "#ef4444";
        toast.style.color = "#ffffff";
    } else if (type === "warning") {
        toast.style.backgroundColor = "#f59e0b";
        toast.style.color = "#ffffff";
    } else {
        toast.style.backgroundColor = "#1e293b";
        toast.style.color = "#ffffff";
    }

    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transform = "translateX(20px)";
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}
