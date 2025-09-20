-- Migration: Create task comments and activity history tables
-- Date: 2024-01-XX
-- Description: Add comprehensive task tracking with comments and activity history

-- =====================================================
-- 1. TASK COMMENTS TABLE
-- =====================================================
-- Table for storing comments between group admins and employees
CREATE TABLE IF NOT EXISTS task_comments (
    id SERIAL PRIMARY KEY,
    task_id INTEGER NOT NULL REFERENCES employee_tasks(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    comment TEXT NOT NULL,
    comment_type VARCHAR(50) DEFAULT 'general' CHECK (comment_type IN ('general', 'status_update', 'priority_change', 'assignment', 'note')),
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Soft delete
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by INTEGER REFERENCES users(id) ON DELETE SET NULL
);

-- =====================================================
-- 2. TASK ACTIVITY HISTORY TABLE
-- =====================================================
-- Table for tracking all task-related activities
CREATE TABLE IF NOT EXISTS task_activity_history (
    id SERIAL PRIMARY KEY,
    task_id INTEGER NOT NULL REFERENCES employee_tasks(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL, -- NULL for system-generated activities
    
    -- Activity Details
    activity_type VARCHAR(50) NOT NULL CHECK (activity_type IN (
        'task_created', 'task_assigned', 'task_reassigned', 'status_changed', 
        'priority_changed', 'due_date_changed', 'comment_added', 'attachment_added',
        'attachment_removed', 'customer_updated', 'task_completed', 'task_cancelled'
    )),
    activity_description TEXT NOT NULL,
    
    -- Change Details (for tracking what changed)
    old_value TEXT,
    new_value TEXT,
    change_details JSONB DEFAULT '{}'::jsonb,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ip_address INET,
    user_agent TEXT
);

-- =====================================================
-- 3. TASK NOTIFICATIONS TABLE
-- =====================================================
-- Table for tracking push notifications sent for task updates
CREATE TABLE IF NOT EXISTS task_notifications (
    id SERIAL PRIMARY KEY,
    task_id INTEGER NOT NULL REFERENCES employee_tasks(id) ON DELETE CASCADE,
    recipient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    notification_type VARCHAR(50) NOT NULL CHECK (notification_type IN (
        'task_assigned', 'task_reassigned', 'status_update', 'comment_added',
        'due_date_reminder', 'overdue_task', 'priority_changed', 'attachment_added'
    )),
    
    -- Notification Content
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    notification_data JSONB DEFAULT '{}'::jsonb,
    
    -- Delivery Status
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMP WITH TIME ZONE,
    delivery_status VARCHAR(20) DEFAULT 'sent' CHECK (delivery_status IN ('sent', 'delivered', 'failed', 'read')),
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 4. INDEXES FOR PERFORMANCE
-- =====================================================

-- Task Comments Indexes
CREATE INDEX IF NOT EXISTS idx_task_comments_task_id ON task_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_user_id ON task_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_created_at ON task_comments(created_at);
CREATE INDEX IF NOT EXISTS idx_task_comments_comment_type ON task_comments(comment_type);
CREATE INDEX IF NOT EXISTS idx_task_comments_is_deleted ON task_comments(is_deleted);

-- Task Activity History Indexes
CREATE INDEX IF NOT EXISTS idx_task_activity_task_id ON task_activity_history(task_id);
CREATE INDEX IF NOT EXISTS idx_task_activity_user_id ON task_activity_history(user_id);
CREATE INDEX IF NOT EXISTS idx_task_activity_type ON task_activity_history(activity_type);
CREATE INDEX IF NOT EXISTS idx_task_activity_created_at ON task_activity_history(created_at);

-- Task Notifications Indexes
CREATE INDEX IF NOT EXISTS idx_task_notifications_task_id ON task_notifications(task_id);
CREATE INDEX IF NOT EXISTS idx_task_notifications_recipient_id ON task_notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_task_notifications_type ON task_notifications(notification_type);
CREATE INDEX IF NOT EXISTS idx_task_notifications_sent_at ON task_notifications(sent_at);
CREATE INDEX IF NOT EXISTS idx_task_notifications_delivery_status ON task_notifications(delivery_status);

-- =====================================================
-- 5. TRIGGERS FOR AUTOMATIC ACTIVITY TRACKING
-- =====================================================

-- Function to automatically log task activities
CREATE OR REPLACE FUNCTION log_task_activity()
RETURNS TRIGGER AS $$
DECLARE
    activity_desc TEXT;
    old_val TEXT;
    new_val TEXT;
BEGIN
    -- Determine activity type and description based on what changed
    IF TG_OP = 'INSERT' THEN
        activity_desc := 'Task created: ' || NEW.title;
        INSERT INTO task_activity_history (task_id, user_id, activity_type, activity_description, new_value)
        VALUES (NEW.id, NEW.assigned_by, 'task_created', activity_desc, NEW.title);
        
    ELSIF TG_OP = 'UPDATE' THEN
        -- Status change
        IF OLD.status IS DISTINCT FROM NEW.status THEN
            activity_desc := 'Status changed from ' || OLD.status || ' to ' || NEW.status;
            INSERT INTO task_activity_history (task_id, user_id, activity_type, activity_description, old_value, new_value)
            VALUES (NEW.id, NEW.assigned_by, 'status_changed', activity_desc, OLD.status, NEW.status);
        END IF;
        
        -- Priority change
        IF OLD.priority IS DISTINCT FROM NEW.priority THEN
            activity_desc := 'Priority changed from ' || OLD.priority || ' to ' || NEW.priority;
            INSERT INTO task_activity_history (task_id, user_id, activity_type, activity_description, old_value, new_value)
            VALUES (NEW.id, NEW.assigned_by, 'priority_changed', activity_desc, OLD.priority, NEW.priority);
        END IF;
        
        -- Assignment change
        IF OLD.assigned_to IS DISTINCT FROM NEW.assigned_to THEN
            activity_desc := 'Task reassigned';
            INSERT INTO task_activity_history (task_id, user_id, activity_type, activity_description, old_value, new_value)
            VALUES (NEW.id, NEW.assigned_by, 'task_reassigned', activity_desc, OLD.assigned_to::text, NEW.assigned_to::text);
        END IF;
        
        -- Due date change
        IF OLD.due_date IS DISTINCT FROM NEW.due_date THEN
            activity_desc := 'Due date updated';
            INSERT INTO task_activity_history (task_id, user_id, activity_type, activity_description, old_value, new_value)
            VALUES (NEW.id, NEW.assigned_by, 'due_date_changed', activity_desc, 
                   COALESCE(OLD.due_date::text, 'Not set'), 
                   COALESCE(NEW.due_date::text, 'Not set'));
        END IF;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic activity logging
CREATE TRIGGER task_activity_trigger
    AFTER INSERT OR UPDATE ON employee_tasks
    FOR EACH ROW
    EXECUTE FUNCTION log_task_activity();

-- =====================================================
-- 6. COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE task_comments IS 'Stores comments and notes between group admins and employees for tasks';
COMMENT ON COLUMN task_comments.comment_type IS 'Type of comment: general, status_update, priority_change, assignment, note';
COMMENT ON COLUMN task_comments.is_deleted IS 'Soft delete flag for comments';

COMMENT ON TABLE task_activity_history IS 'Tracks all activities and changes made to tasks';
COMMENT ON COLUMN task_activity_history.activity_type IS 'Type of activity performed on the task';
COMMENT ON COLUMN task_activity_history.change_details IS 'Additional details about the change in JSON format';

COMMENT ON TABLE task_notifications IS 'Tracks push notifications sent for task-related events';
COMMENT ON COLUMN task_notifications.notification_type IS 'Type of notification sent';
COMMENT ON COLUMN task_notifications.delivery_status IS 'Status of notification delivery';

-- =====================================================
-- 7. CLEANUP FUNCTIONS
-- =====================================================

-- Function to clean up old activity history (keep last 6 months)
CREATE OR REPLACE FUNCTION cleanup_old_task_activity()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM task_activity_history 
    WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '6 months';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up old notifications (keep last 3 months)
CREATE OR REPLACE FUNCTION cleanup_old_task_notifications()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM task_notifications 
    WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '3 months';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;
