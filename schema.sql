-- ============================================
-- ScanChecker - Postgres schema (Neon / Vercel)
-- Jalankan ini di Neon SQL editor (console.neon.tech)
-- ============================================

-- Tabel: users
CREATE TABLE IF NOT EXISTS users (
  id          SERIAL PRIMARY KEY,
  username    VARCHAR(50) NOT NULL UNIQUE,
  password    VARCHAR(255) NOT NULL,
  nama        VARCHAR(100) NOT NULL,
  role        VARCHAR(20) NOT NULL DEFAULT 'operator',
  toko        VARCHAR(100) DEFAULT 'Toko Utama',
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  last_login  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabel: scans
CREATE TABLE IF NOT EXISTS scans (
  id             SERIAL PRIMARY KEY,
  no_resi        VARCHAR(100) NOT NULL,
  ekspedisi      VARCHAR(50) NOT NULL DEFAULT 'Lainnya',
  ekspedisi_kode VARCHAR(20) NOT NULL DEFAULT 'OTHER',
  jenis          VARCHAR(10) NOT NULL DEFAULT 'barang',
  user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  username       VARCHAR(50) NOT NULL,
  toko           VARCHAR(100) DEFAULT 'Toko Utama',
  scan_date      DATE NOT NULL,
  scan_time      TIME NOT NULL,
  catatan        TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_scans_no_resi     ON scans (no_resi);
CREATE INDEX IF NOT EXISTS idx_scans_scan_date   ON scans (scan_date);
CREATE INDEX IF NOT EXISTS idx_scans_ekspedisi   ON scans (ekspedisi_kode);
CREATE INDEX IF NOT EXISTS idx_scans_user_id     ON scans (user_id);
CREATE INDEX IF NOT EXISTS idx_scans_jenis       ON scans (jenis);

-- Tabel: settings
CREATE TABLE IF NOT EXISTS settings (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  setting_key   VARCHAR(50) NOT NULL,
  setting_value TEXT,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, setting_key)
);

-- Tabel: feedback
CREATE TABLE IF NOT EXISTS feedback (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  judul      VARCHAR(200) NOT NULL,
  pesan      TEXT NOT NULL,
  status     VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabel: sessions (sesi login via cookie httpOnly)
CREATE TABLE IF NOT EXISTS sessions (
  token      VARCHAR(64) PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions (user_id);

-- ============================================
-- Data default
-- Password yang dipakai di bawah adalah hash bcrypt dari "password"
-- ============================================
INSERT INTO users (username, password, nama, role, toko) VALUES
('admin',      '$2y$10$T4cC0tWtGJJtIh8a.7fLq.1lWETg4DjUbw2NION2PbvfkM3BUSs1i', 'Administrator', 'admin',    'Toko Utama'),
('operator1',  '$2y$10$T4cC0tWtGJJtIh8a.7fLq.1lWETg4DjUbw2NION2PbvfkM3BUSs1i', 'Operator Satu', 'operator', 'Toko Utama'),
('rank.glc',   '$2y$10$T4cC0tWtGJJtIh8a.7fLq.1lWETg4DjUbw2NION2PbvfkM3BUSs1i', 'RANK GLC',      'operator', 'RANK GLC'),
('rank.kld',   '$2y$10$T4cC0tWtGJJtIh8a.7fLq.1lWETg4DjUbw2NION2PbvfkM3BUSs1i', 'RANK KALIDERES','operator', 'RANK KALIDERES')
ON CONFLICT (username) DO NOTHING;

-- Notes:
-- 1) Hash di baris data default hanyalah PLAIN PLACEHOLDER dan TIDAK cocok dengan
--    password "password" apa pun yang asli. Hash PHP "$2y$" yang asli tetap diverifikasi
--    oleh Node karena _auth.js menormalkan "$2y$" -> "$2a$" (bcryptjs).
-- 2) Setelah skema dibuat, WAJIB jalankan seed bcryptjs untuk mengganti password user
--    default agar bisa login:
--        node scripts/seed-users.js admin "passwordAnda"
--        node scripts/seed-users.js operator1 "passwordAnda"
--    (atau update user riil milik Anda). Lihat INSTALL.md.
