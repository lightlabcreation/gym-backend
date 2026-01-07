
import mysql from "mysql2/promise";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || "localhost",
        user: process.env.DB_USER || "root",
        password: process.env.DB_PASSWORD || "",
        database: process.env.DB_NAME || "gym_db",
    });

    try {
        const sql = fs.readFileSync(path.join(__dirname, "migration_add_discount_to_member.sql"), "utf8");
        console.log("Running migration...");
        await connection.query(sql);
        console.log("Migration successful: Added discount column to member table.");
    } catch (error) {
        if (error.code === 'ER_DUP_FIELDNAME') {
            console.log("Column 'discount' already exists. Skipping.");
        } else {
            console.error("Migration failed:", error);
        }
    } finally {
        await connection.end();
    }
}

runMigration();
