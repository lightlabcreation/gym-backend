// src/modules/member/memberDashboard.service.js
import { pool } from "../../config/db.js";

export const getMemberDashboardService = async (memberId) => {
  /* 1️⃣ MEMBER BASIC INFO */
 const [[member]] = await pool.query(
  `
  SELECT 
    m.id,
    m.userId,
    m.fullName,
    m.membershipFrom,
    m.membershipTo,
    mp.name AS planName
  FROM member m
  LEFT JOIN memberplan mp ON mp.id = m.planId
  WHERE m.id = ?
  `,
  [memberId]
);


  if (!member) throw { status: 404, message: "Member not found" };

  /* MEMBERSHIP STATUS */
  let membershipStatus = "No Plan";
  if (member.membershipFrom && member.membershipTo) {
    membershipStatus =
      new Date(member.membershipTo) < new Date()
        ? "Expired"
        : "Active";
  }

  /* 2️⃣ WORKOUT PROGRESS (LAST 7 DAYS) */
const [attendanceRows] = await pool.query(
  `
  SELECT 
    DATE_FORMAT(
      CONVERT_TZ(checkIn, '+00:00', '+05:30'),
      '%Y-%m-%d'
    ) AS date,
    COUNT(*) AS count
  FROM memberattendance
  WHERE (memberId = ? OR memberId = ?)
    AND checkIn >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
  GROUP BY date
  `,
  [member.id, member.userId]
);






  const days = [];
  const today = new Date();

for (let i = 6; i >= 0; i--) {
  const d = new Date();
  d.setDate(today.getDate() - i);

  const key = d.toLocaleDateString("en-CA"); // YYYY-MM-DD

  const found = attendanceRows.find(r => r.date === key);

  days.push({
    date: key,
    dayLabel: d.toLocaleDateString("en-US", { weekday: "short" }),
    checkIns: found ? found.count : 0,
  });
}



  /* 3️⃣ MEMBER'S CLASSES THIS WEEK */
  const [[classesRow]] = await pool.query(
    `
    SELECT COUNT(DISTINCT cs.id) AS total
    FROM booking b
    JOIN classschedule cs ON cs.id = b.scheduleId
    WHERE b.memberId = ?
      AND cs.date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)
      AND cs.status = 'Active'
    `,
    [memberId]
  );

  /* 4️⃣ NEXT UPCOMING CLASS (NOT SESSION) */
const [[nextClassRow]] = await pool.query(
  `
  SELECT 
    cs.id,
    cs.className,
    cs.date,
    cs.startTime,
    cs.endTime
  FROM booking b
  JOIN classschedule cs ON cs.id = b.scheduleId
  WHERE b.memberId = ?
    AND cs.status = 'Active'
    AND TIMESTAMP(cs.date, cs.startTime) >
        CONVERT_TZ(NOW(), '+00:00', '+05:30')
  ORDER BY cs.date, cs.startTime
  LIMIT 3
  `,
  [memberId]
);



  /* FINAL RESPONSE */
  return {
    member: {
      id: member.id,
      fullName: member.fullName,
      planName: member.planName,
    },
    membership: {
      status: membershipStatus,
      expiresOn: member.membershipTo,
    },
    workoutProgress: {
      period: "week",
      days,
    },
    classesThisWeek: {
      count: classesRow.total,
      message:
        classesRow.total > 0
          ? `${classesRow.total} classes this week`
          : "No classes this week",
    },
    nextSession: nextClassRow
      ? {
          id: nextClassRow.id,
          name: nextClassRow.className,
          date: nextClassRow.date,
          time: `${nextClassRow.startTime} - ${nextClassRow.endTime}`,
        }
      : null,
  };
};

