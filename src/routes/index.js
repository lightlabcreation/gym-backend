import { Router } from "express";
import authRoutes from "../modules/auth/auth.routes.js";
import branchRoutes from "../modules/branch/branch.routes.js";
import staffRoutes from "../modules/staff/staff.routes.js";
import memberRoutes from "../modules/member/member.routes.js";
import planRoutes from "../modules/plans/plan.routes.js";
import attendanceRoutes from "../modules/attendance/memberAttendance.routes.js";
import classRoutes from "../modules/classes/class.routes.js";
import paymentRoutes from "../modules/payments/payment.routes.js";
import dashboardRoutes from "../modules/dashboard/dashboard.routes.js";
import alertRoutes from "../modules/alert/alert.routes.js";
import expenseRoutes from "../modules/expenses/expense.routes.js";
import dietRoutes from "../modules/diet/diet.routes.js";
import workoutRoutes from "../modules/workout/workout.routes.js";
import notifRoutes from "../modules/notifications/notif.routes.js";
import invoiceRoutes from "../modules/invoice/invoice.routes.js";
import financeRoutes from "../modules/finance/finance.routes.js";
import inventoryRoutes from "../modules/inventory/inventory.routes.js";
import purchaseRoutes from "../modules/purchase/purchase.routes.js";
import sessionRoutes from "../modules/session/session.routes.js";
import MemberPlan from "../modules/memberplan/memberPlan.routes.js";
import memberPlanAssignmentRoutes from "../modules/memberPlanAssignment/memberPlanAssignment.routes.js";
import membershipRenewalRequestRoutes from "../modules/membershipRenewalRequest/membershipRenewalRequest.routes.js";
import SalaryRoutes from "../modules/salary/salary.routes.js";
import houseKeepingRoutes from "../modules/houseKeppingtask/housekeepingtask.routes.js";
import staffAttendanceRoutes from "../modules/staffAttendance/staffAttendance.routes.js";
import housekeepingDashboardRoutes from "../modules/dashboard/housekeepingdashboard.routes.js";
import generaltrainerRoutes from "../modules/generaltrainer/generalTrainer.routes.js";
import memberAttendenceRoutes from "../modules/memberattendence/attendence.routes.js";
import shiftRoutes from "../modules/shift/shift.routes.js";
import bookingRoutes from "../modules/classbookingrequest/classbooking.routes.js";
// import housekeepingAttendance from "../modules/housekeepingAttendance/housekeepingattendance.routes.js";
import memberDeshboardRoutes from "../modules/member/memberDashboard.routes.js";

import adminStaffAttendanceRoutes from "../modules/adminStaffAttendance/adminStaffAttendance.routes.js";
import memberSelfRoutes from "../modules/member/memberSelf.routes.js";
import personalTrainerDashboardRoutes from "../modules/dashboard/personalTrainerDashboard.routes.js";
import reportsRoutes from "../modules/reports/reports.routes.js"
import adminSettingsRoutes from "../modules/appSettings/appSetting.routes.js"
const router = Router();

// test route
router.get("/ping", (req, res) => {
  res.json({ status: "ok" });
});

//auth
router.use("/auth", authRoutes);
router.use("/branches", branchRoutes);
router.use("/staff", staffRoutes);
router.use("/members", memberRoutes);
router.use("/plans", planRoutes);
router.use("/attendance", attendanceRoutes);
router.use("/class", classRoutes);
router.use("/payments", paymentRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/memberattendence", memberAttendenceRoutes);
router.use("/alerts", alertRoutes);
router.use("/expenses", expenseRoutes);
router.use("/finance", financeRoutes);
router.use("/diet", dietRoutes);
router.use("/workout", workoutRoutes);
router.use("/notify", notifRoutes);
router.use("/invoices", invoiceRoutes);
router.use("/inventory", inventoryRoutes);
router.use("/purchases", purchaseRoutes);
router.use("/MemberPlan", MemberPlan);
router.use("/member-plan-assignments", memberPlanAssignmentRoutes);
router.use("/membership-renewal-requests", membershipRenewalRequestRoutes);
router.use("/sessions", sessionRoutes);
router.use("/salaries", SalaryRoutes);
router.use("/housekeepingtask", houseKeepingRoutes);
router.use("/staff-attendance", staffAttendanceRoutes);
 router.use("/housekeepingdashboard", housekeepingDashboardRoutes);
router.use("/generaltrainer", generaltrainerRoutes);
router.use("/shift", shiftRoutes);
router.use("/personal-trainer-dashboard", personalTrainerDashboardRoutes);
// router.use("/housekeeping-attendance",housekeepingAttendance);
router.use("/member-dashboard",memberDeshboardRoutes);
router.use("/admin-staff-attendance", adminStaffAttendanceRoutes);
router.use("/member-self", memberSelfRoutes);
router.use("/reports",reportsRoutes);
router.use("/booking", bookingRoutes);
router.use("/adminSettings", adminSettingsRoutes);

export default router;
