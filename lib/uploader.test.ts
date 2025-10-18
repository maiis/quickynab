import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Config } from './config.js';
import { YnabApiError } from './errors.js';
import type { Transaction } from './types.js';
import { listAccounts, listBudgets, uploadTransactions } from './uploader.js';

// Mock the ynab module
vi.mock('ynab', () => {
  const mockAPI = {
    budgets: {
      getBudgets: vi.fn(),
    },
    accounts: {
      getAccounts: vi.fn(),
    },
    transactions: {
      createTransactions: vi.fn(),
    },
  };

  return {
    API: vi.fn(() => mockAPI),
  };
});

interface MockYnabAPI {
  budgets: { getBudgets: ReturnType<typeof vi.fn> };
  accounts: { getAccounts: ReturnType<typeof vi.fn> };
  transactions: { createTransactions: ReturnType<typeof vi.fn> };
}

describe('uploader', () => {
  let mockYnabAPI: MockYnabAPI;
  const mockConfig: Config = {
    accessToken: 'test-token',
    budgetId: 'budget-123',
    accountId: 'account-456',
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    // Get the mocked API instance
    const ynab = await import('ynab');
    mockYnabAPI = new ynab.API('test-token') as unknown as MockYnabAPI;
  });

  describe('uploadTransactions', () => {
    it('should upload transactions successfully', async () => {
      const transactions: Transaction[] = [
        {
          date: '2025-01-15',
          payee_name: 'Store',
          amount: -50.0,
          memo: 'Purchase',
          category_name: null,
        },
      ];

      mockYnabAPI.transactions.createTransactions.mockResolvedValue({
        data: {
          transaction_ids: ['tx1'],
          duplicate_import_ids: [],
          transactions: [],
        },
      });

      const result = await uploadTransactions(transactions, mockConfig);

      expect(result.success).toBe(true);
      expect(result.imported).toBe(1);
      expect(result.duplicates).toBe(0);
      expect(mockYnabAPI.transactions.createTransactions).toHaveBeenCalledWith('budget-123', {
        transactions: [
          expect.objectContaining({
            account_id: 'account-456',
            date: '2025-01-15',
            amount: -50000, // milliunits
            payee_name: 'Store',
            memo: 'Purchase',
            cleared: 'uncleared',
            approved: false,
          }),
        ],
      });
    });

    it('should use budget override when provided', async () => {
      const transactions: Transaction[] = [
        { date: '2025-01-15', payee_name: 'Store', amount: -10.0, memo: null, category_name: null },
      ];

      mockYnabAPI.transactions.createTransactions.mockResolvedValue({
        data: {
          transaction_ids: ['tx1'],
          duplicate_import_ids: [],
          transactions: [],
        },
      });

      await uploadTransactions(transactions, mockConfig, null, 'override-budget');

      expect(mockYnabAPI.transactions.createTransactions).toHaveBeenCalledWith(
        'override-budget',
        expect.any(Object)
      );
    });

    it('should use account override when provided', async () => {
      const transactions: Transaction[] = [
        { date: '2025-01-15', payee_name: 'Store', amount: -10.0, memo: null, category_name: null },
      ];

      mockYnabAPI.transactions.createTransactions.mockResolvedValue({
        data: {
          transaction_ids: ['tx1'],
          duplicate_import_ids: [],
          transactions: [],
        },
      });

      await uploadTransactions(transactions, mockConfig, 'override-account', null);

      expect(mockYnabAPI.transactions.createTransactions).toHaveBeenCalledWith('budget-123', {
        transactions: [
          expect.objectContaining({
            account_id: 'override-account',
          }),
        ],
      });
    });

    it('should handle duplicate transactions', async () => {
      const transactions: Transaction[] = [
        { date: '2025-01-15', payee_name: 'Store', amount: -10.0, memo: null, category_name: null },
      ];

      mockYnabAPI.transactions.createTransactions.mockResolvedValue({
        data: {
          transaction_ids: [],
          duplicate_import_ids: ['dup1'],
          transactions: [],
        },
      });

      const result = await uploadTransactions(transactions, mockConfig);

      expect(result.success).toBe(true);
      expect(result.imported).toBe(0);
      expect(result.duplicates).toBe(1);
    });

    it('should throw YnabApiError on API error', async () => {
      const transactions: Transaction[] = [
        { date: '2025-01-15', payee_name: 'Store', amount: -10.0, memo: null, category_name: null },
      ];

      mockYnabAPI.transactions.createTransactions.mockRejectedValue({
        error: {
          detail: 'Invalid access token',
        },
      });

      await expect(uploadTransactions(transactions, mockConfig)).rejects.toThrow(YnabApiError);
      await expect(uploadTransactions(transactions, mockConfig)).rejects.toThrow(
        'Invalid access token'
      );
    });

    it('should auto-select budget when only one exists', async () => {
      const configWithoutBudget: Config = {
        accessToken: 'test-token',
        budgetId: null,
        accountId: 'account-456',
      };

      mockYnabAPI.budgets.getBudgets.mockResolvedValue({
        data: {
          budgets: [{ id: 'auto-budget', name: 'My Budget' }],
        },
      });

      mockYnabAPI.transactions.createTransactions.mockResolvedValue({
        data: {
          transaction_ids: ['tx1'],
          duplicate_import_ids: [],
          transactions: [],
        },
      });

      const transactions: Transaction[] = [
        { date: '2025-01-15', payee_name: 'Store', amount: -10.0, memo: null, category_name: null },
      ];

      await uploadTransactions(transactions, configWithoutBudget);

      expect(mockYnabAPI.transactions.createTransactions).toHaveBeenCalledWith(
        'auto-budget',
        expect.any(Object)
      );
    });

    it('should auto-select account when only one exists', async () => {
      const configWithoutAccount: Config = {
        accessToken: 'test-token',
        budgetId: 'budget-123',
        accountId: null,
      };

      mockYnabAPI.accounts.getAccounts.mockResolvedValue({
        data: {
          accounts: [
            { id: 'auto-account', name: 'Checking', closed: false },
            { id: 'closed-account', name: 'Old Account', closed: true },
          ],
        },
      });

      mockYnabAPI.transactions.createTransactions.mockResolvedValue({
        data: {
          transaction_ids: ['tx1'],
          duplicate_import_ids: [],
          transactions: [],
        },
      });

      const transactions: Transaction[] = [
        { date: '2025-01-15', payee_name: 'Store', amount: -10.0, memo: null, category_name: null },
      ];

      await uploadTransactions(transactions, configWithoutAccount);

      expect(mockYnabAPI.transactions.createTransactions).toHaveBeenCalledWith('budget-123', {
        transactions: [
          expect.objectContaining({
            account_id: 'auto-account',
          }),
        ],
      });
    });

    it('should convert amounts to milliunits correctly', async () => {
      const transactions: Transaction[] = [
        { date: '2025-01-15', payee_name: 'Store', amount: 12.34, memo: null, category_name: null },
        {
          date: '2025-01-16',
          payee_name: 'Restaurant',
          amount: -56.78,
          memo: null,
          category_name: null,
        },
      ];

      mockYnabAPI.transactions.createTransactions.mockResolvedValue({
        data: {
          transaction_ids: ['tx1', 'tx2'],
          duplicate_import_ids: [],
          transactions: [],
        },
      });

      await uploadTransactions(transactions, mockConfig);

      expect(mockYnabAPI.transactions.createTransactions).toHaveBeenCalledWith('budget-123', {
        transactions: [
          expect.objectContaining({ amount: 12340 }),
          expect.objectContaining({ amount: -56780 }),
        ],
      });
    });

    it('should generate consistent import_ids', async () => {
      const transaction: Transaction = {
        date: '2025-01-15',
        payee_name: 'Store',
        amount: -50.0,
        memo: null,
        category_name: null,
      };

      mockYnabAPI.transactions.createTransactions.mockResolvedValue({
        data: {
          transaction_ids: ['tx1'],
          duplicate_import_ids: [],
          transactions: [],
        },
      });

      await uploadTransactions([transaction], mockConfig);

      const calls1 = mockYnabAPI.transactions.createTransactions.mock.calls;
      expect(calls1.length).toBeGreaterThan(0);
      const call1 = calls1[0] as (typeof calls1)[0] & object;
      const importId1 = call1[1].transactions[0].import_id;

      vi.clearAllMocks();
      mockYnabAPI.transactions.createTransactions.mockResolvedValue({
        data: {
          transaction_ids: ['tx1'],
          duplicate_import_ids: [],
          transactions: [],
        },
      });

      await uploadTransactions([transaction], mockConfig);

      const calls2 = mockYnabAPI.transactions.createTransactions.mock.calls;
      expect(calls2.length).toBeGreaterThan(0);
      const call2 = calls2[0] as (typeof calls2)[0] & object;
      const importId2 = call2[1].transactions[0].import_id;

      expect(importId1).toBe(importId2);
      expect(importId1.length).toBeLessThanOrEqual(36);
    });

    it('should generate import_ids in YNAB format', async () => {
      const transaction: Transaction = {
        date: '2025-01-15',
        payee_name: 'Store',
        amount: -50.0,
        memo: 'groceries',
        category_name: null,
      };

      mockYnabAPI.transactions.createTransactions.mockResolvedValue({
        data: {
          transaction_ids: ['tx1'],
          duplicate_import_ids: [],
          transactions: [],
        },
      });

      await uploadTransactions([transaction], mockConfig);

      const calls = mockYnabAPI.transactions.createTransactions.mock.calls;
      const importId = calls[0]![1].transactions[0]!.import_id;

      // Should follow YNAB format: YNAB:[milliunit_amount]:[iso_date]:[occurrence]
      expect(importId).toMatch(/^YNAB:-50000:2025-01-15:\d+$/);
    });

    it('should generate different import_ids for different transactions', async () => {
      const transactions: Transaction[] = [
        {
          date: '2025-01-15',
          payee_name: 'Store A',
          amount: -50.0,
          memo: 'groceries',
          category_name: null,
        },
        {
          date: '2025-01-15',
          payee_name: 'Store B',
          amount: -50.0,
          memo: 'groceries',
          category_name: null,
        },
      ];

      mockYnabAPI.transactions.createTransactions.mockResolvedValue({
        data: {
          transaction_ids: ['tx1', 'tx2'],
          duplicate_import_ids: [],
          transactions: [],
        },
      });

      await uploadTransactions(transactions, mockConfig);

      const calls = mockYnabAPI.transactions.createTransactions.mock.calls;
      const importId1 = calls[0]![1].transactions[0]!.import_id;
      const importId2 = calls[0]![1].transactions[1]!.import_id;

      // Different payees should generate different import_ids
      expect(importId1).not.toBe(importId2);
    });

    it('should generate same import_id for identical transactions across batches', async () => {
      const transaction: Transaction = {
        date: '2025-01-15',
        payee_name: 'Store',
        amount: -50.0,
        memo: 'groceries',
        category_name: null,
      };

      // First batch
      mockYnabAPI.transactions.createTransactions.mockResolvedValue({
        data: {
          transaction_ids: ['tx1'],
          duplicate_import_ids: [],
          transactions: [],
        },
      });

      await uploadTransactions([transaction], mockConfig);
      const calls1 = mockYnabAPI.transactions.createTransactions.mock.calls;
      const importId1 = calls1[0]![1].transactions[0]!.import_id;

      vi.clearAllMocks();

      // Second batch with same transaction
      mockYnabAPI.transactions.createTransactions.mockResolvedValue({
        data: {
          transaction_ids: [],
          duplicate_import_ids: ['dup1'],
          transactions: [],
        },
      });

      await uploadTransactions([transaction], mockConfig);
      const calls2 = mockYnabAPI.transactions.createTransactions.mock.calls;
      const importId2 = calls2[0]![1].transactions[0]!.import_id;

      // Same transaction should have same import_id regardless of batch
      expect(importId1).toBe(importId2);
    });
  });

  describe('listBudgets', () => {
    it('should return list of budgets', async () => {
      mockYnabAPI.budgets.getBudgets.mockResolvedValue({
        data: {
          budgets: [
            { id: 'budget1', name: 'Personal' },
            { id: 'budget2', name: 'Business' },
          ],
        },
      });

      const budgets = await listBudgets('test-token');

      expect(budgets).toHaveLength(2);
      expect(budgets[0]).toMatchObject({ id: 'budget1', name: 'Personal' });
      expect(budgets[1]).toMatchObject({ id: 'budget2', name: 'Business' });
    });
  });

  describe('listAccounts', () => {
    it('should return list of open accounts', async () => {
      mockYnabAPI.accounts.getAccounts.mockResolvedValue({
        data: {
          accounts: [
            { id: 'account1', name: 'Checking', closed: false },
            { id: 'account2', name: 'Savings', closed: false },
            { id: 'account3', name: 'Old Account', closed: true },
          ],
        },
      });

      const accounts = await listAccounts('test-token', 'budget-123');

      expect(accounts).toHaveLength(2);
      expect(accounts[0]).toMatchObject({ id: 'account1', name: 'Checking' });
      expect(accounts[1]).toMatchObject({ id: 'account2', name: 'Savings' });
    });

    it('should filter out closed accounts', async () => {
      mockYnabAPI.accounts.getAccounts.mockResolvedValue({
        data: {
          accounts: [{ id: 'account1', name: 'Closed Account', closed: true }],
        },
      });

      const accounts = await listAccounts('test-token', 'budget-123');

      expect(accounts).toHaveLength(0);
    });
  });
});
