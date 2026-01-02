import express from "express";
import {
  createRequest,
  getPendingRequests,
  getAllRequests,
  approveRequest,
  rejectRequest,
} from "./membershipRenewalRequest.controller.js";

const router = express.Router();

router.post("/", createRequest);
router.get("/pending/:adminId", getPendingRequests);
router.get("/all/:adminId", getAllRequests);
router.put("/:requestId/approve", approveRequest);
router.put("/:requestId/reject", rejectRequest);

export default router;

