import { Pool } from "pg";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";

dotenv.config();

// Function to get CA certificate from environment variable or file
const getCACertificate = (): string => {
  // First, try to get from environment variable
  if (process.env.DATABASE_CA_CERT) {
    console.log("Using CA certificate from environment variable");
    return process.env.DATABASE_CA_CERT;
  }
  
  // Fallback to file if environment variable is not set
  const caPath = path.join(__dirname, "ca.pem");
  try {
    if (fs.existsSync(caPath)) {
      console.log("Using CA certificate from file:", caPath);
      return fs.readFileSync(caPath).toString();
    } else {
      console.warn("CA certificate file not found at:", caPath);
      console.warn("Please set DATABASE_CA_CERT environment variable or ensure ca.pem file exists");
      throw new Error("CA certificate not found in environment variable or file");
    }
  } catch (error) {
    console.error("Error reading CA certificate:", error);
    throw error;
  }
};

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, // Allow self-signed certificates
    ca: process.env.DATABASE_CA_CERT || undefined,
  },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Database initialization functions
export const initDB = async () => {
  try {
    await seedUsers();

    // Setup face verification system
    try {
      const { setupFaceVerification } = await import(
        "../scripts/setupFaceVerification"
      );
      await setupFaceVerification();
    } catch (error) {
      console.warn("Face verification setup failed:", error);
      console.warn("Face verification features may not work properly");
    }

    console.log("Database initialized successfully");
  } catch (error) {
    console.error("Error initializing database:", error);
    throw error;
  }
};

export const seedUsers = async () => {
  try {
    const existingUsers = await pool.query("SELECT * FROM users");
    if (existingUsers.rows.length > 0) {
      console.log("Users already exist, skipping seed");
      return;
    }

    const salt = await bcrypt.genSalt(10);

    const users = [
      {
        name: "Employee",
        email: "employee@avytrack.com",
        phone: "+919876543974",
        hashedPassword: await bcrypt.hash("Avytrack_employee", salt),
        role: "employee",
      },
      {
        name: "Avytrack Admin",
        email: "admin@avytrack.com",
        phone: "+919876543288",
        hashedPassword: await bcrypt.hash("Avytrack_admin", salt),
        role: "group-admin",
      },
      {
        name: "Avytrack Manager",
        email: "manager@loginwaresofttec.com",
        phone: "+919876543839",
        hashedPassword: await bcrypt.hash("Avytrack_manager", salt),
        role: "management",
      },
      {
        name: "Avytrack Super Admin",
        email: "super@avytrack.com",
        phone: "+919876543253",
        hashedPassword: await bcrypt.hash("Avytrack_super", salt),
        role: "super-admin",
      },
    ];

    for (const user of users) {
      await pool.query(
        `INSERT INTO users (name, email, phone, password, role)
         VALUES ($1, $2, $3, $4, $5)`,
        [user.name, user.email, user.phone, user.hashedPassword, user.role],
      );
    }

    console.log("Test users created successfully");
  } catch (error) {
    console.error("Error seeding users:", error);
  }
};
