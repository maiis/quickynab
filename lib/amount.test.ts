import { describe, expect, it } from 'bun:test';
import { parseAmount } from './amount.js';

describe('parseAmount', () => {
  const cases: [string | undefined, number][] = [
    [undefined, 0],
    ['', 0],
    ['abc', 0],
    ['1234', 1234],
    ['-12.50', -12.5],
    ['0.5', 0.5],
    // Lone separator not followed by 3 digits is decimal (Swiss/EU decimal comma)
    ['12,50', 12.5],
    ['1,5', 1.5],
    // Lone separator followed by exactly 3 digits is a thousands separator
    ['1,234', 1234],
    ['$1,000', 1000],
    ['1.234', 1234],
    ['0.125', 0.125],
    // Repeated single separator is always thousands
    ['1,234,567', 1234567],
    ['1.234.567', 1234567],
    // Both separators: the last one is decimal
    ['1,234.50', 1234.5],
    ['1.234,50', 1234.5],
    ["1'234.50", 1234.5],
    ['CHF 1 234,50', 1234.5],
    ['-1.234.567,89', -1234567.89],
  ];

  for (const [input, expected] of cases) {
    it(`parses ${JSON.stringify(input)} as ${expected}`, () => {
      expect(parseAmount(input)).toBe(expected);
    });
  }
});
