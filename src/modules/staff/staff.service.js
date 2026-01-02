// staff.service.js
import { pool } from "../../config/db.js";

/**************************************
 * CREATE STAFF
 **************************************/
export const createStaffService = async (data) => {
  const {
    fullName,
    email,
    phone,
    password,
    roleId,
    adminId,
    gender,
    dateOfBirth,
    joinDate,
    exitDate,
    profilePhoto,
  } = data;

  /* ----------------------------------------------------
     1️⃣ CHECK DUPLICATE EMAIL
  ---------------------------------------------------- */
  const [exists] = await pool.query("SELECT id FROM user WHERE email = ?", [
    email,
  ]);

  if (exists.length > 0) {
    throw { status: 400, message: "Email already exists" };
  }

  /* ----------------------------------------------------
     2️⃣ GET ADMIN BRANCH ID
  ---------------------------------------------------- */
  const [adminRows] = await pool.query(
    "SELECT branchId FROM user WHERE id = ?",
    [adminId]
  );

  if (adminRows.length === 0) {
    throw { status: 404, message: "Admin not found" };
  }

  const adminBranchId = adminRows[0].branchId || null;

  /* ----------------------------------------------------
     3️⃣ INSERT USER (STAFF USER)
  ---------------------------------------------------- */
  const [result] = await pool.query(
    `INSERT INTO user 
     (adminId, fullName, email, phone, password, roleId, branchId, profileImage)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      adminId,
      fullName,
      email,
      phone || null,
      password,
      roleId,
      adminBranchId, // 👈 staff user bhi same branch me
      profilePhoto || null,
    ]
  );

  const userId = result.insertId;

  /* ----------------------------------------------------
     4️⃣ INSERT STAFF DETAILS (WITH branchId)
  ---------------------------------------------------- */
  await pool.query(
    `INSERT INTO staff
     (userId, adminId, branchId, gender, dateOfBirth, joinDate, exitDate, profilePhoto)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      adminId,
      adminBranchId, // 👈 MAIN REQUIREMENT
      gender || null,
      dateOfBirth ? new Date(dateOfBirth) : null,
      joinDate ? new Date(joinDate) : null,
      exitDate ? new Date(exitDate) : null,
      profilePhoto || null,
    ]
  );

  /* ----------------------------------------------------
     5️⃣ RETURN RESPONSE
  ---------------------------------------------------- */
  return {
    id: userId,
    fullName,
    email,
    roleId,
    adminId,
    branchId: adminBranchId,
    gender,
    dateOfBirth,
    joinDate,
    exitDate,
    profilePhoto,
  };
};

/**************************************
 * LIST STAFF
 **************************************/
// export const listStaffService = async (adminId) => {
//   const sql = `
//     SELECT
//       s.id AS staffId,
//       u.id AS userId,
//       u.fullName,
//       u.email,
//       u.phone,
//       u.roleId,
//       u.branchId,
//       s.adminId,
//       s.gender,
//       s.dateOfBirth,
//       s.joinDate,
//       s.exitDate,
//       s.profilePhoto,
//       u.status
//     FROM staff s
//     JOIN user u ON u.id = s.userId
//     WHERE s.adminId = ?
//       AND s.branchId = (
//         SELECT branchId FROM user WHERE id = ?
//       )
//     ORDER BY s.id DESC
//   `;

//   const [rows] = await pool.query(sql, [adminId, adminId]);
//   return rows;
// };

export const listStaffService = async (adminId) => {
  const sql = `
    SELECT 
      s.id AS staffId,
      u.id AS userId,
      u.fullName,
      u.email,
      u.phone,
      u.roleId,
      u.branchId,
      s.adminId,
      s.gender,
      s.dateOfBirth,
      s.joinDate,
      s.exitDate,
      s.profilePhoto,
      u.status
    FROM staff s
    JOIN user u ON u.id = s.userId
    WHERE s.adminId = ?
    ORDER BY s.id DESC
  `;

  const [rows] = await pool.query(sql, [adminId]);
  return rows;
};

/**************************************
 * STAFF DETAIL
 **************************************/
export const staffDetailService = async (staffId, adminId) => {
  const sql = `
    SELECT 
      s.id AS staffId,
      u.id AS userId,
      u.fullName,
      u.email,
      u.phone,
      u.roleId,
      u.branchId,
      s.adminId,
      s.gender,
      s.dateOfBirth,
      s.joinDate,
      s.exitDate,
      s.profilePhoto,
      u.status
    FROM staff s
    JOIN user u ON u.id = s.userId
    WHERE s.id = ?
      AND s.adminId = ?
      AND s.branchId = (
        SELECT branchId FROM user WHERE id = ?
      )
  `;

  const [rows] = await pool.query(sql, [staffId, adminId, adminId]);

  if (rows.length === 0) {
    throw { status: 404, message: "Staff not found" };
  }

  return rows[0];
};

/**************************************
 * UPDATE STAFF
 **************************************/
export const updateStaffService = async (id, data) => {
  /* ----------------------------------------------------
     1️⃣ FIND STAFF (staff.id OR userId)
  ---------------------------------------------------- */
  const [[staff]] = await pool.query(
    `
    SELECT 
      s.id AS staffId,
      s.userId,
      s.branchId,
      s.profilePhoto
    FROM staff s
    WHERE s.id = ? OR s.userId = ?
    LIMIT 1
    `,
    [id, id]
  );

  if (!staff) {
    throw { status: 404, message: "Staff not found" };
  }

  const staffId = staff.staffId;
  const userId = staff.userId;
  const existingProfilePhoto = staff.profilePhoto;

  /* ----------------------------------------------------
     2️⃣ EMAIL DUPLICATE CHECK (IF EMAIL UPDATED)
  ---------------------------------------------------- */
  if (data.email) {
    const [[emailExists]] = await pool.query(
      `SELECT id FROM user WHERE email = ? AND id != ?`,
      [data.email, userId]
    );

    if (emailExists) {
      throw { status: 400, message: "Email already exists" };
    }
  }

  /* ----------------------------------------------------
     3️⃣ GET ADMIN BRANCH (IF adminId CHANGES)
  ---------------------------------------------------- */
  let branchId = staff.branchId;

  if (data.adminId) {
    const [[admin]] = await pool.query(
      `SELECT branchId FROM user WHERE id = ?`,
      [data.adminId]
    );

    if (!admin) {
      throw { status: 404, message: "Admin not found" };
    }

    branchId = admin.branchId || null;
  }

  /* ----------------------------------------------------
     4️⃣ UPDATE USER (ONLY SENT FIELDS)
  ---------------------------------------------------- */
  const userFields = [];
  const userValues = [];

  const userColumns = ["fullName", "email", "phone", "password", "roleId","profileImage"];

  for (const col of userColumns) {
    if (data[col] !== undefined) {
      userFields.push(`${col} = ?`);
      userValues.push(data[col]);
    }
  }

  // update branchId only if adminId changed
  if (data.adminId !== undefined) {
    userFields.push("branchId = ?");
    userValues.push(branchId);
  }

   if (data.profilePhoto) {
    // Update profileImage in user if profilePhoto is provided
    userFields.push("profileImage = ?");
    userValues.push(data.profilePhoto);  // Set new profile image
  } else if (!data.profilePhoto && existingProfilePhoto) {
    userFields.push("profileImage = ?");
    userValues.push(existingProfilePhoto); // Use the existing profile image if no new image
  }

  if (userFields.length > 0) {
    userValues.push(userId);
    await pool.query(
      `UPDATE user SET ${userFields.join(", ")} WHERE id = ?`,
      userValues
    );
  }

  /* ----------------------------------------------------
     5️⃣ UPDATE STAFF (ONLY SENT FIELDS)
  ---------------------------------------------------- */
  const staffFields = [];
  const staffValues = [];

  const staffColumns = [
    "adminId",
    "gender",
    "dateOfBirth",
    "joinDate",
    "exitDate",
    "profilePhoto",
  ];

  for (const col of staffColumns) {
    if (data[col] !== undefined) {
      staffFields.push(`${col} = ?`);

      if (["dateOfBirth", "joinDate", "exitDate"].includes(col)) {
        staffValues.push(data[col] ? new Date(data[col]) : null);
      } else {
        staffValues.push(data[col]);
      }
    }
  }
  if (!data.profilePhoto) {
    staffFields.push("profilePhoto = ?");
    staffValues.push(existingProfilePhoto);  // Use existing photo URL
  }

  // keep branch synced with admin
  if (data.adminId !== undefined) {
    staffFields.push("branchId = ?");
    staffValues.push(branchId);
  }

  if (staffFields.length > 0) {
    staffValues.push(staffId);
    await pool.query(
      `UPDATE staff SET ${staffFields.join(", ")} WHERE id = ?`,
      staffValues
    );
  }
const[rows]=await pool.query("SELECT * FROM staff WHERE id=?",[staffId]);


  return rows[0];
};



export const getAllStaffService = async (adminId) => {
  const sql = `
    SELECT 
      s.id AS staffId,
      u.id AS userId,
      u.fullName,
      u.email,
      u.phone,
      u.roleId,
      u.branchId,
      s.adminId,
      s.gender,
      s.dateOfBirth,
      s.joinDate,
      s.exitDate,
      s.profilePhoto,
      u.status
    FROM staff s
    JOIN user u ON u.id = s.userId
    WHERE s.adminId = ?
    ORDER BY s.id DESC
  `;

  const [rows] = await pool.query(sql, [adminId]);
  return rows;
};


export const getTrainerByIdService = async (trainerId) => {
  const sql = `
    SELECT 
      u.id AS trainerId,
      u.fullName,
      u.email,
      u.phone,
      u.branchId,
      u.roleId
    FROM user u
    WHERE u.id = ? AND u.roleId = 4
    LIMIT 1
  `;

  const [rows] = await pool.query(sql, [trainerId]);

  if (rows.length === 0) {
    throw { status: 404, message: "Trainer not found" };
  }

  return rows[0];
};

/**************************************
 * DELETE STAFF
 **************************************/
// export const deleteStaffService = async (id) => {
//   // soft delete user and staff
//   await pool.query(
//     `UPDATE user SET status='Inactive' WHERE id=?`,
//     [id]
//   );
//   await pool.query(
//     `UPDATE staff SET status='Inactive', exitDate=? WHERE userId=?`,
//     [new Date(), id]
//   );

//   return { message: "Staff deactivated successfully" };
// };

// export const deleteStaffService = async (staffId) => {
//   // 1️⃣ Find staff entry using staff.id
//   const [rows] = await pool.query(
//     "SELECT userId FROM staff WHERE id = ?",
//     [staffId]
//   );

//   if (rows.length === 0) {
//     throw { status: 404, message: "Staff not found" };
//   }

//   const userId = rows[0].userId;

//   // 2️⃣ Delete from staff table using staff.id
//   await pool.query("DELETE FROM staff WHERE id = ?", [staffId]);

//   // 3️⃣ Delete linked user
//   await pool.query("DELETE FROM user WHERE id = ?", [userId]);

//   return { message: "Staff deleted permanently" };
// };
export const deleteStaffService = async (staffId) => {
  const sid = Number(staffId);
  if (!sid) throw { status: 400, message: "Invalid staff id" };

  /* ----------------------------------------------------
     1️⃣ CHECK STAFF EXISTS
  ---------------------------------------------------- */
  const [staffRows] = await pool.query(
    "SELECT id, userId FROM staff WHERE id = ?",
    [sid]
  );

  if (staffRows.length === 0) {
    throw { status: 404, message: "Staff not found" };
  }

  const userId = staffRows[0].userId;

  /* ----------------------------------------------------
     2️⃣ DELETE TRAINER DEPENDENT DATA (VERY IMPORTANT)
  ---------------------------------------------------- */

  // 🔥 classes
  await pool.query("DELETE FROM classschedule WHERE trainerId = ?", [userId]);

  // 🔥 sessions (NEW FIX)
  await pool.query("DELETE FROM session WHERE trainerId = ?", [userId]);

  /* ----------------------------------------------------
     3️⃣ DELETE STAFF RELATED DATA
  ---------------------------------------------------- */
  await pool.query("DELETE FROM salary WHERE staffId = ?", [sid]);

  const relatedTables = [
    "alert",
    "housekeepingattendance",
    "housekeepingschedule",
    "staffattendance",
  ];

  for (const table of relatedTables) {
    await pool.query(`DELETE FROM ${table} WHERE staffId = ?`, [sid]);
  }

  /* ----------------------------------------------------
     4️⃣ CLEAN shifts.staffIds (CSV FIELD)
  ---------------------------------------------------- */
  await pool.query(
    `UPDATE shifts
     SET staffIds = TRIM(BOTH ',' FROM
       REPLACE(CONCAT(',', staffIds, ','), CONCAT(',', ?, ','), ',')
     )
     WHERE FIND_IN_SET(?, staffIds);`,
    [sid, sid]
  );

  /* ----------------------------------------------------
     5️⃣ DELETE STAFF
  ---------------------------------------------------- */
  await pool.query("DELETE FROM staff WHERE id = ?", [sid]);

  /* ----------------------------------------------------
     6️⃣ DELETE USER (NOW SAFE)
  ---------------------------------------------------- */
  await pool.query("DELETE FROM user WHERE id = ?", [userId]);

  return {
    message: "Staff, trainer, classes & sessions deleted successfully",
  };
};

export const getAdminStaffService = async (adminId) => {
  const sql = `
    SELECT 
      s.id AS staffId,
      u.id AS userId,
      u.fullName,
      u.email,
      u.phone,
      u.roleId,
      u.branchId,
      s.gender,
      s.dateOfBirth,
      s.joinDate,
      s.exitDate,
      s.profilePhoto,
      u.status AS userStatus
    FROM staff s
    JOIN user u ON u.id = s.userId
    WHERE s.adminId = ?
      AND s.branchId = (
        SELECT branchId FROM user WHERE id = ?
      )
    ORDER BY s.id DESC
  `;

  const [rows] = await pool.query(sql, [adminId, adminId]);
  return rows;
};
