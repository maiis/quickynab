import type { Account, Budget, PreviewData } from '@lib/types.js';

// Global state management
export const state = {
  currentFile: null as File | null,
  previewData: null as PreviewData | null,
  budgets: [] as Budget[],
  accounts: [] as Account[],
  selectedBudgetId: null as string | null,
  selectedAccountId: null as string | null,
  currencyFormat: { symbol: '$', decimal_digits: 2 },
};

export function setCurrentFile(file: File | null) {
  state.currentFile = file;
}

export function setPreviewData(data: PreviewData | null) {
  state.previewData = data;
}

export function setBudgets(budgets: Budget[]) {
  state.budgets = budgets;
}

export function setAccounts(accounts: Account[]) {
  state.accounts = accounts;
}

export function setSelectedBudgetId(id: string | null) {
  state.selectedBudgetId = id;
}

export function setSelectedAccountId(id: string | null) {
  state.selectedAccountId = id;
}

export function setCurrencyFormat(format: { symbol: string; decimal_digits: number }) {
  state.currencyFormat = format;
}

export function resetState() {
  state.currentFile = null;
  state.previewData = null;
  state.selectedBudgetId = null;
  state.selectedAccountId = null;
}
