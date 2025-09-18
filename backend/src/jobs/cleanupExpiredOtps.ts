import { CronJob } from "cron";
import { pool } from "../config/database";

const LOCK_KEY = 1234567890; // stable integer unique to this job

async function cleanupExpiredMfaOtp() {
  const client = await pool.connect();
  let locked = false;

  try {
    // acquire session-scoped advisory lock
    const res = await client.query(
      "SELECT pg_try_advisory_lock($1) AS locked",
      [LOCK_KEY],
    );
    locked = !!(res.rows[0] && res.rows[0].locked);

    if (!locked) {
      console.log(
        "cleanup job: lock not acquired — another instance is running it.",
      );
      return;
    }

    console.log("cleanup job: lock acquired, running cleanup...");

    // Call DB function (or run the update inline)
    await client.query("SELECT cleanup_expired_mfa_otps()");

    console.log("cleanup job: cleanup completed.");
  } catch (error) {
    console.error("Error cleaning up expired MFA OTPs:", error);
  } finally {
    // release advisory lock only if we acquired it
    if (locked) {
      try {
        await client.query("SELECT pg_advisory_unlock($1)", [LOCK_KEY]);
      } catch (unlockErr) {
        console.error("Failed to release advisory lock:", unlockErr);
      }
    }

    // release the client back to the pool (do not end the pool)
    try {
      client.release();
    } catch (releaseErr) {
      console.error("Failed to release DB client:", releaseErr);
    }
  }
}

// run every 5 minutes (UTC)
const job = new CronJob(
  "*/5 * * * *",
  cleanupExpiredMfaOtp,
  null,
  true, // start now
  "UTC", // timezone
);

// note: since we passed `start:true` above, no need to call job.start() again
export default job;
