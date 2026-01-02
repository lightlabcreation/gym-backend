import { Router } from "express";
import {
  createMemberPlan,
  getMemberPlans,
  getMemberPlan,
  updatePlan,
  deletePlan,
  getMemberPlansnewss
} from "../memberplan/memberPlan.controller.js";
// import { verifyToken } from "../../middlewares/auth.js";

const router = Router();

// ✅ saare member plan routes sirf Admin (ya Superadmin) ke liye
// router.use(verifyToken(["Admin", "Superadmin"]));
router.get("/all", getMemberPlansnewss);
router.get("/", getMemberPlans);          // Get All (current admin ke according)
router.get("/:id", getMemberPlan);      // Get by ID (current admin ka hi)

router.post("/", createMemberPlan);      // Create
router.put("/:adminId/:planId", updatePlan);


router.delete("/:id", deletePlan);       // Delete
     





export default router;
