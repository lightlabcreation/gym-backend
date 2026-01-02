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

    // Read migration file
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, "migration_membership_renewal_requests.sql"),
      "utf8"
    );

    console.log("📄 Running migration...");

    // Split SQL into individual statements and execute
    const statements = migrationSQL.split(';').filter(s => s.trim() !== '');

    for (const statement of statements) {
      if (statement.trim()) {
        await connection.query(statement);
      }
    }

    console.log("✅ Migration completed successfully!");
    
    // Check if table was created
    const [tables] = await connection.query(
      "SHOW TABLES LIKE 'membership_renewal_requests'"
    );
    
    if (tables.length > 0) {
      console.log("✅ Table 'membership_renewal_requests' created successfully");
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

