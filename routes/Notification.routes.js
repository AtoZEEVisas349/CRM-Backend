const express = require("express");
const router = express.Router();
const notificationController = require("../controllers/Notification.controller");

router.put("/mark-read/:id", notificationController.markAsRead);
router.delete("/:id", notificationController.deleteNotification);
router.delete("/delete/old", notificationController.deleteOldNotifications);

module.exports = router;
