// src/modules/dashboard/personalTrainerDashboard.routes.js
import { Router } from "express";
import { getPersonalTrainerDashboard, 
            getPersonalTrainingPlansByAdmin,
            getPersonalTrainingCustomersByAdmin
 } from "./personalTrainerDashboard.controller.js";

const router = Router();

// Personal Trainer Dashboard
router.get(
  "/trainer/:adminId/:trainerId",
  getPersonalTrainerDashboard
);


router.get(
  "/admin/:adminId/trainer/:trainerId/plans",
  // verifyToken(["Admin", "Superadmin"]),
  getPersonalTrainingPlansByAdmin
);

// Customers list for particular plan
// GET /api/personal-training/admin/1/plan/3/customers
router.get(
  "/admin/:adminId/plan/:planId/customers",
  // verifyToken(["Admin", "Superadmin"]),
  getPersonalTrainingCustomersByAdmin
);
export default router;
