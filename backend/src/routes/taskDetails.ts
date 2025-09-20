import express, { Response } from "express";
import { pool } from "../config/database";
import { verifyToken } from "../middleware/auth";
import { CustomRequest } from "../types";
import { NotificationService } from "../services/notificationService";
import { TaskNotificationService } from "../services/TaskNotificationService";
import { CustomerNotificationService } from "../services/CustomerNotificationService";

const router = express.Router();

// =====================================================
// TASK COMMENTS ENDPOINTS
// =====================================================

// Get all comments for a task
router.get("/:taskId/comments", verifyToken, async (req: CustomRequest, res: Response) => {
  const { taskId } = req.params;
  const client = await pool.connect();

  try {
    // Verify user has access to this task
    const taskCheck = await client.query(
      `SELECT id FROM employee_tasks 
       WHERE id = $1 AND (assigned_to = $2 OR assigned_by = $2)`,
      [taskId, req.user?.id]
    );

    if (taskCheck.rows.length === 0) {
      return res.status(403).json({ error: "Access denied to this task" });
    }

    // Get comments with user details
    const result = await client.query(
      `SELECT 
        tc.id,
        tc.comment,
        tc.comment_type,
        tc.created_at,
        tc.updated_at,
        u.name as user_name,
        u.role as user_role
       FROM task_comments tc
       JOIN users u ON tc.user_id = u.id
       WHERE tc.task_id = $1 AND tc.is_deleted = false
       ORDER BY tc.created_at ASC`,
      [taskId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching task comments:", error);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    client.release();
  }
});

// Add a comment to a task
router.post("/:taskId/comments", verifyToken, async (req: CustomRequest, res: Response) => {
  const { taskId } = req.params;
  const { comment, comment_type = "general" } = req.body;
  const client = await pool.connect();

  try {
    // Verify user has access to this task
    const taskCheck = await client.query(
      `SELECT id, assigned_to, assigned_by FROM employee_tasks 
       WHERE id = $1 AND (assigned_to = $2 OR assigned_by = $2)`,
      [taskId, req.user?.id]
    );

    if (taskCheck.rows.length === 0) {
      return res.status(403).json({ error: "Access denied to this task" });
    }

    const task = taskCheck.rows[0];

    // Insert comment
    const result = await client.query(
      `INSERT INTO task_comments (task_id, user_id, comment, comment_type)
       VALUES ($1, $2, $3, $4)
       RETURNING id, created_at`,
      [taskId, req.user?.id, comment, comment_type]
    );

    // Get comment with user details
    const commentResult = await client.query(
      `SELECT 
        tc.id,
        tc.comment,
        tc.comment_type,
        tc.created_at,
        u.name as user_name,
        u.role as user_role
       FROM task_comments tc
       JOIN users u ON tc.user_id = u.id
       WHERE tc.id = $1`,
      [result.rows[0].id]
    );

    // Send push notification to the other party
    const recipientId = task.assigned_to === req.user?.id ? task.assigned_by : task.assigned_to;
    if (recipientId) {
      try {
        // Get task details for notification
        const taskDetailsResult = await client.query(
          `SELECT title, priority FROM employee_tasks WHERE id = $1`,
          [taskId]
        );
        const taskDetails = taskDetailsResult.rows[0];

        // Get user details for notification
        const userResult = await client.query(
          `SELECT name FROM users WHERE id = $1`,
          [req.user?.id]
        );
        const userName = userResult.rows[0]?.name || 'User';

        const taskNotificationService = TaskNotificationService.getInstance();
        await taskNotificationService.sendTaskCommentNotification(
          parseInt(taskId),
          req.user?.id || 0,
          recipientId,
          {
            taskId: parseInt(taskId),
            taskTitle: taskDetails?.title || 'Task',
            taskPriority: taskDetails?.priority || 'medium',
            commentId: result.rows[0].id,
            commentText: comment,
            assignedToName: userName,
          }
        );
      } catch (notificationError) {
        console.error("Error sending push notification:", notificationError);
        // Don't fail the request if notification fails
      }
    }

    res.status(201).json(commentResult.rows[0]);
  } catch (error) {
    console.error("Error adding task comment:", error);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    client.release();
  }
});

// Update a comment
router.put("/:taskId/comments/:commentId", verifyToken, async (req: CustomRequest, res: Response) => {
  const { taskId, commentId } = req.params;
  const { comment } = req.body;
  const client = await pool.connect();

  try {
    // Verify user owns this comment and has access to the task
    const commentCheck = await client.query(
      `SELECT tc.id FROM task_comments tc
       JOIN employee_tasks et ON tc.task_id = et.id
       WHERE tc.id = $1 AND tc.user_id = $2 AND tc.task_id = $3
       AND (et.assigned_to = $2 OR et.assigned_by = $2)`,
      [commentId, req.user?.id, taskId]
    );

    if (commentCheck.rows.length === 0) {
      return res.status(403).json({ error: "Access denied to this comment" });
    }

    // Update comment
    const result = await client.query(
      `UPDATE task_comments 
       SET comment = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING id, comment, updated_at`,
      [comment, commentId]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error updating task comment:", error);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    client.release();
  }
});

// Delete a comment (soft delete)
router.delete("/:taskId/comments/:commentId", verifyToken, async (req: CustomRequest, res: Response) => {
  const { taskId, commentId } = req.params;
  const client = await pool.connect();

  try {
    // Verify user owns this comment and has access to the task
    const commentCheck = await client.query(
      `SELECT tc.id FROM task_comments tc
       JOIN employee_tasks et ON tc.task_id = et.id
       WHERE tc.id = $1 AND tc.user_id = $2 AND tc.task_id = $3
       AND (et.assigned_to = $2 OR et.assigned_by = $2)`,
      [commentId, req.user?.id, taskId]
    );

    if (commentCheck.rows.length === 0) {
      return res.status(403).json({ error: "Access denied to this comment" });
    }

    // Soft delete comment
    await client.query(
      `UPDATE task_comments 
       SET is_deleted = true, deleted_at = CURRENT_TIMESTAMP, deleted_by = $1
       WHERE id = $2`,
      [req.user?.id, commentId]
    );

    res.json({ message: "Comment deleted successfully" });
  } catch (error) {
    console.error("Error deleting task comment:", error);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    client.release();
  }
});

// =====================================================
// TASK ACTIVITY HISTORY ENDPOINTS
// =====================================================

// Get activity history for a task
router.get("/:taskId/activity", verifyToken, async (req: CustomRequest, res: Response) => {
  const { taskId } = req.params;
  const client = await pool.connect();

  try {
    // Verify user has access to this task
    const taskCheck = await client.query(
      `SELECT id FROM employee_tasks 
       WHERE id = $1 AND (assigned_to = $2 OR assigned_by = $2)`,
      [taskId, req.user?.id]
    );

    if (taskCheck.rows.length === 0) {
      return res.status(403).json({ error: "Access denied to this task" });
    }

    // Get activity history with user details
    const result = await client.query(
      `SELECT 
        tah.id,
        tah.activity_type,
        tah.activity_description,
        tah.old_value,
        tah.new_value,
        tah.change_details,
        tah.created_at,
        u.name as user_name,
        u.role as user_role
       FROM task_activity_history tah
       LEFT JOIN users u ON tah.user_id = u.id
       WHERE tah.task_id = $1
       ORDER BY tah.created_at DESC`,
      [taskId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching task activity:", error);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    client.release();
  }
});

// =====================================================
// TASK DETAILS ENDPOINT
// =====================================================

// Get comprehensive task details
router.get("/:taskId", verifyToken, async (req: CustomRequest, res: Response) => {
  const { taskId } = req.params;
  const client = await pool.connect();

  try {
    // Verify user has access to this task
    const taskCheck = await client.query(
      `SELECT id FROM employee_tasks 
       WHERE id = $1 AND (assigned_to = $2 OR assigned_by = $2)`,
      [taskId, req.user?.id]
    );

    if (taskCheck.rows.length === 0) {
      return res.status(403).json({ error: "Access denied to this task" });
    }

    // Get comprehensive task details
    const result = await client.query(
      `SELECT 
        t.*,
        u1.name as assigned_to_name,
        u2.name as assigned_by_name,
        TO_CHAR(t.due_date AT TIME ZONE 'UTC', 'YYYY-MM-DD') as formatted_due_date,
        TO_CHAR(t.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as formatted_created_at,
        TO_CHAR(t.last_status_update AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as formatted_last_update
       FROM employee_tasks t
       LEFT JOIN users u1 ON t.assigned_to = u1.id
       LEFT JOIN users u2 ON t.assigned_by = u2.id
       WHERE t.id = $1`,
      [taskId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Task not found" });
    }

    const task = result.rows[0];

    // Get attachment count
    const attachmentCount = await client.query(
      `SELECT COUNT(*) as count FROM task_attachments WHERE task_id = $1`,
      [taskId]
    );

    // Get recent comments count
    const commentsCount = await client.query(
      `SELECT COUNT(*) as count FROM task_comments WHERE task_id = $1 AND is_deleted = false`,
      [taskId]
    );

    // Get activity count
    const activityCount = await client.query(
      `SELECT COUNT(*) as count FROM task_activity_history WHERE task_id = $1`,
      [taskId]
    );

    res.json({
      ...task,
      attachment_count: parseInt(attachmentCount.rows[0].count),
      comments_count: parseInt(commentsCount.rows[0].count),
      activity_count: parseInt(activityCount.rows[0].count),
    });
  } catch (error) {
    console.error("Error fetching task details:", error);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    client.release();
  }
});

// =====================================================
// TASK NOTIFICATIONS ENDPOINTS
// =====================================================

// Get notifications for a task
router.get("/:taskId/notifications", verifyToken, async (req: CustomRequest, res: Response) => {
  const { taskId } = req.params;
  const client = await pool.connect();

  try {
    // Verify user has access to this task
    const taskCheck = await client.query(
      `SELECT id FROM employee_tasks 
       WHERE id = $1 AND (assigned_to = $2 OR assigned_by = $2)`,
      [taskId, req.user?.id]
    );

    if (taskCheck.rows.length === 0) {
      return res.status(403).json({ error: "Access denied to this task" });
    }

    // Get notifications for this task
    const result = await client.query(
      `SELECT 
        tn.id,
        tn.notification_type,
        tn.title,
        tn.message,
        tn.sent_at,
        tn.read_at,
        tn.delivery_status,
        u.name as recipient_name
       FROM task_notifications tn
       JOIN users u ON tn.recipient_id = u.id
       WHERE tn.task_id = $1
       ORDER BY tn.sent_at DESC`,
      [taskId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching task notifications:", error);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    client.release();
  }
});

// Mark notification as read
router.patch("/:taskId/notifications/:notificationId/read", verifyToken, async (req: CustomRequest, res: Response) => {
  const { taskId, notificationId } = req.params;
  const client = await pool.connect();

  try {
    // Verify user has access to this task and notification
    const notificationCheck = await client.query(
      `SELECT tn.id FROM task_notifications tn
       JOIN employee_tasks et ON tn.task_id = et.id
       WHERE tn.id = $1 AND tn.task_id = $2 AND tn.recipient_id = $3
       AND (et.assigned_to = $3 OR et.assigned_by = $3)`,
      [notificationId, taskId, req.user?.id]
    );

    if (notificationCheck.rows.length === 0) {
      return res.status(403).json({ error: "Access denied to this notification" });
    }

    // Mark as read
    await client.query(
      `UPDATE task_notifications 
       SET read_at = CURRENT_TIMESTAMP, delivery_status = 'read'
       WHERE id = $1`,
      [notificationId]
    );

    res.json({ message: "Notification marked as read" });
  } catch (error) {
    console.error("Error marking notification as read:", error);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    client.release();
  }
});

// =====================================================
// SEND CUSTOMER UPDATE ENDPOINT
// =====================================================

router.post("/:taskId/send-customer-update", verifyToken, async (req: CustomRequest, res: Response) => {
  const { taskId } = req.params;
  const { message } = req.body;
  const client = await pool.connect();

  try {
    // Get task details with customer information
    const taskResult = await client.query(
      `SELECT 
        t.*,
        u1.name as assigned_to_name,
        u2.name as assigned_by_name
       FROM employee_tasks t
       LEFT JOIN users u1 ON t.assigned_to = u1.id
       LEFT JOIN users u2 ON t.assigned_by = u2.id
       WHERE t.id = $1`,
      [taskId]
    );

    if (taskResult.rows.length === 0) {
      return res.status(404).json({ error: "Task not found" });
    }

    const task = taskResult.rows[0];

    // Check if customer updates are enabled and customer contact is email
    if (!task.send_customer_updates || !task.customer_contact || task.customer_contact_type !== 'email') {
      return res.status(400).json({ 
        error: "Customer updates not enabled or customer contact is not an email" 
      });
    }

    // Send customer notification
    const customerNotificationService = CustomerNotificationService.getInstance();
    const success = await customerNotificationService.sendTaskStatusUpdate({
      customerName: task.customer_name || 'Valued Customer',
      customerEmail: task.customer_contact,
      taskTitle: task.title,
      taskDescription: task.description,
      taskStatus: task.status,
      taskPriority: task.priority,
      dueDate: task.due_date ? new Date(task.due_date).toISOString().split('T')[0] : undefined,
      assignedEmployeeName: task.assigned_to_name || 'Team Member',
      companyName: 'Avy Tracker',
      customMessage: message
    });

    if (success) {
      res.json({ 
        success: true, 
        message: "Customer update sent successfully" 
      });
    } else {
      res.status(500).json({ 
        error: "Failed to send customer update" 
      });
    }
  } catch (error) {
    console.error("Error sending customer update:", error);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    client.release();
  }
});

export default router;
