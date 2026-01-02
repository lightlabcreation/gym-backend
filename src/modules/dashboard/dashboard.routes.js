import { Router } from "express";
// import { verifyToken } from "../../middlewares/auth.js";
import { getDashboardData,getSuperAdminDashboard,getReceptionistDashboard } from "./dashboard.controller.js";

const router = Router();
router.get("/dashboard", getSuperAdminDashboard);
router.get("/recepitonishdsh",getReceptionistDashboard )
router.get("/",  getDashboardData);

export default router;
