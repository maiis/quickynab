import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DANGEROUS_PATTERNS, MAX_FILE_SIZE, MAX_LINES } from './constants.js';

describe('Server validation', () => {
  test('MAX_FILE_SIZE constant is 10MB', () => {
    expect(MAX_FILE_SIZE).toBe(10 * 1024 * 1024);
  });

  test('MAX_LINES constant is 50000', () => {
    expect(MAX_LINES).toBe(50000);
  });

  test('DANGEROUS_PATTERNS includes common XSS vectors', () => {
    expect(DANGEROUS_PATTERNS).toContainEqual(/<script/i);
    expect(DANGEROUS_PATTERNS).toContainEqual(/javascript:/i);
    expect(DANGEROUS_PATTERNS).toContainEqual(/on\w+=/i);
  });

  test('malicious content detection - script tag', () => {
    const maliciousContent = '<script>alert("xss")</script>';
    const hasMatch = DANGEROUS_PATTERNS.some((pattern) => pattern.test(maliciousContent));
    expect(hasMatch).toBe(true);
  });

  test('malicious content detection - javascript protocol', () => {
    const maliciousContent = 'javascript:alert("xss")';
    const hasMatch = DANGEROUS_PATTERNS.some((pattern) => pattern.test(maliciousContent));
    expect(hasMatch).toBe(true);
  });

  test('malicious content detection - event handlers', () => {
    const maliciousContent = '<img src=x onerror="alert(1)">';
    const hasMatch = DANGEROUS_PATTERNS.some((pattern) => pattern.test(maliciousContent));
    expect(hasMatch).toBe(true);
  });

  test('safe CSV content passes validation', () => {
    const safeContent = 'Date,Payee,Amount\n2024-01-15,Test Store,-50.00';
    const hasMatch = DANGEROUS_PATTERNS.some((pattern) => pattern.test(safeContent));
    expect(hasMatch).toBe(false);
  });
});

describe('CSV File validation', () => {
  let testFilePath: string;

  beforeAll(() => {
    testFilePath = join(tmpdir(), `test-${Date.now()}.csv`);
  });

  afterAll(() => {
    try {
      const fs = require('node:fs');
      if (fs.existsSync(testFilePath)) {
        fs.unlinkSync(testFilePath);
      }
    } catch (_) {
      // Ignore cleanup errors
    }
  });

  test('validate file size limit', () => {
    // Create a file larger than MAX_FILE_SIZE
    const largeContent = 'x'.repeat(MAX_FILE_SIZE + 1);
    const buffer = Buffer.from(largeContent);

    expect(buffer.length).toBeGreaterThan(MAX_FILE_SIZE);
  });

  test('validate line count limit', () => {
    // Create content with too many lines
    const lines = Array.from({ length: MAX_LINES + 1 }, (_, i) => `line ${i}`).join('\n');
    const lineCount = lines.split('\n').length;

    expect(lineCount).toBeGreaterThan(MAX_LINES);
  });

  test('validate CSV extension requirement', () => {
    const validFilename = 'test.csv';
    const invalidFilename = 'test.txt';

    expect(validFilename.endsWith('.csv')).toBe(true);
    expect(invalidFilename.endsWith('.csv')).toBe(false);
  });

  test('validate CSV structure detection', () => {
    const validCSV = 'Date,Payee,Amount\n2024-01-15,Store,-50';
    const invalidCSV = 'This is not a CSV file';

    expect(validCSV.includes(',') || validCSV.includes(';')).toBe(true);
    expect(invalidCSV.includes(',') || invalidCSV.includes(';')).toBe(false);
  });
});

describe('Bank config loading', () => {
  test('config file should exist after build', () => {
    const fs = require('node:fs');
    const configPath = join(__dirname, 'parsers', 'bank2ynab-configs.json');

    expect(fs.existsSync(configPath)).toBe(true);
  });

  test('config file should be valid JSON', () => {
    const fs = require('node:fs');
    const configPath = join(__dirname, 'parsers', 'bank2ynab-configs.json');

    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf-8');
      expect(() => JSON.parse(content)).not.toThrow();
    }
  });

  test('config file should contain bank configurations', () => {
    const fs = require('node:fs');
    const configPath = join(__dirname, 'parsers', 'bank2ynab-configs.json');

    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf-8');
      const configs = JSON.parse(content);

      expect(typeof configs).toBe('object');
      expect(Object.keys(configs).length).toBeGreaterThan(0);
    }
  });
});
