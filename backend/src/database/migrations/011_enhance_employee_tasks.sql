-- Migration: Enhance employee_tasks table with customer details and attachments
-- Date: 2024-01-XX
-- Description: Add customer information, attachments, and enhanced priority levels to task management

-- Add new columns to employee_tasks table
ALTER TABLE employee_tasks 
ADD COLUMN IF NOT EXISTS customer_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS customer_contact VARCHAR(255),
ADD COLUMN IF NOT EXISTS customer_notes TEXT,
ADD COLUMN IF NOT EXISTS send_customer_updates BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS customer_contact_type VARCHAR(20) DEFAULT 'email' CHECK (customer_contact_type IN ('email', 'phone'));

-- Create table for task attachments (alternative approach for better normalization)
CREATE TABLE IF NOT EXISTS task_attachments (
    id SERIAL PRIMARY KEY,
    task_id INTEGER NOT NULL REFERENCES employee_tasks(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(100) NOT NULL,
    file_size INTEGER NOT NULL,
    file_data BYTEA NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_employee_tasks_customer_contact ON employee_tasks(customer_contact);
CREATE INDEX IF NOT EXISTS idx_employee_tasks_send_updates ON employee_tasks(send_customer_updates);
CREATE INDEX IF NOT EXISTS idx_task_attachments_task_id ON task_attachments(task_id);

-- Update priority constraint to include 'critical' level
ALTER TABLE employee_tasks 
DROP CONSTRAINT IF EXISTS employee_tasks_priority_check;

ALTER TABLE employee_tasks 
ADD CONSTRAINT employee_tasks_priority_check 
CHECK (priority IN ('low', 'medium', 'high', 'critical'));

-- Add comments for documentation
COMMENT ON COLUMN employee_tasks.customer_name IS 'Name of the customer associated with the task';
COMMENT ON COLUMN employee_tasks.customer_contact IS 'Email or phone number of the customer';
COMMENT ON COLUMN employee_tasks.customer_notes IS 'Additional notes about the customer or task requirements';
COMMENT ON COLUMN employee_tasks.send_customer_updates IS 'Whether to send status updates to the customer';
COMMENT ON COLUMN employee_tasks.attachments IS 'JSON array of attachment metadata (file names, types, sizes)';
COMMENT ON COLUMN employee_tasks.customer_contact_type IS 'Type of customer contact: email or phone';

COMMENT ON TABLE task_attachments IS 'Stores file attachments for tasks in base64 format';
COMMENT ON COLUMN task_attachments.file_data IS 'Base64 encoded file data';
