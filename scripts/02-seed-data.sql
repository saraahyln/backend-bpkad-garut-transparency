-- ======================
-- Seed Data
-- ======================

-- 1. Tahun Anggaran
INSERT INTO "Tahun_Anggaran" (id_tahun, tahun, nomor_perda, tanggal_penetapan) VALUES
(1, 2022, '9/2021', '2021-12-27'),
(2, 2023, '7/2023', '2023-10-25'),
(3, 2024, '5/2024', '2024-10-28')
ON CONFLICT (id_tahun) DO NOTHING;

-- 2. Kategori APBD
-- Level 1
INSERT INTO "Kategori_APBD" (id_kategori, id_parent, jenis, nama_kategori, level) VALUES
(1, NULL, 'Pendapatan', 'Pendapatan', 1),
(2, NULL, 'Belanja', 'Belanja', 1),
(3, NULL, 'Pembiayaan', 'Pembiayaan', 1)
ON CONFLICT (id_kategori) DO NOTHING;

-- Pendapatan
INSERT INTO "Kategori_APBD" (id_kategori, id_parent, jenis, nama_kategori, level) VALUES
(4, 1, 'Pendapatan', 'Pendapatan Asli Daerah (PAD)', 2),
(5, 1, 'Pendapatan', 'Pendapatan Transfer', 2),
(6, 1, 'Pendapatan', 'Lain-lain Pendapatan yang Sah', 2)
ON CONFLICT (id_kategori) DO NOTHING;

-- Belanja
INSERT INTO "Kategori_APBD" (id_kategori, id_parent, jenis, nama_kategori, level) VALUES
(7, 2, 'Belanja', 'Belanja Operasi', 2),
(8, 2, 'Belanja', 'Belanja Modal', 2),
(9, 2, 'Belanja', 'Belanja Transfer', 2),
(10, 2, 'Belanja', 'Belanja Tidak Terduga', 2)
ON CONFLICT (id_kategori) DO NOTHING;

-- Pembiayaan
INSERT INTO "Kategori_APBD" (id_kategori, id_parent, jenis, nama_kategori, level) VALUES
(11, 3, 'Pembiayaan', 'Penerimaan Pembiayaan', 2),
(12, 3, 'Pembiayaan', 'Pengeluaran Pembiayaan', 2)
ON CONFLICT (id_kategori) DO NOTHING;

-- 3. Transaksi APBD
-- Tahun 2022
INSERT INTO "Transaksi_APBD" (id_tahun, id_kategori, jumlah) VALUES
(1, 4, 538398717097),   -- PAD
(1, 5, 3662824173552),  -- Transfer
(1, 6, 31646012689),    -- Lain-lain Pendapatan
(1, 7, 3190766826443),  -- Belanja Operasi
(1, 8, 414503364911),   -- Belanja Modal
(1, 9, 723092285519),   -- Belanja Transfer
(1, 10, 90506426465),   -- Belanja Tidak Terduga
(1, 11, 196000000000),  -- Penerimaan Pembiayaan
(1, 12, 10000000000)    -- Pengeluaran Pembiayaan
ON CONFLICT DO NOTHING;

-- Tahun 2023
INSERT INTO "Transaksi_APBD" (id_tahun, id_kategori, jumlah) VALUES
(2, 4, 527550074727),
(2, 5, 4294500827444),
(2, 6, 38566548064),
(2, 7, 3556726621000),
(2, 8, 723243222205),
(2, 9, 718683238102),
(2, 10, 33752417287),
(2, 11, 187786048359),
(2, 12, 15998000000)
ON CONFLICT DO NOTHING;

-- Tahun 2024
INSERT INTO "Transaksi_APBD" (id_tahun, id_kategori, jumlah) VALUES
(3, 4, 561144584719),
(3, 5, 4373331680381),
(3, 6, 18627613209),
(3, 7, 3861791846694),
(3, 8, 461845276895),
(3, 9, 740286116235),
(3, 10, 19239683577),
(3, 11, 143059045092),
(3, 12, 13000000000)
ON CONFLICT DO NOTHING;

-- 4. Create default admin user (password: admin123)
INSERT INTO "Admin" (username, password_hash, role) VALUES
('admin', '$2b$10$rOzJqQqQqQqQqQqQqQqQqOzJqQqQqQqQqQqQqQqQqOzJqQqQqQqQq', 'admin')
ON CONFLICT (username) DO NOTHING;
