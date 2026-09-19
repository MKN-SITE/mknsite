-- Migrasi 0007: Normalisasi URL Menu dan Penerapan Unique Constraint pada menus.url
-- Logika:
-- 1. Bersihkan nilai string kosong/hanya spasi pada URL menjadi NULL.
-- 2. Normalisasi URL non-null: pastikan diawali slash jika rute internal dan hapus trailing slash (kecuali root '/').
-- 3. Hapus baris duplikat URL non-null secara deterministik:
--    Prioritas row canonical yang dipertahankan:
--    - is_active lebih tinggi (aktif = 1 vs nonaktif = 0)
--    - updated_at lebih baru
--    - id lebih kecil sebagai tie-breaker
-- 4. Terapkan unique constraint menus_url_unique pada kolom url (NULL diizinkan jamak oleh MySQL).

-- Step 1: Ubah URL kosong atau hanya spasi menjadi NULL
UPDATE `menus`
SET `url` = NULL
WHERE `url` IS NOT NULL AND TRIM(`url`) = '';
--> statement-breakpoint

-- Step 2: Pastikan URL internal memiliki leading slash
UPDATE `menus`
SET `url` = CONCAT('/', TRIM(`url`))
WHERE `url` IS NOT NULL
  AND `url` NOT LIKE 'http://%'
  AND `url` NOT LIKE 'https://%'
  AND `url` NOT LIKE '/%';
--> statement-breakpoint

-- Step 3: Hapus trailing slash pada URL non-null (kecuali root '/')
UPDATE `menus`
SET `url` = NULLIF(TRIM(TRAILING '/' FROM `url`), '')
WHERE `url` IS NOT NULL
  AND `url` <> '/'
  AND `url` LIKE '%/';
--> statement-breakpoint

-- Step 4: Hapus baris duplikat URL canonical secara deterministik
-- Prioritas record yang dipertahankan (rn = 1):
-- 1. is_active lebih tinggi (aktif = 1 vs nonaktif = 0)
-- 2. updated_at lebih baru
-- 3. id lebih kecil sebagai tie-breaker
DELETE FROM `menus`
WHERE `url` IS NOT NULL
  AND `id` NOT IN (
    SELECT canonical_id FROM (
      SELECT id AS canonical_id,
             ROW_NUMBER() OVER (
               PARTITION BY url
               ORDER BY is_active DESC, updated_at DESC, id ASC
             ) AS rn
      FROM `menus`
      WHERE `url` IS NOT NULL
    ) ranked
    WHERE rn = 1
  );
--> statement-breakpoint

-- Step 5: Tambahkan unique constraint/index pada kolom menus.url
ALTER TABLE `menus` ADD CONSTRAINT `menus_url_unique` UNIQUE(`url`);
