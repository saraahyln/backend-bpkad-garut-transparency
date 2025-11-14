const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function updateBelanjaCategories() {
  try {
    console.log(
      "Starting migration: Update Belanja categories to Pembelanjaan..."
    );

    // Find all categories with jenis "Belanja"
    const belanjaCategories = await prisma.kategoriApbd.findMany({
      where: {
        jenis: "Pembelanjaan",
      },
      select: {
        idKategori: true,
        namaKategori: true,
        jenis: true,
      },
    });

    console.log(
      `Found ${belanjaCategories.length} categories with jenis "Belanja"`
    );

    if (belanjaCategories.length === 0) {
      console.log(
        'No categories found with jenis "Belanja". Migration not needed.'
      );
      return;
    }

    // Update all "Belanja" categories to "Pembelanjaan"
    const updateResult = await prisma.kategoriApbd.updateMany({
      where: {
        jenis: "Pembelanjaan",
      },
      data: {
        jenis: "Belanja",
      },
    });

    console.log(
      `Successfully updated ${updateResult.count} categories from "Belanja" to "Pembelanjaan"`
    );

    // Verify the update
    const updatedCategories = await prisma.kategoriApbd.findMany({
      where: {
        jenis: "Pembelanjaan",
      },
      select: {
        idKategori: true,
        namaKategori: true,
        jenis: true,
      },
    });

    console.log(
      `Verification: Found ${updatedCategories.length} categories with jenis "Pembelanjaan"`
    );
    console.log("Migration completed successfully!");
  } catch (error) {
    console.error("Error during migration:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migration
updateBelanjaCategories()
  .then(() => {
    console.log("Migration script finished");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Migration failed:", error);
    process.exit(1);
  });
