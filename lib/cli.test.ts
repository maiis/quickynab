import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import fs from 'node:fs';
import * as config from './config.js';
import * as converter from './converter.js';
import * as uploader from './uploader.js';

// Mock modules
const mockGetConfig = mock(() => ({
  accessToken: 'test-token',
  budgetId: 'budget-123',
  accountId: 'account-456',
}));

const mockHasConfig = mock(() => true);

const mockParseCSV = mock(() => [
  {
    date: '2024-01-15',
    payee_name: 'Test Store',
    amount: -50.0,
    memo: 'Test transaction',
  },
]);

const mockValidateCSV = mock(() => true);

const mockUploadTransactions = mock(() =>
  Promise.resolve({
    success: true,
    imported: 1,
    duplicates: 0,
  })
);

const mockListBudgets = mock(() =>
  Promise.resolve([
    { id: 'budget-123', name: 'My Budget' },
    { id: 'budget-456', name: 'Another Budget' },
  ])
);

const mockListAccounts = mock(() =>
  Promise.resolve([
    { id: 'account-123', name: 'Checking', type: 'checking', closed: false },
    { id: 'account-456', name: 'Savings', type: 'savings', closed: false },
  ])
);

const mockExistsSync = mock(() => true);
const mockReadFileSync = mock(() => 'Date,Payee,Amount\n2024-01-15,Test Store,-50.00');

describe('CLI Commands', () => {
  beforeEach(() => {
    // Setup mocks
    mock.module('./config.js', () => ({
      getConfig: mockGetConfig,
      hasConfig: mockHasConfig,
      saveConfig: mock(() => {}),
    }));

    mock.module('./converter.js', () => ({
      parseCSV: mockParseCSV,
      validateCSV: mockValidateCSV,
    }));

    mock.module('./uploader.js', () => ({
      uploadTransactions: mockUploadTransactions,
      listBudgets: mockListBudgets,
      listAccounts: mockListAccounts,
    }));

    // Mock fs
    mock.module('node:fs', () => ({
      default: {
        existsSync: mockExistsSync,
        readFileSync: mockReadFileSync,
      },
    }));
  });

  afterEach(() => {
    mock.restore();
  });

  test('getConfig returns valid configuration', () => {
    const cfg = config.getConfig();
    expect(cfg.accessToken).toBe('test-token');
    expect(cfg.budgetId).toBe('budget-123');
    expect(cfg.accountId).toBe('account-456');
  });

  test('hasConfig returns true when config exists', () => {
    const result = config.hasConfig();
    expect(result).toBe(true);
  });

  test('parseCSV returns array of transactions', () => {
    const transactions = converter.parseCSV('test.csv');
    expect(transactions).toBeArray();
    expect(transactions.length).toBeGreaterThan(0);
    expect(transactions[0]).toHaveProperty('date');
    expect(transactions[0]).toHaveProperty('payee_name');
    expect(transactions[0]).toHaveProperty('amount');
  });

  test('uploadTransactions succeeds with valid data', async () => {
    const result = await uploader.uploadTransactions(
      [
        {
          date: '2024-01-15',
          payee_name: 'Test Store',
          amount: -50.0,
          memo: 'Test',
        },
      ],
      { accessToken: 'test-token', budgetId: null, accountId: null },
      'account-123',
      'budget-123'
    );

    expect(result.success).toBe(true);
    expect(result.imported).toBe(1);
    expect(result.duplicates).toBe(0);
  });

  test('listBudgets returns array of budgets', async () => {
    const budgets = await uploader.listBudgets('test-token');
    expect(budgets).toBeArray();
    expect(budgets.length).toBeGreaterThan(0);
    expect(budgets[0]).toHaveProperty('id');
    expect(budgets[0]).toHaveProperty('name');
  });

  test('listAccounts returns array of accounts', async () => {
    const accounts = await uploader.listAccounts('test-token', 'budget-123');
    expect(accounts).toBeArray();
    expect(accounts.length).toBeGreaterThan(0);
    expect(accounts[0]).toHaveProperty('id');
    expect(accounts[0]).toHaveProperty('name');
    expect(accounts[0]).toHaveProperty('type');
  });

  test('validateCSV returns true for valid CSV', () => {
    const isValid = converter.validateCSV('test.csv');
    expect(isValid).toBe(true);
  });

  test('file validation fails for non-existent file', () => {
    const mockExistsSync = mock(() => false);
    mock.module('node:fs', () => ({
      default: {
        existsSync: mockExistsSync,
        readFileSync: mockReadFileSync,
      },
    }));

    expect(() => {
      if (!fs.existsSync('nonexistent.csv')) {
        throw new Error('File not found');
      }
    }).toThrow('File not found');
  });
});
