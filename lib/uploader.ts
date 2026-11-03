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
  // import_id is YNAB:<milliunits>:<iso_date>:<occurrence>, where occurrence
  // counts duplicates of the same amount+date in the batch (YNAB's own
  // semantics) so identical same-day rows get 1, 2, 3... instead of
  // collapsing into one id and being silently dropped as duplicates.
  const seen = new Map<string, number>();
  const ynabTransactions = transactions.map((tx) => {
    const comboKey = `${convertToMilliunits(tx.amount)}:${tx.date}`;
    const occurrence = (seen.get(comboKey) || 0) + 1;
    seen.set(comboKey, occurrence);

    return {
      account_id: accountId,
      date: tx.date,
      amount: convertToMilliunits(tx.amount),
      payee_name: tx.payee_name || undefined,
      memo: tx.memo || undefined,
      cleared: 'uncleared' as const,
      approved: false,
      import_id: `YNAB:${convertToMilliunits(tx.amount)}:${tx.date}:${occurrence}`,
    };
  });

  // Upload transactions in chunks: YNAB rejects oversized single requests,
  // and the server accepts up to 50k-line files
  const CHUNK_SIZE = 500;
  const response = {
    success: true as const,
    imported: 0,
    duplicates: 0,
    transactions: [] as ynab.TransactionDetail[],
  };

  try {
    for (let i = 0; i < ynabTransactions.length; i += CHUNK_SIZE) {
      const chunk = ynabTransactions.slice(i, i + CHUNK_SIZE);
      const chunkResponse = await ynabAPI.transactions.createTransactions(planId, {
        transactions: chunk,
      });

      response.imported += chunkResponse.data.transaction_ids.length;
      response.duplicates += chunkResponse.data.duplicate_import_ids?.length || 0;
      response.transactions.push(...(chunkResponse.data.transactions || []));
    }

    return response;
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
