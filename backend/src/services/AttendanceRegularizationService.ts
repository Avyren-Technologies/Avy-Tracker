import { pool } from "../config/database";
import { NotificationService } from "./notificationService";

export interface RegularizationRequest {
  id: number;
  employee_id: number;
  shift_id?: number;
  request_date: string;
  original_start_time?: string;
  original_end_time?: string;
  requested_start_time: string;
  requested_end_time: string;
  reason: string;
  supporting_documents?: string[];
  request_type: 'time_adjustment' | 'missing_shift' | 'early_departure' | 'late_arrival';
  status: 'pending' | 'group_admin_approved' | 'management_approved' | 'approved' | 'rejected' | 'cancelled';
  current_approver_role?: 'group-admin' | 'management';
  group_admin_id?: number;
  group_admin_approved_at?: string;
  group_admin_comments?: string;
  management_id?: number;
  management_approved_at?: string;
  management_comments?: string;
  final_approved_by?: number;
  final_approved_at?: string;
  final_comments?: string;
  created_at: string;
  updated_at: string;
  created_by: number;
  // Additional fields for display
  employee_name?: string;
  group_admin_name?: string;
  management_name?: string;
  final_approver_name?: string;
}

export interface ApprovalHistory {
  id: number;
  request_id: number;
  approver_id: number;
  approver_role: string;
  action: string;
  comments?: string;
  action_timestamp: string;
  approver_name?: string;
}

export interface RegularizationNotification {
  id: number;
  request_id: number;
  recipient_id: number;
  notification_type: string;
  title: string;
  message: string;
  notification_data?: any;
  sent_at: string;
  read_at?: string;
  delivery_status: string;
}

export class AttendanceRegularizationService {
  private static instance: AttendanceRegularizationService;

  private constructor() {}

  public static getInstance(): AttendanceRegularizationService {
    if (!AttendanceRegularizationService.instance) {
      AttendanceRegularizationService.instance = new AttendanceRegularizationService();
    }
    return AttendanceRegularizationService.instance;
  }

  /**
   * Create a new regularization request
   */
  async createRequest(
    employeeId: number,
    requestData: {
      shift_id?: number;
      request_date: string;
      original_start_time?: string;
      original_end_time?: string;
      requested_start_time: string;
      requested_end_time: string;
      reason: string;
      supporting_documents?: string[];
      request_type: 'time_adjustment' | 'missing_shift' | 'early_departure' | 'late_arrival';
    }
  ): Promise<RegularizationRequest> {
    const client = await pool.connect();
    try {
      // Validate request data
      await this.validateRequestData(requestData);

      // Get approver based on who is creating the request
      let approverRole: string | null = null;
      let approverId: number | null = null;

      // Check if the request creator is management (they can approve their own requests)
      const creatorResult = await client.query(
        `SELECT role FROM users WHERE id = $1`,
        [employeeId]
      );

      if (creatorResult.rows.length === 0) {
        throw new Error('Request creator not found');
      }

      const creatorRole = creatorResult.rows[0].role;

      if (creatorRole === 'management') {
        // Management creating their own request - they can approve it themselves
        approverRole = null;
        approverId = null;
      } else if (creatorRole === 'group-admin') {
        // Group-admin creating their own request - needs management approval
        const managementResult = await client.query(
          `SELECT u.id, u.name, u.role
           FROM users u
           WHERE u.company_id = (
             SELECT company_id FROM users WHERE id = $1
           ) AND u.role = 'management'
           LIMIT 1`,
          [employeeId]
        );

        if (managementResult.rows.length === 0) {
          throw new Error('No management found for this group-admin');
        }

        const management = managementResult.rows[0];
        approverRole = 'management';
        approverId = management.id;
      } else {
        // Employee creating their own request - needs group-admin approval
        const groupAdminResult = await client.query(
          `SELECT u.id, u.name, u.role
           FROM users u
           WHERE u.company_id = (
             SELECT company_id FROM users WHERE id = $1
           ) AND u.role = 'group-admin'
           LIMIT 1`,
          [employeeId]
        );

        if (groupAdminResult.rows.length === 0) {
          throw new Error('No group admin found for this employee');
        }

        const groupAdmin = groupAdminResult.rows[0];
        approverRole = 'group-admin';
        approverId = groupAdmin.id;
      }

      // Helper function to convert time string to timestamp
      const convertTimeToTimestamp = (dateStr: string, timeStr: string): string => {
        if (!timeStr || timeStr.trim() === '') return '';
        // Combine date and time to create a proper timestamp
        return `${dateStr}T${timeStr}:00.000Z`;
      };

      // Convert time strings to timestamps
      const originalStartTime = requestData.original_start_time
        ? convertTimeToTimestamp(requestData.request_date, requestData.original_start_time)
        : null;
      const originalEndTime = requestData.original_end_time
        ? convertTimeToTimestamp(requestData.request_date, requestData.original_end_time)
        : null;
      const requestedStartTime = convertTimeToTimestamp(requestData.request_date, requestData.requested_start_time);
      const requestedEndTime = convertTimeToTimestamp(requestData.request_date, requestData.requested_end_time);

      // Create the request
      const insertParams = [
        employeeId,
        requestData.shift_id || null,
        requestData.request_date,
        originalStartTime,
        originalEndTime,
        requestedStartTime,
        requestedEndTime,
        requestData.reason,
        requestData.supporting_documents || null,
        requestData.request_type,
        'pending',
        approverRole,
        approverRole === 'group-admin' ? approverId : null,
        approverRole === 'management' ? approverId : null,
        employeeId
      ];
      
      const result = await client.query(
        `INSERT INTO attendance_regularization_requests (
          employee_id, shift_id, request_date, original_start_time, original_end_time,
          requested_start_time, requested_end_time, reason, supporting_documents,
          request_type, status, current_approver_role, group_admin_id, management_id, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING *`,
        insertParams
      );

      const request = result.rows[0];

      // Add to approval history
      await this.addApprovalHistory(
        request.id,
        employeeId,
        'employee',
        'submitted',
        'Request submitted for approval'
      );

      // Send notification to group admin (only if there's a group admin)
      if (approverRole === 'group-admin' && approverId) {
        await this.sendNotification(
          request.id,
          approverId,
          'approval_needed',
          'New Regularization Request',
          `Employee has submitted a regularization request for ${requestData.request_date}. Please review and approve.`,
          { request_id: request.id, employee_id: employeeId }
        );
      }

      return await this.getRequestById(request.id);
    } finally {
      client.release();
    }
  }

  /**
   * Get regularization requests for a user based on their role
   */
  async getRequestsForUser(
    userId: number,
    userRole: string,
    filters: {
      status?: string;
      request_type?: string;
      date_from?: string;
      date_to?: string;
      employee_id?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ requests: RegularizationRequest[]; total: number }> {
    const client = await pool.connect();
    try {
      let whereClause = '';
      let params: any[] = [userId];
      let paramIndex = 1;

      // Build where clause based on user role
      switch (userRole) {
        case 'employee':
          whereClause = 'WHERE arr.employee_id = $1';
          break;
        case 'group-admin':
          whereClause = 'WHERE arr.group_admin_id = $1 AND arr.employee_id != $1';
          break;
        case 'management':
          whereClause = 'WHERE arr.management_id = $1 OR (arr.status = \'pending\' AND arr.current_approver_role = \'management\')';
          break;
        case 'super-admin':
          whereClause = ''; // Super admin can see all requests
          params = [];
          paramIndex = 0;
          break;
        default:
          throw new Error('Invalid user role');
      }

      // Add filters
      if (filters.status) {
        paramIndex++;
        whereClause += whereClause ? ' AND' : 'WHERE';
        whereClause += ` arr.status = $${paramIndex}`;
        params.push(filters.status);
      }

      if (filters.request_type) {
        paramIndex++;
        whereClause += whereClause ? ' AND' : 'WHERE';
        whereClause += ` arr.request_type = $${paramIndex}`;
        params.push(filters.request_type);
      }

      if (filters.date_from) {
        paramIndex++;
        whereClause += whereClause ? ' AND' : 'WHERE';
        whereClause += ` arr.request_date >= $${paramIndex}`;
        params.push(filters.date_from);
      }

      if (filters.date_to) {
        paramIndex++;
        whereClause += whereClause ? ' AND' : 'WHERE';
        whereClause += ` arr.request_date <= $${paramIndex}`;
        params.push(filters.date_to);
      }

      if (filters.employee_id) {
        paramIndex++;
        whereClause += whereClause ? ' AND' : 'WHERE';
        whereClause += ` arr.employee_id = $${paramIndex}`;
        params.push(parseInt(filters.employee_id));
      }

      // Get total count
      const countResult = await client.query(
        `SELECT COUNT(*) as total 
         FROM attendance_regularization_requests arr
         ${whereClause}`,
        params
      );
      const total = parseInt(countResult.rows[0].total);

      // Get requests with user names
      const limit = filters.limit || 20;
      const offset = filters.offset || 0;
      paramIndex++;
      params.push(limit);
      paramIndex++;
      params.push(offset);

      const result = await client.query(
        `SELECT 
          arr.*,
          emp.name as employee_name,
          ga.name as group_admin_name,
          mgmt.name as management_name,
          fa.name as final_approver_name
         FROM attendance_regularization_requests arr
         LEFT JOIN users emp ON arr.employee_id = emp.id
         LEFT JOIN users ga ON arr.group_admin_id = ga.id
         LEFT JOIN users mgmt ON arr.management_id = mgmt.id
         LEFT JOIN users fa ON arr.final_approved_by = fa.id
         ${whereClause}
         ORDER BY arr.created_at DESC
         LIMIT $${paramIndex - 1} OFFSET $${paramIndex}`,
        params
      );

      return {
        requests: result.rows,
        total
      };
    } finally {
      client.release();
    }
  }

  /**
   * Get a specific request by ID
   */
  async getRequestById(requestId: number): Promise<RegularizationRequest> {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT 
          arr.*,
          emp.name as employee_name,
          ga.name as group_admin_name,
          mgmt.name as management_name,
          fa.name as final_approver_name
         FROM attendance_regularization_requests arr
         LEFT JOIN users emp ON arr.employee_id = emp.id
         LEFT JOIN users ga ON arr.group_admin_id = ga.id
         LEFT JOIN users mgmt ON arr.management_id = mgmt.id
         LEFT JOIN users fa ON arr.final_approved_by = fa.id
         WHERE arr.id = $1`,
        [requestId]
      );

      if (result.rows.length === 0) {
        throw new Error('Request not found');
      }

      return result.rows[0];
    } finally {
      client.release();
    }
  }

  /**
   * Approve or reject a request
   */
  async processApproval(
    requestId: number,
    approverId: number,
    approverRole: string,
    action: 'approve' | 'reject',
    comments?: string
  ): Promise<RegularizationRequest> {
    const client = await pool.connect();
    try {
      // Get the current request
      const request = await this.getRequestById(requestId);

      // Validate approver permissions
      if (!this.canApprove(request, approverId, approverRole)) {
        throw new Error('You are not authorized to approve this request');
      }

      let newStatus: string = '';
      let nextApproverRole: string | null = null;
      let managementId: number | null = null;

      if (action === 'approve') {
        // Determine approval flow based on who submitted the request
        if (request.employee_id === approverId) {
          // Self-approval (management approving their own request)
          newStatus = 'approved';
          nextApproverRole = null;
        } else if (approverRole === 'group-admin') {
          // Group admin approving employee request - this is final approval
          newStatus = 'approved';
          nextApproverRole = null;
        } else if (approverRole === 'management') {
          // Management approving group admin request - this is final approval
          newStatus = 'approved';
          nextApproverRole = null;
        }
      } else {
        newStatus = 'rejected';
        nextApproverRole = null;
      }

      // Update the request
      const updateFields = ['status = $1', 'updated_at = CURRENT_TIMESTAMP'];
      const updateParams: any[] = [newStatus];
      let paramIndex = 1;

      if (approverRole === 'group-admin') {
        paramIndex++;
        updateFields.push(`group_admin_approved_at = CURRENT_TIMESTAMP`);
        updateFields.push(`group_admin_comments = $${paramIndex}`);
        updateParams.push(comments || null);
        
        if (managementId) {
          paramIndex++;
          updateFields.push(`management_id = $${paramIndex}`);
          updateParams.push(managementId);
        }
      } else if (approverRole === 'management') {
        paramIndex++;
        updateFields.push(`management_approved_at = CURRENT_TIMESTAMP`);
        updateFields.push(`management_comments = $${paramIndex}`);
        updateParams.push(comments || null);
        paramIndex++;
        updateFields.push(`final_approved_by = $${paramIndex}`);
        updateParams.push(approverId);
        updateFields.push(`final_approved_at = CURRENT_TIMESTAMP`);
        paramIndex++;
        updateFields.push(`final_comments = $${paramIndex}`);
        updateParams.push(comments || null);
      }

      if (nextApproverRole) {
        paramIndex++;
        updateFields.push(`current_approver_role = $${paramIndex}`);
        updateParams.push(nextApproverRole);
      } else {
        updateFields.push(`current_approver_role = NULL`);
      }

      paramIndex++;
      updateParams.push(requestId);

      await client.query(
        `UPDATE attendance_regularization_requests 
         SET ${updateFields.join(', ')}
         WHERE id = $${paramIndex}`,
        updateParams
      );

      // Add to approval history
      const actionType = action === 'approve' 
        ? `${approverRole.replace('-', '_')}_approved` 
        : `${approverRole.replace('-', '_')}_rejected`;
      
      await this.addApprovalHistory(
        requestId,
        approverId,
        approverRole,
        actionType,
        comments
      );

      // Send notifications
      if (action === 'approve' && nextApproverRole === 'management' && managementId) {
        // Notify management
        await this.sendNotification(
          requestId,
          managementId,
          'approval_needed',
          'Regularization Request Approved by Group Admin',
          `A regularization request has been approved by group admin and requires your final approval.`,
          { request_id: requestId, employee_id: request.employee_id }
        );
      }

      // Notify employee of the decision
      await this.sendNotification(
        requestId,
        request.employee_id,
        action === 'approve' ? 'approved' : 'rejected',
        `Regularization Request ${action === 'approve' ? 'Approved' : 'Rejected'}`,
        `Your regularization request has been ${action === 'approve' ? 'approved' : 'rejected'}${comments ? ` with comments: ${comments}` : '.'}`,
        { request_id: requestId, status: newStatus }
      );

      return await this.getRequestById(requestId);
    } finally {
      client.release();
    }
  }

  /**
   * Get approval history for a request
   */
  async getApprovalHistory(requestId: number): Promise<ApprovalHistory[]> {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT 
          rah.*,
          u.name as approver_name
         FROM regularization_approval_history rah
         LEFT JOIN users u ON rah.approver_id = u.id
         WHERE rah.request_id = $1
         ORDER BY rah.action_timestamp ASC`,
        [requestId]
      );

      return result.rows;
    } finally {
      client.release();
    }
  }

  /**
   * Cancel a request (only by the employee who created it)
   */
  async cancelRequest(requestId: number, employeeId: number, reason?: string): Promise<RegularizationRequest> {
    const client = await pool.connect();
    try {
      const request = await this.getRequestById(requestId);

      if (request.employee_id !== employeeId) {
        throw new Error('You can only cancel your own requests');
      }

      if (request.status === 'approved' || request.status === 'rejected') {
        throw new Error('Cannot cancel an already processed request');
      }

      await client.query(
        `UPDATE attendance_regularization_requests 
         SET status = 'cancelled', 
             updated_at = CURRENT_TIMESTAMP,
             current_approver_role = NULL
         WHERE id = $1`,
        [requestId]
      );

      // Add to approval history
      await this.addApprovalHistory(
        requestId,
        employeeId,
        'employee',
        'cancelled',
        reason || 'Request cancelled by employee'
      );

      return await this.getRequestById(requestId);
    } finally {
      client.release();
    }
  }

  /**
   * Get statistics for regularization requests
   */
  async getStatistics(userId: number, userRole: string): Promise<any> {
    const client = await pool.connect();
    try {
      let whereClause = '';
      let params: any[] = [userId];

      switch (userRole) {
        case 'employee':
          whereClause = 'WHERE employee_id = $1';
          break;
        case 'group-admin':
          whereClause = 'WHERE group_admin_id = $1 AND employee_id != $1';
          break;
        case 'management':
          whereClause = 'WHERE management_id = $1 OR (status = \'pending\' AND current_approver_role = \'management\')';
          break;
        case 'super-admin':
          whereClause = '';
          params = [];
          break;
      }

      const result = await client.query(
        `SELECT 
          COUNT(*) as total_requests,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_requests,
          COUNT(CASE WHEN status = 'group_admin_approved' THEN 1 END) as group_admin_approved,
          COUNT(CASE WHEN status = 'management_approved' THEN 1 END) as management_approved,
          COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_requests,
          COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_requests,
          COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_requests,
          COUNT(CASE WHEN request_type = 'time_adjustment' THEN 1 END) as time_adjustments,
          COUNT(CASE WHEN request_type = 'missing_shift' THEN 1 END) as missing_shifts,
          COUNT(CASE WHEN request_type = 'early_departure' THEN 1 END) as early_departures,
          COUNT(CASE WHEN request_type = 'late_arrival' THEN 1 END) as late_arrivals
         FROM attendance_regularization_requests
         ${whereClause}`,
        params
      );

      return result.rows[0];
    } finally {
      client.release();
    }
  }

  // Private helper methods

  private async validateRequestData(data: any): Promise<void> {
    if (!data.request_date || !data.requested_start_time || !data.requested_end_time) {
      throw new Error('Required fields are missing');
    }

    // Validate that requested end time is after start time
    const startTime = data.requested_start_time;
    const endTime = data.requested_end_time;

    if (startTime && endTime) {
      // Convert time strings to comparable format (HH:MM)
      const startTimeStr = startTime.toString().trim();
      const endTimeStr = endTime.toString().trim();

      if (startTimeStr >= endTimeStr) {
        throw new Error('Requested end time must be after start time');
      }
    }

    if (!data.reason || data.reason.trim().length < 10) {
      throw new Error('Reason must be at least 10 characters long');
    }

    const validTypes = ['time_adjustment', 'missing_shift', 'early_departure', 'late_arrival'];
    if (!validTypes.includes(data.request_type)) {
      throw new Error('Invalid request type');
    }

    // Validate shift_id if provided
    if (data.shift_id !== undefined && data.shift_id !== null) {
      const shiftId = Number(data.shift_id);
      if (!Number.isInteger(shiftId) || shiftId <= 0) {
        throw new Error('shift_id must be a positive integer');
      }
    }

    // Validate original times if provided (for non-missing shift requests)
    if (data.original_start_time && data.original_end_time) {
      const origStartTimeStr = data.original_start_time.toString().trim();
      const origEndTimeStr = data.original_end_time.toString().trim();

      if (origStartTimeStr >= origEndTimeStr) {
        throw new Error('Original end time must be after start time');
      }
    }
  }

  private canApprove(request: RegularizationRequest, approverId: number, approverRole: string): boolean {
    if (request.status === 'approved' || request.status === 'rejected' || request.status === 'cancelled') {
      return false;
    }

    // Self-approval: Management can approve their own requests
    if (request.employee_id === approverId && approverRole === 'management') {
      return request.status === 'pending';
    }

    // Group Admin approval: Group admin can approve employee requests
    if (approverRole === 'group-admin' && request.employee_id !== approverId) {
      return request.status === 'pending' && request.group_admin_id === approverId;
    }

    // Management approval: Management can approve group admin requests
    if (approverRole === 'management' && request.employee_id !== approverId) {
      return request.status === 'pending' && request.management_id === approverId;
    }

    return false;
  }

  private async addApprovalHistory(
    requestId: number,
    approverId: number,
    approverRole: string,
    action: string,
    comments?: string
  ): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query(
        `INSERT INTO regularization_approval_history (
          request_id, approver_id, approver_role, action, comments
        ) VALUES ($1, $2, $3, $4, $5)`,
        [requestId, approverId, approverRole, action, comments || null]
      );
    } finally {
      client.release();
    }
  }

  private async sendNotification(
    requestId: number,
    recipientId: number,
    notificationType: string,
    title: string,
    message: string,
    data?: any
  ): Promise<void> {
    const client = await pool.connect();
    try {
      // Store notification in database
      await client.query(
        `INSERT INTO regularization_notifications (
          request_id, recipient_id, notification_type, title, message, notification_data
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [requestId, recipientId, notificationType, title, message, data ? JSON.stringify(data) : null]
      );

      // Send push notification
      try {
        const notificationService = new NotificationService();
        await notificationService.sendPushNotification(
          {
            id: 0,
            user_id: recipientId.toString(),
            title,
            message,
            type: 'regularization',
            priority: 'high',
            data: { 
              screen: '/(dashboard)/attendance-regularization',
              ...data 
            }
          },
          [recipientId.toString()]
        );
      } catch (error) {
        console.error('Failed to send push notification:', error);
        // Don't throw error as the notification is already stored in database
      }
    } finally {
      client.release();
    }
  }
}
