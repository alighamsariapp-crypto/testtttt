-- Run ONCE in phpMyAdmin after taking a database backup.
-- Required by commit f3d4c1d for managed online-service content pages.
ALTER TABLE `service_catalogs`
  ADD COLUMN `documents` JSON NULL AFTER `description`,
  ADD COLUMN `steps` JSON NULL AFTER `documents`,
  ADD COLUMN `faq` JSON NULL AFTER `steps`,
  ADD COLUMN `contact_type` VARCHAR(32) NULL AFTER `required_fields`,
  ADD COLUMN `contact_url` VARCHAR(2048) NULL AFTER `contact_type`,
  ADD COLUMN `cta_label` VARCHAR(120) NULL AFTER `contact_url`;
