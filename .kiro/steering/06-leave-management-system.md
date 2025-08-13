# Leave Management System

## Leave Management Architecture

### Core Components
- **Leave Application** (`app/(dashboard)/employee/leave-insights/`)
- **Leave Approval** (`app/(dashboard)/Group-Admin/leave-management/`)
- **Leave Routes** (`backend/src/routes/leave.ts`)
- **Leave Balance Tracking** (`leave_balances` table)
- **Leave Policies** (`leave_policies` table)

### Leave Types & Policies
```typescript
interface LeaveType {
  id: number;
  name: string; // EL, SL, ML, CL, etc.
  description: string;
  requires_documentation: boolean;
  max_days: number;
  is_paid: boolean;
  is_active: boolean;
}

interface LeavePolicy {
  id: number;
  leave_type_id: number;
  default_days: number;
  carry_forward_days: number;
  min_service_days: number;
  requires_approval: boolean;
  notice_period_days: number;
  max_consecutive_days: number;
  gender_specific: 'male' | 'female' | null;
}
```

## Employee Leave Application

### Leave Request Process
1. **Leave Type Selection**: Choose from available leave types
2. **Date Selection**: Start and end dates with working day calculation
3. **Reason & Contact**: Leave reason and emergency contact
4. **Document Upload**: Required documents for certain leave types
5. **Balance Validation**: Check available leave balance
6. **Policy Validation**: Ensure compliance with leave policies

### Leave Request Structure
```typescript
interface LeaveRequest {
  id: number;
  user_id: number;
  leave_type_id: number;
  start_date: string;
  end_date: string;
  days_requested: number;
  reason: string;
  contact_number: string;
  status: 'pending' | 'approved' | 'rejected' | 'escalated' | 'cancelled';
  requires_documentation: boolean;
  has_documentation: boolean;
  rejection_reason?: string;
  approver_id?: number;
  group_admin_id?: number;
  created_at: string;
  updated_at: string;
}
```

### Leave Balance Management
```typescript
// Automatic balance initialization for new leave types
const initializeLeaveBalances = async (userId: number, year: number) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Get user's company ID
    const userResult = await client.query(
      'SELECT company_id FROM users WHERE id = $1',
      [userId]
    );
    
    const companyId = userResult.rows[0].company_id;
    
    // Get all active leave types for the company
    const leaveTypesResult = await client.query(`
      SELECT 
        lt.id,
        lt.name,
        COALESCE(lp.default_days, lt.max_days) as default_days
      FROM leave_types lt
      LEFT JOIN leave_policies lp ON lt.id = lp.leave_type_id
      WHERE lt.is_active = true
      AND (lt.company_id IS NULL OR lt.company_id = $1)
    `, [companyId]);
    
    // Initialize balances for each leave type
    for (const leaveType of leaveTypesResult.rows) {
      await client.query(`
        INSERT INTO leave_balances (
          user_id, leave_type_id, total_days, used_days, 
          pending_days, year, created_at, updated_at
        ) VALUES ($1, $2, $3, 0, 0, $4, NOW(), NOW())
        ON CONFLICT (user_id, leave_type_id, year) DO NOTHING
      `, [userId, leaveType.id, leaveType.default_days, year]);
    }
    
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
```

### Leave Validation System
```typescript
const validateLeaveRequest = async (
  userId: number,
  leaveTypeId: number,
  startDate: Date,
  endDate: Date,
  daysRequested: number
) => {
  const client = await pool.connect();
  
  try {
    // Get leave type and policy details
    const leaveTypeResult = await client.query(`
      SELECT 
        lt.*,
        lp.notice_period_days,
        lp.max_consecutive_days,
        lp.gender_specific,
        lb.total_days,
        lb.used_days,
        lb.pending_days,
        lb.carry_forward_days,
        u.gender
      FROM leave_types lt
      LEFT JOIN leave_policies lp ON lt.id = lp.leave_type_id
      LEFT JOIN leave_balances lb ON lt.id = lb.leave_type_id 
        AND lb.user_id = $1 
        AND lb.year = EXTRACT(YEAR FROM CURRENT_DATE)
      LEFT JOIN users u ON u.id = $1
      WHERE lt.id = $2
    `, [userId, leaveTypeId]);
    
    if (!leaveTypeResult.rows.length) {
      throw new Error('Invalid leave type');
    }
    
    const leaveData = leaveTypeResult.rows[0];
    
    // Gender-specific validation
    if (leaveData.gender_specific && leaveData.gender_specific !== leaveData.gender) {
      throw new Error(`This leave type is only available for ${leaveData.gender_specific} employees`);
    }
    
    // Balance validation
    const totalAvailable = (leaveData.total_days || 0) + (leaveData.carry_forward_days || 0);
    const usedAndPending = (leaveData.used_days || 0) + (leaveData.pending_days || 0);
    const availableDays = totalAvailable - usedAndPending;
    
    if (availableDays < daysRequested) {
      throw new Error(`Insufficient leave balance. Available: ${availableDays}, Requested: ${daysRequested}`);
    }
    
    // Consecutive days validation
    const maxConsecutive = leaveData.max_consecutive_days || leaveData.max_days;
    if (daysRequested > maxConsecutive) {
      throw new Error(`Maximum consecutive days exceeded. Max allowed: ${maxConsecutive}`);
    }
    
    // Notice period validation
    const today = new Date();
    const noticeDays = Math.ceil((startDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (noticeDays < (leaveData.notice_period_days || 0)) {
      throw new Error(`Notice period requirement not met. Required: ${leaveData.notice_period_days} days`);
    }
    
    return { valid: true, availableDays };
    
  } finally {
    client.release();
  }
};
```

## Leave Approval Workflow

### Group Admin Approval Process
```typescript
const processLeaveApproval = async (
  requestId: number,
  approved: boolean,
  rejectionReason?: string,
  approverId?: number
) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Get leave request details
    const requestResult = await client.query(`
      SELECT lr.*, lt.name as leave_type_name, u.name as employee_name
      FROM leave_requests lr
      JOIN leave_types lt ON lr.leave_type_id = lt.id
      JOIN users u ON lr.user_id = u.id
      WHERE lr.id = $1
    `, [requestId]);
    
    if (!requestResult.rows.length) {
      throw new Error('Leave request not found');
    }
    
    const request = requestResult.rows[0];
    
    if (request.status !== 'pending') {
      throw new Error('Leave request is not in pending status');
    }
    
    // Update request status
    await client.query(`
      UPDATE leave_requests 
      SET status = $1, rejection_reason = $2, approver_id = $3, updated_at = NOW()
      WHERE id = $4
    `, [approved ? 'approved' : 'rejected', rejectionReason, approverId, requestId]);
    
    // Update leave balance
    if (approved) {
      // Move days from pending to used
      await client.query(`
        UPDATE leave_balances 
        SET used_days = used_days + $1, 
            pending_days = pending_days - $1,
            updated_at = NOW()
        WHERE user_id = $2 AND leave_type_id = $3 
        AND year = EXTRACT(YEAR FROM $4::date)
      `, [request.days_requested, request.user_id, request.leave_type_id, request.start_date]);
    } else {
      // Remove days from pending (return to available)
      await client.query(`
        UPDATE leave_balances 
        SET pending_days = pending_days - $1,
            updated_at = NOW()
        WHERE user_id = $2 AND leave_type_id = $3 
        AND year = EXTRACT(YEAR FROM $4::date)
      `, [request.days_requested, request.user_id, request.leave_type_id, request.start_date]);
    }
    
    // Send notification to employee
    await sendLeaveNotification(request, approved, rejectionReason);
    
    await client.query('COMMIT');
    return { success: true, status: approved ? 'approved' : 'rejected' };
    
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
```

### Leave Escalation System
```typescript
const escalateLeaveRequest = async (
  requestId: number,
  escalatedBy: number,
  escalatedTo: number,
  reason: string
) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Update leave request status to escalated
    await client.query(`
      UPDATE leave_requests 
      SET status = 'escalated', updated_at = NOW()
      WHERE id = $1
    `, [requestId]);
    
    // Create escalation record
    await client.query(`
      INSERT INTO leave_escalations (
        request_id, escalated_by, escalated_to, reason, created_at
      ) VALUES ($1, $2, $3, $4, NOW())
    `, [requestId, escalatedBy, escalatedTo, reason]);
    
    // Notify management about escalation
    await sendEscalationNotification(requestId, escalatedTo, reason);
    
    await client.query('COMMIT');
    
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
```

## Database Schema

### Leave Management Tables
```sql
-- Leave types configuration
CREATE TABLE leave_types (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  requires_documentation BOOLEAN DEFAULT false,
  max_days INTEGER,
  is_paid BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  company_id INTEGER REFERENCES companies(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Leave policies per company
CREATE TABLE leave_policies (
  id SERIAL PRIMARY KEY,
  leave_type_id INTEGER REFERENCES leave_types(id),
  default_days INTEGER NOT NULL,
  carry_forward_days INTEGER DEFAULT 0,
  min_service_days INTEGER DEFAULT 0,
  requires_approval BOOLEAN DEFAULT true,
  notice_period_days INTEGER DEFAULT 0,
  max_consecutive_days INTEGER,
  gender_specific VARCHAR(10) CHECK (gender_specific IN ('male', 'female')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Employee leave balances
CREATE TABLE leave_balances (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  leave_type_id INTEGER REFERENCES leave_types(id),
  total_days INTEGER NOT NULL,
  used_days INTEGER DEFAULT 0,
  pending_days INTEGER DEFAULT 0,
  carry_forward_days INTEGER DEFAULT 0,
  year INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, leave_type_id, year)
);

-- Leave requests
CREATE TABLE leave_requests (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  leave_type_id INTEGER REFERENCES leave_types(id),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days_requested INTEGER NOT NULL,
  reason TEXT NOT NULL,
  contact_number VARCHAR(20) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'escalated', 'cancelled')),
  requires_documentation BOOLEAN DEFAULT false,
  has_documentation BOOLEAN DEFAULT false,
  rejection_reason TEXT,
  approver_id INTEGER REFERENCES users(id),
  group_admin_id INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Leave document attachments
CREATE TABLE leave_documents (
  id SERIAL PRIMARY KEY,
  request_id INTEGER REFERENCES leave_requests(id),
  file_name VARCHAR(255) NOT NULL,
  file_type VARCHAR(100) NOT NULL,
  file_data TEXT NOT NULL, -- Base64 encoded
  upload_method VARCHAR(20) CHECK (upload_method IN ('camera', 'file')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Leave escalations
CREATE TABLE leave_escalations (
  id SERIAL PRIMARY KEY,
  request_id INTEGER NOT NULL REFERENCES leave_requests(id),
  escalated_by INTEGER NOT NULL REFERENCES users(id),
  escalated_to INTEGER NOT NULL REFERENCES users(id),
  reason TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'resolved')),
  resolution_notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP
);
```

## Leave Analytics & Reporting

### Team Leave Calendar
```typescript
const getTeamLeaveCalendar = async (companyId: number, startDate: string, endDate: string) => {
  const result = await pool.query(`
    SELECT 
      lr.id,
      lr.user_id,
      u.name as employee_name,
      lt.name as leave_type,
      lr.start_date,
      lr.end_date,
      lr.status,
      lt.is_paid
    FROM leave_requests lr
    JOIN users u ON lr.user_id = u.id
    JOIN leave_types lt ON lr.leave_type_id = lt.id
    WHERE u.company_id = $1 
      AND lr.start_date >= $2 
      AND lr.end_date <= $3
      AND lr.status IN ('pending', 'approved')
    ORDER BY lr.start_date ASC
  `, [companyId, startDate, endDate]);
  
  return result.rows;
};
```

### Leave Balance Summary
```typescript
const getLeaveBalanceSummary = async (userId: number, year: number) => {
  const result = await pool.query(`
    SELECT 
      lb.id,
      lt.id as leave_type_id,
      lt.name,
      lt.is_paid,
      lb.total_days,
      lb.used_days,
      lb.pending_days,
      lb.carry_forward_days,
      (lb.total_days + COALESCE(lb.carry_forward_days, 0) - lb.used_days - lb.pending_days) as available_days
    FROM leave_balances lb
    JOIN leave_types lt ON lb.leave_type_id = lt.id
    WHERE lb.user_id = $1 AND lb.year = $2 
    AND lt.is_active = true
    ORDER BY lt.name
  `, [userId, year]);
  
  return result.rows;
};
```

## Working Days Calculation
```typescript
// Calculate working days excluding weekends and holidays
const calculateWorkingDays = (startDate: Date, endDate: Date, holidays: Date[] = []) => {
  let days = 0;
  const current = new Date(startDate);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);
  
  while (current <= end) {
    const dayOfWeek = current.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6; // Sunday or Saturday
    const isHoliday = holidays.some(holiday => 
      holiday.toDateString() === current.toDateString()
    );
    
    if (!isWeekend && !isHoliday) {
      days++;
    }
    
    current.setDate(current.getDate() + 1);
  }
  
  return days;
};
```

This leave management system provides comprehensive leave tracking with policy enforcement, approval workflows, and balance management.