import { Router } from "express";
import { verifyToken } from "../../middlewares/auth.js";
import { sendNotification } from "./notif.controller.js";

const router = Router();

router.post(
  "/send",
  verifyToken(["Admin", "Superadmin", "Staff"]),
  sendNotification
);

export default router;
