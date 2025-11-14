const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function setupDatabase() {
  try {
    console.log("🔄 Setting up database...");

    // Test database connection
    await prisma.$connect();
    console.log("✅ Database connected successfully");

    // Check if tables exist by trying to count records
    try {
      const adminCount = await prisma.admin.count();
      console.log(`📊 Found ${adminCount} admin records`);

      const yearCount = await prisma.tahunAnggaran.count();
      console.log(`📊 Found ${yearCount} budget years`);

      const categoryCount = await prisma.kategoriApbd.count();
      console.log(`📊 Found ${categoryCount} categories`);

      const transactionCount = await prisma.transaksiApbd.count();
      console.log(`📊 Found ${transactionCount} transactions`);
    } catch (error) {
      console.log("⚠️  Tables might not exist yet. Run the SQL scripts first.");
      console.log("Error:", error.message);
    }

    console.log("✅ Database setup completed");
  } catch (error) {
    console.error("❌ Database setup failed:", error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

setupDatabase();
