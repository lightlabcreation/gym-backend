// src/modules/member/member.routes.js
import { Router } from "express";
import { getMemberDashboard } from "./memberDashboard.controller.js";

const router = Router();

// ...tumhare baaki member routes

// 👇 NEW: member dashboard by memberId
router.get("/:memberId/dashboard", getMemberDashboard);

export default router;
