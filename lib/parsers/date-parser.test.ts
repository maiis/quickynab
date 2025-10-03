import { describe, it, expect } from 'vitest';

// Date parsing functions extracted for testing
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
  if (ddmmyyyy) {
    return `${ddmmyyyy[3]}-${ddmmyyyy[2]}-${ddmmyyyy[1]}`;
  }

  const mmddyyyy = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mmddyyyy) {
    const month = mmddyyyy[1].padStart(2, '0');
    const day = mmddyyyy[2].padStart(2, '0');
    return `${mmddyyyy[3]}-${month}-${day}`;
  }

  const yyyymmdd = dateStr.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (yyyymmdd) {
    return `${yyyymmdd[1]}-${yyyymmdd[2]}-${yyyymmdd[3]}`;
  }

  return dateStr;
}

describe('date parsing', () => {
  describe('parseDate with format string', () => {
    it('should parse YYYY-MM-DD format', () => {
      expect(parseDate('2025-01-15', '%Y-%m-%d')).toBe('2025-01-15');
      expect(parseDate('2024-12-31', '%Y-%m-%d')).toBe('2024-12-31');
    });

    it('should parse DD.MM.YYYY format', () => {
      expect(parseDate('15.01.2025', '%d.%m.%Y')).toBe('2025-01-15');
      expect(parseDate('31.12.2024', '%d.%m.%Y')).toBe('2024-12-31');
    });

    it('should parse DD/MM/YYYY format', () => {
      expect(parseDate('15/01/2025', '%d/%m/%Y')).toBe('2025-01-15');
      expect(parseDate('31/12/2024', '%d/%m/%Y')).toBe('2024-12-31');
    });

    it('should parse MM/DD/YYYY format', () => {
      expect(parseDate('01/15/2025', '%m/%d/%Y')).toBe('2025-01-15');
      expect(parseDate('12/31/2024', '%m/%d/%Y')).toBe('2024-12-31');
    });

    it('should parse YYYYMMDD format', () => {
      expect(parseDate('20250115', '%Y%m%d')).toBe('2025-01-15');
      expect(parseDate('20241231', '%Y%m%d')).toBe('2024-12-31');
    });

    it('should return already formatted ISO dates', () => {
      expect(parseDate('2025-01-15', '%d.%m.%Y')).toBe('2025-01-15');
      expect(parseDate('2024-12-31')).toBe('2024-12-31');
    });
  });

  describe('autoDetectDate', () => {
    it('should auto-detect DD.MM.YYYY format', () => {
      expect(autoDetectDate('15.01.2025')).toBe('2025-01-15');
      expect(autoDetectDate('31.12.2024')).toBe('2024-12-31');
    });

    it('should auto-detect DD/MM/YYYY format', () => {
      expect(autoDetectDate('15/01/2025')).toBe('2025-01-15');
      expect(autoDetectDate('31/12/2024')).toBe('2024-12-31');
    });

    it('should auto-detect M/D/YYYY format with padding', () => {
      expect(autoDetectDate('1/5/2025')).toBe('2025-01-05');
      expect(autoDetectDate('12/3/2024')).toBe('2024-12-03');
    });

    it('should auto-detect YYYYMMDD format', () => {
      expect(autoDetectDate('20250115')).toBe('2025-01-15');
      expect(autoDetectDate('20241231')).toBe('2024-12-31');
    });

    it('should return already formatted ISO dates', () => {
      expect(autoDetectDate('2025-01-15')).toBe('2025-01-15');
      expect(autoDetectDate('2024-12-31')).toBe('2024-12-31');
    });

    it('should return unparseable dates as-is', () => {
      expect(autoDetectDate('invalid')).toBe('invalid');
      expect(autoDetectDate('Jan 15, 2025')).toBe('Jan 15, 2025');
    });

    it('should handle empty strings', () => {
      expect(parseDate('')).toBe('');
      expect(autoDetectDate('')).toBe('');
    });
  });

  describe('edge cases', () => {
    it('should handle leap years', () => {
      expect(parseDate('29.02.2024', '%d.%m.%Y')).toBe('2024-02-29');
      expect(parseDate('29/02/2024', '%d/%m/%Y')).toBe('2024-02-29');
    });

    it('should handle year boundaries', () => {
      expect(parseDate('01.01.2025', '%d.%m.%Y')).toBe('2025-01-01');
      expect(parseDate('31.12.2024', '%d.%m.%Y')).toBe('2024-12-31');
    });
  });
});
