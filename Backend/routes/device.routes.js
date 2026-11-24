const express = require("express");
const router = express.Router();
const deviceController = require("../controllers/device.controller");
const authController = require("../controllers/auth.controller");
const { verifyToken, requireMinRole } = authController;

router.get("/", verifyToken, requireMinRole("STAFF"), deviceController.getAllDevices);
router.get("/:id", verifyToken, requireMinRole("STAFF"), deviceController.getDeviceById);
router.post("/", verifyToken, requireMinRole("STAFF"), deviceController.createDevice);
router.put("/:id", verifyToken, requireMinRole("STAFF"), deviceController.updateDevice);
router.delete("/:id", verifyToken, requireMinRole("ADMIN"), deviceController.deleteDevice);

module.exports = router;
