import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { parseBank2YnabCSV } from './parsers/bank2ynab-generic.js';
import { getBank2YnabConfigs, findMatchingConfig } from './parsers/bank2ynab-fetcher.js';
import type { Transaction } from './uploader.js';

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
  });

  return records.map((row: any, index: number) => {
    const outflow = parseAmount(row.Outflow);
    const inflow = parseAmount(row.Inflow);

    // Calculate amount (inflow is positive, outflow is negative)
    const amount = inflow - outflow;

    if (!row.Date) {
      throw new Error(`Row ${index + 1}: Date is required`);
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
function parseAmount(amountStr: any): number {
  if (!amountStr || amountStr === '' || amountStr === '0') {
    return 0;
  }

  // Remove currency symbols, commas, and whitespace
  const cleaned = amountStr.toString().replace(/[^0-9.-]/g, '');
  const amount = parseFloat(cleaned);

  if (isNaN(amount)) {
    return 0;
  }

  return amount;
}

/**
 * Validates that the CSV has a supported format
 */
export function validateCSV(filePath: string): boolean {
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const firstLine = fileContent.split('\n')[0].toLowerCase();

  const requiredColumns = ['date'];
  const hasRequiredColumns = requiredColumns.every((col) => firstLine.includes(col));

  if (!hasRequiredColumns) {
    throw new Error('Invalid CSV format. Missing Date column. ' + 'Headers found: ' + firstLine);
  }

  return true;
}
