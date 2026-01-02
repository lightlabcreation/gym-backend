import { Router } from "express";
import {
  createMember,
  deleteMember,
  getMembersByAdminAndGeneralMemberPlanController,
  getMembersByAdminAndGroupPlanController,
  getMembersByAdminAndPlanController,
  getMembersByAdminId,
  getRenewalPreview,
  listMembers,
  listPTBookings,
  memberDetail,
  renewMembershipPlan,
  updateMember,
  updateMemberRenewalStatus,
} from "./member.controller.js";
// import { verifyToken } from "../../middlewares/auth.js";

const router = Router();

/** Create Member — Superadmin, Admin, Staff */
router.post(
  "/create",
  // verifyToken(["Superadmin", "Admin", "Staff"]),
  createMember
);

router.put("/renew/:memberId", renewMembershipPlan);

/** List Members by Branch */
router.get(
  "/branch/:branchId",
  // verifyToken(["Superadmin", "Admin", "Staff"]),
  listMembers
);

router.get("/renew/:adminId", getRenewalPreview);

/** Get Member Detail */
router.get(
  "/detail/:id",
  // verifyToken(["Superadmin", "Admin", "Staff"]),
  memberDetail
);

router.put("/admin/renewal/:memberId/status", updateMemberRenewalStatus);

/** Update Member */
router.put(
  "/update/:id",
  // verifyToken(["Superadmin", "Admin", "Staff"]),
  updateMember
);

/** Soft Delete / Deactivate Member */
router.delete(
  "/delete/:id",
  // verifyToken(["Superadmin", "Admin", "Staff"]),
  deleteMember
);

router.get("/admin/:adminId", getMembersByAdminId);
router.get("/admin/:adminId/plan", getMembersByAdminAndPlanController);
router.get(
  "/group-plan/:adminId/admin/:planId",
  getMembersByAdminAndGroupPlanController
);
router.get(
  "/member-plan/general/:adminId/admin/:planId",
  getMembersByAdminAndGeneralMemberPlanController
);

router.get("/pt-bookings/:branchId", listPTBookings);

export default router;
