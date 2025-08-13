# Analytics & Reporting System

## Analytics Architecture

### Core Components
- **Tracking Analytics** (`tracking_analytics` table)
- **PDF Report Generation** (`backend/src/routes/pdf-reports.ts`)
- **Dashboard Analytics** (role-specific analytics endpoints)
- **Chart Components** (`react-native-chart-kit`)
- **Real-time Metrics** (Socket.IO integration)

### Analytics Data Types
```typescript
interface AnalyticsMetrics {
  // Location & Travel Analytics
  travel: {
    total_distance_km: number;
    total_travel_time_minutes: number;
    average_speed: number;
    route_efficiency: number;
    fuel_consumption_estimate: number;
  };
  
  // Attendance Analytics
  attendance: {
    total_shifts: number;
    total_hours_worked: number;
    average_shift_duration: number;
    punctuality_score: number;
    attendance_rate: number;
  };
  
  // Expense Analytics
  expenses: {
    total_expenses: number;
    average_expense_per_shift: number;
    expense_by_category: Record<string, number>;
    approval_rate: number;
    reimbursement_pending: number;
  };
  
  // Leave Analytics
  leave: {
    total_leave_days: number;
    leave_balance_utilization: number;
    leave_by_type: Record<string, number>;
    leave_approval_rate: number;
    leave_patterns: any[];
  };
  
  // Performance Analytics
  performance: {
    task_completion_rate: number;
    average_task_duration: number;
    productivity_score: number;
    goal_achievement_rate: number;
  };
}
```

## Employee Analytics Dashboard

### Personal Performance Metrics
```typescript
// Employee dashboard analytics
const getEmployeeAnalytics = async (userId: number, dateRange: DateRange) => {
  const client = await pool.connect();
  
  try {
    // Travel analytics
    const travelAnalytics = await client.query(`
      SELECT 
        COALESCE(SUM(total_distance_km), 0) as total_distance,
        COALESCE(SUM(total_travel_time_minutes), 0) as total_travel_time,
        COALESCE(AVG(total_distance_km), 0) as avg_distance_per_day,
        COUNT(DISTINCT date) as active_days
      FROM tracking_analytics
      WHERE user_id = $1 
      AND date BETWEEN $2 AND $3
    `, [userId, dateRange.start, dateRange.end]);
    
    // Shift analytics
    const shiftAnalytics = await client.query(`
      SELECT 
        COUNT(*) as total_shifts,
        COALESCE(SUM(EXTRACT(EPOCH FROM duration) / 3600), 0) as total_hours,
        COALESCE(AVG(EXTRACT(EPOCH FROM duration) / 3600), 0) as avg_hours_per_shift,
        COALESCE(SUM(total_expenses), 0) as total_expenses,
        COALESCE(SUM(total_kilometers), 0) as total_kilometers
      FROM employee_shifts
      WHERE user_id = $1 
      AND start_time BETWEEN $2 AND $3
      AND status = 'completed'
    `, [userId, dateRange.start, dateRange.end]);
    
    // Expense analytics
    const expenseAnalytics = await client.query(`
      SELECT 
        COUNT(*) as total_submissions,
        COALESCE(SUM(total_amount), 0) as total_amount,
        COALESCE(SUM(CASE WHEN status = 'approved' THEN total_amount ELSE 0 END), 0) as approved_amount,
        COALESCE(SUM(diesel), 0) as fuel_expenses,
        COALESCE(SUM(lodging_expenses), 0) as lodging_expenses,
        COALESCE(SUM(daily_allowance), 0) as meal_expenses,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_count,
        COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_count
      FROM expenses
      WHERE user_id = $1 
      AND date BETWEEN $2 AND $3
    `, [userId, dateRange.start, dateRange.end]);
    
    // Leave analytics
    const leaveAnalytics = await client.query(`
      SELECT 
        COALESCE(SUM(days_requested), 0) as total_leave_days,
        COUNT(*) as total_requests,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_requests,
        COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_requests
      FROM leave_requests
      WHERE user_id = $1 
      AND start_date BETWEEN $2 AND $3
    `, [userId, dateRange.start, dateRange.end]);
    
    return {
      travel: travelAnalytics.rows[0],
      shifts: shiftAnalytics.rows[0],
      expenses: expenseAnalytics.rows[0],
      leave: leaveAnalytics.rows[0]
    };
    
  } finally {
    client.release();
  }
};
```

### Performance Scoring System
```typescript
// Calculate employee performance score
const calculatePerformanceScore = (analytics: EmployeeAnalytics) => {
  let score = 0;
  let maxScore = 0;
  
  // Attendance score (30% weight)
  const attendanceScore = Math.min(analytics.shifts.total_shifts / 22, 1) * 30; // Assuming 22 working days
  score += attendanceScore;
  maxScore += 30;
  
  // Punctuality score (20% weight)
  const punctualityScore = analytics.attendance.punctuality_score * 20;
  score += punctualityScore;
  maxScore += 20;
  
  // Expense efficiency score (20% weight)
  const avgExpensePerKm = analytics.expenses.total_amount / Math.max(analytics.travel.total_distance, 1);
  const expenseEfficiencyScore = Math.max(0, (50 - avgExpensePerKm) / 50) * 20; // Assuming ₹50/km as benchmark
  score += expenseEfficiencyScore;
  maxScore += 20;
  
  // Task completion score (30% weight)
  const taskScore = analytics.performance.task_completion_rate * 30;
  score += taskScore;
  maxScore += 30;
  
  return {
    totalScore: Math.round((score / maxScore) * 100),
    breakdown: {
      attendance: Math.round(attendanceScore),
      punctuality: Math.round(punctualityScore),
      expenseEfficiency: Math.round(expenseEfficiencyScore),
      taskCompletion: Math.round(taskScore)
    }
  };
};
```

## Group Admin Analytics

### Team Performance Dashboard
```typescript
// Group admin team analytics
const getTeamAnalytics = async (groupAdminId: number, dateRange: DateRange) => {
  const client = await pool.connect();
  
  try {
    // Team overview
    const teamOverview = await client.query(`
      SELECT 
        COUNT(DISTINCT u.id) as total_employees,
        COUNT(DISTINCT es.id) as total_shifts,
        COALESCE(SUM(es.total_expenses), 0) as total_team_expenses,
        COALESCE(SUM(es.total_kilometers), 0) as total_team_distance,
        COALESCE(AVG(EXTRACT(EPOCH FROM es.duration) / 3600), 0) as avg_shift_hours
      FROM users u
      LEFT JOIN employee_shifts es ON u.id = es.user_id 
        AND es.start_time BETWEEN $2 AND $3
      WHERE u.group_admin_id = $1 AND u.role = 'employee'
    `, [groupAdminId, dateRange.start, dateRange.end]);
    
    // Individual employee performance
    const employeePerformance = await client.query(`
      SELECT 
        u.id,
        u.name,
        u.employee_number,
        COUNT(DISTINCT es.id) as shifts_completed,
        COALESCE(SUM(es.total_expenses), 0) as total_expenses,
        COALESCE(SUM(es.total_kilometers), 0) as total_distance,
        COALESCE(AVG(EXTRACT(EPOCH FROM es.duration) / 3600), 0) as avg_shift_hours,
        COUNT(CASE WHEN e.status = 'approved' THEN 1 END) as approved_expenses,
        COUNT(CASE WHEN e.status = 'rejected' THEN 1 END) as rejected_expenses,
        COUNT(CASE WHEN lr.status = 'approved' THEN 1 END) as approved_leaves
      FROM users u
      LEFT JOIN employee_shifts es ON u.id = es.user_id 
        AND es.start_time BETWEEN $2 AND $3
      LEFT JOIN expenses e ON u.id = e.user_id 
        AND e.date BETWEEN $2 AND $3
      LEFT JOIN leave_requests lr ON u.id = lr.user_id 
        AND lr.start_date BETWEEN $2 AND $3
      WHERE u.group_admin_id = $1 AND u.role = 'employee'
      GROUP BY u.id, u.name, u.employee_number
      ORDER BY shifts_completed DESC
    `, [groupAdminId, dateRange.start, dateRange.end]);
    
    // Expense approval analytics
    const expenseApprovalAnalytics = await client.query(`
      SELECT 
        COUNT(*) as total_submissions,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_approvals,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_count,
        COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_count,
        COALESCE(SUM(total_amount), 0) as total_amount,
        COALESCE(SUM(CASE WHEN status = 'approved' THEN total_amount ELSE 0 END), 0) as approved_amount
      FROM expenses e
      JOIN users u ON e.user_id = u.id
      WHERE u.group_admin_id = $1 
      AND e.date BETWEEN $2 AND $3
    `, [groupAdminId, dateRange.start, dateRange.end]);
    
    return {
      overview: teamOverview.rows[0],
      employees: employeePerformance.rows,
      expenses: expenseApprovalAnalytics.rows[0]
    };
    
  } finally {
    client.release();
  }
};
```

### Attendance Patterns Analysis
```typescript
// Analyze team attendance patterns
const analyzeAttendancePatterns = async (groupAdminId: number, dateRange: DateRange) => {
  const client = await pool.connect();
  
  try {
    // Daily attendance patterns
    const dailyPatterns = await client.query(`
      SELECT 
        DATE(es.start_time) as date,
        COUNT(DISTINCT es.user_id) as employees_present,
        COUNT(DISTINCT u.id) as total_employees,
        ROUND(COUNT(DISTINCT es.user_id) * 100.0 / COUNT(DISTINCT u.id), 2) as attendance_rate
      FROM users u
      LEFT JOIN employee_shifts es ON u.id = es.user_id 
        AND DATE(es.start_time) BETWEEN $2 AND $3
      WHERE u.group_admin_id = $1 AND u.role = 'employee'
      GROUP BY DATE(es.start_time)
      ORDER BY date
    `, [groupAdminId, dateRange.start, dateRange.end]);
    
    // Weekly patterns
    const weeklyPatterns = await client.query(`
      SELECT 
        EXTRACT(DOW FROM es.start_time) as day_of_week,
        CASE EXTRACT(DOW FROM es.start_time)
          WHEN 0 THEN 'Sunday'
          WHEN 1 THEN 'Monday'
          WHEN 2 THEN 'Tuesday'
          WHEN 3 THEN 'Wednesday'
          WHEN 4 THEN 'Thursday'
          WHEN 5 THEN 'Friday'
          WHEN 6 THEN 'Saturday'
        END as day_name,
        COUNT(DISTINCT es.user_id) as avg_attendance,
        COALESCE(AVG(EXTRACT(EPOCH FROM es.duration) / 3600), 0) as avg_hours
      FROM users u
      JOIN employee_shifts es ON u.id = es.user_id
      WHERE u.group_admin_id = $1 
      AND es.start_time BETWEEN $2 AND $3
      GROUP BY EXTRACT(DOW FROM es.start_time)
      ORDER BY day_of_week
    `, [groupAdminId, dateRange.start, dateRange.end]);
    
    return {
      daily: dailyPatterns.rows,
      weekly: weeklyPatterns.rows
    };
    
  } finally {
    client.release();
  }
};
```

## Management Analytics

### Company-Wide Metrics
```typescript
// Management dashboard analytics
const getCompanyAnalytics = async (companyId: number, dateRange: DateRange) => {
  const client = await pool.connect();
  
  try {
    // Company overview
    const companyOverview = await client.query(`
      SELECT 
        COUNT(DISTINCT CASE WHEN u.role = 'employee' THEN u.id END) as total_employees,
        COUNT(DISTINCT CASE WHEN u.role = 'group-admin' THEN u.id END) as total_group_admins,
        COUNT(DISTINCT es.id) as total_shifts,
        COALESCE(SUM(es.total_expenses), 0) as total_expenses,
        COALESCE(SUM(es.total_kilometers), 0) as total_distance,
        COALESCE(SUM(EXTRACT(EPOCH FROM es.duration) / 3600), 0) as total_hours_worked
      FROM users u
      LEFT JOIN employee_shifts es ON u.id = es.user_id 
        AND es.start_time BETWEEN $2 AND $3
      WHERE u.company_id = $1
    `, [companyId, dateRange.start, dateRange.end]);
    
    // Department-wise analytics
    const departmentAnalytics = await client.query(`
      SELECT 
        u.department,
        COUNT(DISTINCT u.id) as employee_count,
        COUNT(DISTINCT es.id) as total_shifts,
        COALESCE(SUM(es.total_expenses), 0) as department_expenses,
        COALESCE(AVG(EXTRACT(EPOCH FROM es.duration) / 3600), 0) as avg_shift_hours
      FROM users u
      LEFT JOIN employee_shifts es ON u.id = es.user_id 
        AND es.start_time BETWEEN $2 AND $3
      WHERE u.company_id = $1 AND u.role = 'employee'
      GROUP BY u.department
      ORDER BY employee_count DESC
    `, [companyId, dateRange.start, dateRange.end]);
    
    // Group admin performance
    const groupAdminPerformance = await client.query(`
      SELECT 
        ga.id,
        ga.name as group_admin_name,
        COUNT(DISTINCT emp.id) as team_size,
        COUNT(DISTINCT es.id) as team_shifts,
        COALESCE(SUM(es.total_expenses), 0) as team_expenses,
        COUNT(CASE WHEN e.status = 'approved' THEN 1 END) as expenses_approved,
        COUNT(CASE WHEN e.status = 'rejected' THEN 1 END) as expenses_rejected,
        COUNT(CASE WHEN lr.status = 'approved' THEN 1 END) as leaves_approved
      FROM users ga
      LEFT JOIN users emp ON ga.id = emp.group_admin_id
      LEFT JOIN employee_shifts es ON emp.id = es.user_id 
        AND es.start_time BETWEEN $2 AND $3
      LEFT JOIN expenses e ON emp.id = e.user_id 
        AND e.date BETWEEN $2 AND $3
      LEFT JOIN leave_requests lr ON emp.id = lr.user_id 
        AND lr.start_date BETWEEN $2 AND $3
      WHERE ga.company_id = $1 AND ga.role = 'group-admin'
      GROUP BY ga.id, ga.name
      ORDER BY team_size DESC
    `, [companyId, dateRange.start, dateRange.end]);
    
    return {
      overview: companyOverview.rows[0],
      departments: departmentAnalytics.rows,
      groupAdmins: groupAdminPerformance.rows
    };
    
  } finally {
    client.release();
  }
};
```

## PDF Report Generation

### Report Templates
```typescript
// PDF report generation service
class ReportGenerationService {
  static async generateEmployeeReport(
    userId: number,
    dateRange: DateRange,
    reportType: 'attendance' | 'expenses' | 'performance' | 'comprehensive'
  ): Promise<Buffer> {
    const analytics = await getEmployeeAnalytics(userId, dateRange);
    const user = await getUserDetails(userId);
    
    const doc = new PDFDocument();
    const chunks: Buffer[] = [];
    
    doc.on('data', chunk => chunks.push(chunk));
    
    // Header
    doc.fontSize(20).text('Employee Performance Report', 50, 50);
    doc.fontSize(12).text(`Employee: ${user.name}`, 50, 80);
    doc.text(`Period: ${dateRange.start} to ${dateRange.end}`, 50, 95);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 50, 110);
    
    let yPosition = 140;
    
    // Attendance Section
    if (reportType === 'attendance' || reportType === 'comprehensive') {
      doc.fontSize(16).text('Attendance Summary', 50, yPosition);
      yPosition += 25;
      
      doc.fontSize(12)
        .text(`Total Shifts: ${analytics.shifts.total_shifts}`, 70, yPosition)
        .text(`Total Hours: ${analytics.shifts.total_hours.toFixed(1)}`, 70, yPosition + 15)
        .text(`Average Hours/Shift: ${analytics.shifts.avg_hours_per_shift.toFixed(1)}`, 70, yPosition + 30);
      
      yPosition += 60;
    }
    
    // Expense Section
    if (reportType === 'expenses' || reportType === 'comprehensive') {
      doc.fontSize(16).text('Expense Summary', 50, yPosition);
      yPosition += 25;
      
      doc.fontSize(12)
        .text(`Total Expenses: ₹${analytics.expenses.total_amount.toFixed(2)}`, 70, yPosition)
        .text(`Approved Amount: ₹${analytics.expenses.approved_amount.toFixed(2)}`, 70, yPosition + 15)
        .text(`Fuel Expenses: ₹${analytics.expenses.fuel_expenses.toFixed(2)}`, 70, yPosition + 30)
        .text(`Lodging Expenses: ₹${analytics.expenses.lodging_expenses.toFixed(2)}`, 70, yPosition + 45);
      
      yPosition += 80;
    }
    
    // Travel Section
    if (reportType === 'comprehensive') {
      doc.fontSize(16).text('Travel Summary', 50, yPosition);
      yPosition += 25;
      
      doc.fontSize(12)
        .text(`Total Distance: ${analytics.travel.total_distance.toFixed(1)} km`, 70, yPosition)
        .text(`Total Travel Time: ${analytics.travel.total_travel_time.toFixed(0)} minutes`, 70, yPosition + 15)
        .text(`Average Distance/Day: ${analytics.travel.avg_distance_per_day.toFixed(1)} km`, 70, yPosition + 30);
      
      yPosition += 60;
    }
    
    // Performance Score
    if (reportType === 'performance' || reportType === 'comprehensive') {
      const performanceScore = calculatePerformanceScore(analytics);
      
      doc.fontSize(16).text('Performance Score', 50, yPosition);
      yPosition += 25;
      
      doc.fontSize(14).text(`Overall Score: ${performanceScore.totalScore}%`, 70, yPosition);
      yPosition += 25;
      
      doc.fontSize(12)
        .text(`Attendance: ${performanceScore.breakdown.attendance}%`, 90, yPosition)
        .text(`Punctuality: ${performanceScore.breakdown.punctuality}%`, 90, yPosition + 15)
        .text(`Expense Efficiency: ${performanceScore.breakdown.expenseEfficiency}%`, 90, yPosition + 30)
        .text(`Task Completion: ${performanceScore.breakdown.taskCompletion}%`, 90, yPosition + 45);
    }
    
    doc.end();
    
    return new Promise((resolve) => {
      doc.on('end', () => {
        resolve(Buffer.concat(chunks));
      });
    });
  }
  
  static async generateTeamReport(
    groupAdminId: number,
    dateRange: DateRange
  ): Promise<Buffer> {
    const analytics = await getTeamAnalytics(groupAdminId, dateRange);
    const attendancePatterns = await analyzeAttendancePatterns(groupAdminId, dateRange);
    
    const doc = new PDFDocument();
    const chunks: Buffer[] = [];
    
    doc.on('data', chunk => chunks.push(chunk));
    
    // Header
    doc.fontSize(20).text('Team Performance Report', 50, 50);
    doc.fontSize(12).text(`Period: ${dateRange.start} to ${dateRange.end}`, 50, 80);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 50, 95);
    
    let yPosition = 125;
    
    // Team Overview
    doc.fontSize(16).text('Team Overview', 50, yPosition);
    yPosition += 25;
    
    doc.fontSize(12)
      .text(`Total Employees: ${analytics.overview.total_employees}`, 70, yPosition)
      .text(`Total Shifts: ${analytics.overview.total_shifts}`, 70, yPosition + 15)
      .text(`Total Expenses: ₹${analytics.overview.total_team_expenses.toFixed(2)}`, 70, yPosition + 30)
      .text(`Total Distance: ${analytics.overview.total_team_distance.toFixed(1)} km`, 70, yPosition + 45);
    
    yPosition += 80;
    
    // Employee Performance Table
    doc.fontSize(16).text('Employee Performance', 50, yPosition);
    yPosition += 25;
    
    // Table headers
    doc.fontSize(10)
      .text('Name', 50, yPosition)
      .text('Shifts', 150, yPosition)
      .text('Distance (km)', 200, yPosition)
      .text('Expenses (₹)', 280, yPosition)
      .text('Avg Hours', 360, yPosition);
    
    yPosition += 20;
    
    // Table data
    analytics.employees.forEach((employee, index) => {
      if (yPosition > 700) { // Start new page if needed
        doc.addPage();
        yPosition = 50;
      }
      
      doc.fontSize(9)
        .text(employee.name.substring(0, 15), 50, yPosition)
        .text(employee.shifts_completed.toString(), 150, yPosition)
        .text(employee.total_distance.toFixed(1), 200, yPosition)
        .text(employee.total_expenses.toFixed(0), 280, yPosition)
        .text(employee.avg_shift_hours.toFixed(1), 360, yPosition);
      
      yPosition += 15;
    });
    
    doc.end();
    
    return new Promise((resolve) => {
      doc.on('end', () => {
        resolve(Buffer.concat(chunks));
      });
    });
  }
}
```

## Real-Time Analytics Updates

### Socket.IO Integration for Live Metrics
```typescript
// Real-time analytics updates
class AnalyticsSocketService {
  private io: Server;
  
  constructor(server: any) {
    this.io = server;
  }
  
  // Broadcast analytics updates to relevant users
  broadcastAnalyticsUpdate(companyId: string, updateType: string, data: any): void {
    this.io.to(`company_${companyId}`).emit('analytics_update', {
      type: updateType,
      data,
      timestamp: new Date()
    });
  }
  
  // Send personalized analytics to specific user
  sendPersonalAnalytics(userId: string, analytics: any): void {
    this.io.to(`user_${userId}`).emit('personal_analytics', {
      analytics,
      timestamp: new Date()
    });
  }
  
  // Broadcast team performance updates to group admins
  broadcastTeamUpdate(groupAdminId: string, teamMetrics: any): void {
    this.io.to(`user_${groupAdminId}`).emit('team_analytics', {
      metrics: teamMetrics,
      timestamp: new Date()
    });
  }
}
```

This analytics and reporting system provides comprehensive insights across all user roles with real-time updates and professional PDF report generation.