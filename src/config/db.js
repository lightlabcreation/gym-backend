import mysql from "mysql2";
import dotenv from "dotenv";
dotenv.config();

// Create a **Promise Pool directly**
export const pool = mysql
  .createPool({
    host: "localhost",
    user: "root",
    password: "",
    database: "gym_db",
    port: 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  })
  .promise(); // 🔥 THIS MAKES pool.query() RETURN A PROMISE

// Test MySQL connection
pool
  .getConnection()
  .then((connection) => {
    console.log("✅ MySQL connected successfully!");
    connection.release();
  })
  .catch((err) => {
    console.error("❌ MySQL connection failed:", err.message);
  });

// // live database
// import mysql from "mysql2";
// import dotenv from "dotenv";
// dotenv.config();

// // Create a **Promise Pool directly**
// export const pool = mysql
//   .createPool({
//     host: "switchback.proxy.rlwy.net",
//     user: "root",
//     password: "LYEPuGdFNazTUxSFwrZilcKIAOlztDYo",
//     database: "railway",
//     port: 35602,
//     waitForConnections: true,
//     connectionLimit: 10,
//     queueLimit: 0,
//   })
//   .promise(); // 🔥 THIS MAKES pool.query() RETURN A PROMISE

// // Test MySQL connection
// pool
//   .getConnection()
//   .then((connection) => {
//     console.log("✅ MySQL connected successfully!");
//     connection.release();
//   })
//   .catch((err) => {
//     console.error("❌ MySQL connection failed:", err.message);
//   });
