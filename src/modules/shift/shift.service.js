import { pool } from "../../config/db.js";

export const createShiftService = async (data) => {
  const {
    staffIds,
    branchId,
    shiftDate,
    startTime,
    endTime,
    shiftType,
    description,
    createdById,
  } = data;

  const [result] = await pool.query(
    `INSERT INTO shifts (staffIds, branchId, shiftDate, startTime, endTime, shiftType, description, status, createdById)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'Pending', ?)`,
    [
      staffIds,
      branchId,
      shiftDate,
      startTime,
      endTime,
      shiftType,
      description || null,
      createdById,
    ]
  );

  const [rows] = await pool.query(`SELECT * FROM shifts WHERE id = ?`, [
    result.insertId,
  ]);
  return rows[0];
};
export const getAllShiftsService = async (adminId) => {
  const [rows] = await pool.query(
    `
    SELECT 
      s.*,
      st.userId,
      st.gender,
      st.branchId
    FROM shifts s
    INNER JOIN staff st 
      ON st.id = s.staffIds
    WHERE st.adminId = ?
    ORDER BY s.id DESC
    `,
    [adminId]
  );

  return rows;
};






export const getShiftByShiftIdService = async (shiftId) => {
  const [rows] = await pool.query(
    `SELECT * FROM shifts WHERE id = ?`,
    [shiftId]
  );

  if (rows.length === 0) {
    throw { status: 404, message: "Shift not found" };
  }

  return rows[0];
};


export const getShiftByIdService = async (id) => {
  const [rows] = await pool.query(`SELECT * FROM shifts WHERE id = ?`, [id]);
  return rows[0];
};

export const getShiftByStaffIdService = async (staffId) => {
  const [shift] = await pool.query(
    `SELECT * FROM shifts WHERE FIND_IN_SET(?, staffIds)`,
    [staffId]
  );

  if (shift.length === 0) {
    throw { status: 404, message: "No shift assigned to this staff" };
  }

  return shift[0];
};



// export const updateShiftService = async (id, data) => {
//   const {
//     staffIds,
//     branchId,
//     shiftDate,
//     startTime,
//     endTime,
//     shiftType,
//     description,
//     status,
//   } = data;
//   await pool.query(
//     `UPDATE shifts SET staffIds=?, branchId=?, shiftDate=?, startTime=?, endTime=?, shiftType=?, description=?, status=? WHERE id=?`,
//     [
//       staffIds,
//       branchId,
//       shiftDate,
//       startTime,
//       endTime,
//       shiftType,
//       description,
//       status,
//       id,
//     ]
//   );
//   const [rows] = await pool.query(`SELECT * FROM shifts WHERE id = ?`, [id]);
//   return rows[0];
// };

export const updateShiftService = async (id, data) => {
  const [existingRows] = await pool.query(
    `SELECT * FROM shifts WHERE id = ?`,
    [id]
  );

  if (existingRows.length === 0) {
    throw { status: 404, message: "Shift not found" };
  }

  const existing = existingRows[0];

  const {
    staffIds,
    branchId,
    shiftDate,
    startTime,
    endTime,
    shiftType,
    description,
    status,
  } = data;

  /* KEEP OLD VALUE IF NOT SENT */
  const finalStaffIds =
    staffIds !== undefined ? staffIds : existing.staffIds;

  const finalBranchId =
    branchId !== undefined ? branchId : existing.branchId;

  const finalShiftDate =
    shiftDate !== undefined ? shiftDate : existing.shiftDate;

  const finalStartTime =
    startTime !== undefined ? startTime : existing.startTime;

  const finalEndTime =
    endTime !== undefined ? endTime : existing.endTime;

  const finalShiftType =
    shiftType !== undefined ? shiftType : existing.shiftType;

  const finalDescription =
    description !== undefined ? description : existing.description;

  const finalStatus =
    status !== undefined ? status : existing.status;

  await pool.query(
    `UPDATE shifts
     SET staffIds = ?,
         branchId = ?,
         shiftDate = ?,
         startTime = ?,
         endTime = ?,
         shiftType = ?,
         description = ?,
         status = ?
     WHERE id = ?`,
    [
      finalStaffIds,
      finalBranchId,
      finalShiftDate,
      finalStartTime,
      finalEndTime,
      finalShiftType,
      finalDescription,
      finalStatus,
      id,
    ]
  );

  const [rows] = await pool.query(
    `SELECT * FROM shifts WHERE id = ?`,
    [id]
  );

  return rows[0];
};

export const deleteShiftService = async (id) => {
  await pool.query(`DELETE FROM shifts WHERE id = ?`, [id]);
  return { message: "Shift deleted successfully" };
};
