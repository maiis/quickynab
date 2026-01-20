import './style.css';
import type { Account, Budget, PreviewData, PreviewTransaction, UploadResult } from '@lib/types.js';

// Global declarations
declare const __APP_VERSION__: string;

// State
let currentFile: File | null = null;
let _previewData: PreviewData | null = null;
let budgets: Budget[] = [];
let _accounts: Account[] = [];
let selectedBudgetId: string | null = null;
let selectedAccountId: string | null = null;
let currencyFormat = { symbol: '$', decimal_digits: 2 };

// Elements
const dropZone = document.getElementById('drop-zone') as HTMLElement;
const fileInput = document.getElementById('file-input') as HTMLInputElement;
const preview = document.getElementById('preview') as HTMLElement;
const previewContent = document.getElementById('preview-content') as HTMLElement;
const uploadBtn = document.getElementById('upload-btn') as HTMLButtonElement;
const cancelBtn = document.getElementById('cancel-btn') as HTMLElement;
const result = document.getElementById('result') as HTMLElement;
const configStatus = document.getElementById('config-status') as HTMLElement;
const budgetSelectorContainer = document.getElementById('budget-selector-container') as HTMLElement;
const budgetSelect = document.getElementById('budget-select') as HTMLSelectElement;
const accountSelectorContainer = document.getElementById(
  'account-selector-container'
) as HTMLElement;
const accountSelect = document.getElementById('account-select') as HTMLSelectElement;
const versionElement = document.getElementById('app-version') as HTMLElement;

// Initialize
if (versionElement) {
  versionElement.textContent = `v${__APP_VERSION__} | `;
}
checkConfig();
loadBudgets().then(checkPreselectedBudget);

// Drag and drop handlers
dropZone.addEventListener('click', () => {
  fileInput.click();
});

// Keyboard support for drop zone
dropZone.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    fileInput.click();
  }
});

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');

  const files = e.dataTransfer?.files;
  if (files && files.length > 0) {
    handleFile(files[0]);
  }
});

fileInput.addEventListener('change', (e) => {
  const target = e.target as HTMLInputElement;
  if (target.files && target.files.length > 0) {
    handleFile(target.files[0]);
  }
});

cancelBtn.addEventListener('click', () => {
  resetUI();
});

budgetSelect.addEventListener('change', async (e) => {
  const target = e.target as HTMLSelectElement;
  selectedBudgetId = target.value;
  selectedAccountId = null;

  if (selectedBudgetId) {
    await loadAccounts(selectedBudgetId);
  } else {
    accountSelectorContainer.classList.add('hidden');
    accountSelect.innerHTML = '<option value="">Select a budget first...</option>';
  }
});

accountSelect.addEventListener('change', (e) => {
  const target = e.target as HTMLSelectElement;
  selectedAccountId = target.value;
});

uploadBtn.addEventListener('click', async () => {
  if (!currentFile) return;

  // Validate account selection
  if (!selectedAccountId) {
    showResult('error', {
      title: '❌ No Account Selected',
      message: 'Please select an account from the dropdown above',
    });
    return;
  }

  uploadBtn.disabled = true;
  uploadBtn.innerHTML = '⏳ Uploading...';

  // Show progress message
  showResult('info', {
    title: '⏳ Uploading Transactions',
    message: 'Please wait while we upload your transactions to YNAB...',
  });

  try {
    const formData = new FormData();
    formData.append('file', currentFile);

    const url = `/api/upload?accountId=${encodeURIComponent(selectedAccountId)}${selectedBudgetId ? `&budgetId=${encodeURIComponent(selectedBudgetId)}` : ''}`;
    const response = await fetch(url, {
      method: 'POST',
      body: formData,
    });

    const data: UploadResult = await response.json();

    if (response.ok && data.success) {
      // Hide preview area
      preview.classList.add('hidden');

      showResult('success', {
        title: '✅ Upload Successful!',
        message: `${data.imported} transactions imported successfully`,
        duplicates: data.duplicates,
        tip: '✨ Your transactions are now in YNAB!',
        showResetButton: true,
        budgetId: selectedBudgetId,
        accountId: selectedAccountId,
      });
    } else {
      showResult('error', {
        title: '❌ Upload Failed',
        message:
          typeof data === 'object' && data && 'error' in data && typeof data.error === 'string'
            ? data.error
            : 'Unknown error occurred',
      });
    }
  } catch (error) {
    showResult('error', {
      title: '❌ Upload Failed',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  } finally {
    uploadBtn.disabled = false;
    uploadBtn.innerHTML = 'Upload to YNAB';
  }
});

// Functions
async function checkConfig() {
  try {
    const response = await fetch('/api/config');
    const data = await response.json();

    if (data.configured) {
      configStatus.className = 'text-sm mb-3 opacity-90';
      configStatus.innerHTML = '<p>✅ YNAB configured and ready</p>';
    } else {
      configStatus.className = 'text-sm mb-3 opacity-90';
      configStatus.innerHTML = '<p>⚠️ YNAB not configured. Please set YNAB_ACCESS_TOKEN</p>';
    }
  } catch (_error) {
    configStatus.className = 'text-sm mb-3 opacity-90';
    configStatus.innerHTML = '<p>⚠️ Unable to connect to server</p>';
  }
}

async function checkPreselectedBudget() {
  try {
    const response = await fetch('/api/config');
    const data = await response.json();

    if (data.budgetId && budgets.find((b) => b.id === data.budgetId)) {
      // Preselect the budget from config
      budgetSelect.value = data.budgetId;
      selectedBudgetId = data.budgetId;
      await loadAccounts(data.budgetId);

      // After accounts are loaded, preselect account if configured
      if (data.accountId) {
        const accountExists = Array.from(accountSelect.options).some(
          (opt) => opt.value === data.accountId
        );
        if (accountExists) {
          accountSelect.value = data.accountId;
          selectedAccountId = data.accountId;
        }
      }
    }
  } catch (error) {
    console.error('Error checking preselected budget:', error);
  }
}

async function loadBudgets() {
  try {
    const response = await fetch('/api/budgets');
    const data = await response.json();

    if (response.ok && data.budgets && data.budgets.length > 0) {
      budgets = data.budgets;

      // Populate dropdown
      budgetSelect.innerHTML = '<option value="">-- Select a budget --</option>';
      data.budgets.forEach((budget: Budget) => {
        const option = document.createElement('option');
        option.value = budget.id;
        option.textContent = budget.name;
        budgetSelect.appendChild(option);
      });

      // Show the selector
      budgetSelectorContainer.classList.remove('hidden');

      // Auto-select if only one budget
      if (data.budgets.length === 1) {
        budgetSelect.value = data.budgets[0].id;
        selectedBudgetId = data.budgets[0].id;
        if (selectedBudgetId) {
          await loadAccounts(selectedBudgetId);
        }
      }
    }
  } catch (error) {
    console.error('Error loading budgets:', error);
    budgetSelectorContainer.classList.add('hidden');
  }
}

async function loadAccounts(budgetId: string) {
  try {
    accountSelect.innerHTML = '<option value="">Loading accounts...</option>';
    accountSelect.disabled = true;

    const response = await fetch(`/api/accounts?budgetId=${budgetId}`);
    const data = await response.json();

    if (response.ok && data.accounts && data.accounts.length > 0) {
      _accounts = data.accounts;

      // Store currency format
      if (data.currency_format) {
        currencyFormat = {
          symbol: data.currency_format.currency_symbol,
          decimal_digits: data.currency_format.decimal_digits,
        };
      }

      // Populate dropdown
      accountSelect.innerHTML = '<option value="">-- Select an account --</option>';
      data.accounts.forEach((account: Account) => {
        const option = document.createElement('option');
        option.value = account.id;
        option.textContent = `${account.name} (${account.type})`;
        accountSelect.appendChild(option);
      });

      accountSelect.disabled = false;
      accountSelectorContainer.classList.remove('hidden');
    } else {
      accountSelect.innerHTML = '<option value="">No accounts found</option>';
      accountSelect.disabled = true;
    }
  } catch (error) {
    console.error('Error loading accounts:', error);
    accountSelect.innerHTML = '<option value="">Error loading accounts</option>';
    accountSelect.disabled = true;
  }
}

async function handleFile(file: File) {
  if (!file.name.endsWith('.csv')) {
    showResult('error', {
      title: '❌ Invalid File',
      message: 'Please upload a CSV file',
    });
    return;
  }

  currentFile = file;

  // Show preview by uploading with dry-run
  try {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('/api/upload?dryRun=true', {
      method: 'POST',
      body: formData,
    });

    const data: PreviewData = await response.json();

    if (response.ok && data.success) {
      _previewData = data;
      showPreview(data);
    } else {
      showResult('error', {
        title: '❌ Error Parsing CSV',
        message:
          typeof data === 'object' && data && 'error' in data && typeof data.error === 'string'
            ? data.error
            : 'Unknown error occurred',
      });
    }
  } catch (error) {
    showResult('error', {
      title: '❌ Error',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
}

function showPreview(data: PreviewData) {
  const { count, preview: previewTransactions } = data;

  let html = `
    <div class="mb-4 p-4 bg-white dark:bg-gray-800 rounded-lg">
      <strong class="text-gray-900 dark:text-gray-100">Total transactions:</strong> <span class="text-gray-900 dark:text-gray-100">${count}</span>
    </div>
  `;

  previewTransactions.forEach((tx) => {
    const amountClass =
      tx.amount >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
    const formattedAmount = Math.abs(tx.amount).toFixed(currencyFormat.decimal_digits);
    const amountStr =
      tx.amount >= 0
        ? `+${currencyFormat.symbol}${formattedAmount}`
        : `-${currencyFormat.symbol}${formattedAmount}`;

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
  preview.classList.remove('hidden');
  dropZone.style.display = 'none';
  result.classList.add('hidden');
}

function showResult(
  type: 'success' | 'error' | 'info',
  data: {
    title?: string;
    message?: string;
    duplicates?: number;
    tip?: string;
    showResetButton?: boolean;
    budgetId?: string | null;
    accountId?: string | null;
  }
) {
  const colorClasses = {
    success:
      'bg-green-100 dark:bg-green-900 text-green-900 dark:text-green-100 border-green-200 dark:border-green-700',
    error:
      'bg-red-100 dark:bg-red-900 text-red-900 dark:text-red-100 border-red-200 dark:border-red-700',
    info: 'bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100 border-blue-200 dark:border-blue-700',
  };

  result.className = `mt-8 rounded-lg p-6 border-2 ${colorClasses[type]}`;
  result.innerHTML = ''; // Clear first

  // Create title
  const h3 = document.createElement('h3');
  h3.className = 'text-xl font-bold mb-2';
  h3.textContent = data.title || '';
  result.appendChild(h3);

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
    result.appendChild(p);
  }

  // Add duplicates info for success
  if (data.duplicates && data.duplicates > 0) {
    const duplicateP = document.createElement('p');
    duplicateP.className = 'text-sm opacity-80 mb-2';
    duplicateP.textContent = `ℹ️ ${data.duplicates} duplicate transaction(s) were skipped`;
    result.appendChild(duplicateP);
  }

  // Add tip for success
  if (data.tip) {
    const tipP = document.createElement('p');
    tipP.className = 'font-semibold mt-4';
    tipP.textContent = data.tip;
    result.appendChild(tipP);
  }

  // Add action buttons for successful uploads
  if (data.showResetButton) {
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
    resetButton.onclick = () => {
      resetUI();
      dropZone.focus();
    };

    buttonContainer.appendChild(resetButton);
    result.appendChild(buttonContainer);
  }

  result.classList.remove('hidden');

  // Set focus for accessibility
  result.setAttribute('tabindex', '-1');
  result.focus();

  // Don't auto-hide if there's a reset button
  if (type === 'success' && !data.showResetButton) {
    setTimeout(() => {
      result.classList.add('hidden');
    }, 5000);
  }
}

function resetUI() {
  currentFile = null;
  _previewData = null;
  preview.classList.add('hidden');
  dropZone.style.display = 'block';
  fileInput.value = '';
}
