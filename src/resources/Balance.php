<?php

/**
 * Balance.php
 *
 * Balances tab of the portal: the transactions of one account of the household, month
 * by month. The accounts and their balance are listed by GET /bank.
 */

namespace Carbure\Resources;

use Carbure\Lib\ApiRoute;
use Carbure\Lib\Db;
use Carbure\Lib\Month;
use Error;

final class Balance {

    /**
     * Transactions of one account for a month, most recent first (every user: the
     * accounts are those of the household).
     *
     * @param string          $account The account, as the bankId of GET /bank (account_number@bank_name)
     * @param int|string|null $month   The month (current month by default)
     * @param int|string|null $year    The year (current year by default)
     * @return list<array<string, mixed>> The transactions
     * @throws Error If the account is not an account_number@bank_name (400)
     */
    #[ApiRoute('/balance/transactions', method: 'GET')]
    public static function transactions(string $account, int|string|null $month = null, int|string|null $year = null): array
    {
        $at = strrpos($account, '@');
        if ($at === false || $at === 0 || $at === strlen($account) - 1) {
            throw new Error("Invalid account: account_number@bank_name", 400);
        }
        [$from, $to] = Month::range($month, $year);

        $sql = "SELECT * FROM bank_transaction WHERE account_number = ? AND bank_name = ? AND date >= ? AND date < ?
                ORDER BY date DESC, rdate DESC, id DESC";
        return Db::select($sql, "ssss", substr($account, 0, $at), substr($account, $at + 1), $from, $to)->fetch_all(MYSQLI_ASSOC);
    }
}
