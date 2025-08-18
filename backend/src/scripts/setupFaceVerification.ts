import { pool } from '../config/database';
import fs from 'fs';
import path from 'path';

const migrationPath = path.join(__dirname, '../migrations/20241201_face_verification_system.sql');

async function setupFaceVerification() {
  const client = await pool.connect();
  
  try {
    console.log('Setting up Face Verification System...');
    
    // Check if migration file exists
    if (!fs.existsSync(migrationPath)) {
      console.error('Migration file not found:', migrationPath);
      return;
    }
    
    // Read migration file
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Begin transaction
    await client.query('BEGIN');
    
    // Check if tables already exist
    const tablesExist = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'face_verification_profiles'
      );
    `);
    
    if (tablesExist.rows[0].exists) {
      console.log('Face verification tables already exist, skipping migration');
      await client.query('COMMIT');
      return;
    }
    
    // Execute migration
    console.log('Creating face verification tables...');
    await client.query(migrationSQL);
    
    // Commit transaction
    await client.query('COMMIT');
    
    console.log('Face Verification System setup completed successfully!');
    
  } catch (error) {
    console.error('Error setting up Face Verification System:', error);
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Run setup if called directly
if (require.main === module) {
  setupFaceVerification()
    .then(() => {
      console.log('Setup completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Setup failed:', error);
      process.exit(1);
    });
}

export { setupFaceVerification };
