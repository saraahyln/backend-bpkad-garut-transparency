const express = require("express")
const { prisma, cache } = require("../config/database")
const { formatCurrency, handleError } = require("../utils/helpers")

const router = express.Router()

const autoCalculateLevel2 = async (idTahun, jenis) => {
  console.log(`[Backend] 🔄 Auto-calculating level 2 for year ${idTahun}, type ${jenis}`)

  // Get all level 3 transactions for this year and type
  const level3Transactions = await prisma.transaksiApbd.findMany({
    where: {
      idTahun,
      kategoriApbd: {
        jenis,
        level: 3,
      },
    },
    include: { kategoriApbd: true },
  })

  // Group by parent (level 2)
  const level2Totals = {}
  level3Transactions.forEach((transaction) => {
    const parentId = transaction.kategoriApbd.idParent
    if (parentId) {
      if (!level2Totals[parentId]) {
        level2Totals[parentId] = 0
      }
      level2Totals[parentId] += Number(transaction.jumlah)
    }
  })

  // Get all existing level 2 transactions for this year and type to handle cleanup
  const existingLevel2 = await prisma.transaksiApbd.findMany({
    where: {
      idTahun,
      kategoriApbd: {
        jenis,
        level: 2,
      },
    },
    include: { kategoriApbd: true },
  })

  // Update or create level 2 transactions
  for (const [parentId, total] of Object.entries(level2Totals)) {
    if (total > 0) {
      await prisma.transaksiApbd.upsert({
        where: {
          idTahun_idKategori: {
            idTahun,
            idKategori: Number(parentId),
          },
        },
        update: { jumlah: total },
        create: {
          idTahun,
          idKategori: Number(parentId),
          jumlah: total,
        },
      })
    }
  }

  for (const existing of existingLevel2) {
    const parentId = existing.idKategori
    if (!level2Totals[parentId] || level2Totals[parentId] === 0) {
      await prisma.transaksiApbd.delete({
        where: {
          idTransaksi: existing.idTransaksi,
        },
      })
      console.log(`[Backend] 🗑️ Deleted empty level 2 record for category ${parentId}`)
    }
  }

  console.log(`[Backend] ✅ Updated ${Object.keys(level2Totals).length} level 2 categories`)
}

const autoCalculateLevel1 = async (idTahun, jenis) => {
  console.log(`[Backend] 🔄 Auto-calculating level 1 for year ${idTahun}, type ${jenis}`)

  // Get all level 2 transactions for this year and type
  const level2Transactions = await prisma.transaksiApbd.findMany({
    where: {
      idTahun,
      kategoriApbd: {
        jenis,
        level: 2,
      },
    },
    include: { kategoriApbd: true },
  })

  // Group by parent (level 1)
  const level1Totals = {}
  level2Transactions.forEach((transaction) => {
    const parentId = transaction.kategoriApbd.idParent
    if (parentId) {
      if (!level1Totals[parentId]) {
        level1Totals[parentId] = 0
      }
      level1Totals[parentId] += Number(transaction.jumlah)
    }
  })

  // Get all existing level 1 transactions for this year and type to handle cleanup
  const existingLevel1 = await prisma.transaksiApbd.findMany({
    where: {
      idTahun,
      kategoriApbd: {
        jenis,
        level: 1,
      },
    },
    include: { kategoriApbd: true },
  })

  // Update or create level 1 transactions
  for (const [parentId, total] of Object.entries(level1Totals)) {
    if (total > 0) {
      await prisma.transaksiApbd.upsert({
        where: {
          idTahun_idKategori: {
            idTahun,
            idKategori: Number(parentId),
          },
        },
        update: { jumlah: total },
        create: {
          idTahun,
          idKategori: Number(parentId),
          jumlah: total,
        },
      })
    }
  }

  for (const existing of existingLevel1) {
    const parentId = existing.idKategori
    if (!level1Totals[parentId] || level1Totals[parentId] === 0) {
      await prisma.transaksiApbd.delete({
        where: {
          idTransaksi: existing.idTransaksi,
        },
      })
      console.log(`[Backend] 🗑️ Deleted empty level 1 record for category ${parentId}`)
    }
  }

  console.log(`[Backend] ✅ Updated ${Object.keys(level1Totals).length} level 1 categories`)
}

const ensureRingkasanForAllYears = async () => {
  try {
    console.log("[Backend] 🔄 Ensuring ringkasan records exist for all years with transactions...")

    // Get all unique years that have transactions
    const yearsWithTransactions = await prisma.transaksiApbd.groupBy({
      by: ["idTahun"],
      _count: {
        idTahun: true,
      },
    })

    console.log(
      `[Backend] 📊 Found ${yearsWithTransactions.length} years with transactions:`,
      yearsWithTransactions.map((y) => y.idTahun),
    )

    // For each year, ensure ringkasan record exists
    for (const yearGroup of yearsWithTransactions) {
      const idTahun = yearGroup.idTahun

      // Check if ringkasan already exists for this year
      const existingRingkasan = await prisma.ringkasanApbd.findFirst({
        where: { idTahun },
      })

      if (!existingRingkasan) {
        console.log(`[Backend] ➕ Creating missing ringkasan record for year ${idTahun}`)
        await updateRingkasanApbd(idTahun)
      } else {
        console.log(`[Backend] ✅ Ringkasan already exists for year ${idTahun}, updating...`)
        await updateRingkasanApbd(idTahun)
      }
    }

    console.log("[Backend] ✅ Finished ensuring ringkasan records for all years")
  } catch (error) {
    console.error("[Backend] ❌ Error in ensureRingkasanForAllYears:", error)
  }
}

const updateRingkasanApbd = async (idTahun) => {
  console.log(`[Backend] 🔄 Updating Ringkasan APBD for year ${idTahun}`)

  // Get totals from level 1 transactions
  const [pendapatanTotal, belanjaTotal, penerimaanPembiayaan, pengeluaranPembiayaan] = await Promise.all([
    // Total Pendapatan (level 1)
    prisma.transaksiApbd.aggregate({
      where: {
        idTahun,
        kategoriApbd: {
          jenis: "Pendapatan",
          level: 1,
        },
      },
      _sum: { jumlah: true },
    }),
    // Total Belanja (level 1)
    prisma.transaksiApbd.aggregate({
      where: {
        idTahun,
        kategoriApbd: {
          jenis: "Belanja",
          level: 1,
        },
      },
      _sum: { jumlah: true },
    }),
    // Get penerimaan pembiayaan from level 2 categories under pembiayaan
    prisma.transaksiApbd.aggregate({
      where: {
        idTahun,
        kategoriApbd: {
          jenis: "Pembiayaan",
          level: 2,
          OR: [{ namaKategori: { contains: "Penerimaan", mode: "insensitive" } }, { kode: { startsWith: "6.1" } }],
        },
      },
      _sum: { jumlah: true },
    }),
    // Get pengeluaran pembiayaan from level 2 categories under pembiayaan
    prisma.transaksiApbd.aggregate({
      where: {
        idTahun,
        kategoriApbd: {
          jenis: "Pembiayaan",
          level: 2,
          OR: [{ namaKategori: { contains: "Pengeluaran", mode: "insensitive" } }, { kode: { startsWith: "6.2" } }],
        },
      },
      _sum: { jumlah: true },
    }),
  ])

  // Using 0 as default if no data, not null
  const totalPendapatan = pendapatanTotal._sum.jumlah || 0
  const totalBelanja = belanjaTotal._sum.jumlah || 0
  const totalPenerimaan = penerimaanPembiayaan._sum.jumlah || 0
  const totalPengeluaran = pengeluaranPembiayaan._sum.jumlah || 0

  // Calculate derived values with smart operation handling
  let surplusDefisit = 0
  if (totalPendapatan > 0 || totalBelanja > 0) {
    surplusDefisit = totalPendapatan - totalBelanja
  }

  let pembiayaanNetto = 0
  if (totalPenerimaan > 0 || totalPengeluaran > 0) {
    pembiayaanNetto = totalPenerimaan - totalPengeluaran
  }

  let sisaPembiayaan = 0
  if (surplusDefisit !== 0 || pembiayaanNetto !== 0) {
    sisaPembiayaan = surplusDefisit + pembiayaanNetto
  }

  const ringkasanData = {
    idTahun,
    totalPendapatan,
    totalPembelanjaan: totalBelanja,
    totalPenerimaan,
    totalPengeluaran,
    surplusDefisit,
    pembiayaanNetto,
    sisaPembiayaan,
  }

  console.log(`[Backend] 📊 Calculated ringkasan data for year ${idTahun}:`, ringkasanData)

  // Using upsert to ensure record is always created or updated
  const ringkasan = await prisma.ringkasanApbd.upsert({
    where: { idTahun },
    update: ringkasanData,
    create: ringkasanData,
  })

  console.log(`[Backend] ✅ Ringkasan APBD ${ringkasan.idRingkasan ? "updated" : "created"} for year ${idTahun}`)
  return ringkasan
}

// GET /api/transaksi-apbd - Get all transactions with filters
router.get("/", async (req, res) => {
  try {
    const { tahun, kategori, jenis, page = 1, limit, sortBy = "idTransaksi", sortOrder = "desc" } = req.query

    console.log(`[Backend] 🔍 Getting transactions with filters:`, {
      tahun,
      kategori,
      jenis,
      page,
      limit,
    })

    const skip = limit ? (Number.parseInt(page) - 1) * Number.parseInt(limit) : undefined
    const take = limit ? Number.parseInt(limit) : undefined

    const where = {}

    if (tahun) {
      // First find the idTahun for the given year
      const tahunAnggaran = await prisma.tahunAnggaran.findFirst({
        where: { tahun: Number.parseInt(tahun) },
      })

      if (tahunAnggaran) {
        where.idTahun = tahunAnggaran.idTahun
        console.log(`[Backend] 📅 Found idTahun ${tahunAnggaran.idTahun} for year ${tahun}`)
      } else {
        console.log(`[Backend] ❌ Year ${tahun} not found in database`)
        // Return empty result if year doesn't exist
        return res.json({
          success: true,
          data: {
            transactions: [],
            total: 0,
            page: Number.parseInt(page),
            totalPages: 0,
          },
        })
      }
    }

    if (kategori) where.idKategori = Number.parseInt(kategori)
    if (jenis) {
      where.kategoriApbd = {
        jenis: jenis,
      }
    }

    const cacheKey = `transaksi_apbd_${JSON.stringify(where)}_${page}_${limit || "unlimited"}_${sortBy}_${sortOrder}`
    let result = cache.get(cacheKey)

    if (!result) {
      const [transactions, total] = await Promise.all([
        prisma.transaksiApbd.findMany({
          where,
          include: {
            tahunAnggaran: true,
            kategoriApbd: {
              include: {
                parent: true,
              },
            },
          },
          orderBy: {
            [sortBy]: sortOrder,
          },
          ...(skip !== undefined && { skip }),
          ...(take !== undefined && { take }),
        }),
        prisma.transaksiApbd.count({ where }),
      ])

      console.log(`[Backend] 📊 Found ${transactions.length} transactions out of ${total} total`)

      result = {
        transactions,
        total,
        page: Number.parseInt(page),
        limit: limit ? Number.parseInt(limit) : total,
        totalPages: limit ? Math.ceil(total / Number.parseInt(limit)) : 1,
      }

      const cacheTime = limit ? undefined : 60 // 1 minute for unlimited, default for limited
      cache.set(cacheKey, result, cacheTime)
    }

    res.json({
      success: true,
      data: {
        transactions: result.transactions,
        total: result.total,
        page: result.page,
        totalPages: result.totalPages,
      },
    })
  } catch (error) {
    console.error(`[Backend] ❌ Error getting transactions:`, error)
    handleError(res, error, "Gagal mengambil data transaksi APBD")
  }
})

// GET /api/transaksi-apbd/summary - Get transaction summary
router.get("/summary", async (req, res) => {
  try {
    const { tahun, jenis } = req.query
    const cacheKey = `transaksi_summary_${tahun || "all"}_${jenis || "all"}`
    let summary = cache.get(cacheKey)

    if (!summary) {
      const where = {}
      if (tahun) where.idTahun = Number.parseInt(tahun)
      if (jenis) {
        where.kategoriApbd = {
          jenis: jenis,
        }
      }

      const transactions = await prisma.transaksiApbd.findMany({
        where,
        include: {
          tahunAnggaran: true,
          kategoriApbd: true,
        },
      })

      // Group by year and category type
      const groupedData = transactions.reduce((acc, transaction) => {
        const year = transaction.tahunAnggaran.tahun
        const type = transaction.kategoriApbd.jenis

        if (!acc[year]) acc[year] = {}
        if (!acc[year][type]) acc[year][type] = 0

        acc[year][type] += Number.parseFloat(transaction.jumlah)

        return acc
      }, {})

      summary = groupedData
      cache.set(cacheKey, summary)
    }

    res.json({
      success: true,
      data: summary,
    })
  } catch (error) {
    handleError(res, error, "Gagal mengambil ringkasan transaksi")
  }
})

// GET /api/transaksi-apbd/:id - Get specific transaction
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params
    const cacheKey = `transaksi_apbd_${id}`
    let transaction = cache.get(cacheKey)

    if (!transaction) {
      transaction = await prisma.transaksiApbd.findUnique({
        where: { idTransaksi: Number.parseInt(id) },
        include: {
          tahunAnggaran: true,
          kategoriApbd: {
            include: {
              parent: true,
            },
          },
        },
      })

      if (transaction) {
        cache.set(cacheKey, transaction)
      }
    }

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: "Transaksi tidak ditemukan",
      })
    }

    res.json({
      success: true,
      data: transaction,
    })
  } catch (error) {
    handleError(res, error, "Gagal mengambil data transaksi")
  }
})

// POST /api/transaksi-apbd - Create new transaction
router.post("/", async (req, res) => {
  try {
    const { idTahun, idKategori, jumlah } = req.body

    console.log("[Backend] 📝 POST /api/transaksi-apbd - Received data:", {
      idTahun,
      idKategori,
      jumlah,
      body: req.body,
      bodyType: typeof req.body,
      idTahunType: typeof idTahun,
      idKategoriType: typeof idKategori,
      jumlahType: typeof jumlah,
    })

    if (!idTahun || !idKategori || jumlah === null || jumlah === undefined || jumlah === "") {
      console.log("[Backend] ❌ Validation failed: missing required fields", {
        idTahun: !!idTahun,
        idKategori: !!idKategori,
        jumlah: jumlah !== null && jumlah !== undefined && jumlah !== "",
      })
      return res.status(400).json({
        success: false,
        message: "Tahun, kategori, dan jumlah wajib diisi",
      })
    }

    const jumlahValue = Number.parseFloat(jumlah)
    if (isNaN(jumlahValue) || jumlahValue < 0) {
      console.log("[Backend] ❌ Validation failed: invalid jumlah value:", {
        original: jumlah,
        parsed: jumlahValue,
        isNaN: isNaN(jumlahValue),
        isNegative: jumlahValue < 0,
      })
      return res.status(400).json({
        success: false,
        message: "Jumlah harus berupa angka dan tidak boleh negatif",
      })
    }

    console.log("[Backend] ✅ Validation passed, checking year and category...")

    let year, category
    try {
      ;[year, category] = await Promise.all([
        prisma.tahunAnggaran.findUnique({
          where: { idTahun: Number.parseInt(idTahun) },
        }),
        prisma.kategoriApbd.findUnique({
          where: { idKategori: Number.parseInt(idKategori) },
        }),
      ])
    } catch (dbError) {
      console.error("[Backend] ❌ Database lookup error:", dbError)
      return res.status(500).json({
        success: false,
        message: "Gagal mengakses database untuk validasi",
      })
    }

    console.log("[Backend] 🔍 Database lookup results:", {
      year: year ? { idTahun: year.idTahun, tahun: year.tahun } : null,
      category: category
        ? {
            idKategori: category.idKategori,
            namaKategori: category.namaKategori,
            level: category.level,
            jenis: category.jenis,
          }
        : null,
    })

    if (!year) {
      console.log("[Backend] ❌ Year not found:", idTahun)
      return res.status(400).json({
        success: false,
        message: "Tahun anggaran tidak ditemukan",
      })
    }

    if (!category) {
      console.log("[Backend] ❌ Category not found:", idKategori)
      return res.status(400).json({
        success: false,
        message: "Kategori tidak ditemukan",
      })
    }

    if (category.level !== 3) {
      console.log("[Backend] ❌ Invalid category level:", category.level)
      return res.status(400).json({
        success: false,
        message: `Tidak dapat menambahkan data secara manual untuk level ${category.level}. Hanya level 3 yang dapat diinput manual. Level 1 dan 2 dihitung otomatis dari penjumlahan level di bawahnya.`,
      })
    }

    console.log("[Backend] ✅ Year and category validation passed, checking for duplicates...")

    let existingTransaction
    try {
      existingTransaction = await prisma.transaksiApbd.findFirst({
        where: {
          idTahun: Number.parseInt(idTahun),
          idKategori: Number.parseInt(idKategori),
        },
      })
    } catch (dbError) {
      console.error("[Backend] ❌ Duplicate check error:", dbError)
      return res.status(500).json({
        success: false,
        message: "Gagal memeriksa duplikasi data",
      })
    }

    if (existingTransaction) {
      console.log("[Backend] ❌ Duplicate transaction found:", existingTransaction)
      return res.status(400).json({
        success: false,
        message: "Duplikat - Kategori ini sudah memiliki data untuk tahun tersebut",
      })
    }

    console.log("[Backend] ✅ No duplicates found, creating transaction...")

    const transactionData = {
      idTahun: Number.parseInt(idTahun),
      idKategori: Number.parseInt(idKategori),
      jumlah: Number.parseFloat(jumlah),
    }

    console.log("[Backend] 📝 Creating transaction with data:", transactionData)

    let newTransaction
    try {
      newTransaction = await prisma.transaksiApbd.create({
        data: transactionData,
        include: {
          tahunAnggaran: true,
          kategoriApbd: true,
        },
      })
    } catch (dbError) {
      console.error("[Backend] ❌ Transaction creation error:", dbError)

      if (dbError.code === "P2002") {
        return res.status(400).json({
          success: false,
          message: "Data duplikat - transaksi dengan informasi yang sama sudah ada",
        })
      }

      if (dbError.code === "P2003") {
        return res.status(400).json({
          success: false,
          message: "Referensi tidak valid - tahun atau kategori tidak ditemukan",
        })
      }

      return res.status(500).json({
        success: false,
        message: "Gagal menyimpan transaksi ke database",
      })
    }

    console.log("[Backend] ✅ Transaction created successfully:", {
      idTransaksi: newTransaction.idTransaksi,
      idTahun: newTransaction.idTahun,
      idKategori: newTransaction.idKategori,
      jumlah: newTransaction.jumlah,
    })

    if (category.level === 3) {
      console.log("[Backend] 🔄 Starting auto-calculation for level 2 and 1...")
      try {
        await autoCalculateLevel2(Number.parseInt(idTahun), category.jenis)
        await autoCalculateLevel1(Number.parseInt(idTahun), category.jenis)
        await updateRingkasanApbd(Number.parseInt(idTahun))
        console.log("[Backend] ✅ Auto-calculation completed")
      } catch (calcError) {
        console.error("[Backend] ⚠️ Auto-calculation error (non-critical):", calcError)
        // Don't fail the request if auto-calculation fails
      }
    }

    // Clear cache
    try {
      cache.flushAll()
    } catch (cacheError) {
      console.error("[Backend] ⚠️ Cache clear error (non-critical):", cacheError)
    }

    console.log("[Backend] ✅ Sending success response")

    res.status(201).json({
      success: true,
      data: newTransaction,
      message: "Transaksi berhasil ditambahkan dan level 1-2 telah dihitung otomatis",
    })
  } catch (error) {
    console.error("[Backend] ❌ Unexpected error creating transaction:", {
      message: error.message,
      code: error.code,
      meta: error.meta,
      stack: error.stack,
    })

    if (error.code === "P2002") {
      return res.status(400).json({
        success: false,
        message: "Data duplikat - transaksi dengan informasi yang sama sudah ada",
      })
    }

    if (error.code === "P2003") {
      return res.status(400).json({
        success: false,
        message: "Referensi tidak valid - tahun atau kategori tidak ditemukan",
      })
    }

    if (error.code === "P2010") {
      return res.status(500).json({
        success: false,
        message: "Database belum dikonfigurasi dengan benar. Silakan jalankan script setup database terlebih dahulu.",
      })
    }

    // Generic error response
    res.status(500).json({
      success: false,
      message: "Gagal menambahkan transaksi. Silakan coba lagi.",
    })
  }
})

// PUT /api/transaksi-apbd/:id - Update transaction
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params
    const { idTahun, idKategori, jumlah } = req.body

    if (!id || isNaN(Number.parseInt(id))) {
      return res.status(400).json({
        success: false,
        message: "ID transaksi tidak valid",
      })
    }

    if (jumlah !== undefined && (isNaN(Number.parseFloat(jumlah)) || Number.parseFloat(jumlah) < 0)) {
      return res.status(400).json({
        success: false,
        message: "Jumlah harus berupa angka positif",
      })
    }

    const currentTransaction = await prisma.transaksiApbd.findUnique({
      where: { idTransaksi: Number.parseInt(id) },
      include: { kategoriApbd: true },
    })

    if (!currentTransaction) {
      return res.status(404).json({
        success: false,
        message: "Transaksi tidak ditemukan",
      })
    }

    if (currentTransaction.kategoriApbd.level !== 3) {
      return res.status(400).json({
        success: false,
        message: `Tidak dapat mengubah data secara manual untuk level ${currentTransaction.kategoriApbd.level}. Hanya level 3 yang dapat diubah manual. Level 1 dan 2 dihitung otomatis dari penjumlahan level di bawahnya.`,
      })
    }

    if (idTahun && isNaN(Number.parseInt(idTahun))) {
      return res.status(400).json({
        success: false,
        message: "ID Tahun tidak valid",
      })
    }

    if (idKategori && isNaN(Number.parseInt(idKategori))) {
      return res.status(400).json({
        success: false,
        message: "ID Kategori tidak valid",
      })
    }

    if (idTahun && idKategori) {
      const existingTransaction = await prisma.transaksiApbd.findFirst({
        where: {
          idTahun: Number.parseInt(idTahun),
          idKategori: Number.parseInt(idKategori),
          NOT: {
            idTransaksi: Number.parseInt(id),
          },
        },
      })

      if (existingTransaction) {
        return res.status(400).json({
          success: false,
          message: "Duplikat - Kategori ini sudah memiliki data untuk tahun tersebut",
        })
      }
    }

    const updateData = {}
    if (idTahun !== undefined) updateData.idTahun = Number.parseInt(idTahun)
    if (idKategori !== undefined) updateData.idKategori = Number.parseInt(idKategori)
    if (jumlah !== undefined) updateData.jumlah = Number.parseFloat(jumlah)

    const updatedTransaction = await prisma.transaksiApbd.update({
      where: { idTransaksi: Number.parseInt(id) },
      data: updateData,
      include: {
        tahunAnggaran: true,
        kategoriApbd: true,
      },
    })

    // Auto calculate level 2 and 1 after updating level 3
    if (updatedTransaction.kategoriApbd.level === 3) {
      try {
        await autoCalculateLevel2(updatedTransaction.idTahun, updatedTransaction.kategoriApbd.jenis)
        await autoCalculateLevel1(updatedTransaction.idTahun, updatedTransaction.kategoriApbd.jenis)
        await updateRingkasanApbd(updatedTransaction.idTahun)
      } catch (calcError) {
        console.error("[Backend] ❌ Error in auto-calculation:", calcError)
        // Continue execution even if auto-calculation fails
      }
    }

    // Clear cache
    cache.flushAll()

    res.json({
      success: true,
      data: updatedTransaction,
      message: "Transaksi berhasil diperbarui dan level 1-2 telah dihitung ulang otomatis",
    })
  } catch (error) {
    console.error("[Backend] ❌ Update transaction error:", error)
    handleError(res, error, "Gagal memperbarui transaksi")
  }
})

// DELETE /api/transaksi-apbd/:id - Delete transaction
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params

    if (!id || isNaN(Number.parseInt(id))) {
      return res.status(400).json({
        success: false,
        message: "ID transaksi tidak valid",
      })
    }

    const transactionToDelete = await prisma.transaksiApbd.findUnique({
      where: { idTransaksi: Number.parseInt(id) },
      include: { kategoriApbd: true },
    })

    if (!transactionToDelete) {
      return res.status(404).json({
        success: false,
        message: "Transaksi tidak ditemukan",
      })
    }

    if (transactionToDelete.kategoriApbd.level !== 3) {
      return res.status(400).json({
        success: false,
        message: `Tidak dapat menghapus data secara manual untuk level ${transactionToDelete.kategoriApbd.level}. Hanya level 3 yang dapat dihapus manual. Level 1 dan 2 dihitung otomatis dari penjumlahan level di bawahnya.`,
      })
    }

    const deletedTransactionInfo = {
      idTahun: transactionToDelete.idTahun,
      jenis: transactionToDelete.kategoriApbd.jenis,
      level: transactionToDelete.kategoriApbd.level,
    }

    await prisma.transaksiApbd.delete({
      where: { idTransaksi: Number.parseInt(id) },
    })

    // Auto calculate level 2 and 1 after deleting level 3
    if (deletedTransactionInfo.level === 3) {
      try {
        await autoCalculateLevel2(deletedTransactionInfo.idTahun, deletedTransactionInfo.jenis)
        await autoCalculateLevel1(deletedTransactionInfo.idTahun, deletedTransactionInfo.jenis)
        await updateRingkasanApbd(deletedTransactionInfo.idTahun)
      } catch (calcError) {
        console.error("[Backend] ❌ Error in auto-calculation after delete:", calcError)
        // Continue execution even if auto-calculation fails
      }
    }

    // Clear cache
    cache.flushAll()

    res.json({
      success: true,
      message: "Transaksi berhasil dihapus dan level 1-2 telah dihitung ulang otomatis",
    })
  } catch (error) {
    console.error("[Backend] ❌ Delete transaction error:", error)
    handleError(res, error, "Gagal menghapus transaksi")
  }
})

// POST /api/transaksi-apbd/bulk - Bulk create transactions
router.post("/bulk", async (req, res) => {
  try {
    const { transactions } = req.body

    if (!Array.isArray(transactions) || transactions.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Data transaksi harus berupa array dan tidak boleh kosong",
      })
    }

    // Validate each transaction
    for (const transaction of transactions) {
      if (
        !transaction.idTahun ||
        !transaction.idKategori ||
        transaction.jumlah === null ||
        transaction.jumlah === undefined ||
        transaction.jumlah === ""
      ) {
        return res.status(400).json({
          success: false,
          message: "Setiap transaksi harus memiliki idTahun, idKategori, dan jumlah",
        })
      }

      const jumlahValue = Number.parseFloat(transaction.jumlah)
      if (isNaN(jumlahValue) || jumlahValue < 0) {
        return res.status(400).json({
          success: false,
          message: "Jumlah harus berupa angka dan tidak boleh negatif",
        })
      }
    }

    const categoryIds = [...new Set(transactions.map((t) => Number.parseInt(t.idKategori)))]
    const categories = await prisma.kategoriApbd.findMany({
      where: {
        idKategori: { in: categoryIds },
      },
    })

    const categoryMap = {}
    categories.forEach((cat) => {
      categoryMap[cat.idKategori] = cat
    })

    const createdTransactions = await prisma.transaksiApbd.createMany({
      data: transactions.map((t) => ({
        idTahun: Number.parseInt(t.idTahun),
        idKategori: Number.parseInt(t.idKategori),
        jumlah: Number.parseFloat(t.jumlah),
      })),
    })

    const affectedYearsAndTypes = new Set()
    transactions.forEach((t) => {
      const category = categoryMap[Number.parseInt(t.idKategori)]
      if (category && category.level === 3) {
        affectedYearsAndTypes.add(`${t.idTahun}-${category.jenis}`)
      }
    })

    console.log(`[Backend] 🔄 Starting auto-calculation for ${affectedYearsAndTypes.size} year-type combinations...`)

    for (const yearType of affectedYearsAndTypes) {
      const [idTahun, jenis] = yearType.split("-")
      try {
        await autoCalculateLevel2(Number.parseInt(idTahun), jenis)
        await autoCalculateLevel1(Number.parseInt(idTahun), jenis)
        await updateRingkasanApbd(Number.parseInt(idTahun))
        console.log(`[Backend] ✅ Auto-calculation completed for year ${idTahun}, type ${jenis}`)
      } catch (calcError) {
        console.error(`[Backend] ⚠️ Auto-calculation error for year ${idTahun}, type ${jenis}:`, calcError)
        // Continue with other calculations even if one fails
      }
    }

    // Clear cache
    cache.flushAll()

    res.status(201).json({
      success: true,
      data: createdTransactions,
      message: `${createdTransactions.count} transaksi berhasil ditambahkan dan auto-calculation completed`,
    })
  } catch (error) {
    handleError(res, error, "Gagal menambahkan transaksi bulk")
  }
})

// GET /api/transaksi-apbd/comparison - Get comparison data between years
router.get("/comparison", async (req, res) => {
  try {
    const { jenis = "Pendapatan", level = 2 } = req.query

    console.log(`[Backend] 🔍 Getting comparison data for ${jenis} level ${level}`)

    const cacheKey = `comparison_${jenis}_${level}`
    let result = cache.get(cacheKey)

    if (!result) {
      // Get all available years
      const years = await prisma.tahunAnggaran.findMany({
        orderBy: { tahun: "desc" },
        take: 2, // Get latest 2 years for comparison
      })

      if (years.length < 2) {
        return res.json({
          success: true,
          data: {
            years: years.map((y) => y.tahun),
            categories: [],
            message: "Perlu minimal 2 tahun data untuk perbandingan",
          },
        })
      }

      // Get transactions for both years
      const transactions = await prisma.transaksiApbd.findMany({
        where: {
          idTahun: {
            in: years.map((y) => y.idTahun),
          },
          kategoriApbd: {
            jenis: jenis,
            level: Number.parseInt(level),
          },
        },
        include: {
          tahunAnggaran: true,
          kategoriApbd: true,
        },
      })

      // Group by category
      const categoryData = {}
      transactions.forEach((transaction) => {
        const categoryName = transaction.kategoriApbd.namaKategori
        const year = transaction.tahunAnggaran.tahun
        const amount = Number.parseFloat(transaction.jumlah)

        if (!categoryData[categoryName]) {
          categoryData[categoryName] = {}
        }
        categoryData[categoryName][year] = amount
      })

      // Convert to array format for charts
      const categories = Object.keys(categoryData).map((categoryName) => ({
        name: categoryName,
        [years[0].tahun]: categoryData[categoryName][years[0].tahun] || 0,
        [years[1].tahun]: categoryData[categoryName][years[1].tahun] || 0,
      }))

      result = {
        years: years.map((y) => y.tahun),
        categories: categories,
      }

      cache.set(cacheKey, result, 300) // Cache for 5 minutes
    }

    console.log(`[Backend] 📊 Found comparison data for ${result.categories.length} categories`)

    res.json({
      success: true,
      data: result,
    })
  } catch (error) {
    console.error(`[Backend] ❌ Error getting comparison data:`, error)
    handleError(res, error, "Gagal mengambil data perbandingan")
  }
})

// GET /api/transaksi-apbd/composition - Get composition data for pie chart
router.get("/composition", async (req, res) => {
  try {
    const { tahun, jenis = "Pendapatan", level = 2 } = req.query

    console.log(`[Backend] 🔍 Getting composition data for ${jenis} level ${level} year ${tahun}`)

    const cacheKey = `composition_${tahun || "latest"}_${jenis}_${level}`
    let result = cache.get(cacheKey)

    if (!result) {
      let targetYear

      if (tahun) {
        targetYear = await prisma.tahunAnggaran.findFirst({
          where: { tahun: Number.parseInt(tahun) },
        })
      } else {
        // Get latest year if no year specified
        targetYear = await prisma.tahunAnggaran.findFirst({
          orderBy: { tahun: "desc" },
        })
      }

      if (!targetYear) {
        return res.json({
          success: true,
          data: {
            year: tahun || "latest",
            categories: [],
            total: 0,
            message: "Data tahun tidak ditemukan",
          },
        })
      }

      // Get transactions for the specified year and type
      const transactions = await prisma.transaksiApbd.findMany({
        where: {
          idTahun: targetYear.idTahun,
          kategoriApbd: {
            jenis: jenis,
            level: Number.parseInt(level),
          },
        },
        include: {
          kategoriApbd: true,
        },
      })

      let total = 0
      const categories = transactions.map((transaction) => {
        const amount = Number.parseFloat(transaction.jumlah)
        total += amount
        return {
          name: transaction.kategoriApbd.namaKategori,
          value: amount,
          kode: transaction.kategoriApbd.kode,
        }
      })

      // Calculate percentages
      const categoriesWithPercentage = categories.map((cat) => ({
        ...cat,
        percentage: total > 0 ? ((cat.value / total) * 100).toFixed(1) : 0,
      }))

      result = {
        year: targetYear.tahun,
        categories: categoriesWithPercentage,
        total: total,
      }

      cache.set(cacheKey, result, 300) // Cache for 5 minutes
    }

    console.log(`[Backend] 📊 Found composition data: ${result.categories.length} categories, total: ${result.total}`)

    res.json({
      success: true,
      data: result,
    })
  } catch (error) {
    console.error(`[Backend] ❌ Error getting composition data:`, error)
    handleError(res, error, "Gagal mengambil data komposisi")
  }
})

// POST /api/transaksi-apbd/ensure-ringkasan - Ensure ringkasan records exist for all years with transactions
router.post("/ensure-ringkasan", async (req, res) => {
  try {
    await ensureRingkasanForAllYears()
    res.json({
      success: true,
      message: "Ringkasan records ensured for all years with transactions",
    })
  } catch (error) {
    handleError(res, error, "Gagal memastikan ringkasan untuk semua tahun")
  }
})

module.exports = router
