<?php

use Carbure\Resources\Balance;
use Carbure\Resources\Bank;
use Carbure\Resources\Transaction;

class BalanceTest extends DatabaseTestCase
{
    public function testTransactionsOfAnAccountForAMonth()
    {
        $this->loginAs(self::ADMIN);
        $cash = Bank::createManual('Espèces');
        $other = Bank::createManual('Tirelire');
        Transaction::createManual($cash['id'], '2026-03-05', 'Boulangerie', -4.5);
        Transaction::createManual($cash['id'], '2026-03-20', 'Retrait', 60);
        Transaction::createManual($cash['id'], '2026-04-01', 'Marché', -12);
        Transaction::createManual($other['id'], '2026-03-10', 'Anniversaire', 20);

        // Only this account, only this month, most recent first; every user reads them
        $this->loginAs(self::USER);
        $march = Balance::transactions($cash['bankId'], 3, 2026);
        $this->assertSame(['RETRAIT', 'BOULANGERIE'], array_map('strtoupper', array_column($march, 'label')));
        $this->assertSame(['2026-03-20', '2026-03-05'], array_column($march, 'date'));
        $this->assertCount(1, Balance::transactions($cash['bankId'], '4', '2026'));
        $this->assertSame([], Balance::transactions($cash['bankId'], 5, 2026));
        $this->assertSame([], Balance::transactions('unknown@bnp', 3, 2026));
    }

    public function testTheAccountMustBeABankId()
    {
        $this->loginAs(self::USER);
        foreach (['111', '@bnp', '111@'] as $account) {
            try {
                Balance::transactions($account, 3, 2026);
                $this->fail("$account accepted");
            } catch (Error $e) {
                $this->assertSame(400, $e->getCode());
            }
        }
    }
}
