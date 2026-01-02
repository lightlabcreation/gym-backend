// src/modules/branch/branch.routes.js
import { Router } from "express";
import {
  createBranch,
  listBranches,
  getBranchById,
  updateBranch,
  deleteBranch,
  getBranchByAdminId,
  
} from "./branch.controller.js";
// import { verifyToken } from "../../middlewares/auth.js";

const router = Router();

// Create branch – only Admin
router.post(
  "/create",
  // verifyToken(["Superadmin","Admin"]),
  createBranch
);

// Get all branches – Superadmin + Admin
router.get(
  "/",
  // verifyToken(["Superadmin", "Admin"]),
  listBranches
);

router.get(
  "/by-admin/:adminId",getBranchByAdminId
);

// Get single branch (view icon) – Superadmin + Admin
router.get(
  "/:id",
  // verifyToken(["Superadmin", "Admin"]),
  getBranchById
);

// Update branch (edit icon) – Admin
router.put(
  "/:id",
  // verifyToken(["Admin"]),
  updateBranch
);

// Delete branch (trash icon) – Admin
router.delete(
  "/:id", 
  // verifyToken(["Admin"]),
  deleteBranch
);

export default router;
