/**
 * Balances Module
 *
 * Balances tab (every user): the balance of each account of the household, grouped by
 * owner (the name given to an account in the Accounts tab), then the transactions of
 * one account for the month selected in the header. The balance of a synchronized account is the one its bank gave at the
 * last synchronization; the balance of a manual account is the sum of its transactions.
 *
 * @module balancesModule
 */

/**
 * Accounts grouped by owner, in the order of the names of the owners, the accounts of
 * nobody in a last group; each group has the total of its known balances
 * @param {Array<{owner: (string|null), balance: (number|null)}>} accounts - Accounts (their order is kept)
 * @returns {Array<{owner: (string|null), accounts: Array, total: number}>} The groups
 */
export function balancesByOwner(accounts) {
    const groups = new Map();
    for (const account of accounts || []) {
        const owner = account.owner || null;
        if (!groups.has(owner)) {
            groups.set(owner, { owner, accounts: [], total: 0 });
        }
        const group = groups.get(owner);
        group.accounts.push(account);
        group.total += Number(account.balance) || 0;
    }
    return [...groups.values()].sort((a, b) => {
        if (a.owner === null || b.owner === null) {
            return (a.owner === null) - (b.owner === null);
        }
        return a.owner.localeCompare(b.owner);
    });
}

/** Filter of the accounts of nobody (an owner is never an empty text) */
export const NO_OWNER = '';

/**
 * Creates a balances module mixin for Vue components
 * @param {Function} getApiService - Function that returns the API service instance
 * @returns {Object} Vue mixin with balances data and methods
 */
export function createBalancesModule(getApiService) {
    return {
        data() {
            return {
                // Accounts of the household: [{bankId, label, owner, balance, balance_at, manual...}]
                balanceAccounts: [],
                loadingBalances: false,
                // Owner whose accounts are shown: a name, NO_OWNER, or null for every account
                balanceOwnerFilter: null,
                // Account whose transactions are shown (null: the list of the accounts)
                balanceAccount: null,
                balanceTransactions: [],
                loadingBalanceTransactions: false,
                // Number of the last request of transactions: a late answer is ignored
                balanceRequest: 0
            };
        },

        computed: {
            /**
             * Owners offered by the filter, in the order of the groups (nobody last)
             * @returns {Array<{key: string, owner: (string|null)}>}
             */
            balanceOwners() {
                return balancesByOwner(this.balanceAccounts).map(group => ({ key: group.owner || NO_OWNER, owner: group.owner }));
            },

            /**
             * Accounts of the owner of the filter (every account without filter, or when
             * this owner has no account any more)
             * @returns {Array<Object>}
             */
            visibleBalanceAccounts() {
                const filter = this.balanceOwnerFilter;
                if (filter === null || !this.balanceOwners.some(o => o.key === filter)) {
                    return this.balanceAccounts;
                }
                return this.balanceAccounts.filter(a => (a.owner || NO_OWNER) === filter);
            },

            /**
             * Accounts shown, under their owner
             * @returns {Array<{owner: (string|null), accounts: Array, total: number}>}
             */
            balanceGroups() {
                return balancesByOwner(this.visibleBalanceAccounts);
            },

            /**
             * Sum of the known balances of the accounts shown
             * @returns {number}
             */
            balancesTotal() {
                return this.visibleBalanceAccounts.reduce((sum, a) => sum + (Number(a.balance) || 0), 0);
            }
        },

        methods: {
            /**
             * Loads the accounts and their balance; the account shown is refreshed too
             * @returns {Promise<void>}
             */
            async loadBalances() {
                this.loadingBalances = true;
                try {
                    this.balanceAccounts = await getApiService().fetchAccounts();
                    if (this.balanceAccount) {
                        const account = this.balanceAccounts.find(a => a.bankId === this.balanceAccount.bankId);
                        if (account) {
                            await this.openBalanceAccount(account, false);
                        } else {
                            this.closeBalanceAccount();
                        }
                    }
                } catch (error) {
                    this.showToast(this.apiErrorText(error));
                } finally {
                    this.loadingBalances = false;
                }
            },

            /**
             * Shows the transactions of an account for the selected month, most recent first
             * @param {Object} account - Account of balanceAccounts
             * @param {boolean} focus - Move the focus to the title (opened by the user)
             * @returns {Promise<void>}
             */
            async openBalanceAccount(account, focus = true) {
                const request = ++this.balanceRequest;
                const same = this.balanceAccount && this.balanceAccount.bankId === account.bankId;
                this.balanceAccount = account;
                if (!same) {
                    this.balanceTransactions = [];
                    this.loadingBalanceTransactions = true;
                }
                if (focus) {
                    this.$nextTick?.(() => document.querySelector('.balance-detail-title')?.focus());
                }
                try {
                    const transactions = await getApiService().fetchAccountTransactions(account.bankId, this.selectedMonth, this.selectedYear);
                    if (request === this.balanceRequest) {
                        this.balanceTransactions = transactions;
                        // Icons of the rows: the categories of the transactions
                        this.ensureCategories();
                    }
                } catch (error) {
                    this.showToast(this.apiErrorText(error));
                } finally {
                    if (request === this.balanceRequest) {
                        this.loadingBalanceTransactions = false;
                    }
                }
            },

            /**
             * Back to the list of the accounts
             */
            closeBalanceAccount() {
                this.balanceRequest++;
                this.balanceAccount = null;
                this.balanceTransactions = [];
                this.loadingBalanceTransactions = false;
            },

            /**
             * Name of an account: the one given to it, else "BNP ···0001"
             * @param {Object} account - Account
             * @returns {string}
             */
            balanceAccountName(account) {
                return account.label || this.accountName(account);
            },

            /**
             * Where an account is held: "BNP ···0001", or a manual account
             * @param {Object} account - Account
             * @returns {string}
             */
            balanceAccountBank(account) {
                if (account.manual) {
                    return this.t('balanceManualAccount');
                }
                return `${String(account.bank_name).toUpperCase()} ···${String(account.account_number).slice(-4)}`;
            },

            /**
             * What the balance of an account is: its date, the sum of the transactions of a
             * manual account, or not known before the next synchronization
             * @param {Object} account - Account
             * @returns {string}
             */
            balanceDateText(account) {
                if (account.manual) {
                    return this.t('balanceManual');
                }
                if (account.balance === null || !account.balance_at) {
                    return this.t('balanceUnknown');
                }
                return this.t('balanceAt', { date: this.formatSyncDate(account.balance_at) });
            }
        }
    };
}
