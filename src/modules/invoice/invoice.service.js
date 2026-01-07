import { pool } from "../../config/db.js";

export const getInvoiceDataService = async (paymentId) => {
  // Get payment with member, plan, admin details, and app settings
  const [rows] = await pool.query(
    `SELECT 
        p.id AS paymentId,
        p.amount,
        p.invoiceNo,
        p.paymentDate,
        p.paymentMode,
        m.id AS memberId,
        m.fullName AS memberName,
        m.email AS memberEmail,
        m.phone AS memberPhone,
        m.address AS memberAddress,
        m.membershipFrom,
        m.membershipTo,
        m.adminId,
        m.discount AS memberDiscount,
        b.id AS branchId,
        b.name AS branchName,
        b.address AS branchAddress,
        pl.id AS planId,
        pl.name AS planName,
        pl.price AS planPrice,
        pl.duration AS planDuration,
        pl.validityDays AS planValidity,
        u.id AS adminUserId,
        u.fullName AS adminName,
        u.gymName AS adminGymName,
        u.gymAddress AS adminGymAddress,
        u.gstNumber AS adminGstNumber,
        u.tax AS adminTax,
        u.phone AS adminPhone,
        u.email AS adminEmail,
        s.gym_name AS settingsGymName,
        mu.tax AS memberTax
     FROM Payment p
     LEFT JOIN Member m ON m.id = p.memberId
     LEFT JOIN Branch b ON b.id = m.branchId
     LEFT JOIN Plan pl ON pl.id = p.planId
     LEFT JOIN User u ON u.id = m.adminId
     LEFT JOIN User mu ON mu.id = m.userId
     LEFT JOIN app_settings s ON s.adminId = m.adminId
     WHERE p.id = ?`,
    [paymentId]
  );

  if (rows.length === 0) {
    throw { status: 404, message: "Payment / Invoice not found" };
  }

  const payment = rows[0];

  // Calculate CGST and SGST based on member's tax rate
  const taxRate = parseFloat(payment.memberTax || 0);
  const discount = parseFloat(payment.memberDiscount || 0);
  const totalPaid = parseFloat(payment.amount || 0);

  // TotalPaid = Base + (Base * taxRate / 100) - Discount
  // TotalPaid + Discount = Base * (1 + taxRate / 100)
  // Base = (TotalPaid + Discount) / (1 + taxRate / 100)
  const subtotal = (totalPaid + discount) / (1 + taxRate / 100);
  const taxAmount = (subtotal * taxRate) / 100;
  const cgstAmount = taxAmount / 2;
  const sgstAmount = taxAmount / 2;
  const totalAmount = totalPaid;

  return {
    ...payment,
    subtotal: Math.round(subtotal),
    taxRate,
    taxAmount: Math.round(taxAmount),
    cgstAmount: Math.round(cgstAmount * 100) / 100,
    sgstAmount: Math.round(sgstAmount * 100) / 100,
    totalAmount,
    discount
  };
};
