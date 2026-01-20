import './style.css';
import { checkConfig, dryRunFile, loadAccounts, loadBudgets, uploadFile } from './api.js';
import {
  resetState,
  setAccounts,
  setBudgets,
  setCurrencyFormat,
  setCurrentFile,
  setPreviewData,
  setSelectedAccountId,
  setSelectedBudgetId,
  state,
} from './state.js';
import {
  populateAccountDropdown,
  populateBudgetDropdown,
  resetUI,
  setAccountDropdownEmpty,
  setAccountDropdownError,
  setAccountDropdownLoading,
  showPreview,
  showResult,
  updateConfigStatus,
  updateConfigStatusError,
} from './ui.js';

// Global declarations
declare const __APP_VERSION__: string;

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
checkConfigStatus();
initBudgets();

// Event listeners
dropZone.addEventListener('click', () => {
  fileInput.click();
});

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
  handleReset();
});

budgetSelect.addEventListener('change', async (e) => {
  const target = e.target as HTMLSelectElement;
  setSelectedBudgetId(target.value);
  setSelectedAccountId(null);

  if (state.selectedBudgetId) {
    await handleLoadAccounts(state.selectedBudgetId);
  } else {
    accountSelectorContainer.classList.add('hidden');
    accountSelect.innerHTML = '<option value="">Select a budget first...</option>';
  }
});

accountSelect.addEventListener('change', (e) => {
  const target = e.target as HTMLSelectElement;
  setSelectedAccountId(target.value);
});

uploadBtn.addEventListener('click', async () => {
  await handleUpload();
});

// Functions
async function checkConfigStatus() {
  try {
    const data = await checkConfig();
    updateConfigStatus(data.configured, configStatus);
  } catch (_error) {
    updateConfigStatusError(configStatus);
  }
}

async function initBudgets() {
  try {
    const data = await loadBudgets();

    if (data.budgets && data.budgets.length > 0) {
      setBudgets(data.budgets);
      populateBudgetDropdown(data.budgets, budgetSelect, budgetSelectorContainer);

      // Auto-select if only one budget
      if (data.budgets.length === 1) {
        budgetSelect.value = data.budgets[0]!.id;
        setSelectedBudgetId(data.budgets[0]!.id);
        if (state.selectedBudgetId) {
          await handleLoadAccounts(state.selectedBudgetId);
        }
      }

      // Check for preselected budget
      await checkPreselectedBudget();
    }
  } catch (error) {
    console.error('Error loading budgets:', error);
    budgetSelectorContainer.classList.add('hidden');
  }
}

async function checkPreselectedBudget() {
  try {
    const data = await checkConfig();

    if (data.budgetId && state.budgets.find((b) => b.id === data.budgetId)) {
      budgetSelect.value = data.budgetId;
      setSelectedBudgetId(data.budgetId);
      await handleLoadAccounts(data.budgetId);

      // After accounts loaded, preselect account if configured
      if (data.accountId) {
        const accountExists = Array.from(accountSelect.options).some(
          (opt) => opt.value === data.accountId
        );
        if (accountExists) {
          accountSelect.value = data.accountId;
          setSelectedAccountId(data.accountId);
        }
      }
    }
  } catch (error) {
    console.error('Error checking preselected budget:', error);
  }
}

async function handleLoadAccounts(budgetId: string) {
  try {
    setAccountDropdownLoading(accountSelect);

    const data = await loadAccounts(budgetId);

    if (data.accounts && data.accounts.length > 0) {
      setAccounts(data.accounts);

      // Store currency format
      if (data.currency_format) {
        setCurrencyFormat({
          symbol: data.currency_format.currency_symbol,
          decimal_digits: data.currency_format.decimal_digits,
        });
      }

      populateAccountDropdown(data.accounts, accountSelect, accountSelectorContainer);
    } else {
      setAccountDropdownEmpty(accountSelect);
    }
  } catch (error) {
    console.error('Error loading accounts:', error);
    setAccountDropdownError(accountSelect);
  }
}

async function handleFile(file: File) {
  if (!file.name.endsWith('.csv')) {
    showResult(
      'error',
      {
        title: '❌ Invalid File',
        message: 'Please upload a CSV file',
      },
      result
    );
    return;
  }

  setCurrentFile(file);

  try {
    const data = await dryRunFile(file);

    if (data.success) {
      setPreviewData(data);
      showPreview(data, preview, previewContent, dropZone, result);
    } else {
      showResult(
        'error',
        {
          title: '❌ Error Parsing CSV',
          message:
            typeof data === 'object' && data && 'error' in data && typeof data.error === 'string'
              ? data.error
              : 'Unknown error occurred',
        },
        result
      );
    }
  } catch (error) {
    showResult(
      'error',
      {
        title: '❌ Error',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      },
      result
    );
  }
}

async function handleUpload() {
  if (!state.currentFile) return;

  // Validate account selection
  if (!state.selectedAccountId) {
    showResult(
      'error',
      {
        title: '❌ No Account Selected',
        message: 'Please select an account from the dropdown above',
      },
      result
    );
    return;
  }

  uploadBtn.disabled = true;
  uploadBtn.innerHTML = '⏳ Uploading...';

  // Show progress message
  showResult(
    'info',
    {
      title: '⏳ Uploading Transactions',
      message: 'Please wait while we upload your transactions to YNAB...',
    },
    result
  );

  try {
    const { response, data } = await uploadFile(
      state.currentFile,
      state.selectedAccountId,
      state.selectedBudgetId
    );

    if (response.ok && data.success) {
      // Hide preview area
      preview.classList.add('hidden');

      showResult(
        'success',
        {
          title: '✅ Upload Successful!',
          message: `${data.imported} transactions imported successfully`,
          duplicates: data.duplicates,
          tip: '✨ Your transactions are now in YNAB!',
          showResetButton: true,
          budgetId: state.selectedBudgetId,
          accountId: state.selectedAccountId,
        },
        result,
        () => {
          handleReset();
          dropZone.focus();
        }
      );
    } else {
      showResult(
        'error',
        {
          title: '❌ Upload Failed',
          message:
            typeof data === 'object' && data && 'error' in data && typeof data.error === 'string'
              ? data.error
              : 'Unknown error occurred',
        },
        result
      );
    }
  } catch (error) {
    showResult(
      'error',
      {
        title: '❌ Upload Failed',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      },
      result
    );
  } finally {
    uploadBtn.disabled = false;
    uploadBtn.innerHTML = 'Upload to YNAB';
  }
}

function handleReset() {
  resetState();
  resetUI(preview, dropZone, fileInput);
}
