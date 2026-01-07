import { pool } from "../../config/db.js";

/**************************************
 * CLASS TYPES
 **************************************/
export const createClassTypeService = async (name) => {
  const [result] = await pool.query("INSERT INTO classtype (name) VALUES (?)", [
    name,
  ]);
};

export const getTrainersService = async () => {
  const [rows] = await pool.query(
    `SELECT 
        u.id,
        u.fullName,
        u.email,
        u.phone,
        u.branchId,
        u.roleId
     FROM user u
     JOIN role r ON u.roleId = r.id
     WHERE r.name = 'Trainer'`
  );

  return rows;
};

export const listClassTypesService = async () => {
  const [rows] = await pool.query("SELECT * FROM classtype ORDER BY id DESC");
  return rows;
};

/**************************************
 * CLASS SCHEDULE
 **************************************/
export const createScheduleService = async (data) => {
  const {
    adminId,
    className,
    trainerId,
    date,
    day,
    startTime,
    endTime,
    capacity,
    status = "Active",
    members = [],
    price = 0,
  } = data;

  /* BASIC VALIDATIONS */
  if (!adminId) throw { status: 400, message: "Admin is required" };
  if (!className) throw { status: 400, message: "Class name is required" };
  if (!trainerId) throw { status: 400, message: "Trainer is required" };
  if (!date) throw { status: 400, message: "Date is required" };
  if (!startTime || !endTime)
    throw { status: 400, message: "Start & End time required" };
  if (!capacity) throw { status: 400, message: "Capacity is required" };

  /* INSERT */
  const [result] = await pool.query(
    `INSERT INTO classschedule
      (adminId, className, trainerId, date, day, startTime, endTime, capacity, status, members, price)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      adminId, // ✅ NULL allowed
      className,
      trainerId,
      date,
      day,
      startTime,
      endTime,
      capacity,
      status,
      JSON.stringify(members),
      price,
    ]
  );

  return {
    id: result.insertId,
    adminId,
    className,
    trainerId,
    date,
    day,
    startTime,
    endTime,
    capacity,
    status,
    members,
    price,
  };
};

/**************************************
 * SCHEDULE LIST
 **************************************/
export const listSchedulesService = async (branchId) => {
  const [rows] = await pool.query(
    `SELECT cs.*, u.fullName AS trainerName
     FROM classschedule cs
     LEFT JOIN user u ON cs.trainerId = u.id
     WHERE cs.adminId = ?
     ORDER BY cs.date ASC`,
    [adminId]
  );
  return rows;
};

/**************************************
 * BOOKING
 **************************************/
// export const bookClassService = async (memberId, scheduleId) => {
//   // Check if already booked
//   const [existingRows] = await pool.query(
//     "SELECT * FROM booking WHERE memberId = ? AND scheduleId = ?",
//     [memberId, scheduleId]
//   );

//   if (existingRows.length > 0) {
//     throw { status: 400, message: "Already booked for this class" };
//   }

//   // Check schedule exists
//   const [scheduleRows] = await pool.query(
//     "SELECT * FROM classschedule WHERE id = ?",
//     [scheduleId]
//   );

//   const schedule = scheduleRows[0];
//   if (!schedule) throw { status: 404, message: "Schedule not found" };

//   // Check capacity
//   const [bookings] = await pool.query(
//     "SELECT COUNT(*) AS count FROM booking WHERE scheduleId = ?",
//     [scheduleId]
//   );

//   const count = bookings[0]?.count ?? 0;

//   if (count >= schedule.capacity) {
//     throw { status: 400, message: "Class is full" };
//   }

//   // Insert booking
//   const [result] = await pool.query(
//     "INSERT INTO booking (memberId, scheduleId) VALUES (?, ?)",
//     [memberId, scheduleId]
//   );

//   return {
//     id: result.insertId,
//     memberId,
//     scheduleId,
//   };
// };
export const bookClassService = async (memberId, scheduleId) => {
  /**
   * ⚠️ memberId coming from frontend = userId
   */

  /* 1️⃣ MAP userId → member.id */
  const [memberRows] = await pool.query(
    "SELECT id FROM member WHERE userId = ? AND status = 'ACTIVE'",
    [memberId]
  );

  if (memberRows.length === 0) {
    throw {
      status: 400,
      message: "Member profile not found for this user",
    };
  }

  const realMemberId = memberRows[0].id;

  /* 2️⃣ CHECK IF ALREADY BOOKED */
  const [existingRows] = await pool.query(
    "SELECT id FROM booking WHERE memberId = ? AND scheduleId = ?",
    [realMemberId, scheduleId]
  );

  if (existingRows.length > 0) {
    throw { status: 400, message: "Already booked for this class" };
  }

  /* 3️⃣ CHECK SCHEDULE EXISTS */
  const [scheduleRows] = await pool.query(
    "SELECT * FROM classschedule WHERE id = ?",
    [scheduleId]
  );

  if (scheduleRows.length === 0) {
    throw { status: 404, message: "Schedule not found" };
  }

  const schedule = scheduleRows[0];

  /* 4️⃣ CHECK SESSION LIMIT */
  const [planCheck] = await pool.query(
    `
    SELECT 
      mp.sessions AS totalSessions,
      mpa.membershipTo,
      (
        SELECT COUNT(*)
        FROM booking b
        WHERE b.memberId = mpa.memberId
      ) AS bookedSessions
    FROM member_plan_assignment mpa
    JOIN memberplan mp ON mp.id = mpa.planId
    WHERE mpa.memberId = ?
      AND mpa.status = 'ACTIVE'
    ORDER BY mpa.id DESC
    LIMIT 1
    `,
    [realMemberId]
  );

  if (planCheck.length > 0) {
    const { totalSessions, bookedSessions, membershipTo } = planCheck[0];
    const isSessionOver = totalSessions > 0 && bookedSessions >= totalSessions;
    const isDateOver = membershipTo && new Date() > new Date(membershipTo);

    if (isSessionOver || isDateOver) {
      const msg = isSessionOver
        ? `Session Limit Reached! You have used ${bookedSessions}/${totalSessions} sessions.`
        : "Your plan has expired.";
      throw { status: 400, message: msg };
    }
  } else {
    throw { status: 400, message: "No active membership plan found." };
  }

  /* 5️⃣ CHECK CAPACITY */
  const [bookings] = await pool.query(
    "SELECT COUNT(*) AS count FROM booking WHERE scheduleId = ?",
    [scheduleId]
  );

  if (bookings[0].count >= schedule.capacity) {
    throw { status: 400, message: "Class is full" };
  }

  /* 5️⃣ INSERT BOOKING (FK SAFE) */
  const [result] = await pool.query(
    "INSERT INTO booking (memberId, scheduleId) VALUES (?, ?)",
    [realMemberId, scheduleId]
  );

  return {
    id: result.insertId,
    memberId: realMemberId,
    scheduleId,
  };
};

// export const getScheduledClassesWithBookingStatusService = async (userId) => {
//   /* ================================
//      1️⃣ map userId → member.id
//   ================================= */
//   const [memberRows] = await pool.query(
//     "SELECT id FROM member WHERE userId = ? AND status = 'ACTIVE'",
//     [userId]
//   );

//   if (memberRows.length === 0) {
//     throw { status: 400, message: "Active member not found" };
//   }

//   const memberId = memberRows[0].id;

//   /* ================================
//      2️⃣ fetch schedules + booking status
//      🔥 ONLY_FULL_GROUP_BY SAFE QUERY
//   ================================= */
//   const [rows] = await pool.query(
//     `
//     SELECT
//       cs.id,
//       cs.className,
//       cs.date,
//       cs.day,
//       cs.startTime,
//       cs.endTime,
//       cs.status,
//       cs.capacity,

//       u.fullName AS trainerName,
//       b.name AS branchName,

//       COUNT(bk2.id) AS membersCount,

//       -- 🔥 FIX: aggregate use kiya
//       MAX(bk.id) AS bookingId

//     FROM classschedule cs

//     LEFT JOIN user u
//       ON cs.trainerId = u.id

//     LEFT JOIN branch b
//       ON cs.branchId = b.id

//     -- member-specific booking
//     LEFT JOIN booking bk
//       ON bk.scheduleId = cs.id
//      AND bk.memberId = ?

//     -- total members booking count
//     LEFT JOIN booking bk2
//       ON bk2.scheduleId = cs.id

//     GROUP BY
//       cs.id,
//       cs.className,
//       cs.date,
//       cs.day,
//       cs.startTime,
//       cs.endTime,
//       cs.status,
//       cs.capacity,
//       u.fullName,
//       b.name

//     ORDER BY cs.id DESC
//     `,
//     [memberId]
//   );

//   /* ================================
//      3️⃣ response formatting
//   ================================= */
//   return rows.map((item) => ({
//     id: item.id,
//     className: item.className,
//     date: item.date,
//     day: item.day,
//     time: `${item.startTime} - ${item.endTime}`,
//     trainer: item.trainerName,
//     branch: item.branchName,
//     status: item.status,
//     capacity: item.capacity,
//     membersCount: item.membersCount,

//     // ✅ booking status
//     isBooked: item.bookingId !== null,
//     bookingId: item.bookingId,
//   }));
// };

// export const getScheduledClassesWithBookingStatusService = async (
//   memberId,
//   adminId
// ) => {
//   /* ================================
//      1️⃣ check member (OPTIONAL)
//      ❌ do NOT block if not found
//   ================================= */
//   let validMemberId = null;

//   if (memberId) {
//     const [memberRows] = await pool.query(
//       `
//       SELECT id
//       FROM member
//       WHERE id = ?
//         AND adminId = ?
//         AND status = 'ACTIVE'
//       `,
//       [memberId, adminId]
//     );

//     if (memberRows.length > 0) {
//       validMemberId = memberId;
//     }
//   }

//   /* ================================
//      2️⃣ fetch schedules by admin
//      ❌ branch completely removed
//   ================================= */
//   const [rows] = await pool.query(
//     `
//     SELECT 
//       cs.id,
//       cs.className,
//       cs.date,
//       cs.day,
//       cs.startTime,
//       cs.endTime,
//       cs.status,
//       cs.capacity,
//       cs.price,

//       u.fullName AS trainerName,

//       COUNT(bk2.id) AS membersCount,
//       MAX(bk.id) AS bookingId,

//       mu.id AS bookedUserId,
//       mu.fullName AS bookedMemberName,
//       mu.email AS bookedMemberEmail,
//       mu.phone AS bookedMemberPhone

//     FROM classschedule cs

//     -- trainer (admin filter)
//     LEFT JOIN user u 
//       ON cs.trainerId = u.id

//     -- booking ONLY if member is valid
//     LEFT JOIN booking bk
//       ON bk.scheduleId = cs.id
//      AND bk.memberId = ?

//     LEFT JOIN member m
//       ON m.id = bk.memberId

//     LEFT JOIN user mu
//       ON mu.id = m.userId

//     -- total bookings count
//     LEFT JOIN booking bk2
//       ON bk2.scheduleId = cs.id

//     WHERE u.adminId = ?

//     GROUP BY 
//       cs.id,
//       cs.className,
//       cs.date,
//       cs.day,
//       cs.startTime,
//       cs.endTime,
//       cs.status,
//       cs.capacity,
//       cs.price,
//       u.fullName,
//       mu.id,
//       mu.fullName,
//       mu.email,
//       mu.phone

//     ORDER BY cs.id DESC
//     `,
//     [validMemberId, adminId]
//   );

//   /* ================================
//      3️⃣ response
//   ================================= */
//   return rows.map((item) => ({
//     id: item.id,
//     className: item.className,
//     date: item.date,
//     day: item.day,
//     time: `${item.startTime} - ${item.endTime}`,
//     trainer: item.trainerName,
//     status: item.status,
//     capacity: item.capacity,
//     membersCount: item.membersCount,
//     price: item.price, // ✅ Added price

//     isBooked: item.bookingId !== null,
//     bookingId: item.bookingId,

//     bookedMember: item.bookingId
//       ? {
//         id: item.bookedUserId,
//         name: item.bookedMemberName,
//         email: item.bookedMemberEmail,
//         phone: item.bookedMemberPhone,
//       }
//       : null,
//   }));
// };

export const getScheduledClassesWithBookingStatusService = async (
  memberId,
  adminId
) => {
  /* ================================
     1️⃣ check member (OPTIONAL)
  ================================= */
  let validMemberId = null;

  if (memberId) {
    const [memberRows] = await pool.query(
      `
      SELECT id
      FROM member
      WHERE id = ?
        AND adminId = ?
        AND status = 'ACTIVE'
      `,
      [memberId, adminId]
    );

    if (memberRows.length > 0) {
      validMemberId = memberId;
    }
  }

  /* ================================
     1a️⃣ PLAN EXPIRY LOGIC (SESSION + DATE)
  ================================= */
  let planExpired = false;
  let remainingSessions = Infinity;

  if (validMemberId) {
    const [planRows] = await pool.query(
      `
      SELECT 
        mp.sessions AS totalSessions,
        mpa.membershipTo,
        (
          SELECT COUNT(*)
          FROM booking b
          WHERE b.memberId = mpa.memberId
        ) AS bookedSessions
      FROM member_plan_assignment mpa
      JOIN memberplan mp ON mp.id = mpa.planId
      WHERE mpa.memberId = ?
        AND mpa.status = 'ACTIVE'
      ORDER BY mpa.id DESC
      LIMIT 1
      `,
      [validMemberId]
    );

    if (planRows.length > 0) {
      const { totalSessions, bookedSessions, membershipTo } = planRows[0];

      remainingSessions = Math.max(0, totalSessions - bookedSessions);

      const isSessionOver = totalSessions > 0 && bookedSessions >= totalSessions;
      const isDateOver = membershipTo && new Date() > new Date(membershipTo);

      planExpired = isSessionOver || isDateOver;
    } else {
      // no active plan
      planExpired = true;
      remainingSessions = 0;
    }
  }

  /* ================================
     2️⃣ fetch schedules by admin
  ================================= */
  const [rows] = await pool.query(
    `
    SELECT 
      cs.id,
      cs.className,
      cs.date,
      cs.day,
      cs.startTime,
      cs.endTime,
      cs.status,
      cs.capacity,
      cs.price,

      u.fullName AS trainerName,

      COUNT(bk2.id) AS membersCount,
      MAX(bk.id) AS bookingId,

      mu.id AS bookedUserId,
      mu.fullName AS bookedMemberName,
      mu.email AS bookedMemberEmail,
      mu.phone AS bookedMemberPhone

    FROM classschedule cs
    LEFT JOIN user u ON cs.trainerId = u.id

    LEFT JOIN booking bk
      ON bk.scheduleId = cs.id
     AND bk.memberId = ?

    LEFT JOIN member m ON m.id = bk.memberId
    LEFT JOIN user mu ON mu.id = m.userId

    LEFT JOIN booking bk2 ON bk2.scheduleId = cs.id

    WHERE u.adminId = ?

    GROUP BY 
      cs.id,
      cs.className,
      cs.date,
      cs.day,
      cs.startTime,
      cs.endTime,
      cs.status,
      cs.capacity,
      cs.price,
      u.fullName,
      mu.id,
      mu.fullName,
      mu.email,
      mu.phone

    ORDER BY cs.id DESC
    `,
    [validMemberId, adminId]
  );

  /* ================================
     3️⃣ response
  ================================= */
  return rows.map((item) => {
    const isBooked = item.bookingId !== null;

    return {
      id: item.id,
      className: item.className,
      date: item.date,
      day: item.day,
      time: `${item.startTime} - ${item.endTime}`,
      trainer: item.trainerName,
      status: item.status,
      capacity: item.capacity,
      membersCount: item.membersCount,
      price: item.price,

      isBooked,
      bookingId: item.bookingId,

      isBookable: !planExpired && !isBooked,
      sessionExpired: planExpired, // ✅ YOUR FINAL RULE

      bookedMember: isBooked
        ? {
          id: item.bookedUserId,
          name: item.bookedMemberName,
          email: item.bookedMemberEmail,
          phone: item.bookedMemberPhone,
        }
        : null,
    };
  });
};




export const cancelBookingService = async (memberId, scheduleId) => {
  const [existingRows] = await pool.query(
    "SELECT * FROM booking WHERE memberId = ? AND scheduleId = ?",
    [memberId, scheduleId]
  );
  const existing = existingRows[0];
  if (!existing) throw { status: 400, message: "No booking found" };

  await pool.query("DELETE FROM booking WHERE id = ?", [existing.id]);

  return true;
};

export const memberBookingsService = async (memberId) => {
  const [rows] = await pool.query(
    `SELECT b.*, cs.date, cs.startTime, cs.endTime, cs.day, cs.className AS className, u.fullName AS trainerName
     FROM booking b
     LEFT JOIN classschedule cs ON b.scheduleId = cs.id
     LEFT JOIN user u ON cs.trainerId = u.id
     WHERE b.memberId = ?
     ORDER BY b.id DESC`,
    [memberId]
  );
  return rows;
};

/**************************************
 * SCHEDULE CRUD
 **************************************/
export const getAllScheduledClassesService = async (adminId) => {
  const [rows] = await pool.query(
    `
    SELECT 
      cs.*,
      u.fullName AS trainerName,
      (SELECT COUNT(*) FROM booking bk WHERE bk.scheduleId = cs.id) AS membersCount
    FROM classschedule cs
    LEFT JOIN user u ON cs.trainerId = u.id
    WHERE u.adminId = ?        -- ✅ ADMIN FILTER
    ORDER BY cs.id DESC
    `,
    [adminId]
  );

  return rows.map((item) => ({
    id: item.id,
    className: item.className,
    trainerId: item.trainerId,
    trainerName: item.trainerName,
    trainer: item.trainerName,
    date: item.date,
    time: `${item.startTime} - ${item.endTime}`,
    day: item.day,
    status: item.status,
    membersCount: item.membersCount,
    price: item.price, // ✅ Added price
  }));
};

export const getScheduleByIdService = async (id) => {
  const [rows] = await pool.query(
    `SELECT cs.*, u.fullName AS trainerName
     FROM classschedule cs
     LEFT JOIN user u ON cs.trainerId = u.id
     WHERE cs.id = ?`,
    [id]
  );

  const schedule = rows[0];
  if (!schedule) throw { status: 404, message: "Class schedule not found" };
  return schedule;
};

// export const updateScheduleService = async (id, data) => {
//   const [existsRows] = await pool.query(
//     "SELECT * FROM classschedule WHERE id = ?",
//     [id]
//   );
//   const exists = existsRows[0];
//   if (!exists) throw { status: 404, message: "Class schedule not found" };

//   const fields = [];
//   const values = [];

//   // Note: use 'className' instead of 'classTypeId'
//   for (const key of [
//     "branchId", "className", "trainerId", "date", "day",
//     "startTime", "endTime", "capacity", "status", "members"
//   ]) {
//     if (data[key] !== undefined) {
//       fields.push(`${key} = ?`);
//       values.push(key === "members" ? JSON.stringify(data[key]) : data[key]);
//     }
//   }

//   if (fields.length === 0) return { ...exists, ...data };

//   values.push(id);
//   await pool.query(
//     `UPDATE classschedule SET ${fields.join(", ")} WHERE id = ?`,
//     values
//   );

//   return { ...exists, ...data };
// };

export const updateScheduleService = async (id, data) => {
  const [existsRows] = await pool.query(
    "SELECT * FROM classschedule WHERE id = ?",
    [id]
  );

  const exists = existsRows[0];
  if (!exists) throw { status: 404, message: "Class schedule not found" };

  const fields = [];
  const values = [];

  for (const key of [
    "className",
    "trainerId",
    "date",
    "day",
    "startTime",
    "endTime",
    "capacity",
    "status",
    "members",
    "price",
  ]) {
    if (data[key] !== undefined && data[key] !== null) {
      let value = data[key];

      // Convert members JSON
      if (key === "members") {
        value = JSON.stringify(value);
      }

      // Convert JS ISO date → MySQL datetime(3)
      if (key === "date") {
        value = new Date(value)
          .toISOString()
          .slice(0, 23) // keep milliseconds for datetime(3)
          .replace("T", " "); // replace T with space
      }

      fields.push(`${key} = ?`);
      values.push(value);
    }
  }

  if (fields.length === 0) return { ...exists, ...data };

  values.push(id);

  await pool.query(
    `UPDATE classschedule SET ${fields.join(", ")} WHERE id = ?`,
    values
  );

  return { ...exists, ...data };
};

// service: getPersonalAndGeneralTrainersService
// export const getPersonalAndGeneralTrainersService = async () => {
//   const [rows] = await pool.query(
//     `SELECT
//        u.id,
//        u.fullName,
//        u.email,
//        u.phone,
//        u.branchId,
//        u.roleId
//      FROM user u
//      WHERE u.roleId IN (5, 6)
//      ORDER BY u.id DESC`
//   );

//   return rows;
// };
// export const getPersonalAndGeneralTrainersService = async (adminId) => {
//   const aid = Number(adminId);
//   if (!aid) throw { status: 400, message: "adminId is required" };

//   const [rows] = await pool.query(
//     `SELECT
//        u.id,
//        u.fullName,
//        u.email,
//        u.phone,
//        u.branchId,
//        u.roleId
//      FROM user u
//      WHERE u.roleId IN (5, 6)
//        AND u.adminId = ?
//      ORDER BY u.id DESC`,
//     [aid]
//   );

//   return rows;
// };
export const getPersonalAndGeneralTrainersService = async (adminId) => {
  const aid = Number(adminId);
  if (!aid) throw { status: 400, message: "adminId is required" };

  const [rows] = await pool.query(
    `
    SELECT 
      u.id,
      u.fullName,
      u.email,
      u.phone,
      u.branchId,
      u.roleId
    FROM user u
    WHERE 
      u.roleId IN (5, 6)
      AND u.adminId = ?

      -- ❌ hide personal trainers already assigned to ACTIVE memberplan
      AND NOT EXISTS (
        SELECT 1
        FROM memberplan mp
        WHERE 
          mp.trainerId = u.id
          AND mp.trainerType = 'personal'
          AND mp.status = 'ACTIVE'
      )

    ORDER BY u.id DESC
    `,
    [aid]
  );

  return rows;
};

export const deleteScheduleService = async (id) => {
  const [existingRows] = await pool.query(
    "SELECT * FROM classschedule WHERE id = ?",
    [id]
  );
  const existing = existingRows[0];
  if (!existing) throw { status: 404, message: "Class schedule not found" };

  // Delete bookings first
  await pool.query("DELETE FROM booking WHERE scheduleId = ?", [id]);

  // Delete schedule
  await pool.query("DELETE FROM classschedule WHERE id = ?", [id]);

  return true;
};