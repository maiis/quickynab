import type { Account, Budget, PreviewData, UploadResult } from '@lib/types.js';

interface ConfigResponse {
  configured: boolean;
  budgetId?: string | null;
  accountId?: string | null;
}

interface BudgetsResponse {
  budgets: Budget[];
}

interface AccountsResponse {
  accounts: Account[];
  currency_format?: {
    currency_symbol: string;
    decimal_digits: number;
  };
}

export async function checkConfig(): Promise<ConfigResponse> {
  const response = await fetch('/api/config');
  return response.json();
}

export async function loadBudgets(): Promise<BudgetsResponse> {
  const response = await fetch('/api/budgets');
  return response.json();
}

export async function loadAccounts(budgetId: string): Promise<AccountsResponse> {
  const response = await fetch(`/api/accounts?budgetId=${budgetId}`);
  return response.json();
}

export async function dryRunFile(file: File): Promise<PreviewData> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('/api/upload?dryRun=true', {
    method: 'POST',
    body: formData,
  });

  return response.json();
}

export async function uploadFile(
  file: File,
  accountId: string,
  budgetId: string | null
): Promise<{ response: Response; data: UploadResult }> {
  const formData = new FormData();
  formData.append('file', file);

  const url = `/api/upload?accountId=${encodeURIComponent(accountId)}${
    budgetId ? `&budgetId=${encodeURIComponent(budgetId)}` : ''
  }`;

  const response = await fetch(url, {
    method: 'POST',
    body: formData,
  });

  const data = await response.json();
  return { response, data };
}
