// Balances tab: accounts grouped by owner, transactions of one account (portal/modules/balancesModule.js)
import { mockFetch, json } from './setup.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { balancesByOwner, createBalancesModule, NO_OWNER } from '../../portal/modules/balancesModule.js';
import { createApiService } from '../../portal/services/apiService.js';

const ACCOUNTS = [
    { bankId: '1@bnp', account_number: '1', bank_name: 'bnp', label: 'Compte joint', owner: null, balance: 100, balance_at: '2026-11-10 07:00:00', manual: false },
    { bankId: '2@bnp', account_number: '00002222', bank_name: 'bnp', label: null, owner: 'Paul', balance: -20.5, balance_at: '2026-11-10 07:00:00', manual: false },
    { bankId: '3@bnp', account_number: '3', bank_name: 'bnp', label: 'Livret', owner: 'Marie', balance: null, balance_at: null, manual: false },
    { bankId: 'M1@manual', account_number: 'M1', bank_name: 'manual', label: 'Espèces', owner: 'Marie', balance: 40, balance_at: null, manual: true },
];

/** A balances module bound to a fake component */
function balancesContext(api) {
    const module = createBalancesModule(() => api);
    const context = {
        ...module.data(), toasts: [], categoriesAsked: 0, selectedMonth: 11, selectedYear: 2026,
        t: (key, params = {}) => `${key}${params.date ? ':' + params.date : ''}`,
        accountName: a => `${a.bank_name.toUpperCase()} ···${a.account_number.slice(-4)}`,
        formatSyncDate: value => value.slice(0, 10),
        apiErrorText: error => error.message,
        showToast(message) { this.toasts.push(message); },
        ensureCategories() { this.categoriesAsked++; },
    };
    for (const [name, method] of Object.entries(module.methods)) {
        context[name] = method.bind(context);
    }
    return context;
}

test('balancesByOwner: owners by name, the accounts of nobody last, totals of the known balances', () => {
    const groups = balancesByOwner(ACCOUNTS);
    assert.deepEqual(groups.map(g => [g.owner, g.accounts.map(a => a.bankId), g.total]), [
        ['Marie', ['3@bnp', 'M1@manual'], 40],
        ['Paul', ['2@bnp'], -20.5],
        [null, ['1@bnp'], 100],
    ]);
    assert.deepEqual(balancesByOwner(null), []);
});

/** Computed values of the module for a filter (each one given those it reads) */
function filtered(balanceOwnerFilter) {
    const { computed } = createBalancesModule(() => null);
    const state = { balanceAccounts: ACCOUNTS, balanceOwnerFilter };
    state.balanceOwners = computed.balanceOwners.call(state);
    state.visibleBalanceAccounts = computed.visibleBalanceAccounts.call(state);
    return { ...state, groups: computed.balanceGroups.call(state), total: computed.balancesTotal.call(state) };
}

test('the total of the household ignores the unknown balances', () => {
    const all = filtered(null);
    assert.equal(all.total, 119.5);
    assert.deepEqual(all.balanceOwners, [{ key: 'Marie', owner: 'Marie' }, { key: 'Paul', owner: 'Paul' }, { key: NO_OWNER, owner: null }]);
});

test('the filter keeps the accounts of one owner, the total follows', () => {
    const marie = filtered('Marie');
    assert.deepEqual(marie.visibleBalanceAccounts.map(a => a.bankId), ['3@bnp', 'M1@manual']);
    assert.deepEqual(marie.groups.map(g => g.owner), ['Marie']);
    assert.equal(marie.total, 40);

    const nobody = filtered(NO_OWNER);
    assert.deepEqual(nobody.visibleBalanceAccounts.map(a => a.bankId), ['1@bnp']);
    assert.equal(nobody.total, 100);

    // An owner who has no account any more: every account
    assert.equal(filtered('Jean').visibleBalanceAccounts.length, 4);
});

test('texts of an account: its name, its bank, what its balance is', () => {
    const context = balancesContext(null);
    assert.equal(context.balanceAccountName(ACCOUNTS[0]), 'Compte joint');
    assert.equal(context.balanceAccountName(ACCOUNTS[1]), 'BNP ···2222');
    assert.equal(context.balanceAccountBank(ACCOUNTS[1]), 'BNP ···2222');
    assert.equal(context.balanceAccountBank(ACCOUNTS[3]), 'balanceManualAccount');
    assert.equal(context.balanceDateText(ACCOUNTS[0]), 'balanceAt:2026-11-10');
    assert.equal(context.balanceDateText(ACCOUNTS[2]), 'balanceUnknown');
    assert.equal(context.balanceDateText(ACCOUNTS[3]), 'balanceManual');
});

test('an account opened: its transactions of the selected month, then back to the list', async () => {
    const base = 'https://carbure.example.com/api';
    const calls = mockFetch(url => json(url.includes('/balance/transactions') ? [{ id: 7, label: 'CB', amount: -5 }] : ACCOUNTS));
    const context = balancesContext(createApiService(base, 't'));

    await context.loadBalances();
    assert.equal(context.balanceAccounts.length, 4);
    assert.equal(context.loadingBalances, false);

    await context.openBalanceAccount(context.balanceAccounts[1]);
    assert.equal(calls.at(-1).url, `${base}/balance/transactions?account=2%40bnp&month=11&year=2026`);
    assert.deepEqual(context.balanceTransactions, [{ id: 7, label: 'CB', amount: -5 }]);
    assert.equal(context.loadingBalanceTransactions, false);
    assert.equal(context.categoriesAsked, 1);

    // The accounts reloaded (a synchronization, another month chosen in the header): the
    // open account stays open, its transactions asked for the selected month
    context.selectedMonth = 10;
    await context.loadBalances();
    assert.equal(context.balanceAccount.bankId, '2@bnp');
    assert.equal(calls.at(-1).url, `${base}/balance/transactions?account=2%40bnp&month=10&year=2026`);
    assert.equal(context.balanceTransactions.length, 1);

    context.closeBalanceAccount();
    assert.equal(context.balanceAccount, null);
    assert.deepEqual(context.balanceTransactions, []);
});
