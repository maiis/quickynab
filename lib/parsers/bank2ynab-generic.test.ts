import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parseBank2YnabCSV } from './bank2ynab-generic.js';

describe('bank2ynab-generic', () => {
  let tmpDir: string;
  let testFile: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ynab-test-'));
  });

  afterEach(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  describe('parseBank2YnabCSV', () => {
    it('should parse CSV with semicolon delimiter', () => {
      const csvContent = `"Date";"Amount";"Description"
"2025-01-15";"-50.00";"Coffee Shop"
"2025-01-16";"100.00";"Salary"`;

      testFile = path.join(tmpDir, 'test.csv');
      fs.writeFileSync(testFile, csvContent);

      const config = {
        pattern: 'test',
        delimiter: ';',
        headerRows: 1,
        columns: ['Date', 'Amount', 'Payee'],
        dateFormat: '%Y-%m-%d',
      };

      const result = parseBank2YnabCSV(testFile, config);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        date: '2025-01-15',
        payee_name: 'Coffee Shop',
        category_name: null,
        memo: null,
        amount: -50.0,
      });
      expect(result[1]).toEqual({
        date: '2025-01-16',
        payee_name: 'Salary',
        category_name: null,
        memo: null,
        amount: 100.0,
      });
    });

    it('should handle Inflow/Outflow columns', () => {
      const csvContent = `Date,Payee,Inflow,Outflow
2025-01-15,Store,0,25.50
2025-01-16,Employer,1500.00,0`;

      testFile = path.join(tmpDir, 'test.csv');
      fs.writeFileSync(testFile, csvContent);

      const config = {
        pattern: 'test',
        delimiter: ',',
        headerRows: 1,
        columns: ['Date', 'Payee', 'Inflow', 'Outflow'],
        dateFormat: '%Y-%m-%d',
      };

      const result = parseBank2YnabCSV(testFile, config);

      expect(result).toHaveLength(2);
      expect(result[0]?.amount).toBe(-25.5);
      expect(result[1]?.amount).toBe(1500.0);
    });

    it('should skip columns marked as "skip"', () => {
      const csvContent = `Date,SkipMe,Amount,AlsoSkip,Payee
2025-01-15,ignore,50.00,ignore,Store`;

      testFile = path.join(tmpDir, 'test.csv');
      fs.writeFileSync(testFile, csvContent);

      const config = {
        pattern: 'test',
        delimiter: ',',
        headerRows: 1,
        columns: ['Date', 'skip', 'Amount', 'skip', 'Payee'],
        dateFormat: '%Y-%m-%d',
      };

      const result = parseBank2YnabCSV(testFile, config);

      expect(result).toHaveLength(1);
      expect(result[0]?.payee_name).toBe('Store');
      expect(result[0]?.amount).toBe(50.0);
    });

    it('should handle header and footer rows', () => {
      const csvContent = `Account Statement
2025-01-15,50.00,Store
Total: 50.00`;

      testFile = path.join(tmpDir, 'test.csv');
      fs.writeFileSync(testFile, csvContent);

      const config = {
        pattern: 'test',
        delimiter: ',',
        headerRows: 1, // Skip "Account Statement"
        footerRows: 1, // Skip "Total: 50.00"
        columns: ['Date', 'Amount', 'Payee'],
        dateFormat: '%Y-%m-%d',
      };

      const result = parseBank2YnabCSV(testFile, config);

      expect(result).toHaveLength(1);
      expect(result[0]?.payee_name).toBe('Store');
    });

    it('should sanitize long strings', () => {
      const longPayee = 'A'.repeat(250);
      const csvContent = `Date,Payee,Amount
2025-01-15,${longPayee},50.00`;

      testFile = path.join(tmpDir, 'test.csv');
      fs.writeFileSync(testFile, csvContent);

      const config = {
        pattern: 'test',
        delimiter: ',',
        headerRows: 1,
        columns: ['Date', 'Payee', 'Amount'],
        dateFormat: '%Y-%m-%d',
      };

      const result = parseBank2YnabCSV(testFile, config);

      expect(result).toHaveLength(1);
      expect(result[0]?.payee_name?.length).toBeLessThanOrEqual(200);
    });

    it('should handle Neon bank format', () => {
      const csvContent = `"Date";"Amount";"Original amount";"Original currency";"Exchange rate";"Description";"Subject";"Category";"Tags";"Wise";"Spaces"
"2025-09-29";"-80.00";"";"";"";"TWINT *Sent to L.V.";;"uncategorized";"";"no";"no"
"2025-09-26";"4536.80";"";"";"";"Hopital du Valais";"Paiement Salaire";"income_salary";"";"no";"no"`;

      testFile = path.join(tmpDir, 'neon.csv');
      fs.writeFileSync(testFile, csvContent);

      const config = {
        pattern: 'neon',
        delimiter: ';',
        headerRows: 1,
        columns: [
          'Date',
          'Amount',
          'skip',
          'skip',
          'skip',
          'Payee',
          'Memo',
          'skip',
          'skip',
          'skip',
          'skip',
        ],
        dateFormat: '%Y-%m-%d',
      };

      const result = parseBank2YnabCSV(testFile, config);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        date: '2025-09-29',
        payee_name: 'TWINT *Sent to L.V.',
        category_name: null,
        memo: null,
        amount: -80.0,
      });
      expect(result[1]).toEqual({
        date: '2025-09-26',
        payee_name: 'Hopital du Valais',
        category_name: null,
        memo: 'Paiement Salaire',
        amount: 4536.8,
      });
    });
  });
});
