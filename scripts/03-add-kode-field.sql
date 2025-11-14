-- Migration: Add kode field to Kategori_APBD table
-- This script adds the missing kode field that was referenced in the application code

ALTER TABLE Kategori_APBD 
ADD COLUMN IF NOT EXISTS kode VARCHAR(50);

-- Create index for better performance on kode field
CREATE INDEX IF NOT EXISTS idx_kategori_kode ON Kategori_APBD(kode);

-- Add comment for documentation
COMMENT ON COLUMN Kategori_APBD.kode IS 'Optional category code for classification (e.g., 4.1.1)';
