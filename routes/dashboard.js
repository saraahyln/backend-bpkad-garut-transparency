const express = require("express")
const router = express.Router()
const { prisma, cache } = require("../config/database")
const { handleError } = require("../utils/helpers")

// Get dashboard summary with caching
router.get("/summary/:year?", async (req, res) => {
  try {
    const year = req.params.year ? Number.parseInt(req.params.year) : null

    if (!year) {
      return res.status(400).json({
        success: false,
        message: "Parameter tahun diperlukan",
      })
    }

    const cacheKey = `dashboard_summary_${year}`

    console.log(`[v0] 📊 Dashboard Summary Request - Year: ${year}`)

    cache.del(cacheKey)
    // Clear all dashboard related cache
    cache.flushAll()

    const tahunAnggaran = await prisma.tahunAnggaran.findFirst({
      where: { tahun: year },
    })

    if (!tahunAnggaran) {
      console.log(`[v0] ❌ Year ${year} not found in database`)
      return res.status(404).json({
        success: false,
        message: `Tahun ${year} tidak ditemukan dalam database`,
        debug: {
          year: year,
          foundPreCalculated: false,
          calculationSteps: [`Year ${year} not found in tahun_anggaran table`],
        },
      })
    }

    console.log(`[v0] ✅ Found tahunAnggaran with idTahun: ${tahunAnggaran.idTahun}`)

    let ringkasan = await prisma.ringkasanApbd.findFirst({
      where: {
        idTahun: tahunAnggaran.idTahun, // Use idTahun directly
      },
      include: {
        tahunAnggaran: true,
      },
    })

    const debugInfo = {
      year: year,
      idTahun: tahunAnggaran.idTahun,
      foundPreCalculated: !!ringkasan,
      calculationSteps: [],
    }

    debugInfo.calculationSteps.push(`Found tahunAnggaran with idTahun: ${tahunAnggaran.idTahun}`)

    if (ringkasan) {
      debugInfo.calculationSteps.push("Using pre-calculated ringkasan data")
      console.log(`[v0] ✅ Using ringkasan data:`, {
        totalPendapatan: Number(ringkasan.totalPendapatan || 0),
        totalPembelanjaan: Number(ringkasan.totalPembelanjaan || 0), // Database field name
        surplusDefisit: Number(ringkasan.surplusDefisit || 0),
        pembiayaanNetto: Number(ringkasan.pembiayaanNetto || 0),
        sisaPembiayaan: Number(ringkasan.sisaPembiayaan || 0),
      })

      // Map database field to expected API field
      ringkasan.totalBelanja = ringkasan.totalPembelanjaan
    } else {
      debugInfo.calculationSteps.push("No ringkasan found, calculating from transactions")

      const allTransactions = await prisma.transaksiApbd.findMany({
        where: {
          idTahun: tahunAnggaran.idTahun,
        },
        include: {
          kategoriApbd: true,
          tahunAnggaran: true,
        },
      })

      console.log(
        `[v0] 🔍 Found ${allTransactions.length} transactions for year ${year} (idTahun: ${tahunAnggaran.idTahun})`,
      )

      debugInfo.calculationSteps.push(`Found ${allTransactions.length} total transactions for year ${year}`)

      if (allTransactions.length === 0) {
        console.log(`[v0] ⚠️ No transactions found for year ${year}, returning empty data`)

        const emptyResult = {
          tahun: year,
          totalPendapatan: 0,
          totalBelanja: 0,
          surplusDefisit: 0,
          pembiayaanNetto: 0,
          sisaPembiayaan: 0,
          totalPenerimaanPembiayaan: 0,
          totalPengeluaranPembiayaan: 0,
          kategoriPendapatan: [],
          kategoriBelanja: [],
          kategoriPembiayaan: [], // Added pembiayaan categories for completeness
          nomorPerda: tahunAnggaran.nomorPerda,
          tanggalPenetapan: tahunAnggaran.tanggalPenetapan,
          debug: {
            ...debugInfo,
            message: `No transaction data found for year ${year}`,
          },
        }

        return res.json({
          success: true,
          data: emptyResult,
        })
      }

      const pendapatanTransactions = allTransactions.filter(
        (t) => t.kategoriApbd.jenis === "Pendapatan" && t.kategoriApbd.level === 1,
      )
      const belanjaTransactions = allTransactions.filter(
        (t) =>
          (t.kategoriApbd.jenis === "Pembelanjaan" || t.kategoriApbd.jenis === "Belanja") && t.kategoriApbd.level === 1,
      )
      const pembiayaanTransactions = allTransactions.filter((t) => t.kategoriApbd.jenis === "Pembiayaan")

      console.log(`[v0] 🔍 Transaction breakdown (Level 1 only for Pendapatan/Belanja):`)
      console.log(`[v0] 💰 Pendapatan transactions (Level 1): ${pendapatanTransactions.length}`)
      console.log(`[v0] 💸 Belanja transactions (Level 1): ${belanjaTransactions.length}`)
      console.log(`[v0] 🏦 Pembiayaan transactions: ${pembiayaanTransactions.length}`)

      const totalPendapatan = pendapatanTransactions.reduce((sum, t) => sum + Number(t.jumlah), 0)
      const totalBelanja = belanjaTransactions.reduce((sum, t) => sum + Number(t.jumlah), 0)
      const surplusDefisit = totalPendapatan - totalBelanja

      console.log(`[v0] 💸 Calculated totalBelanja: Rp ${totalBelanja.toLocaleString("id-ID")}`)

      const pembiayaanPenerimaan = pembiayaanTransactions
        .filter((t) => t.kategoriApbd.namaKategori.toLowerCase().includes("penerimaan"))
        .reduce((sum, t) => sum + Number(t.jumlah), 0)
      const pembiayaanPengeluaran = pembiayaanTransactions
        .filter((t) => t.kategoriApbd.namaKategori.toLowerCase().includes("pengeluaran"))
        .reduce((sum, t) => sum + Number(t.jumlah), 0)

      const pembiayaanNetto = pembiayaanPenerimaan - pembiayaanPengeluaran
      const sisaPembiayaan = surplusDefisit + pembiayaanNetto

      ringkasan = {
        totalPendapatan,
        totalBelanja,
        totalPembelanjaan: totalBelanja, // Keep both field names for compatibility
        surplusDefisit,
        pembiayaanNetto,
        sisaPembiayaan,
        totalPenerimaanPembiayaan: pembiayaanPenerimaan,
        totalPengeluaranPembiayaan: pembiayaanPengeluaran,
        tahunAnggaran,
      }

      debugInfo.calculationSteps.push("Using manual calculation results")
    }

    const kategoriPendapatan = await prisma.kategoriApbd.findMany({
      where: {
        jenis: "Pendapatan",
        level: 2, // Get main categories
      },
      include: {
        transaksiApbd: {
          where: {
            idTahun: tahunAnggaran.idTahun, // Use idTahun for consistency
          },
        },
      },
    })

    const kategoriBelanja = await prisma.kategoriApbd.findMany({
      where: {
        OR: [{ jenis: "Pembelanjaan" }, { jenis: "Belanja" }],
        level: 2, // Get main categories
      },
      include: {
        transaksiApbd: {
          where: {
            idTahun: tahunAnggaran.idTahun, // Use idTahun for consistency
          },
        },
      },
    })

    const kategoriPembiayaan = await prisma.kategoriApbd.findMany({
      where: {
        jenis: "Pembiayaan",
        level: 2,
      },
      include: {
        transaksiApbd: {
          where: {
            idTahun: tahunAnggaran.idTahun,
          },
        },
      },
    })

    const processedKategoriPendapatan = kategoriPendapatan
      .map((kategori) => ({
        kategori: kategori.namaKategori, // Use kategori field name as expected by frontend
        nama: kategori.namaKategori,
        kode: kategori.kode,
        jumlah: kategori.transaksiApbd.reduce((sum, transaksi) => sum + Number(transaksi.jumlah || 0), 0),
      }))
      .filter((kategori) => kategori.jumlah > 0) // Only show categories with actual data

    const processedKategoriBelanja = kategoriBelanja
      .map((kategori) => ({
        kategori: kategori.namaKategori, // Use kategori field name as expected by frontend
        nama: kategori.namaKategori,
        kode: kategori.kode,
        jumlah: kategori.transaksiApbd.reduce((sum, transaksi) => sum + Number(transaksi.jumlah || 0), 0),
      }))
      .filter((kategori) => kategori.jumlah > 0) // Only show categories with actual data

    const processedKategoriPembiayaan = kategoriPembiayaan
      .map((kategori) => ({
        kategori: kategori.namaKategori,
        nama: kategori.namaKategori,
        kode: kategori.kode,
        jumlah: kategori.transaksiApbd.reduce((sum, transaksi) => sum + Number(transaksi.jumlah || 0), 0),
      }))
      .filter((kategori) => kategori.jumlah > 0)

    console.log(`[v0] ✅ Database Data Retrieved:`)
    console.log(`[v0] 💰 Pendapatan: Rp ${Number(ringkasan.totalPendapatan || 0).toLocaleString("id-ID")}`)
    console.log(
      `[v0] 💸 Belanja: Rp ${Number(ringkasan.totalBelanja || ringkasan.totalPembelanjaan || 0).toLocaleString(
        "id-ID",
      )}`,
    )
    console.log(`[v0] 📈 Surplus/Defisit: Rp ${Number(ringkasan.surplusDefisit || 0).toLocaleString("id-ID")}`)
    console.log(`[v0] 🏦 Pembiayaan Netto: Rp ${Number(ringkasan.pembiayaanNetto || 0).toLocaleString("id-ID")}`)
    console.log(`[v0] 💾 SILPA: Rp ${Number(ringkasan.sisaPembiayaan || 0).toLocaleString("id-ID")}`)
    console.log(`[v0] 📊 Kategori Pendapatan: ${processedKategoriPendapatan.length} items`)
    console.log(`[v0] 📊 Kategori Belanja: ${processedKategoriBelanja.length} items`)
    console.log(`[v0] 📊 Kategori Pembiayaan: ${processedKategoriPembiayaan.length} items`)

    const result = {
      tahun: year,
      totalPendapatan: Number(ringkasan.totalPendapatan || 0), // Convert Decimal to Number
      totalBelanja: Number(ringkasan.totalBelanja || ringkasan.totalPembelanjaan || 0), // Convert Decimal to Number
      surplusDefisit: Number(ringkasan.surplusDefisit || 0), // Convert Decimal to Number
      pembiayaanNetto: Number(ringkasan.pembiayaanNetto || 0), // Convert Decimal to Number
      sisaPembiayaan: Number(ringkasan.sisaPembiayaan || 0), // Convert Decimal to Number
      totalPenerimaanPembiayaan: Number(ringkasan.totalPenerimaanPembiayaan || 0),
      totalPengeluaranPembiayaan: Number(ringkasan.totalPengeluaranPembiayaan || 0),
      kategoriPendapatan: processedKategoriPendapatan,
      kategoriBelanja: processedKategoriBelanja,
      kategoriPembiayaan: processedKategoriPembiayaan, // Added pembiayaan categories for completeness
      nomorPerda: tahunAnggaran.nomorPerda,
      tanggalPenetapan: tahunAnggaran.tanggalPenetapan,
      debug: debugInfo,
    }

    console.log(`[v0] 📤 Sending API Response:`, JSON.stringify(result, null, 2))

    // cache.set(cacheKey, result, 60) // Disabled caching for debugging
    res.json({
      success: true,
      data: result,
    })
  } catch (error) {
    handleError(res, error, "Gagal mengambil ringkasan dashboard")
  }
})

// Get multi-year comparison
router.get("/comparison", async (req, res) => {
  try {
    const cacheKey = "dashboard_comparison"

    console.log(`[v0] 📊 Multi-year Comparison Request`)

    cache.del(cacheKey)

    console.log(`[v0] 🔍 Querying database for all years`)

    const availableYears = await prisma.tahunAnggaran.findMany({
      orderBy: {
        tahun: "asc",
      },
    })

    console.log(
      `[v0] 📅 Found ${availableYears.length} available years:`,
      availableYears.map((y) => y.tahun),
    )

    const result = []

    for (const yearData of availableYears) {
      const year = yearData.tahun

      const ringkasan = await prisma.ringkasanApbd.findFirst({
        where: {
          idTahun: yearData.idTahun, // Use idTahun directly
        },
        include: {
          tahunAnggaran: true,
        },
      })

      if (!ringkasan) {
        console.log(`[v0] 🔄 Calculating from transactions for year ${year}`)

        const pendapatanTotal = await prisma.transaksiApbd.aggregate({
          where: {
            idTahun: yearData.idTahun, // Use idTahun instead of nested relation
            kategoriApbd: {
              jenis: "Pendapatan",
              level: 1, // Only count Level 1 categories
            },
          },
          _sum: { jumlah: true },
        })

        const belanjaTotal = await prisma.transaksiApbd.aggregate({
          where: {
            idTahun: yearData.idTahun, // Use idTahun instead of nested relation
            kategoriApbd: {
              OR: [{ jenis: "Pembelanjaan" }, { jenis: "Belanja" }],
              level: 1, // Only count Level 1 categories
            },
          },
          _sum: { jumlah: true },
        })

        const pembiayaanPenerimaan = await prisma.transaksiApbd.aggregate({
          where: {
            idTahun: yearData.idTahun, // Use idTahun instead of nested relation
            kategoriApbd: {
              jenis: "Pembiayaan",
              namaKategori: { contains: "Penerimaan" },
            },
          },
          _sum: { jumlah: true },
        })

        const pembiayaanPengeluaran = await prisma.transaksiApbd.aggregate({
          where: {
            idTahun: yearData.idTahun, // Use idTahun instead of nested relation
            kategoriApbd: {
              jenis: "Pembiayaan",
              namaKategori: { contains: "Pengeluaran" },
            },
          },
          _sum: { jumlah: true },
        })

        const totalPendapatan = pendapatanTotal._sum.jumlah ? Number(pendapatanTotal._sum.jumlah) : 0
        const totalBelanja = belanjaTotal._sum.jumlah ? Number(belanjaTotal._sum.jumlah) : 0
        const surplusDefisit = totalPendapatan - totalBelanja
        const pembiayaanNetto =
          (pembiayaanPenerimaan._sum.jumlah ? Number(pembiayaanPenerimaan._sum.jumlah) : 0) -
          (pembiayaanPengeluaran._sum.jumlah ? Number(pembiayaanPengeluaran._sum.jumlah) : 0)

        if (totalPendapatan > 0 || totalBelanja > 0) {
          result.push({
            tahun: year,
            pendapatan: totalPendapatan,
            belanja: totalBelanja,
            surplusDefisit: surplusDefisit,
            pembiayaanNetto: pembiayaanNetto,
          })
        }
      } else {
        result.push({
          tahun: year,
          pendapatan: Number(ringkasan.totalPendapatan || 0),
          belanja: Number(ringkasan.totalBelanja || ringkasan.totalPembelanjaan || 0),
          surplusDefisit: Number(ringkasan.surplusDefisit || 0),
          pembiayaanNetto: Number(ringkasan.pembiayaanNetto || 0),
        })
      }
    }

    console.log(`[v0] ✅ Processed ${result.length} years with data:`)
    result.forEach((item) => {
      console.log(
        `[v0] 📅 Year ${item.tahun}: Pendapatan Rp ${item.pendapatan?.toLocaleString(
          "id-ID",
        )}, Belanja Rp ${item.belanja?.toLocaleString("id-ID")}`,
      )
    })

    console.log(`[v0] 📤 Sending Comparison API Response with ${result.length} years`)

    cache.set(cacheKey, result)
    res.json({
      success: true,
      data: result,
      total: result.length,
    })
  } catch (error) {
    handleError(res, error, "Gagal mengambil data perbandingan")
  }
})

module.exports = router
