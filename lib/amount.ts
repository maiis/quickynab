/**
 * Parses a bank amount string (US, Swiss or EU notation) into a number.
 * Currency symbols, spaces and ' are stripped. When both . and , appear, the
 * last one is the decimal separator (1,234.50 / 1.234,50 / 1'234.50). A lone
 * separator is decimal (12,50 / 0.5) unless exactly 3 digits follow it, in
 * which case it is a thousands separator (1,234 / $1,000).
 * shortcut: 1.234 reads as 1234, so 3-decimal currencies (BHD, KWD) only parse
 * with a leading 0; upgrade by passing the decimal separator per bank config.
 */
export function parseAmount(amountStr: string | undefined): number {
  const cleaned = (amountStr || '').replace(/[^\d.,-]/g, '');
  const separators = cleaned.match(/[.,]/g) || [];
  const lastSep = Math.max(cleaned.lastIndexOf('.'), cleaned.lastIndexOf(','));
  const integerPart = cleaned.slice(0, lastSep);
  const fraction = cleaned.slice(lastSep + 1);

  const hasDecimal =
    lastSep >= 0 &&
    (new Set(separators).size > 1 ||
      (separators.length === 1 && (fraction.length !== 3 || /^-?0?$/.test(integerPart))));

  const normalized = hasDecimal
    ? `${integerPart.replace(/[.,]/g, '')}.${fraction}`
    : cleaned.replace(/[.,]/g, '');

  const amount = parseFloat(normalized);
  return Number.isNaN(amount) ? 0 : amount;
}
