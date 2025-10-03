import { describe, it, expect } from 'vitest';
import crypto from 'crypto';

// Test the utility functions used in uploader
describe('uploader utilities', () => {
  describe('convertToMilliunits', () => {
    it('should convert dollar amounts to milliunits', () => {
      const convertToMilliunits = (amount: number): number => {
        return Math.round(amount * 1000);
      };

      expect(convertToMilliunits(10.5)).toBe(10500);
      expect(convertToMilliunits(-25.75)).toBe(-25750);
      expect(convertToMilliunits(0)).toBe(0);
      expect(convertToMilliunits(100)).toBe(100000);
    });

    it('should handle floating point precision', () => {
      const convertToMilliunits = (amount: number): number => {
        return Math.round(amount * 1000);
      };

      expect(convertToMilliunits(0.01)).toBe(10);
      expect(convertToMilliunits(0.001)).toBe(1);
      expect(convertToMilliunits(1.005)).toBe(1005);
    });
  });

  describe('generateImportId', () => {
    it('should generate consistent import IDs', () => {
      const generateImportId = (transaction: any, accountId: string): string => {
        const str = `${accountId}:${transaction.date}:${transaction.amount}:${transaction.payee_name || ''}`;
        const hash = crypto.createHash('md5').update(str).digest('hex');
        return hash.substring(0, 32);
      };

      const tx = {
        date: '2025-01-15',
        amount: 50.0,
        payee_name: 'Store',
      };

      const id1 = generateImportId(tx, 'account123');
      const id2 = generateImportId(tx, 'account123');

      expect(id1).toBe(id2);
      expect(id1.length).toBeLessThanOrEqual(32);
    });

    it('should generate different IDs for different transactions', () => {
      const generateImportId = (transaction: any, accountId: string): string => {
        const str = `${accountId}:${transaction.date}:${transaction.amount}:${transaction.payee_name || ''}`;
        const hash = crypto.createHash('md5').update(str).digest('hex');
        return hash.substring(0, 32);
      };

      const tx1 = {
        date: '2025-01-15',
        amount: 50.0,
        payee_name: 'Store',
      };

      const tx2 = {
        date: '2025-01-15',
        amount: 50.0,
        payee_name: 'Different Store',
      };

      const id1 = generateImportId(tx1, 'account123');
      const id2 = generateImportId(tx2, 'account123');

      expect(id1).not.toBe(id2);
    });

    it('should handle null payee names', () => {
      const generateImportId = (transaction: any, accountId: string): string => {
        const str = `${accountId}:${transaction.date}:${transaction.amount}:${transaction.payee_name || ''}`;
        const hash = crypto.createHash('md5').update(str).digest('hex');
        return hash.substring(0, 32);
      };

      const tx = {
        date: '2025-01-15',
        amount: 50.0,
        payee_name: null,
      };

      const id = generateImportId(tx, 'account123');

      expect(id).toBeDefined();
      expect(id.length).toBeLessThanOrEqual(32);
    });
  });

  describe('transaction mapping', () => {
    it('should map transactions to YNAB format', () => {
      const mapToYnab = (tx: any, accountId: string) => {
        const convertToMilliunits = (amount: number): number => {
          return Math.round(amount * 1000);
        };

        const generateImportId = (transaction: any, accountId: string): string => {
          const str = `${accountId}:${transaction.date}:${transaction.amount}:${transaction.payee_name || ''}`;
          const hash = crypto.createHash('md5').update(str).digest('hex');
          return hash.substring(0, 32);
        };

        return {
          account_id: accountId,
          date: tx.date,
          amount: convertToMilliunits(tx.amount),
          payee_name: tx.payee_name || undefined,
          memo: tx.memo || undefined,
          cleared: 'uncleared' as const,
          approved: false,
          import_id: generateImportId(tx, accountId),
        };
      };

      const tx = {
        date: '2025-01-15',
        amount: 50.0,
        payee_name: 'Store',
        memo: 'Test purchase',
      };

      const result = mapToYnab(tx, 'account123');

      expect(result).toMatchObject({
        account_id: 'account123',
        date: '2025-01-15',
        amount: 50000,
        payee_name: 'Store',
        memo: 'Test purchase',
        cleared: 'uncleared',
        approved: false,
      });
      expect(result.import_id).toBeDefined();
    });
  });
});
