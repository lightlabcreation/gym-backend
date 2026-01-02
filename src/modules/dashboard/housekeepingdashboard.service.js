import { pool } from "../../config/db.js";
import { startOfWeek } from "date-fns";




export const housekeepingDashboardService = async (userId) => {
  const conn = pool; // ✅ FIX 1

  /* ===============================
     0️⃣ VALIDATE HOUSEKEEPING USER
  =============================== */
  const [[userRow]] = await conn.query(
    `
    SELECT id, adminId, roleId
    FROM user
    WHERE id = ?
      AND roleId = 8
    `,
    [userId]
  );

  if (!userRow) {
    throw {
      status: 403,
      message: "Unauthorized: Not a housekeeping user",
    };
  }

  const adminId = userRow.adminId; // ✅ ADMIN ID YAHAN SE AAYEGI

  /* ===============================
     DATE SETUP
  =============================== */
  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });

  const todayStr = today.toISOString().slice(0, 10);
  const weekStartStr = weekStart.toISOString().slice(0, 10);

  /* =====================================================
     1️⃣ TODAY SHIFTS
  ===================================================== */
  const [[todayShiftsRow]] = await conn.query(
    `
    SELECT COUNT(DISTINCT sh.id) AS shifts
    FROM shifts sh
    JOIN staff s ON FIND_IN_SET(s.id, sh.staffIds)
    JOIN user u ON s.userId = u.id
    WHERE u.adminId = ?
      AND u.roleId = 8
      AND DATE(sh.shiftDate) = ?
    `,
    [adminId, todayStr]
  );

  const todayShifts = Number(todayShiftsRow?.shifts || 0);

  /* =====================================================
     2️⃣ TASKS THIS WEEK
  ===================================================== */
  const [[taskCountRow]] = await conn.query(
    `
    SELECT
      SUM(CASE WHEN t.status = 'Completed' THEN 1 ELSE 0 END) AS completed,
      COUNT(*) AS total
    FROM tasks t
    JOIN staff s ON t.assignedTo = s.id
    JOIN user u ON s.userId = u.id
    WHERE u.adminId = ?
      AND u.roleId = 8
      AND t.dueDate BETWEEN ? AND ?
    `,
    [adminId, weekStartStr, todayStr]
  );

  const tasksCompleted = Number(taskCountRow?.completed || 0);
  const tasksTotal = Number(taskCountRow?.total || 0);

  /* =====================================================
     3️⃣ PENDING MAINTENANCE
  ===================================================== */
  const [[pendingMaintenanceRow]] = await conn.query(
    `
    SELECT COUNT(*) AS pending
    FROM tasks t
    JOIN staff s ON t.assignedTo = s.id
    JOIN user u ON s.userId = u.id
    WHERE u.adminId = ?
      AND u.roleId = 8
      AND t.status = 'Pending'
    `,
    [adminId]
  );

  const pendingMaintenance = Number(pendingMaintenanceRow?.pending || 0);

  /* =====================================================
     4️⃣ ATTENDANCE
  ===================================================== */
const [[attendanceRow]] = await conn.query(
  `
  SELECT
    SUM(CASE WHEN ma.status = 'Present' THEN 1 ELSE 0 END) AS present,
    COUNT(*) AS total
  FROM memberattendance ma
  JOIN user u ON ma.memberId = u.id
  WHERE u.adminId = ?
    AND u.roleId = 8
    AND DATE(ma.checkIn) BETWEEN ? AND ?
  `,
  [adminId, weekStartStr, todayStr]
);



  const attendancePresent = Number(attendanceRow?.present || 0);
  const attendanceTotal = Number(attendanceRow?.total || 0);

  /* =====================================================
     5️⃣ WEEKLY ROSTER
  ===================================================== */
  const [weeklyRosterRows] = await conn.query(
    `
    SELECT DISTINCT
      sh.shiftDate,
      sh.startTime,
      sh.endTime,
      sh.branchId,
      sh.status
    FROM shifts sh
    JOIN staff s ON FIND_IN_SET(s.id, sh.staffIds)
    JOIN user u ON s.userId = u.id
    WHERE u.adminId = ?
      AND u.roleId = 8
      AND sh.shiftDate >= ?
    ORDER BY sh.shiftDate ASC
    `,
    [adminId, weekStartStr]
  );

  const weeklyRoster = weeklyRosterRows.map((r) => ({
    date: r.shiftDate,
    start: r.startTime,
    end: r.endTime,
    branch: r.branchId,
    status: r.status,
  }));

  /* =====================================================
     6️⃣ TASK GRAPH (7 DAYS)
  ===================================================== */
  const [taskGraphRows] = await conn.query(
    `
    SELECT DATE(t.dueDate) AS day, COUNT(*) AS completed
    FROM tasks t
    JOIN staff s ON t.assignedTo = s.id
    JOIN user u ON s.userId = u.id
    WHERE u.adminId = ?
      AND u.roleId = 8
      AND t.status = 'Completed'
      AND t.dueDate >= DATE_SUB(?, INTERVAL 7 DAY)
    GROUP BY DATE(t.dueDate)
    ORDER BY DATE(t.dueDate)
    `,
    [adminId, todayStr]
  );

  const taskGraph = taskGraphRows.map((r) => ({
    day: r.day,
    count: Number(r.completed),
  }));

  /* =====================================================
     7️⃣ MAINTENANCE STATS
  ===================================================== */
  const [[maintenanceStatsRow]] = await conn.query(
    `
    SELECT
      SUM(CASE WHEN t.priority = 'High' AND t.status = 'Completed' THEN 1 ELSE 0 END) AS completed,
      SUM(CASE WHEN t.priority = 'High' AND t.status = 'Pending' THEN 1 ELSE 0 END) AS pending
    FROM tasks t
    JOIN staff s ON t.assignedTo = s.id
    JOIN user u ON s.userId = u.id
    WHERE u.adminId = ?
      AND u.roleId = 8
    `,
    [adminId]
  );

  /* =====================================================
     FINAL RESPONSE
  ===================================================== */
  return {
    todayShifts,
    tasksCompleted,
    tasksTotal,
    pendingMaintenance,
    attendancePresent,
    attendanceTotal,
    weeklyRoster,
    taskGraph,
    maintenanceStats: {
      completed: Number(maintenanceStatsRow?.completed || 0),
      pending: Number(maintenanceStatsRow?.pending || 0),
    },
  };
};

 


