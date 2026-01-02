import { Router } from "express";
import {
  createStaff,
  listStaff,
  staffDetail,
  updateStaff,
  deleteStaff,
  getAllStaff,
  getTrainerById 
} from "./staff.controller.js";
// import { verifyToken } from "../../middlewares/auth.js";

const router = Router();

/**
 * 👉 Create Staff
 */
router.post(
  "/create",
  // verifyToken(["Superadmin", "Admin"]),
  createStaff
);


router.get("/all/:adminId", getAllStaff);
/**
 * 👉 List Staff by Branch
 * 🛑 Prevent Admin accessing other branches
 */

router.get(
  "/trainers/:id",
  // verifyToken(["Superadmin", "Admin"]),
  getTrainerById
);

router.get(
  "/admin/:adminId",
  // verifyToken(["Superadmin", "Admin"]),

  listStaff
);

/**
 * 👉 Get Single Staff Details
 * 🛑 Admin can view only staff of their own branch
 */
router.get(
  "/detail/:id",
  // verifyToken(["Superadmin", "Admin"]),
  (req, res, next) => {
    req.checkBranch = true; // custom flag for controller -> optional use
    next();
  },
  staffDetail
);

/**
 * 👉 Edit Staff
 */
router.put(
  "/update/:id",
  // verifyToken(["Superadmin", "Admin"]),
  updateStaff
);

/**
 * 👉 Soft Delete
 */
router.delete(
  "/delete/:id",
  // verifyToken(["Superadmin", "Admin"]),
  deleteStaff
);

export default router;
