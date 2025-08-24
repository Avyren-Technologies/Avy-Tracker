-- Migration: Create Face Verification Tables
-- Description: Creates tables for face verification system including profiles, logs, device fingerprints, and audit logs
-- Date: 2025-01-21

-- Face verification profiles table
CREATE TABLE IF NOT EXISTS face_verification_profiles (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  face_encoding_hash VARCHAR(255) NOT NULL,
  encrypted_face_data TEXT NOT NULL,
  encryption_key_hash VARCHAR(255) NOT NULL,
  registration_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  verification_count INTEGER DEFAULT 0,
  last_verification_at TIMESTAMP,
  quality_score DECIMAL(3,2),
  UNIQUE(user_id, is_active)
);

-- Face verification logs table
CREATE TABLE IF NOT EXISTS face_verification_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  verification_type VARCHAR(50) NOT NULL CHECK (verification_type IN ('start', 'end', 'test', 'registration', 'update')),
  success BOOLEAN NOT NULL,
  confidence_score DECIMAL(3,2),
  liveness_detected BOOLEAN,
  liveness_score DECIMAL(3,2),
  device_fingerprint VARCHAR(255),
  ip_address INET,
  user_agent TEXT,
  location_data JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Device fingerprints table
CREATE TABLE IF NOT EXISTS device_fingerprints (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fingerprint_hash VARCHAR(255) NOT NULL,
  device_info JSONB,
  is_trusted BOOLEAN DEFAULT false,
  risk_score INTEGER DEFAULT 50 CHECK (risk_score >= 0 AND risk_score <= 100),
  first_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, fingerprint_hash)
);

-- Biometric audit logs table
CREATE TABLE IF NOT EXISTS biometric_audit_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action_type VARCHAR(100) NOT NULL,
  action_details JSONB,
  performed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add face verification fields to existing users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS face_registered BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS face_enabled BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_face_verification TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS face_verification_success_count INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS face_verification_failures INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS face_locked_until TIMESTAMP;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_face_verification_profiles_user_id ON face_verification_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_face_verification_profiles_active ON face_verification_profiles(is_active);
CREATE INDEX IF NOT EXISTS idx_face_verification_logs_user_id ON face_verification_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_face_verification_logs_created_at ON face_verification_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_face_verification_logs_type ON face_verification_logs(verification_type);
CREATE INDEX IF NOT EXISTS idx_device_fingerprints_user_id ON device_fingerprints(user_id);
CREATE INDEX IF NOT EXISTS idx_device_fingerprints_hash ON device_fingerprints(fingerprint_hash);
CREATE INDEX IF NOT EXISTS idx_biometric_audit_logs_user_id ON biometric_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_biometric_audit_logs_created_at ON biometric_audit_logs(created_at);

-- Add comments for documentation
COMMENT ON TABLE face_verification_profiles IS 'Stores encrypted face verification profiles for users';
COMMENT ON TABLE face_verification_logs IS 'Logs all face verification attempts with detailed metadata';
COMMENT ON TABLE device_fingerprints IS 'Stores device fingerprinting data for security and fraud detection';
COMMENT ON TABLE biometric_audit_logs IS 'Audit trail for all biometric-related actions and security events';

-- Grant permissions (adjust based on your database setup)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON face_verification_profiles TO your_app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON face_verification_logs TO your_app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON device_fingerprints TO your_app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON biometric_audit_logs TO your_app_user;
