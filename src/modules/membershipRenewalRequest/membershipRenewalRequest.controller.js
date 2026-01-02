import {
  createRenewalRequest,
  getPendingRenewalRequests,
  getAllRenewalRequests,
  approveRenewalRequest,
  rejectRenewalRequest,
} from "./membershipRenewalRequest.service.js";

/**
 * POST /api/membership-renewal-requests
 * Create a renewal request
 */
export const createRequest = async (req, res, next) => {
  try {
    const { memberId, assignmentId, planId, paymentMode, amountPaid, requestedBy, requestedByRole } = req.body;

    if (!memberId || !assignmentId || !planId || !requestedBy) {
      return res.status(400).json({
        success: false,
        message: "memberId, assignmentId, planId, and requestedBy are required",
      });
    }

    const request = await createRenewalRequest({
      memberId,
      assignmentId,
      planId,
      paymentMode: paymentMode || "Cash",
      amountPaid: amountPaid || 0,
      requestedBy,
      requestedByRole: requestedByRole || "admin",
    });

    res.status(201).json({
      success: true,
      message: "Renewal request created successfully",
      data: request,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/membership-renewal-requests/pending/:adminId
 * Get pending renewal requests for an admin
 */
export const getPendingRequests = async (req, res, next) => {
  try {
    const adminId = parseInt(req.params.adminId);

    if (!adminId) {
      return res.status(400).json({
        success: false,
        message: "adminId is required",
      });
    }

    const requests = await getPendingRenewalRequests(adminId);

    res.json({
      success: true,
      data: requests,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/membership-renewal-requests/all/:adminId
 * Get all renewal requests for an admin
 */
export const getAllRequests = async (req, res, next) => {
  try {
    const adminId = parseInt(req.params.adminId);

    if (!adminId) {
      return res.status(400).json({
        success: false,
        message: "adminId is required",
      });
    }

    const requests = await getAllRenewalRequests(adminId);

    res.json({
      success: true,
      data: requests,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/membership-renewal-requests/:requestId/approve
 * Approve a renewal request
 */
export const approveRequest = async (req, res, next) => {
  try {
    const requestId = parseInt(req.params.requestId);
    const { adminId } = req.body;

    if (!adminId) {
      return res.status(400).json({
        success: false,
        message: "adminId is required",
      });
    }

    const request = await approveRenewalRequest(requestId, adminId);

    res.json({
      success: true,
      message: "Renewal request approved successfully",
      data: request,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/membership-renewal-requests/:requestId/reject
 * Reject a renewal request
 */
export const rejectRequest = async (req, res, next) => {
  try {
    const requestId = parseInt(req.params.requestId);
    const { rejectionReason } = req.body;

    const request = await rejectRenewalRequest(requestId, null, rejectionReason);

    res.json({
      success: true,
      message: "Renewal request rejected successfully",
      data: request,
    });
  } catch (err) {
    next(err);
  }
};

