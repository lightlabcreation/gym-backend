import { pool } from "../../config/db.js";

export const getAlerts = async (req, res, next) => {
  try {
    let sql = `SELECT * FROM alert`;
    const params = [];

    if (req.user.role !== "Superadmin") {
      sql += ` WHERE branchId = ?`;
      params.push(req.user.branchId);
    }

    sql += ` ORDER BY id DESC LIMIT 50`;

    const [alerts] = await pool.query(sql, params);

    res.json({ success: true, alerts });
  } catch (err) {
    console.error("Error fetching alerts:", err);
    next({ status: 500, message: "Failed to fetch alerts" });
  }
};
