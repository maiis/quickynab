import { describe, expect, it } from 'vitest';
import { findMatchingConfig } from './bank2ynab-fetcher.js';

describe('bank2ynab-fetcher', () => {
  describe('findMatchingConfig', () => {
    it('should match with regex pattern', () => {
      const configs = {
        'Test Bank': {
          name: 'Test Bank',
          pattern: '^test_\\d{4}\\.csv$',
          useRegex: true,
          delimiter: ',',
          headerRows: 1,
          columns: ['Date', 'Payee', 'Amount'],
        },
      };

      const result = findMatchingConfig('test_2024.csv', configs);
      expect(result).toBeDefined();
      expect(result?.name).toBe('Test Bank');
    });

    it('should match with simple string pattern', () => {
      const configs = {
        'Simple Bank': {
          name: 'Simple Bank',
          pattern: 'transactions',
          useRegex: false,
          delimiter: ',',
          headerRows: 1,
          columns: ['Date', 'Amount'],
        },
      };

      const result = findMatchingConfig('my_transactions_export.csv', configs);
      expect(result).toBeDefined();
      expect(result?.name).toBe('Simple Bank');
    });

    it('should return null when no match found', () => {
      const configs = {
        'Test Bank': {
          name: 'Test Bank',
          pattern: 'specific_pattern',
          useRegex: false,
          delimiter: ',',
          headerRows: 1,
          columns: ['Date'],
        },
      };

      const result = findMatchingConfig('unmatched_file.csv', configs);
      expect(result).toBeNull();
    });

    it('should handle invalid regex gracefully', () => {
      const configs = {
        'Bad Regex Bank': {
          name: 'Bad Regex Bank',
          pattern: '[invalid(regex',
          useRegex: true,
          delimiter: ',',
          headerRows: 1,
          columns: ['Date'],
        },
      };

      const result = findMatchingConfig('any_file.csv', configs);
      expect(result).toBeNull();
    });

    it('should match Neon bank format', () => {
      const configs = {
        'CH Neon Monthly': {
          name: 'CH Neon Monthly',
          pattern: '^\\d{4}_\\d{1,2}_account_statements',
          useRegex: true,
          delimiter: ';',
          headerRows: 1,
          columns: ['Date', 'Amount', 'skip', 'skip', 'skip', 'Payee', 'Memo'],
        },
      };

      expect(findMatchingConfig('2025_9_account_statements.csv', configs)).toBeDefined();
      expect(findMatchingConfig('2025_09_account_statements.csv', configs)).toBeDefined();
      expect(findMatchingConfig('2024_12_account_statements30092025.csv', configs)).toBeDefined();
    });
  });
});
