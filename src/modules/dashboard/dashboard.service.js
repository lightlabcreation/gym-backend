import { pool } from "../../config/db.js";
import { startOfMonth } from "date-fns";

export const dashboardService = async () => {
  const today = new Date();
  const monthStart = startOfMonth(today);

  const monthStartStr = monthStart.toISOString().slice(0, 10);
  const todayStr = today.toISOString().slice(0, 10);

  const conn = pool;

  // --- Total Revenue ---
  const [[totalRevenueRow]] = await conn.query(
    "SELECT SUM(amount) AS totalRevenue FROM payment"
  );
  const totalRevenue = Number(totalRevenueRow.totalRevenue || 0);

  // --- New Members This Month ---
  const [[newMembersRow]] = await conn.query(
    "SELECT COUNT(*) AS count FROM member WHERE joinDate >= ?",
    [monthStartStr]
  );
  const newMembers = Number(newMembersRow.count);

  // --- Active Members ---
  const [[activeMembersRow]] = await conn.query(
    "SELECT COUNT(*) AS count FROM member WHERE membershipTo >= ?",
    [todayStr]
  );
  const activeMembers = Number(activeMembersRow.count);

  // --- Check-ins This Month ---
  const [[checkInsRow]] = await conn.query(
    "SELECT COUNT(*) AS count FROM memberAttendance WHERE checkIn >= ?",
    [monthStartStr]
  );
  const checkIns = Number(checkInsRow.count);

  // --- PT Revenue ---
  const [[ptRevenueRow]] = await conn.query(
    `SELECT COALESCE(SUM(p.amount),0) AS revenue
     FROM payment p
     JOIN plan pl ON p.planId = pl.id
     WHERE pl.category = 'PT'`
  );
  const ptRevenue = Number(ptRevenueRow.revenue);

  // --- Overdue Members ---
  const [[arOverdueRow]] = await conn.query(
    "SELECT COUNT(*) AS count FROM member WHERE membershipTo < ?",
    [todayStr]
  );
  const arOverdue = Number(arOverdueRow.count);

  // --- Revenue Graph ---
  const [revenueGraphRows] = await conn.query(
    `SELECT DATE(paymentDate) AS day, SUM(amount) AS revenue
     FROM payment
     WHERE paymentDate >= ?
     GROUP BY DATE(paymentDate)
     ORDER BY DATE(paymentDate)`,
    [monthStartStr]
  );
  const revenueGraph = revenueGraphRows.map(r => ({
    day: r.day,
    revenue: Number(r.revenue),
  }));

  // --- Branch Leaderboard ---
  const [branchLeaderboardRows] = await conn.query(
    `SELECT 
       b.name AS branch,
       COALESCE(SUM(p.amount), 0) AS revenue,
       COUNT(m.id) AS new
     FROM branch b
     LEFT JOIN member m 
       ON m.branchId = b.id AND m.joinDate >= ?
     LEFT JOIN payment p 
       ON p.memberId = m.id
     GROUP BY b.id
     ORDER BY revenue DESC`,
    [monthStartStr]
  );
  const branchLeaderboard = branchLeaderboardRows.map(b => ({
    branch: b.branch,
    revenue: Number(b.revenue),
    new: Number(b.new),
  }));

  return {
    totalRevenue,
    newMembers,
    activeMembers,
    checkIns,
    ptRevenue,
    arOverdue,
    revenueGraph,
    branchLeaderboard,
    dashboardAlerts: [],
  };
};


// import { pool } from "../../config/db.js";

// export const superAdminDashboardService = async () => {
//   // 1️⃣ Total Revenue
//   const [[totalRevenue]] = await pool.query(
//     `SELECT SUM(amountPaid) AS totalRevenue FROM member`
//   );

//   // 2️⃣ Monthly Revenue (current month)
//   const [[monthlyRevenue]] = await pool.query(
//     `SELECT SUM(amountPaid) AS monthlyRevenue
//      FROM member
//      WHERE MONTH(membershipFrom) = MONTH(CURRENT_DATE())
//        AND YEAR(membershipFrom) = YEAR(CURRENT_DATE())`
//   );

//   // 3️⃣ Total Admins
//   const [[totalAdmins]] = await pool.query(
//     `SELECT COUNT(*) AS totalAdmins FROM user WHERE roleId = 2`
//   );

//   // 4️⃣ New Admins (last 30 days)
//   const [[newAdmins]] = await pool.query(
//     `SELECT COUNT(*) AS newAdmins
//      FROM user 
//      WHERE roleId = 2
//        AND createdAt >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)`
//   );

//   // 5️⃣ Branch Leaderboard
//   const [leaderboard] = await pool.query(
//     `SELECT 
//         b.name AS branchName,
//         SUM(m.amountPaid) AS revenue,
//         COUNT(m.id) AS newMembers
//      FROM branch b
//      LEFT JOIN member m ON b.id = m.branchId
//      GROUP BY b.id
//      ORDER BY revenue DESC`
//   );


//   // exp

//   return {
//     totalRevenue: totalRevenue.totalRevenue || 0,
//     monthlyRevenue: monthlyRevenue.monthlyRevenue || 0,
//     totalAdmins: totalAdmins.totalAdmins,
//     newAdmins: newAdmins.newAdmins,
//     leaderboard
//   };
// };

export const superAdminDashboardService = async () => {
  // ================================
  // 1️⃣ TOTAL REVENUE
  // ================================
  const [[totalRev]] = await pool.query(
    `SELECT SUM(amountPaid) AS totalRevenue FROM member`
  );

  // ================================
  // 2️⃣ MONTHLY REVENUE
  // ================================
  const [[monthlyRev]] = await pool.query(
    `SELECT SUM(amountPaid) AS monthlyRevenue 
     FROM member 
     WHERE MONTH(membershipFrom) = MONTH(CURRENT_DATE()) 
       AND YEAR(membershipFrom) = YEAR(CURRENT_DATE())`
  );

  // ================================
  // 3️⃣ TOTAL ADMINS
  // ================================
  const [[adminCount]] = await pool.query(
    `SELECT COUNT(*) AS totalAdmins FROM user WHERE roleId = 2`
  );

  // ================================
  // 4️⃣ NEW ADMINS THIS MONTH
  // ================================
  const [[newAdmins]] = await pool.query(
    `SELECT COUNT(*) AS newAdmins 
     FROM user 
     WHERE roleId = 2 AND MONTH(createdAt) = MONTH(CURRENT_DATE())`
  );

  // ================================
  // 5️⃣ BRANCH LEADERBOARD
  // ================================
  const [branchLeaderboard] = await pool.query(
    `SELECT 
        b.name AS branchName,
        SUM(m.amountPaid) AS revenue,
        COUNT(m.id) AS newMembers
     FROM branch b
     LEFT JOIN member m ON m.branchId = b.id
     GROUP BY b.id
     ORDER BY revenue DESC`
  );

  // ================================
  // 6️⃣ REVENUE VS TARGET GRAPH DATA
  // ================================

  // Get daily revenue of current month
  const [revRows] = await pool.query(
    `SELECT 
    DAY(joinDate) AS day,
    SUM(amountPaid) AS revenue
FROM member
WHERE MONTH(joinDate) = MONTH(CURRENT_DATE())
  AND YEAR(joinDate) = YEAR(CURRENT_DATE())
GROUP BY DAY(joinDate)
ORDER BY DAY(joinDate)
`
  );

  // Prepare map
  const revenueMap = {};
  revRows.forEach(r => {
    revenueMap[r.day] = r.revenue;
  });

  const daysInMonth = new Date().getDate();
  const days = [];
  const revenue = [];
  const target = [];

  let targetValue = 90000;     // starting target
  const growth = 0.05;         // 5% per day

  for (let d = 1; d <= daysInMonth; d++) {
    days.push(String(d).padStart(2, "0"));
    revenue.push(revenueMap[d] || 0);

    targetValue = Math.round(targetValue + targetValue * growth);
    target.push(targetValue);
  }

  // ================================
  // RETURN FINAL COMBINED RESPONSE
  // ================================

  return {
    totalRevenue: totalRev.totalRevenue || 0,
    monthlyRevenue: monthlyRev.monthlyRevenue || 0,
    totalAdmins: adminCount.totalAdmins,
    newAdmins: newAdmins.newAdmins,
    branchLeaderboard,
    revenueVsTarget: {
      days,
      revenue,
      target
    }
  };
};
