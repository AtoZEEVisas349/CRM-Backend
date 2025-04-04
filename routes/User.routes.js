// routes/User.routes.js
const express = require("express");
const router = express.Router();
const userController = require("../controllers/User.controller");
const auth = require("../middleware/auth");

// Public routes
router.post("/signup", userController.signupLocal);
router.post("/login", userController.login);
router.post("/forgot-password", userController.forgotPassword);
router.post("/reset-password", userController.resetPassword);

// Role-specific protected routes
router.get("/admin", auth(["Admin"]), userController.getAdminDashboard);
router.get("/tl", auth(["TL"]), userController.getTLDashboard);
router.get(
  "/executive",
  auth(["Executive"]),
  userController.getExecutiveDashboard
);

// General profile route
router.get("/profile", auth(), userController.getUserProfile); // No role restriction

// New protected routes with proper authorization
router.get(
  "/executives",
  auth(["Admin", "TL"]), // Only Admin and TL can access
  userController.getAllExecutives
);
router.get(
  "/team-leads",
  auth(["Admin"]), // Only Admin can access
  userController.getAllTeamLeads
);

module.exports = router;
