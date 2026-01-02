import { pool } from "../../config/db.js";

/**************************************
 * CREATE MEMBER
 **************************************/
import bcrypt from "bcryptjs";

export const createMemberService = async (data) => {
  const {
    fullName,
    email,
    password,
    phone,
    planId,
    planIds, // NEW: Support multiple plans
    membershipFrom,
    dateOfBirth,
    paymentMode,
    amountPaid,
    branchId,
    gender,
    interestedIn,
    address,
    adminId,
    profileImage,
  } = data;

  if (!fullName || !email || !password) {
    throw {
      status: 400,
      message: "fullName, email, and password are required",
    };
  }

  // HASH PASSWORD
  const hashedPassword = await bcrypt.hash(password, 10);

  // Check duplicate email
  const [u1] = await pool.query("SELECT id FROM user WHERE email = ?", [email]);
  const [m1] = await pool.query("SELECT id FROM member WHERE email = ?", [
    email,
  ]);
  if (u1.length > 0 || m1.length > 0)
    throw { status: 400, message: "Email already exists" };

  // Membership Start Date
  const startDate = membershipFrom ? new Date(membershipFrom) : new Date();
  let endDate = null;

  // Backward compatibility: Handle single planId
  let firstPlanId = planId;

  // Membership End Date (Based on Plan Duration) - for backward compatibility
  if (planId) {
    const [planRows] = await pool.query(
      "SELECT * FROM memberplan WHERE id = ?",
      [planId]
    );
    if (!planRows.length)
      throw { status: 404, message: "Invalid plan selected" };

    const plan = planRows[0];

    endDate = new Date(startDate);
    const days = Number(plan.validityDays ?? plan.duration ?? 0);
    endDate.setDate(endDate.getDate() + days);
  }

  // ---------------------------------------------------
  // 1️⃣ INSERT INTO USER TABLE (only required fields)
  // ---------------------------------------------------
  const [userResult] = await pool.query(
    `INSERT INTO user 
      (adminId,fullName, email, password, phone, roleId, branchId, address, 
       description, duration, gymName, planName, price,dateOfBirth ,profileImage,status)
     VALUES (?,?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, NULL,? ,?,'Active')`,
    [
      adminId,
      fullName,
      email,
      hashedPassword,
      phone || null,
      4, // roleId = 4 = MEMBER
      branchId || null,
      address || null,
      dateOfBirth ? new Date(dateOfBirth) : null,
      profileImage || null,
    ]
  );

  const userId = userResult.insertId;

  // ---------------------------------------------------
  // 2️⃣ INSERT INTO MEMBER TABLE
  // ---------------------------------------------------
  const [memberRes] = await pool.query(
    `INSERT INTO member
      (userId, fullName, email, password, phone, planId, membershipFrom, membershipTo,
       dateOfBirth, paymentMode, amountPaid, branchId, gender, interestedIn, address, 
       adminId, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active')`,
    [
      userId,
      fullName,
      email,
      hashedPassword,
      phone || null,
      firstPlanId || null,
      startDate,
      endDate,
      dateOfBirth ? new Date(dateOfBirth) : null,
      paymentMode || null,
      amountPaid ? Number(amountPaid) : 0,
      branchId || null,
      gender || null,
      interestedIn || null,
      address || null,
      adminId || null,
    ]
  );

  const memberId = memberRes.insertId;

  // ---------------------------------------------------
  // 3️⃣ NEW: INSERT MULTIPLE PLANS INTO member_plan_assignment
  // ---------------------------------------------------
  
  // Ensure planIds is an array of numbers
  let plansToAssign = [];
  
  if (planIds && Array.isArray(planIds) && planIds.length > 0) {
    // Already an array, convert to numbers
    plansToAssign = planIds.map(id => Number(id)).filter(id => !isNaN(id) && id > 0);
  } else if (planId) {
    // Fallback to single planId
    plansToAssign = [Number(planId)].filter(id => !isNaN(id) && id > 0);
  }

  console.log('📋 Plans to assign:', plansToAssign);
  console.log('📋 planIds received:', planIds, 'Type:', typeof planIds);
  console.log('📋 planId received:', planId);

  const assignedPlans = [];

  if (plansToAssign.length > 0) {
    const amountPerPlan = amountPaid ? Number(amountPaid) / plansToAssign.length : null;
    
    for (const planIdNum of plansToAssign) {
      const [planRows] = await pool.query(
        "SELECT id, validityDays, price, name FROM memberplan WHERE id = ?",
        [planIdNum]
      );

      if (planRows.length === 0) {
        console.warn(`⚠️ Plan ${planIdNum} not found in memberplan table, skipping`);
        continue;
      }

      const plan = planRows[0];
      const planStartDate = new Date(startDate);
      const planEndDate = new Date(planStartDate);
      planEndDate.setDate(planEndDate.getDate() + Number(plan.validityDays || 30));

      console.log(`✅ Inserting plan ${planIdNum} (${plan.name}) for member ${memberId}`);

      try {
        const [assignResult] = await pool.query(
          `INSERT INTO member_plan_assignment 
            (memberId, planId, membershipFrom, membershipTo, paymentMode, amountPaid, status, assignedBy, assignedAt)
           VALUES (?, ?, ?, ?, ?, ?, 'Active', ?, NOW())`,
          [
            memberId,
            planIdNum,
            planStartDate,
            planEndDate,
            paymentMode || null,
            amountPerPlan || plan.price,
            adminId || null,
          ]
        );

        assignedPlans.push({
          assignmentId: assignResult.insertId,
          planId: planIdNum,
          planName: plan.name,
          membershipFrom: planStartDate,
          membershipTo: planEndDate,
        });

        console.log(`✅ Successfully inserted plan ${planIdNum}, assignment ID: ${assignResult.insertId}`);
      } catch (insertError) {
        console.error(`❌ Error inserting plan ${planIdNum}:`, insertError.message);
        // Continue with other plans even if one fails
      }
    }
  } else {
    console.warn('⚠️ No plans to assign');
  }

  console.log(`✅ Total plans assigned: ${assignedPlans.length} out of ${plansToAssign.length} requested`);

  return {
    message: "Member created successfully",
    userId,
    memberId,
    fullName,
    email,
    branchId,
    membershipFrom: startDate,
    membershipTo: endDate,
    status: "Active",
    dateOfBirth,
    profileImage,
    assignedPlans, // NEW: Return assigned plans
  };
};

// export const renewMembershipService = async (memberId, body) => {
//   const { planId, paymentMode, amountPaid, adminId } = body;

//   // 1️⃣ Member check
//   const [[member]] = await pool.query("SELECT * FROM member WHERE id = ?", [
//     memberId,
//   ]);

//   if (!member) throw { status: 404, message: "Member not found" };

//   // 2️⃣ Fetch plan
//   const [[plan]] = await pool.query("SELECT * FROM memberplan WHERE id = ?", [
//     planId,
//   ]);

//   if (!plan) throw { status: 404, message: "Invalid Plan" };

//   // 3️⃣ Calculate new membership dates
//   let startDate = member.membershipTo
//     ? new Date(member.membershipTo)
//     : new Date();

//   startDate.setDate(startDate.getDate() + 1); // next day after previous expiry

//   let endDate = new Date(startDate);
//   endDate.setDate(endDate.getDate() + Number(plan.duration));

//   // 4️⃣ Update member table
//   await pool.query(
//     `UPDATE member SET
//         planId = ?,
//         membershipFrom = ?,
//         membershipTo = ?,
//         paymentMode = ?,
//         amountPaid = ?,
//         adminId = ?
//      WHERE id = ?`,
//     [
//       planId,
//       startDate,
//       endDate,
//       paymentMode,
//       amountPaid,
//       adminId || member.adminId,
//       memberId,
//     ]
//   );

//   return {
//     memberId,
//     planId,
//     membershipFrom: startDate,
//     membershipTo: endDate,
//     paymentMode,
//     amountPaid,
//   };
// };
export const renewMembershipService = async (memberId, body) => {
  const { planId, paymentMode, amountPaid, adminId } = body;

  // 1️⃣ Member check
  const [[member]] = await pool.query("SELECT * FROM member WHERE id = ?", [
    memberId,
  ]);

  if (!member) throw { status: 404, message: "Member not found" };

  // 2️⃣ Fetch plan
  const [[plan]] = await pool.query("SELECT * FROM memberplan WHERE id = ?", [
    planId,
  ]);

  if (!plan) throw { status: 404, message: "Invalid Plan" };

  // 3️⃣ Calculate new membership dates
  let startDate = member.membershipTo
    ? new Date(member.membershipTo)
    : new Date();

  startDate.setDate(startDate.getDate() + 1); // next day after previous expiry

  let endDate = new Date(startDate);

  // 4️⃣ Use validityDays from plan to calculate end date
  const validityDays = plan.validityDays ?? 30; // default to 30 if not defined
  endDate.setDate(endDate.getDate() + validityDays);

  // 5️⃣ Update member table and set status to ACTIVE
  await pool.query(
    `UPDATE member SET 
        planId = ?, 
        membershipFrom = ?, 
        membershipTo = ?, 
        paymentMode = ?, 
        amountPaid = ?, 
        adminId = ?, 
        status = 'Inactive'  
     WHERE id = ?`,
    [
      planId,
      startDate,
      endDate,
      paymentMode,
      amountPaid,
      adminId || member.adminId,
      memberId,
    ]
  );

  const [[updatedMember]] = await pool.query(
    `SELECT id, status, membershipFrom, membershipTo, planId, paymentMode, amountPaid, adminId, branchId 
     FROM member WHERE id = ?`,
    [memberId]
  );

  return {
    memberId: updatedMember.id,
    planId: updatedMember.planId,
    membershipFrom: updatedMember.membershipFrom,
    membershipTo: updatedMember.membershipTo,
    paymentMode: updatedMember.paymentMode,
    amountPaid: updatedMember.amountPaid,
    status: updatedMember.status, // Return ACTIVE status in the response
  };
};
/**************************************
 * LIST MEMBERS
 **************************************/
export const listMembersService = async (
  branchId,
  page = 1,
  limit = 20,
  search = ""
) => {
  const offset = (page - 1) * limit;
  let query = `
    SELECT * FROM member
    WHERE branchId = ?
  `;
  const params = [branchId];

  if (search) {
    query += " AND (fullName LIKE ? OR email LIKE ? OR phone LIKE ?)";
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  query += " ORDER BY id DESC LIMIT ? OFFSET ?";
  params.push(limit, offset);

  const [items] = await pool.query(query, params);

  // Count total
  let countQuery = "SELECT COUNT(*) as total FROM member WHERE branchId = ?";
  const countParams = [branchId];
  if (search) {
    countQuery += " AND (fullName LIKE ? OR email LIKE ? OR phone LIKE ?)";
    countParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  const [countRows] = await pool.query(countQuery, countParams);
  const total = countRows[0].total;

  return {
    items,
    total,
    page,
    limit,
    pages: Math.ceil(total / limit),
  };
};

/**************************************
 * MEMBER DETAIL
 **************************************/
export const memberDetailService = async (id) => {
  const [rows] = await pool.query(
    `
    SELECT
      m.*,
      u.profileImage,

      mp.name AS planName,
      mp.sessions AS totalSessions,
      mp.validityDays,
      mp.trainerType
    FROM member m
    JOIN user u ON u.id = m.userId
    LEFT JOIN memberplan mp ON m.planId = mp.id
    WHERE m.id = ?
    `,
    [id]
  );

  if (rows.length === 0) {
    throw { status: 404, message: "Member not found" };
  }

  const member = rows[0];

  // 🔒 Remove sensitive fields
  delete member.password;

  let attended = 0;

  const total = member.planSessions || 0;
  if (member.membershipFrom && member.membershipTo) {
    const [[attendance]] = await pool.query(
      `
      SELECT COUNT(*) AS attended
      FROM memberattendance
      WHERE memberId = ?
        AND checkIn BETWEEN ? AND ?
      `,
      [
        member.userId, // 🔑 matching rule
        member.membershipFrom,
        member.membershipTo,
      ]
    );

    attended = attendance.attended || 0;
  }
  const isCompleted = total > 0 && attended >= total;
  const remaining = isCompleted ? 0 : Math.max(total - attended, 0);
  member.plan = member.planName || "Unknown";
  member.trainerType = member.trainerType || "Not Assigned";
  member.sessionDetails = {
    attended,
    remaining,
    total,
    sessionState: isCompleted ? "No Session" : "Active",
  };

  // ---------------------------------------------------
  // NEW: Fetch all assigned plans from member_plan_assignment
  // ---------------------------------------------------
  const [assignedPlans] = await pool.query(
    `SELECT 
      mpa.id AS assignmentId,
      mpa.planId,
      mpa.membershipFrom,
      mpa.membershipTo,
      mpa.paymentMode,
      mpa.amountPaid,
      mpa.status,
      mpa.assignedAt,
      mp.name AS planName,
      mp.sessions,
      mp.validityDays,
      mp.price,
      mp.type AS planType,
      mp.trainerType,
      DATEDIFF(mpa.membershipTo, CURDATE()) AS remainingDays,
      CASE
        WHEN mpa.membershipTo < CURDATE() THEN 'Expired'
        WHEN mpa.membershipTo >= CURDATE() THEN 'Active'
        ELSE mpa.status
      END AS computedStatus
    FROM member_plan_assignment mpa
    JOIN memberplan mp ON mpa.planId = mp.id
    WHERE mpa.memberId = ?
    ORDER BY mpa.membershipFrom DESC`,
    [id]
  );

  member.assignedPlans = assignedPlans;

  return member;
};

/**************************************
 * UPDATE MEMBER
 **************************************/
// export const updateMemberService = async (id, data) => {
//   // 1️⃣ Fetch existing member
//   const [[existing]] = await pool.query(
//     "SELECT * FROM member WHERE id = ?",
//     [id]
//   );

//   if (!existing) throw { status: 404, message: "Member not found" };

//   // 2️⃣ Extract fields
//   const {
//     fullName = existing.fullName,
//     email = existing.email,
//     phone = existing.phone,
//     password,

//     planId,
//     membershipFrom,
//     dateOfBirth,
//     paymentMode,
//     amountPaid,
//     branchId,
//     gender,
//     interestedIn,
//     address,
//     adminId,
//     status  // <-- NEW
//   } = data;

//   // 3️⃣ Hash password only if updating
//   let hashedPassword = existing.password;
//   if (password) {
//     hashedPassword = await bcrypt.hash(password, 10);
//   }

//   let startDate = membershipFrom ? new Date(membershipFrom) : undefined;
//   let endDate = undefined;

//   // 5️⃣ Recalculate membershipTo if plan changed
//   // let startDate = new Date(membershipFrom);
//   // let endDate = existing.membershipTo;

//   if (planId) {
//     const [planRows] = await pool.query("SELECT * FROM memberplan WHERE id = ?", [planId]);
//     if (!planRows.length) throw { status: 404, message: "Invalid plan selected" };

//     const plan = planRows[0];
//     endDate = new Date(startDate);
//     endDate.setDate(endDate.getDate() + Number(plan.duration || 0));
//   }

//   // 6️⃣ Update member table
//   await pool.query(
//     `UPDATE member SET
//       fullName = ?,
//       email = ?,
//       password = ?,
//       phone = ?,
//       planId = ?,
//       membershipFrom = ?,
//       membershipTo = ?,
//       dateOfBirth = ?,
//       paymentMode = ?,
//       amountPaid = ?,
//       branchId = ?,
//       gender = ?,
//       interestedIn = ?,
//       address = ?,
//       adminId = ?,
//       status=?
//      WHERE id = ?`,
//     [
//       fullName,
//       email,
//       hashedPassword,
//       phone,
//       planId,
//       startDate,
//       endDate,
//       dateOfBirth ? new Date(dateOfBirth) : null,
//       paymentMode,
//       amountPaid,
//       branchId,
//       gender,
//       interestedIn,
//       address,
//       adminId,
//       status,
//       id
//     ]
//   );

//   // 7️⃣ Update user table also (important)
//   await pool.query(
//     `UPDATE user SET
//       fullName = ?,
//       email = ?,
//       phone = ?,
//       password = ?,
//       branchId = ?,
//       address = ?
//      WHERE id = ?`,
//     [
//       fullName,
//       email,
//       phone,
//       hashedPassword,
//       branchId,
//       address,
//       existing.userId
//     ]
//   );

//   return memberDetailService(id);
// };

export const updateMemberService = async (id, data) => {
  /* --------------------------------
     1️⃣ FETCH EXISTING MEMBER
  -------------------------------- */
  const [[existing]] = await pool.query("SELECT * FROM member WHERE id = ?", [
    id,
  ]);

  if (!existing) {
    throw { status: 404, message: "Member not found" };
  }

  /* --------------------------------
     2️⃣ EXTRACT FIELDS (WITH FALLBACKS)
  -------------------------------- */
  const {
    fullName = existing.fullName,
    email = existing.email,
    phone = existing.phone,
    password,
    planId = existing.planId,
    planIds, // NEW: Support multiple plans in edit
    membershipFrom = existing.membershipFrom,
    dateOfBirth = existing.dateOfBirth,
    paymentMode = existing.paymentMode,
    amountPaid = existing.amountPaid,
    branchId = existing.branchId,
    gender = existing.gender,
    interestedIn = existing.interestedIn,
    address = existing.address,
    adminId = existing.adminId,
    status = existing.status,
    profileImage, // ✅ ONLY FOR USER TABLE
  } = data;

  /* --------------------------------
     3️⃣ PASSWORD HASH (IF PROVIDED)
  -------------------------------- */
  let hashedPassword = existing.password;
  if (password) {
    hashedPassword = await bcrypt.hash(password, 10);
  }

  /* --------------------------------
     4️⃣ MEMBERSHIP DATES
  -------------------------------- */
  // ✅ Use provided membershipFrom or current date for new plans
  const startDate = membershipFrom
    ? new Date(membershipFrom)
    : (existing.membershipFrom ? new Date(existing.membershipFrom) : new Date());

  let endDate = existing.membershipTo;

  /* --------------------------------
     5️⃣ RECALCULATE membershipTo (PLAN BASED)
     ❗ memberplan → ONLY validityDays
  -------------------------------- */
  if (planId && membershipFrom) {
    const [planRows] = await pool.query(
      "SELECT validityDays FROM memberplan WHERE id = ?",
      [planId]
    );

    if (!planRows.length) {
      throw { status: 404, message: "Invalid plan selected" };
    }

    const days = Number(planRows[0].validityDays || 0);

    endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + days);
  }

  /* --------------------------------
     6️⃣ UPDATE MEMBER TABLE
     ❌ NO profileImage HERE
  -------------------------------- */
  await pool.query(
    `UPDATE member SET
      fullName = ?,
      email = ?,
      password = ?,
      phone = ?,
      planId = ?,
      membershipFrom = ?,
      membershipTo = ?,
      dateOfBirth = ?,
      paymentMode = ?,
      amountPaid = ?,
      branchId = ?,
      gender = ?,
      interestedIn = ?,
      address = ?,
      adminId = ?,
      status = ?
     WHERE id = ?`,
    [
      fullName,
      email,
      hashedPassword,
      phone,
      planId,
      startDate,
      endDate,
      dateOfBirth ? new Date(dateOfBirth) : null,
      paymentMode,
      amountPaid,
      branchId,
      gender,
      interestedIn,
      address,
      adminId,
      status,
      id,
    ]
  );

  /* --------------------------------
     7️⃣ UPDATE USER TABLE
     ✅ profileImage ONLY HERE
  -------------------------------- */
  await pool.query(
    `UPDATE user SET
      fullName = ?,
      email = ?,
      phone = ?,
      password = ?,
      branchId = ?,
      address = ?,
      status = ?,
      profileImage = ?
     WHERE id = ?`,
    [
      fullName,
      email,
      phone,
      hashedPassword,
      branchId,
      address,
      status,
      profileImage ?? null,
      existing.userId,
    ]
  );

  /* --------------------------------
     7️⃣ UPDATE MULTIPLE PLANS (if planIds provided)
  -------------------------------- */
  if (planIds && (Array.isArray(planIds) || typeof planIds === 'string')) {
    // Parse planIds if string
    let parsedPlanIds = planIds;
    if (typeof planIds === 'string') {
      try {
        let parsed = planIds.trim();
        if (parsed.startsWith('[') && parsed.endsWith(']')) {
          parsedPlanIds = JSON.parse(parsed);
        } else if (parsed.includes(',')) {
          parsedPlanIds = parsed.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
        } else {
          parsedPlanIds = [parseInt(parsed)].filter(id => !isNaN(id));
        }
      } catch (e) {
        console.error('Error parsing planIds in update:', e);
        parsedPlanIds = [];
      }
    }

    if (Array.isArray(parsedPlanIds) && parsedPlanIds.length > 0) {
      const plansToAssign = parsedPlanIds.map(id => Number(id)).filter(id => !isNaN(id) && id > 0);
      
      // ✅ Use provided startDate, or today's date (not old membershipFrom)
      const startDateForPlans = startDate || new Date();
      const amountPerPlan = amountPaid ? Number(amountPaid) / plansToAssign.length : null;
      
      console.log('📅 Start date for new plans:', startDateForPlans);

      for (const planIdNum of plansToAssign) {
        const [planRows] = await pool.query(
          "SELECT id, validityDays, price FROM memberplan WHERE id = ?",
          [planIdNum]
        );

        if (planRows.length === 0) continue;

        const plan = planRows[0];
        const planStartDate = new Date(startDateForPlans);
        const planEndDate = new Date(planStartDate);
        planEndDate.setDate(planEndDate.getDate() + Number(plan.validityDays || 30));

        // Check if assignment already exists
        const [existingAssign] = await pool.query(
          "SELECT id FROM member_plan_assignment WHERE memberId = ? AND planId = ?",
          [id, planIdNum]
        );

        if (existingAssign.length === 0) {
          // Insert new assignment
          await pool.query(
            `INSERT INTO member_plan_assignment 
              (memberId, planId, membershipFrom, membershipTo, paymentMode, amountPaid, status, assignedBy, assignedAt)
             VALUES (?, ?, ?, ?, ?, ?, 'Active', ?, NOW())`,
            [
              id,
              planIdNum,
              planStartDate,
              planEndDate,
              paymentMode || null,
              amountPerPlan || plan.price,
              adminId || null,
            ]
          );
        }
      }
    }
  }

  /* --------------------------------
     8️⃣ RETURN UPDATED MEMBER DETAIL
  -------------------------------- */
  return memberDetailService(id);
};

/**************************************
 * DELETE (SOFT DELETE)
 **************************************/
export const deleteMemberService = async (id) => {
  const [rows] = await pool.query("SELECT userId FROM member WHERE id = ?", [
    id,
  ]);

  if (rows.length === 0) {
    throw { status: 404, message: "Member not found" };
  }

  const userId = rows[0].userId;
  await pool.query("DELETE FROM booking WHERE memberId = ?", [id]);

  // 1️⃣ Delete Attendance
  await pool.query("DELETE FROM memberattendance WHERE memberId = ?", [id]);

  // 2️⃣ Delete Payments (if exists)
  await pool.query("DELETE FROM payment WHERE memberId = ?", [id]);

  // 3️⃣ Delete Bookings (if exists)
  await pool.query("DELETE FROM booking_requests WHERE memberId = ?", [id]);

  // 4️⃣ Finally delete member
  await pool.query("DELETE FROM member WHERE id = ?", [id]);

  // 5️⃣ Delete user account
  await pool.query("DELETE FROM user WHERE id = ?", [userId]);

  return { message: "Member deleted permanently" };
};

// member.service.js

export const getMembersByAdminIdService = async (adminId) => {
  const [rows] = await pool.query(
    `
    SELECT 
      m.id,
      m.adminId,
      m.fullName,
      m.email,
      m.phone,
      m.gender,
      m.address,
      m.joinDate,
      m.branchId,
      m.planId,
      m.membershipFrom,
      m.membershipTo,
      m.paymentMode,
      m.interestedIn,
      m.amountPaid,
      m.dateOfBirth,
      u.profileImage

    FROM member m
    JOIN user u ON u.id = m.userId
    WHERE m.adminId = ?
    ORDER BY m.id DESC
    `,
    [adminId]
  );

  // Fetch multiple plans for each member
  for (const member of rows) {
    const [plans] = await pool.query(
      `SELECT 
        mpa.id as assignmentId,
        mpa.planId,
        mpa.membershipFrom,
        mpa.membershipTo,
        mpa.status as assignmentStatus,
        mpa.amountPaid,
        mpa.paymentMode,
        mp.name as planName,
        mp.sessions,
        mp.validityDays,
        mp.price,
        mp.type as planType,
        DATEDIFF(mpa.membershipTo, CURDATE()) as remainingDays,
        CASE
          WHEN mpa.membershipTo < CURDATE() THEN 'Expired'
          WHEN mpa.membershipTo >= CURDATE() THEN 'Active'
          ELSE 'Inactive'
        END AS computedStatus
      FROM member_plan_assignment mpa
      JOIN memberplan mp ON mpa.planId = mp.id
      WHERE mpa.memberId = ?
      ORDER BY mpa.membershipFrom DESC`,
      [member.id]
    );

    member.assignedPlans = plans;
    
    // Calculate member status based on ALL plans
    const hasActivePlan = plans.some(p => 
      p.computedStatus === 'Active' && p.remainingDays > 0
    );
    
    member.status = hasActivePlan ? 'Active' : 'Inactive';
    
    // Get maximum remaining days from all active plans
    const activePlans = plans.filter(p => p.computedStatus === 'Active');
    member.remainingDays = activePlans.length > 0 
      ? Math.max(...activePlans.map(p => p.remainingDays))
      : 0;
  }

  return rows;
};

const calculateMembershipDates = (lastMembershipTo, validityDays = 30) => {
  const start = lastMembershipTo ? new Date(lastMembershipTo) : new Date();

  // next day after previous expiry
  start.setDate(start.getDate() + 1);

  const end = new Date(start);
  end.setDate(end.getDate() + validityDays);

  return { start, end };
};

export const getRenewalPreviewService = async (adminId) => {
  if (!adminId) {
    throw { status: 400, message: "adminId is required" };
  }

  /* =====================================================
     1️⃣ FETCH ONLY INACTIVE (RENEWED) MEMBERS
  ===================================================== */
  const [membersRaw] = await pool.query(
    `
    SELECT 
      m.id,
      m.userId,
      m.adminId,
      m.fullName,
      m.email,
      m.phone,
      m.planId,
      m.membershipFrom,
      m.membershipTo,
      m.paymentMode,
      m.amountPaid,
      m.branchId,
      m.status,

      -- plan details (ONLY RENEWED PLAN)
      p.name          AS planName,
      p.validityDays  AS validityDays,
      p.price         AS price,
      p.type          AS planType
    FROM member m
    JOIN memberplan p ON p.id = m.planId
    WHERE m.adminId = ?
      AND m.status = 'Inactive'
    ORDER BY m.membershipTo DESC
    `,
    [adminId]
  );

  if (membersRaw.length === 0) {
    return {
      adminId,
      totalPending: 0,
      members: [],
    };
  }

  /* =====================================================
     2️⃣ DATE NORMALIZATION + RESPONSE SHAPE
  ===================================================== */
  const members = membersRaw.map((m) => {
    const { start, end } = calculateMembershipDates(
      m.membershipTo,
      m.validityDays
    );

    return {
      id: m.id,
      fullName: m.fullName,
      email: m.email,
      phone: m.phone,
      status: m.status, // always Inactive

      plan: {
        planId: m.planId,
        planName: m.planName,
        planType: m.planType, // ✅ ADDED
        price: m.price,
        validityDays: m.validityDays,
      },

      membershipFrom: m.membershipFrom
        ? new Date(m.membershipFrom).toISOString()
        : null,
      membershipTo: m.membershipTo
        ? new Date(m.membershipTo).toISOString()
        : null,

      previewMembershipFrom: start.toISOString(),
      previewMembershipTo: end.toISOString(),

      paymentMode: m.paymentMode,
      amountPaid: m.amountPaid,
      branchId: m.branchId,
    };
  });

  /* =====================================================
     3️⃣ FINAL RESPONSE
  ===================================================== */
  return {
    adminId,
    totalPending: members.length,
    members,
  };
};

export const updateMemberRenewalStatusService = async (
  memberId,
  adminId,
  status,
  assignmentId = null,
  planId = null
) => {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // 1️⃣ Check member belongs to admin
    const [[member]] = await connection.query(
      `
      SELECT id, status 
      FROM member
      WHERE id = ?
        AND adminId = ?
      `,
      [memberId, adminId]
    );

    if (!member) {
      await connection.rollback();
      throw {
        status: 404,
        message: "Member not found for this admin",
      };
    }

    // 2️⃣ If status is "Active" and we have assignmentId, renew the plan assignment
    if (status === "Active" && assignmentId) {
      // Get the renewal request to get payment details
      const [[renewalRequest]] = await connection.query(
        `SELECT * FROM membership_renewal_requests 
         WHERE memberId = ? AND assignmentId = ? AND status = 'pending'
         ORDER BY createdAt DESC LIMIT 1`,
        [memberId, assignmentId]
      );

      if (renewalRequest) {
        // Get plan details
        const [[plan]] = await connection.query(
          `SELECT validityDays FROM memberplan WHERE id = ?`,
          [renewalRequest.planId || planId]
        );

        if (plan) {
          // Calculate new dates
          const [[assignment]] = await connection.query(
            `SELECT membershipTo FROM member_plan_assignment WHERE id = ?`,
            [assignmentId]
          );

          let startDate = assignment[0]?.membershipTo 
            ? new Date(assignment[0].membershipTo)
            : new Date();
          startDate.setDate(startDate.getDate() + 1); // Next day after expiry

          let endDate = new Date(startDate);
          endDate.setDate(endDate.getDate() + Number(plan.validityDays || 30));

          // Update the plan assignment
          await connection.query(
            `UPDATE member_plan_assignment 
             SET membershipFrom = ?,
                 membershipTo = ?,
                 paymentMode = ?,
                 amountPaid = ?,
                 status = 'Active',
                 updatedAt = NOW()
             WHERE id = ?`,
            [
              startDate,
              endDate,
              renewalRequest.paymentMode || "Cash",
              renewalRequest.amountPaid || 0,
              assignmentId
            ]
          );

          // Update the renewal request status
          await connection.query(
            `UPDATE membership_renewal_requests 
             SET status = 'approved',
                 approvedBy = ?,
                 approvedAt = NOW(),
                 updatedAt = NOW()
             WHERE id = ?`,
            [adminId, renewalRequest.id]
          );
        }
      }
    } else if (status === "Reject" && assignmentId) {
      // Reject the renewal request
      await connection.query(
        `UPDATE membership_renewal_requests 
         SET status = 'rejected',
             rejectedAt = NOW(),
             updatedAt = NOW()
         WHERE memberId = ? AND assignmentId = ? AND status = 'pending'`,
        [memberId, assignmentId]
      );
    }

    // 3️⃣ Update member status
    await connection.query(
      `
      UPDATE member
      SET status = ?
      WHERE id = ?
      `,
      [status, memberId]
    );

    // 4️⃣ If Active, check if member has any active plans and update status accordingly
    if (status === "Active") {
      const [activePlansResult] = await connection.query(
        `SELECT COUNT(*) as activeCount 
         FROM member_plan_assignment 
         WHERE memberId = ? AND status = 'Active' AND membershipTo >= CURDATE()`,
        [memberId]
      );

      if (activePlansResult && activePlansResult.length > 0 && activePlansResult[0]?.activeCount > 0) {
        await connection.query(
          `UPDATE member SET status = 'Active' WHERE id = ?`,
          [memberId]
        );
      }
    }

    await connection.commit();

    // 5️⃣ Return updated record
    const [[updated]] = await connection.query(
      `
      SELECT 
        id,
        fullName,
        status,
        membershipFrom,
        membershipTo,
        planId
      FROM member
      WHERE id = ?
      `,
      [memberId]
    );

    return updated;
  } catch (error) {
    if (connection) await connection.rollback();
    throw error;
  } finally {
    if (connection) connection.release();
  }
};

export const listPTBookingsService = async (branchId) => {
  const [rows] = await pool.query(
    `
    SELECT 
      pt.id,

      -- MEMBER INFO
      m.fullName AS memberName,

      -- TRAINER INFO (Only personal trainer)
      u.fullName AS trainerName,
      u.roleId AS trainerRole,

      -- PT DETAILS (price removed, type removed)
      pt.date,
      pt.startTime,
      pt.endTime,
      pt.paymentStatus,
      pt.bookingStatus

    FROM pt_bookings pt
    LEFT JOIN member m ON pt.memberId = m.id
    LEFT JOIN user u ON pt.trainerId = u.id

    WHERE pt.branchId = ?
      AND u.roleId = 5   -- Only personal trainer

    ORDER BY pt.id DESC
    `,
    [branchId]
  );

  return rows.map((x) => ({
    ...x,
    time: `${x.startTime} - ${x.endTime}`,
  }));
};

export const getMembersByAdminAndPlan = async (adminId) => {
  try {
    // Fetch members with the given adminId, plan type 'MEMBER' or 'GROUP'
    const query = `
      SELECT m.id, m.fullName, m.email, m.phone, m.planId, m.membershipFrom, m.membershipTo, m.status, mp.type, mp.trainerType
      FROM member m
      JOIN memberplan mp ON m.planId = mp.id
      WHERE m.adminId = ? AND (mp.type = 'MEMBER' OR mp.type = 'GROUP')`;

    const [members] = await pool.query(query, [adminId]);

    // Filter out members whose trainerType is not 'general' if the type is 'MEMBER'
    const filteredMembers = members.filter((member) => {
      // MEMBER plan → only allow GENERAL trainer
      if (member.type === "MEMBER") {
        return member.trainerType === "general";
      }

      // GROUP (or any other type) → allow
      return true;
    });
    return filteredMembers;
  } catch (error) {
    throw { status: 500, message: "Error fetching members", error };
  }
};

export const getMembersByAdminAndGroupPlanService = async (adminId, planId) => {
  try {
    const planQuery = `
      SELECT 
        mp.id,
        mp.name,
        mp.sessions,
        mp.validityDays,
        mp.price,
        mp.type
      FROM 
        memberplan mp
      WHERE 
        mp.id = ?
    `;

    const [planResult] = await pool.query(planQuery, [planId]);

    // If no plan is found with the given ID, throw an error
    if (planResult.length === 0) {
      const error = new Error("Plan not found.");
      error.statusCode = 404; // Not Found
      throw error;
    }
    const plan = planResult[0];
    // Query to get all members for a specific plan ID
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
        m.planId,
        mp.name as planName,
        mp.sessions,
        mp.validityDays,
        mp.price,
        mp.type as planType
      FROM 
        member m
      JOIN 
        memberplan mp ON m.planId = mp.id
      WHERE 
        mp.id = ?         -- CHANGED: Filter by specific planId
        AND m.adminId = ?
      ORDER BY 
        m.fullName
    `;

    // CHANGED: Pass both planId and adminId to the query
    const [members] = await pool.query(membersQuery, [planId, adminId]);

    // Calculate statistics (this logic remains the same)
    const currentDate = new Date();
    let activeCount = 0;
    let expiredCount = 0;
    let completedCount = 0;

    members.forEach((member) => {
      if (member.membershipTo && new Date(member.membershipTo) >= currentDate) {
        activeCount++;
      } else if (
        member.membershipTo &&
        new Date(member.membershipTo) < currentDate
      ) {
        expiredCount++;
        completedCount++;
      }
    });

    const statistics = {
      active: activeCount,
      expired: expiredCount,
      completed: completedCount,
    };

    return {
      members,
      statistics,
      plan,
    };
  } catch (error) {
    throw error;
  }
};

export const getMembersByAdminAndGeneralMemberPlanService = async (
  adminId,
  planId
) => {
  try {
    /* =========================
       FETCH PLAN (VALIDATION)
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
        AND mp.trainerType = 'general'
    `;

    const [planResult] = await pool.query(planQuery, [planId]);

    if (planResult.length === 0) {
      const error = new Error("General member plan not found.");
      error.statusCode = 404;
      throw error;
    }

    const plan = planResult[0];

    /* =========================
       FETCH MEMBERS
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
        m.planId,
        mp.name AS planName,
        mp.sessions,
        mp.validityDays,
        mp.price,
        mp.type AS planType,
        mp.trainerType
      FROM member m
      JOIN memberplan mp ON m.planId = mp.id
      WHERE 
        m.adminId = ?
        AND mp.id = ?
        AND mp.type = 'MEMBER'
        AND mp.trainerType = 'general'
      ORDER BY m.fullName
    `;

    const [members] = await pool.query(membersQuery, [adminId, planId]);

    /* =========================
       STATISTICS
    ========================= */
    const currentDate = new Date();
    let active = 0;
    let expired = 0;
    let completed = 0;

    members.forEach((member) => {
      if (member.membershipTo && new Date(member.membershipTo) >= currentDate) {
        active++;
      } else if (
        member.membershipTo &&
        new Date(member.membershipTo) < currentDate
      ) {
        expired++;
        completed++;
      }
    });

    return {
      plan,
      members,
      statistics: {
        active,
        expired,
        completed,
      },
    };
  } catch (error) {
    throw error;
  }
};
