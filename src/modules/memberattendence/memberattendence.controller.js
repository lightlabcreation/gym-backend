import { pool } from "../../config/db.js";

/* -----------------------------------------------------
   1️⃣  MEMBER/ADMIN CHECK-IN  (Manual + QR + Manual Times)
------------------------------------------------------ */
export const memberCheckIn = async (req, res, next) => {
  try {
    const { memberId, branchId, mode, notes, checkIn, userRole, qrAdminId } = req.body;

    if (!memberId) {
      return res.status(400).json({
        success: false,
        message: "memberId required",
      });
    }

    // ✅ Check-in time (default = now)
    const finalCheckIn = checkIn ? new Date(checkIn) : new Date();
    if (isNaN(finalCheckIn.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid checkIn format. Use YYYY-MM-DD HH:mm:ss",
      });
    }

    // ❌ CheckOut always NULL at check-in
    const finalCheckOut = null;

    // Check if user is a member or admin
    let isMember = false;
    let isAdmin = false;
    let userBranchId = branchId;
    let memberAdminId = null;

    // ✅ QR code adminId is required
    if (!qrAdminId) {
      return res.status(400).json({
        success: false,
        message: "QR code adminId is required. Please scan a valid admin QR code.",
      });
    }

    // First, check if member exists
    const [memberRecords] = await pool.query(
      "SELECT * FROM member WHERE id = ?",
      [memberId]
    );

    if (memberRecords.length > 0) {
      isMember = true;
      memberAdminId = memberRecords[0].adminId;
      // Always use member's branchId from database (most reliable)
      userBranchId = memberRecords[0].branchId || branchId;
      
      // ✅ Validate adminId match - QR code's adminId must match member's adminId
      if (!memberAdminId) {
        return res.status(400).json({
          success: false,
          message: "Member adminId not found. Member must be added by an admin.",
        });
      }
      
      const qrAdminIdInt = parseInt(qrAdminId);
      const memberAdminIdInt = parseInt(memberAdminId);
      
      if (qrAdminIdInt !== memberAdminIdInt) {
        return res.status(400).json({
          success: false,
          message: "This QR code belongs to a different admin. You can only scan your admin's QR code.",
        });
      }
    } else {
      // Not a member, check if staff/user exists
      const [userRecords] = await pool.query(
        `SELECT u.*, r.name as roleName FROM user u 
         LEFT JOIN role r ON u.roleId = r.id 
         WHERE u.id = ?`,
        [memberId]
      );

      if (userRecords.length > 0) {
        const user = userRecords[0];
        const roleName = user.roleName?.toUpperCase() || '';
        
        // ❌ Block admin check-in - Admin cannot check-in themselves
        if (roleName === 'ADMIN' || roleName === 'SUPERADMIN') {
          return res.status(403).json({
            success: false,
            message: "Admin cannot check-in. Only staff (members, receptionists, trainers) can check-in using admin's QR code.",
          });
        }
        
        // For staff (receptionist, trainer, etc.), check their adminId
        // Staff members have adminId in user table
        let staffAdminId = user.adminId;
        
        // If adminId not in user table, check staff table
        if (!staffAdminId) {
          const [staffRecords] = await pool.query(
            "SELECT adminId FROM staff WHERE userId = ?",
            [memberId]
          );
          if (staffRecords.length > 0 && staffRecords[0].adminId) {
            staffAdminId = staffRecords[0].adminId;
          }
        }
        
        // ✅ Validate adminId match for staff
        if (!staffAdminId) {
          return res.status(400).json({
            success: false,
            message: "Staff adminId not found. Staff must be assigned to an admin.",
          });
        }
        
        const qrAdminIdInt = parseInt(qrAdminId);
        const staffAdminIdInt = parseInt(staffAdminId);
        
        if (qrAdminIdInt !== staffAdminIdInt) {
          return res.status(400).json({
            success: false,
            message: "This QR code belongs to a different admin. You can only scan your admin's QR code.",
          });
        }
        
        // Use user's branchId if not provided
        if (!userBranchId && user.branchId) {
          userBranchId = user.branchId;
        }
        // If still no branchId, use 1 as default
        if (!userBranchId) {
          userBranchId = 1;
        }
      } else {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }
    }

    // 🔁 Prevent multiple open check-ins same day
    const [existing] = await pool.query(
      `
      SELECT id FROM memberattendance
      WHERE memberId = ?
        AND DATE(checkIn) = CURDATE()
        AND checkOut IS NULL
      `,
      [memberId]
    );

    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: isMember ? "Member already checked in" : "Already checked in",
      });
    }

    // ✅ INSERT with correct status
    await pool.query(
      `
      INSERT INTO memberattendance
      (memberId, branchId, checkIn, checkOut, mode, status, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        memberId,
        userBranchId || null,
        finalCheckIn,
        finalCheckOut,
        mode || "QR",
        "In Gym",          // ✅ FIXED STATUS
        notes || null,
      ]
    );

    res.json({
      success: true,
      message: isMember ? "Member checked in successfully" : "Checked in successfully",
    });
  } catch (err) {
    next(err);
  }
};


export const getAttendanceByMemberId = async (req, res, next) => {
  try {
    const memberId = req.params.memberId;

    if (!memberId) {
      return res.status(400).json({
        success: false,
        message: "memberId is required",
      });
    }

    // 📌 Fetch all attendance of this member (latest first)
    const [rows] = await pool.query(
      `
      SELECT 
        id,
        memberId,
        branchId,
        checkIn,
        checkOut,
        createdAt,
        notes,
        status,
        mode
      FROM memberattendance
      WHERE memberId = ?
      ORDER BY id DESC
      `,
      [memberId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No attendance found for this member",
      });
    }

    res.json({
      success: true,
      attendance: rows,
    });

  } catch (err) {
    next(err);
  }
};


/* -----------------------------------------------------
   2️⃣  MEMBER CHECK-OUT (Manual Checkout Time Supported)
------------------------------------------------------ */
export const memberCheckOut = async (req, res, next) => {
  try {
    const attendanceId = req.params.id; // /checkout/:id

    if (!attendanceId) {
      return res.status(400).json({
        success: false,
        message: "attendanceId is required in params",
      });
    }

    // 1️⃣ Check record exists
    const [existing] = await pool.query(
      `SELECT * FROM memberattendance WHERE id = ?`,
      [attendanceId]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Attendance record not found",
      });
    }

    const record = existing[0];

    // 2️⃣ Already checked out?
    if (record.checkOut !== null) {
      return res.status(400).json({
        success: false,
        message: "Member already checked out",
      });
    }

    // 3️⃣ Checkout time = now
    const finalCheckOut = new Date();

    // 4️⃣ Update checkout + status
    const [result] = await pool.query(
      `
      UPDATE memberattendance
      SET 
        checkOut = ?,
        status = 'Present'
      WHERE id = ?
      `,
      [finalCheckOut, attendanceId]
    );

    if (result.affectedRows === 0) {
      return res.status(500).json({
        success: false,
        message: "Checkout update failed",
      });
    }

    res.json({
      success: true,
      message: "Member checked out successfully",
      checkOut: finalCheckOut,
      status: "Present",
    });
  } catch (err) {
    next(err);
  }
};



/* -----------------------------------------------------
   3️⃣  DAILY ATTENDANCE LIST (Search + Filter + Status)
------------------------------------------------------ */
export const getDailyAttendance = async (req, res, next) => {
  try {
    const { date, search, branchId } = req.query;

    let sql = `
      SELECT 
        a.id,
        a.memberId,
        a.branchId,
        a.checkIn,
        a.checkOut,
        a.mode,
        a.status,
        a.notes,
        m.fullName,
        DATE(a.checkIn) AS attendanceDate
      FROM memberattendance a
      LEFT JOIN member m ON m.id = a.memberId
      WHERE 1=1
    `;

    const params = [];

    if (branchId) {
      sql += ` AND a.branchId = ?`;
      params.push(branchId);
    }

    if (date) {
      const mysqlDate = new Date(date).toISOString().slice(0, 10);
      sql += ` AND DATE(a.checkIn) = ?`;
      params.push(mysqlDate);
    }

    if (search) {
      sql += ` AND (m.fullName LIKE ? OR m.memberCode LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }

    sql += ` ORDER BY a.checkIn DESC`;

    const [rows] = await pool.query(sql, params);

    const formatted = rows.map(r => ({
      ...r,
      computedStatus: r.checkOut ? "Completed" : "Active",
    }));

    res.json({
      success: true,
      attendance: formatted,
    });

  } catch (err) {
    next(err);
  }
};


/* -----------------------------------------------------
   4️⃣  ATTENDANCE DETAIL VIEW
------------------------------------------------------ */
export const attendanceDetail = async (req, res, next) => {
  try {
    const id = req.params.id;

    const [rows] = await pool.query(
      `
      SELECT 
        a.*, 
        m.fullName, 
        m.phone
      FROM memberattendance a
      LEFT JOIN member m ON a.memberId = m.id
      WHERE a.id = ?
      `,
      [id]
    );

    res.json({
      success: true,
      attendance: rows[0],
    });

  } catch (err) {
    next(err);
  }
};


/* -----------------------------------------------------
   5️⃣  TODAY SUMMARY (Dashboard Cards)
------------------------------------------------------ */
export const getTodaySummary = async (req, res, next) => {
  try {
    const [present] = await pool.query(
      `SELECT COUNT(*) AS count FROM memberattendance WHERE DATE(checkIn) = CURDATE()`
    );

    const [active] = await pool.query(
      `SELECT COUNT(*) AS count FROM memberattendance WHERE DATE(checkIn) = CURDATE() AND checkOut IS NULL`
    );

    const [completed] = await pool.query(
      `SELECT COUNT(*) AS count FROM memberattendance WHERE DATE(checkIn) = CURDATE() AND checkOut IS NOT NULL`
    );

    res.json({
      success: true,
      summary: {
        present: present[0].count,
        active: active[0].count,
        completed: completed[0].count,
      },
    });

  } catch (err) {
    next(err);
  }
};

export const deleteAttendance = async (req, res, next) => {
  try {
    const attendanceId = req.params.id;

    if (!attendanceId) {
      return res.status(400).json({
        success: false,
        message: "attendanceId is required",
      });
    }

    // Record exist karta hai?
    const [existing] = await pool.query(
      `SELECT id FROM memberattendance WHERE id = ?`,
      [attendanceId]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Attendance record not found",
      });
    }

    // Delete record
    const [result] = await pool.query(
      `DELETE FROM memberattendance WHERE id = ?`,
      [attendanceId]
    );

    if (result.affectedRows === 0) {
      return res.status(500).json({
        success: false,
        message: "Failed to delete attendance",
      });
    }

    res.json({
      success: true,
      message: "Attendance deleted successfully",
    });

  } catch (err) {
    next(err);
  }
};
// export const getAttendanceByAdminId = async (req, res, next) => {
//   try {
//     const { adminId, date, search } = req.query;

//     if (!adminId) {
//       return res.status(400).json({
//         success: false,
//         message: "adminId is required",
//       });
//     }

//     let sql = `
//       SELECT
//         a.id,
//         DATE(a.checkIn) AS date,

//         /* NAME */
//         CASE
//           WHEN a.staffId IS NOT NULL THEN su.fullName
//           ELSE mu.fullName
//         END AS name,

//         /* ROLE */
//         CASE
//           WHEN a.staffId IS NOT NULL THEN sr.name
//           ELSE mr.name
//         END AS role,

//         a.checkIn,
//         a.checkOut,
//         a.mode,
//         sh.shiftType AS shift,
//         a.status

//       FROM memberattendance a

//       /* ===== STAFF ===== */
//       LEFT JOIN staff s ON s.id = a.staffId
//       LEFT JOIN user su ON su.id = s.userId
//       LEFT JOIN role sr ON sr.id = su.roleId

//       /* ===== MEMBER ===== */
//       LEFT JOIN member m ON m.userId= a.memberId
//       LEFT JOIN user mu ON mu.id = m.userId
//       LEFT JOIN role mr ON mr.id = mu.roleId

//       /* ===== SHIFT (STAFF ONLY) ===== */
//       LEFT JOIN shifts sh
//         ON sh.staffIds = a.staffId
//        AND DATE(sh.shiftDate) = DATE(a.checkIn)

//       /* ===== ADMIN FILTER (CORE LOGIC) ===== */
//       WHERE (
//         (a.staffId IS NOT NULL AND s.adminId = ?)
//         OR
//         (a.memberId IS NOT NULL AND m.adminId = ?)
//       )
//     `;

//     const params = [adminId, adminId];

//     if (date) {
//       sql += ` AND DATE(a.checkIn) = ?`;
//       params.push(date);
//     }

//     if (search) {
//       sql += `
//         AND (
//           su.fullName LIKE ?
//           OR mu.fullName LIKE ?
//         )
//       `;
//       params.push(`%${search}%`, `%${search}%`);
//     }

//     sql += ` ORDER BY a.checkIn DESC`;

//     const [rows] = await pool.query(sql, params);

//     res.json({
//       success: true,
//       attendance: rows,
//     });
//   } catch (err) {
//     next(err);
//   }
// }

// export const getAttendanceByAdminId = async (req, res, next) => {
//   try {
//     const { adminId } = req.query; // Only adminId is coming from the request

//     if (!adminId) {
//       return res.status(400).json({
//         success: false,
//         message: "adminId is required",
//       });
//     }

//     // SQL query to get attendance records based on adminId
//     let sql = `
//       SELECT
//         a.id,
//         DATE(a.checkIn) AS date,
//         mu.fullName AS name,  -- Member's full name
//         mr.name AS role,      -- Member's role from the role table
//         a.checkIn,
//         a.checkOut,
//         a.mode,
//         NULL AS shift,        -- No shift in this case, so null
//         a.status

//       FROM memberattendance a

//       /* ===== MEMBER JOIN ===== */
//       LEFT JOIN member m ON m.userId = a.memberId
//       LEFT JOIN user mu ON mu.id = m.userId
//       LEFT JOIN role mr ON mr.id = mu.roleId  -- Getting role name

//       /* ===== FILTER BASED ON adminId IN MEMBER TABLE ===== */
//       WHERE m.adminId = ?  -- Ensuring that the adminId in the member table matches
//     `;

//     const params = [adminId];  // Only passing adminId as a parameter

//     // Execute the query with parameters
//     const [rows] = await pool.query(sql, params);

//     res.json({
//       success: true,
//       attendance: rows, // Returning the attendance data
//     });
//   } catch (err) {
//     next(err);  // Handling errors
//   }
// };


// export const getAttendanceByAdminId = async (req, res, next) => {
//   try {
//     const { adminId, from, to } = req.query;

//     if (!adminId) {
//       return res.status(400).json({
//         success: false,
//         message: "adminId is required",
//       });
//     }

//     // Build date filter
//     let dateFilter = "";
//     const dateParams = [];
    
//     if (from && to) {
//       const fromDate = new Date(from).toISOString().slice(0, 10);
//       const toDate = new Date(to).toISOString().slice(0, 10);
//       dateFilter = " AND DATE(a.checkIn) BETWEEN ? AND ?";
//       dateParams.push(fromDate, toDate);
//     }

//     // ✅ Fetch both MEMBER and STAFF attendance
//     // Members: memberattendance.memberId -> member.id -> member.adminId
//     // Staff: memberattendance.memberId -> user.id -> user.adminId OR staff.adminId
// const sql = `
// SELECT
//   a.id,
//   DATE(a.checkIn) AS date,
//   a.checkIn,
//   a.checkOut,
//   a.mode,

//   /* NAME */
//   COALESCE(m.fullName, u.fullName) AS name,

//   /* ROLE */
//   COALESCE(mr.name, ur.name) AS role,

//   /* TYPE */
//   CASE
//     WHEN m.id IS NOT NULL THEN 'Member'
//     WHEN s.id IS NOT NULL THEN 'Staff'
//     ELSE 'Unknown'
//   END AS type,

//   /* SHIFT (staff only) */
//   sh.shiftType AS shift,

//   /* STATUS */
//   CASE
//     WHEN a.checkIn IS NOT NULL AND a.checkOut IS NULL THEN 'In Gym'
//     WHEN a.checkOut IS NOT NULL THEN 'Present'
//     ELSE a.status
//   END AS status

// FROM memberattendance a

// /* ================= MEMBER ================= */
// LEFT JOIN member m ON m.id = a.memberId
// LEFT JOIN user mu ON mu.id = m.userId
// LEFT JOIN role mr ON mr.id = mu.roleId

// /* ================= STAFF ================= */
// LEFT JOIN staff s ON s.id = a.staffId
// LEFT JOIN user u ON u.id = s.userId
// LEFT JOIN role ur ON ur.id = u.roleId

// /* ================= SHIFT ================= */
// LEFT JOIN shifts sh 
//   ON sh.staffIds = s.id
//  AND DATE(sh.shiftDate) = DATE(a.checkIn)

// WHERE (
//    (m.id IS NOT NULL AND m.adminId = ?)
//    OR
//    (s.id IS NOT NULL AND s.adminId = ?)
// )
// ${dateFilter}
// ORDER BY a.checkIn DESC
// `;


//     // Parameters: adminId (for member), adminId (for user.adminId), adminId (for staff.adminId), then date params
// const queryParams = [adminId, adminId, ...dateParams];


//     const [rows] = await pool.query(sql, queryParams);

//     // ✅ Calculate heatmap data (day vs hour)
//     const heatmap = {};
//     const heatDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    
//     rows.forEach(record => {
//       if (record.checkIn) {
//         const checkInDate = new Date(record.checkIn);
//         const dayIndex = checkInDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
//         // Convert to Monday = 0 format
//         const dayIndexAdjusted = dayIndex === 0 ? 6 : dayIndex - 1;
//         const day = heatDays[dayIndexAdjusted];
//         const hour = checkInDate.getHours().toString().padStart(2, '0');
        
//         if (!heatmap[day]) {
//           heatmap[day] = {};
//         }
//         if (!heatmap[day][hour]) {
//           heatmap[day][hour] = 0;
//         }
//         heatmap[day][hour] += 1;
//       }
//     });

//     // ✅ Calculate staff compliance (only for staff records)
//     const staffRecords = rows.filter(r => r.type === 'Staff');
//     const staffMap = {};
    
//     staffRecords.forEach(record => {
//       if (!staffMap[record.name]) {
//         staffMap[record.name] = {
//           name: record.name,
//           role: record.role,
//           shift: record.shift || 'Straight',
//           scheduledHrs: 48, // Default weekly hours
//           presentHrs: 0,
//           checkIns: 0
//         };
//       }
      
//       if (record.checkIn && record.checkOut) {
//         const diffMs = new Date(record.checkOut) - new Date(record.checkIn);
//         const hours = diffMs / (1000 * 60 * 60);
//         staffMap[record.name].presentHrs += hours;
//         staffMap[record.name].checkIns += 1;
//       }
//     });

//     const staffTable = Object.values(staffMap).map(staff => ({
//       name: staff.name,
//       role: staff.role,
//       shift: staff.shift,
//       scheduledHrs: staff.scheduledHrs,
//       presentHrs: Number(staff.presentHrs.toFixed(1)),
//       ot: Math.max(0, staff.presentHrs - staff.scheduledHrs),
//       compliance: staff.scheduledHrs > 0 
//         ? Math.round((staff.presentHrs / staff.scheduledHrs) * 100)
//         : 0
//     }));

//     // ✅ Calculate overall compliance
//     const totalScheduled = staffTable.reduce((sum, s) => sum + s.scheduledHrs, 0);
//     const totalPresent = staffTable.reduce((sum, s) => sum + s.presentHrs, 0);
//     const overallCompliance = totalScheduled > 0 
//       ? Math.round((totalPresent / totalScheduled) * 100)
//       : 0;

//     res.json({
//       success: true,
//       attendance: rows,
//       heatmap: heatmap,
//       overallCompliance: overallCompliance,
//       table: staffTable
//     });
//   } catch (err) {
//     next(err);
//   }
// };

export const getMemberAttendanceByAdmin = async (req, res, next) => {
  try {
    const { adminId, from, to } = req.query;

    if (!adminId) {
      return res.status(400).json({
        success: false,
        message: "adminId is required",
      });
    }

    const today = new Date().toISOString().slice(0, 10);
    let dateFilter = "";
    const dateParams = [];

    if (from && to) {
      dateFilter = " AND DATE(a.checkIn) BETWEEN ? AND ?";
      dateParams.push(from, to);
    } else if (from) {
      dateFilter = " AND DATE(a.checkIn) = ?";
      dateParams.push(from);
    } else {
      dateFilter = " AND DATE(a.checkIn) = ?";
      dateParams.push(today);
    }

    const sql = `
      SELECT
        a.id,
        DATE(a.checkIn) AS date,
        a.checkIn,
        a.checkOut,
        a.mode,
        a.status,
        u.fullName AS name,
        r.name AS role,
        'Member' AS type
      FROM memberattendance a
      JOIN user u ON u.id = a.memberId
      JOIN role r ON r.id = u.roleId
      WHERE u.adminId = ?
        AND u.roleId = 4
      ${dateFilter}
      ORDER BY a.checkIn DESC
    `;

    const params = [adminId, ...dateParams];
    const [rows] = await pool.query(sql, params);

    res.json({
      success: true,
      date: from || today,
      attendance: rows,
    });
  } catch (err) {
    next(err);
  }
};


export const getStaffAttendanceByAdmin = async (req, res, next) => {
  try {
    const { adminId, from, to } = req.query;

    if (!adminId) {
      return res.status(400).json({
        success: false,
        message: "adminId is required",
      });
    }

    const today = new Date().toISOString().slice(0, 10);
    let dateFilter = "";
    const dateParams = [];

    if (from && to) {
      dateFilter = " AND DATE(a.checkIn) BETWEEN ? AND ?";
      dateParams.push(from, to);
    } else if (from) {
      dateFilter = " AND DATE(a.checkIn) = ?";
      dateParams.push(from);
    } else {
      dateFilter = " AND DATE(a.checkIn) = ?";
      dateParams.push(today);
    }

    const sql = `
      SELECT
        a.id,
        DATE(a.checkIn) AS date,
        a.checkIn,
        a.checkOut,
        a.mode,
        a.status,
        u.fullName AS name,
        r.name AS role,
        sh.shiftType AS shift,
        'Staff' AS type
      FROM memberattendance a
      JOIN user u ON u.id = a.memberId
      JOIN role r ON r.id = u.roleId
      LEFT JOIN staff s ON s.userId = u.id
      LEFT JOIN shifts sh
        ON sh.staffIds = s.id
       AND DATE(sh.shiftDate) = DATE(a.checkIn)
      WHERE u.adminId = ?
        AND u.roleId IN (5,6,7,8)
      ${dateFilter}
      ORDER BY a.checkIn DESC
    `;

    const params = [adminId, ...dateParams];
    const [rows] = await pool.query(sql, params);

    res.json({
      success: true,
      date: from || today,
      attendance: rows,
    });
  } catch (err) {
    next(err);
  }
};


