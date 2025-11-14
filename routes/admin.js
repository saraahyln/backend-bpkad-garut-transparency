const express = require("express")
const router = express.Router()
const { prisma, cache } = require("../config/database")
const { handleError } = require("../utils/helpers")

// Get all years
router.get("/years", async (req, res) => {
  try {
    const years = await prisma.tahunAnggaran.findMany({
      orderBy: { tahun: "desc" },
    })
    res.json({
      success: true,
      data: years,
      total: years.length,
    })
  } catch (error) {
    handleError(res, error, "Gagal mengambil data tahun anggaran")
  }
})

// Add new year
router.post("/years", async (req, res) => {
  try {
    const { tahun, nomorPerda, tanggalPenetapan } = req.body

    const newYear = await prisma.tahunAnggaran.create({
      data: {
        tahun: Number.parseInt(tahun),
        nomorPerda,
        tanggalPenetapan: tanggalPenetapan ? new Date(tanggalPenetapan) : null,
      },
    })

    // Clear related caches
    cache.flushAll()

    res.status(201).json({
      success: true,
      data: newYear,
      message: "Tahun anggaran berhasil ditambahkan",
    })
  } catch (error) {
    handleError(res, error, "Gagal menambahkan tahun anggaran")
  }
})

// Get all categories with hierarchy
router.get("/categories", async (req, res) => {
  try {
    const categories = await prisma.kategoriApbd.findMany({
      include: {
        parent: true,
        children: true,
      },
      orderBy: [{ level: "asc" }, { idKategori: "asc" }],
    })
    res.json({
      success: true,
      data: categories,
      total: categories.length,
    })
  } catch (error) {
    handleError(res, error, "Gagal mengambil data kategori")
  }
})

// Add new category
router.post("/categories", async (req, res) => {
  try {
    const { idParent, jenis, namaKategori, level } = req.body

    const newCategory = await prisma.kategoriApbd.create({
      data: {
        idParent: idParent ? Number.parseInt(idParent) : null,
        jenis,
        namaKategori,
        level: Number.parseInt(level),
      },
    })

    cache.flushAll()
    res.status(201).json({
      success: true,
      data: newCategory,
      message: "Kategori berhasil ditambahkan",
    })
  } catch (error) {
    handleError(res, error, "Gagal menambahkan kategori")
  }
})

// Get transactions with pagination
router.get("/transactions", async (req, res) => {
  try {
    const page = Number.parseInt(req.query.page) || 1
    const limit = Number.parseInt(req.query.limit) || 50
    const skip = (page - 1) * limit

    const [transactions, total] = await Promise.all([
      prisma.transaksiApbd.findMany({
        skip,
        take: limit,
        include: {
          tahunAnggaran: true,
          kategoriApbd: true,
        },
        orderBy: {
          idTransaksi: "desc",
        },
      }),
      prisma.transaksiApbd.count(),
    ])

    res.json({
      success: true,
      data: transactions,
      total: total,
      pagination: {
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    handleError(res, error, "Gagal mengambil data transaksi")
  }
})

// Function to update ringkasan_apbd table - hanya menghitung dari level 1
async function updateRingkasanApbd(idTahun) {
  console.log(`[Admin] 🔄 Updating Ringkasan APBD for year ${idTahun}`)

  // Check if there are any transactions for this year first
  const hasAnyTransactions = await prisma.transaksiApbd.count({
    where: { idTahun },
  })

  // If no transactions exist, don't create/update summary
  if (hasAnyTransactions === 0) {
    console.log(`[Admin] ℹ️ No transactions found for year ${idTahun}, skipping summary update`)
    return
  }

  // Get totals from level 1 transactions ONLY (bukan semua level)
  const [pendapatanTotal, belanjaTotal, penerimaanPembiayaan, pengeluaranPembiayaan] = await Promise.all([
    // Total Pendapatan (level 1 saja)
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
    // Total Belanja (level 1 saja)
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

  const totalPendapatan = Number(pendapatanTotal._sum.jumlah || 0)
  const totalBelanja = Number(belanjaTotal._sum.jumlah || 0)
  const totalPenerimaan = Number(penerimaanPembiayaan._sum.jumlah || 0)
  const totalPengeluaran = Number(pengeluaranPembiayaan._sum.jumlah || 0)

  // Calculate derived values sesuai permintaan user:
  // - Jika salah satu operand ada nilai, gunakan nilai tersebut
  // - Jika kedua operand ada, lakukan operasi
  // - Jika tidak ada sama sekali, beri 0
  let surplusDefisit = 0
  if (totalPendapatan > 0 && totalBelanja > 0) {
    // Both operands exist, perform operation
    surplusDefisit = totalPendapatan - totalBelanja
  } else if (totalPendapatan > 0) {
    // Only pendapatan exists, use that value
    surplusDefisit = totalPendapatan
  } else if (totalBelanja > 0) {
    // Only belanja exists, use negative value
    surplusDefisit = -totalBelanja
  }
  // If neither exists, surplusDefisit remains 0

  let pembiayaanNetto = 0
  if (totalPenerimaan > 0 && totalPengeluaran > 0) {
    // Both operands exist, perform operation
    pembiayaanNetto = totalPenerimaan - totalPengeluaran
  } else if (totalPenerimaan > 0) {
    // Only penerimaan exists, use that value
    pembiayaanNetto = totalPenerimaan
  } else if (totalPengeluaran > 0) {
    // Only pengeluaran exists, use negative value
    pembiayaanNetto = -totalPengeluaran
  }
  // If neither exists, pembiayaanNetto remains 0

  // Calculate sisa pembiayaan
  let sisaPembiayaan = 0
  if (surplusDefisit !== 0 && pembiayaanNetto !== 0) {
    // Both operands exist, perform operation
    sisaPembiayaan = surplusDefisit + pembiayaanNetto
  } else if (surplusDefisit !== 0) {
    // Only surplus/deficit exists, use that value
    sisaPembiayaan = surplusDefisit
  } else if (pembiayaanNetto !== 0) {
    // Only pembiayaan netto exists, use that value
    sisaPembiayaan = pembiayaanNetto
  }
  // If neither exists, sisaPembiayaan remains 0

  console.log(`[Admin] 📊 Calculated values for idTahun ${idTahun}:`, {
    totalPendapatan,
    totalBelanja,
    totalPenerimaan,
    totalPengeluaran,
    surplusDefisit,
    pembiayaanNetto,
    sisaPembiayaan,
  })

  // Create or update summary record - akan otomatis membuat record baru jika belum ada
  const existingRingkasan = await prisma.ringkasanApbd.findFirst({
    where: { idTahun },
  })

  if (existingRingkasan) {
    const updatedRingkasan = await prisma.ringkasanApbd.update({
      where: { idRingkasan: existingRingkasan.idRingkasan },
      data: {
        totalPendapatan,
        totalBelanja,
        surplusDefisit,
        pembiayaanNetto,
        sisaPembiayaan,
        totalPenerimaanPembiayaan: totalPenerimaan,
        totalPengeluaranPembiayaan: totalPengeluaran,
      },
    })
    console.log(`[Admin] ✅ Updated existing Ringkasan APBD:`, updatedRingkasan)
  } else {
    const newRingkasan = await prisma.ringkasanApbd.create({
      data: {
        idTahun,
        totalPendapatan,
        totalBelanja,
        surplusDefisit,
        pembiayaanNetto,
        sisaPembiayaan,
        totalPenerimaanPembiayaan: totalPenerimaan,
        totalPengeluaranPembiayaan: totalPengeluaran,
      },
    })
    console.log(`[Admin] ✅ Created new Ringkasan APBD:`, newRingkasan)
  }
}

// Add new transaction
router.post("/transactions", async (req, res) => {
  try {
    const { idTahun, idKategori, jumlah } = req.body

    const newTransaction = await prisma.transaksiApbd.create({
      data: {
        idTahun: Number.parseInt(idTahun),
        idKategori: Number.parseInt(idKategori),
        jumlah: Number.parseFloat(jumlah),
      },
    })

    await updateRingkasanApbd(Number.parseInt(idTahun))

    cache.flushAll()
    res.status(201).json({
      success: true,
      data: newTransaction,
      message: "Transaksi berhasil ditambahkan",
    })
  } catch (error) {
    handleError(res, error, "Gagal menambahkan transaksi")
  }
})

// Update transaction endpoint
router.put("/transactions/:id", async (req, res) => {
  try {
    const { id } = req.params
    const { jumlah } = req.body

    const updatedTransaction = await prisma.transaksiApbd.update({
      where: { idTransaksi: Number.parseInt(id) },
      data: { jumlah: Number.parseFloat(jumlah) },
      include: { tahunAnggaran: true },
    })

    // Update ringkasan_apbd after updating transaction
    await updateRingkasanApbd(updatedTransaction.idTahun)

    cache.flushAll()
    res.json({
      success: true,
      data: updatedTransaction,
      message: "Transaksi berhasil diperbarui",
    })
  } catch (error) {
    handleError(res, error, "Gagal memperbarui transaksi")
  }
})

// Delete transaction endpoint
router.delete("/transactions/:id", async (req, res) => {
  try {
    const { id } = req.params

    const transaction = await prisma.transaksiApbd.findUnique({
      where: { idTransaksi: Number.parseInt(id) },
    })

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: "Transaksi tidak ditemukan",
      })
    }

    await prisma.transaksiApbd.delete({
      where: { idTransaksi: Number.parseInt(id) },
    })

    // Update ringkasan_apbd after deleting transaction
    await updateRingkasanApbd(transaction.idTahun)

    cache.flushAll()
    res.json({
      success: true,
      message: "Transaksi berhasil dihapus",
    })
  } catch (error) {
    handleError(res, error, "Gagal menghapus transaksi")
  }
})

module.exports = router
