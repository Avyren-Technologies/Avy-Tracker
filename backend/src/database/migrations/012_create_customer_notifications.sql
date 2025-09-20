-- Migration: Create customer_notifications table
-- Date: 2024-01-XX
-- Description: Track customer notifications sent for task updates

CREATE TABLE IF NOT EXISTS customer_notifications (
    id SERIAL PRIMARY KEY,
    customer_email VARCHAR(255) NOT NULL,
    task_title VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL,
    type VARCHAR(50) NOT NULL,
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_customer_notifications_email ON customer_notifications(customer_email);
CREATE INDEX IF NOT EXISTS idx_customer_notifications_sent_at ON customer_notifications(sent_at);
CREATE INDEX IF NOT EXISTS idx_customer_notifications_type ON customer_notifications(type);

-- Add comments for documentation
COMMENT ON TABLE customer_notifications IS 'Tracks customer notifications sent for task updates';
COMMENT ON COLUMN customer_notifications.customer_email IS 'Email address of the customer who received the notification';
COMMENT ON COLUMN customer_notifications.task_title IS 'Title of the task for which notification was sent';
COMMENT ON COLUMN customer_notifications.status IS 'Status of the task when notification was sent';
COMMENT ON COLUMN customer_notifications.type IS 'Type of notification (status_update, task_assignment, etc.)';
COMMENT ON COLUMN customer_notifications.sent_at IS 'Timestamp when the notification was sent';
