import { pool } from "../config/database";

async function testFaceVerification() {
  const client = await pool.connect();

  try {
    console.log("Testing Face Verification System...");

    // Test 1: Check if tables exist
    console.log("\n1. Checking if face verification tables exist...");

    const tables = [
      "face_verification_profiles",
      "face_verification_logs",
      "otp_verifications",
      "biometric_audit_logs",
      "device_fingerprints",
    ];

    for (const table of tables) {
      const result = await client.query(
        `
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        );
      `,
        [table],
      );

      console.log(
        `  ${table}: ${result.rows[0].exists ? "✅ EXISTS" : "❌ MISSING"}`,
      );
    }

    // Test 2: Check if users table has required columns
    console.log("\n2. Checking if users table has required columns...");

    const requiredColumns = [
      "face_registered",
      "face_enabled",
      "face_verification_failures",
      "face_locked_until",
      "last_face_verification",
    ];

    for (const column of requiredColumns) {
      const result = await client.query(
        `
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'users' 
          AND column_name = $1
        );
      `,
        [column],
      );

      console.log(
        `  ${column}: ${result.rows[0].exists ? "✅ EXISTS" : "❌ MISSING"}`,
      );
    }

    // Test 3: Check if we can query the face verification status
    console.log("\n3. Testing face verification status query...");

    try {
      const result = await client.query(`
        SELECT 
          u.id,
          u.face_registered,
          u.face_enabled,
          fvp.is_active as profile_active
        FROM users u
        LEFT JOIN face_verification_profiles fvp ON u.id = fvp.user_id
        LIMIT 5
      `);

      console.log(`  ✅ Query successful, found ${result.rows.length} users`);
      result.rows.forEach((row, index) => {
        console.log(
          `    User ${index + 1}: ID=${row.id}, registered=${row.face_registered}, enabled=${row.face_enabled}, profile_active=${row.profile_active}`,
        );
      });
    } catch (error) {
      if (error instanceof Error) {
        console.log(`  ❌ Query failed: ${error.message}`);
      } else {
        console.log("  ❌ Query failed: Unknown error");
      }
    }

    // Test 4: Check if we can query verification statistics
    console.log("\n4. Testing verification statistics query...");

    try {
      const result = await client.query(`
        SELECT 
          COUNT(*) as total_logs
        FROM face_verification_logs
        WHERE created_at > NOW() - INTERVAL '1 day' * 30
      `);

      console.log(
        `  ✅ Statistics query successful, found ${result.rows[0].total_logs} logs in last 30 days`,
      );
    } catch (error) {
      if (error instanceof Error) {
        console.log(`  ❌ Statistics query failed: ${error.message}`);
      } else {
        console.log("  ❌ Statistics query failed: Unknown error");
      }
    }

    console.log("\n✅ Face Verification System test completed!");
  } catch (error) {
    console.error("❌ Test failed:", error);
  } finally {
    client.release();
  }
}

// Run test if called directly
if (require.main === module) {
  testFaceVerification()
    .then(() => {
      console.log("Test completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Test failed:", error);
      process.exit(1);
    });
}

export { testFaceVerification };
