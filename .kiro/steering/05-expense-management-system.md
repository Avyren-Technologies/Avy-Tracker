# Expense Management System

## Expense Workflow Architecture

### Core Components
- **Expense Submission** (`app/(dashboard)/employee/employeeExpenses.tsx`)
- **Expense Approval** (`app/(dashboard)/Group-Admin/expense-management/`)
- **Expense Routes** (`backend/src/routes/expenses.ts`)
- **Document Management** (`expense_documents` table)
- **Notification Integration** (approval/rejection notifications)

### Expense Categories
```typescript
interface ExpenseCategories {
  travel: {
    vehicle_type: string;
    vehicle_number: string;
    total_kilometers: number;
    diesel: number;
    toll_charges: number;
  };
  accommodation: {
    lodging_expenses: number;
  };
  meals: {
    daily_allowance: number;
  };
  miscellaneous: {
    other_expenses: number;
  };
  advance: {
    advance_taken: number;
  };
}
```

## Employee Expense Submission

### Multi-Step Submission Process
1. **Employee Details**: Name, number, department, designation
2. **Travel Details**: Vehicle info, route, distance, time
3. **Expense Categories**: Lodging, meals, fuel, tolls, miscellaneous
4. **Receipt Upload**: Images and PDF documents
5. **Review & Submit**: Final review before submission

### Expense Form Structure
```typescript
interface ExpenseSubmission {
  // Employee Information
  employeeName: string;
  employeeNumber: string;
  department: string;
  designation: string;
  location: string;
  date: string;
  
  // Travel Details
  vehicleType: string;
  vehicleNumber: string;
  totalKilometers: number;
  startDateTime: string;
  endDateTime: string;
  routeTaken: string;
  
  // Expense Amounts
  lodgingExpenses: number;
  dailyAllowance: number;
  diesel: number;
  tollCharges: number;
  otherExpenses: number;
  advanceTaken: number;
  
  // Calculated Fields
  totalAmount: number;
  amountPayable: number;
  
  // Documents
  documents: File[];
}
```

### Shift Integration
```typescript
// Expense submission with shift validation
const submitExpense = async (expenseData: ExpenseSubmission) => {
  // Check for active shift (unless user has anytime submission permission)
  const activeShift = await getActiveShift(userId);
  
  if (!activeShift && !user.can_submit_expenses_anytime) {
    throw new Error('No active shift found - cannot submit expenses');
  }
  
  // Update shift totals when expense is submitted
  if (activeShift) {
    await updateShiftTotals(activeShift.id, {
      total_expenses: activeShift.total_expenses + expenseData.totalAmount,
      total_kilometers: activeShift.total_kilometers + expenseData.totalKilometers
    });
  }
  
  return await createExpenseRecord(expenseData, activeShift?.id);
};
```

### Document Upload System
```typescript
// Multer configuration for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept images and PDFs only
    if (!file.originalname.match(/\.(jpg|jpeg|png|pdf)$/)) {
      return cb(new Error("Only image and PDF files are allowed!"));
    }
    cb(null, true);
  },
});

// Document storage in database
const storeDocument = async (expenseId: number, file: Express.Multer.File) => {
  await pool.query(`
    INSERT INTO expense_documents (
      expense_id, file_name, file_type, file_size, file_data
    ) VALUES ($1, $2, $3, $4, $5)
  `, [expenseId, file.originalname, file.mimetype, file.size, file.buffer]);
};
```

## Approval Workflow

### Group Admin Approval Process
```typescript
// Expense approval/rejection
const processExpenseApproval = async (
  expenseId: number, 
  approved: boolean, 
  comments?: string
) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Update expense status
    const result = await client.query(`
      UPDATE expenses 
      SET status = $1, comments = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $3 AND EXISTS (
        SELECT 1 FROM users 
        WHERE id = expenses.user_id 
        AND group_admin_id = $4
      )
      RETURNING *
    `, [approved ? 'approved' : 'rejected', comments, expenseId, groupAdminId]);
    
    if (result.rows.length === 0) {
      throw new Error('Expense not found or access denied');
    }
    
    // Send notification to employee
    await sendExpenseNotification(result.rows[0], approved, comments);
    
    await client.query('COMMIT');
    return result.rows[0];
    
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
```

### Notification System Integration
```typescript
const sendExpenseNotification = async (
  expense: ExpenseRecord,
  approved: boolean,
  comments?: string
) => {
  const title = approved ? "💰 Expense Report Approved" : "❌ Expense Report Rejected";
  
  const formattedAmount = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(expense.total_amount);
  
  const message = `Your expense report has been ${approved ? "APPROVED ✨" : "REJECTED ⚠️"}\n` +
    `📊 EXPENSE DETAILS\n` +
    `━━━━━━━━━━━━━━━\n` +
    `💵 Amount: ${formattedAmount}\n` +
    `🗓️ Date: ${new Date(expense.date).toLocaleDateString()}\n` +
    `🚗 Distance: ${expense.total_kilometers}km\n` +
    `📍 Route: ${expense.route_taken}\n` +
    (comments ? `📝 Comments: ${comments}\n` : '') +
    `━━━━━━━━━━━━━━━`;
  
  // Send push notification
  await NotificationService.sendPushNotification({
    user_id: expense.user_id,
    title,
    message,
    type: "expense-status",
    priority: "high",
    data: {
      screen: "/(dashboard)/employee/myExpenses",
      expenseId: expense.id,
      status: approved ? "approved" : "rejected"
    }
  });
};
```

## Database Schema

### Expenses Table
```sql
CREATE TABLE expenses (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  company_id INTEGER REFERENCES companies(id),
  shift_id INTEGER REFERENCES employee_shifts(id),
  
  -- Employee Information
  employee_name VARCHAR(100),
  employee_number VARCHAR(50),
  department VARCHAR(100),
  designation VARCHAR(100),
  location VARCHAR(100),
  date TIMESTAMP,
  
  -- Travel Details
  vehicle_type VARCHAR(50),
  vehicle_number VARCHAR(50),
  total_kilometers NUMERIC,
  start_time TIMESTAMP,
  end_time TIMESTAMP,
  route_taken TEXT,
  
  -- Expense Amounts
  lodging_expenses NUMERIC DEFAULT 0,
  daily_allowance NUMERIC DEFAULT 0,
  diesel NUMERIC DEFAULT 0,
  toll_charges NUMERIC DEFAULT 0,
  other_expenses NUMERIC DEFAULT 0,
  advance_taken NUMERIC DEFAULT 0,
  total_amount NUMERIC,
  amount_payable NUMERIC,
  
  -- Approval Workflow
  status VARCHAR(20) DEFAULT 'pending',
  comments TEXT,
  group_admin_id INTEGER REFERENCES users(id),
  rejection_reason TEXT,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Document Storage
```sql
CREATE TABLE expense_documents (
  id SERIAL PRIMARY KEY,
  expense_id INTEGER REFERENCES expenses(id),
  file_name VARCHAR(255) NOT NULL,
  file_type VARCHAR(100) NOT NULL,
  file_size INTEGER NOT NULL,
  file_data BYTEA NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Analytics & Reporting

### Group Admin Analytics
```typescript
// Expense summary for group admin dashboard
const getExpenseSummary = async (groupAdminId: number) => {
  const result = await pool.query(`
    WITH employee_expenses AS (
      SELECT e.*
      FROM expenses e
      JOIN users u ON e.user_id = u.id
      WHERE u.group_admin_id = $1
    )
    SELECT 
      CAST(COALESCE(SUM(total_amount), 0) AS FLOAT) as total_amount,
      COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
      COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_count,
      COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_count
    FROM employee_expenses
  `, [groupAdminId]);
  
  return result.rows[0];
};
```

### Employee Expense Analytics
```typescript
// Employee expense breakdown by category
const getEmployeeExpenseBreakdown = async (groupAdminId: number) => {
  const result = await pool.query(`
    SELECT 
      u.name as employee_name,
      CAST(COALESCE(SUM(e.total_amount), 0) AS FLOAT) as total_expenses,
      COUNT(CASE WHEN e.status = 'approved' THEN 1 END) as approved_count,
      COUNT(CASE WHEN e.status = 'rejected' THEN 1 END) as rejected_count,
      CAST(COALESCE(SUM(e.diesel), 0) AS FLOAT) as fuel_expenses,
      CAST(COALESCE(SUM(e.lodging_expenses), 0) AS FLOAT) as lodging_expenses,
      CAST(COALESCE(SUM(e.daily_allowance), 0) AS FLOAT) as meal_expenses
    FROM users u
    LEFT JOIN expenses e ON e.user_id = u.id
    WHERE u.group_admin_id = $1 AND u.role = 'employee'
    GROUP BY u.id, u.name
    ORDER BY total_expenses DESC
  `, [groupAdminId]);
  
  return result.rows;
};
```

## Security & Validation

### Access Control
```typescript
// Ensure users can only access their own expenses or those they manage
const validateExpenseAccess = (userRole: string, userId: number, expense: ExpenseRecord) => {
  switch (userRole) {
    case 'employee':
      return expense.user_id === userId;
    case 'group-admin':
      return expense.group_admin_id === userId;
    case 'management':
    case 'super-admin':
      return true; // Full access
    default:
      return false;
  }
};
```

### Data Validation
```typescript
// Validate expense submission data
const validateExpenseData = (data: ExpenseSubmission) => {
  const errors: string[] = [];
  
  if (!data.employeeName) errors.push('Employee name is required');
  if (!data.totalKilometers || data.totalKilometers < 0) errors.push('Valid kilometers required');
  if (!data.totalAmount || data.totalAmount < 0) errors.push('Valid total amount required');
  if (!data.date) errors.push('Date is required');
  
  // Validate that amount payable is calculated correctly
  const calculatedPayable = data.totalAmount - (data.advanceTaken || 0);
  if (Math.abs(data.amountPayable - calculatedPayable) > 0.01) {
    errors.push('Amount payable calculation is incorrect');
  }
  
  return errors;
};
```

This expense management system provides comprehensive expense tracking with proper approval workflows, document management, and analytics capabilities.