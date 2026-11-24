const express = require("express");
const authController = require("../controllers/auth.controller");
const trackingController = require("../controllers/tracking.controller");

const router = express.Router();
router.get("/", authController.verifyToken, authController.requireMinRole("USER"), trackingController.getMovingBatches);

module.exports = router;
