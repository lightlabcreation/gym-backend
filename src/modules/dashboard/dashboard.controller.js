import { pool } from "../../config/db.js";
import { dashboardService,superAdminDashboardService } from "./dashboard.service.js";

export const getDashboardData = async (req, res, next) => {
  try {
    const data = await dashboardService();
    res.json({ success: true, dashboard: data });
  } catch (err) {
    next(err);
  }
}




export const getSuperAdminDashboard = async (req, res, next) => {
  try {
    const data = await superAdminDashboardService();
    res.json({
      success: true,
      message: "Dashboard loaded successfully",
      data
    });
  } catch (err) {
    next(err);
  }
};

// export const getReceptionistDashboard = async (req, res, next) => {
//   try {
//     const branchId = Number(req.query.branchId) || 1;

//     /* --------------------------------------------------------
//        1️⃣ WEEKLY ATTENDANCE TREND
//     -------------------------------------------------------- */
//     const [weekly] = await pool.query(
//       `
//       SELECT 
//           DAYNAME(checkIn) AS day,
//           COUNT(*) AS count,
//           DAYOFWEEK(checkIn) AS sortOrder
//       FROM memberattendance
//       WHERE DATE(checkIn) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
//         AND branchId = ?
//       GROUP BY day, sortOrder
//       ORDER BY sortOrder
//       `,
//       [branchId]
//     );

//     /* --------------------------------------------------------
//        2️⃣ TODAY SUMMARY
//     -------------------------------------------------------- */
//     const [[present]] = await pool.query(
//       `
//       SELECT COUNT(*) AS count 
//       FROM memberattendance 
//       WHERE DATE(checkIn) = CURDATE()
//         AND branchId = ?
//       `,
//       [branchId]
//     );

//     const [[active]] = await pool.query(
//       `
//       SELECT COUNT(*) AS count 
//       FROM memberattendance 
//       WHERE DATE(checkIn) = CURDATE()
//         AND checkOut IS NULL
//         AND branchId = ?
//       `,
//       [branchId]
//     );

//     const [[completed]] = await pool.query(
//       `
//       SELECT COUNT(*) AS count 
//       FROM memberattendance 
//       WHERE DATE(checkIn) = CURDATE()
//         AND checkOut IS NOT NULL
//         AND branchId = ?
//       `,
//       [branchId]
//     );

//     /* --------------------------------------------------------
//        3️⃣ TOTAL REVENUE
//     -------------------------------------------------------- */
//     const [[revenue]] = await pool.query(
//       `
//       SELECT SUM(amount) AS total
//       FROM payment
//       WHERE branchId = ?
//       `,
//       [branchId]
//     );

//     /* --------------------------------------------------------
//        4️⃣ RESPONSE
//     -------------------------------------------------------- */
//     res.json({
//       success: true,
//       dashboard: {
//         weeklyTrend: weekly,
//         summary: {
//           present: present.count,
//           active: active.count,
//           completed: completed.count,
//         },
//         revenue: {
//           total: revenue?.total || 0,
//         },
//       },
//     });

//   } catch (err) {
//     next(err);
//   }
// };

//  |||||||||||||||||||||||\

// export const getReceptionistDashboard = async (req, res, next) => {
//   try {
//     const branchId = Number(req.query.branchId) || 1;

//     // Weekly Trend
//     const [weekly] = await pool.query(
//       `
//       SELECT 
//           DAYNAME(checkIn) AS day,
//           COUNT(*) AS count,
//           DAYOFWEEK(checkIn) AS sortOrder
//       FROM memberattendance
//       WHERE DATE(checkIn) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
//         AND branchId = ?
//       GROUP BY day, sortOrder
//       ORDER BY sortOrder
//       `,
//       [branchId]
//     );

//     // Today Summary
//     const [[present]] = await pool.query(
//       `SELECT COUNT(*) AS count 
//        FROM memberattendance 
//        WHERE DATE(checkIn) = CURDATE()
//          AND branchId = ?`,
//       [branchId]
//     );

//     const [[active]] = await pool.query(
//       `SELECT COUNT(*) AS count 
//        FROM memberattendance 
//        WHERE DATE(checkIn) = CURDATE()
//          AND checkOut IS NULL
//          AND branchId = ?`,
//       [branchId]
//     );

//     const [[completed]] = await pool.query(
//       `SELECT COUNT(*) AS count 
//        FROM memberattendance 
//        WHERE DATE(checkIn) = CURDATE()
//          AND checkOut IS NOT NULL
//          AND branchId = ?`,
//       [branchId]
//     );

//     // REVENUE FIXED — NO branchId filter
//     const [[revenue]] = await pool.query(
//       `SELECT SUM(amount) AS total FROM payment`
//     );

//     res.json({
//       success: true,
//       dashboard: {
//         weeklyTrend: weekly,
//         summary: {
//           present: present.count,
//           active: active.count,
//           completed: completed.count,
//         },
//         revenue: {
//           total: revenue?.total || 0,
//         },
//       },
//     });

//   } catch (err) {
//     next(err);
//   }
// };

export const getReceptionistDashboard = async (req, res, next) => {
  try {
    const adminId = Number(req.query.adminId);

    if (!adminId) {
      return res.status(400).json({
        success: false,
        message: "adminId is required",
      });
    }

    /* =========================
       WEEKLY ATTENDANCE
    ========================= */
    const [weekly] = await pool.query(
      `
      SELECT 
          DAYNAME(ma.checkIn) AS day,
          COUNT(*) AS count,
          DAYOFWEEK(ma.checkIn) AS sortOrder
      FROM memberattendance ma
      JOIN user u ON ma.memberId = u.id
      WHERE DATE(ma.checkIn) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
        AND u.adminId = ?
      GROUP BY day, sortOrder
      ORDER BY sortOrder
      `,
      [adminId]
    );

    /* =========================
       TODAY SUMMARY
    ========================= */
    const [[present]] = await pool.query(
      `
      SELECT COUNT(*) AS count
      FROM memberattendance ma
      JOIN user u ON ma.memberId = u.id
      WHERE DATE(ma.checkIn) = CURDATE()
        AND u.adminId = ?
      `,
      [adminId]
    );

    const [[active]] = await pool.query(
      `
      SELECT COUNT(*) AS count
      FROM memberattendance ma
      JOIN user u ON ma.memberId = u.id
      WHERE DATE(ma.checkIn) = CURDATE()
        AND ma.checkOut IS NULL
        AND u.adminId = ?
      `,
      [adminId]
    );

    const [[completed]] = await pool.query(
      `
      SELECT COUNT(*) AS count
      FROM memberattendance ma
      JOIN user u ON ma.memberId = u.id
      WHERE DATE(ma.checkIn) = CURDATE()
        AND ma.checkOut IS NOT NULL
        AND u.adminId = ?
      `,
      [adminId]
    );

    /* =========================
       TODAY CHECK-INS COUNT
    ========================= */
    const [[todayCheckinsCount]] = await pool.query(
      `
      SELECT COUNT(*) AS count
      FROM memberattendance ma
      JOIN user u ON ma.memberId = u.id
      WHERE DATE(ma.checkIn) = CURDATE()
        AND u.adminId = ?
      `,
      [adminId]
    );

    /* =========================
       REVENUE (Admin wise)
    ========================= */
  const [[revenue]] = await pool.query(
  `
  SELECT SUM(p.amount) AS total
  FROM payment p
  JOIN user u ON p.memberId = u.id
  WHERE u.adminId = ?
  `,
  [adminId]
);


    res.json({
      success: true,
      dashboard: {
        weeklyTrend: weekly,
        todayCheckinsCount: todayCheckinsCount.count,
        summary: {
          present: present.count,
          active: active.count,
          completed: completed.count,
        },
        revenue: {
          total: revenue?.total || 0,
        },
      },
    });

  } catch (err) {
    next(err);
  }
};


/* -----------------------------------------------------
SELECT 
  dayname(d) AS day,
  COALESCE((
    SELECT COUNT(*)
    FROM memberattendance 
    WHERE DATE(checkIn) = d AND branchId = ?
  ), 0) AS count
FROM (
  SELECT CURDATE() AS d
  UNION SELECT DATE_SUB(CURDATE(), INTERVAL 1 DAY)
  UNION SELECT DATE_SUB(CURDATE(), INTERVAL 2 DAY)
  UNION SELECT DATE_SUB(CURDATE(), INTERVAL 3 DAY)
  UNION SELECT DATE_SUB(CURDATE(), INTERVAL 4 DAY)
  UNION SELECT DATE_SUB(CURDATE(), INTERVAL 5 DAY)
  UNION SELECT DATE_SUB(CURDATE(), INTERVAL 6 DAY)
) AS days
ORDER BY d;

*/

