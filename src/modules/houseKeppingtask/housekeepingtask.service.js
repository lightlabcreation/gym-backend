import { pool } from "../../config/db.js";

export const createTaskService = async (data) => {
  const { assignedTo, branchId, taskTitle, dueDate, priority, description } =
    data;
  try {
    // Step 1: Fetch the adminId from the staff table using assignedTo (staffId)
    const [staff] = await pool.query("SELECT adminId FROM staff WHERE id = ?", [
      assignedTo,
    ]);

    // Check if the staff exists
    if (!staff || staff.length === 0) {
      throw new Error("Staff not found");
    }

    // Step 2: Get the adminId from the result
    const adminId = staff[0].adminId;

    // Step 3: Insert the task into the tasks table
    const [result] = await pool.query(
      `INSERT INTO tasks (assignedTo, branchId, taskTitle, dueDate, priority, description, status, createdById)
       VALUES (?, ?, ?, ?, ?, ?, 'Pending', ?)`,
      [
        assignedTo,
        branchId,
        taskTitle,
        dueDate,
        priority,
        description,
        adminId, // Use the adminId from the staff record as createdById
      ]
    );

    // Step 4: Fetch the newly created task to return
    const [rows] = await pool.query(`SELECT * FROM tasks WHERE id = ?`, [
      result.insertId,
    ]);

    return rows[0];
  } catch (error) {
    throw new Error("Error creating task: " + error.message);
  }
};

export const getTasksByAdminIdService = async (adminId) => {
  try {
    // Step 1: Fetch tasks created by the admin (createdById = adminId)
    const [tasks] = await pool.query(
      "SELECT * FROM tasks WHERE createdById = ?",
      [adminId]
    );

    // If no tasks found, return an empty array
    if (!tasks || tasks.length === 0) {
      return [];
    }

    // Step 2: Fetch admin details from users table based on createdById (adminId)
    const [adminDetails] = await pool.query(
      "SELECT id, fullName, email, phone FROM user WHERE id = ?",
      [adminId]
    );

    // Step 3: For each task, fetch staff (assignedTo) details and the staff's user details
    for (let task of tasks) {
      // Fetch staff details using assignedTo (staffId)
      const [staffDetails] = await pool.query(
        "SELECT id, userId, gender, dateOfBirth, joinDate, status FROM staff WHERE id = ?",
        [task.assignedTo]
      );

      if (staffDetails && staffDetails.length > 0) {
        const staff = staffDetails[0];

        // Fetch user details for the staff based on userId
        const [userDetails] = await pool.query(
          "SELECT id, fullName, email, phone, roleId FROM user WHERE id = ?",
          [staff.userId]
        );

        // Add staff and user details to the task
        task.staff = {
          ...staff,
          fullName: userDetails[0].fullName,
          email: userDetails[0].email,
          phone: userDetails[0].phone,
          roleId: userDetails[0].roleId,
        };
      }

      // Add the admin details to the task
      task.admin = adminDetails ? adminDetails[0] : null;
    }

    return tasks;
  } catch (error) {
    throw new Error(
      "Error fetching tasks with admin and staff details: " + error.message
    );
  }
};
export const getAllTasksService = async () => {
  const [rows] = await pool.query(`SELECT * FROM tasks ORDER BY id DESC`);
  return rows;
};

export const getTaskByBranchIdService = async (branchId) => {
  const [rows] = await pool.query(
    `SELECT * FROM tasks WHERE branchId=? ORDER BY id DESC`,
    [branchId]
  );
  return rows;
};

export const getTaskAsignedService = async (assignedTo) => {
  const [rows] = await pool.query(
    `SELECT * FROM tasks WHERE assignedTo=? ORDER BY id DESC`,
    [assignedTo]
  );
  return rows;
};
export const getTaskByIdService = async (id) => {
  const [rows] = await pool.query(`SELECT * FROM tasks WHERE id = ?`, [id]);
  return rows[0];
};

export const updateTaskService = async (id, data) => {
  // 1️⃣ Pahle old task fetch karo
  const [existing] = await pool.query(`SELECT * FROM tasks WHERE id = ?`, [id]);

  if (!existing.length) {
    throw { status: 404, message: "Task not found" };
  }

  const old = existing[0];

  // 2️⃣ New data ko merge karo → undefined fields old values le lenge
  const updatedData = {
    assignedTo: data.assignedTo ?? old.assignedTo,
    branchId: data.branchId ?? old.branchId,
    taskTitle: data.taskTitle ?? old.taskTitle,
    dueDate: data.dueDate ?? old.dueDate,
    priority: data.priority ?? old.priority,
    description: data.description ?? old.description,
    status: data.status ?? old.status,
  };

  // 3️⃣ Now update final merged data
  await pool.query(
    `UPDATE tasks SET 
      assignedTo = ?, 
      branchId = ?, 
      taskTitle = ?, 
      dueDate = ?, 
      priority = ?, 
      description = ?, 
      status = ?
     WHERE id = ?`,
    [
      updatedData.assignedTo,
      updatedData.branchId,
      updatedData.taskTitle,
      updatedData.dueDate,
      updatedData.priority,
      updatedData.description,
      updatedData.status,
      id,
    ]
  );

  // 4️⃣ Updated data return karo
  const [rows] = await pool.query(`SELECT * FROM tasks WHERE id = ?`, [id]);
  return rows[0];
};

export const updateTaskStatusService = async (id, status) => {
  await pool.query(`UPDATE tasks SET status = ? WHERE id = ?`, [status, id]);

  const [rows] = await pool.query(`SELECT * FROM tasks WHERE id = ?`, [id]);
  return rows[0];
};

export const deleteTaskService = async (id) => {
  await pool.query(`DELETE FROM tasks WHERE id = ?`, [id]);
  return { message: "Task deleted successfully" };
};
