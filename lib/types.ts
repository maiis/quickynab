// Shared types for both frontend and backend

export interface Transaction {
  date: string;
  payee_name: string | null;
  category_name?: string | null;
  memo: string | null;
  amount: number;
}

export interface Budget {
  id: string;
  name: string;
  currency_format?: {
    currency_symbol: string;
    decimal_digits: number;
  };
}

export interface Account {
  id: string;
  name: string;
  type: string;
  closed: boolean;
}

export interface PreviewData {
  success: boolean;
  count: number;
  preview: Array<{
    date: string;
    payee: string | null;
    amount: number;
    memo: string | null;
  }>;
}

export interface UploadResult {
  success: boolean;
  imported: number;
  duplicates: number;
  count?: number;
}

export interface ErrorResponse {
  error: string;
}

export type ApiResponse<T> = T | ErrorResponse;

export function isErrorResponse(response: unknown): response is ErrorResponse {
  return (
    typeof response === 'object' &&
    response !== null &&
    'error' in response &&
    typeof (response as ErrorResponse).error === 'string'
  );
}

// CSV Record type
export type CsvRecord = Record<string, string>;
