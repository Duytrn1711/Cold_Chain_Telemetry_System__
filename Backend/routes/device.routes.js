const express = require("express");
const router = express.Router();
const deviceController = require("../controllers/device.controller");
const authController = require("../controllers/auth.controller");
const { verifyToken, requireMinRole } = authController;

router.get("/", deviceController.getAllDevices);
router.get("/:id", deviceController.getDeviceById);
router.post("/", verifyToken, requireMinRole("MANAGER"), deviceController.createDevice);
router.put("/:id", verifyToken, requireMinRole("MANAGER"), deviceController.updateDevice);
router.delete("/:id", verifyToken, requireMinRole("ADMIN"), deviceController.deleteDevice);

module.exports = router;
