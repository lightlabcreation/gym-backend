import { pool } from "../../config/db.js";

// Create a new purchase
export const createPurchaseService = async (data) => {
  const { selectedPlan, companyName, email, billingDuration, startDate } = data;

  const [result] = await pool.query(
    `INSERT INTO purchase (selectedPlan, companyName, email, billingDuration, startDate) 
     VALUES (?, ?, ?, ?, ?)`,
    [selectedPlan, companyName, email, billingDuration, new Date(startDate)]
  );

  const purchaseId = result.insertId;
  const [purchase] = await pool.query(`SELECT * FROM purchase WHERE id = ?`, [purchaseId]);
  return purchase[0];
};

// Get all purchases
export const getAllPurchasesService = async () => {
  const [rows] = await pool.query(`SELECT * FROM purchase ORDER BY id DESC`);
  return rows;
};

// Modify purchase status
export const modifyPurchaseStatus = async (id, status) => {
  if (!status) throw { status: 400, message: "Status is required" };

  await pool.query(`UPDATE purchase SET status = ? WHERE id = ?`, [status, id]);
  const [updated] = await pool.query(`SELECT * FROM purchase WHERE id = ?`, [id]);
  return updated[0];
};
