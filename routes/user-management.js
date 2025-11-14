const express = require("express");
const bcrypt = require("bcrypt");
const router = express.Router();
const { prisma } = require("../config/database");
const { handleError } = require("../utils/helpers");

// Get all admin users
router.get("/", async (req, res) => {
  try {
    const users = await prisma.admin.findMany({
      select: {
        idAdmin: true,
        username: true,
        role: true,
      },
      orderBy: { idAdmin: "asc" },
    });

    res.json({
      success: true,
      data: users,
      total: users.length,
    });
  } catch (error) {
    handleError(res, error, "Gagal mengambil data pengguna");
  }
});

// Add new admin user
router.post("/", async (req, res) => {
  try {
    const { username, password, role } = req.body;

    // Validation
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: "Username dan password harus diisi",
      });
    }

    if (username.length < 3) {
      return res.status(400).json({
        success: false,
        error: "Username minimal 3 karakter",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: "Password minimal 6 karakter",
      });
    }

    // Check if username already exists
    const existingUser = await prisma.admin.findUnique({
      where: { username },
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: "Username sudah digunakan",
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user
    const newUser = await prisma.admin.create({
      data: {
        username,
        passwordHash: hashedPassword,
        role: role || "admin",
      },
      select: {
        idAdmin: true,
        username: true,
        role: true,
      },
    });

    res.status(201).json({
      success: true,
      data: newUser,
      message: "Pengguna berhasil ditambahkan",
    });
  } catch (error) {
    handleError(res, error, "Gagal menambahkan pengguna");
  }
});

// Update admin user
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { username, password, role } = req.body;

    // Validation
    if (!username) {
      return res.status(400).json({
        success: false,
        error: "Username harus diisi",
      });
    }

    if (username.length < 3) {
      return res.status(400).json({
        success: false,
        error: "Username minimal 3 karakter",
      });
    }

    // Check if user exists
    const existingUser = await prisma.admin.findUnique({
      where: { idAdmin: Number.parseInt(id) },
    });

    if (!existingUser) {
      return res.status(404).json({
        success: false,
        error: "Pengguna tidak ditemukan",
      });
    }

    // Check if username is taken by another user
    const usernameCheck = await prisma.admin.findUnique({
      where: { username },
    });

    if (usernameCheck && usernameCheck.idAdmin !== Number.parseInt(id)) {
      return res.status(400).json({
        success: false,
        error: "Username sudah digunakan",
      });
    }

    // Prepare update data
    const updateData = {
      username,
      role: role || "admin",
    };

    // Hash new password if provided
    if (password && password.trim() !== "") {
      if (password.length < 6) {
        return res.status(400).json({
          success: false,
          error: "Password minimal 6 karakter",
        });
      }
      updateData.passwordHash = await bcrypt.hash(password, 10);
    }

    // Update user
    const updatedUser = await prisma.admin.update({
      where: { idAdmin: Number.parseInt(id) },
      data: updateData,
      select: {
        idAdmin: true,
        username: true,
        role: true,
      },
    });

    res.json({
      success: true,
      data: updatedUser,
      message: "Pengguna berhasil diperbarui",
    });
  } catch (error) {
    handleError(res, error, "Gagal memperbarui pengguna");
  }
});

// Delete admin user
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user exists
    const existingUser = await prisma.admin.findUnique({
      where: { idAdmin: Number.parseInt(id) },
    });

    if (!existingUser) {
      return res.status(404).json({
        success: false,
        error: "Pengguna tidak ditemukan",
      });
    }

    // Prevent deleting the last admin user
    const totalUsers = await prisma.admin.count();
    if (totalUsers <= 1) {
      return res.status(400).json({
        success: false,
        error: "Tidak dapat menghapus pengguna terakhir",
      });
    }

    // Delete user
    await prisma.admin.delete({
      where: { idAdmin: Number.parseInt(id) },
    });

    res.json({
      success: true,
      message: "Pengguna berhasil dihapus",
    });
  } catch (error) {
    handleError(res, error, "Gagal menghapus pengguna");
  }
});

module.exports = router;
