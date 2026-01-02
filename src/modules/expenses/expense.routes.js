import { Router } from "express";
import { verifyToken } from "../../middlewares/auth.js";
import {
  addExpense,
  listExpenses,
  expenseSummary,
} from "./expense.controller.js";

const router = Router();

// Create Expense
router.post(
  "/create",
  verifyToken(["Admin", "Superadmin"]),
  addExpense
);

// List branch expenses
router.get(
  "/branch/:branchId",
  verifyToken(["Admin", "Superadmin"]),
  listExpenses
);

// Monthly summary for graphs
router.get(
  "/summary/:branchId",
  verifyToken(["Admin", "Superadmin"]),
  expenseSummary
);

export default router;
