// File validation constants
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const MAX_LINES = 50000;
export const MAX_LINE_LENGTH = 10000;

// Security patterns for malicious content detection
export const DANGEROUS_PATTERNS = [
  /<script/i,
  /javascript:/i,
  /on\w+=/i,
  /@import/i,
  /expression\(/i,
];

// Rate limit configurations
export const RATE_LIMITS = {
  health: { max: 60, timeWindow: '1 minute' },
  config: { max: 10, timeWindow: '1 minute' },
  budgets: { max: 30, timeWindow: '1 minute' },
  accounts: { max: 30, timeWindow: '1 minute' },
  upload: { max: 10, timeWindow: '1 minute' },
} as const;
