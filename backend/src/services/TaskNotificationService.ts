import { pool } from "../config/database";
import { NotificationService } from "./notificationService";

interface TaskNotificationData {
  taskId: number;
  taskTitle: string;
  taskStatus?: string;
  taskPriority?: string;
  assignedToName?: string;
  assignedByName?: string;
  commentId?: number;
  commentText?: string;
  attachmentName?: string;
  dueDate?: string;
}

export class TaskNotificationService {
  private static instance: TaskNotificationService;
  private notificationService: NotificationService;

  private constructor() {
    this.notificationService = new NotificationService();
  }

  /**
   * Map task priority to notification priority
   */
  private mapTaskPriorityToNotificationPriority(taskPriority?: string): "default" | "normal" | "high" {
    switch (taskPriority) {
      case "high":
        return "high";
      case "medium":
        return "normal";
      case "low":
        return "default";
      default:
        return "normal";
    }
  }

  public static getInstance(): TaskNotificationService {
    if (!TaskNotificationService.instance) {
      TaskNotificationService.instance = new TaskNotificationService();
    }
    return TaskNotificationService.instance;
  }

  /**
   * Send notification when a task is assigned to an employee
   */
  public async sendTaskAssignmentNotification(
    taskId: number,
    assignedToUserId: number,
    taskData: TaskNotificationData
  ): Promise<void> {
    const title = "New Task Assigned";
    const message = `You have been assigned a new task: "${taskData.taskTitle}"`;
    
    const notificationData = {
      screen: "/(dashboard)/employee",
      taskId,
      type: "task_assigned",
      priority: this.mapTaskPriorityToNotificationPriority(taskData.taskPriority),
    };

    await this.sendNotification(
      assignedToUserId,
      title,
      message,
      "task_assigned",
      "high",
      notificationData,
      taskId
    );
  }

  /**
   * Send notification when a task is reassigned
   */
  public async sendTaskReassignmentNotification(
    taskId: number,
    newAssigneeId: number,
    previousAssigneeId: number,
    taskData: TaskNotificationData
  ): Promise<void> {
    // Notify new assignee
    const newAssigneeTitle = "Task Reassigned to You";
    const newAssigneeMessage = `You have been assigned the task: "${taskData.taskTitle}"`;
    
    const newAssigneeData = {
      screen: "/(dashboard)/employee",
      taskId,
      type: "task_reassigned",
      priority: this.mapTaskPriorityToNotificationPriority(taskData.taskPriority),
    };

    await this.sendNotification(
      newAssigneeId,
      newAssigneeTitle,
      newAssigneeMessage,
      "task_reassigned",
      "high",
      newAssigneeData,
      taskId
    );

    // Notify previous assignee
    const previousAssigneeTitle = "Task Reassigned";
    const previousAssigneeMessage = `The task "${taskData.taskTitle}" has been reassigned to ${taskData.assignedToName}`;
    
    const previousAssigneeData = {
      screen: "/(dashboard)/employee",
      taskId,
      type: "task_reassigned",
      priority: this.mapTaskPriorityToNotificationPriority(taskData.taskPriority),
    };

    await this.sendNotification(
      previousAssigneeId,
      previousAssigneeTitle,
      previousAssigneeMessage,
      "task_reassigned",
      "normal",
      previousAssigneeData,
      taskId
    );
  }

  /**
   * Send notification when task status is updated
   */
  public async sendTaskStatusUpdateNotification(
    taskId: number,
    assigneeId: number,
    assignerId: number,
    taskData: TaskNotificationData
  ): Promise<void> {
    const title = "Task Status Updated";
    const message = `Task "${taskData.taskTitle}" status changed to ${taskData.taskStatus?.toUpperCase().replace("_", " ")}`;
    
    const notificationData = {
      screen: "/(dashboard)/employee",
      taskId,
      type: "status_update",
      status: taskData.taskStatus,
      priority: this.mapTaskPriorityToNotificationPriority(taskData.taskPriority),
    };

    // Notify both assignee and assigner
    const recipients = [assigneeId, assignerId].filter((id, index, arr) => arr.indexOf(id) === index);
    
    for (const recipientId of recipients) {
      await this.sendNotification(
        recipientId,
        title,
        message,
        "status_update",
        "normal",
        notificationData,
        taskId
      );
    }
  }

  /**
   * Send notification when a comment is added to a task
   */
  public async sendTaskCommentNotification(
    taskId: number,
    commenterId: number,
    recipientId: number,
    taskData: TaskNotificationData
  ): Promise<void> {
    const title = "New Task Comment";
    const message = `New comment on task "${taskData.taskTitle}": ${taskData.commentText?.substring(0, 50)}...`;
    
    const notificationData = {
      screen: "/(dashboard)/employee",
      taskId,
      type: "comment_added",
      commentId: taskData.commentId,
      priority: this.mapTaskPriorityToNotificationPriority(taskData.taskPriority),
    };

    await this.sendNotification(
      recipientId,
      title,
      message,
      "comment_added",
      "normal",
      notificationData,
      taskId
    );
  }

  /**
   * Send notification when task priority is changed
   */
  public async sendTaskPriorityChangeNotification(
    taskId: number,
    assigneeId: number,
    assignerId: number,
    taskData: TaskNotificationData
  ): Promise<void> {
    const title = "Task Priority Changed";
    const message = `Task "${taskData.taskTitle}" priority changed to ${taskData.taskPriority?.toUpperCase()}`;
    
    const notificationData = {
      screen: "/(dashboard)/employee",
      taskId,
      type: "priority_changed",
      priority: this.mapTaskPriorityToNotificationPriority(taskData.taskPriority),
    };

    // Notify both assignee and assigner
    const recipients = [assigneeId, assignerId].filter((id, index, arr) => arr.indexOf(id) === index);
    
    for (const recipientId of recipients) {
      await this.sendNotification(
        recipientId,
        title,
        message,
        "priority_changed",
        "high",
        notificationData,
        taskId
      );
    }
  }

  /**
   * Send notification when an attachment is added to a task
   */
  public async sendTaskAttachmentNotification(
    taskId: number,
    assigneeId: number,
    assignerId: number,
    taskData: TaskNotificationData
  ): Promise<void> {
    const title = "Task Attachment Added";
    const message = `New attachment "${taskData.attachmentName}" added to task "${taskData.taskTitle}"`;
    
    const notificationData = {
      screen: "/(dashboard)/employee",
      taskId,
      type: "attachment_added",
      priority: this.mapTaskPriorityToNotificationPriority(taskData.taskPriority),
    };

    // Notify both assignee and assigner
    const recipients = [assigneeId, assignerId].filter((id, index, arr) => arr.indexOf(id) === index);
    
    for (const recipientId of recipients) {
      await this.sendNotification(
        recipientId,
        title,
        message,
        "attachment_added",
        "normal",
        notificationData,
        taskId
      );
    }
  }

  /**
   * Send notification when task is due soon or overdue
   */
  public async sendTaskDueDateReminder(
    taskId: number,
    assigneeId: number,
    taskData: TaskNotificationData,
    isOverdue: boolean = false
  ): Promise<void> {
    const title = isOverdue ? "Task Overdue" : "Task Due Soon";
    const message = isOverdue 
      ? `Task "${taskData.taskTitle}" is overdue!`
      : `Task "${taskData.taskTitle}" is due soon (${taskData.dueDate})`;
    
    const notificationData = {
      screen: "/(dashboard)/employee",
      taskId,
      type: isOverdue ? "overdue_task" : "due_date_reminder",
      priority: this.mapTaskPriorityToNotificationPriority(taskData.taskPriority),
      dueDate: taskData.dueDate,
    };

    await this.sendNotification(
      assigneeId,
      title,
      message,
      isOverdue ? "overdue_task" : "due_date_reminder",
      isOverdue ? "high" : "normal",
      notificationData,
      taskId
    );
  }

  /**
   * Send notification when task is completed
   */
  public async sendTaskCompletionNotification(
    taskId: number,
    assigneeId: number,
    assignerId: number,
    taskData: TaskNotificationData
  ): Promise<void> {
    const title = "Task Completed";
    const message = `Task "${taskData.taskTitle}" has been completed by ${taskData.assignedToName}`;
    
    const notificationData = {
      screen: "/(dashboard)/Group-Admin/task-management",
      taskId,
      type: "task_completed",
      priority: this.mapTaskPriorityToNotificationPriority(taskData.taskPriority),
    };

    await this.sendNotification(
      assignerId,
      title,
      message,
      "task_completed",
      "normal",
      notificationData,
      taskId
    );
  }

  /**
   * Private method to send notification and log it in database
   */
  private async sendNotification(
    recipientId: number,
    title: string,
    message: string,
    notificationType: string,
    priority: "default" | "normal" | "high",
    data: any,
    taskId: number
  ): Promise<void> {
    const client = await pool.connect();
    try {
      // Store notification in database
      await client.query(
        `INSERT INTO task_notifications (
          task_id, recipient_id, notification_type, title, message, notification_data
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [taskId, recipientId, notificationType, title, message, JSON.stringify(data)]
      );

      // Send push notification
      try {
        await this.notificationService.sendPushNotification(
          {
            id: 0,
            user_id: recipientId.toString(),
            title,
            message,
            type: "task",
            priority,
            data: {
              screen: data.screen || "/(dashboard)/employee",
              ...data,
            },
          },
          [recipientId.toString()]
        );
      } catch (error) {
        console.error("Failed to send push notification:", error);
        // Don't throw error as the notification is already stored in database
      }
    } finally {
      client.release();
    }
  }

  /**
   * Get task notifications for a user
   */
  public async getTaskNotifications(
    userId: number,
    limit: number = 50,
    offset: number = 0
  ): Promise<any[]> {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT 
          tn.id,
          tn.task_id,
          tn.notification_type,
          tn.title,
          tn.message,
          tn.sent_at,
          tn.read_at,
          tn.delivery_status,
          tn.notification_data,
          et.title as task_title,
          et.status as task_status,
          et.priority as task_priority
         FROM task_notifications tn
         LEFT JOIN employee_tasks et ON tn.task_id = et.id
         WHERE tn.recipient_id = $1
         ORDER BY tn.sent_at DESC
         LIMIT $2 OFFSET $3`,
        [userId, limit, offset]
      );

      return result.rows;
    } finally {
      client.release();
    }
  }

  /**
   * Mark task notification as read
   */
  public async markNotificationAsRead(notificationId: number, userId: number): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query(
        `UPDATE task_notifications 
         SET read_at = CURRENT_TIMESTAMP, delivery_status = 'read'
         WHERE id = $1 AND recipient_id = $2`,
        [notificationId, userId]
      );
    } finally {
      client.release();
    }
  }

  /**
   * Get unread notification count for a user
   */
  public async getUnreadNotificationCount(userId: number): Promise<number> {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT COUNT(*) as count 
         FROM task_notifications 
         WHERE recipient_id = $1 AND read_at IS NULL`,
        [userId]
      );

      return parseInt(result.rows[0].count);
    } finally {
      client.release();
    }
  }
}
