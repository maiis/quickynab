import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'csv-parse/sync';
import { CsvParseError } from './errors.js';
import { getLogger } from './logger.js';
import { findMatchingConfig, getBank2YnabConfigs } from './parsers/bank2ynab-fetcher.js';
import { parseBank2YnabCSV } from './parsers/bank2ynab-generic.js';
import type { CsvRecord, Transaction } from './types.js';

export function parseCSV(filePath: string, originalFilename?: string): Transaction[] {
  // The web app passes the original filename explicitly (its temp-file names
  // would break bank detection patterns); otherwise use the file's basename.
  const filename = originalFilename || path.basename(filePath);

  // Use bank2ynab configs (110+ bank formats, bundled at build time)
  const bank2ynabConfigs = getBank2YnabConfigs();
  const matchedConfig = findMatchingConfig(filename, bank2ynabConfigs);

  if (matchedConfig) {
    getLogger().info(`Detected ${matchedConfig.name} format`);
    return parseBank2YnabCSV(filePath, matchedConfig);
  }

  getLogger().info('Using YNAB format');
  return parseYnabCSV(filePath);
}

/**
 * Detects the delimiter used in a CSV file by comparing
 * semicolons vs commas in the first line.
 */
function detectDelimiter(content: string): string {
  const firstLine = content.split('\n')[0] || '';
  const semicolons = (firstLine.match(/;/g) || []).length;
  const commas = (firstLine.match(/,/g) || []).length;
  return semicolons > commas ? ';' : ',';
}

/**
 * Parses an amount string and returns a number.
 * Shared by both parsers: strips currency symbols, thousand separators
 * ('  , and spaces) and whitespace before parsing.
 */
export function parseAmount(amountStr: string | undefined): number {
  if (!amountStr || amountStr === '') {
    return 0;
  }

  // Keep digits, minus and the last dot or comma as the decimal separator
  const cleaned = amountStr.replace(/[^\d.,\-']/g, '').replace(/'/g, '');
  const lastDot = cleaned.lastIndexOf('.');
  const lastComma = cleaned.lastIndexOf(',');
  const decimalSep = lastDot >= lastComma ? '.' : ',';
  const normalized =
    lastDot >= 0 || lastComma >= 0
      ? cleaned.slice(0, Math.max(lastDot, lastComma)).replace(/[.,]/g, '') +
        decimalSep +
        cleaned.slice(Math.max(lastDot, lastComma) + 1)
      : cleaned;

  const amount = parseFloat(normalized.replace(',', '.'));
  if (Number.isNaN(amount)) {
    return 0;
  }

  return amount;
}

/**
 * Parses a YNAB-formatted CSV file
 * Expected format: Date,Payee,Category,Memo,Outflow,Inflow
 */
function parseYnabCSV(filePath: string): Transaction[] {
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const delimiter = detectDelimiter(fileContent);

  const records = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    delimiter,
    relax_quotes: true,
    relax_column_count: true,
  }) as CsvRecord[];

  if (!Array.isArray(records) || records.length === 0) {
    throw new CsvParseError('CSV file contains no data rows');
  }

  return records.map((row, index) => {
    const outflow = parseYnabAmount(row.Outflow);
    const inflow = parseYnabAmount(row.Inflow);

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
function parseYnabAmount(amountStr: string | undefined): number {
  return parseAmount(amountStr);
}

/**
 * Validates that the CSV has a supported format
 *
 * shortcut: only checks the generic YNAB format header; bank formats are
 * detected by parseCSV and have their own headers, so this is not used
 * on the bank path.
 */
export function validateCSV(filePath: string): void {
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const lines = fileContent.split('\n');

  if (lines.length === 0) {
    throw new CsvParseError('CSV file is empty', 1);
  }

  const firstLine = lines[0]?.toLowerCase();

  if (!firstLine) {
    throw new CsvParseError('CSV file has no header line', 1);
  }

  const requiredColumns = ['date'];
  const hasRequiredColumns = requiredColumns.every((col) => firstLine.includes(col));

  if (!hasRequiredColumns) {
    throw new CsvParseError(
      `Invalid CSV format. Missing Date column. Headers found: ${firstLine}`,
      1
    );
  }
}
