import { pool } from "../../config/db.js";

// ➤ Create Session
// export const createSessionService = async (data) => {
//   const { sessionName, trainerId, branchId, date, time, duration, description, status } = data;

//   const [result] = await pool.query(
//     `INSERT INTO session 
//      (sessionName, trainerId, branchId, date, time, duration, description, status)
//      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
//     [sessionName, Number(trainerId), Number(branchId), new Date(date), time, Number(duration), description, status || "Upcoming"]
//   );

//   const sessionId = result.insertId;
//   const [session] = await pool.query(`SELECT * FROM session WHERE id = ?`, [sessionId]);
//   return session[0];
// };
export const createSessionService = async (data) => {
  const {
    sessionName,
    trainerId,
    adminId,      // ✅ REQUIRED
    date,
    time,
    duration,
    description,
    status
  } = data;

  if (!adminId) {
    throw { status: 400, message: "adminId is required" };
  }

  

  const [result] = await pool.query(
    `INSERT INTO session 
     (sessionName, trainerId, adminId, date, time, duration, description, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      sessionName,
      Number(trainerId),
      Number(adminId),
      date,
      time,
      Number(duration),
      description || null,
      status || "Upcoming"
    ]
  );
  

  const sessionId = result.insertId;

  const [session] = await pool.query(
    `SELECT * FROM session WHERE id = ?`,
    [sessionId]
  );

  return session[0];
};
export const listSessionsService = async ({ adminId, trainerId, search }) => {
  if (!adminId && !trainerId) {
    throw {
      status: 400,
      message: "adminId or trainerId is required",
    };
  }

  let conditions = [];
  let values = [];

  if (adminId) {
    conditions.push("s.adminId = ?");
    values.push(adminId);
  }

  if (trainerId) {
    conditions.push("s.trainerId = ?");
    values.push(trainerId);
  }

  // 🔍 Search
  conditions.push("s.sessionName LIKE ?");
  values.push(`%${search || ""}%`);

  const whereClause = conditions.join(" AND ");

  const [rows] = await pool.query(
    `
    SELECT 
      s.*,
      t.id AS trainerId,
      t.fullName AS trainerName
    FROM session s
    LEFT JOIN user t ON s.trainerId = t.id
    WHERE ${whereClause}
    ORDER BY 
      FIELD(s.status, 'Upcoming', 'Ongoing', 'Completed') ASC,
      s.date ASC,
      s.time ASC
    `,
    values
  );

  return rows;
};


// ➤ Update complete session
export const updateSessionService = async (sessionId, data) => {
  const { sessionName, trainerId, branchId, date, time, duration, description, status } = data;

  await pool.query(
    `UPDATE session 
     SET sessionName = ?, trainerId = ?, branchId = ?, date = ?, time = ?, duration = ?, description = ?, status = ?
     WHERE id = ?`,
    [sessionName, Number(trainerId), Number(branchId), new Date(date), time, Number(duration), description, status, sessionId]
  );

  const [updated] = await pool.query(`SELECT * FROM session WHERE id = ?`, [sessionId]);
  return updated[0];
};

// ➤ Update only status
export const updateSessionStatusService = async (sessionId, status) => {
  await pool.query(`UPDATE session SET status = ? WHERE id = ?`, [status, sessionId]);
  const [updated] = await pool.query(`SELECT * FROM session WHERE id = ?`, [sessionId]);
  return updated[0];
};

// ➤ Delete session
export const deleteSessionService = async (sessionId) => {
  await pool.query(`DELETE FROM pt_bookings WHERE sessionId = ?`, [sessionId]);
  await pool.query(`DELETE FROM unified_bookings WHERE sessionId = ?`, [sessionId]);
  await pool.query(`DELETE FROM session WHERE id = ?`, [sessionId]);
  return true;
};
