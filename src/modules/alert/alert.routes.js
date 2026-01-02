import { Router } from "express";
// import { verifyToken } from "../../middlewares/auth.js";
import { getAlerts } from "./alert.controller.js";

const router = Router();

router.get(
  "/",
  // verifyToken(["Admin", "Superadmin"]),
  getAlerts
);

export default router;
