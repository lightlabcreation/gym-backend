import { pool } from "../../config/db.js";

/**
 * Create a membership renewal request
 */
export const createRenewalRequest = async (data) => {
  const { memberId, assignmentId, planId, paymentMode, amountPaid, requestedBy, requestedByRole } = data;

  const [result] = await pool.query(
    `INSERT INTO membership_renewal_requests 
     (memberId, assignmentId, planId, paymentMode, amountPaid, requestedBy, requestedByRole, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
    [memberId, assignmentId, planId, paymentMode, amountPaid, requestedBy, requestedByRole]
  );

  const [[request]] = await pool.query(
    `SELECT * FROM membership_renewal_requests WHERE id = ?`,
    [result.insertId]
  );

  return request;
};

/**
 * Get all pending renewal requests for an admin
 */
export const getPendingRenewalRequests = async (adminId) => {
  const [requests] = await pool.query(
    `SELECT 
      mrr.*,
      m.fullName AS memberName,
      m.phone AS memberPhone,
      m.email AS memberEmail,
      mp.name AS planName,
      mp.price AS planPrice,
      mp.validityDays,
      mpa.membershipFrom,
      mpa.membershipTo,
      mpa.status AS currentStatus,
      u.fullName AS requestedByName
    FROM membership_renewal_requests mrr
    JOIN member m ON m.id = mrr.memberId
    JOIN memberplan mp ON mp.id = mrr.planId
    JOIN member_plan_assignment mpa ON mpa.id = mrr.assignmentId
    LEFT JOIN user u ON u.id = mrr.requestedBy
    WHERE m.adminId = ? AND mrr.status = 'pending'
    ORDER BY mrr.createdAt DESC`,
    [adminId]
  );

  return requests;
};

/**
 * Get all renewal requests (pending, approved, rejected) for an admin
 */
export const getAllRenewalRequests = async (adminId) => {
  const [requests] = await pool.query(
    `SELECT 
      mrr.*,
      m.fullName AS memberName,
      m.phone AS memberPhone,
      m.email AS memberEmail,
      mp.name AS planName,
      mp.price AS planPrice,
      mp.validityDays,
      mpa.membershipFrom,
      mpa.membershipTo,
      mpa.status AS currentStatus,
      u.fullName AS requestedByName,
      approver.fullName AS approvedByName
    FROM membership_renewal_requests mrr
    JOIN member m ON m.id = mrr.memberId
    JOIN memberplan mp ON mp.id = mrr.planId
    JOIN member_plan_assignment mpa ON mpa.id = mrr.assignmentId
    LEFT JOIN user u ON u.id = mrr.requestedBy
    LEFT JOIN user approver ON approver.id = mrr.approvedBy
    WHERE m.adminId = ?
    ORDER BY mrr.createdAt DESC`,
    [adminId]
  );

  return requests;
};

/**
 * Approve a renewal request
 */
export const approveRenewalRequest = async (requestId, adminId) => {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // 1. Get the request
    const [[request]] = await connection.query(
      `SELECT * FROM membership_renewal_requests WHERE id = ? AND status = 'pending'`,
      [requestId]
    );

    if (!request) {
      await connection.rollback();
      throw { status: 404, message: "Pending renewal request not found" };
    }

    // 2. Get plan details
    const [[plan]] = await connection.query(
      `SELECT validityDays FROM memberplan WHERE id = ?`,
      [request.planId]
    );

    if (!plan) {
      await connection.rollback();
      throw { status: 404, message: "Plan not found" };
    }

    // 3. Calculate new dates
    const [[assignment]] = await connection.query(
      `SELECT membershipTo FROM member_plan_assignment WHERE id = ?`,
      [request.assignmentId]
    );

    let startDate = assignment[0]?.membershipTo 
      ? new Date(assignment[0].membershipTo)
      : new Date();
    startDate.setDate(startDate.getDate() + 1); // Next day after expiry

    let endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + Number(plan.validityDays || 30));

    // 4. Update the plan assignment
    await connection.query(
      `UPDATE member_plan_assignment 
       SET membershipFrom = ?,
           membershipTo = ?,
           paymentMode = ?,
           amountPaid = ?,
           status = 'Active',
           updatedAt = NOW()
       WHERE id = ?`,
      [startDate, endDate, request.paymentMode, request.amountPaid, request.assignmentId]
    );

    // 5. Update the request status
    await connection.query(
      `UPDATE membership_renewal_requests 
       SET status = 'approved',
           approvedBy = ?,
           approvedAt = NOW(),
           updatedAt = NOW()
       WHERE id = ?`,
      [adminId, requestId]
    );

    // 6. Update member overall status if needed
    const [[memberPlans]] = await connection.query(
      `SELECT COUNT(*) as activeCount 
       FROM member_plan_assignment 
       WHERE memberId = ? AND status = 'Active' AND membershipTo >= CURDATE()`,
      [request.memberId]
    );

    if (memberPlans[0].activeCount > 0) {
      await connection.query(
        `UPDATE member SET status = 'Active' WHERE id = ?`,
        [request.memberId]
      );
    }

    await connection.commit();

    // Return updated request
    const [[updatedRequest]] = await connection.query(
      `SELECT * FROM membership_renewal_requests WHERE id = ?`,
      [requestId]
    );

    return updatedRequest;
  } catch (error) {
    if (connection) await connection.rollback();
    throw error;
  } finally {
    if (connection) connection.release();
  }
};

/**
 * Reject a renewal request
 */
export const rejectRenewalRequest = async (requestId, adminId, rejectionReason = null) => {
  const [result] = await pool.query(
    `UPDATE membership_renewal_requests 
     SET status = 'rejected',
         rejectedAt = NOW(),
         rejectionReason = ?,
         updatedAt = NOW()
     WHERE id = ? AND status = 'pending'`,
    [rejectionReason, requestId]
  );

  if (result.affectedRows === 0) {
    throw { status: 404, message: "Pending renewal request not found" };
  }

  const [[request]] = await pool.query(
    `SELECT * FROM membership_renewal_requests WHERE id = ?`,
    [requestId]
  );

  return request;
};

