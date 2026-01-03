import { pool } from "../../config/db.js";
import { startOfWeek, endOfWeek } from "date-fns";


export const housekeepingDashboardService = async (userId) => {
  const conn = pool; // ✅ FIX 1

  /* ===============================
   GET STAFF ID FROM USER ID
=============================== */
  const [[staffRow]] = await conn.query(
    `
  SELECT s.id
  FROM staff s
  WHERE s.userId = ?
  `,
    [userId]
  );

  if (!staffRow) {
    throw {
      status: 404,
      message: "Staff profile not found for this user",
    };
  }

  const staffId = staffRow.id;



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
  /* ===============================
     DATE SETUP
  =============================== */
  const today = new Date();

  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 });

  const todayStr = today.toISOString().slice(0, 10);
  const weekStartStr = weekStart.toISOString().slice(0, 10);
  const weekEndStr = weekEnd.toISOString().slice(0, 10);


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
    SUM(CASE WHEN LOWER(status) = 'completed' THEN 1 ELSE 0 END) AS completed,
    COUNT(*) AS total
  FROM tasks
  WHERE assignedTo = ?
    AND DATE(dueDate) BETWEEN ? AND ?
  `,
    [staffId, weekStartStr, weekEndStr]
  );

  const tasksCompleted = Number(taskCountRow.completed || 0);
  const tasksTotal = Number(taskCountRow.total || 0);



  /* =====================================================
     3️⃣ PENDING MAINTENANCE
  ===================================================== */
  const [[pendingMaintenanceRow]] = await conn.query(
    `
  SELECT COUNT(*) AS pending
  FROM tasks
  WHERE assignedTo = ?
    AND LOWER(status) = 'pending'
  `,
    [staffId]
  );

  const pendingMaintenance = Number(pendingMaintenanceRow.pending || 0);

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
    AND u.id = ?              -- 🔥 USER FILTER
    AND DATE(ma.checkIn) BETWEEN ? AND ?
  `,
    [adminId, userId, weekStartStr, todayStr]
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
  SELECT DATE(dueDate) AS day, COUNT(*) AS count
  FROM tasks
  WHERE assignedTo = ?
    AND LOWER(status) = 'completed'
    AND DATE(dueDate) >= DATE_SUB(?, INTERVAL 6 DAY)
  GROUP BY DATE(dueDate)
  ORDER BY DATE(dueDate)
  `,
    [staffId, todayStr]
  );

  const taskGraph = taskGraphRows.map(r => ({
    day: r.day,
    count: Number(r.count),
  }));



  /* =====================================================
     7️⃣ MAINTENANCE STATS
  ===================================================== */
  /* =====================================================
    7️⃣ MAINTENANCE STATS (COMPLETED / PENDING)
 ===================================================== */
  const [[maintenanceStatsRow]] = await conn.query(
    `
  SELECT
    SUM(CASE WHEN LOWER(status) = 'completed' THEN 1 ELSE 0 END) AS completed,
    SUM(CASE WHEN LOWER(status) = 'pending' THEN 1 ELSE 0 END) AS pending
  FROM tasks
  WHERE assignedTo = ?
  `,
    [staffId]
  );

  const maintenanceStats = {
    completed: Number(maintenanceStatsRow.completed || 0),
    pending: Number(maintenanceStatsRow.pending || 0),
  };





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
    maintenanceStats,
    maintenanceStats: {
      completed: Number(maintenanceStatsRow?.completed || 0),
      pending: Number(maintenanceStatsRow?.pending || 0),
    },
  };
};