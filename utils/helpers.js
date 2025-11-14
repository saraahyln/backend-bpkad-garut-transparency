// Helper functions for data processing and formatting

const formatCurrency = (amount) => {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

const formatNumber = (number) => {
  return new Intl.NumberFormat("id-ID").format(number);
};

const calculatePercentage = (part, total) => {
  if (total === 0) return 0;
  return ((part / total) * 100).toFixed(2);
};

const handleError = (res, error, message = "Terjadi kesalahan server") => {
  console.error("API Error:", error);

  // Handle Prisma specific errors
  if (error.code === "P2002") {
    return res.status(400).json({
      success: false,
      message: "Data sudah ada (duplikat)",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }

  if (error.code === "P2025") {
    return res.status(404).json({
      success: false,
      message: "Data tidak ditemukan",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }

  // Handle validation errors
  if (error.name === "ValidationError") {
    return res.status(400).json({
      success: false,
      message: "Data tidak valid",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }

  // Generic error response
  res.status(500).json({
    success: false,
    message,
    error: process.env.NODE_ENV === "development" ? error.message : undefined,
  });
};

const buildCategoryTree = (categories) => {
  const categoryMap = {};
  const tree = [];

  // Create a map of all categories
  categories.forEach((category) => {
    categoryMap[category.idKategori] = { ...category, children: [] };
  });

  // Build the tree structure
  categories.forEach((category) => {
    if (category.idParent === null) {
      tree.push(categoryMap[category.idKategori]);
    } else {
      if (categoryMap[category.idParent]) {
        categoryMap[category.idParent].children.push(
          categoryMap[category.idKategori]
        );
      }
    }
  });

  return tree;
};

const aggregateByCategory = (transactions, level = 2) => {
  const aggregated = {};

  transactions.forEach((transaction) => {
    if (transaction.kategoriApbd.level === level) {
      const categoryName = transaction.kategoriApbd.namaKategori;
      if (!aggregated[categoryName]) {
        aggregated[categoryName] = {
          nama: categoryName,
          jumlah: 0,
          jenis: transaction.kategoriApbd.jenis,
        };
      }
      aggregated[categoryName].jumlah += Number.parseFloat(transaction.jumlah);
    }
  });

  return Object.values(aggregated);
};

module.exports = {
  formatCurrency,
  formatNumber,
  calculatePercentage,
  handleError,
  buildCategoryTree,
  aggregateByCategory,
};
