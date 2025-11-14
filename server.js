const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression"); // uncommented compression for production
const rateLimit = require("express-rate-limit"); // uncommented rate limiting for production
require("dotenv").config();

const { prisma, cache } = require("./config/database");

// Initialize
const app = express();

// Middleware
app.use(helmet());
app.use(
  helmet({
    contentSecurityPolicy:
      process.env.NODE_ENV === "production" ? undefined : false,
    crossOriginEmbedderPolicy: false,
  })
);
app.use(compression()); // enabled compression for better performance

app.use(
  cors({
    origin: [
      process.env.FRONTEND_URL || "https://frontend-bpkad-garut-transparency-steel.vercel.app",
      "http://localhost:3000",
      "http://localhost:3001",
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === "production" ? 100 : 1000, // stricter limit in production
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/", limiter);

app.get("/", (req, res) => {
  res.json({
    message: "API Backend BPKAD Garut Transparansi Keuangan",
    version: "1.0.0",
    status: "Aktif",
    endpoints: {
      dashboard: "/api/dashboard - Data ringkasan dashboard",
      apbd: "/api/apbd - Data APBD detail",
      auth: "/api/auth - Authentication endpoints",
      admin: "/api/admin - Panel administrasi",
      tahunAnggaran: "/api/tahun-anggaran - Manajemen tahun anggaran",
      kategoriApbd: "/api/kategori-apbd - Manajemen kategori APBD",
      transaksiApbd: "/api/transaksi-apbd - Manajemen transaksi APBD",
      health: "/health - Status kesehatan server",
    },
    database: "Terhubung ke Neon PostgreSQL",
  });
});

// Routes
app.use("/api/dashboard", require("./routes/dashboard"));
app.use("/api/apbd", require("./routes/apbd"));
app.use("/api/auth", require("./routes/auth")); // Added route for auth
app.use("/api/admin", require("./routes/admin"));
app.use("/api/user-management", require("./routes/user-management")); // Added user management route
app.use("/api/tahun-anggaran", require("./routes/tahun-anggaran"));
app.use("/api/kategori-apbd", require("./routes/kategori-apbd"));
app.use("/api/transaksi-apbd", require("./routes/transaksi-apbd"));

// Health check
app.get("/health", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: "OK",
      database: "Connected",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      status: "ERROR",
      database: "Disconnected",
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

app.get("/api/health", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    const dbTest = await prisma.tahunAnggaran.count();
    res.json({
      status: "OK",
      database: "Connected",
      tablesAccessible: true,
      totalYears: dbTest,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      status: "ERROR",
      database: "Disconnected",
      tablesAccessible: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: "Terjadi kesalahan server!",
    message:
      process.env.NODE_ENV === "development"
        ? err.message
        : "Internal server error",
  });
});

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({ error: "Rute tidak ditemukan" });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`🌐 Access: http://localhost:${PORT}`);
  console.log(
    `🔗 Frontend URL: ${process.env.FRONTEND_URL || "http://localhost:3000"}`
  );
});

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("🛑 Shutting down gracefully...");
  await prisma.$disconnect();
  process.exit(0);
});
