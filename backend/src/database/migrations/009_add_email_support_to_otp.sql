-- Add email support to OTP records table
-- Make phone_number optional and add email column
ALTER TABLE otp_records 
ADD COLUMN IF NOT EXISTS email VARCHAR(255);

-- Add constraint to ensure either phone_number or email is provided
ALTER TABLE otp_records 
ADD CONSTRAINT check_contact_method 
CHECK (
  (phone_number IS NOT NULL AND email IS NULL) OR 
  (phone_number IS NULL AND email IS NOT NULL)
);

-- Make phone_number nullable
ALTER TABLE otp_records 
ALTER COLUMN phone_number DROP NOT NULL;

-- Add index for email lookups
CREATE INDEX IF NOT EXISTS idx_otp_records_email ON otp_records(email);

-- Update rate limiting table to support email addresses
-- Since phone_number is the primary key, we'll create a separate table for email rate limits

-- Create a new table for email rate limiting
CREATE TABLE IF NOT EXISTS email_rate_limits (
  email VARCHAR(255) PRIMARY KEY,
  request_count INTEGER DEFAULT 0,
  window_start TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  blocked_until TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add trigger to update updated_at timestamp for email rate limits
CREATE TRIGGER update_email_rate_limits_updated_at 
  BEFORE UPDATE ON email_rate_limits 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add indexes for email rate limiting
CREATE INDEX IF NOT EXISTS idx_email_rate_limits_window_start ON email_rate_limits(window_start);
CREATE INDEX IF NOT EXISTS idx_email_rate_limits_blocked_until ON email_rate_limits(blocked_until);

-- Update SMS delivery log to support email delivery
ALTER TABLE sms_delivery_log 
ADD COLUMN IF NOT EXISTS email VARCHAR(255);

-- Make phone_number nullable in delivery log
ALTER TABLE sms_delivery_log 
ALTER COLUMN phone_number DROP NOT NULL;

-- Add constraint to ensure either phone_number or email is provided in delivery log
ALTER TABLE sms_delivery_log 
ADD CONSTRAINT check_delivery_log_contact_method 
CHECK (
  (phone_number IS NOT NULL AND email IS NULL) OR 
  (phone_number IS NULL AND email IS NOT NULL)
);

-- Add index for email delivery tracking
CREATE INDEX IF NOT EXISTS idx_sms_delivery_log_email ON sms_delivery_log(email);

-- Add delivery method column to track SMS vs Email
ALTER TABLE sms_delivery_log 
ADD COLUMN IF NOT EXISTS delivery_method VARCHAR(10) DEFAULT 'sms' 
CHECK (delivery_method IN ('sms', 'email'));

-- Update the table name to be more generic (optional - keeping sms_delivery_log for now)
-- ALTER TABLE sms_delivery_log RENAME TO delivery_log;
