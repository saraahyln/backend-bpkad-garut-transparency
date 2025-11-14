-- ======================
-- Database Schema Creation
-- ======================

-- 1. Tahun Anggaran
CREATE TABLE IF NOT EXISTS Tahun_Anggaran (
    id_tahun SERIAL PRIMARY KEY,
    tahun INT NOT NULL,
    nomor_perda VARCHAR(50),
    tanggal_penetapan DATE
);

-- 2. Kategori APBD (hirarki: kategori → subkategori → sub-subkategori)
CREATE TABLE IF NOT EXISTS Kategori_APBD (
    id_kategori SERIAL PRIMARY KEY,
    id_parent INT NULL,
    jenis VARCHAR(50) CHECK (jenis IN ('Pendapatan','Belanja','Pembiayaan')),
    nama_kategori VARCHAR(255) NOT NULL,
    level INT DEFAULT 1,
    CONSTRAINT fk_parent FOREIGN KEY (id_parent) REFERENCES Kategori_APBD(id_kategori)
);

-- 3. Transaksi APBD (isi angka per tahun per kategori)
CREATE TABLE IF NOT EXISTS Transaksi_APBD (
    id_transaksi SERIAL PRIMARY KEY,
    id_tahun INT NOT NULL,
    id_kategori INT NOT NULL,
    jumlah NUMERIC(20,2) NOT NULL,
    CONSTRAINT fk_tahun FOREIGN KEY (id_tahun) REFERENCES Tahun_Anggaran(id_tahun),
    CONSTRAINT fk_kategori FOREIGN KEY (id_kategori) REFERENCES Kategori_APBD(id_kategori)
);

-- 4. Ringkasan APBD (opsional: agregasi per tahun untuk mempercepat laporan)
CREATE TABLE IF NOT EXISTS Ringkasan_APBD (
    id_ringkasan SERIAL PRIMARY KEY,
    id_tahun INT NOT NULL,
    total_pendapatan NUMERIC(20,2),
    total_belanja NUMERIC(20,2),
    surplus_defisit NUMERIC(20,2),
    pembiayaan_netto NUMERIC(20,2),
    sisa_pembiayaan NUMERIC(20,2),
    CONSTRAINT fk_ringkasan_tahun FOREIGN KEY (id_tahun) REFERENCES Tahun_Anggaran(id_tahun)
);

-- 5. Admin User
CREATE TABLE IF NOT EXISTS Admin (
    id_admin SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(20) DEFAULT 'admin'
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_kategori_parent ON Kategori_APBD(id_parent);
CREATE INDEX IF NOT EXISTS idx_kategori_jenis ON Kategori_APBD(jenis);
CREATE INDEX IF NOT EXISTS idx_transaksi_tahun ON Transaksi_APBD(id_tahun);
CREATE INDEX IF NOT EXISTS idx_transaksi_kategori ON Transaksi_APBD(id_kategori);
CREATE INDEX IF NOT EXISTS idx_ringkasan_tahun ON Ringkasan_APBD(id_tahun);
