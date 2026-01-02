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
    multipleStatements: true, // Allow multiple SQL statements
  });

  try {
    console.log("✅ Connected to database");

    // Read migration file
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, "migration_multiple_plans.sql"),
      "utf8"
    );

    console.log("📄 Running migration...");

    // Execute migration
    const [results] = await connection.query(migrationSQL);

    console.log("✅ Migration completed successfully!");
    console.log("\n📊 Results:");
    
    // Check if table was created
    const [tables] = await connection.query(
      "SHOW TABLES LIKE 'member_plan_assignment'"
    );
    
    if (tables.length > 0) {
      console.log("✅ Table 'member_plan_assignment' created successfully");
      
      // Get count
      const [count] = await connection.query(
        "SELECT COUNT(*) as total FROM member_plan_assignment"
      );
      console.log(`✅ Migrated ${count[0].total} existing plan assignments`);
      
      // Show sample data
      const [samples] = await connection.query(
        "SELECT * FROM member_plan_assignment LIMIT 3"
      );
      if (samples.length > 0) {
        console.log("\n📋 Sample data:");
        console.table(samples);
      }
    }

  } catch (error) {
    console.error("❌ Migration failed:", error.message);
    process.exit(1);
  } finally {
    await connection.end();
    console.log("\n✅ Database connection closed");
  }
}

runMigration();

