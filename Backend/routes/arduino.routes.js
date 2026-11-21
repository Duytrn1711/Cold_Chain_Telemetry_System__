const express = require("express");
const controller = require("../controllers/arduino.controller");

const router = express.Router();
router.post("/telemetry", controller.authorizeArduino, controller.ingestTelemetry);

module.exports = router;
