import nodemailer from "nodemailer";
import { pool } from "../config/database";

interface CustomerNotificationData {
  customerName: string;
  customerEmail: string;
  taskTitle: string;
  taskDescription: string;
  taskStatus: string;
  taskPriority: string;
  dueDate?: string;
  assignedEmployeeName: string;
  companyName?: string;
  customMessage?: string;
}

export class CustomerNotificationService {
  private static instance: CustomerNotificationService;
  private transporter: nodemailer.Transporter;

  private constructor() {
    this.transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  }

  public static getInstance(): CustomerNotificationService {
    if (!CustomerNotificationService.instance) {
      CustomerNotificationService.instance = new CustomerNotificationService();
    }
    return CustomerNotificationService.instance;
  }

  /**
   * Send task status update notification to customer
   */
  async sendTaskStatusUpdate(data: CustomerNotificationData): Promise<boolean> {
    try {
      const subject = `Task Update: ${data.taskTitle}`;
      const html = this.generateTaskUpdateEmail(data);

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: data.customerEmail,
        subject,
        html,
      };

      await this.transporter.sendMail(mailOptions);
      
      // Log the notification
      await this.logCustomerNotification({
        customerEmail: data.customerEmail,
        taskTitle: data.taskTitle,
        status: data.taskStatus,
        type: 'status_update'
      });

      console.log(`Customer notification sent to ${data.customerEmail} for task: ${data.taskTitle}`);
      return true;
    } catch (error) {
      console.error("Error sending customer notification:", error);
      return false;
    }
  }

  /**
   * Send task assignment notification to customer
   */
  async sendTaskAssignmentNotification(data: CustomerNotificationData): Promise<boolean> {
    try {
      const subject = `New Task Assigned: ${data.taskTitle}`;
      const html = this.generateTaskAssignmentEmail(data);

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: data.customerEmail,
        subject,
        html,
      };

      await this.transporter.sendMail(mailOptions);
      
      // Log the notification
      await this.logCustomerNotification({
        customerEmail: data.customerEmail,
        taskTitle: data.taskTitle,
        status: 'assigned',
        type: 'task_assignment'
      });

      console.log(`Task assignment notification sent to ${data.customerEmail} for task: ${data.taskTitle}`);
      return true;
    } catch (error) {
      console.error("Error sending task assignment notification:", error);
      return false;
    }
  }

  /**
   * Generate HTML email for task status updates
   */
  private generateTaskUpdateEmail(data: CustomerNotificationData): string {
    const statusColor = this.getStatusColor(data.taskStatus);
    const priorityColor = this.getPriorityColor(data.taskPriority);
    
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #3B82F6, #0EA5E9); padding: 30px; border-radius: 15px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px;">${data.companyName || 'Avy Tracker'}</h1>
          <p style="color: white; margin: 10px 0 0 0; font-size: 16px;">Task Status Update</p>
        </div>
        
        <div style="background: white; padding: 30px; border-radius: 15px; margin-top: 20px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <h2 style="color: #1F2937; margin: 0 0 20px 0; font-size: 24px;">Hello ${data.customerName},</h2>
          
          <p style="color: #4B5563; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
            We have an update on your task. Here are the current details:
          </p>
          
          <div style="background: #F8FAFC; padding: 20px; border-radius: 10px; margin: 20px 0;">
            <h3 style="color: #1F2937; margin: 0 0 15px 0; font-size: 18px;">📋 Task Details</h3>
            
            <div style="margin-bottom: 12px;">
              <strong style="color: #374151;">Task:</strong>
              <span style="color: #1F2937; margin-left: 8px;">${data.taskTitle}</span>
            </div>
            
            <div style="margin-bottom: 12px;">
              <strong style="color: #374151;">Description:</strong>
              <p style="color: #1F2937; margin: 4px 0 0 0; line-height: 1.5;">${data.taskDescription}</p>
            </div>
            
            <div style="margin-bottom: 12px;">
              <strong style="color: #374151;">Status:</strong>
              <span style="background: ${statusColor}; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; margin-left: 8px; text-transform: uppercase;">
                ${data.taskStatus.replace('_', ' ')}
              </span>
            </div>
            
            <div style="margin-bottom: 12px;">
              <strong style="color: #374151;">Priority:</strong>
              <span style="background: ${priorityColor}; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; margin-left: 8px; text-transform: uppercase;">
                ${data.taskPriority}
              </span>
            </div>
            
            ${data.dueDate ? `
            <div style="margin-bottom: 12px;">
              <strong style="color: #374151;">Due Date:</strong>
              <span style="color: #1F2937; margin-left: 8px;">${new Date(data.dueDate).toLocaleDateString()}</span>
            </div>
            ` : ''}
            
            <div>
              <strong style="color: #374151;">Assigned To:</strong>
              <span style="color: #1F2937; margin-left: 8px;">${data.assignedEmployeeName}</span>
            </div>
          </div>
          
          ${data.customMessage ? `
          <div style="background: #FEF3C7; border-left: 4px solid #F59E0B; padding: 15px; margin: 20px 0; border-radius: 5px;">
            <p style="color: #92400E; margin: 0 0 10px 0; font-size: 14px; font-weight: 600;">
              <strong>📝 Personal Message from our team:</strong>
            </p>
            <p style="color: #92400E; margin: 0; font-size: 14px; line-height: 1.5; font-style: italic;">
              "${data.customMessage}"
            </p>
          </div>
          ` : ''}
          
          <div style="background: #F0F9FF; border-left: 4px solid #3B82F6; padding: 15px; margin: 20px 0; border-radius: 5px;">
            <p style="color: #1E40AF; margin: 0; font-size: 14px;">
              <strong>Note:</strong> We'll keep you updated on the progress of this task. If you have any questions, please don't hesitate to contact us.
            </p>
          </div>
          
          <p style="color: #6B7280; font-size: 14px; margin: 20px 0 0 0;">
            Thank you for choosing ${data.companyName || 'Avy Tracker'} for your needs.
          </p>
        </div>
        
        <div style="text-align: center; margin-top: 20px; color: #9CA3AF; font-size: 12px;">
          <p>This is an automated message from ${data.companyName || 'Avy Tracker'}. Please do not reply to this email.</p>
        </div>
      </div>
    `;
  }

  /**
   * Generate HTML email for task assignment
   */
  private generateTaskAssignmentEmail(data: CustomerNotificationData): string {
    const priorityColor = this.getPriorityColor(data.taskPriority);
    
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #10B981, #059669); padding: 30px; border-radius: 15px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px;">${data.companyName || 'Avy Tracker'}</h1>
          <p style="color: white; margin: 10px 0 0 0; font-size: 16px;">New Task Assigned</p>
        </div>
        
        <div style="background: white; padding: 30px; border-radius: 15px; margin-top: 20px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <h2 style="color: #1F2937; margin: 0 0 20px 0; font-size: 24px;">Hello ${data.customerName},</h2>
          
          <p style="color: #4B5563; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
            Great news! We've assigned a new task to our team member. Here are the details:
          </p>
          
          <div style="background: #F0FDF4; padding: 20px; border-radius: 10px; margin: 20px 0; border: 1px solid #BBF7D0;">
            <h3 style="color: #1F2937; margin: 0 0 15px 0; font-size: 18px;">🎯 New Task Details</h3>
            
            <div style="margin-bottom: 12px;">
              <strong style="color: #374151;">Task:</strong>
              <span style="color: #1F2937; margin-left: 8px; font-weight: 600;">${data.taskTitle}</span>
            </div>
            
            <div style="margin-bottom: 12px;">
              <strong style="color: #374151;">Description:</strong>
              <p style="color: #1F2937; margin: 4px 0 0 0; line-height: 1.5;">${data.taskDescription}</p>
            </div>
            
            <div style="margin-bottom: 12px;">
              <strong style="color: #374151;">Priority:</strong>
              <span style="background: ${priorityColor}; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; margin-left: 8px; text-transform: uppercase;">
                ${data.taskPriority}
              </span>
            </div>
            
            ${data.dueDate ? `
            <div style="margin-bottom: 12px;">
              <strong style="color: #374151;">Due Date:</strong>
              <span style="color: #1F2937; margin-left: 8px;">${new Date(data.dueDate).toLocaleDateString()}</span>
            </div>
            ` : ''}
            
            <div>
              <strong style="color: #374151;">Assigned To:</strong>
              <span style="color: #1F2937; margin-left: 8px; font-weight: 600;">${data.assignedEmployeeName}</span>
            </div>
          </div>
          
          <div style="background: #FEF3C7; border-left: 4px solid #F59E0B; padding: 15px; margin: 20px 0; border-radius: 5px;">
            <p style="color: #92400E; margin: 0; font-size: 14px;">
              <strong>What's Next:</strong> Our team member will begin working on this task and will keep you updated on the progress. You'll receive notifications for any status changes.
            </p>
          </div>
          
          <p style="color: #6B7280; font-size: 14px; margin: 20px 0 0 0;">
            Thank you for choosing ${data.companyName || 'Avy Tracker'}. We're committed to delivering excellent results for you.
          </p>
        </div>
        
        <div style="text-align: center; margin-top: 20px; color: #9CA3AF; font-size: 12px;">
          <p>This is an automated message from ${data.companyName || 'Avy Tracker'}. Please do not reply to this email.</p>
        </div>
      </div>
    `;
  }

  /**
   * Get color for task status
   */
  private getStatusColor(status: string): string {
    switch (status.toLowerCase()) {
      case 'pending':
        return '#F59E0B';
      case 'in_progress':
        return '#3B82F6';
      case 'completed':
        return '#10B981';
      case 'cancelled':
        return '#EF4444';
      default:
        return '#6B7280';
    }
  }

  /**
   * Get color for task priority
   */
  private getPriorityColor(priority: string): string {
    switch (priority.toLowerCase()) {
      case 'low':
        return '#10B981';
      case 'medium':
        return '#F59E0B';
      case 'high':
        return '#F97316';
      case 'critical':
        return '#EF4444';
      default:
        return '#6B7280';
    }
  }

  /**
   * Log customer notification in database
   */
  private async logCustomerNotification(data: {
    customerEmail: string;
    taskTitle: string;
    status: string;
    type: string;
  }): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query(
        `INSERT INTO customer_notifications 
         (customer_email, task_title, status, type, sent_at, created_at)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [data.customerEmail, data.taskTitle, data.status, data.type]
      );
    } catch (error) {
      console.error("Error logging customer notification:", error);
    } finally {
      client.release();
    }
  }

  /**
   * Validate email address
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate phone number (basic validation)
   */
  private isValidPhone(phone: string): boolean {
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    return phoneRegex.test(phone.replace(/\s/g, ''));
  }
}
