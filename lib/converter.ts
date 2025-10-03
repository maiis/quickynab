import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'csv-parse/sync';
import { CsvParseError } from './errors.js';
import { findMatchingConfig, getBank2YnabConfigs } from './parsers/bank2ynab-fetcher.js';
import { parseBank2YnabCSV } from './parsers/bank2ynab-generic.js';
import type { CsvRecord, Transaction } from './types.js';

export function parseCSV(filePath: string, originalFilename?: string): Transaction[] {
  // Use original filename if provided (from web upload), otherwise use basename
  let filename = path.basename(filePath);

  // If filename starts with 'ynab-' (temp file), try to extract original name
  if (filename.startsWith('ynab-') && filename.includes('-')) {
    // Format: ynab-{random}-{originalFilename}
    const parts = filename.split('-');
    if (parts.length >= 3) {
      // Join everything after the second dash (the random hash)
      filename = parts.slice(2).join('-');
    }
  }

  // Override with explicit originalFilename if provided
  if (originalFilename) {
    filename = originalFilename;
  }

  // Use bank2ynab configs (110+ bank formats, bundled at build time)
  const bank2ynabConfigs = getBank2YnabConfigs();
  const matchedConfig = findMatchingConfig(filename, bank2ynabConfigs);

  if (matchedConfig) {
    console.log(`Detected ${matchedConfig.name} format`);
    return parseBank2YnabCSV(filePath, matchedConfig);
  }

  console.log('Using YNAB format');
  return parseYnabCSV(filePath);
}

/**
 * Parses a YNAB-formatted CSV file
 * Expected format: Date,Payee,Category,Memo,Outflow,Inflow
 */
function parseYnabCSV(filePath: string): Transaction[] {
  const fileContent = fs.readFileSync(filePath, 'utf-8');

  const records = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as CsvRecord[];

  if (!Array.isArray(records) || records.length === 0) {
    throw new CsvParseError('CSV file contains no data rows');
  }

  return records.map((row, index) => {
    const outflow = parseAmount(row.Outflow);
    const inflow = parseAmount(row.Inflow);

    // Calculate amount (inflow is positive, outflow is negative)
    const amount = inflow - outflow;

    if (!row.Date) {
      throw new CsvParseError(`Date is required`, index + 2); // +2 because line 1 is header
    }

    return {
      date: row.Date,
      payee_name: row.Payee || null,
      category_name: row.Category || null,
      memo: row.Memo || null,
      amount: amount,
    };
  });
}

/**
 * Parses an amount string and returns a number
 */
function parseAmount(amountStr: string | undefined): number {
  if (!amountStr || amountStr === '' || amountStr === '0') {
    return 0;
  }

  // Remove currency symbols, commas, and whitespace
  const cleaned = amountStr.replace(/[^0-9.-]/g, '');
  const amount = parseFloat(cleaned);

  if (Number.isNaN(amount)) {
    return 0;
  }

  return amount;
}

/**
 * Validates that the CSV has a supported format
 */
export function validateCSV(filePath: string): void {
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const lines = fileContent.split('\n');

  if (lines.length === 0) {
    throw new CsvParseError('CSV file is empty', 1);
  }

  const firstLine = lines[0]?.toLowerCase();

  const requiredColumns = ['date'];
  const hasRequiredColumns = requiredColumns.every((col) => firstLine.includes(col));

  if (!hasRequiredColumns) {
    throw new CsvParseError(
      `Invalid CSV format. Missing Date column. Headers found: ${firstLine}`,
      1
    );
  }
}
