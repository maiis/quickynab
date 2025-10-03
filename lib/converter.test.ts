import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parseCSV, validateCSV } from './converter.js';
import { CsvParseError } from './errors.js';

describe('converter', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'quickynab-test-'));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  });

  describe('parseCSV', () => {
    it('should parse YNAB format CSV', () => {
      const csvContent = `Date,Payee,Category,Memo,Outflow,Inflow
2025-01-15,Store A,Groceries,Weekly shopping,50.00,0
2025-01-16,Salary,,Monthly salary,0,3000.00
2025-01-17,Restaurant,Dining Out,,25.50,0`;

      const filePath = path.join(tempDir, 'ynab-test-file.csv');
      fs.writeFileSync(filePath, csvContent);

      const transactions = parseCSV(filePath);

      expect(transactions).toHaveLength(3);
      expect(transactions[0]).toMatchObject({
        date: '2025-01-15',
        payee_name: 'Store A',
        category_name: 'Groceries',
        memo: 'Weekly shopping',
        amount: -50.0,
      });
      expect(transactions[1]).toMatchObject({
        date: '2025-01-16',
        payee_name: 'Salary',
        amount: 3000.0,
      });
      expect(transactions[2]).toMatchObject({
        date: '2025-01-17',
        payee_name: 'Restaurant',
        amount: -25.5,
      });
    });

    it('should handle empty optional fields', () => {
      const csvContent = `Date,Payee,Category,Memo,Outflow,Inflow
2025-01-15,,,,10.00,0`;

      const filePath = path.join(tempDir, 'ynab-empty-fields.csv');
      fs.writeFileSync(filePath, csvContent);

      const transactions = parseCSV(filePath);

      expect(transactions).toHaveLength(1);
      expect(transactions[0]).toMatchObject({
        date: '2025-01-15',
        payee_name: null,
        category_name: null,
        memo: null,
        amount: -10.0,
      });
    });

    it('should handle amounts with currency symbols and commas', () => {
      const csvContent = `Date,Payee,Category,Memo,Outflow,Inflow
2025-01-15,Store,,,"$1,234.56",0
2025-01-16,Bank,,,0,"€2,500.00"`;

      const filePath = path.join(tempDir, 'ynab-currency-test.csv');
      fs.writeFileSync(filePath, csvContent);

      const transactions = parseCSV(filePath);

      expect(transactions[0]?.amount).toBe(-1234.56);
      expect(transactions[1]?.amount).toBe(2500.0);
    });

    it('should handle zero amounts correctly', () => {
      const csvContent = `Date,Payee,Category,Memo,Outflow,Inflow
2025-01-15,Transfer,,,0,0
2025-01-16,Store,,,0.00,0.00`;

      const filePath = path.join(tempDir, 'ynab-zero-amounts.csv');
      fs.writeFileSync(filePath, csvContent);

      const transactions = parseCSV(filePath);

      expect(transactions[0]?.amount).toBe(0);
      expect(transactions[1]?.amount).toBe(0);
    });

    it('should throw error for missing date', () => {
      const csvContent = `Date,Payee,Category,Memo,Outflow,Inflow
,Store A,Groceries,,50.00,0`;

      const filePath = path.join(tempDir, 'ynab-no-date.csv');
      fs.writeFileSync(filePath, csvContent);

      expect(() => parseCSV(filePath)).toThrow(CsvParseError);
      expect(() => parseCSV(filePath)).toThrow('Date is required');
    });

    it('should throw error for empty CSV', () => {
      const csvContent = `Date,Payee,Category,Memo,Outflow,Inflow`;

      const filePath = path.join(tempDir, 'ynab-empty.csv');
      fs.writeFileSync(filePath, csvContent);

      expect(() => parseCSV(filePath)).toThrow(CsvParseError);
      expect(() => parseCSV(filePath)).toThrow('CSV file contains no data rows');
    });

    it('should extract original filename from temp file name', () => {
      const csvContent = `Date,Payee,Category,Memo,Outflow,Inflow
2025-01-15,Store,,,10.00,0`;

      // Simulate temp file from web upload
      const filePath = path.join(tempDir, 'ynab-abc123def456-mybank.csv');
      fs.writeFileSync(filePath, csvContent);

      const transactions = parseCSV(filePath);
      expect(transactions).toHaveLength(1);
    });

    it('should use originalFilename parameter when provided', () => {
      const csvContent = `Date,Payee,Category,Memo,Outflow,Inflow
2025-01-15,Store,,,10.00,0`;

      const filePath = path.join(tempDir, 'temp-file.csv');
      fs.writeFileSync(filePath, csvContent);

      // Pass original filename explicitly
      const transactions = parseCSV(filePath, 'original-bank-statement.csv');
      expect(transactions).toHaveLength(1);
    });

    it('should handle inflow and outflow in same transaction', () => {
      const csvContent = `Date,Payee,Category,Memo,Outflow,Inflow
2025-01-15,Mixed,,,10.00,5.00`;

      const filePath = path.join(tempDir, 'ynab-mixed-flow.csv');
      fs.writeFileSync(filePath, csvContent);

      const transactions = parseCSV(filePath);

      // Amount should be inflow - outflow = 5 - 10 = -5
      expect(transactions[0]?.amount).toBe(-5.0);
    });

    it('should handle negative amounts', () => {
      const csvContent = `Date,Payee,Category,Memo,Outflow,Inflow
2025-01-15,Store,,,-50.00,0`;

      const filePath = path.join(tempDir, 'ynab-negative.csv');
      fs.writeFileSync(filePath, csvContent);

      const transactions = parseCSV(filePath);

      // Negative outflow becomes positive amount
      expect(transactions[0]?.amount).toBe(50.0);
    });
  });

  describe('validateCSV', () => {
    it('should validate valid CSV with Date column', () => {
      const csvContent = `Date,Payee,Amount
2025-01-15,Store,10.00`;

      const filePath = path.join(tempDir, 'valid.csv');
      fs.writeFileSync(filePath, csvContent);

      expect(() => validateCSV(filePath)).not.toThrow();
    });

    it('should throw error for CSV without Date column', () => {
      const csvContent = `Payee,Amount
Store,10.00`;

      const filePath = path.join(tempDir, 'invalid.csv');
      fs.writeFileSync(filePath, csvContent);

      expect(() => validateCSV(filePath)).toThrow(CsvParseError);
      expect(() => validateCSV(filePath)).toThrow('Missing Date column');
    });

    it('should throw error for empty CSV file', () => {
      const filePath = path.join(tempDir, 'empty.csv');
      fs.writeFileSync(filePath, '');

      expect(() => validateCSV(filePath)).toThrow(CsvParseError);
      expect(() => validateCSV(filePath)).toThrow('CSV file has no header line');
    });

    it('should be case-insensitive for column names', () => {
      const csvContent = `DATE,PAYEE,AMOUNT
2025-01-15,Store,10.00`;

      const filePath = path.join(tempDir, 'uppercase.csv');
      fs.writeFileSync(filePath, csvContent);

      expect(() => validateCSV(filePath)).not.toThrow();
    });
  });
});
