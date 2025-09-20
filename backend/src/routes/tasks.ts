import express, { Response } from "express";
import { pool } from "../config/database";
import { verifyToken, adminMiddleware } from "../middleware/auth";
import { CustomRequest } from "../types";
import axios from "axios";
import { CustomerNotificationService } from "../services/CustomerNotificationService";
import { TaskNotificationService } from "../services/TaskNotificationService";

const router = express.Router();

// Group Admin: Create task
router.post(
  "/",
  verifyToken,
  adminMiddleware,
  async (req: CustomRequest, res: Response) => {
    const client = await pool.connect();
    try {
      const { 
        title, 
        description, 
        assignedTo, 
        priority, 
        dueDate,
        customerName,
        customerContact,
        customerNotes,
        sendCustomerUpdates,
        attachments
      } = req.body;

      // Format the due date properly
      const formattedDueDate = dueDate ? new Date(dueDate).toISOString() : null;

      // Determine customer contact type
      const customerContactType = customerContact ? 
        (customerContact.includes('@') ? 'email' : 'phone') : null;

      // Validate customer contact if provided
      if (customerContact && sendCustomerUpdates) {
        if (customerContactType === 'phone') {
          return res.status(400).json({ 
            error: "Customer updates via SMS are not yet implemented. Please use email contact." 
          });
        }
      }

      console.log("Creating task with data:", {
        title,
        description,
        assignedTo,
        assignedBy: req.user?.id,
        priority,
        dueDate: formattedDueDate,
        customerName,
        customerContact,
        customerContactType,
        sendCustomerUpdates,
        attachmentsCount: attachments?.length || 0
      });

      // Start transaction
      await client.query('BEGIN');

      // Insert task
      const result = await client.query(
        `INSERT INTO employee_tasks (
        title, description, assigned_to, assigned_by, priority, due_date,
        customer_name, customer_contact, customer_notes, send_customer_updates,
        customer_contact_type, attachments
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) 
      RETURNING *`,
        [
          title,
          description,
          assignedTo,
          req.user?.id,
          priority,
          formattedDueDate,
          customerName || null,
          customerContact || null,
          customerNotes || null,
          sendCustomerUpdates || false,
          customerContactType || undefined,
          JSON.stringify(attachments || [])
        ]
      );

      const task = result.rows[0];

      // Handle attachments if provided
      if (attachments && attachments.length > 0) {
        for (const attachment of attachments) {
          await client.query(
            `INSERT INTO task_attachments (task_id, file_name, file_type, file_size, file_data)
             VALUES ($1, $2, $3, $4, $5)`,
            [
              task.id,
              attachment.fileName,
              attachment.fileType,
              attachment.fileSize,
              Buffer.from(attachment.fileData, 'base64')
            ]
          );
        }
      }

      // Get assigned employee details for notifications
      const employeeResult = await client.query(
        `SELECT name, email FROM users WHERE id = $1`,
        [assignedTo]
      );

      const employee = employeeResult.rows[0];

      // Commit transaction first
      await client.query('COMMIT');

      // Send customer notification if enabled and contact is email (after transaction commit)
      if (sendCustomerUpdates && customerContact && customerContactType === 'email') {
        const customerNotificationService = CustomerNotificationService.getInstance();
        
        await customerNotificationService.sendTaskAssignmentNotification({
          customerName: customerName || 'Valued Customer',
          customerEmail: customerContact,
          taskTitle: title,
          taskDescription: description,
          taskStatus: 'assigned',
          taskPriority: priority,
          dueDate: formattedDueDate || undefined,
          assignedEmployeeName: employee?.name || 'Team Member',
          companyName: 'Avy Tracker'
        });
      }

      // Send task assignment notification to employee (after transaction is committed)
      const taskNotificationService = TaskNotificationService.getInstance();
      await taskNotificationService.sendTaskAssignmentNotification(
        task.id,
        assignedTo,
        {
          taskId: task.id,
          taskTitle: title,
          taskStatus: 'assigned',
          taskPriority: priority,
          assignedToName: employee?.name,
          assignedByName: req.user?.name,
          dueDate: formattedDueDate || undefined,
        }
      );

      console.log("Created task:", task);
      res.json(task);
    } catch (error) {
      // Rollback transaction on error
      await client.query('ROLLBACK');
      console.error("Error creating task:", error);
      res.status(500).json({ error: "Failed to create task" });
    } finally {
      client.release();
    }
  },
);

// Employee: Update task status
router.patch(
  "/:taskId/status",
  verifyToken,
  async (req: CustomRequest, res: Response) => {
    const client = await pool.connect();
    try {
      const { taskId } = req.params;
      const { status } = req.body;

      // Get current task with customer details
      const currentTask = await client.query(
        `SELECT status_history, customer_name, customer_contact, customer_contact_type, 
                send_customer_updates, title, description, priority, due_date, assigned_to, assigned_by
         FROM employee_tasks WHERE id = $1 AND (assigned_to = $2 OR assigned_by = $2)`,
        [taskId, req.user?.id],
      );

      if (currentTask.rows.length === 0) {
        return res.status(404).json({ error: "Task not found" });
      }

      const task = currentTask.rows[0];

      // Update status history
      const statusHistory = task.status_history || [];
      statusHistory.push({
        status,
        updatedAt: new Date(),
        updatedBy: req.user?.id,
      });

      const result = await client.query(
        `UPDATE employee_tasks 
       SET status = $1, 
           status_history = $2::jsonb,
           last_status_update = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3 AND (assigned_to = $4 OR assigned_by = $4)
       RETURNING *`,
        [status, JSON.stringify(statusHistory), taskId, req.user?.id],
      );

      // Send customer notification if enabled
      if (task.send_customer_updates && task.customer_contact && task.customer_contact_type === 'email') {
        const customerNotificationService = CustomerNotificationService.getInstance();
        
        // Get employee name for notification
        const employeeResult = await client.query(
          `SELECT name FROM users WHERE id = $1`,
          [req.user?.id]
        );
        
        const employeeName = employeeResult.rows[0]?.name || 'Team Member';

        await customerNotificationService.sendTaskStatusUpdate({
          customerName: task.customer_name || 'Valued Customer',
          customerEmail: task.customer_contact,
          taskTitle: task.title,
          taskDescription: task.description,
          taskStatus: status,
          taskPriority: task.priority,
          dueDate: task.due_date,
          assignedEmployeeName: employeeName,
          companyName: 'Avy Tracker'
        });
      }

      // Send task status update notification
      const taskNotificationService = TaskNotificationService.getInstance();
      await taskNotificationService.sendTaskStatusUpdateNotification(
        parseInt(taskId),
        task.assigned_to,
        task.assigned_by,
        {
          taskId: parseInt(taskId),
          taskTitle: task.title,
          taskStatus: status,
          taskPriority: task.priority,
          assignedToName: task.assigned_to_name,
          assignedByName: task.assigned_by_name,
        }
      );

      res.json(result.rows[0]);
    } catch (error) {
      console.error("Error updating task status:", error);
      res.status(500).json({ error: "Failed to update task status" });
    } finally {
      client.release();
    }
  },
);

// Get tasks for employee
router.get(
  "/employee",
  verifyToken,
  async (req: CustomRequest, res: Response) => {
    const client = await pool.connect();
    try {
      // Get today's date in YYYY-MM-DD format
      const today = new Date().toISOString().split("T")[0];

      console.log("Fetching tasks for user ID:", req.user?.id);
      console.log("Today's date:", today);

      const result = await client.query(
        `SELECT 
        t.*,
        u.name as assigned_by_name,
        TO_CHAR(t.due_date AT TIME ZONE 'UTC', 'YYYY-MM-DD') as formatted_due_date
       FROM employee_tasks t
       LEFT JOIN users u ON t.assigned_by = u.id
       WHERE t.assigned_to = $1
       AND (
         -- Include tasks with today's due_date
         DATE(t.due_date AT TIME ZONE 'UTC') = $2::date
         OR
         -- Include tasks with future due_dates
         DATE(t.due_date AT TIME ZONE 'UTC') > $2::date
         OR
         -- Include tasks with no due_date that were created today
         (t.due_date IS NULL AND DATE(t.created_at AT TIME ZONE 'UTC') = $2::date)
         OR
         -- Include tasks with no due_date that are still pending or in_progress
         (t.due_date IS NULL AND t.status IN ('pending', 'in_progress'))
       )
       ORDER BY 
         -- Show tasks with no due_date first
         CASE WHEN t.due_date IS NULL THEN 0 ELSE 1 END,
         -- Then by priority
         CASE t.priority
           WHEN 'high' THEN 1
           WHEN 'medium' THEN 2
           WHEN 'low' THEN 3
         END,
         -- Then by due_date if exists
         t.due_date ASC NULLS LAST,
         -- Finally by creation date
         t.created_at DESC`,
        [req.user?.id, today],
      );

      console.log("Found tasks:", result.rows.length);
      console.log(
        "Tasks:",
        result.rows.map((task) => ({
          id: task.id,
          title: task.title,
          due_date: task.due_date,
          formatted_due_date: task.formatted_due_date,
          created_at: task.created_at,
          status: task.status,
        })),
      );

      res.json(result.rows);
    } catch (error) {
      console.error("Error fetching tasks:", error);
      res.status(500).json({ error: "Failed to fetch tasks" });
    } finally {
      client.release();
    }
  },
);

// Group Admin: Get all tasks
router.get(
  "/admin",
  verifyToken,
  adminMiddleware,
  async (req: CustomRequest, res: Response) => {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT 
        t.*,
        u1.employee_number,
        u1.name as employee_name,
        u2.name as assigned_by_name,
        TO_CHAR(t.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as "createdAt"
      FROM employee_tasks t
      LEFT JOIN users u1 ON t.assigned_to = u1.id
      LEFT JOIN users u2 ON t.assigned_by = u2.id
      WHERE t.assigned_by = $1
      ORDER BY t.created_at DESC`,
        [req.user?.id],
      );

      // Format dates in the response
      const formattedTasks = result.rows.map((task) => ({
        ...task,
        due_date: task.due_date ? new Date(task.due_date).toISOString() : null,
        // createdAt is already formatted by the query
      }));

      res.json(formattedTasks);
    } catch (error) {
      console.error("Error fetching tasks:", error);
      res.status(500).json({ error: "Failed to fetch tasks" });
    } finally {
      client.release();
    }
  },
);

// Add this new endpoint for task statistics
router.get("/stats", verifyToken, async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Get the first and last day of the current month
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const result = await client.query(
      `
      SELECT 
        COUNT(*) as total_tasks,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_tasks,
        COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress_tasks,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_tasks,
        TO_CHAR(DATE_TRUNC('month', CURRENT_DATE), 'Month YYYY') as current_month
      FROM employee_tasks 
      WHERE assigned_to = $1
      AND created_at >= $2
      AND created_at <= $3`,
      [
        req.user.id,
        firstDayOfMonth.toISOString(),
        lastDayOfMonth.toISOString(),
      ],
    );

    const stats = result.rows[0];
    const total = parseInt(stats.total_tasks) || 0;

    res.json({
      total,
      completed: parseInt(stats.completed_tasks) || 0,
      inProgress: parseInt(stats.in_progress_tasks) || 0,
      pending: parseInt(stats.pending_tasks) || 0,
      completionRate: total
        ? Math.round((parseInt(stats.completed_tasks) / total) * 100)
        : 0,
      currentMonth: stats.current_month.trim(),
    });
  } catch (error) {
    console.error("Error fetching task stats:", error);
    res.status(500).json({ error: "Failed to fetch task statistics" });
  } finally {
    client.release();
  }
});

// Group Admin: Update task
router.patch(
  "/:taskId",
  verifyToken,
  adminMiddleware,
  async (req: CustomRequest, res: Response) => {
    const client = await pool.connect();
    try {
      const { taskId } = req.params;
      const { assignedTo, dueDate, isReassignment } = req.body;

      // Get the current task details first
      const currentTask = await client.query(
        `SELECT * FROM employee_tasks WHERE id = $1`,
        [taskId],
      );

      if (currentTask.rows.length === 0) {
        return res.status(404).json({ error: "Task not found" });
      }

      // Update task
      const result = await client.query(
        `UPDATE employee_tasks 
       SET assigned_to = $1, 
           due_date = $2,
           is_reassigned = $3,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4 AND assigned_by = $5
       RETURNING *`,
        [assignedTo, dueDate, isReassignment, taskId, req.user?.id],
      );

      if (result.rows.length === 0) {
        return res
          .status(404)
          .json({ error: "Task not found or unauthorized" });
      }

      await client.query("COMMIT");
      res.json(result.rows[0]);
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Error updating task:", error);
      res.status(500).json({ error: "Failed to update task" });
    } finally {
      client.release();
    }
  },
);

// Get task attachments
router.get(
  "/:taskId/attachments",
  verifyToken,
  async (req: CustomRequest, res: Response) => {
    const client = await pool.connect();
    try {
      const { taskId } = req.params;

      // Verify user has access to this task
      const taskCheck = await client.query(
        `SELECT id FROM employee_tasks 
         WHERE id = $1 AND (assigned_to = $2 OR assigned_by = $2)`,
        [taskId, req.user?.id]
      );

      if (taskCheck.rows.length === 0) {
        return res.status(404).json({ error: "Task not found or access denied" });
      }

      // Get attachments
      const result = await client.query(
        `SELECT id, file_name, file_type, file_size, created_at
         FROM task_attachments 
         WHERE task_id = $1
         ORDER BY created_at DESC`,
        [taskId]
      );

      res.json(result.rows);
    } catch (error) {
      console.error("Error fetching task attachments:", error);
      res.status(500).json({ error: "Failed to fetch attachments" });
    } finally {
      client.release();
    }
  },
);

// Get specific attachment file
router.get(
  "/:taskId/attachments/:attachmentId",
  verifyToken,
  async (req: CustomRequest, res: Response) => {
    const client = await pool.connect();
    try {
      const { taskId, attachmentId } = req.params;

      // Verify user has access to this task
      const taskCheck = await client.query(
        `SELECT id FROM employee_tasks 
         WHERE id = $1 AND (assigned_to = $2 OR assigned_by = $2)`,
        [taskId, req.user?.id]
      );

      if (taskCheck.rows.length === 0) {
        return res.status(404).json({ error: "Task not found or access denied" });
      }

      // Get attachment
      const result = await client.query(
        `SELECT file_name, file_type, file_size, file_data
         FROM task_attachments 
         WHERE id = $1 AND task_id = $2`,
        [attachmentId, taskId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Attachment not found" });
      }

      const attachment = result.rows[0];
      
      // Convert binary data to base64
      const base64Data = attachment.file_data.toString('base64');
      
      res.json({
        fileName: attachment.file_name,
        fileType: attachment.file_type,
        fileSize: attachment.file_size,
        fileData: base64Data
      });
    } catch (error) {
      console.error("Error fetching attachment:", error);
      res.status(500).json({ error: "Failed to fetch attachment" });
    } finally {
      client.release();
    }
  },
);

export default router;
