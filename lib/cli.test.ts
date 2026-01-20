import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseCSV } from './converter.js';

describe('CLI Integration Tests', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(os.tmpdir(), 'cli-test-'));
  });

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true });
    }
  });

  describe('parseCSV', () => {
    test('should parse CSV file and return transactions', () => {
      const csvContent = `Date,Payee,Category,Memo,Outflow,Inflow
2024-01-15,Test Store,Groceries,Test transaction,50.00,0`;

      const filePath = path.join(tempDir, 'test-cli-import.csv');
      writeFileSync(filePath, csvContent);

      const transactions = parseCSV(filePath);

      expect(transactions).toBeArray();
      expect(transactions.length).toBeGreaterThan(0);
      expect(transactions[0]).toHaveProperty('date');
      expect(transactions[0]).toHaveProperty('payee_name');
      expect(transactions[0]).toHaveProperty('amount');
      expect(transactions[0]?.date).toBe('2024-01-15');
      expect(transactions[0]?.payee_name).toBe('Test Store');
      expect(transactions[0]?.amount).toBe(-50.0);
    });

    test('should handle multiple transactions', () => {
      const csvContent = `Date,Payee,Category,Memo,Outflow,Inflow
2024-01-15,Store A,Groceries,,50.00,0
2024-01-16,Store B,Dining,,25.00,0
2024-01-17,Employer,Income,,0,3000.00`;

      const filePath = path.join(tempDir, 'test-cli-multiple.csv');
      writeFileSync(filePath, csvContent);

      const transactions = parseCSV(filePath);

      expect(transactions).toHaveLength(3);
      expect(transactions[0]?.amount).toBe(-50.0);
      expect(transactions[1]?.amount).toBe(-25.0);
      expect(transactions[2]?.amount).toBe(3000.0);
    });

    test('should parse CSV with inflow transactions', () => {
      const csvContent = `Date,Payee,Category,Memo,Outflow,Inflow
2024-01-15,Salary,Income,Monthly salary,0,3000.00`;

      const filePath = path.join(tempDir, 'test-cli-inflow.csv');
      writeFileSync(filePath, csvContent);

      const transactions = parseCSV(filePath);

      expect(transactions).toHaveLength(1);
      expect(transactions[0]?.payee_name).toBe('Salary');
      expect(transactions[0]?.amount).toBe(3000.0);
    });

    test('should handle CSV with outflow transactions', () => {
      const csvContent = `Date,Payee,Category,Memo,Outflow,Inflow
2024-01-15,Restaurant,Dining,Dinner,75.50,0`;

      const filePath = path.join(tempDir, 'test-cli-outflow.csv');
      writeFileSync(filePath, csvContent);

      const transactions = parseCSV(filePath);

      expect(transactions).toHaveLength(1);
      expect(transactions[0]?.payee_name).toBe('Restaurant');
      expect(transactions[0]?.amount).toBe(-75.5);
    });

    test('should handle CSV with optional fields', () => {
      const csvContent = `Date,Payee,Category,Memo,Outflow,Inflow
2024-01-15,Store,,,50.00,0`;

      const filePath = path.join(tempDir, 'test-cli-optional.csv');
      writeFileSync(filePath, csvContent);

      const transactions = parseCSV(filePath);

      expect(transactions).toHaveLength(1);
      expect(transactions[0]?.payee_name).toBe('Store');
      expect(transactions[0]?.category_name).toBeNull();
      expect(transactions[0]?.memo).toBeNull();
    });

    test('should handle empty file', () => {
      const csvContent = `Date,Payee,Category,Memo,Outflow,Inflow`;

      const filePath = path.join(tempDir, 'test-cli-empty-file.csv');
      writeFileSync(filePath, csvContent);

      expect(() => parseCSV(filePath)).toThrow();
    });

    test('should throw error for non-existent file', () => {
      const filePath = path.join(tempDir, 'non-existent.csv');

      expect(() => parseCSV(filePath)).toThrow();
    });

    test('should handle CSV with decimal amounts', () => {
      const csvContent = `Date,Payee,Category,Memo,Outflow,Inflow
2024-01-15,Store,Groceries,,12.34,0`;

      const filePath = path.join(tempDir, 'test-cli-decimal.csv');
      writeFileSync(filePath, csvContent);

      const transactions = parseCSV(filePath);

      expect(transactions).toHaveLength(1);
      expect(transactions[0]?.amount).toBe(-12.34);
    });
  });
});
