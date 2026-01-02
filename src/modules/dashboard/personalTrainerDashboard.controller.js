// src/modules/dashboard/personalTrainerDashboard.controller.js
import { getAdminDashboardService,
            getPersonalTrainingPlansByAdminService,
            getPersonalTrainingCustomersByAdminService
 } from "./personalTrainerdashboard.service.js";

export const getPersonalTrainerDashboard = async (req, res, next) => {
  try {
    const adminId = Number(req.params.adminId);
    const trainerId = Number(req.params.trainerId);

    if (!adminId || !trainerId) {
      return res.status(400).json({
        success: false,
        message: "adminId and trainerId both are required",
      });
    }

    const data = await getAdminDashboardService(adminId, trainerId);

    return res.json({
      success: true,
      message: "Personal Trainer Dashboard data fetched successfully",
      dashboardType: "Personal Trainer",
      data,
    });
  } catch (err) {
    next(err);
  }
};


export const getPersonalTrainingPlansByAdmin = async (req, res, next) => {
  try {
    const adminId = parseInt(req.params.adminId);
    const trainerId = parseInt(req.params.trainerId);

    if (!adminId || !trainerId) {
      return res.status(400).json({
        success: false,
        message: "adminId and trainerId are required in URL",
      });
    }

    const plans = await getPersonalTrainingPlansByAdminService(
      adminId,
      trainerId
    );

    res.json({
      success: true,
      message: "Personal training plans fetched successfully",
      plans,
    });
  } catch (err) {
    next(err);
  }
};



export const getPersonalTrainingCustomersByAdmin = async (req, res, next) => {
 try {
    const { adminId, planId } = req.params;

    if (!adminId || !planId) {
      return res.status(400).json({
        success: false,
        message: "Admin ID and Plan ID are required"
      });
    }

    const result = await getPersonalTrainingCustomersByAdminService(adminId, planId);

    res.json({
      success: true,
      message: "Membership plan for personal trainer members fetched successfully",
      data: {
        plan: result.plan,
        members: result.members,
        statistics: result.statistics,
        Total_Members: result.members.length
      }
    });
  } catch (error) {
    next(error);
  }
};