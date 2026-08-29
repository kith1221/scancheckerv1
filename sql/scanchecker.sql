-- ============================================
-- ScanChecker Database Schema
-- ============================================

CREATE DATABASE IF NOT EXISTS `scanchecker` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `scanchecker`;

-- -----------------------------------------------
-- Tabel: users
-- -----------------------------------------------
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `username` VARCHAR(50) NOT NULL UNIQUE,
  `password` VARCHAR(255) NOT NULL,
  `nama` VARCHAR(100) NOT NULL,
  `role` ENUM('admin','operator') NOT NULL DEFAULT 'operator',
  `toko` VARCHAR(100) DEFAULT 'Toko Utama',
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  `last_login` TIMESTAMP NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -----------------------------------------------
-- Tabel: scans
-- -----------------------------------------------
CREATE TABLE IF NOT EXISTS `scans` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `no_resi` VARCHAR(100) NOT NULL,
  `ekspedisi` VARCHAR(50) NOT NULL DEFAULT 'Lainnya',
  `ekspedisi_kode` VARCHAR(20) NOT NULL DEFAULT 'OTHER',
  `jenis` ENUM('barang','retur') NOT NULL DEFAULT 'barang',
  `user_id` INT NOT NULL,
  `username` VARCHAR(50) NOT NULL,
  `toko` VARCHAR(100) DEFAULT 'Toko Utama',
  `scan_date` DATE NOT NULL,
  `scan_time` TIME NOT NULL,
  `catatan` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  INDEX `idx_no_resi` (`no_resi`),
  INDEX `idx_scan_date` (`scan_date`),
  INDEX `idx_ekspedisi` (`ekspedisi_kode`),
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_jenis` (`jenis`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -----------------------------------------------
-- Tabel: settings
-- -----------------------------------------------
CREATE TABLE IF NOT EXISTS `settings` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `setting_key` VARCHAR(50) NOT NULL,
  `setting_value` TEXT DEFAULT NULL,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `user_setting` (`user_id`, `setting_key`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -----------------------------------------------
-- Tabel: feedback
-- -----------------------------------------------
CREATE TABLE IF NOT EXISTS `feedback` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `judul` VARCHAR(200) NOT NULL,
  `pesan` TEXT NOT NULL,
  `status` ENUM('pending','dibaca','ditanggapi') DEFAULT 'pending',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -----------------------------------------------
-- Data default: Admin
-- Password: password
-- -----------------------------------------------
INSERT INTO `users` (`username`, `password`, `nama`, `role`, `toko`) VALUES
('admin', '$2y$10$T4cC0tWtGJJtIh8a.7fLq.1lWETg4DjUbw2NION2PbvfkM3BUSs1i', 'Administrator', 'admin', 'Toko Utama'),
('operator1', '$2y$10$T4cC0tWtGJJtIh8a.7fLq.1lWETg4DjUbw2NION2PbvfkM3BUSs1i', 'Operator Satu', 'operator', 'Toko Utama');

-- -----------------------------------------------
-- Settings default untuk admin
-- -----------------------------------------------
INSERT INTO `settings` (`user_id`, `setting_key`, `setting_value`) VALUES
(1, 'dark_mode', '1'),
(1, 'nama_toko', 'Toko Utama'),
(1, 'ekspedisi_aktif', '["JNT","JNTC","JNE","SICEPAT","POS","NINJA","ANTERAJA","SPX","LAZADA"]'),
(1, 'notif_duplikat', '1'),
(2, 'dark_mode', '1'),
(2, 'nama_toko', 'Toko Utama'),
(2, 'ekspedisi_aktif', '["JNT","JNTC","JNE","SICEPAT","POS","NINJA","ANTERAJA","SPX","LAZADA"]'),
(2, 'notif_duplikat', '1');
