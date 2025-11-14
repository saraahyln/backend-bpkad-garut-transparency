const express = require("express");
const { prisma, cache } = require("../config/database");
const { handleError } = require("../utils/helpers");

const router = express.Router();

// GET /api/kategori-apbd - Get all categories with hierarchy
router.get("/", async (req, res) => {
  try {
    const { jenis, level, parent } = req.query;
    const cacheKey = `kategori_apbd_${jenis || "all"}_${level || "all"}_${
      parent || "all"
    }`;
    let categories = cache.get(cacheKey);

    if (!categories) {
      const where = {};
      if (jenis) where.jenis = jenis;
      if (level) where.level = Number.parseInt(level);
      if (parent) where.idParent = Number.parseInt(parent);

      categories = await prisma.kategoriApbd.findMany({
        where,
        include: {
          parent: true,
          children: {
            include: {
              children: true,
              _count: {
                select: { transaksiApbd: true },
              },
            },
          },
          _count: {
            select: { transaksiApbd: true },
          },
        },
        orderBy: [
          { jenis: "asc" },
          { level: "asc" },
          { idParent: "asc" },
          { namaKategori: "asc" },
        ],
      });

      const sortHierarchically = (categories) => {
        const sorted = [];
        const categoryMap = new Map();

        // Create a map for quick lookup
        categories.forEach((cat) => categoryMap.set(cat.idKategori, cat));

        // Group by jenis first
        const byJenis = {};
        categories.forEach((cat) => {
          if (!byJenis[cat.jenis]) byJenis[cat.jenis] = [];
          byJenis[cat.jenis].push(cat);
        });

        // Process each jenis separately
        Object.keys(byJenis)
          .sort()
          .forEach((jenis) => {
            const jenisCategories = byJenis[jenis];

            // Get level 1 categories for this jenis
            const level1 = jenisCategories
              .filter((cat) => cat.level === 1)
              .sort((a, b) => a.namaKategori.localeCompare(b.namaKategori));

            level1.forEach((l1) => {
              sorted.push(l1);

              // Get level 2 children
              const level2 = jenisCategories
                .filter(
                  (cat) => cat.level === 2 && cat.idParent === l1.idKategori
                )
                .sort((a, b) => a.namaKategori.localeCompare(b.namaKategori));

              level2.forEach((l2) => {
                sorted.push(l2);

                // Get level 3 children
                const level3 = jenisCategories
                  .filter(
                    (cat) => cat.level === 3 && cat.idParent === l2.idKategori
                  )
                  .sort((a, b) => a.namaKategori.localeCompare(b.namaKategori));

                level3.forEach((l3) => {
                  sorted.push(l3);
                });
              });
            });

            // Add any orphaned level 2 categories (without level 1 parent)
            const orphanedLevel2 = jenisCategories
              .filter(
                (cat) => cat.level === 2 && !categoryMap.has(cat.idParent)
              )
              .sort((a, b) => a.namaKategori.localeCompare(b.namaKategori));
            orphanedLevel2.forEach((cat) => sorted.push(cat));

            // Add any orphaned level 3 categories (without level 2 parent)
            const orphanedLevel3 = jenisCategories
              .filter(
                (cat) => cat.level === 3 && !categoryMap.has(cat.idParent)
              )
              .sort((a, b) => a.namaKategori.localeCompare(b.namaKategori));
            orphanedLevel3.forEach((cat) => sorted.push(cat));
          });

        return sorted;
      };

      categories = sortHierarchically(categories);

      cache.set(cacheKey, categories);
    }

    res.json({
      success: true,
      data: categories,
      total: categories.length,
    });
  } catch (error) {
    handleError(res, error, "Gagal mengambil data kategori APBD");
  }
});

// GET /api/kategori-apbd/tree - Get categories in tree structure
router.get("/tree", async (req, res) => {
  try {
    const { jenis } = req.query;
    const cacheKey = `kategori_tree_${jenis || "all"}`;
    let tree = cache.get(cacheKey);

    if (!tree) {
      const where = { level: 1 };
      if (jenis) where.jenis = jenis;

      tree = await prisma.kategoriApbd.findMany({
        where,
        include: {
          children: {
            include: {
              children: {
                include: {
                  _count: {
                    select: { transaksiApbd: true },
                  },
                },
              },
              _count: {
                select: { transaksiApbd: true },
              },
            },
          },
          _count: {
            select: { transaksiApbd: true },
          },
        },
        orderBy: { idKategori: "asc" },
      });

      cache.set(cacheKey, tree);
    }

    res.json({
      success: true,
      data: tree,
    });
  } catch (error) {
    handleError(res, error, "Gagal mengambil struktur kategori APBD");
  }
});

// GET /api/kategori-apbd/:id - Get specific category
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const cacheKey = `kategori_apbd_${id}`;
    let category = cache.get(cacheKey);

    if (!category) {
      category = await prisma.kategoriApbd.findUnique({
        where: { idKategori: Number.parseInt(id) },
        include: {
          parent: true,
          children: true,
          transaksiApbd: {
            include: {
              tahunAnggaran: true,
            },
          },
        },
      });

      if (category) {
        cache.set(cacheKey, category);
      }
    }

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Kategori tidak ditemukan",
      });
    }

    res.json({
      success: true,
      data: category,
    });
  } catch (error) {
    handleError(res, error, "Gagal mengambil data kategori");
  }
});

// POST /api/kategori-apbd - Create new category
router.post("/", async (req, res) => {
  try {
    const { idParent, jenis, namaKategori, level, kode } = req.body;

    console.log(" Received data:", {
      idParent,
      jenis,
      namaKategori,
      level,
      kode,
    });

    // Validation
    if (!jenis || !namaKategori) {
      return res.status(400).json({
        success: false,
        message: "Jenis dan nama kategori wajib diisi",
      });
    }

    if (
      !["Pendapatan", "Belanja", "Pembelanjaan", "Pembiayaan"].includes(jenis)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Jenis harus Pendapatan, Belanja, Pembelanjaan, atau Pembiayaan",
      });
    }

    const levelNum = level ? Number.parseInt(level) : 1;
    const parentId = idParent ? Number.parseInt(idParent) : null;

    if (levelNum > 1 && !parentId) {
      return res.status(400).json({
        success: false,
        message: "Kategori level 2 atau lebih harus memiliki kategori induk",
      });
    }

    const trimmedName = namaKategori.trim();

    // Get all categories with same jenis, level, and parent to check case-insensitive duplicates
    const whereCondition = {
      jenis: jenis,
      level: levelNum,
    };

    if (parentId) {
      whereCondition.idParent = parentId;
    } else {
      whereCondition.idParent = null;
    }

    const existingCategories = await prisma.kategoriApbd.findMany({
      where: whereCondition,
      select: {
        idKategori: true,
        namaKategori: true,
      },
    });

    // Check for case-insensitive duplicate names
    const duplicateCategory = existingCategories.find(
      (cat) => cat.namaKategori.toLowerCase() === trimmedName.toLowerCase()
    );

    if (duplicateCategory) {
      console.log(" Found case-insensitive duplicate:", duplicateCategory);
      return res.status(400).json({
        success: false,
        message:
          "Kategori dengan nama yang sama (tidak membedakan huruf besar/kecil) sudah ada di level dan induk yang sama",
      });
    }

    if (kode && kode.trim()) {
      const trimmedCode = kode.trim();
      const existingCodes = await prisma.kategoriApbd.findMany({
        where: {
          jenis: jenis,
          kode: {
            not: null,
          },
        },
        select: {
          idKategori: true,
          kode: true,
        },
      });

      const duplicateCode = existingCodes.find(
        (cat) =>
          cat.kode && cat.kode.toLowerCase() === trimmedCode.toLowerCase()
      );

      if (duplicateCode) {
        return res.status(400).json({
          success: false,
          message:
            "Kode kategori sudah digunakan untuk jenis ini (tidak membedakan huruf besar/kecil)",
        });
      }
    }

    const createData = {
      idParent: parentId,
      jenis,
      namaKategori: trimmedName,
      level: levelNum,
    };

    // Only add kode if it's provided and not empty
    if (kode && kode.trim()) {
      createData.kode = kode.trim();
    }

    console.log(" Creating category with data:", createData);

    const newCategory = await prisma.kategoriApbd.create({
      data: createData,
    });

    console.log(" Category created successfully:", newCategory);

    // Clear cache
    cache.flushAll();

    res.status(201).json({
      success: true,
      data: newCategory,
      message: "Kategori berhasil ditambahkan",
    });
  } catch (error) {
    console.error(" Error creating category:", error);

    if (error.code === "P2002") {
      // Get the field that caused the unique constraint violation
      const target = error.meta?.target || [];
      let message =
        "Data duplikat - kategori dengan informasi yang sama sudah ada";

      if (target.includes("id_kategori")) {
        message = "Terjadi kesalahan sistem, silakan coba lagi";
      } else if (target.includes("kode")) {
        message = "Kode kategori sudah digunakan";
      } else if (
        target.includes("namaKategori") ||
        target.includes("nama_kategori")
      ) {
        message = "Nama kategori sudah digunakan di level dan induk yang sama";
      }

      return res.status(400).json({
        success: false,
        message: message,
      });
    }

    if (error.code === "P2003") {
      return res.status(400).json({
        success: false,
        message: "Kategori induk tidak valid atau tidak ditemukan",
      });
    }

    if (error.code === "P2010") {
      return res.status(500).json({
        success: false,
        message:
          "Database belum dikonfigurasi dengan benar. Silakan jalankan script setup database terlebih dahulu.",
      });
    }

    handleError(res, error, "Gagal menambahkan kategori");
  }
});

// PUT /api/kategori-apbd/:id - Update category
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { idParent, jenis, namaKategori, level, kode } = req.body;

    if (namaKategori) {
      const trimmedName = namaKategori.trim();
      const levelNum = level ? Number.parseInt(level) : 1;
      const parentId = idParent ? Number.parseInt(idParent) : null;

      const whereCondition = {
        jenis: jenis,
        level: levelNum,
        NOT: {
          idKategori: Number.parseInt(id),
        },
      };

      if (parentId) {
        whereCondition.idParent = parentId;
      } else {
        whereCondition.idParent = null;
      }

      const existingCategories = await prisma.kategoriApbd.findMany({
        where: whereCondition,
        select: {
          idKategori: true,
          namaKategori: true,
        },
      });

      const duplicateCategory = existingCategories.find(
        (cat) => cat.namaKategori.toLowerCase() === trimmedName.toLowerCase()
      );

      if (duplicateCategory) {
        return res.status(400).json({
          success: false,
          message:
            "Kategori dengan nama yang sama (tidak membedakan huruf besar/kecil) sudah ada di level dan induk yang sama",
        });
      }
    }

    if (kode && kode.trim()) {
      const trimmedCode = kode.trim();
      const existingCodes = await prisma.kategoriApbd.findMany({
        where: {
          jenis: jenis,
          kode: {
            not: null,
          },
          NOT: {
            idKategori: Number.parseInt(id),
          },
        },
        select: {
          idKategori: true,
          kode: true,
        },
      });

      const duplicateCode = existingCodes.find(
        (cat) =>
          cat.kode && cat.kode.toLowerCase() === trimmedCode.toLowerCase()
      );

      if (duplicateCode) {
        return res.status(400).json({
          success: false,
          message:
            "Kode kategori sudah digunakan untuk jenis ini (tidak membedakan huruf besar/kecil)",
        });
      }
    }

    const updatedCategory = await prisma.kategoriApbd.update({
      where: { idKategori: Number.parseInt(id) },
      data: {
        idParent: idParent ? Number.parseInt(idParent) : null,
        jenis,
        namaKategori: namaKategori ? namaKategori.trim() : undefined,
        kode: kode && kode.trim() ? kode.trim() : null,
        level: level ? Number.parseInt(level) : undefined,
      },
    });

    // Clear cache
    cache.flushAll();

    res.json({
      success: true,
      data: updatedCategory,
      message: "Kategori berhasil diperbarui",
    });
  } catch (error) {
    handleError(res, error, "Gagal memperbarui kategori");
  }
});

// DELETE /api/kategori-apbd/:id - Delete category
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Check if category has children or transactions
    const childCount = await prisma.kategoriApbd.count({
      where: { idParent: Number.parseInt(id) },
    });

    const transactionCount = await prisma.transaksiApbd.count({
      where: { idKategori: Number.parseInt(id) },
    });

    if (childCount > 0) {
      return res.status(400).json({
        success: false,
        message: "Tidak dapat menghapus kategori yang memiliki sub-kategori",
      });
    }

    if (transactionCount > 0) {
      return res.status(400).json({
        success: false,
        message: "Tidak dapat menghapus kategori yang memiliki transaksi",
      });
    }

    await prisma.kategoriApbd.delete({
      where: { idKategori: Number.parseInt(id) },
    });

    // Clear cache
    cache.flushAll();

    res.json({
      success: true,
      message: "Kategori berhasil dihapus",
    });
  } catch (error) {
    handleError(res, error, "Gagal menghapus kategori");
  }
});

module.exports = router;
