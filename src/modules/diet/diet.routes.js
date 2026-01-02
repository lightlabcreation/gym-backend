import { Router } from "express";
// import { verifyToken } from "../../middlewares/auth.js";
import {
  createDietPlan,
  assignDietPlan,
  getMemberDietPlan
} from "./diet.controller.js";

const router = Router();

// Only trainer, admin, superadmin can create
router.post("/create", createDietPlan);

// Assign diet plan to member
router.post("/assign",  assignDietPlan);

// Member diet history
router.get("/member/:memberId", getMemberDietPlan);

export default router;
