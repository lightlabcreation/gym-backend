import { pool } from "../../config/db.js"; // make sure it's a mysql2/promise pool
import nodemailer from "nodemailer";

/**
 * Send notification using MySQL pool
 * @param {Object} params
 * @param {"EMAIL"|"WHATSAPP"|"SMS"} params.type
 * @param {string} params.to
 * @param {string} params.message
 * @param {number} [params.memberId]
 */
export const sendNotificationService = async ({ type, to, message, memberId }) => {
  // Log notification with PENDING status
  const [logResult] = await pool.query(
    `INSERT INTO notificationLog (type, \`to\`, message, memberId, status)
     VALUES (?, ?, ?, ?, ?)`,
    [type, to, message, memberId || null, "PENDING"]
  );
  const logId = logResult.insertId;

  try {
    if (type === "EMAIL") {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: false,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      });

      await transporter.sendMail({
        from: process.env.MAIL_FROM,
        to,
        subject: "Gym Notification",
        text: message,
      });

      // Update log as SENT
      await pool.query(
        `UPDATE notificationLog SET status = ? WHERE id = ?`,
        ["SENT", logId]
      );
    }

    // WHATSAPP / SMS placeholders
    // if (type === "WHATSAPP") { ... }
    // if (type === "SMS") { ... }

    return { id: logId, type, to, message, memberId, status: "SENT" };
  } catch (err) {
    // Update log as FAILED
    await pool.query(
      `UPDATE notificationLog SET status = ?, error = ? WHERE id = ?`,
      ["FAILED", err.message, logId]
    );
    throw new Error("Notification sending failed: " + err.message);
  }
};
