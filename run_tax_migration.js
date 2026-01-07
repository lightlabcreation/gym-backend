import mysql from "mysql2/promise";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
    const connection = await mysql.createConnection({
        host: "localhost",
        user: "root",
        password: "",
        database: "gym_db",
        port: 3306,
        multipleStatements: true,
    });

    try {
        console.log("✅ Connected to database");

        const migrationSQL = fs.readFileSync(
            path.join(__dirname, "migration_add_tax_rate.sql"),
            "utf8"
        );

        console.log("📄 Running migration...");

        await connection.query(migrationSQL);

        console.log("✅ Migration completed successfully! Added taxRate column.");

        // Verify
        const [columns] = await connection.query(
            "SHOW COLUMNS FROM memberplan LIKE 'taxRate'"
        );

        if (columns.length > 0) {
            console.log("✅ Verified: taxRate column exists.");
        }

    } catch (error) {
        if (error.code === 'ER_DUP_FIELDNAME') {
            console.log("⚠️ Column taxRate already exists. Skipping.");
        } else {
            console.error("❌ Migration failed:", error.message);
        }
    } finally {
        await connection.end();
        console.log("\n✅ Database connection closed");
    }
}

runMigration();
