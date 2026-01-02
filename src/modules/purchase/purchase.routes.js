import express from "express";
import {updatePurchaseStatus, createPurchase, getAllPurchases } from "./purchase.controller.js";

const router = express.Router();

router.post("/", createPurchase);
router.get("/", getAllPurchases);
router.put("/purchase/status/:id", updatePurchaseStatus);


export default router;
