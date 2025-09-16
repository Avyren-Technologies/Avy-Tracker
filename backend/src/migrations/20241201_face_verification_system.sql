-- Face Verification System Migration
-- Created: 2024-12-01
-- Description: Comprehensive face verification system with biometric security, OTP verification, and audit logging

-- Begin transaction
BEGIN;

-- 1. Face Verification Profiles Table
-- Stores encrypted face encodings and profile metadata
CREATE TABLE face_verification_profiles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    face_encoding_hash TEXT NOT NULL, -- SHA-256 hash of face encoding for quick comparison
    encrypted_face_data TEXT NOT NULL, -- Encrypted face encoding data
    encryption_key_hash TEXT NOT NULL, -- Hash of the encryption key for validation
    registration_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    verification_count INTEGER DEFAULT 0,
    last_verification_at TIMESTAMP WITH TIME ZONE,
    registration_device_info JSONB DEFAULT '{}', -- Device info during registration
    quality_score DECIMAL(5,4), -- Face quality score during registration (0-1)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Face Verification Logs Table
-- Comprehensive audit trail for all face verification attempts
CREATE TABLE face_verification_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    shift_id INTEGER REFERENCES employee_shifts(id) ON DELETE SET NULL,
    verification_type VARCHAR(20) NOT NULL CHECK (verification_type IN ('start', 'end', 'registration', 'update', 'test')),
    success BOOLEAN NOT NULL,
    confidence_score DECIMAL(5,4), -- Verification confidence score (0-1)
    liveness_detected BOOLEAN DEFAULT FALSE,
    liveness_score DECIMAL(5,4), -- Liveness detection confidence (0-1)
    failure_reason TEXT,
    attempt_number INTEGER DEFAULT 1, -- Attempt number in sequence
    device_fingerprint TEXT,
    ip_address INET,
    user_agent TEXT,
    location_data JSONB, -- GPS coordinates during verification
    verification_duration_ms INTEGER, -- Time taken for verification
    face_quality_score DECIMAL(5,4), -- Quality of captured face
    lighting_conditions VARCHAR(20) CHECK (lighting_conditions IN ('poor', 'fair', 'good', 'excellent')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. OTP Verifications Table
-- Secure OTP system for accessing sensitive face configuration settings
CREATE TABLE otp_verifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    phone_number VARCHAR(20) NOT NULL,
    otp_code_hash TEXT NOT NULL, -- Hashed OTP code for security
    purpose VARCHAR(50) NOT NULL CHECK (purpose IN ('face_settings', 'face_registration', 'face_deletion', 'profile_update')),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    verified BOOLEAN DEFAULT FALSE,
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    ip_address INET,
    device_fingerprint TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    verified_at TIMESTAMP WITH TIME ZONE,
    invalidated_at TIMESTAMP WITH TIME ZONE -- For manual invalidation
);

-- 4. Biometric Audit Logs Table
-- Comprehensive compliance and security audit trail
CREATE TABLE biometric_audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action_type VARCHAR(30) NOT NULL CHECK (action_type IN (
        'profile_created', 'profile_updated', 'profile_deleted', 'profile_accessed',
        'verification_attempt', 'settings_accessed', 'data_exported', 'consent_given',
        'consent_revoked', 'data_retention_applied', 'security_breach_detected'
    )),
    action_details JSONB NOT NULL DEFAULT '{}',
    performed_by INTEGER REFERENCES users(id), -- Who performed the action (for admin actions)
    ip_address INET,
    user_agent TEXT,
    device_fingerprint TEXT,
    location_data JSONB, -- GPS coordinates if applicable
    compliance_flags JSONB DEFAULT '{}', -- GDPR, CCPA compliance markers
    retention_until TIMESTAMP WITH TIME ZONE, -- Data retention deadline
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Device Fingerprints Table
-- Track and validate device characteristics for fraud detection
CREATE TABLE device_fingerprints (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    fingerprint_hash TEXT NOT NULL,
    device_info JSONB NOT NULL DEFAULT '{}', -- Device characteristics
    first_seen TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_trusted BOOLEAN DEFAULT FALSE,
    risk_score INTEGER DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
    blocked BOOLEAN DEFAULT FALSE,
    block_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Enhance Employee Shifts Table
-- Add face verification columns to existing employee_shifts table
ALTER TABLE employee_shifts 
ADD COLUMN IF NOT EXISTS face_verification_start BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS face_verification_end BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS face_verification_start_confidence DECIMAL(5,4),
ADD COLUMN IF NOT EXISTS face_verification_end_confidence DECIMAL(5,4),
ADD COLUMN IF NOT EXISTS face_verification_start_liveness BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS face_verification_end_liveness BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS location_verification_start BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS location_verification_end BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS verification_override_reason TEXT,
ADD COLUMN IF NOT EXISTS verification_override_by INTEGER REFERENCES users(id),
ADD COLUMN IF NOT EXISTS verification_override_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS combined_verification_score DECIMAL(5,4), -- Overall verification confidence
ADD COLUMN IF NOT EXISTS verification_method VARCHAR(20) CHECK (verification_method IN ('face_only', 'location_only', 'combined', 'override'));

-- 7. Enhance Users Table
-- Add face-related flags and counters to existing users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS face_registered BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS face_enabled BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS face_registration_required BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS face_registration_completed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS last_face_verification TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS face_verification_failures INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS face_locked_until TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS face_verification_success_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS biometric_consent_given BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS biometric_consent_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS face_data_retention_until TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS face_quality_threshold DECIMAL(3,2) DEFAULT 0.70 CHECK (face_quality_threshold >= 0 AND face_quality_threshold <= 1);

-- 8. Performance Optimization Indexes
-- Primary indexes for fast lookups
CREATE INDEX idx_face_verification_profiles_user_id ON face_verification_profiles(user_id);
CREATE INDEX idx_face_verification_profiles_active ON face_verification_profiles(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_face_verification_profiles_hash ON face_verification_profiles(face_encoding_hash);

-- Face verification logs indexes
CREATE INDEX idx_face_verification_logs_user_id ON face_verification_logs(user_id);
CREATE INDEX idx_face_verification_logs_shift_id ON face_verification_logs(shift_id);
CREATE INDEX idx_face_verification_logs_created_at ON face_verification_logs(created_at DESC);
CREATE INDEX idx_face_verification_logs_success ON face_verification_logs(success);
CREATE INDEX idx_face_verification_logs_type_user ON face_verification_logs(verification_type, user_id);
CREATE INDEX idx_face_verification_logs_device ON face_verification_logs(device_fingerprint) WHERE device_fingerprint IS NOT NULL;

-- OTP verifications indexes
CREATE INDEX idx_otp_verifications_user_id ON otp_verifications(user_id);
CREATE INDEX idx_otp_verifications_expires_at ON otp_verifications(expires_at);
CREATE INDEX idx_otp_verifications_purpose ON otp_verifications(purpose);
CREATE INDEX idx_otp_verifications_active ON otp_verifications(verified, expires_at) WHERE verified = FALSE AND expires_at > NOW();

-- Biometric audit logs indexes
CREATE INDEX idx_biometric_audit_logs_user_id ON biometric_audit_logs(user_id);
CREATE INDEX idx_biometric_audit_logs_action_type ON biometric_audit_logs(action_type);
CREATE INDEX idx_biometric_audit_logs_created_at ON biometric_audit_logs(created_at DESC);
CREATE INDEX idx_biometric_audit_logs_retention ON biometric_audit_logs(retention_until) WHERE retention_until IS NOT NULL;

-- Device fingerprints indexes
CREATE INDEX idx_device_fingerprints_user_id ON device_fingerprints(user_id);
CREATE INDEX idx_device_fingerprints_hash ON device_fingerprints(fingerprint_hash);
CREATE INDEX idx_device_fingerprints_trusted ON device_fingerprints(is_trusted) WHERE is_trusted = TRUE;
CREATE INDEX idx_device_fingerprints_blocked ON device_fingerprints(blocked) WHERE blocked = TRUE;

-- Employee shifts enhanced indexes
CREATE INDEX idx_employee_shifts_face_verification ON employee_shifts(face_verification_start, face_verification_end);
CREATE INDEX idx_employee_shifts_verification_method ON employee_shifts(verification_method) WHERE verification_method IS NOT NULL;

-- Users enhanced indexes
CREATE INDEX idx_users_face_registered ON users(face_registered) WHERE face_registered = TRUE;
CREATE INDEX idx_users_face_enabled ON users(face_enabled) WHERE face_enabled = TRUE;
CREATE INDEX idx_users_face_locked ON users(face_locked_until) WHERE face_locked_until IS NOT NULL AND face_locked_until > NOW();
CREATE INDEX idx_users_biometric_consent ON users(biometric_consent_given) WHERE biometric_consent_given = TRUE;

-- 9. Composite indexes for complex queries
CREATE INDEX idx_face_logs_user_success_date ON face_verification_logs(user_id, success, created_at DESC);
CREATE INDEX idx_otp_user_purpose_expires ON otp_verifications(user_id, purpose, expires_at DESC);
CREATE INDEX idx_audit_user_action_date ON biometric_audit_logs(user_id, action_type, created_at DESC);

-- 10. Partial indexes for performance
CREATE INDEX idx_face_profiles_active_users ON face_verification_profiles(user_id, last_updated) WHERE is_active = TRUE;
CREATE INDEX idx_failed_verifications ON face_verification_logs(user_id, created_at) WHERE success = FALSE;
CREATE INDEX idx_recent_verifications ON face_verification_logs(user_id, verification_type, created_at) WHERE created_at > NOW() - INTERVAL '30 days';

-- 11. Add table comments for documentation
COMMENT ON TABLE face_verification_profiles IS 'Stores encrypted face encodings and profile metadata for biometric authentication';
COMMENT ON TABLE face_verification_logs IS 'Comprehensive audit trail for all face verification attempts and outcomes';
COMMENT ON TABLE otp_verifications IS 'Secure OTP system for accessing sensitive face configuration settings';
COMMENT ON TABLE biometric_audit_logs IS 'Compliance and security audit trail for all biometric data operations';
COMMENT ON TABLE device_fingerprints IS 'Device tracking and validation for fraud detection and security';

-- 12. Add column comments for important fields
COMMENT ON COLUMN face_verification_profiles.encrypted_face_data IS 'SHA-256 hashed face encoding data with salt using device-specific keys';
COMMENT ON COLUMN face_verification_profiles.face_encoding_hash IS 'SHA-256 hash for quick face encoding comparison without decryption';
COMMENT ON COLUMN face_verification_logs.confidence_score IS 'Face verification confidence score (0.0-1.0), higher is more confident';
COMMENT ON COLUMN face_verification_logs.liveness_score IS 'Liveness detection confidence (0.0-1.0), higher indicates real person';
COMMENT ON COLUMN otp_verifications.otp_code_hash IS 'Bcrypt hashed OTP code for secure storage and verification';
COMMENT ON COLUMN biometric_audit_logs.compliance_flags IS 'GDPR, CCPA and other compliance markers and metadata';

-- Commit transaction
COMMIT;
--- 1
3. Verification Flow Audit Tables
-- Main verification audit log table
CREATE TABLE verification_audit_logs (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR(255) NOT NULL UNIQUE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shift_action VARCHAR(10) NOT NULL CHECK (shift_action IN ('start', 'end')),
  status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'overridden')),
  confidence_score DECIMAL(5,4) DEFAULT 0,
  total_latency INTEGER, -- in milliseconds
  fallback_mode BOOLEAN DEFAULT FALSE,
  override_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Verification steps audit table
CREATE TABLE verification_audit_steps (
  id SERIAL PRIMARY KEY,
  audit_log_id INTEGER NOT NULL REFERENCES verification_audit_logs(id) ON DELETE CASCADE,
  step_type VARCHAR(20) NOT NULL CHECK (step_type IN ('location', 'face')),
  completed BOOLEAN DEFAULT FALSE,
  retry_count INTEGER DEFAULT 0,
  latency INTEGER, -- in milliseconds
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Detailed verification events audit table
CREATE TABLE verification_audit_events (
  id SERIAL PRIMARY KEY,
  audit_log_id INTEGER NOT NULL REFERENCES verification_audit_logs(id) ON DELETE CASCADE,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  step_type VARCHAR(20) CHECK (step_type IN ('location', 'face')),
  success BOOLEAN,
  error_message TEXT,
  latency INTEGER, -- in milliseconds
  details JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Offline verification sync table
CREATE TABLE offline_verification_sync (
  id SERIAL PRIMARY KEY,
  offline_id VARCHAR(255) NOT NULL UNIQUE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shift_action VARCHAR(10) NOT NULL CHECK (shift_action IN ('start', 'end')),
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  face_verification_data JSONB DEFAULT '{}',
  location_verification_data JSONB DEFAULT '{}',
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  sync_attempts INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Verification audit indexes
CREATE INDEX idx_verification_audit_logs_user_id ON verification_audit_logs(user_id);
CREATE INDEX idx_verification_audit_logs_session_id ON verification_audit_logs(session_id);
CREATE INDEX idx_verification_audit_logs_status ON verification_audit_logs(status);
CREATE INDEX idx_verification_audit_logs_created_at ON verification_audit_logs(created_at DESC);
CREATE INDEX idx_verification_audit_logs_user_action ON verification_audit_logs(user_id, shift_action, created_at DESC);

CREATE INDEX idx_verification_audit_steps_audit_id ON verification_audit_steps(audit_log_id);
CREATE INDEX idx_verification_audit_steps_type ON verification_audit_steps(step_type);
CREATE INDEX idx_verification_audit_steps_completed ON verification_audit_steps(completed);

CREATE INDEX idx_verification_audit_events_audit_id ON verification_audit_events(audit_log_id);
CREATE INDEX idx_verification_audit_events_timestamp ON verification_audit_events(timestamp DESC);
CREATE INDEX idx_verification_audit_events_event_type ON verification_audit_events(event_type);
CREATE INDEX idx_verification_audit_events_step_type ON verification_audit_events(step_type);

CREATE INDEX idx_offline_verification_sync_user_id ON offline_verification_sync(user_id);
CREATE INDEX idx_offline_verification_sync_offline_id ON offline_verification_sync(offline_id);
CREATE INDEX idx_offline_verification_sync_synced_at ON offline_verification_sync(synced_at DESC);

-- Add comments for verification audit tables
COMMENT ON TABLE verification_audit_logs IS 'Main audit log for verification flow sessions with performance metrics';
COMMENT ON TABLE verification_audit_steps IS 'Individual verification steps within a flow session';
COMMENT ON TABLE verification_audit_events IS 'Detailed event log for verification flow debugging and monitoring';
COMMENT ON TABLE offline_verification_sync IS 'Sync table for offline verification data when connectivity is restored';