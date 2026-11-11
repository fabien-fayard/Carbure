-- Whether a followed account is shown in the Balances tab (a loan is hidden so that it does
-- not change the total), and the type of the account as the bank gives it at each
-- synchronization (woob: 1 = checking account), to list the checking accounts first.
-- The accounts followed before stay shown; their type is known after their next synchronization.
-- applied-if: SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bank_account' AND COLUMN_NAME = 'in_balances'

ALTER TABLE `bank_account`
  ADD COLUMN `in_balances` tinyint(1) NOT NULL DEFAULT 1 COMMENT 'Shown in the Balances tab' AFTER `balance_at`,
  ADD COLUMN `account_type` smallint DEFAULT NULL COMMENT 'Type given by the bank at the last synchronization (woob: 1 = checking, NULL: unknown)' AFTER `in_balances`;
