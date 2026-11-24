const express = require("express");
const router = express.Router();
const alertController = require("../controllers/alert.controller");
const authController = require("../controllers/auth.controller");
const { verifyToken, requireMinRole } = authController;

router.get("/", verifyToken, requireMinRole("STAFF"), alertController.getAllAlerts);
router.get("/summary", verifyToken, requireMinRole("STAFF"), alertController.getAlertSummary);
router.post("/acknowledge-all", verifyToken, requireMinRole("STAFF"), alertController.acknowledgeAllAlerts);
router.get("/:id", verifyToken, requireMinRole("STAFF"), alertController.getAlertById);
router.patch("/:id/status", authController.verifyToken, requireMinRole("STAFF"), alertController.updateAlertStatus);
router.post("/", verifyToken, requireMinRole("STAFF"), alertController.createAlert);
router.delete("/:id", verifyToken, requireMinRole("STAFF"), alertController.deleteAlert);

module.exports = router;
