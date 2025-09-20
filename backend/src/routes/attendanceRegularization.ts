import express from "express";
import { verifyToken } from "../middleware/auth";
import { CustomRequest } from "../types";
import { AttendanceRegularizationService } from "../services/AttendanceRegularizationService";

const router = express.Router();
const regularizationService = AttendanceRegularizationService.getInstance();

// =====================================================
// EMPLOYEE ROUTES
// =====================================================

/**
 * Create a new regularization request
 * POST /api/attendance-regularization/request
 */
router.post("/request", verifyToken, async (req: CustomRequest, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const {
      shift_id,
      request_date,
      original_start_time,
      original_end_time,
      requested_start_time,
      requested_end_time,
      reason,
      supporting_documents,
      request_type
    } = req.body;

    // Validate required fields
    if (!request_date || !requested_start_time || !requested_end_time || !reason || !request_type) {
      return res.status(400).json({
        error: "Missing required fields",
        required: ["request_date", "requested_start_time", "requested_end_time", "reason", "request_type"]
      });
    }

    const request = await regularizationService.createRequest(req.user.id, {
      shift_id,
      request_date,
      original_start_time,
      original_end_time,
      requested_start_time,
      requested_end_time,
      reason,
      supporting_documents,
      request_type
    });

    res.status(201).json({
      success: true,
      message: "Regularization request created successfully",
      request
    });
  } catch (error) {
    console.error("Error creating regularization request:", error);
    res.status(500).json({
      error: "Failed to create regularization request",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

/**
 * Get regularization requests for the current user
 * GET /api/attendance-regularization/requests
 */
router.get("/requests", verifyToken, async (req: CustomRequest, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const {
      status,
      request_type,
      date_from,
      date_to,
      limit = 20,
      offset = 0
    } = req.query;

    const result = await regularizationService.getRequestsForUser(
      req.user.id,
      req.user.role,
      {
        status: status as string,
        request_type: request_type as string,
        date_from: date_from as string,
        date_to: date_to as string,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      }
    );

    res.json({
      success: true,
      requests: result.requests,
      total: result.total,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string)
    });
  } catch (error) {
    console.error("Error fetching regularization requests:", error);
    res.status(500).json({
      error: "Failed to fetch regularization requests",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

/**
 * Get a specific regularization request
 * GET /api/attendance-regularization/request/:id
 */
router.get("/request/:id", verifyToken, async (req: CustomRequest, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const requestId = parseInt(req.params.id);
    if (isNaN(requestId)) {
      return res.status(400).json({ error: "Invalid request ID" });
    }

    const request = await regularizationService.getRequestById(requestId);

    // Check if user has permission to view this request
    const canView = req.user.role === 'super-admin' ||
      request.employee_id === req.user.id ||
      request.group_admin_id === req.user.id ||
      request.management_id === req.user.id;

    if (!canView) {
      return res.status(403).json({ error: "Access denied" });
    }

    res.json({
      success: true,
      request
    });
  } catch (error) {
    console.error("Error fetching regularization request:", error);
    res.status(500).json({
      error: "Failed to fetch regularization request",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

/**
 * Cancel a regularization request
 * PUT /api/attendance-regularization/request/:id/cancel
 */
router.put("/request/:id/cancel", verifyToken, async (req: CustomRequest, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const requestId = parseInt(req.params.id);
    if (isNaN(requestId)) {
      return res.status(400).json({ error: "Invalid request ID" });
    }

    const { reason } = req.body;

    const request = await regularizationService.cancelRequest(
      requestId,
      req.user.id,
      reason
    );

    res.json({
      success: true,
      message: "Regularization request cancelled successfully",
      request
    });
  } catch (error) {
    console.error("Error cancelling regularization request:", error);
    res.status(500).json({
      error: "Failed to cancel regularization request",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// =====================================================
// APPROVAL ROUTES (Group Admin & Management)
// =====================================================

/**
 * Get requests pending approval for the current user
 * GET /api/attendance-regularization/pending-approvals
 */
router.get("/pending-approvals", verifyToken, async (req: CustomRequest, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (!['group-admin', 'management', 'super-admin'].includes(req.user.role)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }

    const {
      limit = 20,
      offset = 0
    } = req.query;

    const result = await regularizationService.getRequestsForUser(
      req.user.id,
      req.user.role,
      {
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      }
    );

    // Filter for pending approvals based on role
    let pendingRequests = result.requests;
    if (req.user.role === 'group-admin') {
      pendingRequests = result.requests.filter(r => r.status === 'pending');
    } else if (req.user.role === 'management') {
      pendingRequests = result.requests.filter(r => r.status === 'group_admin_approved');
    }

    res.json({
      success: true,
      requests: pendingRequests,
      total: pendingRequests.length,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string)
    });
  } catch (error) {
    console.error("Error fetching pending approvals:", error);
    res.status(500).json({
      error: "Failed to fetch pending approvals",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

/**
 * Approve or reject a regularization request
 * PUT /api/attendance-regularization/request/:id/approve
 */
router.put("/request/:id/approve", verifyToken, async (req: CustomRequest, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (!['group-admin', 'management', 'super-admin'].includes(req.user.role)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }

    const requestId = parseInt(req.params.id);
    if (isNaN(requestId)) {
      return res.status(400).json({ error: "Invalid request ID" });
    }

    const { action, comments } = req.body;

    if (!action || !['approve', 'reject'].includes(action)) {
      return res.status(400).json({
        error: "Invalid action",
        valid_actions: ["approve", "reject"]
      });
    }

    const request = await regularizationService.processApproval(
      requestId,
      req.user.id,
      req.user.role,
      action,
      comments
    );

    res.json({
      success: true,
      message: `Request ${action}d successfully`,
      request
    });
  } catch (error) {
    console.error("Error processing approval:", error);
    res.status(500).json({
      error: "Failed to process approval",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// =====================================================
// HISTORY AND STATISTICS ROUTES
// =====================================================

/**
 * Get approval history for a request
 * GET /api/attendance-regularization/request/:id/history
 */
router.get("/request/:id/history", verifyToken, async (req: CustomRequest, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const requestId = parseInt(req.params.id);
    if (isNaN(requestId)) {
      return res.status(400).json({ error: "Invalid request ID" });
    }

    // First check if user has permission to view this request
    const request = await regularizationService.getRequestById(requestId);
    const canView = req.user.role === 'super-admin' ||
      request.employee_id === req.user.id ||
      request.group_admin_id === req.user.id ||
      request.management_id === req.user.id;

    if (!canView) {
      return res.status(403).json({ error: "Access denied" });
    }

    const history = await regularizationService.getApprovalHistory(requestId);

    res.json({
      success: true,
      history
    });
  } catch (error) {
    console.error("Error fetching approval history:", error);
    res.status(500).json({
      error: "Failed to fetch approval history",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

/**
 * Get regularization statistics
 * GET /api/attendance-regularization/statistics
 */
router.get("/statistics", verifyToken, async (req: CustomRequest, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const statistics = await regularizationService.getStatistics(
      req.user.id,
      req.user.role
    );

    res.json({
      success: true,
      statistics
    });
  } catch (error) {
    console.error("Error fetching statistics:", error);
    res.status(500).json({
      error: "Failed to fetch statistics",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// =====================================================
// ADMIN ROUTES (Super Admin only)
// =====================================================

/**
 * Get all regularization requests (Super Admin only)
 * GET /api/attendance-regularization/admin/all-requests
 */
router.get("/admin/all-requests", verifyToken, async (req: CustomRequest, res) => {
  try {
    if (!req.user?.id || req.user.role !== 'super-admin') {
      return res.status(403).json({ error: "Super admin access required" });
    }

    const {
      status,
      request_type,
      date_from,
      date_to,
      employee_id,
      limit = 50,
      offset = 0
    } = req.query;

    const result = await regularizationService.getRequestsForUser(
      req.user.id,
      req.user.role,
      {
        status: status as string,
        request_type: request_type as string,
        date_from: date_from as string,
        date_to: date_to as string,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      }
    );

    res.json({
      success: true,
      requests: result.requests,
      total: result.total,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string)
    });
  } catch (error) {
    console.error("Error fetching all requests:", error);
    res.status(500).json({
      error: "Failed to fetch all requests",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

export default router;
