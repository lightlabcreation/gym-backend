import { sendNotificationService } from "./notif.service.js";

export const sendNotification = async (req, res, next) => {
  try {
    const log = await sendNotificationService(req.body);
    res.json({ success: true, log });
  } catch (err) {
    next(err);
  }
};
