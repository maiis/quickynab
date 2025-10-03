import * as ynab from 'ynab';
import crypto from 'crypto';
import type { Config } from './config.js';

export interface Transaction {
  date: string;
  payee_name: string | null;
  category_name?: string | null;
  memo: string | null;
  amount: number;
}

interface UploadResult {
  success: boolean;
  imported: number;
  duplicates: number;
  transactions: ynab.TransactionDetail[];
}

/**
 * Uploads transactions to YNAB via the API
 */
export async function uploadTransactions(
  transactions: Transaction[],
  config: Config,
  accountIdOverride: string | null = null,
  budgetIdOverride: string | null = null
): Promise<UploadResult> {
  const ynabAPI = new ynab.API(config.accessToken);

  // Get budget ID (use override if provided, otherwise from config)
  const budgetId = budgetIdOverride || await getBudgetId(ynabAPI, config);

  // Get account ID (use override if provided, otherwise from config)
  const accountId = accountIdOverride || await getAccountId(ynabAPI, budgetId, config);

  // Convert transactions to YNAB format
  const ynabTransactions = transactions.map(tx => {
    // Generate unique import_id to prevent duplicates
    const importId = generateImportId(tx, accountId);

    return {
      account_id: accountId,
      date: tx.date,
      amount: convertToMilliunits(tx.amount),
      payee_name: tx.payee_name || undefined,
      memo: tx.memo || undefined,
      cleared: 'uncleared' as const,
      approved: false,
      import_id: importId,
    };
  });

  // Upload transactions
  try {
    const response = await ynabAPI.transactions.createTransactions(budgetId, {
      transactions: ynabTransactions,
    });

    return {
      success: true,
      imported: response.data.transaction_ids.length,
      duplicates: response.data.duplicate_import_ids?.length || 0,
      transactions: response.data.transactions || [],
    };
  } catch (error: any) {
    if (error.error && error.error.detail) {
      throw new Error(`YNAB API Error: ${error.error.detail}`);
    }
    throw error;
  }
}

/**
 * Converts dollar amount to milliunits (YNAB's format)
 */
function convertToMilliunits(amount: number): number {
  return Math.round(amount * 1000);
}

/**
 * Generates a unique import_id for duplicate detection
 * Max length: 36 characters
 */
function generateImportId(transaction: Transaction, accountId: string): string {
  const str = `${accountId}:${transaction.date}:${transaction.amount}:${transaction.payee_name || ''}`;
  const hash = crypto.createHash('md5').update(str).digest('hex');
  // Return first 32 chars of hash (36 char limit, just use hash)
  return hash.substring(0, 32);
}

/**
 * Gets budget ID (from config or prompts user)
 */
async function getBudgetId(ynabAPI: ynab.API, config: Config): Promise<string> {
  if (config.budgetId) {
    return config.budgetId;
  }

  const budgetsResponse = await ynabAPI.budgets.getBudgets();
  const budgets = budgetsResponse.data.budgets;

  if (budgets.length === 0) {
    throw new Error('No budgets found in your YNAB account');
  }

  // Use first budget if only one exists
  if (budgets.length === 1) {
    console.log(`Using budget: ${budgets[0].name}`);
    return budgets[0].id;
  }

  throw new Error(
    'Multiple budgets found. Please set YNAB_BUDGET_ID in your .env file.\n' +
    'Available budgets:\n' +
    budgets.map(b => `  - ${b.name} (${b.id})`).join('\n')
  );
}

/**
 * Gets account ID (from config or prompts user)
 */
async function getAccountId(ynabAPI: ynab.API, budgetId: string, config: Config): Promise<string> {
  if (config.accountId) {
    return config.accountId;
  }

  const accountsResponse = await ynabAPI.accounts.getAccounts(budgetId);
  const accounts = accountsResponse.data.accounts.filter(a => !a.closed);

  if (accounts.length === 0) {
    throw new Error('No open accounts found in your budget');
  }

  // Use first account if only one exists
  if (accounts.length === 1) {
    console.log(`Using account: ${accounts[0].name}`);
    return accounts[0].id;
  }

  throw new Error(
    'Multiple accounts found. Please set YNAB_ACCOUNT_ID in your .env file.\n' +
    'Available accounts:\n' +
    accounts.map(a => `  - ${a.name} (${a.id})`).join('\n')
  );
}

/**
 * Lists all budgets
 */
export async function listBudgets(accessToken: string): Promise<ynab.BudgetSummary[]> {
  const ynabAPI = new ynab.API(accessToken);
  const response = await ynabAPI.budgets.getBudgets();
  return response.data.budgets;
}

/**
 * Lists all accounts in a budget
 */
export async function listAccounts(accessToken: string, budgetId: string): Promise<ynab.Account[]> {
  const ynabAPI = new ynab.API(accessToken);
  const response = await ynabAPI.accounts.getAccounts(budgetId);
  return response.data.accounts.filter(a => !a.closed);
}
