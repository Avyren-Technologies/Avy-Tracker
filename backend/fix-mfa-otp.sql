-- Fix MFA OTP column size to accommodate SHA-256 hashes
-- Run this script directly in your PostgreSQL database

-- Change the mfa_otp column size from VARCHAR(6) to VARCHAR(64)
ALTER TABLE users 
ALTER COLUMN mfa_otp TYPE VARCHAR(64);

-- Update the comment to reflect that we're storing hashed OTPs
COMMENT ON COLUMN users.mfa_otp IS 'Current MFA OTP code (SHA-256 hashed)';

-- Recreate the index to ensure it works with the new column size
DROP INDEX IF EXISTS idx_users_mfa_otp;
CREATE INDEX idx_users_mfa_otp ON users(mfa_otp, mfa_otp_expires);

-- Verify the change
SELECT column_name, data_type, character_maximum_length 
FROM information_schema.columns 
WHERE table_name = 'users' AND column_name = 'mfa_otp';
