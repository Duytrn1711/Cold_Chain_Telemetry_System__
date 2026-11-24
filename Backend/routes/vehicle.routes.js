const express = require("express");
const router = express.Router();
const vehicleController = require("../controllers/vehicle.controller");
const authController = require("../controllers/auth.controller");
const { verifyToken, requireMinRole } = authController;

router.get("/", verifyToken, requireMinRole("STAFF"), vehicleController.getAllVehicles);
router.get("/:id", verifyToken, requireMinRole("STAFF"), vehicleController.getVehicleById);
router.post("/", verifyToken, requireMinRole("STAFF"), vehicleController.createVehicle);
router.put("/:id", verifyToken, requireMinRole("STAFF"), vehicleController.updateVehicle);
router.delete("/:id", verifyToken, requireMinRole("ADMIN"), vehicleController.deleteVehicle);

module.exports = router;
