import { Router } from "express";
import {
  createPlan,
  listPlans,
  updatePlan,
  deletePlan,
  getPlansByBranch
} from "./plan.controller.js";
// import { verifyToken } from "../../middlewares/auth.js";

const router = Router();

// Only Superadmin and Admin can manage plans
router.post(
  "/create",

  createPlan
);

router.get(
  "/",
 
  listPlans
);

router.get("/branch/:branchId", getPlansByBranch);

router.put(
  "/update/:id",
  // verifyToken(["Superadmin", "Admin"]),
  updatePlan
);

router.delete(
  "/delete/:id",
  // verifyToken(["Superadmin"]),
  deletePlan
);

export default router;
