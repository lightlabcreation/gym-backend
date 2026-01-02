import { Router } from "express";
// import { verifyToken } from "../../middlewares/auth.js";
import {
  recordPayment,
  paymentHistory,
  allPayments,
} from "./payment.controller.js";

const router = Router();

// Record new payment
router.post(
  "/create",
  // verifyToken(["Admin", "Superadmin"]),
  recordPayment
);

// Member payment history
router.get(
  "/member/:memberId",
  // verifyToken(["Admin", "Superadmin", "Staff"]),
  paymentHistory
);

// All payments of a branch
router.get(
  "/branch/:branchId",
  // verifyToken(["Admin", "Superadmin"]),
  allPayments
);

export default router;
