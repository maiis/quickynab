import { describe, expect, test } from 'bun:test';

// Helper to parse dates in common formats
function testParseDate(dateStr: string): string {
  const trimmed = dateStr.trim();

  // Already in YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  // DD.MM.YYYY (European format with dots)
  const ddmmyyyyDot = trimmed.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (ddmmyyyyDot) {
    return `${ddmmyyyyDot[3]}-${ddmmyyyyDot[2]}-${ddmmyyyyDot[1]}`;
  }

  // MM/DD/YYYY (US format with slashes) - smart detection
  const mmddyyyy = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (mmddyyyy) {
    const first = parseInt(mmddyyyy[1], 10);
    const second = parseInt(mmddyyyy[2], 10);
    // If first number is > 12, it must be DD/MM/YYYY
    if (first > 12) {
      return `${mmddyyyy[3]}-${mmddyyyy[2]}-${mmddyyyy[1]}`;
    }
    // If second number is > 12, it must be MM/DD/YYYY
    if (second > 12) {
      return `${mmddyyyy[3]}-${mmddyyyy[1]}-${mmddyyyy[2]}`;
    }
    // Ambiguous - default to US format (MM/DD/YYYY)
    return `${mmddyyyy[3]}-${mmddyyyy[1]}-${mmddyyyy[2]}`;
  }

  // YYYYMMDD
  const yyyymmdd = trimmed.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (yyyymmdd) {
    return `${yyyymmdd[1]}-${yyyymmdd[2]}-${yyyymmdd[3]}`;
  }

  return '';
}

describe('Date parser edge cases', () => {
  test('handles dates with leading/trailing whitespace', () => {
    const result = testParseDate('  2024-01-15  ');
    expect(result).toBe('2024-01-15');
  });

  test('handles dates with extra spaces', () => {
    const dateWithSpaces = ' 15.01.2024 ';
    const result = testParseDate(dateWithSpaces);
    expect(result).toBe('2024-01-15');
  });

  test('handles century boundary correctly', () => {
    const result1 = testParseDate('31.12.1999');
    expect(result1).toBe('1999-12-31');

    const result2 = testParseDate('01.01.2000');
    expect(result2).toBe('2000-01-01');
  });

  test('handles leap year dates correctly', () => {
    const result = testParseDate('29.02.2024');
    expect(result).toBe('2024-02-29');
  });

  test('returns empty string for invalid date format', () => {
    const result = testParseDate('invalid-date');
    expect(result).toBe('');
  });

  test('handles YYYYMMDD format without separators', () => {
    const result = testParseDate('20240115');
    expect(result).toBe('2024-01-15');
  });

  test('handles European format with dots', () => {
    const result = testParseDate('15.01.2024');
    expect(result).toBe('2024-01-15');
  });

  test('handles US format with slashes', () => {
    const result = testParseDate('01/15/2024');
    expect(result).toBe('2024-01-15');
  });
});

describe('Amount parser edge cases', () => {
  test('handles European decimal separator', () => {
    const amount = '1.234,56'; // European format: thousands separator (.), decimal (,)
    // Should be parsed as 1234.56
    const normalized = amount.replace('.', '').replace(',', '.');
    expect(parseFloat(normalized)).toBe(1234.56);
  });

  test('handles negative amounts in parentheses (accounting format)', () => {
    const amount = '(50.00)';
    const isNegative = amount.startsWith('(') && amount.endsWith(')');
    expect(isNegative).toBe(true);

    const value = -parseFloat(amount.replace(/[()]/g, ''));
    expect(value).toBe(-50.0);
  });

  test('handles amounts with currency symbols', () => {
    const amount = '$1,234.56';
    const cleaned = amount.replace(/[$,]/g, '');
    expect(parseFloat(cleaned)).toBe(1234.56);
  });

  test('handles very small amounts', () => {
    const amount = '0.01';
    expect(parseFloat(amount)).toBe(0.01);
  });

  test('handles large amounts with thousands separators', () => {
    const amount = '1,234,567.89';
    const cleaned = amount.replace(/,/g, '');
    expect(parseFloat(cleaned)).toBe(1234567.89);
  });
});
