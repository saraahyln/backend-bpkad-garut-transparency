const axios = require("axios");

const BASE_URL = "http://localhost:5000/api";

async function testAPIs() {
  console.log("🧪 Testing Backend APIs...\n");

  try {
    // Test server health
    console.log("🏥 Testing server health...");
    const healthResponse = await axios.get(`${BASE_URL}/health`);
    console.log("✅ Server is healthy");

    // Test Tahun Anggaran
    console.log("📅 Testing Tahun Anggaran API...");
    const tahunResponse = await axios.get(`${BASE_URL}/tahun-anggaran`);
    console.log(`✅ Found ${tahunResponse.data.total} tahun anggaran`);
    console.log("Sample data:", tahunResponse.data.data[0]);

    // Test Kategori APBD
    console.log("\n📊 Testing Kategori APBD API...");
    const kategoriResponse = await axios.get(`${BASE_URL}/kategori-apbd`);
    console.log(`✅ Found ${kategoriResponse.data.total} kategori`);
    console.log("Sample data:", kategoriResponse.data.data[0]);

    // Test Transaksi APBD
    console.log("\n💰 Testing Transaksi APBD API...");
    const transaksiResponse = await axios.get(`${BASE_URL}/transaksi-apbd`);
    console.log(`✅ Found ${transaksiResponse.data.total} transaksi`);
    console.log("Sample data:", transaksiResponse.data.data[0]);

    // Test Dashboard Summary
    console.log("\n📈 Testing Dashboard Summary API...");
    const dashboardResponse = await axios.get(
      `${BASE_URL}/dashboard/summary/2024`
    );
    console.log("✅ Dashboard summary data retrieved successfully");
    console.log("Dashboard summary:", dashboardResponse.data);

    // Test Dashboard Comparison
    console.log("\n📊 Testing Dashboard Comparison API...");
    const comparisonResponse = await axios.get(
      `${BASE_URL}/dashboard/comparison`
    );
    console.log("✅ Dashboard comparison data retrieved successfully");
    console.log(
      `Found ${comparisonResponse.data.length} years of comparison data`
    );

    // Test specific year data
    console.log("\n📊 Testing specific year data (2024)...");
    const yearDataResponse = await axios.get(
      `${BASE_URL}/transaksi-apbd/tahun/3`
    );
    console.log(
      `✅ Found ${yearDataResponse.data.total} transactions for 2024`
    );

    console.log("\n🎉 All APIs are working correctly!");
  } catch (error) {
    console.error("❌ API Test Failed:", error.message);
    if (error.response) {
      console.error("Status:", error.response.status);
      console.error("Response:", error.response.data);
    } else if (error.code === "ECONNREFUSED") {
      console.error(
        "🚨 Server is not running! Please start the backend server first."
      );
      console.error("Run: cd backend && npm run dev");
    }
  }
}

// Add health check endpoint test
async function testConnection() {
  try {
    console.log("🔌 Testing database connection...");
    const response = await axios.get(`${BASE_URL}/health`);
    console.log("✅ Database connection successful");
    return true;
  } catch (error) {
    console.error("❌ Database connection failed:", error.message);
    return false;
  }
}

// Run tests
async function runAllTests() {
  console.log("🚀 Starting API Tests...\n");

  const isConnected = await testConnection();
  if (isConnected) {
    await testAPIs();
  } else {
    console.log("\n💡 Troubleshooting tips:");
    console.log("1. Make sure the backend server is running: npm run dev");
    console.log("2. Check your .env file has the correct DATABASE_URL");
    console.log("3. Run the database setup: npm run setup");
  }
}

runAllTests();
