// src/modules/dashboard/dashboard.service.js
import { pool } from "../../config/db.js";


export const getAdminDashboardService = async (adminId, trainerId) => {

  /* ===============================
     0️⃣ VALIDATE TRAINER (user table)
  =============================== */
  const [[trainer]] = await pool.query(
    `
    SELECT id
    FROM user
    WHERE id = ?
      AND adminId = ?
      AND roleId = 5
    `,
    [trainerId, adminId]
  );

  if (!trainer) {
    throw {
      status: 400,
      message: "Invalid trainerId (roleId must be 5)",
    };
  }

  /* ===============================
     1️⃣ TOTAL ACTIVE MEMBERS
  =============================== */
  const [[totalRow]] = await pool.query(
    `
    SELECT COUNT(*) AS totalMembers
    FROM member m
    JOIN memberplan mp ON m.planId = mp.id
    WHERE m.adminId = ?
      AND mp.trainerId = ?
      AND m.status = 'Active'
      AND (mp.type = 'PERSONAL' OR mp.trainerType = 'personal')
    `,
    [adminId, trainerId]
  );

  /* ===============================
     2️⃣ TODAY CHECK-INS
  =============================== */
  const [[checkRow]] = await pool.query(
    `
    SELECT COUNT(*) AS todaysCheckIns
    FROM memberattendance ma
    JOIN member m ON ma.memberId = m.userId
    JOIN memberplan mp ON m.planId = mp.id
    WHERE m.adminId = ?
      AND mp.trainerId = ?
      AND DATE(ma.checkIn) = CURDATE()
      AND (mp.type = 'PERSONAL' OR mp.trainerType = 'personal')
    `,
    [adminId, trainerId]
  );

  /* ===============================
     3️⃣ EARNINGS (LAST 3 MONTHS)
  =============================== */
  const [earningRows] = await pool.query(
    `
    SELECT DATE(mp.createdAt) AS date,
           SUM(m.amountPaid) AS totalEarnings
    FROM memberplan mp
    JOIN member m ON m.planId = mp.id
    WHERE m.adminId = ?
      AND mp.trainerId = ?
      AND (mp.type = 'PERSONAL' OR mp.trainerType = 'personal')
      AND mp.createdAt >= CURDATE() - INTERVAL 3 MONTH
    GROUP BY DATE(mp.createdAt)
    ORDER BY date
    `,
    [adminId, trainerId]
  );

  /* ===============================
     4️⃣ SESSIONS OVERVIEW
  =============================== */
  let sessionsOverview = { completed: 0, upcoming: 0, cancelled: 0 };

  const [sessionRows] = await pool.query(
    `
    SELECT LOWER(status) AS status, COUNT(*) AS count
    FROM session
    WHERE adminId = ?
      AND trainerId = ?
    GROUP BY LOWER(status)
    `,
    [adminId, trainerId]
  );

  sessionRows.forEach((row) => {
    if (["complete", "completed"].includes(row.status))
      sessionsOverview.completed = row.count;
    else if (row.status === "upcoming")
      sessionsOverview.upcoming = row.count;
    else if (row.status === "cancelled")
      sessionsOverview.cancelled = row.count;
  });

  /* ===============================
     5️⃣ RECENT ACTIVITIES
  =============================== */
  const [activityRows] = await pool.query(
    `
    SELECT ma.id, m.fullName, ma.checkIn, ma.status, ma.mode, ma.notes
    FROM memberattendance ma
    JOIN member m ON ma.memberId = m.userId
    JOIN memberplan mp ON m.planId = mp.id
    WHERE m.adminId = ?
      AND mp.trainerId = ?
      AND (mp.type = 'PERSONAL' OR mp.trainerType = 'personal')
    ORDER BY ma.checkIn DESC
    LIMIT 5
    `,
    [adminId, trainerId]
  );

  return {
    totalMembers: totalRow.totalMembers || 0,
    todaysCheckIns: checkRow.todaysCheckIns || 0,
    earningsOverview: earningRows.map((r) => ({
      date: r.date,
      total: Number(r.totalEarnings || 0),
    })),
    sessionsOverview,
    recentActivities: activityRows.map((row) => ({
      id: row.id,
      memberName: row.fullName,
      time: row.checkIn,
      status: row.status,
      mode: row.mode,
      notes: row.notes,
    })),
  };
};



// export const getPersonalTrainingPlansByAdminService = async (adminId) => {
//   const [rows] = await pool.query(
//     `
//     SELECT
//       p.id,
//       p.name,
//       p.sessions,
//       p.validityDays,
//       p.price,
//       p.type,
//       COUNT(m.id) AS customersCount
//     FROM memberplan p
//     LEFT JOIN member m
//       ON m.planId = p.id
//       AND m.status = 'ACTIVE'
//       AND m.adminId = ?        -- yahi se "by admin" wala count aa raha hai
//     GROUP BY p.id
//     HAVING p.sessions IS NOT NULL AND p.sessions > 0   -- sirf training plans
//     ORDER BY p.id DESC
//     `,
//     [adminId]
//   );

//   return rows;
// };


export const getPersonalTrainingPlansByAdminService = async (
  adminId,
  trainerId
) => {
  const [rows] = await pool.query(
    `
    SELECT *
    FROM memberplan
    WHERE adminId = ?
      AND trainerId = ?
    `,
    [adminId, trainerId]
  );

  return rows;
};


export const getPersonalTrainingCustomersByAdminService = async (adminId, planId) => {
  try {
    /* =========================
       1️⃣ FETCH PLAN (VALIDATION)
    ========================= */
    const planQuery = `
      SELECT 
        mp.id,
        mp.name,
        mp.sessions,
        mp.validityDays,
        mp.price,
        mp.type,
        mp.trainerType
      FROM memberplan mp
      WHERE 
        mp.id = ?
        AND mp.type = 'MEMBER'
        AND mp.trainerType = 'personal'
    `;

    const [planResult] = await pool.query(planQuery, [planId]);

    if (!planResult.length) {
      const error = new Error("Membership plan for personal training not found");
      error.statusCode = 404;
      throw error;
    }

    const plan = planResult[0];

    /* =========================
       2️⃣ FETCH MEMBERS
    ========================= */
    const membersQuery = `
      SELECT 
        m.id,
        m.userId,
        m.fullName,
        m.email,
        m.phone,
        m.gender,
        m.address,
        m.joinDate,
        m.branchId,
        m.membershipFrom,
        m.membershipTo,
        m.paymentMode,
        m.amountPaid,
        m.dateOfBirth,
        m.status,
        m.planId
      FROM member m
      WHERE 
        m.adminId = ?
        AND m.planId = ?
      ORDER BY m.fullName
    `;

    const [members] = await pool.query(membersQuery, [adminId, planId]);

    /* =========================
       3️⃣ SESSION CALCULATION
       (PT + CLASS BOTH)
    ========================= */
    for (const member of members) {

      /* 🔹 PT SESSIONS (Completed only) */
      const [[ptRow]] = await pool.query(
        `
        SELECT COUNT(*) AS ptUsedSessions
        FROM unified_bookings
        WHERE memberId = ?
          AND bookingType = 'PT'
          AND bookingStatus = 'Completed'
        `,
        [member.id]
      );

      const ptUsedSessions = ptRow?.ptUsedSessions || 0;

      /* 🔹 CLASS BOOKINGS (consume sessions) */
      const [[classRow]] = await pool.query(
        `
        SELECT COUNT(*) AS classBookings
        FROM booking
        WHERE memberId = ?
        `,
        [member.id]
      );

      const classBookings = classRow?.classBookings || 0;

      /* 🔹 FINAL SESSION LOGIC */
      const totalSessions = plan.sessions;
      const usedSessions = ptUsedSessions + classBookings;
      const remainingSessions = Math.max(totalSessions - usedSessions, 0);

      member.sessionInfo = {
        totalSessions,
        usedSessions,
        remainingSessions,
        renewRequired: remainingSessions === 0
      };

      member.classInfo = {
        totalClassesBooked: classBookings
      };
    }

    /* =========================
       4️⃣ STATISTICS
    ========================= */
    let active = 0;
    let completed = 0;

    members.forEach(member => {
      if (member.sessionInfo.remainingSessions > 0) {
        active++;
      } else {
        completed++;
      }
    });

    /* =========================
       5️⃣ FINAL RESPONSE
    ========================= */
    return {
      plan,
      members,
      statistics: {
        active,
        completed,
        totalMembers: members.length
      }
    };

  } catch (error) {
    throw error;
  }
};

