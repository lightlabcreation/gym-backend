import { pool } from "../../config/db.js";

// ----- ADD EXPENSE -----
export const addExpenseService = async (data) => {
  const { branchId, description, amount, date } = data;
  const sql = `
    INSERT INTO expense (branchId, description, amount, date)
    VALUES (?, ?, ?, ?)
  `;
  const [result] = await pool.query(sql, [branchId, description, amount, date]);
  
  // Fetch inserted row with branch info
  const [expense] = await pool.query(
    `SELECT e.*, b.name AS branchName 
     FROM expense e 
     JOIN branch b ON e.branchId = b.id 
     WHERE e.id = ?`,
    [result.insertId]
  );

  return expense[0];
};

// ----- LIST EXPENSES -----
export const listExpensesService = async (branchId, startDate, endDate) => {
  const sql = `
    SELECT *
    FROM expense
    WHERE branchId = ? AND date BETWEEN ? AND ?
    ORDER BY id DESC
  `;
  const [expenses] = await pool.query(sql, [branchId, startDate, endDate]);
  return expenses;
};

// ----- MONTHLY EXPENSE SUMMARY -----
export const monthlyExpenseSummaryService = async (branchId) => {
  const sql = `
    SELECT DATE_FORMAT(date, '%Y-%m') AS month, SUM(amount) AS total
    FROM expense
    WHERE branchId = ?
    GROUP BY DATE_FORMAT(date, '%Y-%m')
    ORDER BY month DESC
  `;
  const [summary] = await pool.query(sql, [branchId]);
  return summary;
};
