import type { PreviewData } from '@lib/types.js';
import { state } from './state.js';

interface ShowResultData {
  title?: string;
  message?: string;
  duplicates?: number;
  tip?: string;
  showResetButton?: boolean;
  budgetId?: string | null;
  accountId?: string | null;
}

export function showPreview(
  data: PreviewData,
  previewElement: HTMLElement,
  previewContent: HTMLElement,
  dropZone: HTMLElement,
  resultElement: HTMLElement
) {
  const { count, preview: previewTransactions } = data;

  let html = `
    <div class="mb-4 p-4 bg-white dark:bg-gray-800 rounded-lg">
      <strong class="text-gray-900 dark:text-gray-100">Total transactions:</strong> <span class="text-gray-900 dark:text-gray-100">${count}</span>
    </div>
  `;

  previewTransactions.forEach((tx) => {
    const amountClass =
      tx.amount >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
    const formattedAmount = Math.abs(tx.amount).toFixed(state.currencyFormat.decimal_digits);
    const amountStr =
      tx.amount >= 0
        ? `+${state.currencyFormat.symbol}${formattedAmount}`
        : `-${state.currencyFormat.symbol}${formattedAmount}`;

    html += `
      <div class="flex justify-between items-center py-3 border-b border-gray-200 dark:border-gray-700 last:border-0">
        <span class="font-semibold min-w-[100px] dark:text-gray-100">${tx.date}</span>
        <span class="flex-1 px-4 text-gray-600 dark:text-gray-300">${tx.payee || 'No payee'}</span>
        <span class="font-semibold min-w-[100px] text-right ${amountClass}">${amountStr}</span>
      </div>
    `;
  });

  if (count > previewTransactions.length) {
    html += `
      <div class="text-center p-4 text-gray-500 dark:text-gray-400">
        ... and ${count - previewTransactions.length} more transactions
      </div>
    `;
  }

  previewContent.innerHTML = html;
  previewElement.classList.remove('hidden');
  dropZone.style.display = 'none';
  resultElement.classList.add('hidden');
}

export function showResult(
  type: 'success' | 'error' | 'info',
  data: ShowResultData,
  resultElement: HTMLElement,
  onReset?: () => void
) {
  const colorClasses = {
    success:
      'bg-green-100 dark:bg-green-900 text-green-900 dark:text-green-100 border-green-200 dark:border-green-700',
    error:
      'bg-red-100 dark:bg-red-900 text-red-900 dark:text-red-100 border-red-200 dark:border-red-700',
    info: 'bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100 border-blue-200 dark:border-blue-700',
  };

  resultElement.className = `mt-8 rounded-lg p-6 border-2 ${colorClasses[type]}`;
  resultElement.innerHTML = ''; // Clear first

  // Create title
  const h3 = document.createElement('h3');
  h3.className = 'text-xl font-bold mb-2';
  h3.textContent = data.title || '';
  resultElement.appendChild(h3);

  // Create message
  if (data.message) {
    const p = document.createElement('p');
    p.className = 'mb-2';
    if (type === 'success') {
      const strong = document.createElement('strong');
      strong.textContent = data.message;
      p.appendChild(strong);
    } else {
      p.textContent = data.message;
    }
    resultElement.appendChild(p);
  }

  // Add duplicates info for success
  if (data.duplicates && data.duplicates > 0) {
    const duplicateP = document.createElement('p');
    duplicateP.className = 'text-sm opacity-80 mb-2';
    duplicateP.textContent = `ℹ️ ${data.duplicates} duplicate transaction(s) were skipped`;
    resultElement.appendChild(duplicateP);
  }

  // Add tip for success
  if (data.tip) {
    const tipP = document.createElement('p');
    tipP.className = 'font-semibold mt-4';
    tipP.textContent = data.tip;
    resultElement.appendChild(tipP);
  }

  // Add action buttons for successful uploads
  if (data.showResetButton && onReset) {
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'mt-5 flex gap-3 flex-wrap';

    // Link to view in YNAB
    if (data.budgetId && data.accountId) {
      const ynabLink = document.createElement('a');
      ynabLink.href = `https://app.ynab.com/${data.budgetId}/accounts/${data.accountId}`;
      ynabLink.target = '_blank';
      ynabLink.rel = 'noopener noreferrer';
      ynabLink.className =
        'px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-all no-underline';
      ynabLink.textContent = '🔗 View in YNAB';
      ynabLink.setAttribute('aria-label', 'Open YNAB to view imported transactions');
      buttonContainer.appendChild(ynabLink);
    }

    // Import another file button
    const resetButton = document.createElement('button');
    resetButton.className =
      'px-6 py-3 bg-gray-200 text-gray-800 rounded-lg font-semibold hover:bg-gray-300 transition-all';
    resetButton.textContent = '📁 Import Another File';
    resetButton.setAttribute('aria-label', 'Reset and import another file');
    resetButton.onclick = onReset;

    buttonContainer.appendChild(resetButton);
    resultElement.appendChild(buttonContainer);
  }

  resultElement.classList.remove('hidden');

  // Set focus for accessibility
  resultElement.setAttribute('tabindex', '-1');
  resultElement.focus();

  // Don't auto-hide if there's a reset button
  if (type === 'success' && !data.showResetButton) {
    setTimeout(() => {
      resultElement.classList.add('hidden');
    }, 5000);
  }
}

export function resetUI(
  previewElement: HTMLElement,
  dropZone: HTMLElement,
  fileInput: HTMLInputElement
) {
  previewElement.classList.add('hidden');
  dropZone.style.display = 'block';
  fileInput.value = '';
}

export function updateConfigStatus(configured: boolean, configStatusElement: HTMLElement) {
  configStatusElement.className = 'text-sm mb-3 opacity-90';
  if (configured) {
    configStatusElement.innerHTML = '<p>✅ YNAB configured and ready</p>';
  } else {
    configStatusElement.innerHTML = '<p>⚠️ YNAB not configured. Please set YNAB_ACCESS_TOKEN</p>';
  }
}

export function updateConfigStatusError(configStatusElement: HTMLElement) {
  configStatusElement.className = 'text-sm mb-3 opacity-90';
  configStatusElement.innerHTML = '<p>⚠️ Unable to connect to server</p>';
}

export function populateBudgetDropdown(
  budgets: Array<{ id: string; name: string }>,
  budgetSelect: HTMLSelectElement,
  budgetSelectorContainer: HTMLElement
) {
  budgetSelect.innerHTML = '<option value="">-- Select a budget --</option>';
  budgets.forEach((budget) => {
    const option = document.createElement('option');
    option.value = budget.id;
    option.textContent = budget.name;
    budgetSelect.appendChild(option);
  });
  budgetSelectorContainer.classList.remove('hidden');
}

export function populateAccountDropdown(
  accounts: Array<{ id: string; name: string; type: string }>,
  accountSelect: HTMLSelectElement,
  accountSelectorContainer: HTMLElement
) {
  accountSelect.innerHTML = '<option value="">-- Select an account --</option>';
  accounts.forEach((account) => {
    const option = document.createElement('option');
    option.value = account.id;
    option.textContent = `${account.name} (${account.type})`;
    accountSelect.appendChild(option);
  });
  accountSelect.disabled = false;
  accountSelectorContainer.classList.remove('hidden');
}

export function setAccountDropdownLoading(accountSelect: HTMLSelectElement) {
  accountSelect.innerHTML = '<option value="">Loading accounts...</option>';
  accountSelect.disabled = true;
}

export function setAccountDropdownError(accountSelect: HTMLSelectElement) {
  accountSelect.innerHTML = '<option value="">Error loading accounts</option>';
  accountSelect.disabled = true;
}

export function setAccountDropdownEmpty(accountSelect: HTMLSelectElement) {
  accountSelect.innerHTML = '<option value="">No accounts found</option>';
  accountSelect.disabled = true;
}
