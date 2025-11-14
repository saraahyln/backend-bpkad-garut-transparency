const express = require("express");
const { prisma, cache } = require("../config/database");
const { formatCurrency, handleError } = require("../utils/helpers");

const router = express.Router();

// GET /api/tahun-anggaran - Get all budget years
router.get("/", async (req, res) => {
  try {
    console.log(" GET /api/tahun-anggaran called");
    const cacheKey = "tahun_anggaran_all";
    let years = cache.get(cacheKey);
    console.log(" Cache result:", years ? "HIT" : "MISS");

    if (!years) {
      console.log(" Querying database for tahun anggaran...");
      years = await prisma.tahunAnggaran.findMany({
        orderBy: { tahun: "desc" },
        include: {
          _count: {
            select: {
              transaksiApbd: true,
              ringkasanApbd: true,
            },
          },
        },
      });
      console.log(" Database query result:", years);
      console.log(" Found", years.length, "records");
      cache.set(cacheKey, years);
    }

    const response = {
      success: true,
      data: years,
      total: years.length,
    };
    console.log(" Sending response:", response);
    res.json(response);
  } catch (error) {
    console.log(" Error in tahun-anggaran route:", error);
    handleError(res, error, "Gagal mengambil data tahun anggaran");
  }
});

// GET /api/tahun-anggaran/:id - Get specific budget year
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const cacheKey = `tahun_anggaran_${id}`;
    let year = cache.get(cacheKey);

    if (!year) {
      year = await prisma.tahunAnggaran.findUnique({
        where: { idTahun: Number.parseInt(id) },
        include: {
          transaksiApbd: {
            include: {
              kategoriApbd: true,
            },
          },
          ringkasanApbd: true,
        },
      });

      if (year) {
        cache.set(cacheKey, year);
      }
    }

    if (!year) {
      return res.status(404).json({
        success: false,
        message: "Tahun anggaran tidak ditemukan",
      });
    }

    res.json({
      success: true,
      data: year,
    });
  } catch (error) {
    handleError(res, error, "Gagal mengambil data tahun anggaran");
  }
});

// POST /api/tahun-anggaran - Create new budget year
router.post("/", async (req, res) => {
  try {
    const { tahun, nomorPerda, tanggalPenetapan } = req.body;

    // Validation
    if (!tahun) {
      return res.status(400).json({
        success: false,
        message: "Tahun anggaran wajib diisi",
      });
    }

    // Check if year already exists
    const existingYear = await prisma.tahunAnggaran.findFirst({
      where: { tahun: Number.parseInt(tahun) },
    });

    if (existingYear) {
      return res.status(400).json({
        success: false,
        message: "Tahun anggaran sudah ada",
      });
    }

    const newYear = await prisma.tahunAnggaran.create({
      data: {
        tahun: Number.parseInt(tahun),
        nomorPerda,
        tanggalPenetapan: tanggalPenetapan ? new Date(tanggalPenetapan) : null,
      },
    });

    // Clear cache
    cache.flushAll();

    res.status(201).json({
      success: true,
      data: newYear,
      message: "Tahun anggaran berhasil ditambahkan",
    });
  } catch (error) {
    handleError(res, error, "Gagal menambahkan tahun anggaran");
  }
});

// PUT /api/tahun-anggaran/:id - Update budget year
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { tahun, nomorPerda, tanggalPenetapan } = req.body;

    // Check if the new year already exists (excluding current record)
    if (tahun) {
      const existingYear = await prisma.tahunAnggaran.findFirst({
        where: {
          tahun: Number.parseInt(tahun),
          NOT: {
            idTahun: Number.parseInt(id),
          },
        },
      });

      if (existingYear) {
        return res.status(400).json({
          success: false,
          message: "Tahun anggaran sudah ada",
        });
      }
    }

    const updatedYear = await prisma.tahunAnggaran.update({
      where: { idTahun: Number.parseInt(id) },
      data: {
        tahun: tahun ? Number.parseInt(tahun) : undefined,
        nomorPerda,
        tanggalPenetapan: tanggalPenetapan ? new Date(tanggalPenetapan) : null,
      },
    });

    // Clear cache
    cache.flushAll();

    res.json({
      success: true,
      data: updatedYear,
      message: "Tahun anggaran berhasil diperbarui",
    });
  } catch (error) {
    handleError(res, error, "Gagal memperbarui tahun anggaran");
  }
});

// DELETE /api/tahun-anggaran/:id - Delete budget year
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Check if year has transactions
    const transactionCount = await prisma.transaksiApbd.count({
      where: { idTahun: Number.parseInt(id) },
    });

    if (transactionCount > 0) {
      return res.status(400).json({
        success: false,
        message: "Tidak dapat menghapus tahun anggaran yang memiliki transaksi",
      });
    }

    await prisma.tahunAnggaran.delete({
      where: { idTahun: Number.parseInt(id) },
    });

    // Clear cache
    cache.flushAll();

    res.json({
      success: true,
      message: "Tahun anggaran berhasil dihapus",
    });
  } catch (error) {
    handleError(res, error, "Gagal menghapus tahun anggaran");
  }
});

module.exports = router;
