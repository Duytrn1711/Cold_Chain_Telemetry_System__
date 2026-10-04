const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const pool = require("./db");

// Import Routes
const authRoutes = require("./routes/auth.routes");
const warehouseRoutes = require("./routes/warehouse.routes");
const vehicleRoutes = require("./routes/vehicle.routes");
const deviceRoutes = require("./routes/device.routes");
const dataRoutes = require("./routes/data.routes");
const alertRoutes = require("./routes/alert.routes");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend static files
app.use(express.static(path.join(__dirname, "../frontend")));

// Test & Healthcheck Routes
app.get("/api/health", (req, res) => {
    res.json({
        success: true,
        message: "Cold Chain Telemetry API is running smoothly",
        timestamp: new Date().toISOString()
    });
});

// Test PostgreSQL Database
app.get("/api/test-db", async (req, res) => {
    try {
        const result = await pool.query("SELECT NOW() AS current_time");
        res.json({
            success: true,
            message: "PostgreSQL connected successfully",
            time: result.rows[0].current_time
        });
    } catch (error) {
        console.error("DATABASE ERROR:", error);
        res.status(500).json({
            success: false,
            message: "Database connection failed",
            error: error.message
        });
    }
});

// Mount API Routers
app.use("/api/auth", authRoutes);
app.use("/api/warehouses", warehouseRoutes);
app.use("/api/vehicles", vehicleRoutes);
app.use("/api/devices", deviceRoutes);
app.use("/api/data", dataRoutes);
app.use("/api/alerts", alertRoutes);

// Fallback route cho frontend root
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend/login.html"));
});

// 404 Handler for undefined API routes
app.use((req, res, next) => {
    if (req.path.startsWith("/api/")) {
        return res.status(404).json({
            success: false,
            data: null,
            message: `Endpoint ${req.originalUrl} không tồn tại`
        });
    }
    next();
});

// Centralized Error Handler Middleware
app.use((err, req, res, next) => {
    console.error("Unhandler Server Error:", err);
    res.status(err.status || 500).json({
        success: false,
        data: null,
        message: "Đã xảy ra lỗi máy chủ nội bộ. Vui lòng thử lại sau!"
    });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Cold Chain Telemetry Server running at http://localhost:${PORT}`);
});

module.exports = app;