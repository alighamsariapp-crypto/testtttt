-- =============================================================================
-- NOOVINNET / APEXSTORE — FULL DATABASE DUMP (MySQL 5.7+ / 8.0+ / MariaDB 10.3+)
-- Ready to import directly into phpMyAdmin on DirectAdmin or cPanel
-- =============================================================================

SET FOREIGN_KEY_CHECKS=0;
SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";

-- -----------------------------------------------------------------------------
-- Table: users
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `users` (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL UNIQUE,
  `phone` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `role` enum('super_admin','admin','staff','customer') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'customer',
  `status` enum('active','suspended','pending') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `email_verified_at` timestamp NULL DEFAULT NULL,
  `password` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `remember_token` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- No default users or credentials are included in this schema export.
-- Create the first administrator through the documented deployment flow; never import sample accounts into production.

-- -----------------------------------------------------------------------------
-- Table: categories
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `categories` (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `slug` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL UNIQUE,
  `description` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `icon` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Default Categories
INSERT INTO `categories` (`id`, `name`, `slug`, `description`, `icon`, `is_active`) VALUES
(1, 'مودم و اینترنت', 'modem-internet', 'انواع مودم‌های 5G، 4G و رومیزی', 'Wifi', 1),
(2, 'سیمکارت', 'simcard', 'سیم‌کارت‌های دائمی و اعتباری پرسرعت', 'SimCard', 1),
(3, 'لوازم جانبی', 'accessories', 'تجهیزات و اکسسوری‌های شبکه و کامپیوتر', 'Headphones', 1),
(4, 'تجهیزات شبکه', 'networking-equipment', 'روتر، سوئیچ، کابل شبکه و رک‌های مخابراتی', 'Server', 1);

-- -----------------------------------------------------------------------------
-- Table: products
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `products` (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `category_id` bigint(20) UNSIGNED NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `slug` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL UNIQUE,
  `short_description` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `description` longtext COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sku` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL UNIQUE,
  `base_price` decimal(15,2) NOT NULL,
  `sale_price` decimal(15,2) DEFAULT NULL,
  `currency` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'تومان',
  `image_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `rating` decimal(3,2) NOT NULL DEFAULT 4.80,
  `review_count` int(11) NOT NULL DEFAULT 0,
  `is_featured` tinyint(1) NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Default Products
INSERT INTO `products` (`id`, `category_id`, `name`, `slug`, `short_description`, `sku`, `base_price`, `sale_price`, `image_url`, `is_featured`, `is_active`) VALUES
(1, 1, 'مودم روتر 5G هوآوی مدل H112-372', 'huawei-5g-cpe-pro-h112-372', 'مودم دو بانده پرسرعت نسل پنجم با پشتیبانی از Wi-Fi 6', 'HW-5G-H112', 8500000.00, 8500000.00, 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=600&q=80', 1, 1),
(2, 1, 'مودم 4G قابل حمل تی پی-لینک مدل M7200', 'tp-link-m7200-portable-4g-modem', 'مودم همراه جیبی پرتابل با باتری ۲۰۰۰ میلی‌آمپر ساعتی', 'TPL-M7200', 2100000.00, 1950000.00, 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600&q=80', 1, 1),
(3, 4, 'روتر بی‌سیم ایسوس مدل RT-AX82U', 'asus-rt-ax82u-gaming-router', 'روتر گیمینگ دو بانده فوق‌العاده سریع با استاندارد Wi-Fi 6', 'ASUS-RT-AX82U', 9800000.00, 9800000.00, 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=600&q=80', 0, 1),
(4, 2, 'سیم‌کارت دائمی 4G/LTE به همراه بسته اولیه', 'permanent-4g-lte-simcard-starter-pack', 'سیم‌کارت دائمی با شماره رند به همراه بسته خوش‌آمدگویی', 'SIM-IRN-PERM', 150000.00, 127500.00, 'https://images.unsplash.com/photo-1596524430615-b46475ddff6e?w=600&q=80', 1, 1),
(5, 1, 'مودم رومیزی 5G مبین‌نت مدل M53', 'mobinnet-5g-desktop-modem-m53', 'مودم رومیزی اختصاصی با پشتیبانی از شبکه TD-LTE و 5G', 'MBN-5G-M53', 5400000.00, 5400000.00, 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=600&q=80', 1, 1),
(6, 4, 'سوئیچ ۸ پورت سیسکو Business 110', 'cisco-business-110-8-port-switch', 'سوئیچ مدیریتی غیرماژولار گیگابیتی بدون فن', 'CS-CBS110-8T', 2100000.00, 2100000.00, 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=600&q=80', 1, 1),
(7, 3, 'هدفون بی‌سیم سونی مدل WH-1000XM5', 'sony-wh-1000xm5-wireless-headphones', 'پرچمدار هدفون‌های نویزکنسلینگ سونی با پردازنده V1', 'SNY-WH-1000XM5', 14500000.00, 14500000.00, 'https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=600&q=80', 1, 1);

-- -----------------------------------------------------------------------------
-- Table: settings
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `settings` (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `key` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL UNIQUE,
  `value` longtext COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `settings` (`key`, `value`) VALUES
('site_name', 'نوین‌نت'),
('site_tagline', 'مرکز تخصصی تجهیزات شبکه و خدمات فناوری'),
('primary_color', '#1D4ED8'),
('contact_phone', '۰۲۱-۸۸۸۸۹۹۹۹'),
('contact_email', 'support@noovinnet.ir');

SET FOREIGN_KEY_CHECKS=1;
COMMIT;
