// Type-safe error handling

export abstract class AppError extends Error {
  abstract readonly code: string;

  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ConfigError extends AppError {
  readonly code = 'CONFIG_ERROR' as const;
}

export class CsvParseError extends AppError {
  readonly code = 'CSV_PARSE_ERROR' as const;

  constructor(
    message: string,
    public readonly line?: number,
    public readonly column?: number
  ) {
    super(message);
  }
}

export class YnabApiError extends AppError {
  readonly code = 'YNAB_API_ERROR' as const;

  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly detail?: string
  ) {
    super(message);
  }
}

export class ValidationError extends AppError {
  readonly code = 'VALIDATION_ERROR' as const;

  constructor(
    message: string,
    public readonly field?: string
  ) {
    super(message);
  }
}

// Type guard
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

// Safe error message extractor
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'An unknown error occurred';
}

// Error handler for CLI
export function handleCliError(error: unknown): never {
  const message = getErrorMessage(error);
  console.error('Error:', message);

  if (isAppError(error) && process.env.DEBUG) {
    console.error('Error code:', error.code);
    console.error('Stack:', error.stack);
  }

  process.exit(1);
}
