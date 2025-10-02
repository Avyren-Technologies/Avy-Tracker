import express, { Response, RequestHandler } from "express";
import bcrypt from "bcryptjs";
import multer from "multer";
import { parse } from "csv-parse/sync";
import { pool } from "../config/database";
import { verifyToken } from "../middleware/auth";
import { CustomRequest, CSVHeaders, ParsedCSV } from "../types";

const upload = multer();
const router = express.Router();

// Get group admins list
router.get("/", verifyToken, async (req: CustomRequest, res: Response) => {
  try {
    if (!["management", "super-admin"].includes(req.user?.role || "")) {
      return res.status(403).json({ error: "Access denied" });
    }

    const result = await pool.query(
      `
      SELECT 
        u.id,
        u.name,
        u.email,
        u.phone,
        u.employee_number,
        u.gender,
        u.created_at,
        c.name as company_name
      FROM users u
      JOIN companies c ON u.company_id = c.id
      WHERE u.role = 'group-admin'
      AND (
        $1 = 'super-admin' 
        OR 
        (u.company_id = (SELECT company_id FROM users WHERE id = $2))
      )
      ORDER BY u.created_at DESC
    `,
      [req.user?.role, req.user?.id],
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching group admins:", error);
    res.status(500).json({ error: "Failed to fetch group admins" });
  }
});

// Helper function to check user limit
async function checkUserLimit(client: any, companyId: number) {
  // Get company details including user limit
  const companyResult = await client.query(
    `SELECT name, user_limit FROM companies WHERE id = $1`,
    [companyId],
  );

  if (!companyResult.rows.length) {
    throw new Error("Company not found");
  }

  const company = companyResult.rows[0];

  // Get current user count for the company (excluding management users)
  const userCountResult = await client.query(
    `SELECT COUNT(*) as count FROM users 
     WHERE company_id = $1 AND role IN ('group-admin', 'employee')`,
    [companyId],
  );

  const currentUserCount = parseInt(userCountResult.rows[0].count);
  const userLimit = parseInt(company.user_limit);

  return {
    canAddUser: currentUserCount < userLimit,
    currentUserCount,
    userLimit,
    companyName: company.name,
  };
}

// Create single group admin
router.post("/", verifyToken, async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  try {
    if (!["management", "super-admin"].includes(req.user?.role || "")) {
      return res.status(403).json({ error: "Access denied" });
    }

    const { name, email, phone, password, gender, employeeNumber } = req.body;

    if (!name || !email || !password || !gender || !employeeNumber) {
      return res.status(400).json({
        error: "Missing required fields",
      });
    }

    // Validate gender value
    const validGenders = ["male", "female", "other"];
    if (!validGenders.includes(gender.toLowerCase())) {
      return res.status(400).json({
        error: "Invalid gender value",
      });
    }

    await client.query("BEGIN");

    let companyId;
    if (req.user?.role === "super-admin") {
      companyId = req.body.company_id;
      if (!companyId) {
        return res
          .status(400)
          .json({ error: "Company ID is required for super admin" });
      }
    } else {
      const userResult = await client.query(
        "SELECT company_id FROM users WHERE id = $1",
        [req.user?.id],
      );
      companyId = userResult.rows[0].company_id;
    }

    // Check if employee number already exists
    const employeeNumberCheck = await client.query(
      "SELECT id FROM users WHERE employee_number = $1",
      [employeeNumber],
    );

    if (employeeNumberCheck.rows.length > 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        errors: { employeeNumber: "Employee number already exists" },
      });
    }

    // Check user limit before creating
    const { canAddUser, currentUserCount, userLimit, companyName } =
      await checkUserLimit(client, companyId);

    if (!canAddUser) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        error: "User limit reached",
        details: {
          message: `Unable to create group admin. Your company (${companyName}) has reached its user limit.`,
          currentCount: currentUserCount,
          limit: userLimit,
        },
      });
    }

    const companyResult = await client.query(
      "SELECT status FROM companies WHERE id = $1",
      [companyId],
    );

    if (
      !companyResult.rows.length ||
      companyResult.rows[0].status !== "active"
    ) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Invalid or inactive company" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const result = await client.query(
      `INSERT INTO users (name, email, phone, password, role, company_id, gender, management_id, employee_number)
       VALUES ($1, $2, $3, $4, 'group-admin', $5, $6, $7, $8)
       RETURNING id, name, email, phone, employee_number, created_at`,
      [
        name,
        email,
        phone || null,
        hashedPassword,
        companyId,
        gender.toLowerCase(),
        req.user?.id,
        employeeNumber,
      ],
    );

    await client.query("COMMIT");
    res.status(201).json(result.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error creating group admin:", error);

    // Handle specific errors
    if (error instanceof Error) {
      if (error.message.includes("users_email_key")) {
        return res.status(400).json({
          errors: { email: "Email already exists" },
        });
      } else if (error.message.includes("users_employee_number_key")) {
        return res.status(400).json({
          errors: { employeeNumber: "Employee number already exists" },
        });
      }
    }

    res.status(500).json({ error: "Failed to create group admin" });
  } finally {
    client.release();
  }
});

// Bulk create group admins from CSV
router.post(
  "/bulk",
  verifyToken,
  upload.single("file") as any,
  async (req: CustomRequest, res: Response) => {
    const client = await pool.connect();
    try {
      if (!["management", "super-admin"].includes(req.user?.role || "")) {
        return res.status(403).json({ error: "Access denied" });
      }

      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      await client.query("BEGIN");

      let companyId;
      if (req.user?.role === "super-admin") {
        companyId = req.body.company_id;
        if (!companyId) {
          return res.status(400).json({ error: "Company ID is required" });
        }
      } else {
        const userResult = await client.query(
          "SELECT company_id FROM users WHERE id = $1",
          [req.user?.id],
        );
        companyId = userResult.rows[0].company_id;
      }

      const fileContent = req.file.buffer.toString();
      const parsedRows: ParsedCSV = parse(fileContent, {
        skip_empty_lines: true,
        trim: true,
      });

      if (parsedRows.length < 2) {
        return res
          .status(400)
          .json({ error: "File is empty or missing headers" });
      }

      // Check user limit before processing bulk creation
      const { canAddUser, currentUserCount, userLimit, companyName } =
        await checkUserLimit(client, companyId);
      const newUsersCount = parsedRows.length - 1; // Subtract 1 for header row

      if (currentUserCount + newUsersCount > userLimit) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error: "User limit exceeded",
          details: {
            message: `Unable to create ${newUsersCount} group admins. Your company (${companyName}) would exceed its user limit.`,
            currentCount: currentUserCount,
            limit: userLimit,
            remainingSlots: userLimit - currentUserCount,
            attemptedToAdd: newUsersCount,
          },
        });
      }

      const headerRow = parsedRows[0];
      const headers: CSVHeaders = {};
      headerRow.forEach((header: string, index: number) => {
        headers[header.toLowerCase()] = index;
      });

      // Validate required headers
      const requiredHeaders = [
        "name",
        "email",
        "employee_number",
        "password",
        "gender",
      ];
      const missingHeaders = requiredHeaders.filter(
        (header) => !(header in headers),
      );
      if (missingHeaders.length > 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error: "CSV file is missing required headers",
          details: `Missing headers: ${missingHeaders.join(", ")}`,
        });
      }

      // Check for duplicate emails in the CSV file
      const emailSet = new Set();
      const duplicateEmails: string[] = [];

      // Also check for duplicate employee numbers
      const employeeNumberSet = new Set();
      const duplicateEmployeeNumbers: string[] = [];

      for (let i = 1; i < parsedRows.length; i++) {
        const email = parsedRows[i][headers["email"]]?.trim();
        if (email) {
          if (emailSet.has(email)) {
            duplicateEmails.push(email);
          } else {
            emailSet.add(email);
          }
        }

        const empNumber = parsedRows[i][headers["employee_number"]]?.trim();
        if (empNumber) {
          if (employeeNumberSet.has(empNumber)) {
            duplicateEmployeeNumbers.push(empNumber);
          } else {
            employeeNumberSet.add(empNumber);
          }
        }
      }

      if (duplicateEmails.length > 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error: "Duplicate emails found in CSV file",
          details: duplicateEmails,
        });
      }

      if (duplicateEmployeeNumbers.length > 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error: "Duplicate employee numbers found in CSV file",
          details: duplicateEmployeeNumbers,
        });
      }

      // Check for existing emails in the database
      const emails = Array.from(emailSet);
      if (emails.length > 0) {
        const existingEmailsResult = await client.query(
          `SELECT email FROM users WHERE email = ANY($1)`,
          [emails],
        );

        if (existingEmailsResult.rows.length > 0) {
          const existingEmails = existingEmailsResult.rows.map(
            (row) => row.email,
          );
          await client.query("ROLLBACK");
          return res.status(400).json({
            error: "Emails already exist in the database",
            details: existingEmails,
          });
        }
      }

      // Check for existing employee numbers in the database
      const employeeNumbers = Array.from(employeeNumberSet);
      if (employeeNumbers.length > 0) {
        const existingEmployeeNumbersResult = await client.query(
          `SELECT employee_number FROM users WHERE employee_number = ANY($1)`,
          [employeeNumbers],
        );

        if (existingEmployeeNumbersResult.rows.length > 0) {
          const existingEmpNumbers = existingEmployeeNumbersResult.rows.map(
            (row) => row.employee_number,
          );
          await client.query("ROLLBACK");
          return res.status(400).json({
            error: "Employee numbers already exist in the database",
            details: existingEmpNumbers,
          });
        }
      }

      const results = [];
      const errors = [];
      let successCount = 0;

      // Email validation regex
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      for (let i = 1; i < parsedRows.length; i++) {
        const row = parsedRows[i];
        try {
          // Skip completely empty rows
          if (row.every((cell) => !cell || cell.trim() === "")) {
            continue;
          }

          const groupAdmin = {
            name: row[headers["name"]]?.trim(),
            email: row[headers["email"]]?.trim(),
            phone: row[headers["phone"]]?.trim(),
            password: row[headers["password"]]?.trim(),
            gender: row[headers["gender"]]?.trim().toLowerCase(),
            employee_number: row[headers["employee_number"]]?.trim(),
          };

          // Validate required fields
          const validationErrors = [];
          if (!groupAdmin.name) validationErrors.push("Name is required");
          if (!groupAdmin.email) validationErrors.push("Email is required");
          else if (!emailRegex.test(groupAdmin.email))
            validationErrors.push("Invalid email format");
          if (!groupAdmin.employee_number)
            validationErrors.push("Employee number is required");
          if (!groupAdmin.password)
            validationErrors.push("Password is required");
          else if (groupAdmin.password.length < 8)
            validationErrors.push("Password must be at least 8 characters");
          if (!groupAdmin.gender) validationErrors.push("Gender is required");
          else {
            const validGenders = ["male", "female", "other"];
            if (!validGenders.includes(groupAdmin.gender)) {
              validationErrors.push("Gender must be male, female, or other");
            }
          }

          if (validationErrors.length > 0) {
            errors.push({
              row: i + 1,
              error: validationErrors.join("; "),
              email: groupAdmin.email || "N/A",
            });
            continue;
          }

          const salt = await bcrypt.genSalt(10);
          const hashedPassword = await bcrypt.hash(groupAdmin.password, salt);

          const result = await client.query(
            `INSERT INTO users (name, email, phone, password, role, company_id, gender, management_id, employee_number)
           VALUES ($1, $2, $3, $4, 'group-admin', $5, $6, $7, $8)
           RETURNING id, name, email, phone, employee_number`,
            [
              groupAdmin.name,
              groupAdmin.email,
              groupAdmin.phone,
              hashedPassword,
              companyId,
              groupAdmin.gender,
              req.user?.id,
              groupAdmin.employee_number,
            ],
          );

          results.push(result.rows[0]);
          successCount++;
        } catch (error: any) {
          console.error(`Error processing row ${i + 1}:`, error);

          let errorMessage = "Failed to create group admin";

          // PostgreSQL error codes
          if (error.code) {
            switch (error.code) {
              case "23505": // unique_violation
                if (error.detail?.includes("email")) {
                  errorMessage = "Email already exists";
                } else if (error.detail?.includes("employee_number")) {
                  errorMessage = "Employee number already exists";
                } else {
                  errorMessage = "Duplicate value found";
                }
                break;
              case "23503": // foreign_key_violation
                errorMessage = "Invalid reference (foreign key violation)";
                break;
              case "23502": // not_null_violation
                errorMessage = "Missing required field";
                break;
              case "22001": // string_data_right_truncation
                errorMessage = "Data too long for column";
                break;
              default:
                errorMessage = `Database error: ${error.code}`;
            }
          }

          // Include the original error detail if available
          if (error.detail) {
            errorMessage += ` - ${error.detail}`;
          }

          errors.push({
            row: i + 1,
            error: errorMessage,
            email: row[headers["email"]]?.trim() || "N/A",
          });
        }
      }

      if (successCount > 0) {
        await client.query("COMMIT");
        res.status(201).json({
          success: results,
          errors,
          summary: {
            total: parsedRows.length - 1,
            success: successCount,
            failed: errors.length,
          },
        });
      } else if (errors.length > 0) {
        await client.query("ROLLBACK");
        res.status(400).json({
          error: "Failed to create any group admins",
          errors,
          summary: {
            total: parsedRows.length - 1,
            success: 0,
            failed: errors.length,
          },
        });
      } else {
        await client.query("ROLLBACK");
        res.status(400).json({ error: "No valid data found in the CSV file" });
      }
    } catch (error: any) {
      await client.query("ROLLBACK");
      console.error("Error in bulk create:", error);
      res.status(500).json({
        error: "Failed to process bulk creation",
        details: error.message || "Unknown server error",
      });
    } finally {
      client.release();
    }
  },
);

// Get employees under a specific group admin (for management)
router.get(
  "/:id/employees",
  verifyToken,
  async (req: CustomRequest, res: Response) => {
    const client = await pool.connect();
    try {
      if (!["management", "super-admin"].includes(req.user?.role || "")) {
        return res.status(403).json({ error: "Access denied" });
      }

      const { id } = req.params;

      // Verify the group admin exists and belongs to the same company
      const groupAdminCheck = await client.query(
        `
        SELECT u.id, u.name, u.email, u.phone, u.employee_number, u.created_at, c.name as company_name
        FROM users u
        JOIN companies c ON u.company_id = c.id
        WHERE u.id = $1 AND u.role = 'group-admin'
        AND (
          $2 = 'super-admin' 
          OR 
          (u.company_id = (SELECT company_id FROM users WHERE id = $3))
        )
      `,
        [id, req.user?.role, req.user?.id],
      );

      if (groupAdminCheck.rows.length === 0) {
        return res.status(404).json({ error: "Group admin not found" });
      }

      const groupAdmin = groupAdminCheck.rows[0];

      // Get employees under this group admin
      const result = await client.query(
        `
        SELECT 
          u.id,
          u.name,
          u.email,
          u.phone,
          u.employee_number,
          u.department,
          u.designation,
          u.gender,
          u.created_at,
          u.can_submit_expenses_anytime,
          u.shift_status
        FROM users u
        WHERE u.group_admin_id = $1
        AND u.role = 'employee'
        ORDER BY u.created_at DESC
      `,
        [id],
      );

      res.json({
        groupAdmin,
        employees: result.rows,
      });
    } catch (error) {
      console.error("Error fetching group admin employees:", error);
      res.status(500).json({ error: "Failed to fetch group admin employees" });
    } finally {
      client.release();
    }
  },
);

// Update group admin details (for management)
router.put(
  "/:id",
  verifyToken,
  async (req: CustomRequest, res: Response) => {
    const client = await pool.connect();
    try {
      if (!["management", "super-admin"].includes(req.user?.role || "")) {
        return res.status(403).json({ error: "Access denied" });
      }

      const { id } = req.params;
      const { name, email, phone, employeeNumber, gender, password } = req.body;

      // Validate required fields
      if (!name || !email || !employeeNumber || !gender) {
        return res.status(400).json({
          error: "Missing required fields",
          errors: {
            name: !name ? "Name is required" : null,
            email: !email ? "Email is required" : null,
            employeeNumber: !employeeNumber ? "Employee number is required" : null,
            gender: !gender ? "Gender is required" : null,
          },
        });
      }

      // Validate password if provided
      if (password && password.length < 6) {
        return res.status(400).json({
          error: "Invalid password",
          errors: {
            password: "Password must be at least 6 characters",
          },
        });
      }

      // Validate gender value
      const validGenders = ["male", "female", "other"];
      if (!validGenders.includes(gender.toLowerCase())) {
        return res.status(400).json({
          error: "Invalid gender value",
          errors: {
            gender: "Gender must be male, female, or other",
          },
        });
      }

      await client.query("BEGIN");

      // Check if group admin exists and belongs to the same company
      const groupAdminCheck = await client.query(
        `
        SELECT id FROM users 
        WHERE id = $1 AND role = 'group-admin'
        AND (
          $2 = 'super-admin' 
          OR 
          (company_id = (SELECT company_id FROM users WHERE id = $3))
        )
      `,
        [id, req.user?.role, req.user?.id],
      );

      if (groupAdminCheck.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Group admin not found" });
      }

      // Check if email or employee number already exists (excluding current user)
      const duplicateCheck = await client.query(
        `
        SELECT id FROM users 
        WHERE (email = $1 OR employee_number = $2) 
        AND id != $3
      `,
        [email, employeeNumber, id],
      );

      if (duplicateCheck.rows.length > 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error: "Email or employee number already exists",
        });
      }

      let result;
      if (password) {
        // Update with password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        
        result = await client.query(
          `
          UPDATE users 
          SET 
            name = $1,
            email = $2,
            phone = $3,
            employee_number = $4,
            gender = $5,
            password = $6,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $7 AND role = 'group-admin'
          RETURNING id, name, email, phone, employee_number, gender, created_at
        `,
          [name, email, phone || null, employeeNumber, gender.toLowerCase(), hashedPassword, id],
        );
      } else {
        // Don't update password
        result = await client.query(
          `
          UPDATE users 
          SET 
            name = $1,
            email = $2,
            phone = $3,
            employee_number = $4,
            gender = $5,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $6 AND role = 'group-admin'
          RETURNING id, name, email, phone, employee_number, gender, created_at
        `,
          [name, email, phone || null, employeeNumber, gender.toLowerCase(), id],
        );
      }

      await client.query("COMMIT");
      res.json(result.rows[0]);
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Error updating group admin:", error);

      // Handle specific errors
      if (error instanceof Error) {
        if (error.message.includes("users_email_key")) {
          return res.status(400).json({
            error: "Email already exists",
          });
        } else if (error.message.includes("users_employee_number_key")) {
          return res.status(400).json({
            error: "Employee number already exists",
          });
        }
      }

      res.status(500).json({ error: "Failed to update group admin" });
    } finally {
      client.release();
    }
  },
);

// Delete group admin (for management)
router.delete(
  "/:id",
  verifyToken,
  async (req: CustomRequest, res: Response) => {
    const client = await pool.connect();
    try {
      if (!["management", "super-admin"].includes(req.user?.role || "")) {
        return res.status(403).json({ error: "Access denied" });
      }

      const { id } = req.params;

      await client.query("BEGIN");

      // Check if group admin exists and belongs to the same company
      const groupAdminCheck = await client.query(
        `
        SELECT id FROM users 
        WHERE id = $1 AND role = 'group-admin'
        AND (
          $2 = 'super-admin' 
          OR 
          (company_id = (SELECT company_id FROM users WHERE id = $3))
        )
      `,
        [id, req.user?.role, req.user?.id],
      );

      if (groupAdminCheck.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Group admin not found" });
      }

      // Check if group admin has employees
      const employeeCheck = await client.query(
        "SELECT COUNT(*) as count FROM users WHERE group_admin_id = $1 AND role = 'employee'",
        [id],
      );

      if (parseInt(employeeCheck.rows[0].count) > 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error: "Cannot delete group admin with existing employees. Please reassign or delete employees first.",
        });
      }

      // Delete related data first to avoid foreign key constraints
      // Delete notifications
      await client.query("DELETE FROM notifications WHERE user_id = $1", [id]);
      
      // Delete device tokens
      await client.query("DELETE FROM device_tokens WHERE user_id = $1", [id]);
      
      // Delete error logs
      await client.query("DELETE FROM error_logs WHERE user_id = $1", [id]);
      
      // Delete support messages
      await client.query("DELETE FROM support_messages WHERE user_id = $1", [id]);

      // Finally delete the group admin
      const result = await client.query(
        "DELETE FROM users WHERE id = $1 AND role = 'group-admin' RETURNING id",
        [id],
      );

      await client.query("COMMIT");
      res.json({ message: "Group admin deleted successfully" });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Error deleting group admin:", error);
      res.status(500).json({ error: "Failed to delete group admin" });
    } finally {
      client.release();
    }
  },
);

// Update employee details (for management)
router.put(
  "/employees/:id",
  verifyToken,
  async (req: CustomRequest, res: Response) => {
    const client = await pool.connect();
    try {
      if (!["management", "super-admin"].includes(req.user?.role || "")) {
        return res.status(403).json({ error: "Access denied" });
      }

      const { id } = req.params;
      const {
        name,
        employeeNumber,
        email,
        phone,
        department,
        designation,
        gender,
        can_submit_expenses_anytime,
        password,
      } = req.body;

      // Validate required fields
      if (!name || !email || !employeeNumber || !department || !gender) {
        return res.status(400).json({
          error: "Missing required fields",
          errors: {
            name: !name ? "Name is required" : null,
            employeeNumber: !employeeNumber ? "Employee number is required" : null,
            email: !email ? "Email is required" : null,
            department: !department ? "Department is required" : null,
            gender: !gender ? "Gender is required" : null,
          },
        });
      }

      // Validate gender value
      const validGenders = ["male", "female", "other"];
      if (!validGenders.includes(gender.toLowerCase())) {
        return res.status(400).json({
          error: "Invalid gender value",
          errors: {
            gender: "Gender must be male, female, or other",
          },
        });
      }

      // Validate password if provided
      if (password && password.length < 6) {
        return res.status(400).json({
          error: "Invalid password",
          errors: {
            password: "Password must be at least 6 characters",
          },
        });
      }

      await client.query("BEGIN");

      // Check if employee exists and belongs to a group admin in the same company
      const employeeCheck = await client.query(
        `
        SELECT e.id, e.group_admin_id 
        FROM users e
        JOIN users ga ON e.group_admin_id = ga.id
        WHERE e.id = $1 AND e.role = 'employee'
        AND (
          $2 = 'super-admin' 
          OR 
          (ga.company_id = (SELECT company_id FROM users WHERE id = $3))
        )
      `,
        [id, req.user?.role, req.user?.id],
      );

      if (employeeCheck.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Employee not found" });
      }

      // Check if email or employee number already exists (excluding current user)
      const duplicateCheck = await client.query(
        `
        SELECT id FROM users 
        WHERE (email = $1 OR employee_number = $2) 
        AND id != $3
      `,
        [email, employeeNumber, id],
      );

      if (duplicateCheck.rows.length > 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error: "Email or employee number already exists",
        });
      }

      let result;
      if (password) {
        // Update with password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        
        result = await client.query(
          `
          UPDATE users 
          SET 
            name = $1,
            employee_number = $2,
            email = $3,
            phone = $4,
            department = $5,
            designation = $6,
            gender = $7,
            can_submit_expenses_anytime = $8,
            password = $9,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $10 AND role = 'employee'
          RETURNING id, name, employee_number, email, phone, department, designation, gender, can_submit_expenses_anytime, created_at
        `,
          [
            name,
            employeeNumber,
            email,
            phone || null,
            department,
            designation || null,
            gender.toLowerCase(),
            can_submit_expenses_anytime || false,
            hashedPassword,
            id,
          ],
        );
      } else {
        // Don't update password
        result = await client.query(
          `
          UPDATE users 
          SET 
            name = $1,
            employee_number = $2,
            email = $3,
            phone = $4,
            department = $5,
            designation = $6,
            gender = $7,
            can_submit_expenses_anytime = $8,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $9 AND role = 'employee'
          RETURNING id, name, employee_number, email, phone, department, designation, gender, can_submit_expenses_anytime, created_at
        `,
          [
            name,
            employeeNumber,
            email,
            phone || null,
            department,
            designation || null,
            gender.toLowerCase(),
            can_submit_expenses_anytime || false,
            id,
          ],
        );
      }

      await client.query("COMMIT");
      res.json(result.rows[0]);
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Error updating employee:", error);

      // Handle specific errors
      if (error instanceof Error) {
        if (error.message.includes("users_email_key")) {
          return res.status(400).json({
            error: "Email already exists",
          });
        } else if (error.message.includes("users_employee_number_key")) {
          return res.status(400).json({
            error: "Employee number already exists",
          });
        }
      }

      res.status(500).json({ error: "Failed to update employee" });
    } finally {
      client.release();
    }
  },
);

// Delete employee (for management)
router.delete(
  "/employees/:id",
  verifyToken,
  async (req: CustomRequest, res: Response) => {
    const client = await pool.connect();
    try {
      if (!["management", "super-admin"].includes(req.user?.role || "")) {
        return res.status(403).json({ error: "Access denied" });
      }

      const { id } = req.params;

      await client.query("BEGIN");

      // Check if employee exists and belongs to a group admin in the same company
      const employeeCheck = await client.query(
        `
        SELECT e.id, e.group_admin_id 
        FROM users e
        JOIN users ga ON e.group_admin_id = ga.id
        WHERE e.id = $1 AND e.role = 'employee'
        AND (
          $2 = 'super-admin' 
          OR 
          (ga.company_id = (SELECT company_id FROM users WHERE id = $3))
        )
      `,
        [id, req.user?.role, req.user?.id],
      );

      if (employeeCheck.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Employee not found" });
      }

      // Delete related data first to avoid foreign key constraints
      // Delete leave balances
      await client.query("DELETE FROM leave_balances WHERE user_id = $1", [id]);
      
      // Delete leave requests
      await client.query("DELETE FROM leave_requests WHERE user_id = $1", [id]);
      
      // Delete employee shifts
      await client.query("DELETE FROM employee_shifts WHERE user_id = $1", [id]);
      
      // Delete expenses
      await client.query("DELETE FROM expenses WHERE user_id = $1", [id]);
      
      // Delete employee tasks (both assigned to and assigned by)
      await client.query("DELETE FROM employee_tasks WHERE assigned_to = $1 OR assigned_by = $1", [id]);
      
      // Delete notifications
      await client.query("DELETE FROM notifications WHERE user_id = $1", [id]);
      
      // Delete expense documents (via expenses table)
      await client.query(`
        DELETE FROM expense_documents 
        WHERE expense_id IN (
          SELECT id FROM expenses WHERE user_id = $1
        )
      `, [id]);
      
      // Delete employee schedule
      await client.query("DELETE FROM employee_schedule WHERE user_id = $1", [id]);
      
      // Delete user tracking permissions
      await client.query("DELETE FROM user_tracking_permissions WHERE user_id = $1", [id]);
      
      // Delete additional related data
      await client.query("DELETE FROM employee_locations WHERE user_id = $1", [id]);
      await client.query("DELETE FROM device_tokens WHERE user_id = $1", [id]);
      await client.query("DELETE FROM tracking_analytics WHERE user_id = $1", [id]);
      await client.query("DELETE FROM geofence_events WHERE user_id = $1", [id]);
      await client.query("DELETE FROM chat_messages WHERE user_id = $1", [id]);
      await client.query("DELETE FROM error_logs WHERE user_id = $1", [id]);
      await client.query("DELETE FROM support_messages WHERE user_id = $1", [id]);

      // Finally delete the employee
      const result = await client.query(
        "DELETE FROM users WHERE id = $1 AND role = 'employee' RETURNING id",
        [id],
      );

      await client.query("COMMIT");
      res.json({ message: "Employee deleted successfully" });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Error deleting employee:", error);
      res.status(500).json({ error: "Failed to delete employee" });
    } finally {
      client.release();
    }
  },
);

export default router;
