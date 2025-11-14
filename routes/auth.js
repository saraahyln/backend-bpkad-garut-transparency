const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const router = express.Router();
const { prisma } = require("../config/database");
const { handleError } = require("../utils/helpers");

// JWT Secret (in production, use environment variable)
const JWT_SECRET =
  process.env.JWT_SECRET || "your-secret-key-change-in-production";

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res
      .status(401)
      .json({ success: false, error: "Access token required" });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res
        .status(403)
        .json({ success: false, error: "Invalid or expired token" });
    }
    req.user = user;
    next();
  });
};

router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    res.header("Access-Control-Allow-Origin", process.env.FRONTEND_URL || "http://localhost:3000");
    res.header("Access-Control-Allow-Credentials", "true");

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: "Username dan password harus diisi",
      });
    }

    console.log(" Login attempt for username:", username);

    // Find admin user
    const admin = await prisma.admin.findUnique({
      where: { username },
    });

    if (!admin) {
      console.log(" Admin not found for username:", username);
      return res.status(401).json({
        success: false,
        error: "Username tidak ditemukan",
      });
    }

    let isValidPassword = false;

    // Check if password is already hashed (starts with $2b$ for bcrypt)
    if (admin.passwordHash.startsWith("$2b$")) {
      isValidPassword = await bcrypt.compare(password, admin.passwordHash);
    } else {
      // For plain text passwords in database (temporary during migration)
      isValidPassword = password === admin.passwordHash;

      // If login successful with plain text, hash it for future use
      if (isValidPassword) {
        const hashedPassword = await bcrypt.hash(password, 10);
        await prisma.admin.update({
          where: { idAdmin: admin.idAdmin },
          data: { passwordHash: hashedPassword },
        });
      }
    }

    if (!isValidPassword) {
      console.log(" Invalid password for username:", username);
      return res.status(401).json({
        success: false,
        error: "Password salah",
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        idAdmin: admin.idAdmin,
        username: admin.username,
        role: admin.role,
      },
      JWT_SECRET,
      { expiresIn: "24h" }
    );

    console.log(" Login successful for username:", username);

    res.json({
      success: true,
      data: {
        user: {
          idAdmin: admin.idAdmin,
          username: admin.username,
          role: admin.role,
        },
        token,
      },
      message: "Login successful",
    });
  } catch (error) {
    console.error(" Login error:", error);
    handleError(res, error, "Login failed");
  }
});

router.get("/verify", authenticateToken, async (req, res) => {
  try {
    // Get user info from token
    const admin = await prisma.admin.findUnique({
      where: { idAdmin: req.user.idAdmin },
      select: {
        idAdmin: true,
        username: true,
        role: true,
      },
    });

    if (!admin) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    res.json({
      success: true,
      data: {
        user: admin,
      },
    });
  } catch (error) {
    handleError(res, error, "Token verification failed");
  }
});

router.post("/logout", authenticateToken, async (req, res) => {
  try {
    // In a more sophisticated setup, you might want to blacklist the token
    // For now, we'll just return success and let the client handle token removal
    res.json({
      success: true,
      message: "Logout successful",
    });
  } catch (error) {
    handleError(res, error, "Logout failed");
  }
});

module.exports = router;
