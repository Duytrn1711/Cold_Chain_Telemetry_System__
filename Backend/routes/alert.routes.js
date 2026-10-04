const express = require("express");
const router = express.Router();
const alertController = require("../controllers/alert.controller");
const authController = require("../controllers/auth.controller");
const { verifyToken, requireMinRole } = authController;

router.get("/", alertController.getAllAlerts);
router.get("/:id", alertController.getAlertById);
router.post("/", verifyToken, requireMinRole("MANAGER"), alertController.createAlert);
router.delete("/:id", verifyToken, requireMinRole("MANAGER"), alertController.deleteAlert);

module.exports = router;
