// Script untuk memperbaiki sequence auto-increment
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function fixSequence() {
  try {
    console.log("Memperbaiki sequence auto-increment...");

    // Get the current maximum ID
    const maxCategory = await prisma.kategoriApbd.findFirst({
      orderBy: { idKategori: "desc" },
    });

    const maxId = maxCategory ? maxCategory.idKategori : 0;
    const nextId = maxId + 1;

    // Reset the sequence
    await prisma.$executeRaw`SELECT setval(pg_get_serial_sequence('Kategori_APBD', 'id_kategori'), ${nextId})`;

    console.log(`Sequence berhasil direset ke ${nextId}`);
    console.log("Sekarang Anda bisa menambahkan kategori baru!");
  } catch (error) {
    console.error("Error fixing sequence:", error);
  } finally {
    await prisma.$disconnect();
  }
}

fixSequence();
