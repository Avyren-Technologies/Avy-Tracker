-- =====================================================
-- Attendance Regularization System
-- =====================================================
-- This migration creates tables for managing attendance regularization requests
-- Flow: Employee → Group Admin → Management → Final Approval

-- =====================================================
-- 1. ATTENDANCE REGULARIZATION REQUESTS
-- =====================================================
-- Main table for storing regularization requests
CREATE TABLE IF NOT EXISTS attendance_regularization_requests (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shift_id INTEGER REFERENCES employee_shifts(id) ON DELETE CASCADE,

  -- Request Details
  request_date DATE NOT NULL,
  original_start_time TIMESTAMP WITH TIME ZONE,
  original_end_time TIMESTAMP WITH TIME ZONE,
  requested_start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  requested_end_time TIMESTAMP WITH TIME ZONE NOT NULL,

  -- Request Information
  reason TEXT NOT NULL,
  supporting_documents TEXT[],
  request_type VARCHAR(50) NOT NULL DEFAULT 'time_adjustment',

  -- Status Tracking
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  current_approver_role VARCHAR(20),

  -- Approval Chain
  group_admin_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  group_admin_approved_at TIMESTAMP WITH TIME ZONE,
  group_admin_comments TEXT,

  management_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  management_approved_at TIMESTAMP WITH TIME ZONE,
  management_comments TEXT,

  final_approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  final_approved_at TIMESTAMP WITH TIME ZONE,
  final_comments TEXT,  -- Fixed: Added missing comma here

  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE
);

-- =====================================================
-- 2. REGULARIZATION APPROVAL HISTORY
-- =====================================================
-- Track all approval actions for audit trail
CREATE TABLE IF NOT EXISTS regularization_approval_history (
  id SERIAL PRIMARY KEY,
  request_id INTEGER NOT NULL REFERENCES attendance_regularization_requests(id) ON DELETE CASCADE,
  approver_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  approver_role VARCHAR(20) NOT NULL,
  
  -- Action Details
  action VARCHAR(20) NOT NULL, -- 'submitted', 'group_admin_approved', 'group_admin_rejected', 'management_approved', 'management_rejected', 'final_approved', 'final_rejected', 'cancelled'
  comments TEXT,
  
  -- Metadata
  action_timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  ip_address INET,
  user_agent TEXT
);

-- =====================================================
-- 3. REGULARIZATION NOTIFICATIONS
-- =====================================================
-- Track notifications sent for regularization requests
CREATE TABLE IF NOT EXISTS regularization_notifications (
  id SERIAL PRIMARY KEY,
  request_id INTEGER NOT NULL REFERENCES attendance_regularization_requests(id) ON DELETE CASCADE,
  recipient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notification_type VARCHAR(50) NOT NULL, -- 'request_submitted', 'approval_needed', 'approved', 'rejected', 'status_update'
  
  -- Notification Details
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  notification_data JSONB, -- Additional data for the notification
  
  -- Delivery Status
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  read_at TIMESTAMP WITH TIME ZONE,
  delivery_status VARCHAR(20) DEFAULT 'sent', -- 'sent', 'delivered', 'failed', 'read'
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 4. INDEXES FOR PERFORMANCE
-- =====================================================

-- Attendance Regularization Requests Indexes
CREATE INDEX IF NOT EXISTS idx_regularization_requests_employee_id ON attendance_regularization_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_regularization_requests_shift_id ON attendance_regularization_requests(shift_id);
CREATE INDEX IF NOT EXISTS idx_regularization_requests_status ON attendance_regularization_requests(status);
CREATE INDEX IF NOT EXISTS idx_regularization_requests_request_date ON attendance_regularization_requests(request_date);
CREATE INDEX IF NOT EXISTS idx_regularization_requests_created_at ON attendance_regularization_requests(created_at);
CREATE INDEX IF NOT EXISTS idx_regularization_requests_group_admin_id ON attendance_regularization_requests(group_admin_id);
CREATE INDEX IF NOT EXISTS idx_regularization_requests_management_id ON attendance_regularization_requests(management_id);

-- Approval History Indexes
CREATE INDEX IF NOT EXISTS idx_approval_history_request_id ON regularization_approval_history(request_id);
CREATE INDEX IF NOT EXISTS idx_approval_history_approver_id ON regularization_approval_history(approver_id);
CREATE INDEX IF NOT EXISTS idx_approval_history_action_timestamp ON regularization_approval_history(action_timestamp);

-- Notifications Indexes
CREATE INDEX IF NOT EXISTS idx_regularization_notifications_request_id ON regularization_notifications(request_id);
CREATE INDEX IF NOT EXISTS idx_regularization_notifications_recipient_id ON regularization_notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_regularization_notifications_sent_at ON regularization_notifications(sent_at);
CREATE INDEX IF NOT EXISTS idx_regularization_notifications_delivery_status ON regularization_notifications(delivery_status);

-- =====================================================
-- 5. TRIGGERS FOR AUTOMATIC UPDATES
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_regularization_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for attendance_regularization_requests
CREATE TRIGGER update_regularization_requests_updated_at 
    BEFORE UPDATE ON attendance_regularization_requests 
    FOR EACH ROW EXECUTE FUNCTION update_regularization_updated_at_column();

-- =====================================================
-- 6. CONSTRAINTS AND VALIDATIONS
-- =====================================================

-- Ensure requested times are valid
ALTER TABLE attendance_regularization_requests 
ADD CONSTRAINT chk_requested_times_valid 
CHECK (requested_end_time > requested_start_time);

-- Ensure status transitions are valid
ALTER TABLE attendance_regularization_requests 
ADD CONSTRAINT chk_status_valid 
CHECK (status IN ('pending', 'group_admin_approved', 'management_approved', 'approved', 'rejected', 'cancelled'));

-- Ensure request type is valid
ALTER TABLE attendance_regularization_requests 
ADD CONSTRAINT chk_request_type_valid 
CHECK (request_type IN ('time_adjustment', 'missing_shift', 'early_departure', 'late_arrival'));

-- Ensure approver role is valid
ALTER TABLE attendance_regularization_requests 
ADD CONSTRAINT chk_approver_role_valid 
CHECK (current_approver_role IN ('group-admin', 'management'));

-- Ensure action is valid in approval history
ALTER TABLE regularization_approval_history 
ADD CONSTRAINT chk_action_valid 
CHECK (action IN ('submitted', 'group_admin_approved', 'group_admin_rejected', 'management_approved', 'management_rejected', 'final_approved', 'final_rejected', 'cancelled'));

-- =====================================================
-- 7. COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE attendance_regularization_requests IS 'Main table for attendance regularization requests with approval workflow';
COMMENT ON TABLE regularization_approval_history IS 'Audit trail for all approval actions on regularization requests';
COMMENT ON TABLE regularization_notifications IS 'Notification tracking for regularization request status updates';

COMMENT ON COLUMN attendance_regularization_requests.request_type IS 'Type of regularization: time_adjustment, missing_shift, early_departure, late_arrival';
COMMENT ON COLUMN attendance_regularization_requests.status IS 'Current status in approval workflow';
COMMENT ON COLUMN attendance_regularization_requests.current_approver_role IS 'Role of the current approver in the workflow';
COMMENT ON COLUMN regularization_approval_history.action IS 'Action taken by the approver';
COMMENT ON COLUMN regularization_notifications.notification_type IS 'Type of notification sent';