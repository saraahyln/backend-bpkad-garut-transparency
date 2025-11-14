const express = require("express");
const router = express.Router();
const { prisma, cache } = require("../config/database");
const { handleError } = require("../utils/helpers");

// Get APBD categories with hierarchy
router.get("/categories/:jenis?", async (req, res) => {
  try {
    const jenis = req.params.jenis;
    const cacheKey = `apbd_categories_${jenis || "all"}`;

    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json({
        success: true,
        data: cached,
        total: cached.length,
      });
    }

    const whereClause = jenis ? { jenis } : {};

    const categories = await prisma.kategoriApbd.findMany({
      where: whereClause,
      include: {
        children: {
          include: {
            children: true,
          },
        },
      },
      orderBy: [{ level: "asc" }, { idKategori: "asc" }],
    });

    cache.set(cacheKey, categories);
    res.json({
      success: true,
      data: categories,
      total: categories.length,
    });
  } catch (error) {
    handleError(res, error, "Gagal mengambil kategori APBD");
  }
});

// Get detailed transactions by category and year
router.get("/transactions/:year/:categoryId?", async (req, res) => {
  try {
    const year = Number.parseInt(req.params.year);
    const categoryId = req.params.categoryId
      ? Number.parseInt(req.params.categoryId)
      : null;
    const cacheKey = `apbd_transactions_${year}_${categoryId || "all"}`;

    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json({
        success: true,
        data: cached,
        total: cached.length,
      });
    }

    const whereClause = {
      tahunAnggaran: { tahun: year },
    };

    if (categoryId) {
      whereClause.idKategori = categoryId;
    }

    const transactions = await prisma.transaksiApbd.findMany({
      where: whereClause,
      include: {
        kategoriApbd: {
          include: {
            parent: true,
          },
        },
        tahunAnggaran: true,
      },
      orderBy: {
        kategoriApbd: {
          idKategori: "asc",
        },
      },
    });

    cache.set(cacheKey, transactions);
    res.json({
      success: true,
      data: transactions,
      total: transactions.length,
    });
  } catch (error) {
    handleError(res, error, "Gagal mengambil transaksi APBD");
  }
});

// Get aggregated data by jenis (Pendapatan/Belanja/Pembiayaan)
router.get("/summary/:year/:jenis", async (req, res) => {
  try {
    const year = Number.parseInt(req.params.year);
    const jenis = req.params.jenis;
    const cacheKey = `apbd_summary_${year}_${jenis}`;

    console.log(
      `[Backend] 🔍 Getting summary for year: ${year}, jenis: ${jenis}`
    );

    const cached = cache.get(cacheKey);
    if (cached) {
      console.log(
        `[Backend] 📦 Returning cached data for ${cacheKey}:`,
        cached
      );
      return res.json({
        success: true,
        data: cached,
      });
    }

    const dataExists = await prisma.transaksiApbd.count({
      where: {
        tahunAnggaran: { tahun: year },
        kategoriApbd: {
          jenis: jenis,
        },
      },
    });

    console.log(
      `[Backend] 📊 Found ${dataExists} total transactions for ${jenis} in ${year}`
    );

    if (dataExists === 0) {
      console.log(`[Backend] ⚠️ No data found for ${jenis} in ${year}`);
      return res.json({
        success: true,
        data: [],
      });
    }

    const summary = await prisma.transaksiApbd.findMany({
      where: {
        tahunAnggaran: { tahun: year },
        kategoriApbd: {
          jenis: jenis,
          level: 2, // Get level 2 categories (subcategories)
        },
      },
      include: {
        kategoriApbd: true,
      },
    });

    console.log(
      `[Backend] 📊 Found ${summary.length} level-2 transactions for ${jenis} in ${year}`
    );

    const result = summary.map((item) => ({
      kategori: item.kategoriApbd.namaKategori,
      jumlah: Number(item.jumlah), // Ensure it's a number
      persentase: 0, // Will be calculated on frontend
    }));

    console.log(`[Backend] ✅ Returning summary data:`, result);

    cache.set(cacheKey, result);
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error(`[Backend] ❌ Error in summary endpoint:`, error);
    handleError(res, error, "Gagal mengambil ringkasan APBD");
  }
});

// Get hierarchical revenue breakdown by categories and subcategories
router.get("/revenue-breakdown/:year", async (req, res) => {
  try {
    const year = Number.parseInt(req.params.year);
    const cacheKey = `revenue_breakdown_${year}`;

    console.log(`[Backend] 🔍 Getting revenue breakdown for year: ${year}`);

    const cached = cache.get(cacheKey);
    if (cached) {
      console.log(
        `[Backend] 📦 Returning cached revenue breakdown for ${year}`
      );
      return res.json({
        success: true,
        data: cached,
      });
    }

    // Get all revenue categories with their actual transactions from database
    const revenueData = await prisma.kategoriApbd.findMany({
      where: {
        jenis: "Pendapatan",
      },
      include: {
        transaksiApbd: {
          where: {
            tahunAnggaran: { tahun: year },
          },
        },
      },
      orderBy: [{ level: "asc" }, { idKategori: "asc" }],
    });

    console.log(
      `[Backend] 📊 Found ${revenueData.length} revenue categories for year ${year}`
    );

    // Build hierarchical structure with ONLY real data from database
    const breakdown = [];
    let totalPendapatan = 0;

    // Process each category that has actual data
    revenueData.forEach((category) => {
      const amount = category.transaksiApbd.reduce(
        (sum, t) => sum + Number(t.jumlah),
        0
      );

      // Only include categories that have actual data or transactions
      if (amount > 0 || category.transaksiApbd.length > 0) {
        totalPendapatan += amount;

        breakdown.push({
          kode: category.kode || `4.${category.level}.${category.idKategori}`,
          nama: category.namaKategori,
          jumlah: amount,
          level: category.level,
          isSubCategory: category.level > 1,
        });

        console.log(
          `[Backend] 💰 Level ${category.level} - ${
            category.namaKategori
          }: Rp ${amount.toLocaleString("id-ID")}`
        );
      }
    });

    // Only add total row if there's actual data
    if (totalPendapatan > 0 || breakdown.length > 0) {
      breakdown.push({
        kode: "",
        nama: "Jumlah Pendapatan",
        jumlah: totalPendapatan,
        level: 1,
        isTotal: true,
      });
    }

    console.log(
      `[Backend] ✅ Revenue breakdown generated with ${
        breakdown.length
      } items, total: Rp ${totalPendapatan.toLocaleString("id-ID")}`
    );

    cache.set(cacheKey, breakdown);
    res.json({
      success: true,
      data: breakdown,
    });
  } catch (error) {
    console.error(`[Backend] ❌ Error in revenue breakdown endpoint:`, error);
    handleError(res, error, "Gagal mengambil breakdown pendapatan");
  }
});

// Get hierarchical expenditure breakdown by categories and subcategories
router.get("/expenditure-breakdown/:year", async (req, res) => {
  try {
    const year = Number.parseInt(req.params.year);
    const cacheKey = `expenditure_breakdown_${year}`;

    console.log(`[Backend] 🔍 Getting expenditure breakdown for year: ${year}`);

    const cached = cache.get(cacheKey);
    if (cached) {
      console.log(
        `[Backend] 📦 Returning cached expenditure breakdown for ${year}`
      );
      return res.json({
        success: true,
        data: cached,
      });
    }

    // Get all expenditure categories with their actual transactions from database
    const expenditureData = await prisma.kategoriApbd.findMany({
      where: {
        OR: [{ jenis: "Belanja" }, { jenis: "Pembelanjaan" }],
      },
      include: {
        transaksiApbd: {
          where: {
            tahunAnggaran: { tahun: year },
          },
        },
      },
      orderBy: [{ level: "asc" }, { idKategori: "asc" }],
    });

    console.log(
      `[Backend] 📊 Found ${expenditureData.length} expenditure categories for year ${year}`
    );

    // Build hierarchical structure with ONLY real data from database
    const breakdown = [];
    let totalBelanja = 0;

    // Process each category that has actual data
    expenditureData.forEach((category) => {
      const amount = category.transaksiApbd.reduce(
        (sum, t) => sum + Number(t.jumlah),
        0
      );

      // Only include categories that have actual data or transactions
      if (amount > 0 || category.transaksiApbd.length > 0) {
        totalBelanja += amount;

        breakdown.push({
          kode: category.kode || `5.${category.level}.${category.idKategori}`,
          nama: category.namaKategori,
          jumlah: amount,
          level: category.level,
          isSubCategory: category.level > 1,
        });

        console.log(
          `[Backend] 💰 Level ${category.level} - ${
            category.namaKategori
          }: Rp ${amount.toLocaleString("id-ID")}`
        );
      }
    });

    // Only add total row if there's actual data
    if (totalBelanja > 0 || breakdown.length > 0) {
      breakdown.push({
        kode: "",
        nama: "Jumlah Belanja",
        jumlah: totalBelanja,
        level: 1,
        isTotal: true,
      });
    }

    console.log(
      `[Backend] ✅ Expenditure breakdown generated with ${
        breakdown.length
      } items, total: Rp ${totalBelanja.toLocaleString("id-ID")}`
    );

    cache.set(cacheKey, breakdown);
    res.json({
      success: true,
      data: breakdown,
    });
  } catch (error) {
    console.error(
      `[Backend] ❌ Error in expenditure breakdown endpoint:`,
      error
    );
    handleError(res, error, "Gagal mengambil breakdown belanja");
  }
});

// Get hierarchical financing breakdown by categories and subcategories
router.get("/financing-breakdown/:year", async (req, res) => {
  try {
    const year = Number.parseInt(req.params.year);
    const cacheKey = `financing_breakdown_${year}`;

    console.log(`[Backend] 🔍 Getting financing breakdown for year: ${year}`);

    const cached = cache.get(cacheKey);
    if (cached) {
      console.log(
        `[Backend] 📦 Returning cached financing breakdown for ${year}`
      );
      return res.json({
        success: true,
        data: cached,
      });
    }

    // Get all financing categories with their actual transactions
    const financingData = await prisma.kategoriApbd.findMany({
      where: {
        jenis: "Pembiayaan",
        level: { in: [1, 2, 3] }, // Get all levels to show real hierarchy
      },
      include: {
        transaksiApbd: {
          where: {
            tahunAnggaran: { tahun: year },
          },
        },
      },
      orderBy: [{ level: "asc" }, { idKategori: "asc" }],
    });

    console.log(
      `[Backend] 📊 Found ${financingData.length} financing categories for year ${year}`
    );

    // Build hierarchical structure with ONLY real data
    const breakdown = [];

    // Process level 1 (main category)
    const mainCategory = financingData.find((cat) => cat.level === 1);
    if (mainCategory) {
      console.log(
        `[Backend] 📋 Processing main category: ${mainCategory.namaKategori}`
      );

      // Process level 2 categories (subcategories)
      const subCategories = financingData.filter(
        (cat) => cat.level === 2 && cat.idParent === mainCategory.idKategori
      );

      console.log(
        `[Backend] 📊 Found ${subCategories.length} level 2 subcategories`
      );

      subCategories.forEach((subCat, index) => {
        const amount = subCat.transaksiApbd.reduce(
          (sum, t) => sum + Number(t.jumlah),
          0
        );

        console.log(
          `[Backend] 💰 ${subCat.namaKategori}: Rp ${amount.toLocaleString(
            "id-ID"
          )}`
        );

        // Only add if there's actual data or if it's a real category
        if (amount > 0 || subCat.transaksiApbd.length > 0) {
          breakdown.push({
            kode: `6.${index + 1}`,
            nama: subCat.namaKategori,
            jumlah: amount,
            level: 2,
            isSubCategory: true,
          });

          // Process level 3 categories (only real ones from database)
          const level3Categories = financingData.filter(
            (cat) => cat.level === 3 && cat.idParent === subCat.idKategori
          );

          console.log(
            `[Backend] 📊 Found ${level3Categories.length} level 3 categories for ${subCat.namaKategori}`
          );

          level3Categories.forEach((level3Cat, subIndex) => {
            const level3Amount = level3Cat.transaksiApbd.reduce(
              (sum, t) => sum + Number(t.jumlah),
              0
            );

            // Only add if there's actual data
            if (level3Amount > 0 || level3Cat.transaksiApbd.length > 0) {
              breakdown.push({
                kode: `6.${index + 1}.${String(subIndex + 1).padStart(2, "0")}`,
                nama: level3Cat.namaKategori,
                jumlah: level3Amount,
                level: 3,
                isSubCategory: false,
              });

              console.log(
                `[Backend] 💰 Level 3 - ${
                  level3Cat.namaKategori
                }: Rp ${level3Amount.toLocaleString("id-ID")}`
              );
            }
          });
        }
      });
    } else {
      console.log(
        `[Backend] ⚠️ No main financing category found for year ${year}`
      );
    }

    console.log(
      `[Backend] ✅ Financing breakdown generated with ${breakdown.length} items (excluding deficit and total)`
    );

    cache.set(cacheKey, breakdown);
    res.json({
      success: true,
      data: breakdown,
    });
  } catch (error) {
    console.error(`[Backend] ❌ Error in financing breakdown endpoint:`, error);
    handleError(res, error, "Gagal mengambil breakdown pembiayaan");
  }
});

router.post("/pendapatan", async (req, res) => {
  try {
    const { tahun, idKategori, jumlah, keterangan } = req.body;

    if (
      !tahun ||
      !idKategori ||
      jumlah === null ||
      jumlah === undefined ||
      jumlah === ""
    ) {
      return res.status(400).json({
        success: false,
        message: "Tahun, kategori, dan jumlah harus diisi",
      });
    }

    const jumlahValue = Number.parseFloat(jumlah);
    if (isNaN(jumlahValue) || jumlahValue < 0) {
      return res.status(400).json({
        success: false,
        message: "Jumlah harus berupa angka dan tidak boleh negatif",
      });
    }

    // Verify category exists and is level 3
    const category = await prisma.kategoriApbd.findUnique({
      where: { idKategori: Number.parseInt(idKategori) },
    });

    if (!category) {
      return res.status(400).json({
        success: false,
        message: "Kategori tidak ditemukan",
      });
    }

    if (category.level !== 3) {
      return res.status(400).json({
        success: false,
        message: `Tidak dapat menambahkan data secara manual untuk level ${category.level}. Hanya level 3 yang dapat diinput manual. Level 1 dan 2 dihitung otomatis.`,
      });
    }

    // Check if tahun_anggaran exists, if not create it
    let tahunAnggaran = await prisma.tahunAnggaran.findFirst({
      where: { tahun: Number.parseInt(tahun) },
    });

    if (!tahunAnggaran) {
      tahunAnggaran = await prisma.tahunAnggaran.create({
        data: {
          tahun: Number.parseInt(tahun),
        },
      });
    }

    // Create the transaction
    const transaction = await prisma.transaksiApbd.create({
      data: {
        idTahunAnggaran: tahunAnggaran.idTahunAnggaran,
        idKategori: Number.parseInt(idKategori),
        jumlah: jumlahValue, // Use validated jumlahValue instead of parseFloat again
      },
      include: {
        kategoriApbd: true,
        tahunAnggaran: true,
      },
    });

    // Clear related cache
    cache.del(`apbd_summary_${tahun}_Pendapatan`);
    cache.del(`revenue_breakdown_${tahun}`);
    cache.del(`apbd_transactions_${tahun}_all`);

    res.json({
      success: true,
      message:
        "Data pendapatan berhasil ditambahkan. Level 1 dan 2 akan dihitung otomatis.",
      data: transaction,
    });
  } catch (error) {
    console.error("Error creating revenue transaction:", error);
    handleError(res, error, "Gagal menambahkan data pendapatan");
  }
});

router.post("/pembelanjaan", async (req, res) => {
  try {
    const { tahun, idKategori, jumlah, keterangan } = req.body;

    if (
      !tahun ||
      !idKategori ||
      jumlah === null ||
      jumlah === undefined ||
      jumlah === ""
    ) {
      return res.status(400).json({
        success: false,
        message: "Tahun, kategori, dan jumlah harus diisi",
      });
    }

    const jumlahValue = Number.parseFloat(jumlah);
    if (isNaN(jumlahValue) || jumlahValue < 0) {
      return res.status(400).json({
        success: false,
        message: "Jumlah harus berupa angka dan tidak boleh negatif",
      });
    }

    // Verify category exists and is level 3
    const category = await prisma.kategoriApbd.findUnique({
      where: { idKategori: Number.parseInt(idKategori) },
    });

    if (!category) {
      return res.status(400).json({
        success: false,
        message: "Kategori tidak ditemukan",
      });
    }

    if (category.level !== 3) {
      return res.status(400).json({
        success: false,
        message: `Tidak dapat menambahkan data secara manual untuk level ${category.level}. Hanya level 3 yang dapat diinput manual. Level 1 dan 2 dihitung otomatis.`,
      });
    }

    // Check if tahun_anggaran exists, if not create it
    let tahunAnggaran = await prisma.tahunAnggaran.findFirst({
      where: { tahun: Number.parseInt(tahun) },
    });

    if (!tahunAnggaran) {
      tahunAnggaran = await prisma.tahunAnggaran.create({
        data: {
          tahun: Number.parseInt(tahun),
        },
      });
    }

    // Create the transaction
    const transaction = await prisma.transaksiApbd.create({
      data: {
        idTahunAnggaran: tahunAnggaran.idTahunAnggaran,
        idKategori: Number.parseInt(idKategori),
        jumlah: jumlahValue, // Use validated jumlahValue instead of parseFloat again
      },
      include: {
        kategoriApbd: true,
        tahunAnggaran: true,
      },
    });

    // Clear related cache
    cache.del(`apbd_summary_${tahun}_Belanja`);
    cache.del(`expenditure_breakdown_${tahun}`);
    cache.del(`apbd_transactions_${tahun}_all`);

    res.json({
      success: true,
      message:
        "Data pembelanjaan berhasil ditambahkan. Level 1 dan 2 akan dihitung otomatis.",
      data: transaction,
    });
  } catch (error) {
    console.error("Error creating expenditure transaction:", error);
    handleError(res, error, "Gagal menambahkan data pembelanjaan");
  }
});

router.post("/pembiayaan", async (req, res) => {
  try {
    const { tahun, idKategori, jumlah, keterangan } = req.body;

    if (
      !tahun ||
      !idKategori ||
      jumlah === null ||
      jumlah === undefined ||
      jumlah === ""
    ) {
      return res.status(400).json({
        success: false,
        message: "Tahun, kategori, dan jumlah harus diisi",
      });
    }

    const jumlahValue = Number.parseFloat(jumlah);
    if (isNaN(jumlahValue) || jumlahValue < 0) {
      return res.status(400).json({
        success: false,
        message: "Jumlah harus berupa angka dan tidak boleh negatif",
      });
    }

    // Verify category exists and is level 3
    const category = await prisma.kategoriApbd.findUnique({
      where: { idKategori: Number.parseInt(idKategori) },
    });

    if (!category) {
      return res.status(400).json({
        success: false,
        message: "Kategori tidak ditemukan",
      });
    }

    if (category.level !== 3) {
      return res.status(400).json({
        success: false,
        message: `Tidak dapat menambahkan data secara manual untuk level ${category.level}. Hanya level 3 yang dapat diinput manual. Level 1 dan 2 dihitung otomatis.`,
      });
    }

    // Check if tahun_anggaran exists, if not create it
    let tahunAnggaran = await prisma.tahunAnggaran.findFirst({
      where: { tahun: Number.parseInt(tahun) },
    });

    if (!tahunAnggaran) {
      tahunAnggaran = await prisma.tahunAnggaran.create({
        data: {
          tahun: Number.parseInt(tahun),
        },
      });
    }

    // Create the transaction
    const transaction = await prisma.transaksiApbd.create({
      data: {
        idTahunAnggaran: tahunAnggaran.idTahunAnggaran,
        idKategori: Number.parseInt(idKategori),
        jumlah: jumlahValue, // Use validated jumlahValue instead of parseFloat again
      },
      include: {
        kategoriApbd: true,
        tahunAnggaran: true,
      },
    });

    // Clear related cache
    cache.del(`apbd_summary_${tahun}_Pembiayaan`);
    cache.del(`financing_breakdown_${tahun}`);
    cache.del(`apbd_transactions_${tahun}_all`);

    res.json({
      success: true,
      message:
        "Data pembiayaan berhasil ditambahkan. Level 1 dan 2 akan dihitung otomatis.",
      data: transaction,
    });
  } catch (error) {
    console.error("Error creating financing transaction:", error);
    handleError(res, error, "Gagal menambahkan data pembiayaan");
  }
});

module.exports = router;
