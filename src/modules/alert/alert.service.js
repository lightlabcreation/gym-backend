import { pool } from "../../config/db.js";

export const generateAlerts = async () => {
  const today = new Date();
  const soon = new Date();
  soon.setDate(today.getDate() + 3); // 3-day pre-expiry alerts

  const todayStr = today.toISOString().slice(0, 10);
  const soonStr = soon.toISOString().slice(0, 10);

  const conn = pool;

  // --- Clear old alerts ---
  await conn.query("DELETE FROM alert");

  // --- Fetch members ---
  const [expiring] = await conn.query(
    "SELECT id, fullName, branchId FROM member WHERE membershipTo BETWEEN ? AND ?",
    [todayStr, soonStr]
  );

  const [expired] = await conn.query(
    "SELECT id, fullName, branchId FROM member WHERE membershipTo < ?",
    [todayStr]
  );

  const [noPayment] = await conn.query(
    "SELECT id, fullName, branchId FROM member WHERE planId IS NULL"
  );

  // --- Prepare batch inserts ---
  const alerts = [];

  expiring.forEach(m => {
    alerts.push([ "EXPIRING", `${m.fullName}'s membership expires soon`, m.id, m.branchId ]);
  });

  expired.forEach(m => {
    alerts.push([ "EXPIRED", `${m.fullName}'s membership has expired`, m.id, m.branchId ]);
  });

  noPayment.forEach(m => {
    alerts.push([ "NO_PAYMENT", `${m.fullName} has no payment recorded`, m.id, m.branchId ]);
  });

  if (alerts.length > 0) {
    const values = alerts.map(() => "(?, ?, ?, ?)").join(",");
    const flatValues = alerts.flat();
    await conn.query(
      `INSERT INTO alert (type, message, memberId, branchId) VALUES ${values}`,
      flatValues
    );
  }

  return true;
};
