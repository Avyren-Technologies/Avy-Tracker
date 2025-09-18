import { pool } from "../config/database";
import fs from "fs";
import path from "path";

export const setupOTPSystem = async () => {
  const client = await pool.connect();

  try {
    console.log("Setting up OTP system...");

    // Check if migration file exists
    const migrationPath = path.join(
      __dirname,
      "../database/migrations/007_create_otp_tables.sql",
    );
    if (!fs.existsSync(migrationPath)) {
      console.error("OTP migration file not found:", migrationPath);
      return;
    }

    // Check if OTP tables already exist
    const tableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'otp_records'
      );
    `);

    if (tableExists.rows[0].exists) {
      console.log(
        "OTP tables already exist, checking if migration needs to be updated...",
      );

      // Check if the purpose constraint needs to be updated
      const constraintCheck = await client.query(`
        SELECT constraint_name, check_clause 
        FROM information_schema.check_constraints 
        WHERE constraint_name LIKE '%otp_records_purpose%'
      `);

      if (constraintCheck.rows.length > 0) {
        console.log(
          "OTP tables exist with constraints, checking if update is needed...",
        );

        // Try to insert a test record with new purpose to see if constraint allows it
        try {
          await client.query(`
            INSERT INTO otp_records (id, phone_number, otp_hash, purpose, expires_at)
            VALUES ('test-id', '+1234567890', 'test-hash', 'face-settings-access', NOW() + INTERVAL '5 minutes')
            ON CONFLICT (id) DO NOTHING
          `);

          // If successful, clean up the test record
          await client.query(`DELETE FROM otp_records WHERE id = 'test-id'`);
          console.log("OTP tables are up to date with all required purposes");
          return;
        } catch (error: any) {
          if (error.message.includes("check constraint")) {
            console.log(
              "OTP tables need to be updated with new purposes, updating...",
            );
            await updateOTPConstraints(client);
          } else {
            throw error;
          }
        }
      }
    }

    // Read migration file
    const migrationSQL = fs.readFileSync(migrationPath, "utf8");

    // Execute migration
    console.log("Executing OTP migration...");
    await client.query(migrationSQL);

    console.log("OTP system setup completed successfully");
  } catch (error) {
    console.error("Error setting up OTP system:", error);
    throw error;
  } finally {
    client.release();
  }
};

const updateOTPConstraints = async (client: any) => {
  try {
    // Drop the existing constraint
    await client.query(`
      ALTER TABLE otp_records 
      DROP CONSTRAINT IF EXISTS otp_records_purpose_check
    `);

    // Add the new constraint with all required purposes
    await client.query(`
      ALTER TABLE otp_records 
      ADD CONSTRAINT otp_records_purpose_check 
      CHECK (purpose IN ('shift_start', 'shift_end', 'face_verification', 'account_verification', 'face-settings-access', 'profile-update', 'security-verification', 'password-reset', 'manager_override'))
    `);

    console.log("OTP purpose constraints updated successfully");
  } catch (error) {
    console.error("Error updating OTP constraints:", error);
    throw error;
  }
};

// Run setup if this file is executed directly
if (require.main === module) {
  setupOTPSystem()
    .then(() => {
      console.log("OTP system setup completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("OTP system setup failed:", error);
      process.exit(1);
    });
}
