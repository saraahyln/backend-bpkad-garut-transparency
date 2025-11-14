// Script untuk memastikan database dan tabel sudah ada
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function fixDatabase() {
  try {
    console.log("Memeriksa dan memperbaiki database...");

    // First, try to create the table if it doesn't exist
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "Kategori_APBD" (
        id_kategori SERIAL PRIMARY KEY,
        id_parent INT NULL,
        jenis VARCHAR(50) CHECK (jenis IN ('Pendapatan','Belanja','Pembiayaan')),
        nama_kategori VARCHAR(255) NOT NULL,
        kode VARCHAR(50),
        level INT DEFAULT 1,
        CONSTRAINT fk_parent FOREIGN KEY (id_parent) REFERENCES "Kategori_APBD"(id_kategori)
      )
    `;

    console.log("Tabel Kategori_APBD sudah ada atau berhasil dibuat");

    const count = await prisma.kategoriApbd.count();
    console.log(`Jumlah kategori saat ini: ${count}`);

    const maxCategory = await prisma.kategoriApbd.findFirst({
      orderBy: { idKategori: "desc" },
    });

    if (maxCategory) {
      const nextId = maxCategory.idKategori + 1;
      await prisma.$executeRaw`SELECT setval(pg_get_serial_sequence('"Kategori_APBD"', 'id_kategori'), ${nextId})`;
      console.log(`Sequence berhasil direset ke ${nextId}`);
    } else {
      console.log("Tidak ada data kategori, sequence akan mulai dari 1");
    }

    console.log("Database berhasil diperbaiki!");
    console.log("Sekarang Anda bisa menambahkan kategori baru!");
  } catch (error) {
    console.error("Error fixing database:", error);

    if (error.code === "P2010") {
      console.log("Mencoba membuat tabel dengan SQL langsung...");
      try {
        await prisma.$executeRaw`
          CREATE TABLE IF NOT EXISTS "Kategori_APBD" (
            id_kategori SERIAL PRIMARY KEY,
            id_parent INT NULL,
            jenis VARCHAR(50) CHECK (jenis IN ('Pendapatan','Belanja','Pembiayaan')),
            nama_kategori VARCHAR(255) NOT NULL,
            kode VARCHAR(50),
            level INT DEFAULT 1
          )
        `;
        console.log("Tabel berhasil dibuat dengan SQL langsung!");
      } catch (sqlError) {
        console.error("Gagal membuat tabel:", sqlError);
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}

fixDatabase();
