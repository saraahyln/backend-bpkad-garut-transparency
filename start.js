const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");

console.log("🚀 Starting Backend Setup and Server...\n");

// Check if .env file exists
const envPath = path.join(__dirname, ".env");
if (!fs.existsSync(envPath)) {
  console.error("❌ .env file not found!");
  console.log("📝 Please create a .env file with the following content:");
  console.log(`
DATABASE_URL="postgresql://neondb_owner:npg_GuSTkY1V5eva@ep-delicate-darkness-a8qmcze9-pooler.eastus2.azure.neon.tech/neondb?sslmode=require&channel_binding=require"
PORT=5000
NODE_ENV=development
CACHE_TTL=300
  `);
  process.exit(1);
}

// Function to run command and return promise
function runCommand(command, description) {
  return new Promise((resolve, reject) => {
    console.log(`⏳ ${description}...`);
    exec(command, { cwd: __dirname }, (error, stdout, stderr) => {
      if (error) {
        console.error(`❌ ${description} failed:`, error.message);
        reject(error);
      } else {
        console.log(`✅ ${description} completed`);
        if (stdout) console.log(stdout);
        resolve(stdout);
      }
    });
  });
}

async function setupAndStart() {
  try {
    // Step 1: Install dependencies
    await runCommand("npm install", "Installing dependencies");

    // Step 2: Generate Prisma client
    await runCommand("npx prisma generate", "Generating Prisma client");

    // Step 3: Push database schema
    await runCommand("npx prisma db push", "Pushing database schema");

    console.log("\n🎉 Setup completed successfully!");
    console.log("🌐 Starting server on http://localhost:5000");
    console.log("📊 API Documentation available at http://localhost:5000");
    console.log("\n💡 Available endpoints:");
    console.log("  - GET /health - Server health check");
    console.log("  - GET /api/health - API health check");
    console.log("  - GET /api/tahun-anggaran - Budget years");
    console.log("  - GET /api/kategori-apbd - Budget categories");
    console.log("  - GET /api/transaksi-apbd - Budget transactions");
    console.log("  - GET /api/dashboard - Dashboard summary");
    console.log('\n🧪 Run "npm run test" to test all APIs\n');

    // Step 4: Start the server
    require("./server.js");
  } catch (error) {
    console.error("\n❌ Setup failed:", error.message);
    console.log("\n🔧 Troubleshooting:");
    console.log("1. Check your DATABASE_URL in .env file");
    console.log("2. Make sure your database is accessible");
    console.log('3. Run "npm install" manually if needed');
    console.log("4. Check if port 5000 is available");
    process.exit(1);
  }
}

setupAndStart();
