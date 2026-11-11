-- Owner of a followed account (free text: a member of the household, "Joint"...), to tell
-- the accounts of each one apart, and the balance of the account as the bank gave it at
-- the last synchronization. NULL for the accounts followed before: no owner, and a
-- balance known after their next synchronization (a manual account has no stored
-- balance: it is the sum of its transactions).
-- applied-if: SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bank_account' AND COLUMN_NAME = 'owner'

ALTER TABLE `bank_account`
  ADD COLUMN `owner` varchar(100) DEFAULT NULL COMMENT 'Who the account belongs to (free text, NULL: not set)' AFTER `label`,
  ADD COLUMN `balance` decimal(12,2) DEFAULT NULL COMMENT 'Balance given by the bank at the last synchronization (NULL: unknown)' AFTER `owner`,
  ADD COLUMN `balance_at` datetime DEFAULT NULL COMMENT 'Date of this balance' AFTER `balance`;
