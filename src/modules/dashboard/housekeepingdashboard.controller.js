import { housekeepingDashboardService } from "./housekeepingdashboard.service.js";

// controller/housekeepingDashboard.controller.js
// controller/housekeepingDashboard.controller.js
// controller/housekeepingDashboard.controller.js
export const getHousekeepingDashboard = async (req, res, next) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "userId is required",
      });
    }

    const data = await housekeepingDashboardService(Number(userId));

    res.json({
      success: true,
      housekeepingDashboard: data,
    });
  } catch (err) {
    next(err);
  }
};



