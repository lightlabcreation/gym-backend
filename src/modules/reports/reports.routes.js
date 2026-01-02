import express from "express";
import {
  generateGeneralTrainerReportController,
  generateMemberReportController,
  generatePersonalTrainerReportController,
  getReceptionReportForAdmin,
  getMemberAttendanceReport,
  getManagerReportController,
  generatePersonalTrainerReportByStaffController,
  generateGeneralTrainerReportByStaffController,
  getAdminHousekeepingReport,
  getStaffHousekeepingReport,
  generateSalesReportController,
} from "./reports.controller.js";
// import { generateGeneralTrainerReportController, generateMemberReportController, generatePersonalTrainerReportController,getManagerReportController,getReceptionReportForAdmin } from "./reports.controller.js";

const router = express.Router();

// Generate sales report (Total Sales - Plans)
router.get("/sales", generateSalesReportController);

// Generate member report
router.get("/members", generateMemberReportController);
router.get("/personal-trainer", generatePersonalTrainerReportController);

//memeber attendence report
router.get("/attendance/:adminId", getMemberAttendanceReport);

// General trainer report route
router.get("/general-trainer", generateGeneralTrainerReportController);
router.get("/reception/:adminId", getReceptionReportForAdmin);
router.get("/manager-report", getManagerReportController);
router.get(
  "/personal-trainer/staff/:adminId/:staffId",
  generatePersonalTrainerReportByStaffController
);
router.get(
  "/general-trainer/staff/:adminId/:staffId",
  generateGeneralTrainerReportByStaffController
);
router.get("/housekeeping/admin/:adminId", getAdminHousekeepingReport);

// Get housekeeping report for a specific staff member under an admin
router.get(
  "/housekeeping/admin/:adminId/staff/:staffId",
  getStaffHousekeepingReport
);

export default router;
