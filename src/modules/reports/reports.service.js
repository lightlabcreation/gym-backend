import { pool } from "../../config/db.js";

// Generate Sales Report Service (Total Sales - Plans bought/assigned)
export const generateSalesReportService = async (  adminId,
  fromDate,
  toDate) => {


const buildDateFilter = (column, adminId, fromDate, toDate) => {
  let condition = "";
  let values = [adminId];

  if (fromDate && toDate) {
    condition = `AND DATE(${column}) BETWEEN ? AND ?`;
    values.push(fromDate, toDate);
  } else if (fromDate) {
    condition = `AND DATE(${column}) >= ?`;
    values.push(fromDate);
  } else if (toDate) {
    condition = `AND DATE(${column}) <= ?`;
    values.push(toDate);
  }

  return { condition, values };
};


  try {
    // 1️⃣ Total Sales: Count of all plans bought/assigned

    const { condition, values } = buildDateFilter(
  "mpa.assignedAt",
  adminId,
  fromDate,
  toDate
);
    const [[totalSalesStats]] = await pool.query(
      `SELECT 
        COUNT(*) AS totalSales,
        COALESCE(SUM(mpa.amountPaid), 0) AS totalRevenue,
        SUM(CASE 
          WHEN mpa.membershipTo >= CURDATE() AND mpa.status = 'Active' THEN 1 
          ELSE 0 
        END) AS confirmed,
        SUM(CASE 
          WHEN mpa.membershipTo < CURDATE() OR mpa.status = 'Inactive' THEN 1 
          ELSE 0 
        END) AS cancelled
      FROM member_plan_assignment mpa
      INNER JOIN member m ON mpa.memberId = m.id
      WHERE m.adminId = ?
      ${condition}`,
      
      values
    );

    // 2️⃣ Booked: Count of bookings from dynamic page (unified_bookings where bookingType = 'GROUP')
    const [[bookedStats]] = await pool.query(
      `SELECT COUNT(*) AS booked
      FROM unified_bookings ub
      INNER JOIN member m ON ub.memberId = m.id
      WHERE m.adminId = ? AND ub.bookingType = 'GROUP'
      ${condition.replace("mpa.assignedAt", "ub.createdAt")}`,
      values
    );

    // 3️⃣ Bookings by Day: Plan assignments per day
    const [bookingsByDay] = await pool.query(
      `SELECT 
        DATE(mpa.assignedAt) AS date,
        COUNT(*) AS count
      FROM member_plan_assignment mpa
      INNER JOIN member m ON mpa.memberId = m.id
      WHERE m.adminId = ?
      ${condition}
      GROUP BY DATE(mpa.assignedAt)
      ORDER BY date ASC`,
      values
    );

    // 4️⃣ Booking Status: Active and Inactive/Expired plans
    const [bookingStatus] = await pool.query(
      `SELECT 
        CASE
          WHEN mpa.membershipTo >= CURDATE() AND mpa.status = 'Active' THEN 'Active'
          WHEN mpa.membershipTo < CURDATE() OR mpa.status = 'Inactive' THEN 'Inactive'
          ELSE 'Inactive'
        END AS bookingStatus,
        COUNT(*) AS count
      FROM member_plan_assignment mpa
      INNER JOIN member m ON mpa.memberId = m.id
      WHERE m.adminId = ?
      ${condition}

      GROUP BY 
        CASE
          WHEN mpa.membershipTo >= CURDATE() AND mpa.status = 'Active' THEN 'Active'
          WHEN mpa.membershipTo < CURDATE() OR mpa.status = 'Inactive' THEN 'Inactive'
          ELSE 'Inactive'
        END`,
      values
    );

    // 5️⃣ Last Transactions: All plan purchases/assignments with trainer name and booking details
    const [transactions] = await pool.query(
      `SELECT 
        DATE(mpa.assignedAt) AS date,
        m.id AS memberId,
        m.fullName AS username,
        mp.id AS planId,
        mp.name AS planName,
        COALESCE(mp.sessions, 0) AS totalClasses,
        mp.type AS planType,
        mp.trainerType,
        COALESCE(mpa.amountPaid, 0) AS price,
        COALESCE(mpa.paymentMode, 'N/A') AS paymentMode,
        mpa.status AS originalStatus,
        mpa.membershipTo,
        CASE
          WHEN mpa.membershipTo >= CURDATE() AND mpa.status = 'Active' THEN 'Active'
          WHEN mpa.membershipTo < CURDATE() OR mpa.status = 'Inactive' THEN 'Inactive'
          ELSE 'Inactive'
        END AS computedStatus,
        COALESCE(
          (SELECT u.fullName FROM user u WHERE u.id = mpa.assignedBy),
          'System'
        ) AS assignedBy,
        COALESCE(
          (SELECT u.fullName FROM user u 
           INNER JOIN staff s ON s.userId = u.id 
           WHERE s.id = mp.trainerId),
          'N/A'
        ) AS trainerName,
        mp.trainerId,
        TIME(mpa.assignedAt) AS time,
        -- Booking statistics for this member-plan combination
        -- For GROUP bookings: classId = planId, for PT bookings: count all PT bookings for member
        COALESCE((
          SELECT COUNT(*) 
          FROM unified_bookings ub 
          WHERE ub.memberId = m.id 
            AND (
              (mp.type = 'GROUP' AND ub.bookingType = 'GROUP' AND ub.classId = mp.id)
              OR (mp.type = 'PERSONAL' AND ub.bookingType = 'PT')
              OR (mp.type = 'MEMBER' AND mp.trainerType = 'personal' AND ub.bookingType = 'PT')
            )
        ), 0) AS classesBooked,
        COALESCE((
          SELECT COUNT(*) 
          FROM unified_bookings ub 
          WHERE ub.memberId = m.id 
            AND (
              (mp.type = 'GROUP' AND ub.bookingType = 'GROUP' AND ub.classId = mp.id)
              OR (mp.type = 'PERSONAL' AND ub.bookingType = 'PT')
              OR (mp.type = 'MEMBER' AND mp.trainerType = 'personal' AND ub.bookingType = 'PT')
            )
            AND ub.bookingStatus = 'Confirmed'
        ), 0) AS classesConfirmed,
        COALESCE((
          SELECT COUNT(*) 
          FROM unified_bookings ub 
          WHERE ub.memberId = m.id 
            AND (
              (mp.type = 'GROUP' AND ub.bookingType = 'GROUP' AND ub.classId = mp.id)
              OR (mp.type = 'PERSONAL' AND ub.bookingType = 'PT')
              OR (mp.type = 'MEMBER' AND mp.trainerType = 'personal' AND ub.bookingType = 'PT')
            )
            AND ub.bookingStatus = 'Cancelled'
        ), 0) AS classesCancelled,
        COALESCE((
          SELECT COUNT(*) 
          FROM unified_bookings ub 
          WHERE ub.memberId = m.id 
            AND (
              (mp.type = 'GROUP' AND ub.bookingType = 'GROUP' AND ub.classId = mp.id)
              OR (mp.type = 'PERSONAL' AND ub.bookingType = 'PT')
              OR (mp.type = 'MEMBER' AND mp.trainerType = 'personal' AND ub.bookingType = 'PT')
            )
            AND ub.bookingStatus = 'Completed'
        ), 0) AS classesCompleted
      FROM member_plan_assignment mpa
      INNER JOIN member m ON mpa.memberId = m.id
      INNER JOIN memberplan mp ON mpa.planId = mp.id
      WHERE m.adminId = ?
      ${condition}
      ORDER BY mpa.assignedAt DESC
      LIMIT 100`,
      values
    );

    // Format the data for the UI
    const formattedStats = {
      totalBookings: totalSalesStats.totalSales || 0,
      totalRevenue: parseFloat(totalSalesStats.totalRevenue) || 0,
      confirmed: totalSalesStats.confirmed || 0,
      cancelled: totalSalesStats.cancelled || 0,
      booked: bookedStats.booked || 0,
      avgTicket:
        totalSalesStats.totalSales > 0
          ? parseFloat(totalSalesStats.totalRevenue) /
            totalSalesStats.totalSales
          : 0,
    };

    // Format transactions data
    const formattedTransactions = transactions.map((transaction) => {
      // Format time to HH:MM if it exists
      let formattedTime = "-";
      if (transaction.time) {
        const timeStr = String(transaction.time);
        // If time is in HH:MM:SS format, extract HH:MM
        if (timeStr.includes(":")) {
          formattedTime = timeStr.substring(0, 5);
        } else {
          formattedTime = timeStr;
        }
      }

      // Ensure proper type conversion and handle null/undefined values
      const planPrice =
        transaction.price !== null && transaction.price !== undefined
          ? parseFloat(transaction.price)
          : 0;
      const totalClasses =
        transaction.totalClasses !== null &&
        transaction.totalClasses !== undefined
          ? parseInt(transaction.totalClasses)
          : transaction.sessions !== null && transaction.sessions !== undefined
          ? parseInt(transaction.sessions)
          : 0;
      // Handle paymentMode - check if it's a valid string
      let paymentMode = "N/A";
      if (
        transaction.paymentMode &&
        transaction.paymentMode !== "N/A" &&
        transaction.paymentMode !== null &&
        transaction.paymentMode !== undefined &&
        String(transaction.paymentMode).trim() !== ""
      ) {
        paymentMode = String(transaction.paymentMode).trim();
      }

      return {
        date: transaction.date,
        memberId: transaction.memberId,
        memberName: transaction.username || "N/A",
        username: transaction.username || "N/A", // Keep for backward compatibility
        planId: transaction.planId,
        planName: transaction.planName || "Plan Assignment",
        planType: transaction.planType,
        trainer: transaction.trainerName || transaction.assignedBy || "N/A",
        trainerName: transaction.trainerName || transaction.assignedBy || "N/A", // Keep for backward compatibility
        assignedBy: transaction.assignedBy || "System", // Keep for backward compatibility
        trainerId: transaction.trainerId,
        planPrice: planPrice,
        price: planPrice, // Keep for backward compatibility
        revenue: planPrice, // Keep for backward compatibility
        totalClasses: totalClasses,
        sessions: totalClasses, // Keep for backward compatibility
        classesBooked: parseInt(transaction.classesBooked || 0),
        classesConfirmed: parseInt(transaction.classesConfirmed || 0),
        classesCancelled: parseInt(transaction.classesCancelled || 0),
        classesCompleted: parseInt(transaction.classesCompleted || 0),
        paymentMode: paymentMode,
        time: formattedTime,
        status: transaction.computedStatus || "Inactive",
        computedStatus: transaction.computedStatus || "Inactive", // Keep for backward compatibility
        type: transaction.planName || "Plan Assignment", // Keep for backward compatibility
      };
    });

    return {
      stats: formattedStats,
      bookingsByDay,
      bookingStatus,
      transactions: formattedTransactions,
    };
  } catch (error) {
    throw new Error(`Error generating sales report: ${error.message}`);
  }
};

// Generate Member Report Service
export const generateMemberReportService = async (adminId) => {
  try {
    // Get booking statistics from bookingrequest table
    const [bookingStats] = await pool.query(
      `SELECT 
        COUNT(*) AS totalBookings,
        SUM(ub.price) AS totalRevenue,
        AVG(ub.price) AS avgTicket,
        SUM(CASE WHEN ub.bookingStatus = 'Completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN ub.bookingStatus = 'Cancelled' THEN 1 ELSE 0 END) as cancelled,
        SUM(CASE WHEN ub.bookingStatus = 'Booked' THEN 1 ELSE 0 END) as booked
      FROM unified_bookings ub
      INNER JOIN member m ON ub.memberId=m.id
      WHERE adminId = ?`,
      [adminId]
    );

    // Get bookings by day from bookingrequest table
    const [bookingsByDay] = await pool.query(
      `SELECT 
        DATE(ub.createdAt) AS date,
        COUNT(*) AS count,
        SUM(ub.price) AS revenue
      FROM unified_bookings ub
      INNER JOIN member m ON ub.memberId=m.id
      WHERE m.adminId = ?
      GROUP BY DATE(ub.createdAt)
      ORDER BY date ASC`,
      [adminId]
    );

    // Get booking status distribution from bookingrequest table
    const [bookingStatus] = await pool.query(
      `SELECT 
        ub.bookingStatus,
        COUNT(*) AS count
      FROM unified_bookings ub
      INNER JOIN member m ON ub.memberId = m.id
      WHERE m.adminId = ?
      GROUP BY ub.bookingStatus`,
      [adminId]
    );

    // Get transactions from pt_bookings table
    // const [transactions] = await pool.query(
    //   `SELECT
    //     ptb.date,
    //     u.fullName as trainer,
    //     m.fullName as username,
    //     'Personal Training' as type,
    //     ptb.startTime as time,
    //     ptb.bookingStatus as status
    //   FROM pt_bookings ptb
    //   LEFT JOIN member m ON ptb.memberId = m.id
    //   LEFT JOIN staff s ON ptb.trainerId = s.id
    //   LEFT JOIN user u ON s.userId = u.id
    //   WHERE m.adminId = ?
    //   ORDER BY ptb.date DESC`,
    //   [adminId]
    // );
    const [transactions] = await pool.query(
      `SELECT 
    ptb.date,
    u.fullName as trainer,
    m.fullName as username,
    CASE 
      WHEN ptb.bookingType = 'PT' THEN 'Personal Training' 
      WHEN ptb.bookingType = 'GROUP' THEN 'Group Class' 
      ELSE ptb.bookingType 
    END as type,
    ptb.startTime as time,
    ptb.bookingStatus as status
  FROM unified_bookings ptb
  LEFT JOIN member m ON ptb.memberId = m.id
  LEFT JOIN user u ON ptb.trainerId = u.id
  WHERE m.adminId = ?
  ORDER BY ptb.date DESC`,
      [adminId]
    );
    // Format the data for the UI
    const formattedStats = {
      totalBookings: bookingStats[0].totalBookings || 0,
      totalRevenue: bookingStats[0].totalRevenue || 0,
      avgTicket: bookingStats[0].avgTicket || 0,
      completed: bookingStats[0].completed || 0,
      cancelled: bookingStats[0].cancelled || 0,
      booked: bookingStats[0].booked || 0,
    };

    // Format transactions data
    const formattedTransactions = transactions.map((transaction) => ({
      date: transaction.date,
      trainer: transaction.trainer || "N/A",
      username: transaction.username || "N/A",
      type: transaction.type,
      time: transaction.time,
      status: transaction.status,
    }));

    return {
      stats: formattedStats,
      bookingsByDay,
      bookingStatus,
      transactions: formattedTransactions,
    };
  } catch (error) {
    throw new Error(`Error generating member report: ${error.message}`);
  }
};

export const generateGeneralTrainerReportService = async (adminId) => {
  try {
    // 1️⃣ Total Bookings: Count of General Trainer plans assigned
    // General Trainer plans: type = 'GROUP' OR (type = 'MEMBER' AND trainerType = 'general')
    const [[planStats]] = await pool.query(
      `SELECT 
        COUNT(*) AS totalBookings,
        COALESCE(SUM(mpa.amountPaid), 0) AS totalRevenue,
        SUM(CASE 
          WHEN mpa.membershipTo >= CURDATE() AND mpa.status = 'Active' THEN 1 
          ELSE 0 
        END) AS confirmed,
        SUM(CASE 
          WHEN mpa.membershipTo < CURDATE() OR mpa.status = 'Inactive' THEN 1 
          ELSE 0 
        END) AS cancelled
      FROM member_plan_assignment mpa
      INNER JOIN member m ON mpa.memberId = m.id
      INNER JOIN memberplan mp ON mpa.planId = mp.id
      WHERE m.adminId = ?
        AND (mp.type = 'GROUP' OR (mp.type = 'MEMBER' AND mp.trainerType = 'general'))`,
      [adminId]
    );

    // 2️⃣ Booked: Count of bookings from dynamic page (unified_bookings where bookingType = 'GROUP')
    const [[bookedStats]] = await pool.query(
      `SELECT COUNT(*) AS booked
      FROM unified_bookings ub
      INNER JOIN member m ON ub.memberId = m.id
      WHERE m.adminId = ? 
        AND ub.bookingType = 'GROUP'`,
      [adminId]
    );

    // 3️⃣ Bookings by Day: General Trainer plan assignments per day (with revenue)
    const [bookingsByDay] = await pool.query(
      `SELECT 
        DATE(mpa.assignedAt) AS date,
        COUNT(*) AS count,
        COALESCE(SUM(mpa.amountPaid), 0) AS revenue
      FROM member_plan_assignment mpa
      INNER JOIN member m ON mpa.memberId = m.id
      INNER JOIN memberplan mp ON mpa.planId = mp.id
      WHERE m.adminId = ?
        AND (mp.type = 'GROUP' OR (mp.type = 'MEMBER' AND mp.trainerType = 'general'))
      GROUP BY DATE(mpa.assignedAt)
      ORDER BY date ASC`,
      [adminId]
    );

    // 4️⃣ Booking Status: Active and Inactive General Trainer plans
    const [bookingStatus] = await pool.query(
      `SELECT 
        CASE
          WHEN mpa.membershipTo >= CURDATE() AND mpa.status = 'Active' THEN 'Active'
          WHEN mpa.membershipTo < CURDATE() OR mpa.status = 'Inactive' THEN 'Inactive'
          ELSE 'Inactive'
        END AS bookingStatus,
        COUNT(*) AS count
      FROM member_plan_assignment mpa
      INNER JOIN member m ON mpa.memberId = m.id
      INNER JOIN memberplan mp ON mpa.planId = mp.id
      WHERE m.adminId = ?
        AND (mp.type = 'GROUP' OR (mp.type = 'MEMBER' AND mp.trainerType = 'general'))
      GROUP BY 
        CASE
          WHEN mpa.membershipTo >= CURDATE() AND mpa.status = 'Active' THEN 'Active'
          WHEN mpa.membershipTo < CURDATE() OR mpa.status = 'Inactive' THEN 'Inactive'
          ELSE 'Inactive'
        END`,
      [adminId]
    );

    // 5️⃣ Transactions list for UI
    const [transactions] = await pool.query(
      `SELECT 
        DATE(mpa.assignedAt) AS date,
        m.id AS memberId,
        m.fullName AS username,
        mp.id AS planId,
        mp.name AS planName,
        mp.sessions AS totalClasses,
        mpa.amountPaid AS price,
        mpa.paymentMode,
        mpa.status AS originalStatus,
        mpa.membershipTo,
        CASE
          WHEN mpa.membershipTo >= CURDATE() AND mpa.status = 'Active' THEN 'Active'
          WHEN mpa.membershipTo < CURDATE() OR mpa.status = 'Inactive' THEN 'Inactive'
          ELSE 'Inactive'
        END AS computedStatus,
        COALESCE(
          (SELECT u.fullName FROM user u WHERE u.id = mpa.assignedBy),
          'System'
        ) AS assignedBy,
        COALESCE(
          (SELECT u.fullName FROM user u 
           INNER JOIN staff s ON s.userId = u.id 
           WHERE s.id = mp.trainerId),
          'N/A'
        ) AS trainerName,
        mp.trainerId,
        TIME(mpa.assignedAt) AS time,
        -- Booking statistics for General Trainer plans
        -- Note: unified_bookings doesn't have planId, so we count all GROUP bookings for the member
        COALESCE((
          SELECT COUNT(*) 
          FROM unified_bookings ub 
          WHERE ub.memberId = m.id 
            AND ub.bookingType = 'GROUP'
        ), 0) AS classesBooked,
        COALESCE((
          SELECT COUNT(*) 
          FROM unified_bookings ub 
          WHERE ub.memberId = m.id 
            AND ub.bookingStatus = 'Confirmed'
            AND ub.bookingType = 'GROUP'
        ), 0) AS classesConfirmed,
        COALESCE((
          SELECT COUNT(*) 
          FROM unified_bookings ub 
          WHERE ub.memberId = m.id 
            AND ub.bookingStatus = 'Cancelled'
            AND ub.bookingType = 'GROUP'
        ), 0) AS classesCancelled,
        COALESCE((
          SELECT COUNT(*) 
          FROM unified_bookings ub 
          WHERE ub.memberId = m.id 
            AND ub.bookingStatus = 'Completed'
            AND ub.bookingType = 'GROUP'
        ), 0) AS classesCompleted
      FROM member_plan_assignment mpa
      INNER JOIN member m ON mpa.memberId = m.id
      INNER JOIN memberplan mp ON mpa.planId = mp.id
      WHERE m.adminId = ?
        AND (mp.type = 'GROUP' OR (mp.type = 'MEMBER' AND mp.trainerType = 'general'))
      ORDER BY mpa.assignedAt DESC
      LIMIT 100`,
      [adminId]
    );

    // Format output for UI
    const formattedStats = {
      totalBookings: planStats.totalBookings || 0,
      totalRevenue: parseFloat(planStats.totalRevenue) || 0,
      confirmed: planStats.confirmed || 0,
      cancelled: planStats.cancelled || 0,
      booked: bookedStats.booked || 0,
      avgTicket:
        planStats.totalBookings > 0
          ? parseFloat(planStats.totalRevenue) / planStats.totalBookings
          : 0,
    };

    // Format transactions data
    const formattedTransactions = transactions.map((transaction) => {
      // Format time to HH:MM if it exists
      let formattedTime = "-";
      if (transaction.time) {
        const timeStr = String(transaction.time);
        if (timeStr.includes(":")) {
          formattedTime = timeStr.substring(0, 5);
        } else {
          formattedTime = timeStr;
        }
      }

      return {
        date: transaction.date,
        memberId: transaction.memberId,
        memberName: transaction.username || "N/A",
        planId: transaction.planId,
        planName: transaction.planName || "Group Training Plan",
        trainer: transaction.trainerName || "N/A",
        trainerId: transaction.trainerId,
        planPrice: parseFloat(transaction.price) || 0,
        totalClasses: transaction.totalClasses || 0,
        classesBooked: transaction.classesBooked || 0,
        classesConfirmed: transaction.classesConfirmed || 0,
        classesCancelled: transaction.classesCancelled || 0,
        classesCompleted: transaction.classesCompleted || 0,
        paymentMode: transaction.paymentMode || "N/A",
        time: formattedTime,
        status: transaction.computedStatus || "Inactive",
        revenue: parseFloat(transaction.price) || 0,
      };
    });

    return {
      stats: formattedStats,
      bookingsByDay,
      bookingStatus,
      transactions: formattedTransactions,
    };
  } catch (error) {
    throw new Error(
      `Error generating general trainer report: ${error.message}`
    );
  }
};

// export const generatePersonalTrainerReportService = async (adminId) => {

//   try {
//     const [stats] = await pool.query(
//       `SELECT
//         COUNT(*) as totalBookings,
//         0 as totalRevenue,
//         0 as avgTicket,
//         SUM(CASE WHEN bookingStatus = 'Confirmed' THEN 1 ELSE 0 END) as confirmed,
//         SUM(CASE WHEN bookingStatus = 'Cancelled' THEN 1 ELSE 0 END) as cancelled,
//         SUM(CASE WHEN bookingStatus = 'Booked' THEN 1 ELSE 0 END) as booked
//       FROM unified_bookings ub
//       JOIN branch b ON ub.branchId = b.id
//       WHERE b.adminId = ? AND ub.bookingType = 'PT'`,
//       [adminId]
//     );

//     const [bookingsByDay] = await pool.query(
//       `SELECT
//         DATE(ub.date) AS date,
//         COUNT(*) AS count,
//         0 AS revenue
//       FROM unified_bookings ub
//       JOIN branch b ON ub.branchId = b.id
//       WHERE b.adminId = ? AND ub.bookingType = 'PT'
//       GROUP BY DATE(ub.date)
//       ORDER BY date ASC`,
//       [adminId]
//     );

//     const [bookingStatus] = await pool.query(
//       `SELECT bookingStatus, COUNT(*) as count
//        FROM unified_bookings ub
//        JOIN branch b ON ub.branchId = b.id
//        WHERE b.adminId = ? AND ub.bookingType = 'PT'
//        GROUP BY bookingStatus`,
//       [adminId]
//     );

//     const [transactions] = await pool.query(
//       `SELECT
//         ub.date,
//         u.fullName AS trainer,
//         m.fullName AS username,
//         'Personal Training' AS type,
//         CONCAT(ub.startTime, ' - ', ub.endTime) AS time,
//         0 AS revenue,
//         ub.bookingStatus AS status
//       FROM unified_bookings ub
//       LEFT JOIN staff s ON ub.trainerId = s.id
//       LEFT JOIN user u ON s.userId = u.id
//       LEFT JOIN member m ON ub.memberId = m.id
//       JOIN branch b ON ub.branchId = b.id
//       WHERE b.adminId = ? AND ub.bookingType = 'PT'
//       ORDER BY ub.date DESC`,
//       [adminId]
//     );

//     return {
//       stats: stats[0],
//       bookingsByDay,
//       bookingStatus,
//       transactions
//     };

//   } catch (error) {
//     throw new Error("PT Report Error: " + error.message);
//   }
// };

export const generatePersonalTrainerReportService = async (
   adminId,
  trainerId = null,
  fromDate,
  toDate
) => {
  const buildDateFilter = (column, fromDate, toDate) => {
  let condition = "";
  let values = [];

  if (fromDate && toDate) {
    condition = `AND DATE(${column}) BETWEEN ? AND ?`;
    values.push(fromDate, toDate);
  } else if (fromDate) {
    condition = `AND DATE(${column}) >= ?`;
    values.push(fromDate);
  } else if (toDate) {
    condition = `AND DATE(${column}) <= ?`;
    values.push(toDate);
  }

  return { condition, values };
};

  try {
    // Build WHERE clause for trainer filter
    let trainerFilter = "";
    let trainerParams = [];
    if (trainerId) {
      trainerFilter = "AND mp.trainerId = ?";
      trainerParams = [trainerId];
    }

    // 1️⃣ Total Bookings: Count of Personal Trainer plans assigned
    // Personal Trainer plans: type = 'PERSONAL' OR (type = 'MEMBER' AND trainerType = 'personal')

    const planDateFilter = buildDateFilter(
  "mpa.assignedAt",
  fromDate,
  toDate
);

const bookingDateFilter = buildDateFilter(
  "ub.createdAt",
  fromDate,
  toDate
);

    const [[planStats]] = await pool.query(
      `SELECT 
        COUNT(*) AS totalBookings,
        COALESCE(SUM(mpa.amountPaid), 0) AS totalRevenue,
        SUM(CASE 
          WHEN mpa.membershipTo >= CURDATE() AND mpa.status = 'Active' THEN 1 
          ELSE 0 
        END) AS confirmed,
        SUM(CASE 
          WHEN mpa.membershipTo < CURDATE() OR mpa.status = 'Inactive' THEN 1 
          ELSE 0 
        END) AS cancelled
      FROM member_plan_assignment mpa
      INNER JOIN member m ON mpa.memberId = m.id
      INNER JOIN memberplan mp ON mpa.planId = mp.id
      WHERE m.adminId = ?
        ${planDateFilter.condition}
       
        AND (mp.type = 'PERSONAL' OR (mp.type = 'MEMBER' AND mp.trainerType = 'personal'))
        ${trainerFilter}`,
      [
    adminId,
    ...trainerParams,
    ...planDateFilter.values
  ]
    );

    // 2️⃣ Booked: Count of bookings from dynamic page (unified_bookings where bookingType = 'PT')
    const [[bookedStats]] = await pool.query(
      `SELECT COUNT(*) AS booked
      FROM unified_bookings ub
      INNER JOIN member m ON ub.memberId = m.id
      WHERE m.adminId = ? 
        ${bookingDateFilter.condition}
        AND ub.bookingType = 'PT'
        ${
          trainerId
            ? "AND ub.trainerId = (SELECT userId FROM staff WHERE id = ?)"
            : ""
        
        }`,
       trainerId
    ? [adminId, trainerId, ...bookingDateFilter.values]
    : [adminId, ...bookingDateFilter.values]
        
    );

    // 3️⃣ Bookings by Day: Personal Trainer plan assignments per day (with revenue)
    const [bookingsByDay] = await pool.query(
      `SELECT 
        DATE(mpa.assignedAt) AS date,
        COUNT(*) AS count,
        COALESCE(SUM(mpa.amountPaid), 0) AS revenue
      FROM member_plan_assignment mpa
      INNER JOIN member m ON mpa.memberId = m.id
      INNER JOIN memberplan mp ON mpa.planId = mp.id
      WHERE m.adminId = ?
        ${planDateFilter.condition}
        AND (mp.type = 'PERSONAL' OR (mp.type = 'MEMBER' AND mp.trainerType = 'personal'))
        ${trainerFilter}
      GROUP BY DATE(mpa.assignedAt)
      ORDER BY date ASC`,
      [adminId, ...trainerParams, ...planDateFilter.values]
    );

    // 4️⃣ Booking Status: Active and Inactive Personal Trainer plans
    const [bookingStatus] = await pool.query(
      `SELECT 
        CASE
          WHEN mpa.membershipTo >= CURDATE() AND mpa.status = 'Active' THEN 'Active'
          WHEN mpa.membershipTo < CURDATE() OR mpa.status = 'Inactive' THEN 'Inactive'
          ELSE 'Inactive'
        END AS bookingStatus,
        COUNT(*) AS count
      FROM member_plan_assignment mpa
      INNER JOIN member m ON mpa.memberId = m.id
      INNER JOIN memberplan mp ON mpa.planId = mp.id
      WHERE m.adminId = ?
        ${planDateFilter.condition}
        AND (mp.type = 'PERSONAL' OR (mp.type = 'MEMBER' AND mp.trainerType = 'personal'))
        ${trainerFilter}
      GROUP BY 
        CASE
          WHEN mpa.membershipTo >= CURDATE() AND mpa.status = 'Active' THEN 'Active'
          WHEN mpa.membershipTo < CURDATE() OR mpa.status = 'Inactive' THEN 'Inactive'
          ELSE 'Inactive'
        END`,
      [adminId, ...trainerParams, ...planDateFilter.values]
    );

    // 5️⃣ Last Transactions: All Personal Trainer plan purchases/assignments with trainer name
    const [transactions] = await pool.query(
      `SELECT 
        DATE(mpa.assignedAt) AS date,
        m.id AS memberId,
        m.fullName AS username,
        mp.id AS planId,
        mp.name AS planName,
        mp.sessions AS totalClasses,
        mpa.amountPaid AS price,
        mpa.paymentMode,
        mpa.status AS originalStatus,
        mpa.membershipTo,
        CASE
          WHEN mpa.membershipTo >= CURDATE() AND mpa.status = 'Active' THEN 'Active'
          WHEN mpa.membershipTo < CURDATE() OR mpa.status = 'Inactive' THEN 'Inactive'
          ELSE 'Inactive'
        END AS computedStatus,
        COALESCE(
          (SELECT u.fullName FROM user u WHERE u.id = mpa.assignedBy),
          'System'
        ) AS assignedBy,
        COALESCE(
          (SELECT u.fullName FROM user u 
           INNER JOIN staff s ON s.userId = u.id 
           WHERE s.id = mp.trainerId),
          'N/A'
        ) AS trainerName,
        mp.trainerId,
        TIME(mpa.assignedAt) AS time,
        -- Booking statistics for Personal Trainer plans
        -- Note: unified_bookings doesn't have planId, so we count all PT bookings for the member
        COALESCE((
          SELECT COUNT(*) 
          FROM unified_bookings ub 
          WHERE ub.memberId = m.id 
            AND ub.bookingType = 'PT'
        ), 0) AS classesBooked,
        COALESCE((
          SELECT COUNT(*) 
          FROM unified_bookings ub 
          WHERE ub.memberId = m.id 
            AND ub.bookingStatus = 'Confirmed'
            AND ub.bookingType = 'PT'
        ), 0) AS classesConfirmed,
        COALESCE((
          SELECT COUNT(*) 
          FROM unified_bookings ub 
          WHERE ub.memberId = m.id 
            AND ub.bookingStatus = 'Cancelled'
            AND ub.bookingType = 'PT'
        ), 0) AS classesCancelled,
        COALESCE((
          SELECT COUNT(*) 
          FROM unified_bookings ub 
          WHERE ub.memberId = m.id 
            AND ub.bookingStatus = 'Completed'
            AND ub.bookingType = 'PT'
        ), 0) AS classesCompleted
      FROM member_plan_assignment mpa
      INNER JOIN member m ON mpa.memberId = m.id
      INNER JOIN memberplan mp ON mpa.planId = mp.id
      WHERE m.adminId = ?
        ${planDateFilter.condition}
        AND (mp.type = 'PERSONAL' OR (mp.type = 'MEMBER' AND mp.trainerType = 'personal'))
        ${trainerFilter}
      ORDER BY mpa.assignedAt DESC
      LIMIT 100`,
      [adminId, ...trainerParams, ...planDateFilter.values]
    );

    // Format output for UI
    const formattedStats = {
      totalBookings: planStats.totalBookings || 0,
      totalRevenue: parseFloat(planStats.totalRevenue) || 0,
      confirmed: planStats.confirmed || 0,
      cancelled: planStats.cancelled || 0,
      booked: bookedStats.booked || 0,
      avgTicket:
        planStats.totalBookings > 0
          ? parseFloat(planStats.totalRevenue) / planStats.totalBookings
          : 0,
    };

    // Format transactions data
    const formattedTransactions = transactions.map((transaction) => {
      // Format time to HH:MM if it exists
      let formattedTime = "-";
      if (transaction.time) {
        const timeStr = String(transaction.time);
        if (timeStr.includes(":")) {
          formattedTime = timeStr.substring(0, 5);
        } else {
          formattedTime = timeStr;
        }
      }

      return {
        date: transaction.date,
        memberId: transaction.memberId,
        memberName: transaction.username || "N/A",
        planId: transaction.planId,
        planName: transaction.planName || "Personal Training Plan",
        trainer: transaction.trainerName || "N/A",
        trainerId: transaction.trainerId,
        planPrice: parseFloat(transaction.price) || 0,
        totalClasses: transaction.totalClasses || 0,
        classesBooked: transaction.classesBooked || 0,
        classesConfirmed: transaction.classesConfirmed || 0,
        classesCancelled: transaction.classesCancelled || 0,
        classesCompleted: transaction.classesCompleted || 0,
        paymentMode: transaction.paymentMode || "N/A",
        time: formattedTime,
        status: transaction.computedStatus || "Inactive",
        revenue: parseFloat(transaction.price) || 0,
      };
    });

    return {
      stats: formattedStats,
      bookingsByDay,
      bookingStatus,
      transactions: formattedTransactions,
    };
  } catch (error) {
    throw new Error(
      `Error generating personal trainer report: ${error.message}`
    );
  }
};

// export const getReceptionReportService = async (adminId) => {

//   // 1️⃣ Get admin's branchId
//   const [adminData] = await pool.query(
//     `SELECT branchId FROM user WHERE id = ? LIMIT 1`,
//     [adminId]
//   );

//   if (adminData.length === 0) {
//     return { error: "Admin not found" };
//   }

//   const branchId = adminData[0].branchId;

//   // ------------------ SUMMARY (ALL TIME) ------------------

//   // ✔ All-time check-ins
//   const [[checkinsSummary]] = await pool.query(
//     `SELECT COUNT(*) AS total
//      FROM memberattendance
//      WHERE branchId = ?`,
//     [branchId]
//   );

//   // ✔ All-time new members
//   const [[newMembersSummary]] = await pool.query(
//     `SELECT COUNT(*) AS total
//      FROM member
//      WHERE branchId = ?`,
//     [branchId]
//   );

//   // ✔ All-time payments (No branchId column)
//   const [[paymentsSummary]] = await pool.query(
//     `SELECT IFNULL(SUM(amount), 0) AS total
//      FROM payment`
//   );

//   // ✔ All PT bookings
//   const [[ptSummary]] = await pool.query(
//     `SELECT COUNT(*) AS total
//      FROM unified_bookings
//      WHERE branchId = ?
//      AND bookingType = 'PT'`,
//     [branchId]
//   );

//   // ✔ All Class bookings
//   const [[classSummary]] = await pool.query(
//     `SELECT COUNT(*) AS total
//      FROM unified_bookings
//      WHERE branchId = ?
//      AND bookingType = 'CLASS'`,
//     [branchId]
//   );

//   // ------------------ FULL LISTS (ALL TIME) ------------------

//   // All Check-ins list
//   const [checkinsList] = await pool.query(
//     `SELECT *
//      FROM memberattendance
//      WHERE branchId = ?`,
//     [branchId]
//   );

//   // All Members list
//   const [newMembersList] = await pool.query(
//     `SELECT *
//      FROM member
//      WHERE branchId = ?`,
//     [branchId]
//   );

//   // All Payments list
//   const [paymentsList] = await pool.query(
//     `SELECT *
//      FROM payment`
//   );

//   // All PT Bookings list
//   const [ptList] = await pool.query(
//     `SELECT *
//      FROM unified_bookings
//      WHERE branchId = ?
//      AND bookingType = 'PT'`,
//     [branchId]
//   );

//   // All Class Bookings list
//   const [classList] = await pool.query(
//     `SELECT *
//      FROM unified_bookings
//      WHERE branchId = ?
//      AND bookingType = 'CLASS'`,
//     [branchId]
//   );

//   // ------------------ FINAL RETURN ------------------

//   return {
//     success: true,
//     summary: {
//       totalCheckins: checkinsSummary.total,
//       totalMembers: newMembersSummary.total,
//       totalPayments: paymentsSummary.total,
//       totalPTBookings: ptSummary.total,
//       totalClassBookings: classSummary.total
//     },
//     checkins: checkinsList,
//     members: newMembersList,
//     payments: paymentsList,
//     ptSessions: ptList,
//     classSessions: classList
//   };
// };

export const getReceptionReportService = async (adminId,
  fromDate,
  toDate

  
) =>
   {
    const buildDateFilter = (column, fromDate, toDate) => {
  let condition = "";
  let values = [];

  if (fromDate && toDate) {
    condition = `AND DATE(${column}) BETWEEN ? AND ?`;
    values.push(fromDate, toDate);
  } else if (fromDate) {
    condition = `AND DATE(${column}) >= ?`;
    values.push(fromDate);
  } else if (toDate) {
    condition = `AND DATE(${column}) <= ?`;
    values.push(toDate);
  }

  return { condition, values };
};

  try {
    console.log("Reception Report - adminId:", adminId);

    // ---------------- GET ALL RECEPTIONIST USER IDs UNDER THIS ADMIN ----------------
    const dateFilter = buildDateFilter(
  "mpa.assignedAt",
  fromDate,
  toDate
);
const [receptionistUsers] = await pool.query(
  `
  SELECT u.id AS userId, u.fullName, s.id AS staffId
  FROM staff s
  JOIN user u ON s.userId = u.id
  WHERE s.adminId = ? AND u.roleId = 7
  `,
  [adminId]
);


    if (receptionistUsers.length === 0) {
      console.log("No receptionists found for admin:", adminId);
      return {
        success: true,
        data: {
          stats: {
            totalBookings: 0,
            totalRevenue: 0,
            avgTicket: 0,
            confirmed: 0,
            cancelled: 0,
            booked: 0,
          },
          bookingsByDay: [],
          bookingStatus: [],
          transactions: [],
        },
      };
    }

    const receptionistUserIds = receptionistUsers.map((r) => r.userId);
    console.log("Receptionist User IDs:", receptionistUserIds);

    // Create placeholders for IN clause
    const placeholders = receptionistUserIds.map(() => "?").join(",");

    // 1️⃣ Total Bookings: Count of plan assignments made by receptionists

    const planDateFilter = buildDateFilter(
  "mpa.assignedAt",
  fromDate,
  toDate
);
const [[planStats]] = await pool.query(
  `
  SELECT 
    COUNT(*) AS totalBookings,
    COALESCE(SUM(mpa.amountPaid), 0) AS totalRevenue,
    SUM(CASE 
      WHEN mpa.membershipTo >= CURDATE() AND mpa.status = 'Active' THEN 1 
      ELSE 0 
    END) AS confirmed,
    SUM(CASE 
      WHEN mpa.membershipTo < CURDATE() OR mpa.status = 'Inactive' THEN 1 
      ELSE 0 
    END) AS cancelled
  FROM member_plan_assignment mpa
  INNER JOIN member m ON mpa.memberId = m.id
  WHERE m.adminId = ?
  ${planDateFilter.condition}
    AND (
      mpa.assignedBy IN (${placeholders})
      OR mpa.assignedBy = ?
    )
  `,
  [adminId, ...dateFilter.values, ...receptionistUserIds, adminId]
);



    console.log("Plan Stats:", planStats);

    // 2️⃣ Booked: Count of PT bookings for members whose plans were assigned by receptionists

    const bookingDateFilter = buildDateFilter(
  "ub.createdAt",
  fromDate,
  toDate
);
const [[bookedStats]] = await pool.query(
  `
  SELECT COUNT(*) AS booked
  FROM unified_bookings ub
  INNER JOIN member m ON ub.memberId = m.id
  WHERE m.adminId = ?
  ${bookingDateFilter.condition}
    AND ub.bookingType = 'PT'
    AND EXISTS (
      SELECT 1
      FROM member_plan_assignment mpa
      WHERE mpa.memberId = m.id
        AND (
          mpa.assignedBy IN (${placeholders})
          OR mpa.assignedBy = ?
        )
    )
  `,
  [adminId, ...dateFilter.values, ...receptionistUserIds, adminId]
);


    console.log("Booked Stats:", bookedStats);

    // 3️⃣ Bookings by Day: Day-by-day revenue from receptionist plan assignments
const [bookingsByDay] = await pool.query(
  `
  SELECT 
    DATE(mpa.assignedAt) AS date,
    COUNT(*) AS count,
    COALESCE(SUM(mpa.amountPaid), 0) AS revenue
  FROM member_plan_assignment mpa
  INNER JOIN member m ON mpa.memberId = m.id
  WHERE m.adminId = ?
    ${dateFilter.condition}
    AND (
      mpa.assignedBy IN (${placeholders})
      OR mpa.assignedBy = ?
    )
  GROUP BY DATE(mpa.assignedAt)
  ORDER BY date ASC
  `,
  [adminId, ...dateFilter.values, ...receptionistUserIds, adminId]
);



    console.log("Bookings By Day Count:", bookingsByDay.length);

    // 4️⃣ Booking Status: Active and Inactive members assigned by receptionists
const [bookingStatus] = await pool.query(
  `
  SELECT 
    CASE
      WHEN mpa.membershipTo >= CURDATE() AND mpa.status = 'Active' THEN 'Active'
      ELSE 'Inactive'
    END AS bookingStatus,
    COUNT(*) AS count
  FROM member_plan_assignment mpa
  INNER JOIN member m ON mpa.memberId = m.id
  WHERE m.adminId = ?
    ${dateFilter.condition}
    AND (
      mpa.assignedBy IN (${placeholders})
      OR mpa.assignedBy = ?
    )
  GROUP BY bookingStatus
  `,
  [adminId, ...dateFilter.values, ...receptionistUserIds, adminId]
);



    console.log("Booking Status Count:", bookingStatus.length);

    // 5️⃣ Transactions: All members added/assigned by receptionists
const [transactions] = await pool.query(
  `
  SELECT 
    DATE(mpa.assignedAt) AS date,
    m.id AS memberId,
    m.fullName AS username,
    mp.id AS planId,
    mp.name AS planName,
    mpa.amountPaid AS price,
    mpa.paymentMode,
    CASE
      WHEN mpa.membershipTo >= CURDATE() AND mpa.status = 'Active' THEN 'Active'
      ELSE 'Inactive'
    END AS computedStatus,
    u.fullName AS assignedBy,
    TIME(mpa.assignedAt) AS time
  FROM member_plan_assignment mpa
  INNER JOIN member m ON mpa.memberId = m.id
  LEFT JOIN memberplan mp ON mpa.planId = mp.id
  LEFT JOIN user u ON u.id = mpa.assignedBy
  WHERE m.adminId = ?
    ${dateFilter.condition}
    AND (
      mpa.assignedBy IN (${placeholders})
      OR mpa.assignedBy = ?
    )
  ORDER BY mpa.assignedAt DESC
  LIMIT 100
  `,
  [adminId, ...dateFilter.values, ...receptionistUserIds, adminId]

);



    console.log("Transactions Count:", transactions.length);

    // Format output for UI (matching Personal Trainer report structure)
    const formattedStats = {
      totalBookings: planStats.totalBookings || 0,
      totalRevenue: parseFloat(planStats.totalRevenue) || 0,
      confirmed: planStats.confirmed || 0,
      cancelled: planStats.cancelled || 0,
      booked: bookedStats.booked || 0,
      avgTicket:
        planStats.totalBookings > 0
          ? parseFloat(planStats.totalRevenue) / planStats.totalBookings
          : 0,
    };

    // Format transactions data (matching Personal Trainer report structure)
    const formattedTransactions = transactions.map((transaction) => {
      // Format time to HH:MM if it exists
      let formattedTime = "-";
      if (transaction.time) {
        const timeStr = String(transaction.time);
        if (timeStr.includes(":")) {
          formattedTime = timeStr.substring(0, 5);
        } else {
          formattedTime = timeStr;
        }
      }

      return {
        date: transaction.date,
        memberId: transaction.memberId,
        memberName: transaction.username || "N/A",
        username: transaction.username || "N/A",
        planId: transaction.planId,
        planName: transaction.planName || "Plan Assignment",
        trainer: transaction.trainerName || transaction.assignedBy || "N/A",
        trainerName: transaction.trainerName || transaction.assignedBy || "N/A",
        assignedBy: transaction.assignedBy || "System",
        trainerId: transaction.trainerId,
        planPrice: parseFloat(transaction.price) || 0,
        price: parseFloat(transaction.price) || 0,
        revenue: parseFloat(transaction.price) || 0,
        totalClasses: transaction.totalClasses || 0,
        classesBooked: transaction.classesBooked || 0,
        classesConfirmed: transaction.classesConfirmed || 0,
        classesCancelled: transaction.classesCancelled || 0,
        classesCompleted: transaction.classesCompleted || 0,
        paymentMode: transaction.paymentMode || "N/A",
        time: formattedTime,
        status: transaction.computedStatus || "Inactive",
        computedStatus: transaction.computedStatus || "Inactive",
        type: transaction.planName || "Plan Assignment",
      };
    });

    console.log("Formatted Stats:", formattedStats);

    return {
      success: true,
      data: {
        stats: formattedStats,
        bookingsByDay,
        bookingStatus,
        transactions: formattedTransactions,
      },
    };
  } catch (error) {
    console.error("Reception Report Error:", error);
    throw new Error(`Error generating receptionist report: ${error.message}`);
  }
};

// export const getMemberAttendanceReportService = async (adminId) => {
//   // 1️⃣ Fetch all branches of this admin
//   const [branches] = await pool.query(
//     `SELECT id FROM branch WHERE adminId = ?`,
//     [adminId]
//   );

//   if (branches.length === 0) return { error: "No branches found" };

//   const branchIds = branches.map(b => b.id);

//   // ------------------------------------------------------------
//   // 🔵 PART-1: ATTENDANCE HEATMAP (LAST 30 DAYS)
//   // ------------------------------------------------------------

//   const [heatmap] = await pool.query(
//     `
//     SELECT
//       DATE(checkIn) AS date,
//       COUNT(*) AS checkins
//     FROM memberattendance
//     WHERE branchId IN (?)
//       AND DATE(checkIn) >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
//     GROUP BY DATE(checkIn)
//     ORDER BY DATE(checkIn)
//     `,
//     [branchIds]
//   );

//   // ------------------------------------------------------------
//   // 🔵 PART-2: MEMBER-WISE ATTENDANCE SUMMARY
//   // ------------------------------------------------------------

//   const [memberStats] = await pool.query(
//     `
//     SELECT
//       m.id AS memberId,
//       m.fullName,
//       COUNT(ma.id) AS totalCheckins,

//       SUM(
//         CASE
//           WHEN ma.checkOut IS NOT NULL THEN
//             TIMESTAMPDIFF(
//               MINUTE,
//               ma.checkIn,
//               ma.checkOut
//             )
//           ELSE 0
//         END
//       ) AS totalMinutes,

//       SUM(
//         CASE
//           WHEN ma.checkOut IS NULL THEN 1
//           ELSE 0
//         END
//       ) AS noShows

//     FROM member m
//     LEFT JOIN memberattendance ma
//       ON ma.memberId = m.id
//       AND ma.branchId IN (?)

//     WHERE m.branchId IN (?)

//     GROUP BY m.id, m.fullName
//     ORDER BY m.fullName;
//     `,
//     [branchIds, branchIds]
//   );

//   // Convert session minutes → average session time
//   const finalMemberStats = memberStats.map(m => ({
//     memberId: m.memberId,
//     fullName: m.fullName,
//     checkins: m.totalCheckins,
//     noShows: m.noShows,
//     avgSessionTime: m.totalCheckins > 0
//       ? Math.round(m.totalMinutes / m.totalCheckins) + " min"
//       : "0 min"
//   }));

//   return {
//     heatmap,
//     members: finalMemberStats
//   };
// };

// export const getMemberAttendanceReportService = async (adminId) => {
//   // 1️⃣ Get all members under this admin
//   const [members] = await pool.query(
//     `SELECT m.id AS memberId, m.userId
//      FROM member m
//      WHERE m.adminId = ?`,
//     [adminId]
//   );

//   if (members.length === 0) return { error: "No members found" };

//   const memberIds = members.map((m) => m.memberId); // Ensure it's 'memberId'
//   const userIds = members.map((m) => m.userId);

//   // Dynamically create placeholders for the IN clause
//   const placeholders = memberIds.map(() => "?").join(",");

//   console.log(
//     "SQL Query with Member IDs:",
//     `
//     SELECT
//       DATE(checkIn) AS date,
//       COUNT(*) AS checkins
//     FROM memberattendance
//     WHERE memberId IN (${placeholders})
//       AND DATE(checkIn) >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
//     GROUP BY DATE(checkIn)
//     ORDER BY DATE(checkIn)
//   `
//   );

//   console.log("Member IDs:", memberIds);

//   // 2️⃣ Execute the query for heatmap data
//   const [heatmap] = await pool.query(
//     `
//     SELECT
//       DATE(checkIn) AS date,
//       COUNT(*) AS checkins
//     FROM memberattendance
//     WHERE memberId IN (${placeholders})
//       AND DATE(checkIn) >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
//     GROUP BY DATE(checkIn)
//     ORDER BY DATE(checkIn)
//     `,
//     memberIds // Pass the memberIds array as the parameter
//   );

//   console.log("Heatmap Results:", heatmap); // Check what the query returns

//   // ------------------------------------------------------------
//   // 🔵 PART-2: MEMBER-WISE ATTENDANCE SUMMARY (NO JOIN ISSUES)
//   // ------------------------------------------------------------

//   const [attendanceSummary] = await pool.query(
//     `
//     SELECT
//       memberId,
//       COUNT(id) AS totalCheckins,

//       SUM(
//         CASE
//           WHEN checkOut IS NULL THEN 1
//           ELSE 0
//         END
//       ) AS noShows,

//       SUM(
//         CASE
//           WHEN checkOut IS NOT NULL THEN
//             TIMESTAMPDIFF(MINUTE, checkIn, checkOut)
//           ELSE 0
//         END
//       ) AS totalMinutes

//     FROM memberattendance
//     WHERE memberId IN (?)
//     GROUP BY memberId
//     `,
//     [memberIds]
//   );

//   const [users] = await pool.query(
//     `
//     SELECT id AS userId, fullName
//     FROM user
//     WHERE id IN (?)
//     `,
//     [userIds]
//   );

//   // Create a map of userId to fullName
//   const userMap = {};
//   users.forEach((u) => {
//     userMap[u.userId] = u.fullName;
//   });

//   // Final formatted response
//   const finalMembers = attendanceSummary.map((r) => ({
//     memberId: r.memberId,
//     fullName: userMap[r.userId] || "Unknown Member", // Use userId to get fullName
//     checkins: r.totalCheckins,
//     noShows: r.noShows,
//     avgSessionTime:
//       r.totalCheckins > 0
//         ? Math.round(r.totalMinutes / r.totalCheckins) + " min"
//         : "0 min",
//   }));

//   return {
//     heatmap,
//     members: finalMembers,
//   };
// };
export const getMemberAttendanceReportService = async (adminId) => {
  // 1️⃣ Get all members under this admin
  const [members] = await pool.query(
    `SELECT m.id AS memberId, m.userId, m.fullName
     FROM member m
     WHERE m.adminId = ?`,
    [adminId]
  );

  if (members.length === 0) return { error: "No members found" };

  const memberIds = members.map((m) => m.memberId); // Ensure it's 'memberId'
  const userIds = members.map((m) => m.userId);

  // Dynamically create placeholders for the IN clause
  const placeholders = memberIds.map(() => "?").join(",");

  // 2️⃣ Execute the query for heatmap data
  const [heatmap] = await pool.query(
    `
    SELECT 
      DATE(checkIn) AS date,
      COUNT(*) AS checkins
    FROM memberattendance
    WHERE memberId IN (${placeholders})
      AND DATE(checkIn) >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
    GROUP BY DATE(checkIn)
    ORDER BY DATE(checkIn)
    `,
    memberIds
  );

  // ------------------------------------------------------------
  // 🔵 PART-2: MEMBER-WISE ATTENDANCE SUMMARY (NO JOIN ISSUES)
  // ------------------------------------------------------------

  const [attendanceSummary] = await pool.query(
    `
    SELECT 
      memberId,
      COUNT(id) AS totalCheckins,
      
      SUM(
        CASE 
          WHEN checkOut IS NULL THEN 1 
          ELSE 0 
        END
      ) AS noShows,

      SUM(
        CASE 
          WHEN checkOut IS NOT NULL THEN 
            TIMESTAMPDIFF(MINUTE, checkIn, checkOut)
          ELSE 0 
        END
      ) AS totalMinutes

    FROM memberattendance
    WHERE memberId IN (?)
    GROUP BY memberId
    `,
    [memberIds]
  );

  const [users] = await pool.query(
    `
    SELECT id AS userId, fullName
    FROM user
    WHERE id IN (?)
    `,
    [userIds]
  );

  // Create a map of userId to fullName
  const userMap = {};
  users.forEach((u) => {
    userMap[u.userId] = u.fullName;
  });

  // Final formatted response with fallback for missing userId
  const finalMembers = attendanceSummary.map((r) => {
    // Check if userId exists in the userMap
    const memberFullName =
      userMap[r.userId] ||
      members.find((m) => m.memberId === r.memberId)?.fullName ||
      "Unknown Member";

    return {
      memberId: r.memberId,
      fullName: memberFullName, // Use fallback name or member's full name
      checkins: r.totalCheckins,
      noShows: r.noShows,
      avgSessionTime:
        r.totalCheckins > 0
          ? Math.round(r.totalMinutes / r.totalCheckins) + " min"
          : "0 min",
    };
  });

  return {
    heatmap,
    members: finalMembers,
  };
};

// export const generateManagerReportService = async (adminId) => {
//   try {
//     const [branches] = await pool.query(
//       `SELECT id FROM branch WHERE adminId = ?`,
//       [adminId]
//     );

//     if (branches.length === 0) {
//       return {
//         memberOverview: {},
//         revenueSummary: {},
//         sessionsSummary: {},
//         classSummary: {},
//         inventorySummary: {},
//         alertTaskSummary: {},
//       };
//     }

//     const branchIds = branches.map((b) => b.id);
//     const ph = branchIds.map(() => "?").join(",");

//     const [
//       memberOverviewData,
//       revenueSummaryData,
//       sessionsSummaryData,
//       classSummaryData,
//       inventorySummaryData,
//       alertTaskSummaryData,
//     ] = await Promise.all([
//       // MEMBER OVERVIEW
//       pool.query(
//         `SELECT
//             COUNT(*) AS totalMembers,
//             SUM(CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END) AS activeMembers,
//             SUM(CASE WHEN DATE(joinDate) = CURDATE() THEN 1 ELSE 0 END) AS newMembersToday,
//             SUM(CASE WHEN membershipTo BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)
//                      THEN 1 ELSE 0 END) AS expiringSoon,
//             (
//               SELECT COUNT(*)
//               FROM memberattendance
//               WHERE DATE(checkIn) = CURDATE()
//                 AND branchId IN (${ph})
//             ) AS todayCheckins
//          FROM member
//          WHERE branchId IN (${ph})`,
//         [...branchIds, ...branchIds]
//       ),

//       // REVENUE SUMMARY
//       pool.query(
//         `SELECT
//             IFNULL(SUM(amount), 0) AS monthlyRevenue,
//             IFNULL(SUM(CASE WHEN DATE(paymentDate) = CURDATE() THEN amount ELSE 0 END), 0) AS todayRevenue,
//             IFNULL(SUM(gstAmount), 0) AS gstTotal
//          FROM payment
//          WHERE memberId IN (
//             SELECT id FROM member WHERE branchId IN (${ph})
//          )`,
//         branchIds
//       ),

//       // SESSIONS SUMMARY
//       pool.query(
//         `SELECT
//             COUNT(*) AS totalSessions,
//             IFNULL(SUM(CASE WHEN bookingStatus = 'Completed' THEN 1 ELSE 0 END), 0) AS completedSessions,
//             IFNULL(SUM(CASE WHEN bookingStatus = 'Cancelled' THEN 1 ELSE 0 END), 0) AS cancelledSessions,
//             (
//               SELECT u.fullName
//               FROM unified_bookings ub
//               LEFT JOIN user u ON ub.trainerId = u.id
//               WHERE ub.branchId IN (${ph})
//                 AND ub.bookingStatus = 'Completed'
//               GROUP BY ub.trainerId
//               ORDER BY COUNT(*) DESC
//               LIMIT 1
//             ) AS topTrainer
//          FROM unified_bookings
//          WHERE branchId IN (${ph})`,
//         [...branchIds, ...branchIds]
//       ),

//       // CLASS SUMMARY
//       pool.query(
//         `SELECT
//             (
//               SELECT COUNT(*)
//               FROM classschedule
//               WHERE DATE(date) = CURDATE()
//                 AND branchId IN (${ph})
//             ) AS todayClasses,

//             (
//               SELECT COUNT(*)
//               FROM group_class_bookings
//               WHERE DATE(date) = CURDATE()
//                 AND branchId IN (${ph})
//             ) AS todayClassAttendance,

//             (
//               SELECT className
//               FROM classschedule
//               WHERE branchId IN (${ph})
//               GROUP BY className
//               ORDER BY COUNT(*) DESC
//               LIMIT 1
//             ) AS popularClass`,
//         [...branchIds, ...branchIds, ...branchIds]
//       ),

//       // INVENTORY SUMMARY
//       pool.query(
//         `SELECT
//             COUNT(*) AS totalProducts,
//             IFNULL(SUM(CASE WHEN currentStock < 5 THEN 1 ELSE 0 END), 0) AS lowStockItems
//          FROM product
//          WHERE branchId IN (${ph})`,
//         branchIds
//       ),

//       // ALERTS + TASKS
//       pool.query(
//         `SELECT
//             (
//               SELECT COUNT(*)
//               FROM tasks
//               WHERE status != 'Completed'
//                 AND branchId IN (${ph})
//             ) AS pendingTasks,

//             (
//               SELECT COUNT(*)
//               FROM alert
//               WHERE branchId IN (${ph})
//             ) AS totalAlerts`,
//         [...branchIds, ...branchIds]
//       ),
//     ]);

//     return {
//       memberOverview: memberOverviewData[0][0],
//       revenueSummary: revenueSummaryData[0][0],
//       sessionsSummary: sessionsSummaryData[0][0],
//       classSummary: classSummaryData[0][0],
//       inventorySummary: inventorySummaryData[0][0],
//       alertTaskSummary: alertTaskSummaryData[0][0],
//     };
//   } catch (error) {
//     throw new Error(`Manager Report Error: ${error.message}`);
//   }
// };

// export const generatePersonalTrainerReportByStaffService = async (adminId, staffId) => {

//   try {
//     // 1️⃣ Verify the staff belongs to the admin
//     const [staffVerification] = await pool.query(
//       `SELECT s.id, s.userId, u.fullName
//        FROM staff s
//        JOIN user u ON s.userId = u.id
//        WHERE s.id = ? AND s.adminId = ?`,
//       [staffId, adminId]
//     );

//     if (staffVerification.length === 0) {
//       return {
//         stats: {
//           totalBookings: 0,
//           confirmed: 0,
//           cancelled: 0,
//           booked: 0
//         },
//         bookingsByDay: [],
//         bookingStatus: [],
//         transactions: []
//       };
//     }

//     // Get the userId of the staff member
//     const staffUserId = staffVerification[0].userId;

//     // 2️⃣ PT booking stats for this specific staff member
//     const [bookingStats] = await pool.query(
//       `SELECT
//         COUNT(*) as totalBookings,
//         SUM(CASE WHEN bookingStatus = 'Completed' THEN 1 ELSE 0 END) as confirmed,
//         SUM(CASE WHEN bookingStatus = 'Cancelled' THEN 1 ELSE 0 END) as cancelled,
//         SUM(CASE WHEN bookingStatus = 'Booked' THEN 1 ELSE 0 END) as booked
//       FROM unified_bookings
//       WHERE trainerId = ?
//         AND bookingType = 'PT'`,
//       [staffUserId]
//     );

//     // 3️⃣ PT bookings group by day for this staff member
//     const [bookingsByDay] = await pool.query(
//       `SELECT
//         DATE(createdAt) AS date,
//         COUNT(*) AS count
//       FROM unified_bookings
//       WHERE trainerId = ?
//         AND bookingType = 'PT'
//       GROUP BY DATE(createdAt)
//       ORDER BY date ASC`,
//       [staffUserId]
//     );

//     // 4️⃣ PT booking status distribution for this staff member
//     const [bookingStatus] = await pool.query(
//       `SELECT
//         bookingStatus,
//         COUNT(*) AS count
//       FROM unified_bookings
//       WHERE trainerId = ?
//         AND bookingType = 'PT'
//       GROUP BY bookingStatus`,
//       [staffUserId]
//     );

//     // 5️⃣ PT transactions list for this staff member
//     const [transactions] = await pool.query(
//       `SELECT
//           ub.date,
//           trainerUser.fullName AS trainerName,
//           memberUser.fullName AS memberName,
//           'Personal Training' AS type,
//           ub.startTime AS time,
//           ub.bookingStatus AS status
//         FROM unified_bookings ub
//         LEFT JOIN user AS trainerUser
//               ON ub.trainerId = trainerUser.id
//         LEFT JOIN member AS m
//               ON ub.memberId = m.id
//         LEFT JOIN user AS memberUser
//               ON m.userId = memberUser.id
//         WHERE ub.trainerId = ?
//           AND ub.bookingType = 'PT'
//         ORDER BY ub.date DESC`,
//       [staffUserId]
//     );

//     // Format output for UI
//     const formattedStats = {
//       totalBookings: bookingStats[0].totalBookings || 0,
//       confirmed: bookingStats[0].confirmed || 0,
//       cancelled: bookingStats[0].cancelled || 0,
//       booked: bookingStats[0].booked || 0
//     };

//     const formattedTransactions = transactions.map(tx => ({
//       date: tx.date,
//       trainer: tx.trainerName || 'N/A',
//       username: tx.memberName || 'N/A',
//       type: tx.type,
//       time: tx.time,
//       status: tx.status
//     }));

//     return {
//       stats: formattedStats,
//       bookingsByDay,
//       bookingStatus,
//       transactions: formattedTransactions
//     };

//   } catch (error) {
//     throw new Error(`Error generating personal trainer report by staff: ${error.message}`);
//   }
// };

// export const generatePersonalTrainerReportByStaffService = async (adminId, staffId) => {
//   try {
//     // 1️⃣ Verify the staff belongs to the admin
//     const [staffVerification] = await pool.query(
//       `SELECT s.id, s.userId, u.fullName
//        FROM staff s
//        JOIN user u ON s.userId = u.id
//        WHERE s.id = ? AND s.adminId = ?`,
//       [staffId, adminId]
//     );

//     if (staffVerification.length === 0) {
//       return {
//         stats: {
//           totalBookings: 0,
//           confirmed: 0,
//           cancelled: 0,
//           booked: 0
//         },
//         bookingsByDay: [],
//         bookingStatus: [],
//         transactions: []
//       };
//     }

//     // Get the userId of the staff member
//     const staffUserId = staffVerification[0].userId;

//     // 2️⃣ PT booking stats for this specific staff member
//     const [bookingStats] = await pool.query(
//       `SELECT
//         COUNT(*) as totalBookings,
//         SUM(CASE WHEN bookingStatus = 'Completed' THEN 1 ELSE 0 END) as confirmed,
//         SUM(CASE WHEN bookingStatus = 'Cancelled' THEN 1 ELSE 0 END) as cancelled,
//         SUM(CASE WHEN bookingStatus = 'Booked' THEN 1 ELSE 0 END) as booked
//       FROM unified_bookings
//       WHERE trainerId = ?
//         AND bookingType = 'PT'`,
//       [staffUserId]
//     );

//     // 3️⃣ PT bookings group by day for this staff member
//     const [bookingsByDay] = await pool.query(
//       `SELECT
//         DATE(createdAt) AS date,
//         COUNT(*) AS count
//       FROM unified_bookings
//       WHERE trainerId = ?
//         AND bookingType = 'PT'
//       GROUP BY DATE(createdAt)
//       ORDER BY date ASC`,
//       [staffUserId]
//     );

//     // 4️⃣ PT booking status distribution for this staff member
//     const [bookingStatus] = await pool.query(
//       `SELECT
//         bookingStatus,
//         COUNT(*) AS count
//       FROM unified_bookings
//       WHERE trainerId = ?
//         AND bookingType = 'PT'
//       GROUP BY bookingStatus`,
//       [staffUserId]
//     );

//     // 5️⃣ PT transactions list for this staff member (FIXED)
//     const [transactions] = await pool.query(
//       `SELECT
//           ub.date,
//           trainerUser.fullName AS trainerName,
//           m.fullName AS memberName,  -- Get name directly from member table
//           'Personal Training' AS type,
//           ub.startTime AS time,
//           ub.bookingStatus AS status
//         FROM unified_bookings ub
//         LEFT JOIN user AS trainerUser
//               ON ub.trainerId = trainerUser.id
//         LEFT JOIN member AS m
//               ON ub.memberId = m.id
//         WHERE ub.trainerId = ?
//           AND ub.bookingType = 'PT'
//         ORDER BY ub.date DESC`,
//       [staffUserId]
//     );

//     // Format output for UI
//     const formattedStats = {
//       totalBookings: bookingStats[0].totalBookings || 0,
//       confirmed: bookingStats[0].confirmed || 0,
//       cancelled: bookingStats[0].cancelled || 0,
//       booked: bookingStats[0].booked || 0
//     };

//     const formattedTransactions = transactions.map(tx => ({
//       date: tx.date,
//       trainer: tx.trainerName || 'N/A',
//       username: tx.memberName || 'N/A',
//       type: tx.type,
//       time: tx.time,
//       status: tx.status
//     }));

//     return {
//       stats: formattedStats,
//       bookingsByDay,
//       bookingStatus,
//       transactions: formattedTransactions
//     };

//   } catch (error) {
//     throw new Error(`Error generating personal trainer report by staff: ${error.message}`);
//   }
// };

export const generateManagerReportService = async (adminId) => {
  try {
    const [
      memberOverviewData,
      revenueSummaryData,
      sessionsSummaryData,
      classSummaryData,
      inventorySummaryData,
      alertTaskSummaryData,
    ] = await Promise.all([
      // MEMBER OVERVIEW
      pool.query(
        `SELECT
            COUNT(*) AS totalMembers,
            SUM(CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END) AS activeMembers,
            SUM(CASE WHEN DATE(joinDate) = CURDATE() THEN 1 ELSE 0 END) AS newMembersToday,
            SUM(CASE WHEN membershipTo BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)
                     THEN 1 ELSE 0 END) AS expiringSoon,
            (
              SELECT COUNT(*) 
              FROM memberattendance 
              WHERE DATE(checkIn) = CURDATE()
                AND memberId IN (SELECT userId FROM member WHERE adminId = ?)
            ) AS todayCheckins
         FROM member
         WHERE adminId = ?`,
        [adminId, adminId]
      ),

      // REVENUE SUMMARY
      pool.query(
        `SELECT 
            IFNULL(SUM(amount), 0) AS monthlyRevenue,
            IFNULL(SUM(CASE WHEN DATE(paymentDate) = CURDATE() THEN amount ELSE 0 END), 0) AS todayRevenue,
            IFNULL(SUM(gstAmount), 0) AS gstTotal
         FROM payment
         WHERE memberId IN (SELECT id FROM member WHERE adminId = ?)`,
        [adminId]
      ),

      // SESSIONS SUMMARY
      pool.query(
        `SELECT
            COUNT(*) AS totalSessions,
            IFNULL(SUM(CASE WHEN bookingStatus = 'Completed' THEN 1 ELSE 0 END), 0) AS completedSessions,
            IFNULL(SUM(CASE WHEN bookingStatus = 'Cancelled' THEN 1 ELSE 0 END), 0) AS cancelledSessions,
            (
              SELECT u.fullName
              FROM unified_bookings ub
              LEFT JOIN user u ON ub.trainerId = u.id
              WHERE ub.bookingStatus = 'Completed'
                AND ub.memberId IN (SELECT id FROM member WHERE adminId = ?)
              GROUP BY ub.trainerId
              ORDER BY COUNT(*) DESC
              LIMIT 1
            ) AS topTrainer
         FROM unified_bookings
         WHERE memberId IN (SELECT id FROM member WHERE adminId = ?);`,
        [adminId, adminId]
      ),

      // CLASS SUMMARY
      pool.query(
        `SELECT
            (
              SELECT COUNT(*) 
              FROM classschedule cs
              INNER JOIN user u ON cs.trainerId=u.id 
              WHERE DATE(cs.date) = CURDATE()
                AND u.adminId = ?
            ) AS todayClasses,

            (
              SELECT COUNT(*) 
              FROM group_class_bookings 
              WHERE DATE(date) = CURDATE()
                AND memberId IN (SELECT id FROM member WHERE adminId = ?)
            ) AS todayClassAttendance,

            (
              SELECT className 
              FROM classschedule cs
              INNER JOIN user u ON cs.trainerId=u.id
              WHERE u.adminId = ?
              GROUP BY cs.className
              ORDER BY COUNT(*) DESC
              LIMIT 1
            ) AS popularClass`,
        [adminId, adminId, adminId]
      ),

      // INVENTORY SUMMARY
      pool.query(
        `SELECT
            COUNT(*) AS totalProducts,
            IFNULL(SUM(CASE WHEN currentStock < 5 THEN 1 ELSE 0 END), 0) AS lowStockItems
         FROM product
         WHERE branchId IN (SELECT id FROM branch WHERE adminId = ?)`,
        [adminId]
      ),

      // ALERTS + TASKS
      pool.query(
        `SELECT
            (
              SELECT COUNT(*) 
              FROM tasks 
              WHERE status != 'Completed'
                AND createdById = ?
            ) AS pendingTasks,

            (
              SELECT COUNT(*) 
              FROM alert a
              INNER JOIN staff s ON a.staffId=s.id
              WHERE s.adminId = ?
            ) AS totalAlerts`,
        [adminId, adminId]
      ),
    ]);

    return {
      memberOverview: memberOverviewData[0][0],
      revenueSummary: revenueSummaryData[0][0],
      sessionsSummary: sessionsSummaryData[0][0],
      classSummary: classSummaryData[0][0],
      inventorySummary: inventorySummaryData[0][0],
      alertTaskSummary: alertTaskSummaryData[0][0],
    };
  } catch (error) {
    throw new Error(`Manager Report Error: ${error.message}`);
  }
};

export const generatePersonalTrainerReportByStaffService = async (
  adminId,
  staffId,
  fromDate = null,
  toDate = null
) => {
  try {
    // 1️⃣ Verify the staff belongs to the admin
    const [staffVerification] = await pool.query(
      `SELECT s.id, s.userId, u.fullName 
       FROM staff s
       JOIN user u ON s.userId = u.id
       WHERE s.id = ? AND s.adminId = ?`,
      [staffId, adminId]
    );

    if (staffVerification.length === 0) {
      return {
        stats: {
          totalBookings: 0,
          completed: 0,
          cancelled: 0,
          booked: 0,
        },
        bookingsByDay: [],
        bookingStatus: [],
        transactions: [],
      };
    }

    const staffUserId = staffVerification[0].userId;

    // Helper function to build the date filter part of the query
    const getDateFilterQuery = () => {
      if (fromDate && toDate) {
        return `AND ub.date BETWEEN ? AND ?`;
      }
      if (fromDate) {
        return `AND ub.date >= ?`;
      }
      if (toDate) {
        return `AND ub.date <= ?`;
      }
      return ""; // No date filter
    };

    // Helper function to build the parameters array for the date filter
    const getDateFilterParams = () => {
      const params = [];
      if (fromDate) params.push(fromDate);
      if (toDate) params.push(toDate);
      return params;
    };

    const dateFilterQuery = getDateFilterQuery();
    const dateFilterParams = getDateFilterParams();

    // 2️⃣ PT booking stats for this specific staff member with date filter
    const [bookingStats] = await pool.query(
      `SELECT 
        COUNT(*) as totalBookings,
        SUM(CASE WHEN bookingStatus = 'Completed' THEN 1 ELSE 0 END) + 0 as completed,
        SUM(CASE WHEN bookingStatus = 'Cancelled' THEN 1 ELSE 0 END) + 0 as cancelled,
        SUM(CASE WHEN bookingStatus = 'Booked' THEN 1 ELSE 0 END) + 0 as booked
      FROM unified_bookings ub
      WHERE ub.trainerId = ?
        AND ub.bookingType = 'PT'
        ${dateFilterQuery}`,
      [staffUserId, ...dateFilterParams]
    );

    // 3️⃣ PT bookings group by day with date filter
    const [bookingsByDay] = await pool.query(
      `SELECT 
        DATE(ub.date) AS date,
        COUNT(*) AS count
      FROM unified_bookings ub
      WHERE ub.trainerId = ?
        AND ub.bookingType = 'PT'
        ${dateFilterQuery}
      GROUP BY DATE(ub.date)
      ORDER BY date ASC`,
      [staffUserId, ...dateFilterParams]
    );

    // 4️⃣ PT booking status distribution with date filter
    const [bookingStatus] = await pool.query(
      `SELECT 
        ub.bookingStatus,
        COUNT(*) AS count
      FROM unified_bookings ub
      WHERE ub.trainerId = ?
        AND ub.bookingType = 'PT'
        ${dateFilterQuery}
      GROUP BY ub.bookingStatus`,
      [staffUserId, ...dateFilterParams]
    );

    // 5️⃣ PT transactions list with date filter
    const [transactions] = await pool.query(
      `SELECT 
          ub.date,
          trainerUser.fullName AS trainerName,
          m.fullName AS memberName,
          'Personal Training' AS type,
          ub.startTime AS time,
          ub.bookingStatus AS status
        FROM unified_bookings ub
        LEFT JOIN user AS trainerUser 
              ON ub.trainerId = trainerUser.id
        LEFT JOIN member AS m
              ON ub.memberId = m.id
        WHERE ub.trainerId = ?
          AND ub.bookingType = 'PT'
          ${dateFilterQuery}
        ORDER BY ub.date DESC, ub.startTime DESC`,
      [staffUserId, ...dateFilterParams]
    );

    // Format output for UI (no changes needed here)
    const formattedStats = {
      totalBookings: bookingStats[0].totalBookings || 0,
      completed: bookingStats[0].completed || 0,
      cancelled: bookingStats[0].cancelled || 0,
      booked: bookingStats[0].booked || 0,
    };

    const formattedTransactions = transactions.map((tx) => ({
      date: tx.date,
      trainer: tx.trainerName || "N/A",
      username: tx.memberName || "N/A",
      type: tx.type,
      time: tx.time,
      status: tx.status,
    }));

    return {
      stats: formattedStats,
      bookingsByDay,
      bookingStatus,
      transactions: formattedTransactions,
    };
  } catch (error) {
    throw new Error(
      `Error generating personal trainer report by staff: ${error.message}`
    );
  }
};

export const generateGeneralTrainerReportByStaffService = async (
  adminId,
  staffId,
  fromDate = null,
  toDate = null
) => {
  try {
    console.log(
      "General Trainer By Staff - adminId:",
      adminId,
      "staffId:",
      staffId,
      "fromDate:",
      fromDate,
      "toDate:",
      toDate
    );

    // 1️⃣ Verify the staff belongs to the admin
    const [staffVerification] = await pool.query(
      `SELECT s.id, s.userId, u.fullName 
       FROM staff s
       JOIN user u ON s.userId = u.id
       WHERE s.id = ? AND s.adminId = ?`,
      [staffId, adminId]
    );

    if (staffVerification.length === 0) {
      console.log("Staff verification failed - no staff found");
      return {
        stats: {
          totalBookings: 0,
          totalRevenue: 0,
          avgTicket: 0,
          confirmed: 0,
          cancelled: 0,
          booked: 0,
        },
        bookingsByDay: [],
        bookingStatus: [],
        transactions: [],
      };
    }

    // Get the userId of the staff member to use as trainerId
    const staffUserId = staffVerification[0].userId;
    console.log(
      "Staff verified - userId:",
      staffUserId,
      "fullName:",
      staffVerification[0].fullName
    );

    // Helper function to build the date filter part of the query for plan assignments
    // Only apply date filter if both dates are provided and they are different
    const getDateFilterQueryForPlans = () => {
      if (fromDate && toDate && fromDate !== toDate) {
        return `AND DATE(mpa.assignedAt) BETWEEN ? AND ?`;
      }
      // If dates are same (today) or not provided, don't filter (show all data)
      return "";
    };

    // Helper function to build the date filter part of the query for bookings
    const getDateFilterQueryForBookings = () => {
      if (fromDate && toDate && fromDate !== toDate) {
        return `AND ub.date BETWEEN ? AND ?`;
      }
      // If dates are same (today) or not provided, don't filter (show all data)
      return "";
    };

    // Helper function to build the parameters array for the date filter
    const getDateFilterParams = () => {
      const params = [];
      // Only add params if both dates are provided and different
      if (fromDate && toDate && fromDate !== toDate) {
        params.push(fromDate);
        params.push(toDate);
      }
      return params;
    };

    const dateFilterQueryForPlans = getDateFilterQueryForPlans();
    const dateFilterQueryForBookings = getDateFilterQueryForBookings();
    const dateFilterParams = getDateFilterParams();

    // 2️⃣ Total Bookings: Count of General Trainer plans assigned to this trainer
    // For GROUP plans: Show plans for members who have GROUP bookings with this trainer OR plans with trainerId
    // For MEMBER type with trainerType='general': Show plans where trainerId = staffId
    const queryParams = [
      adminId,
      staffId,
      staffId,
      staffUserId,
      ...dateFilterParams,
    ];
    console.log("Plan Stats Query Params:", queryParams);

    const [[planStats]] = await pool.query(
      `SELECT 
        COUNT(*) AS totalBookings,
        COALESCE(SUM(mpa.amountPaid), 0) AS totalRevenue,
        SUM(CASE 
          WHEN mpa.membershipTo >= CURDATE() AND mpa.status = 'Active' THEN 1 
          ELSE 0 
        END) AS confirmed,
        SUM(CASE 
          WHEN mpa.membershipTo < CURDATE() OR mpa.status = 'Inactive' THEN 1 
          ELSE 0 
        END) AS cancelled
      FROM member_plan_assignment mpa
      INNER JOIN member m ON mpa.memberId = m.id
      INNER JOIN memberplan mp ON mpa.planId = mp.id
      WHERE m.adminId = ?
        AND (
          -- Case 1: MEMBER type with trainerType='general' - filter by trainerId in plan
          (mp.type = 'MEMBER' AND mp.trainerType = 'general' AND mp.trainerId = ?)
          OR
          -- Case 2: GROUP type plans where trainerId matches (if plan has trainerId)
          (mp.type = 'GROUP' AND mp.trainerId = ?)
          OR
          -- Case 3: GROUP type plans for members who have GROUP bookings with this trainer
          (mp.type = 'GROUP' AND EXISTS (
            SELECT 1 FROM unified_bookings ub 
            WHERE ub.memberId = m.id 
            AND ub.trainerId = ?
            AND ub.bookingType = 'GROUP'
          ))
        )
        ${dateFilterQueryForPlans}`,
      [adminId, staffId, staffId, staffUserId, ...dateFilterParams]
    );

    console.log("Plan Stats Result:", planStats);

    // 3️⃣ Booked: Count of GROUP bookings for this trainer
    const bookedQueryParams = [adminId, staffUserId, ...dateFilterParams];
    console.log("Booked Stats Query Params:", bookedQueryParams);

    const [[bookedStats]] = await pool.query(
      `SELECT COUNT(*) AS booked
      FROM unified_bookings ub
      INNER JOIN member m ON ub.memberId = m.id
      WHERE m.adminId = ? 
        AND ub.trainerId = ?
        AND ub.bookingType = 'GROUP'
        ${dateFilterQueryForBookings}`,
      bookedQueryParams
    );

    console.log("Booked Stats Result:", bookedStats);

    // 4️⃣ Bookings by Day: General Trainer plan assignments per day (with revenue)
    const [bookingsByDay] = await pool.query(
      `SELECT 
        DATE(mpa.assignedAt) AS date,
        COUNT(*) AS count,
        COALESCE(SUM(mpa.amountPaid), 0) AS revenue
      FROM member_plan_assignment mpa
      INNER JOIN member m ON mpa.memberId = m.id
      INNER JOIN memberplan mp ON mpa.planId = mp.id
      WHERE m.adminId = ?
        AND (
          -- Case 1: MEMBER type with trainerType='general' - filter by trainerId in plan
          (mp.type = 'MEMBER' AND mp.trainerType = 'general' AND mp.trainerId = ?)
          OR
          -- Case 2: GROUP type plans where trainerId matches (if plan has trainerId)
          (mp.type = 'GROUP' AND mp.trainerId = ?)
          OR
          -- Case 3: GROUP type plans for members who have GROUP bookings with this trainer
          (mp.type = 'GROUP' AND EXISTS (
            SELECT 1 FROM unified_bookings ub 
            WHERE ub.memberId = m.id 
            AND ub.trainerId = ?
            AND ub.bookingType = 'GROUP'
          ))
        )
        ${dateFilterQueryForPlans}
      GROUP BY DATE(mpa.assignedAt)
      ORDER BY date ASC`,
      [adminId, staffId, staffId, staffUserId, ...dateFilterParams]
    );

    // 5️⃣ Booking Status: Active and Inactive General Trainer plans
    const [bookingStatus] = await pool.query(
      `SELECT 
        CASE
          WHEN mpa.membershipTo >= CURDATE() AND mpa.status = 'Active' THEN 'Active'
          WHEN mpa.membershipTo < CURDATE() OR mpa.status = 'Inactive' THEN 'Inactive'
          ELSE 'Inactive'
        END AS bookingStatus,
        COUNT(*) AS count
      FROM member_plan_assignment mpa
      INNER JOIN member m ON mpa.memberId = m.id
      INNER JOIN memberplan mp ON mpa.planId = mp.id
      WHERE m.adminId = ?
        AND (
          -- Case 1: MEMBER type with trainerType='general' - filter by trainerId in plan
          (mp.type = 'MEMBER' AND mp.trainerType = 'general' AND mp.trainerId = ?)
          OR
          -- Case 2: GROUP type plans where trainerId matches (if plan has trainerId)
          (mp.type = 'GROUP' AND mp.trainerId = ?)
          OR
          -- Case 3: GROUP type plans for members who have GROUP bookings with this trainer
          (mp.type = 'GROUP' AND EXISTS (
            SELECT 1 FROM unified_bookings ub 
            WHERE ub.memberId = m.id 
            AND ub.trainerId = ?
            AND ub.bookingType = 'GROUP'
          ))
        )
        ${dateFilterQueryForPlans}
      GROUP BY 
        CASE
          WHEN mpa.membershipTo >= CURDATE() AND mpa.status = 'Active' THEN 'Active'
          WHEN mpa.membershipTo < CURDATE() OR mpa.status = 'Inactive' THEN 'Inactive'
          ELSE 'Inactive'
        END`,
      [adminId, staffId, staffId, staffUserId, ...dateFilterParams]
    );

    // 6️⃣ Transactions: All members with general trainer plans assigned to this trainer
    // Parameters: [staffUserId (for trainerName), staffUserId (4x for booking stats), adminId, staffId (for MEMBER), staffId (for GROUP trainerId), staffUserId (for EXISTS), ...dateFilterParams]
    const transactionQueryParams = [
      staffUserId,
      staffUserId,
      staffUserId,
      staffUserId,
      staffUserId,
      adminId,
      staffId,
      staffId,
      staffUserId,
      ...dateFilterParams,
    ];
    console.log("Transactions Query Params:", transactionQueryParams);
    console.log("Date Filter Query For Plans:", dateFilterQueryForPlans);

    const [transactions] = await pool.query(
      `SELECT 
        DATE(mpa.assignedAt) AS date,
        m.id AS memberId,
        m.fullName AS username,
        mp.id AS planId,
        mp.name AS planName,
        mp.sessions AS totalClasses,
        mpa.amountPaid AS price,
        mpa.paymentMode,
        mpa.status AS originalStatus,
        mpa.membershipTo,
        CASE
          WHEN mpa.membershipTo >= CURDATE() AND mpa.status = 'Active' THEN 'Active'
          WHEN mpa.membershipTo < CURDATE() OR mpa.status = 'Inactive' THEN 'Inactive'
          ELSE 'Inactive'
        END AS computedStatus,
        COALESCE(
          (SELECT u.fullName FROM user u WHERE u.id = mpa.assignedBy),
          'System'
        ) AS assignedBy,
        COALESCE(
          (SELECT u.fullName FROM user u 
           INNER JOIN staff s ON s.userId = u.id 
           WHERE s.id = mp.trainerId),
          (SELECT u.fullName FROM user u WHERE u.id = ?),
          'N/A'
        ) AS trainerName,
        mp.trainerId,
        TIME(mpa.assignedAt) AS time,
        -- Booking statistics for General Trainer plans
        COALESCE((
          SELECT COUNT(*) 
          FROM unified_bookings ub 
          WHERE ub.memberId = m.id 
            AND ub.trainerId = ?
            AND ub.bookingType = 'GROUP'
        ), 0) AS classesBooked,
        COALESCE((
          SELECT COUNT(*) 
          FROM unified_bookings ub 
          WHERE ub.memberId = m.id 
            AND ub.trainerId = ?
            AND ub.bookingStatus = 'Confirmed'
            AND ub.bookingType = 'GROUP'
        ), 0) AS classesConfirmed,
        COALESCE((
          SELECT COUNT(*) 
          FROM unified_bookings ub 
          WHERE ub.memberId = m.id 
            AND ub.trainerId = ?
            AND ub.bookingStatus = 'Cancelled'
            AND ub.bookingType = 'GROUP'
        ), 0) AS classesCancelled,
        COALESCE((
          SELECT COUNT(*) 
          FROM unified_bookings ub 
          WHERE ub.memberId = m.id 
            AND ub.trainerId = ?
            AND ub.bookingStatus = 'Completed'
            AND ub.bookingType = 'GROUP'
        ), 0) AS classesCompleted
      FROM member_plan_assignment mpa
      INNER JOIN member m ON mpa.memberId = m.id
      INNER JOIN memberplan mp ON mpa.planId = mp.id
      WHERE m.adminId = ?
        AND (
          -- Case 1: MEMBER type with trainerType='general' - filter by trainerId in plan
          (mp.type = 'MEMBER' AND mp.trainerType = 'general' AND mp.trainerId = ?)
          OR
          -- Case 2: GROUP type plans where trainerId matches (if plan has trainerId)
          (mp.type = 'GROUP' AND mp.trainerId = ?)
          OR
          -- Case 3: GROUP type plans for members who have GROUP bookings with this trainer
          (mp.type = 'GROUP' AND EXISTS (
            SELECT 1 FROM unified_bookings ub 
            WHERE ub.memberId = m.id 
            AND ub.trainerId = ?
            AND ub.bookingType = 'GROUP'
          ))
        )
        ${dateFilterQueryForPlans}
      ORDER BY mpa.assignedAt DESC
      LIMIT 100`,
      transactionQueryParams
    );

    console.log("Transactions Result Count:", transactions.length);

    // Format output for UI
    const formattedStats = {
      totalBookings: planStats.totalBookings || 0,
      totalRevenue: parseFloat(planStats.totalRevenue) || 0,
      confirmed: planStats.confirmed || 0,
      cancelled: planStats.cancelled || 0,
      booked: bookedStats.booked || 0,
      avgTicket:
        planStats.totalBookings > 0
          ? parseFloat(planStats.totalRevenue) / planStats.totalBookings
          : 0,
    };

    console.log("Formatted Stats:", formattedStats);

    // Format transactions data
    const formattedTransactions = transactions.map((transaction) => {
      // Format time to HH:MM if it exists
      let formattedTime = "-";
      if (transaction.time) {
        const timeStr = String(transaction.time);
        if (timeStr.includes(":")) {
          formattedTime = timeStr.substring(0, 5);
        } else {
          formattedTime = timeStr;
        }
      }

      return {
        date: transaction.date,
        memberId: transaction.memberId,
        memberName: transaction.username || "N/A",
        planId: transaction.planId,
        planName: transaction.planName || "Group Training Plan",
        trainer: transaction.trainerName || "N/A",
        trainerId: transaction.trainerId,
        planPrice: parseFloat(transaction.price) || 0,
        totalClasses: transaction.totalClasses || 0,
        classesBooked: transaction.classesBooked || 0,
        classesConfirmed: transaction.classesConfirmed || 0,
        classesCancelled: transaction.classesCancelled || 0,
        classesCompleted: transaction.classesCompleted || 0,
        paymentMode: transaction.paymentMode || "N/A",
        time: formattedTime,
        status: transaction.computedStatus || "Inactive",
        revenue: parseFloat(transaction.price) || 0,
      };
    });

    return {
      stats: formattedStats,
      bookingsByDay,
      bookingStatus,
      transactions: formattedTransactions,
    };
  } catch (error) {
    throw new Error(
      `Error generating general trainer report by staff: ${error.message}`
    );
  }
};

export const generateAdminHousekeepingReportService = async (
  adminId,
  startDate,
  endDate
) => {
  // 1️⃣ Get all housekeeping staff for admin
  const [staffList] = await pool.query(
    `
    SELECT s.id
    FROM staff s
    JOIN user u ON s.userId = u.id
    WHERE s.adminId = ?
      AND u.roleId = 8
    `,
    [adminId]
  );

  let staffDetails = [];
  let totalTasks = 0;
  let completedTasks = 0;
  let pendingTasks = 0;
  let inProgressTasks = 0;

  // 2️⃣ Call STAFF service for each staff
  for (const staff of staffList) {
    const report = await generateStaffHousekeepingReportService(
      adminId,
      staff.id,
      startDate,
      endDate
    );

    staffDetails.push({
      staffId: report.staffId,
      staffName: report.staffInfo.fullName,
      email: report.staffInfo.email,
      phone: report.staffInfo.phone,
      status: report.staffInfo.status,
      totalTasks: report.taskMetrics.total,
      completedTasks: report.taskMetrics.completed,
      pendingTasks: report.taskMetrics.pending,
      inProgressTasks: report.taskMetrics.inProgress,
      taskCompletionRate: report.taskMetrics.completionRate,
      attendanceMetrics: report.attendanceMetrics,
      recentTasks: report.recentTasks,
      recentAttendance: report.recentAttendance,
    });

    totalTasks += report.taskMetrics.total;
    completedTasks += report.taskMetrics.completed;
    pendingTasks += report.taskMetrics.pending;
    inProgressTasks += report.taskMetrics.inProgress;
  }

  return {
    adminId,
    reportDate: new Date(),
    summary: {
      totalStaff: staffList.length,
      activeStaff: staffList.length,
      totalTasks,
      completedTasks,
      pendingTasks,
      inProgressTasks,
      overallTaskCompletionRate:
        totalTasks > 0
          ? ((completedTasks / totalTasks) * 100).toFixed(2)
          : "0.00",
    },
    staffDetails,
  };
};


// Generate housekeeping report for a specific staff member
export const generateStaffHousekeepingReportService = async (
  adminId,
  staffId,
  startDate,
  endDate
) => {
  try {
    /* =====================================================
       1️⃣ VERIFY STAFF (ADMIN + HOUSEKEEPING ROLE)
    ===================================================== */
    const [staffResult] = await pool.query(
      `
      SELECT 
        s.id,
        s.status,
        s.joinDate,
        u.id AS userId,
        u.fullName,
        u.email,
        u.phone,
        u.profileImage,
        u.roleId
      FROM staff s
      JOIN user u ON s.userId = u.id
      WHERE s.id = ?
        AND s.adminId = ?
        AND u.roleId = 8
      `,
      [staffId, adminId]
    );

    if (staffResult.length === 0) {
      return {
        adminId,
        staffId,
        reportDate: new Date(),
        dateRange: { startDate, endDate },
        message: "No housekeeping staff found for this admin",
        staffInfo: null,
        taskMetrics: {},
        attendanceMetrics: {},
        recentTasks: [],
        recentAttendance: [],
      };
    }

    const staff = staffResult[0];

    /* =====================================================
       2️⃣ DATE RANGE NORMALIZATION
    ===================================================== */
    let fromDate = null;
    let toDate = null;

    if (startDate && endDate) {
      fromDate = `${startDate} 00:00:00`;
      toDate = `${endDate} 23:59:59`;
    }

    /* =====================================================
       3️⃣ FETCH TASKS (✅ FIXED)
       ✔ NO taskTitle filter
       ✔ assignedTo = staffId
    ===================================================== */
let taskQuery = `
  SELECT *
  FROM tasks
  WHERE assignedTo = ?
`;
const taskParams = [staffId];

if (fromDate && toDate) {
  taskQuery += ` AND createdAt BETWEEN ? AND ?`;
  taskParams.push(fromDate, toDate);
}

const [housekeepingTasks] = await pool.query(taskQuery, taskParams);


    /* =====================================================
       4️⃣ FETCH ATTENDANCE
       ⚠️ NOTE: memberattendance.staffId mostly NULL in DB
    ===================================================== */
    let attendanceQuery = `
      SELECT *
      FROM memberattendance
      WHERE staffId = ?
    `;
    const attendanceParams = [staffId];

    if (fromDate && toDate) {
      attendanceQuery += ` AND checkIn BETWEEN ? AND ?`;
      attendanceParams.push(fromDate, toDate);
    }

    const [attendanceRecords] = await pool.query(
      attendanceQuery,
      attendanceParams
    );

    /* =====================================================
       5️⃣ TASK METRICS (✅ CASE SAFE)
    ===================================================== */
    const completedTasks = housekeepingTasks.filter(
      (t) => t.status?.toLowerCase() === "completed"
    ).length;

    const pendingTasks = housekeepingTasks.filter(
      (t) => t.status?.toLowerCase() === "pending"
    ).length;

    const inProgressTasks = housekeepingTasks.filter(
      (t) => t.status?.toLowerCase() === "in progress"
    ).length;

    const taskCompletionRate =
      housekeepingTasks.length > 0
        ? ((completedTasks / housekeepingTasks.length) * 100).toFixed(2)
        : "0.00";

    const tasksByPriority = {
      High: housekeepingTasks.filter(
        (t) => t.priority?.toLowerCase() === "high"
      ).length,
      Medium: housekeepingTasks.filter(
        (t) => t.priority?.toLowerCase() === "medium"
      ).length,
      Low: housekeepingTasks.filter((t) => t.priority?.toLowerCase() === "low")
        .length,
    };

    /* =====================================================
       6️⃣ ATTENDANCE METRICS
    ===================================================== */
    const totalDays = attendanceRecords.length;
    const presentDays = attendanceRecords.filter(
      (r) => r.status === "Present" || r.status === "In Gym"
    ).length;

    const attendanceRate =
      totalDays > 0 ? ((presentDays / totalDays) * 100).toFixed(2) : "0.00";

    let totalMinutes = 0;
    let daysWithCheckout = 0;

    attendanceRecords.forEach((r) => {
      if (r.checkOut) {
        const checkIn = new Date(r.checkIn);
        const checkOut = new Date(r.checkOut);
        totalMinutes += (checkOut - checkIn) / (1000 * 60);
        daysWithCheckout++;
      }
    });

    const avgWorkingHours =
      daysWithCheckout > 0
        ? (totalMinutes / daysWithCheckout / 60).toFixed(2)
        : "0.00";

    /* =====================================================
       7️⃣ ATTENDANCE BY MONTH
    ===================================================== */
    const attendanceByMonth = {};

    attendanceRecords.forEach((r) => {
      const month = new Date(r.checkIn).toLocaleString("en-IN", {
        month: "long",
        year: "numeric",
      });

      if (!attendanceByMonth[month]) {
        attendanceByMonth[month] = { total: 0, present: 0 };
      }

      attendanceByMonth[month].total++;
      if (r.status === "Present" || r.status === "In Gym") {
        attendanceByMonth[month].present++;
      }
    });

    Object.keys(attendanceByMonth).forEach((m) => {
      const d = attendanceByMonth[m];
      d.rate = d.total > 0 ? ((d.present / d.total) * 100).toFixed(2) : "0.00";
    });

    /* =====================================================
       8️⃣ FINAL RESPONSE
    ===================================================== */
    return {
      adminId,
      staffId,
      staffInfo: {
        id: staff.id,
        fullName: staff.fullName,
        email: staff.email,
        phone: staff.phone,
        profileImage: staff.profileImage,
        status: staff.status,
        joinDate: staff.joinDate,
        roleId: staff.roleId,
      },
      reportDate: new Date(),
      dateRange: { startDate, endDate },
      taskMetrics: {
        total: housekeepingTasks.length,
        completed: completedTasks,
        pending: pendingTasks,
        inProgress: inProgressTasks,
        completionRate: taskCompletionRate,
        byPriority: tasksByPriority,
      },
      attendanceMetrics: {
        totalDays,
        presentDays,
        attendanceRate,
        avgWorkingHours,
        byMonth: attendanceByMonth,
      },
      recentTasks: housekeepingTasks.slice(0, 10),
      recentAttendance: attendanceRecords.slice(0, 10),
    };
  } catch (error) {
    console.error("STAFF HOUSEKEEPING REPORT ERROR:", error);
    throw error;
  }
};
