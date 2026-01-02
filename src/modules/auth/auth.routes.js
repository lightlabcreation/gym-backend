import { Router } from "express";
import {getDashboardStats, register, login,   getUserById, updateUser, deleteUser, getAdmins, loginMember,changePasswordController,getAdminDashboard } from "./auth.controller.js";
import { verifyToken } from "../../middlewares/auth.js";
const router = Router();

router.post("/register", register);
router.post("/login", login);
router.post("/login",loginMember);


router.get("/user/:id", getUserById);
router.put("/user/:id", updateUser);
router.delete("/user/:id", deleteUser);
router.get("/admins", getAdmins);
router.get("/dashboard", getDashboardStats);
router.put("/changepassword",changePasswordController);
router.get("/admindashboard/:id",getAdminDashboard);


export default router;
