import { Router } from "express";
import {
  createSession,
  listSessions,
  updateSession,
  updateSessionStatus,
  deleteSession
} from "./session.controller.js";
// import { verifyToken } from "../../middlewares/auth.js";

const router = Router();

// ➤ Create new session (Only Superadmin + Admin)
router.post(
  "/create",
  // verifyToken(["Superadmin", "Admin"]),
  createSession
);

// ➤ List sessions (Superadmin + Admin + Staff)
router.get("/:adminId/:trainerId?", listSessions);


// ➤ Edit full session (Only Superadmin + Admin)
router.put(
  "/update/:sessionId",
  // verifyToken(["Superadmin", "Admin"]),
  updateSession
);

// ➤ Update only session status (Superadmin + Admin + Staff)
router.put(
  "/status/:sessionId",
  // verifyToken(["Superadmin", "Admin", "Staff"]),
  updateSessionStatus
);

// ➤ Delete session (Only Superadmin)
router.delete(
  "/delete/:sessionId",
  // verifyToken(["Superadmin","Admin"]),
  deleteSession
);

export default router;
