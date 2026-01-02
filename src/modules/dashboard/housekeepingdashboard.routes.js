import { Router } from "express";
import { getHousekeepingDashboard } from "./housekeepingdashboard.controller.js";

const router = Router();

router.get("/:userId", getHousekeepingDashboard);

export default router;
