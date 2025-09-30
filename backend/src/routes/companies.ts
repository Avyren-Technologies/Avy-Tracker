import express, { Response, RequestHandler } from "express";
import bcrypt from "bcryptjs";
import { pool } from "../config/database";
import { verifyToken, requireSuperAdmin } from "../middleware/auth";
import { CustomRequest } from "../types";
import multer from "multer";
import { Buffer } from "buffer";

// Import the initializeDefaultLeaveTypes function from leave-management
const initializeDefaultLeaveTypes = async (companyId: number) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Default leave types
    const defaultLeaveTypes = [
      {
        name: "Privilege/Earned Leave (PL/EL)",
        description: "Accrues monthly for planned vacations or personal time off",
        requires_documentation: false,
        max_days: 18,
        is_paid: true,
        is_active: true,
      },
      {
        name: "Casual Leave (CL)",
        description: "For urgent or unforeseen personal matters",
        requires_documentation: false,
        max_days: 12,
        is_paid: true,
        is_active: true,
      },
      {
        name: "Sick Leave (SL)",
        description: "For health-related absences",
        requires_documentation: true,
        max_days: 12,
        is_paid: true,
        is_active: true,
      },
      {
        name: "Maternity Leave (ML)",
        description: "For pre- and post-natal care",
        requires_documentation: true,
        max_days: 90,
        is_paid: true,
        is_active: true,
      },
      {
        name: "Child Care Leave",
        description: "For childcare responsibilities",
        requires_documentation: false,
        max_days: 15,
        is_paid: true,
        is_active: true,
      },
      {
        name: "Child Adoption Leave",
        description: "For adoptive parents",
        requires_documentation: true,
        max_days: 90,
        is_paid: true,
        is_active: true,
      },
      {
        name: "Compensatory Off",
        description: "Granted in lieu of extra hours worked",
        requires_documentation: false,
        max_days: 0,
        is_paid: true,
        is_active: true,
      },
      {
        name: "Marriage Leave",
        description: "For employee's own wedding",
        requires_documentation: true,
        max_days: 5,
        is_paid: true,
        is_active: true,
      },
      {
        name: "Paternity Leave",
        description: "For male employees following child birth",
        requires_documentation: true,
        max_days: 10,
        is_paid: true,
        is_active: true,
      },
      {
        name: "Bereavement Leave",
        description: "Upon death of immediate family member",
        requires_documentation: true,
        max_days: 5,
        is_paid: true,
        is_active: true,
      },
      {
        name: "Leave Without Pay (LWP)",
        description: "Unpaid leave beyond allocated quota",
        requires_documentation: false,
        max_days: 0,
        is_paid: false,
        is_active: true,
      },
      {
        name: "Sabbatical Leave",
        description: "Extended leave after long service",
        requires_documentation: true,
        max_days: 180,
        is_paid: false,
        is_active: true,
      },
      {
        name: "Half Pay Leave (HPL)",
        description: "Leave with half salary",
        requires_documentation: false,
        max_days: 20,
        is_paid: true,
        is_active: true,
      },
      {
        name: "Commuted Leave",
        description: "Conversion of half pay leave to full pay",
        requires_documentation: true,
        max_days: 10,
        is_paid: true,
        is_active: true,
      },
      {
        name: "Leave Not Due (LND)",
        description: "Advance leave against future accruals",
        requires_documentation: true,
        max_days: 10,
        is_paid: true,
        is_active: true,
      },
      {
        name: "Special Casual Leave (SCL)",
        description: "For specific purposes like blood donation, sports events",
        requires_documentation: true,
        max_days: 10,
        is_paid: true,
        is_active: true,
      },
    ];

    // Insert leave types and store their IDs
    const leaveTypeIds: { [key: string]: number } = {};
    for (const type of defaultLeaveTypes) {
      const result = await client.query(
        `INSERT INTO leave_types 
        (name, description, requires_documentation, max_days, is_paid, is_active, company_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (name, company_id) DO UPDATE 
        SET description = EXCLUDED.description,
            requires_documentation = EXCLUDED.requires_documentation,
            max_days = EXCLUDED.max_days,
            is_paid = EXCLUDED.is_paid,
            is_active = EXCLUDED.is_active
        RETURNING id`,
        [
          type.name,
          type.description,
          type.requires_documentation,
          type.max_days,
          type.is_paid,
          type.is_active,
          companyId,
        ],
      );
      leaveTypeIds[type.name] = result.rows[0].id;
    }

    // Default leave policies
    const defaultPolicies = [
      {
        leave_type_id: leaveTypeIds["Privilege/Earned Leave (PL/EL)"],
        default_days: 18,
        carry_forward_days: 30,
        min_service_days: 180,
        requires_approval: true,
        notice_period_days: 7,
        max_consecutive_days: 15,
        gender_specific: null,
      },
      {
        leave_type_id: leaveTypeIds["Casual Leave (CL)"],
        default_days: 12,
        carry_forward_days: 0,
        min_service_days: 90,
        requires_approval: true,
        notice_period_days: 1,
        max_consecutive_days: 3,
        gender_specific: null,
      },
      {
        leave_type_id: leaveTypeIds["Sick Leave (SL)"],
        default_days: 12,
        carry_forward_days: 0,
        min_service_days: 90,
        requires_approval: true,
        notice_period_days: 0,
        max_consecutive_days: 5,
        gender_specific: null,
      },
      {
        leave_type_id: leaveTypeIds["Maternity Leave (ML)"],
        default_days: 90,
        carry_forward_days: 0,
        min_service_days: 180,
        requires_approval: true,
        notice_period_days: 30,
        max_consecutive_days: 90,
        gender_specific: "female",
      },
      {
        leave_type_id: leaveTypeIds["Child Care Leave"],
        default_days: 15,
        carry_forward_days: 0,
        min_service_days: 180,
        requires_approval: true,
        notice_period_days: 7,
        max_consecutive_days: 15,
        gender_specific: null,
      },
      {
        leave_type_id: leaveTypeIds["Child Adoption Leave"],
        default_days: 90,
        carry_forward_days: 0,
        min_service_days: 180,
        requires_approval: true,
        notice_period_days: 30,
        max_consecutive_days: 90,
        gender_specific: null,
      },
      {
        leave_type_id: leaveTypeIds["Compensatory Off"],
        default_days: 0,
        carry_forward_days: 0,
        min_service_days: 90,
        requires_approval: true,
        notice_period_days: 1,
        max_consecutive_days: 2,
        gender_specific: null,
      },
      {
        leave_type_id: leaveTypeIds["Marriage Leave"],
        default_days: 5,
        carry_forward_days: 0,
        min_service_days: 180,
        requires_approval: true,
        notice_period_days: 15,
        max_consecutive_days: 5,
        gender_specific: null,
      },
      {
        leave_type_id: leaveTypeIds["Paternity Leave"],
        default_days: 10,
        carry_forward_days: 0,
        min_service_days: 180,
        requires_approval: true,
        notice_period_days: 15,
        max_consecutive_days: 10,
        gender_specific: "male",
      },
      {
        leave_type_id: leaveTypeIds["Bereavement Leave"],
        default_days: 5,
        carry_forward_days: 0,
        min_service_days: 90,
        requires_approval: true,
        notice_period_days: 0,
        max_consecutive_days: 5,
        gender_specific: null,
      },
      {
        leave_type_id: leaveTypeIds["Leave Without Pay (LWP)"],
        default_days: 0,
        carry_forward_days: 0,
        min_service_days: 90,
        requires_approval: true,
        notice_period_days: 7,
        max_consecutive_days: 30,
        gender_specific: null,
      },
      {
        leave_type_id: leaveTypeIds["Sabbatical Leave"],
        default_days: 180,
        carry_forward_days: 0,
        min_service_days: 2555, // 7 years
        requires_approval: true,
        notice_period_days: 90,
        max_consecutive_days: 180,
        gender_specific: null,
      },
      {
        leave_type_id: leaveTypeIds["Half Pay Leave (HPL)"],
        default_days: 20,
        carry_forward_days: 0,
        min_service_days: 180,
        requires_approval: true,
        notice_period_days: 7,
        max_consecutive_days: 20,
        gender_specific: null,
      },
      {
        leave_type_id: leaveTypeIds["Commuted Leave"],
        default_days: 10,
        carry_forward_days: 0,
        min_service_days: 180,
        requires_approval: true,
        notice_period_days: 7,
        max_consecutive_days: 10,
        gender_specific: null,
      },
      {
        leave_type_id: leaveTypeIds["Leave Not Due (LND)"],
        default_days: 10,
        carry_forward_days: 0,
        min_service_days: 365,
        requires_approval: true,
        notice_period_days: 7,
        max_consecutive_days: 10,
        gender_specific: null,
      },
      {
        leave_type_id: leaveTypeIds["Special Casual Leave (SCL)"],
        default_days: 10,
        carry_forward_days: 0,
        min_service_days: 90,
        requires_approval: true,
        notice_period_days: 7,
        max_consecutive_days: 10,
        gender_specific: null,
      },
    ];

    // Insert leave policies
    for (const policy of defaultPolicies) {
      const leaveTypeName = Object.keys(leaveTypeIds).find(
        (key) => leaveTypeIds[key] === policy.leave_type_id,
      );

      if (!leaveTypeName || !leaveTypeIds[leaveTypeName]) {
        console.error(
          `Invalid leave type ID: ${policy.leave_type_id} for policy creation`,
        );
        continue;
      }

      await client.query(
        `INSERT INTO leave_policies 
         (leave_type_id, default_days, carry_forward_days, min_service_days,
          requires_approval, notice_period_days, max_consecutive_days,
          gender_specific, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
         ON CONFLICT (leave_type_id) DO UPDATE 
         SET default_days = EXCLUDED.default_days,
             carry_forward_days = EXCLUDED.carry_forward_days,
             min_service_days = EXCLUDED.min_service_days,
             requires_approval = EXCLUDED.requires_approval,
             notice_period_days = EXCLUDED.notice_period_days,
             max_consecutive_days = EXCLUDED.max_consecutive_days,
             gender_specific = EXCLUDED.gender_specific,
             is_active = true
         RETURNING id`,
        [
          policy.leave_type_id,
          policy.default_days,
          policy.carry_forward_days,
          policy.min_service_days,
          policy.requires_approval,
          policy.notice_period_days,
          policy.max_consecutive_days,
          policy.gender_specific,
        ],
      );
    }

    await client.query("COMMIT");
    console.log(
      `Successfully initialized ${Object.keys(leaveTypeIds).length} leave types and policies for company ${companyId}`,
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(
      "Error initializing default leave types and policies:",
      error,
    );
    throw error;
  } finally {
    client.release();
  }
};

// Configure multer for handling file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
});

const router = express.Router();

// Get all companies
router.get(
  "/",
  verifyToken,
  requireSuperAdmin,
  async (req: CustomRequest, res: Response) => {
    try {
      const result = await pool.query(`
      SELECT 
        c.id,
        c.name,
        c.email,
        c.phone,
        c.status,
        c.created_at,
        c.user_limit,
        encode(c.logo, 'base64') as logo,
        (
          SELECT json_build_object(
            'name', u.name,
            'email', u.email,
            'phone', u.phone
          )
          FROM users u 
          WHERE u.company_id = c.id AND u.role = 'management'
          LIMIT 1
        ) as management,
        (
          SELECT COUNT(*) 
          FROM users 
          WHERE company_id = c.id AND role != 'management'
        ) as user_count
      FROM companies c
      ORDER BY c.name
    `);

      const companies = result.rows.map((company) => ({
        ...company,
        management: company.management || null,
        user_count: parseInt(company.user_count) || 0,
        user_limit: parseInt(company.user_limit) || 50,
      }));

      res.json(companies);
    } catch (error) {
      console.error("Error fetching companies:", error);
      res.status(500).json({ error: "Failed to fetch companies" });
    }
  },
);

// Create new company with management account and logo
router.post(
  "/",
  verifyToken,
  requireSuperAdmin,
  upload.single("logo") as any, // Handle file upload
  async (req: CustomRequest, res: Response) => {
    const client = await pool.connect();
    try {
      const {
        companyName,
        companyEmail,
        companyPhone,
        companyAddress,
        managementName,
        managementEmail,
        managementPhone,
        managementPassword,
        managementGender,
        managementEmployeeNumber,
        userLimit,
      } = req.body;

      // Validate required fields
      if (
        !companyName ||
        !companyEmail ||
        !managementName ||
        !managementEmail ||
        !managementPassword ||
        !managementGender ||
        !managementEmployeeNumber
      ) {
        return res.status(400).json({
          error: "Missing required fields",
        });
      }

      // Validate gender value
      const validGenders = ["male", "female", "other"];
      if (!validGenders.includes(managementGender.toLowerCase())) {
        return res.status(400).json({
          error: "Invalid gender value",
        });
      }

      await client.query("BEGIN");

      // Check for existing company
      const existingCompany = await client.query(
        "SELECT id FROM companies WHERE email = $1",
        [companyEmail],
      );

      if (existingCompany.rows.length > 0) {
        throw new Error("Company with this email already exists");
      }

      // Check for existing user
      const existingUser = await client.query(
        "SELECT id FROM users WHERE email = $1",
        [managementEmail],
      );

      if (existingUser.rows.length > 0) {
        throw new Error("Management email already exists");
      }

      // Handle logo conversion to base64 if provided
      let logoBase64 = null;
      if (req.file) {
        logoBase64 = Buffer.from(req.file.buffer).toString("base64");
      }

      // Insert company with logo
      const companyResult = await client.query(
        `INSERT INTO companies (
          name, 
          email, 
          phone,
          address, 
          status, 
          user_limit,
          logo
        )
        VALUES ($1, $2, $3, $4, 'active', $5, $6)
        RETURNING id`,
        [
          companyName,
          companyEmail,
          companyPhone,
          companyAddress,
          userLimit || 50,
          logoBase64 ? Buffer.from(logoBase64, "base64") : null,
        ],
      );

      const companyId = companyResult.rows[0].id;

      // Create management account
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(managementPassword, salt);

      await client.query(
        `INSERT INTO users (
          name, 
          email, 
          phone, 
          password, 
          role,
          gender,
          company_id,
          employee_number
        )
        VALUES ($1, $2, $3, $4, 'management', $5, $6, $7)`,
        [
          managementName,
          managementEmail,
          managementPhone,
          hashedPassword,
          managementGender.toLowerCase(),
          companyId,
          managementEmployeeNumber,
        ],
      );

      await client.query("COMMIT");

      // Initialize default leave types and policies for the new company
      try {
        await initializeDefaultLeaveTypes(companyId);
        console.log(`Successfully initialized leave types for company ${companyId}`);
      } catch (leaveInitError) {
        // Log the error but don't fail the company creation
        console.error(`Failed to initialize leave types for company ${companyId}:`, leaveInitError);
      }

      res.status(201).json({
        message: "Company created successfully",
        companyId: companyId,
      });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Transaction error:", error);

      let errorMessage = "Failed to create company";
      if (error instanceof Error) {
        if (error.message.includes("companies_email_key")) {
          errorMessage = "Company email already exists";
        } else if (error.message.includes("users_email_key")) {
          errorMessage = "Management email already exists";
        } else if (error.message.includes("users_phone_key")) {
          errorMessage = "Phone number already exists";
        } else if (error.message.includes("users_employee_number_key")) {
          errorMessage = "Employee number already exists";
        }
      }

      res.status(500).json({
        error: errorMessage,
        details: process.env.NODE_ENV === "development" ? error : undefined,
      });
    } finally {
      client.release();
    }
  },
);

// Update company status
router.patch(
  "/:id/toggle-status",
  verifyToken,
  requireSuperAdmin,
  async (req: CustomRequest, res: Response) => {
    const client = await pool.connect();
    try {
      const { id } = req.params;

      if (!id || isNaN(Number(id))) {
        return res.status(400).json({ error: "Invalid company ID" });
      }

      await client.query("BEGIN");

      // First check if company exists and get current status
      const companyCheck = await client.query(
        `SELECT id, status, name FROM companies WHERE id = $1`,
        [id],
      );

      if (companyCheck.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Company not found" });
      }

      const company = companyCheck.rows[0];
      const newStatus = company.status === "active" ? "disabled" : "active";

      // Update company status
      await client.query("UPDATE companies SET status = $1 WHERE id = $2", [
        newStatus,
        id,
      ]);

      // If company is being disabled, invalidate all user tokens
      if (newStatus === "disabled") {
        // Get count of affected users for logging
        const userCount = await client.query(
          `SELECT COUNT(*) FROM users WHERE company_id = $1 AND role != 'super-admin'`,
          [id],
        );

        await client.query(
          `UPDATE users 
         SET token_version = COALESCE(token_version, 0) + 1 
         WHERE company_id = $1 AND role != 'super-admin'`,
          [id],
        );

        console.log(
          `Invalidated tokens for ${userCount.rows[0].count} users in company ${company.name}`,
        );
      }

      await client.query("COMMIT");

      // Return the new status with detailed message
      res.json({
        status: newStatus,
        message: `Company ${company.name} ${newStatus === "active" ? "activated" : "disabled"} successfully`,
        company_id: id,
      });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Error toggling company status:", error);

      // Send more specific error message
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      res.status(500).json({
        error: "Failed to update company status",
        details:
          process.env.NODE_ENV === "development" ? errorMessage : undefined,
      });
    } finally {
      client.release();
    }
  },
);

// Delete company and all associated data
router.delete(
  "/:id",
  verifyToken,
  requireSuperAdmin,
  async (req: CustomRequest, res: Response) => {
    const client = await pool.connect();
    try {
      const { id } = req.params;

      await client.query("BEGIN");

      // Delete all related data in correct order
      await client.query(
        "DELETE FROM expenses WHERE user_id IN (SELECT id FROM users WHERE company_id = $1)",
        [id],
      );
      await client.query(
        "DELETE FROM employee_shifts WHERE user_id IN (SELECT id FROM users WHERE company_id = $1)",
        [id],
      );
      await client.query(
        "DELETE FROM notifications WHERE user_id IN (SELECT id FROM users WHERE company_id = $1)",
        [id],
      );
      await client.query(
        "DELETE FROM expense_documents WHERE user_id IN (SELECT id FROM users WHERE company_id = $1)",
        [id],
      );
      await client.query(
        "DELETE FROM leave_requests WHERE user_id IN (SELECT id FROM users WHERE company_id = $1)",
        [id],
      );
      await client.query(
        "DELETE FROM employee_schedule WHERE user_id IN (SELECT id FROM users WHERE company_id = $1)",
        [id],
      );
      await client.query(
        "DELETE FROM employee_tasks WHERE assigned_to IN (SELECT id FROM users WHERE company_id = $1)",
        [id],
      );
      await client.query("DELETE FROM users WHERE company_id = $1", [id]);
      await client.query("DELETE FROM companies WHERE id = $1", [id]);

      await client.query("COMMIT");
      res.json({
        message: "Company and all associated data deleted successfully",
      });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Error deleting company:", error);
      res.status(500).json({ error: "Failed to delete company" });
    } finally {
      client.release();
    }
  },
);

// Get company hierarchy
router.get(
  "/:id/hierarchy",
  verifyToken,
  requireSuperAdmin,
  async (req: CustomRequest, res: Response) => {
    const client = await pool.connect();
    try {
      const { id } = req.params;

      const companyResult = await client.query(
        `SELECT id, name, email, status
       FROM companies
       WHERE id = $1`,
        [id],
      );

      if (companyResult.rows.length === 0) {
        return res.status(404).json({ error: "Company not found" });
      }

      const company = companyResult.rows[0];

      // Get all related data
      const [managementResult, groupAdminsResult, employeesResult] =
        await Promise.all([
          client.query(
            `SELECT id, name, email, phone, created_at
         FROM users
         WHERE company_id = $1 AND role = 'management'`,
            [id],
          ),
          client.query(
            `SELECT 
          ga.id,
          ga.name,
          ga.email,
          ga.phone,
          ga.created_at,
          COUNT(e.id) as employee_count
         FROM users ga
         LEFT JOIN users e ON e.group_admin_id = ga.id AND e.role = 'employee'
         WHERE ga.company_id = $1 AND ga.role = 'group-admin'
         GROUP BY ga.id, ga.name, ga.email, ga.phone, ga.created_at`,
            [id],
          ),
          client.query(
            `SELECT 
          e.id,
          e.name,
          e.email,
          e.phone,
          e.employee_number,
          e.department,
          e.designation,
          e.created_at,
          ga.id as group_admin_id,
          ga.name as group_admin_name
         FROM users e
         JOIN users ga ON e.group_admin_id = ga.id
         WHERE ga.company_id = $1 AND e.role = 'employee'
         ORDER BY ga.name, e.name`,
            [id],
          ),
        ]);

      const hierarchy = {
        ...company,
        management: managementResult.rows,
        group_admins: groupAdminsResult.rows.map((admin) => ({
          ...admin,
          employees: employeesResult.rows
            .filter((emp) => emp.group_admin_id === admin.id)
            .map((emp) => ({
              id: emp.id,
              name: emp.name,
              email: emp.email,
              phone: emp.phone,
              employee_number: emp.employee_number,
              department: emp.department,
              designation: emp.designation,
              created_at: emp.created_at,
            })),
        })),
      };

      res.json(hierarchy);
    } catch (error) {
      console.error("Error fetching company hierarchy:", error);
      res.status(500).json({ error: "Failed to fetch company hierarchy" });
    } finally {
      client.release();
    }
  },
);

// Add endpoint to update user limit
router.patch(
  "/:id/user-limit",
  verifyToken,
  requireSuperAdmin,
  async (req: CustomRequest, res: Response) => {
    const client = await pool.connect();
    try {
      const { id } = req.params;
      const { userLimit } = req.body;

      if (!userLimit || isNaN(userLimit) || userLimit < 1) {
        return res.status(400).json({ error: "Invalid user limit" });
      }

      await client.query("BEGIN");

      const result = await client.query(
        "UPDATE companies SET user_limit = $1 WHERE id = $2 RETURNING *",
        [userLimit, id],
      );

      if (result.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Company not found" });
      }

      await client.query("COMMIT");
      res.json({ user_limit: result.rows[0].user_limit });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Error updating user limit:", error);
      res.status(500).json({ error: "Failed to update user limit" });
    } finally {
      client.release();
    }
  },
);

// Add other company-related routes...

export default router;
