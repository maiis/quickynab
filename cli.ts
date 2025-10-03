#!/usr/bin/env node

import { Command } from 'commander';
import type { Config } from './lib/config.js';
import { getConfig, saveConfig, hasConfig } from './lib/config.js';
import { parseCSV, validateCSV } from './lib/converter.js';
import { uploadTransactions, listBudgets, listAccounts } from './lib/uploader.js';
import { handleCliError, getErrorMessage } from './lib/errors.js';
import readline from 'readline';
import fs from 'fs';

const program = new Command();

// Helper function to prompt for budget and account selection
async function promptForBudgetAndAccount(
  config: Config
): Promise<{ budgetId: string; accountId: string }> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (prompt: string): Promise<string> =>
    new Promise((resolve) => rl.question(prompt, resolve));

  try {
    let budgetId = config.budgetId;
    let accountId = config.accountId;

    // Get budgets if budget ID not set
    if (!budgetId) {
      const budgets = await listBudgets(config.accessToken);

      if (budgets.length === 0) {
        throw new Error('No budgets found in your YNAB account');
      }

      if (budgets.length === 1) {
        budgetId = budgets[0]!.id;
        console.log(`Using budget: ${budgets[0]!.name}`);
      } else {
        console.log('\nAvailable budgets:');
        budgets.forEach((budget, index) => {
          console.log(`  ${index + 1}. ${budget.name}`);
        });

        const selection = await question('\nSelect budget number: ');
        const selectedIndex = parseInt(selection) - 1;

        if (selectedIndex < 0 || selectedIndex >= budgets.length) {
          throw new Error('Invalid budget selection');
        }

        const selectedBudget = budgets[selectedIndex];
        if (!selectedBudget) {
          throw new Error('Invalid budget selection');
        }
        budgetId = selectedBudget.id;
        console.log(`Selected: ${selectedBudget.name}`);
      }
    }

    // Get accounts if account ID not set
    if (!accountId) {
      const accounts = await listAccounts(config.accessToken, budgetId);

      if (accounts.length === 0) {
        throw new Error('No open accounts found in your budget');
      }

      if (accounts.length === 1) {
        accountId = accounts[0]!.id;
        console.log(`Using account: ${accounts[0]!.name}`);
      } else {
        console.log('\nAvailable accounts:');
        accounts.forEach((account, index) => {
          console.log(`  ${index + 1}. ${account.name} (${account.type})`);
        });

        const selection = await question('\nSelect account number: ');
        const selectedIndex = parseInt(selection) - 1;

        if (selectedIndex < 0 || selectedIndex >= accounts.length) {
          throw new Error('Invalid account selection');
        }

        const selectedAccount = accounts[selectedIndex];
        if (!selectedAccount) {
          throw new Error('Invalid account selection');
        }
        accountId = selectedAccount.id;
        console.log(`Selected: ${selectedAccount.name}`);
      }
    }

    rl.close();
    return { budgetId, accountId };
  } catch (error) {
    rl.close();
    throw error;
  }
}

program
  .name('ynab')
  .description('Quick and easy bank transaction imports to YNAB')
  .version('1.0.0');

// Init command
program
  .command('init')
  .description('Initialize YNAB CLI configuration')
  .action(async () => {
    try {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      const question = (prompt: string): Promise<string> =>
        new Promise((resolve) => rl.question(prompt, resolve));

      console.log('YNAB CLI Setup');
      console.log('==============\n');
      console.log('Get your Personal Access Token from: https://app.ynab.com/settings/developer\n');

      const accessToken = await question('Enter your YNAB Access Token: ');

      if (!accessToken) {
        console.error('Error: Access token is required');
        rl.close();
        process.exit(1);
      }

      // Test the token by fetching budgets
      console.log('\nVerifying token...');
      const budgets = await listBudgets(accessToken.trim());

      console.log(`\n✓ Token verified! Found ${budgets.length} budget(s)`);
      budgets.forEach((budget) => {
        console.log(`  - ${budget.name}`);
      });

      // Save config with just the token
      const config = {
        YNAB_ACCESS_TOKEN: accessToken.trim(),
      };

      saveConfig(config);
      console.log('\n✓ Configuration saved to ~/.quickynab/config');
      console.log('\nFor CLI usage, you can optionally set YNAB_BUDGET_ID and YNAB_ACCOUNT_ID');
      console.log('Edit ~/.quickynab/config or use .env in your project directory');
      console.log('For web usage, just run: npm run web (budget/account selection in UI)');

      rl.close();
    } catch (error) {
      handleCliError(error);
    }
  });

// Import command
program
  .command('import')
  .description('Import transactions from a YNAB-formatted CSV file')
  .argument('<file>', 'Path to CSV file')
  .option('--dry-run', 'Preview transactions without uploading')
  .action(async (file: string, options: { dryRun?: boolean }) => {
    try {
      // Check if config exists
      if (!hasConfig()) {
        console.error('Error: QuickYNAB not configured. Run "ynab init" first.');
        process.exit(1);
      }

      // Check if file exists
      if (!fs.existsSync(file)) {
        console.error(`Error: File not found: ${file}`);
        process.exit(1);
      }

      console.log(`Reading CSV file: ${file}`);

      // Validate CSV format
      validateCSV(file);

      // Parse CSV (auto-detects format)
      const transactions = parseCSV(file);
      console.log(`Parsed ${transactions.length} transactions`);

      if (transactions.length === 0) {
        console.log('No transactions to import');
        return;
      }

      // Show preview
      console.log('\nPreview of transactions:');
      transactions.slice(0, 5).forEach((tx, index) => {
        console.log(
          `  ${index + 1}. ${tx.date} | ${tx.payee_name || 'No payee'} | $${tx.amount.toFixed(2)}`
        );
      });

      if (transactions.length > 5) {
        console.log(`  ... and ${transactions.length - 5} more`);
      }

      // Dry run
      if (options.dryRun) {
        console.log('\n[DRY RUN] No transactions were uploaded');
        return;
      }

      // Upload
      console.log('\nUploading transactions to YNAB...');
      const config = getConfig();

      // Prompt for budget and account if needed
      const { budgetId, accountId } = await promptForBudgetAndAccount(config);

      const result = await uploadTransactions(transactions, config, accountId, budgetId);

      console.log(`\n✓ Successfully imported ${result.imported} transactions`);
      if (result.duplicates > 0) {
        console.log(`  (${result.duplicates} duplicates skipped)`);
      }
    } catch (error) {
      handleCliError(error);
    }
  });

// List budgets command
program
  .command('budgets')
  .description('List all budgets')
  .action(async () => {
    try {
      if (!hasConfig()) {
        console.error('Error: QuickYNAB not configured. Run "ynab init" first.');
        process.exit(1);
      }

      const config = getConfig();
      const budgets = await listBudgets(config.accessToken);

      console.log('Available budgets:');
      budgets.forEach((budget) => {
        console.log(`  - ${budget.name} (${budget.id})`);
      });
    } catch (error) {
      handleCliError(error);
    }
  });

// List accounts command
program
  .command('accounts')
  .description('List all accounts in the configured budget')
  .action(async () => {
    try {
      if (!hasConfig()) {
        console.error('Error: QuickYNAB not configured. Run "ynab init" first.');
        process.exit(1);
      }

      const config = getConfig();
      if (!config.budgetId) {
        console.error('Error: YNAB_BUDGET_ID not set.');
        console.error('Add it to ~/.quickynab/config or set in .env file');
        process.exit(1);
      }

      const accounts = await listAccounts(config.accessToken, config.budgetId);

      console.log('Available accounts:');
      accounts.forEach((account) => {
        console.log(`  - ${account.name} (${account.id})`);
      });
    } catch (error) {
      handleCliError(error);
    }
  });

program.parse();
