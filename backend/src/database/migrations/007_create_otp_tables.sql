-- OTP Records Table
CREATE TABLE IF NOT EXISTS otp_records (
  id VARCHAR(36) PRIMARY KEY,
  phone_number VARCHAR(20) NOT NULL,
  otp_hash VARCHAR(64) NOT NULL, -- SHA-256 hash of OTP for security
  purpose VARCHAR(50) NOT NULL CHECK (purpose IN ('shift_start', 'shift_end', 'face_verification', 'account_verification', 'face-settings-access', 'profile-update', 'security-verification', 'password-reset', 'manager_override')),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  is_used BOOLEAN DEFAULT false,
  device_fingerprint TEXT,
  ip_address INET,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  verified_at TIMESTAMP WITH TIME ZONE,
  invalidated_at TIMESTAMP WITH TIME ZONE
);

-- SMS Delivery Log Table
CREATE TABLE IF NOT EXISTS sms_delivery_log (
  id SERIAL PRIMARY KEY,
  otp_record_id VARCHAR(36) REFERENCES otp_records(id),
  phone_number VARCHAR(20) NOT NULL,
  message_content TEXT NOT NULL,
  provider_name VARCHAR(50) NOT NULL,
  provider_message_id VARCHAR(255),
  delivery_status VARCHAR(20) DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'sent', 'delivered', 'failed', 'unknown')),
  cost_cents INTEGER DEFAULT 0,
  error_message TEXT,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  delivered_at TIMESTAMP WITH TIME ZONE,
  failed_at TIMESTAMP WITH TIME ZONE
);

-- Rate Limiting Table (for persistent rate limiting across restarts)
CREATE TABLE IF NOT EXISTS otp_rate_limits (
  phone_number VARCHAR(20) PRIMARY KEY,
  request_count INTEGER DEFAULT 0,
  window_start TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  blocked_until TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_otp_records_phone_number ON otp_records(phone_number);
CREATE INDEX IF NOT EXISTS idx_otp_records_expires_at ON otp_records(expires_at);
CREATE INDEX IF NOT EXISTS idx_otp_records_purpose ON otp_records(purpose);
CREATE INDEX IF NOT EXISTS idx_otp_records_created_at ON otp_records(created_at);

CREATE INDEX IF NOT EXISTS idx_sms_delivery_log_phone_number ON sms_delivery_log(phone_number);
CREATE INDEX IF NOT EXISTS idx_sms_delivery_log_provider ON sms_delivery_log(provider_name);
CREATE INDEX IF NOT EXISTS idx_sms_delivery_log_status ON sms_delivery_log(delivery_status);
CREATE INDEX IF NOT EXISTS idx_sms_delivery_log_sent_at ON sms_delivery_log(sent_at);

CREATE INDEX IF NOT EXISTS idx_otp_rate_limits_window_start ON otp_rate_limits(window_start);
CREATE INDEX IF NOT EXISTS idx_otp_rate_limits_blocked_until ON otp_rate_limits(blocked_until);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_otp_records_updated_at 
  BEFORE UPDATE ON otp_records 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_otp_rate_limits_updated_at 
  BEFORE UPDATE ON otp_rate_limits 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Cleanup function for expired OTP records
CREATE OR REPLACE FUNCTION cleanup_expired_otp_records()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete expired OTP records (older than 24 hours)
  DELETE FROM otp_records 
  WHERE expires_at < CURRENT_TIMESTAMP - INTERVAL '24 hours'
     OR (is_used = true AND verified_at < CURRENT_TIMESTAMP - INTERVAL '1 hour');
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  -- Clean up old SMS delivery logs (older than 30 days)
  DELETE FROM sms_delivery_log 
  WHERE sent_at < CURRENT_TIMESTAMP - INTERVAL '30 days';
  
  -- Clean up expired rate limits
  DELETE FROM otp_rate_limits 
  WHERE window_start < CURRENT_TIMESTAMP - INTERVAL '24 hours'
    AND (blocked_until IS NULL OR blocked_until < CURRENT_TIMESTAMP);
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Schedule cleanup to run daily (requires pg_cron extension)
-- SELECT cron.schedule('cleanup-otp-records', '0 2 * * *', 'SELECT cleanup_expired_otp_records();');

-- Grant permissions (commented out as shift_tracker_user role doesn't exist)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON otp_records TO shift_tracker_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON sms_delivery_log TO shift_tracker_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON otp_rate_limits TO shift_tracker_user;
-- GRANT USAGE ON SEQUENCE sms_delivery_log_id_seq TO shift_tracker_user;