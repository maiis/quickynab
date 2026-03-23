import crypto from 'node:crypto';
import * as ynab from 'ynab';
import type { Config } from './config.js';
import { YnabApiError } from './errors.js';
import { getLogger } from './logger.js';
import type { Transaction } from './types.js';

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

  // Get plan ID (use override if provided, otherwise from config)
  const planId = budgetIdOverride || (await getPlanId(ynabAPI, config));

  // Get account ID (use override if provided, otherwise from config)
  const accountId = accountIdOverride || (await getAccountId(ynabAPI, planId, config));

  // Convert transactions to YNAB format
  const ynabTransactions = transactions.map((tx) => {
    // Generate unique import_id to prevent duplicates
    const importId = generateImportId(tx);

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
    const response = await ynabAPI.transactions.createTransactions(planId, {
      transactions: ynabTransactions,
    });

    return {
      success: true,
      imported: response.data.transaction_ids.length,
      duplicates: response.data.duplicate_import_ids?.length || 0,
      transactions: response.data.transactions || [],
    };
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'error' in error &&
      typeof (error as { error?: { detail?: string } }).error === 'object' &&
      (error as { error?: { detail?: string } }).error !== null
    ) {
      const apiError = error as { error: { detail?: string } };
      throw new YnabApiError(apiError.error.detail || 'Unknown YNAB API error');
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
 * Format: YNAB:[milliunit_amount]:[iso_date]:[occurrence]
 * Max length: 36 characters
 *
 * The occurrence is derived from a hash of payee+memo to ensure the same
 * transaction always generates the same import_id, regardless of upload order
 * or what other transactions are in the batch. This enables proper duplicate
 * detection across multiple file uploads.
 */
function generateImportId(transaction: Transaction): string {
  const milliunits = convertToMilliunits(transaction.amount);

  // Create deterministic occurrence from hash of payee+memo
  // This ensures same transaction = same import_id across different uploads
  const uniqueData = `${transaction.payee_name || ''}:${transaction.memo || ''}`;
  const hash = crypto.createHash('sha256').update(uniqueData).digest('hex');

  // Take last 4 chars of hash as occurrence (stays within 36 char limit)
  // Convert to number for cleaner format
  const occurrence = parseInt(hash.substring(hash.length - 4), 16);

  // YNAB format: YNAB:[milliunit_amount]:[iso_date]:[occurrence]
  return `YNAB:${milliunits}:${transaction.date}:${occurrence}`;
}

/**
 * Gets plan ID (from config or auto-selects)
 */
async function getPlanId(ynabAPI: ynab.API, config: Config): Promise<string> {
  if (config.budgetId) {
    return config.budgetId;
  }

  const plansResponse = await ynabAPI.plans.getPlans();
  const plans = plansResponse.data.plans;

  if (plans.length === 0) {
    throw new Error('No budgets found in your YNAB account');
  }

  // Use first plan if only one exists
  if (plans.length === 1) {
    const firstPlan = plans[0];
    if (!firstPlan) {
      throw new Error('No budgets found in your YNAB account');
    }
    getLogger().info(`Using budget: ${firstPlan.name}`);
    return firstPlan.id;
  }

  throw new Error(
    'Multiple budgets found. Please set YNAB_BUDGET_ID in your .env file.\n' +
      'Available budgets:\n' +
      plans.map((p) => `  - ${p.name} (${p.id})`).join('\n')
  );
}

/**
 * Gets account ID (from config or auto-selects)
 */
async function getAccountId(ynabAPI: ynab.API, planId: string, config: Config): Promise<string> {
  if (config.accountId) {
    return config.accountId;
  }

  const accountsResponse = await ynabAPI.accounts.getAccounts(planId);
  const accounts = accountsResponse.data.accounts.filter((a) => !a.closed);

  if (accounts.length === 0) {
    throw new Error('No open accounts found in your budget');
  }

  // Use first account if only one exists
  if (accounts.length === 1) {
    const firstAccount = accounts[0];
    if (!firstAccount) {
      throw new Error('No open accounts found in your budget');
    }
    getLogger().info(`Using account: ${firstAccount.name}`);
    return firstAccount.id;
  }

  throw new Error(
    'Multiple accounts found. Please set YNAB_ACCOUNT_ID in your .env file.\n' +
      'Available accounts:\n' +
      accounts.map((a) => `  - ${a.name} (${a.id})`).join('\n')
  );
}

/**
 * Lists all budgets
 */
export async function listBudgets(accessToken: string): Promise<ynab.PlanSummary[]> {
  const ynabAPI = new ynab.API(accessToken);
  const response = await ynabAPI.plans.getPlans();
  return response.data.plans;
}

/**
 * Lists all accounts in a budget
 */
export async function listAccounts(accessToken: string, budgetId: string): Promise<ynab.Account[]> {
  const ynabAPI = new ynab.API(accessToken);
  const response = await ynabAPI.accounts.getAccounts(budgetId);
  return response.data.accounts.filter((a) => !a.closed);
}
