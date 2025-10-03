import fs from 'fs';
import { parse } from 'csv-parse/sync';

interface Transaction {
  date: string;
  payee_name: string | null;
  category_name: string | null;
  memo: string | null;
  amount: number;
}

interface BankConfig {
  pattern: string;
  headerRows?: number;
  footerRows?: number;
  delimiter?: string;
  dateFormat?: string;
  columns?: string[];
  [key: string]: any;
}

interface RawTransaction {
  Date?: string;
  Payee?: string;
  Description?: string;
  Memo?: string;
  Subject?: string;
  Inflow?: string;
  Outflow?: string;
  Amount?: string;
  [key: string]: any;
}

function sanitizeString(str: string | null | undefined, maxLength = 200): string | null {
  if (!str) return null;

  let cleaned = str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  cleaned = cleaned.trim();

  if (cleaned.length > maxLength) {
    cleaned = cleaned.substring(0, maxLength);
  }

  return cleaned || null;
}

export function parseBank2YnabCSV(filePath: string, bankConfig: BankConfig): Transaction[] {
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const lines = fileContent.split('\n');

  const headerRows = bankConfig.headerRows || 0;
  const footerRows = bankConfig.footerRows || 0;
  const dataLines = lines.slice(headerRows, footerRows > 0 ? -footerRows : undefined);

  const records = parse(dataLines.join('\n'), {
    columns: false,
    skip_empty_lines: true,
    trim: true,
    delimiter: bankConfig.delimiter || ',',
    quote: '"',
    escape: '"',
    relax_column_count: true,
  }) as string[][];

  const columnMapping = bankConfig.columns || [];

  return records
    .map((row, index) => {
      try {
        const transaction: RawTransaction = {};

        columnMapping.forEach((field, colIndex) => {
          if (field && field !== 'skip' && row[colIndex] !== undefined) {
            transaction[field] = row[colIndex];
          }
        });

        let amount = 0;
        if (transaction.Inflow || transaction.Outflow) {
          const inflow = parseFloat(transaction.Inflow || '0') || 0;
          const outflow = parseFloat(transaction.Outflow || '0') || 0;
          amount = inflow - outflow;
        } else if (transaction.Amount) {
          amount = parseFloat(transaction.Amount) || 0;
        }

        const date = parseDate(transaction.Date || '', bankConfig.dateFormat);

        return {
          date,
          payee_name: sanitizeString(transaction.Payee || transaction.Description || null),
          category_name: null,
          memo: sanitizeString(transaction.Memo || transaction.Subject || null, 100),
          amount,
        } as Transaction;
      } catch (error) {
        console.error(`Error parsing row ${index + 1}:`, (error as Error).message);
        return null;
      }
    })
    .filter((t): t is Transaction => t !== null && t.date !== '');
}

function parseDate(dateStr: string, formatStr?: string): string {
  if (!dateStr) return '';

  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }

  if (!formatStr) {
    return autoDetectDate(dateStr);
  }

  const formats: Record<string, RegExp> = {
    '%Y-%m-%d': /^(\d{4})-(\d{2})-(\d{2})$/,
    '%d.%m.%Y': /^(\d{2})\.(\d{2})\.(\d{4})$/,
    '%d/%m/%Y': /^(\d{2})\/(\d{2})\/(\d{4})$/,
    '%m/%d/%Y': /^(\d{2})\/(\d{2})\/(\d{4})$/,
    '%Y%m%d': /^(\d{4})(\d{2})(\d{2})$/,
  };

  const regex = formats[formatStr];
  if (regex) {
    const match = dateStr.match(regex);
    if (match) {
      if (formatStr === '%Y-%m-%d' || formatStr === '%Y%m%d') {
        return `${match[1]}-${match[2]}-${match[3]}`;
      } else if (formatStr === '%d.%m.%Y' || formatStr === '%d/%m/%Y') {
        return `${match[3]}-${match[2]}-${match[1]}`;
      } else if (formatStr === '%m/%d/%Y') {
        return `${match[3]}-${match[1]}-${match[2]}`;
      }
    }
  }

  return autoDetectDate(dateStr);
}

function autoDetectDate(dateStr: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }

  const ddmmyyyy = dateStr.match(/^(\d{2})[\.\/](\d{2})[\.\/](\d{4})$/);
  if (ddmmyyyy && ddmmyyyy[1] && ddmmyyyy[2] && ddmmyyyy[3]) {
    return `${ddmmyyyy[3]}-${ddmmyyyy[2]}-${ddmmyyyy[1]}`;
  }

  const mmddyyyy = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mmddyyyy && mmddyyyy[1] && mmddyyyy[2] && mmddyyyy[3]) {
    const month = mmddyyyy[1].padStart(2, '0');
    const day = mmddyyyy[2].padStart(2, '0');
    return `${mmddyyyy[3]}-${month}-${day}`;
  }

  const yyyymmdd = dateStr.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (yyyymmdd && yyyymmdd[1] && yyyymmdd[2] && yyyymmdd[3]) {
    return `${yyyymmdd[1]}-${yyyymmdd[2]}-${yyyymmdd[3]}`;
  }

  return dateStr;
}
