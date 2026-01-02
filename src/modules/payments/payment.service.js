import { pool } from "../../config/db.js";

// --- Invoice generator ---
function generateInvoiceNo() {
  return "INV-" + Date.now() + "-" + Math.floor(Math.random() * 999);
}

// --- RECORD PAYMENT ---
export const recordPaymentService = async (data) => {
  const { memberId, planId, amount } = data;

  // Verify member exists
  const [[member]] = await pool.query(
    "SELECT * FROM member WHERE id = ?",
    [memberId]
  );
  if (!member) throw { status: 404, message: "Member not found" };

  // Verify plan exists
  const [[plan]] = await pool.query(
    "SELECT * FROM plan WHERE id = ?",
    [planId]
  );
  if (!plan) throw { status: 404, message: "Plan not found" };

  // Insert payment
  const [result] = await pool.query(
    `INSERT INTO payment (memberId, planId, amount, invoiceNo) 
     VALUES (?, ?, ?, ?)`,
    [memberId, planId, amount, generateInvoiceNo()]
  );

  return {
    id: result.insertId,
    member,
    plan,
    amount,
    invoiceNo: generateInvoiceNo(),
  };
};

// --- PAYMENT HISTORY FOR MEMBER ---
export const paymentHistoryService = async (memberId) => {
  const [rows] = await pool.query(
    `SELECT p.*, pl.name AS planName, pl.price AS planPrice
     FROM payment p
     LEFT JOIN plan pl ON p.planId = pl.id
     WHERE p.memberId = ?
     ORDER BY p.id DESC`,
    [memberId]
  );
  return rows;
};

// --- ALL PAYMENTS BY BRANCH ---
export const allPaymentsService = async (branchId) => {
  const [rows] = await pool.query(
    `SELECT p.*, m.fullName AS memberName, pl.name AS planName, pl.price AS planPrice
     FROM payment p
     LEFT JOIN member m ON p.memberId = m.id
     LEFT JOIN plan pl ON p.planId = pl.id
     WHERE m.branchId = ?
     ORDER BY p.id DESC`,
    [branchId]
  );
  return rows;
};
