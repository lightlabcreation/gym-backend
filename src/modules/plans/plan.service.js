import { pool } from "../../config/db.js";

/**************************************
 * CREATE PLAN
 **************************************/
export const createPlanService = async (data) => {
  const allowedDurations = ["Monthly", "Yearly"];
  const allowedFields = [
    "name",
    "price",
    "invoice_limit",
    "additional_invoice_price",
    "user_limit",
    "storage_capacity",
    "billing_cycle",
    "status",
    "description",
    "category",
    "duration",
  ];

  if (!data.name) throw { status: 400, message: "Plan name is required" };

  if (data.duration && !allowedDurations.includes(data.duration)) {
    throw {
      status: 400,
      message: "Invalid duration. Allowed: Monthly, Yearly",
    };
  }

  // Duplicate check
  const [exists] = await pool.query("SELECT id FROM plan WHERE name = ?", [
    data.name,
  ]);
  if (exists.length > 0)
    throw { status: 400, message: "Plan name already exists" };

  // Build insert query dynamically
  const fields = [];
  const placeholders = [];
  const values = [];

  for (const key of allowedFields) {
    if (data[key] !== undefined) {
      fields.push(key);
      placeholders.push("?");
      values.push(data[key]);
    }
  }

  // Default status
  if (!fields.includes("status")) {
    fields.push("status");
    placeholders.push("?");
    values.push("ACTIVE");
  }

  const [result] = await pool.query(
      `INSERT INTO plan (${fields.join(",")}) VALUES (${placeholders.join(
        ","
      )})`,
      values
    );

  return { id: result.insertId, ...data, status: data.status || "ACTIVE" };
};

/**************************************
 * LIST PLANS
 **************************************/
export const listPlansService = async (duration) => {
  let query = "SELECT * FROM plan";
  const params = [];

  if (duration && ["Monthly", "Yearly"].includes(duration)) {
    query += " WHERE duration = ?";
    params.push(duration);
  }

  query += " ORDER BY id DESC";

  const [rows] = await pool.query(query, params);
  return rows;
};

/**************************************
 * UPDATE PLAN
 **************************************/
export const updatePlanService = async (id, data) => {
  const allowedDurations = ["Monthly", "Yearly"];
  const allowedFields = [
    "name",
    "price",
    "invoice_limit",
    "additional_invoice_price",
    "user_limit",
    "storage_capacity",
    "billing_cycle",
    "status",
    "description",
    "category",
    "duration",
  ];

  if (data.duration && !allowedDurations.includes(data.duration)) {
    throw {
      status: 400,
      message: "Invalid duration. Allowed: Monthly, Yearly",
    };
  }

  // Check if plan exists
  const [existingRows] = await pool.query("SELECT * FROM plan WHERE id = ?", [id]);
  if (existingRows.length === 0)
    throw { status: 404, message: "Plan not found" };
  const existingPlan = existingRows[0];

  // Duplicate name check
  if (data.name) {
    const [duplicateRows] = await pool.query("SELECT id FROM plan WHERE name = ? AND id != ?", [data.name, id]);
    if (duplicateRows.length > 0)
      throw { status: 400, message: "Plan name already exists" };
  }

  // Build update query dynamically
  const updates = [];
  const values = [];
  for (const key of allowedFields) {
    if (data[key] !== undefined) {
      updates.push(`${key} = ?`);
      values.push(data[key]);
    }
  }

  if (updates.length === 0) return existingPlan; // nothing to update

  values.push(id);

  await pool.query(`UPDATE plan SET ${updates.join(", ")} WHERE id = ?`, values);

  // Return updated plan
  const [updatedRows] = await pool.query("SELECT * FROM plan WHERE id = ?", [id]);
  return updatedRows[0];
};


export const getPlansByBranchService = async (branchId) => {
  const [plans] = await pool.query(
    `
    SELECT 
      id,
      name,
      duration,
      price,
      category,
      description,
      status,
      branchId,
      sessions,
      validityDays,
      createdAt
    FROM plan
    WHERE branchId = ?
    ORDER BY createdAt DESC
    `,
    [branchId]
  );

  return plans;
};


/**************************************
 * DELETE PLAN
 **************************************/
export const deletePlanService = async (id) => {
  // Check plan exists
  const [planRows] = await pool.query("SELECT * FROM plan WHERE id = ?", [id]);

  if (planRows.length === 0) {
    throw { status: 404, message: "Plan not found" };
  }

  // ✅ Sahi table name: payment (singular)
  const [paymentRows] = await pool.query(
    "SELECT id FROM payment WHERE planId = ?",
    [id]
  );

  if (paymentRows.length > 0) {
    throw {
      status: 400,
      message:
        "This plan has payments. You cannot delete it. Please mark it as INACTIVE instead.",
    };
  }

  // Delete plan
  await pool.query("DELETE FROM plan WHERE id = ?", [id]);
  return { message: "Plan deleted successfully" };
};
