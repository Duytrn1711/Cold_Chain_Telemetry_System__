const express = require("express");
const router = express.Router();
const vehicleController = require("../controllers/vehicle.controller");
const authController = require("../controllers/auth.controller");
const { verifyToken, requireMinRole } = authController;

router.get("/", vehicleController.getAllVehicles);
router.get("/:id", vehicleController.getVehicleById);
router.post("/", verifyToken, requireMinRole("MANAGER"), vehicleController.createVehicle);
router.put("/:id", verifyToken, requireMinRole("MANAGER"), vehicleController.updateVehicle);
router.delete("/:id", verifyToken, requireMinRole("ADMIN"), vehicleController.deleteVehicle);

module.exports = router;
