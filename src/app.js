// const express = require('express');
// const env = require('./config/env');
// const routes = require('./routes');
// const errorHandler = require('./middlewares/errorHandler');

// const app = express();

// app.use(express.json());
// app.use('/api', routes);

// app.use(errorHandler);

// module.exports = app;



import express from "express";
import cors from "cors";
import morgan from "morgan";
import { ENV } from "./config/env.js";
import router from "./routes/index.js";
import { errorHandler } from "./middlewares/errorHandler.js";
import fileUpload from "express-fileupload";
import { startMemberExpiryCron, startPTAutoCompleteCron, startUnifiedBookingAutoCompleteCron } from "./config/startMemberExpiry.js";


const app = express();
app.use(
  fileUpload({
    useTempFiles: true,
    tempFileDir: "/tmp/",
    limits: { fileSize: 50 * 1024 * 1024 }, // optional 50MB limit
  })
);

// middlewares


app.use(
  cors({
    origin: [
      "http://localhost:5174",
      "http://localhost:5173",
      "http://localhost:5175",
      "https://gym-latest-new.netlify.app",
      "https://gym-speed-fitness.netlify.app",
      "https://speedfitness.live",
      "https://speedfitness.org"


    ],
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    credentials: true
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(morgan("dev"));

// main routes
app.use("/api", router);

// health check route
app.get("/", (req, res) => {
  res.json({ message: "Gym Management API is running" });
});

// error handler (last)
app.use(errorHandler);
startMemberExpiryCron()
startPTAutoCompleteCron()
startUnifiedBookingAutoCompleteCron()

export default app;
