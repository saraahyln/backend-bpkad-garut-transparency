-- ======================
-- Add Level 3 Categories for APBD
-- ======================

-- Level 3 untuk Pendapatan Asli Daerah (PAD)
INSERT INTO "Kategori_APBD" (id_kategori, id_parent, jenis, nama_kategori, level, kode) VALUES
(13, 4, 'Pendapatan', 'Pajak Daerah', 3, '4.1.1'),
(14, 4, 'Pendapatan', 'Retribusi Daerah', 3, '4.1.2'),
(15, 4, 'Pendapatan', 'Hasil Pengelolaan Kekayaan Daerah yang Dipisahkan', 3, '4.1.3'),
(16, 4, 'Pendapatan', 'Lain-lain PAD yang Sah', 3, '4.1.4')
ON CONFLICT (id_kategori) DO NOTHING;

-- Level 3 untuk Pendapatan Transfer
INSERT INTO "Kategori_APBD" (id_kategori, id_parent, jenis, nama_kategori, level, kode) VALUES
(17, 5, 'Pendapatan', 'Transfer Pemerintah Pusat - Dana Perimbangan', 3, '4.2.1'),
(18, 5, 'Pendapatan', 'Transfer Pemerintah Pusat - Lainnya', 3, '4.2.2'),
(19, 5, 'Pendapatan', 'Transfer Pemerintah Provinsi', 3, '4.2.3')
ON CONFLICT (id_kategori) DO NOTHING;

-- Level 3 untuk Lain-lain Pendapatan yang Sah
INSERT INTO "Kategori_APBD" (id_kategori, id_parent, jenis, nama_kategori, level, kode) VALUES
(20, 6, 'Pendapatan', 'Pendapatan Hibah', 3, '4.3.1'),
(21, 6, 'Pendapatan', 'Dana Darurat', 3, '4.3.2'),
(22, 6, 'Pendapatan', 'Lainnya sesuai dengan ketentuan peraturan perundang-undangan', 3, '4.3.3')
ON CONFLICT (id_kategori) DO NOTHING;

-- Level 3 untuk Belanja Operasi
INSERT INTO "Kategori_APBD" (id_kategori, id_parent, jenis, nama_kategori, level, kode) VALUES
(23, 7, 'Belanja', 'Belanja Pegawai', 3, '5.1.1'),
(24, 7, 'Belanja', 'Belanja Barang dan Jasa', 3, '5.1.2'),
(25, 7, 'Belanja', 'Belanja Bunga', 3, '5.1.3'),
(26, 7, 'Belanja', 'Belanja Subsidi', 3, '5.1.4'),
(27, 7, 'Belanja', 'Belanja Hibah', 3, '5.1.5'),
(28, 7, 'Belanja', 'Belanja Bantuan Sosial', 3, '5.1.6')
ON CONFLICT (id_kategori) DO NOTHING;

-- Level 3 untuk Belanja Modal
INSERT INTO "Kategori_APBD" (id_kategori, id_parent, jenis, nama_kategori, level, kode) VALUES
(29, 8, 'Belanja', 'Belanja Tanah', 3, '5.2.1'),
(30, 8, 'Belanja', 'Belanja Peralatan dan Mesin', 3, '5.2.2'),
(31, 8, 'Belanja', 'Belanja Gedung dan Bangunan', 3, '5.2.3'),
(32, 8, 'Belanja', 'Belanja Jalan, Irigasi dan Jaringan', 3, '5.2.4'),
(33, 8, 'Belanja', 'Belanja Aset Tetap Lainnya', 3, '5.2.5')
ON CONFLICT (id_kategori) DO NOTHING;

-- Level 3 untuk Belanja Transfer
INSERT INTO "Kategori_APBD" (id_kategori, id_parent, jenis, nama_kategori, level, kode) VALUES
(34, 9, 'Belanja', 'Belanja Bagi Hasil Pajak kepada Pemerintah Desa', 3, '5.3.1'),
(35, 9, 'Belanja', 'Belanja Bagi Hasil Retribusi kepada Pemerintah Desa', 3, '5.3.2'),
(36, 9, 'Belanja', 'Belanja Bantuan Keuangan kepada Pemerintah Desa', 3, '5.3.3'),
(37, 9, 'Belanja', 'Belanja Bantuan Keuangan kepada Partai Politik', 3, '5.3.4')
ON CONFLICT (id_kategori) DO NOTHING;

-- Level 3 untuk Belanja Tidak Terduga
INSERT INTO "Kategori_APBD" (id_kategori, id_parent, jenis, nama_kategori, level, kode) VALUES
(38, 10, 'Belanja', 'Belanja Tidak Terduga', 3, '5.4.1')
ON CONFLICT (id_kategori) DO NOTHING;

-- Level 3 untuk Penerimaan Pembiayaan
INSERT INTO "Kategori_APBD" (id_kategori, id_parent, jenis, nama_kategori, level, kode) VALUES
(39, 11, 'Pembiayaan', 'Penggunaan SiLPA', 3, '6.1.1'),
(40, 11, 'Pembiayaan', 'Pencairan Dana Cadangan', 3, '6.1.2'),
(41, 11, 'Pembiayaan', 'Hasil Penjualan Kekayaan Daerah yang Dipisahkan', 3, '6.1.3'),
(42, 11, 'Pembiayaan', 'Penerimaan Pinjaman Daerah', 3, '6.1.4'),
(43, 11, 'Pembiayaan', 'Penerimaan Kembali Pemberian Pinjaman', 3, '6.1.5')
ON CONFLICT (id_kategori) DO NOTHING;

-- Level 3 untuk Pengeluaran Pembiayaan
INSERT INTO "Kategori_APBD" (id_kategori, id_parent, jenis, nama_kategori, level, kode) VALUES
(44, 12, 'Pembiayaan', 'Pembentukan Dana Cadangan', 3, '6.2.1'),
(45, 12, 'Pembiayaan', 'Penyertaan Modal (Investasi) Pemerintah Daerah', 3, '6.2.2'),
(46, 12, 'Pembiayaan', 'Pembayaran Pokok Utang', 3, '6.2.3'),
(47, 12, 'Pembiayaan', 'Pemberian Pinjaman Daerah', 3, '6.2.4')
ON CONFLICT (id_kategori) DO NOTHING;

-- Update sequence untuk memastikan ID selanjutnya benar
SELECT setval(pg_get_serial_sequence('"Kategori_APBD"', 'id_kategori'), 47);
