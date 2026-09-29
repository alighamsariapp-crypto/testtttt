-- NoovinNet Google OAuth migration for an EXISTING MariaDB/MySQL database.
-- Run this file once in phpMyAdmin after taking a database backup.
-- It creates only the new OAuth identity-link table; it does not alter or delete existing QA or production data.

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `oauth_accounts` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned NOT NULL,
  `provider` varchar(32) NOT NULL,
  `provider_user_id` varchar(255) NOT NULL,
  `provider_email` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `oauth_accounts_provider_provider_user_id_unique` (`provider`,`provider_user_id`),
  UNIQUE KEY `oauth_accounts_user_id_provider_unique` (`user_id`,`provider`),
  KEY `oauth_accounts_user_id_foreign` (`user_id`),
  CONSTRAINT `oauth_accounts_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
