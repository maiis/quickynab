import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyMultipart from '@fastify/multipart';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import os from 'os';
import crypto from 'crypto';
import { parseCSV } from './lib/converter.js';
import { uploadTransactions, listBudgets, listAccounts } from './lib/uploader.js';
import { getConfig } from './lib/config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const fastify = Fastify({
  logger:
    process.env.NODE_ENV === 'development'
      ? true
      : {
          level: 'error',
          redact: ['req.headers.authorization', 'req.headers.cookie'],
        },
  requestIdHeader: 'x-request-id',
  requestIdLogLabel: 'requestId',
  genReqId: () => crypto.randomUUID(),
});

// Security headers
await fastify.register(helmet, {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // Allow inline styles for now
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"], // Only allow connections to own server
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      // Don't upgrade to HTTPS - let reverse proxy handle that
      upgradeInsecureRequests: null,
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'same-site' },
});

// Rate limiting
await fastify.register(rateLimit, {
  max: 100,
  timeWindow: '15 minutes',
  cache: 10000,
  allowList: ['127.0.0.1'],
  skipOnError: true,
});

// Register plugins
// When running from dist/server.js, __dirname is already 'dist', so we just need 'public'
// When running from server.ts (dev mode), __dirname is root, so we need 'dist/public'
const publicDir = __dirname.endsWith('dist')
  ? path.join(__dirname, 'public')
  : path.join(__dirname, 'dist', 'public');

await fastify.register(fastifyStatic, {
  root: publicDir,
  prefix: '/',
});

await fastify.register(fastifyMultipart, {
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 1,
  },
});

// CORS - Allow same-origin requests (no CORS headers needed)
fastify.addHook('onRequest', async (request, reply) => {
  const origin = request.headers.origin;

  if (origin) {
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'];

    if (process.env.NODE_ENV === 'development' || allowedOrigins.includes(origin)) {
      reply.header('Access-Control-Allow-Origin', origin);
      reply.header('Access-Control-Allow-Credentials', 'true');
      reply.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      reply.header('Access-Control-Allow-Headers', 'Content-Type');
    }
  }
});

// File validation utility
function validateCSVFile(buffer: Buffer, filename: string): boolean {
  const MAX_SIZE = 10 * 1024 * 1024; // 10MB
  const MAX_LINES = 50000;
  const MAX_LINE_LENGTH = 10000;

  if (buffer.length > MAX_SIZE) {
    throw new Error('File too large (max 10MB)');
  }

  if (!filename.endsWith('.csv')) {
    throw new Error('File must have .csv extension');
  }

  const content = buffer.toString('utf-8');
  const lines = content.split('\n');

  if (lines.length > MAX_LINES) {
    throw new Error(`Too many lines (max ${MAX_LINES})`);
  }

  // Check line length (first 100 lines)
  for (let i = 0; i < Math.min(lines.length, 100); i++) {
    if (lines[i].length > MAX_LINE_LENGTH) {
      throw new Error(`Line ${i + 1} is too long`);
    }
  }

  // Check for CSV structure
  if (lines.length > 0) {
    const firstLine = lines[0];
    if (!firstLine.includes(',') && !firstLine.includes(';')) {
      throw new Error('File does not appear to be a valid CSV');
    }
  }

  // Check for malicious content
  const dangerousPatterns = [/<script/i, /javascript:/i, /on\w+=/i, /@import/i, /expression\(/i];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(content)) {
      throw new Error('File contains potentially malicious content');
    }
  }

  return true;
}

// Health check
fastify.get('/api/health', async () => {
  return { status: 'ok' };
});

fastify.get('/api/config', async () => {
  try {
    const config = getConfig();
    return {
      configured: true,
      hasBudget: !!config.budgetId,
      hasAccount: !!config.accountId,
    };
  } catch (error) {
    return {
      configured: false,
      hasBudget: false,
      hasAccount: false,
    };
  }
});

fastify.get('/api/budgets', async () => {
  try {
    const config = getConfig();
    const budgets = await listBudgets(config.accessToken);
    const budgetsWithCurrency = budgets.map((b) => ({
      id: b.id,
      name: b.name,
      currency_format: b.currency_format,
    }));
    return { budgets: budgetsWithCurrency };
  } catch (error: any) {
    return { error: error.message };
  }
});

fastify.get<{
  Querystring: { budgetId?: string };
}>('/api/accounts', async (request, reply) => {
  try {
    const config = getConfig();

    // Get budget ID from query param or config
    const budgetId = request.query.budgetId || config.budgetId;

    if (!budgetId) {
      // If no budget ID, return budgets list
      const budgets = await listBudgets(config.accessToken);
      if (budgets.length === 1) {
        // Auto-select if only one budget
        const accounts = await listAccounts(config.accessToken, budgets[0].id);
        return { accounts, budgetId: budgets[0].id };
      }
      // Return empty if multiple budgets
      return { accounts: [], needBudgetSelection: true };
    }

    const accounts = await listAccounts(config.accessToken, budgetId);

    // Get budget info to include currency
    const budgets = await listBudgets(config.accessToken);
    const budget = budgets.find((b) => b.id === budgetId);

    return {
      accounts,
      budgetId,
      currency_format: budget?.currency_format,
    };
  } catch (error: any) {
    reply.code(500);
    return { error: error.message };
  }
});

// Upload and import CSV with stricter rate limit
fastify.post<{
  Querystring: { dryRun?: string; budgetId?: string; accountId?: string };
}>(
  '/api/upload',
  {
    config: {
      rateLimit: {
        max: 10,
        timeWindow: '1 minute',
      },
    },
  },
  async (request, reply) => {
    let tmpFile: string | null = null;

    try {
      const config = getConfig();

      // Get the uploaded file
      const data = await request.file();
      if (!data) {
        reply.code(400);
        return { error: 'No file uploaded' };
      }

      const buffer = await data.toBuffer();

      // Validate file
      try {
        validateCSVFile(buffer, data.filename);
      } catch (validationError: any) {
        reply.code(400);
        return { error: validationError.message };
      }

      // Save file temporarily with secure random name but preserve original extension
      const randomName = crypto.randomBytes(16).toString('hex');
      const originalFilename = data.filename;
      tmpFile = path.join(os.tmpdir(), `ynab-${randomName}-${originalFilename}`);
      fs.writeFileSync(tmpFile, buffer);

      try {
        // Parse CSV (pass original filename for bank detection)
        const transactions = parseCSV(tmpFile, originalFilename);

        // Check if dry run
        const dryRun = request.query.dryRun === 'true';

        if (dryRun) {
          // Return preview
          return {
            success: true,
            dryRun: true,
            count: transactions.length,
            preview: transactions.slice(0, 10).map((tx) => ({
              date: tx.date,
              payee: tx.payee_name,
              amount: tx.amount,
              memo: tx.memo,
            })),
          };
        }

        // Get budget and account IDs from query params
        const budgetId = request.query.budgetId;
        const accountId = request.query.accountId;

        if (!accountId && !config.accountId) {
          reply.code(400);
          return { error: 'Account ID is required. Please select an account.' };
        }

        // Upload to YNAB
        const result = await uploadTransactions(
          transactions,
          config,
          accountId || null,
          budgetId || null
        );

        return {
          success: true,
          imported: result.imported,
          duplicates: result.duplicates,
          count: transactions.length,
        };
      } finally {
        // Cleanup
        if (tmpFile && fs.existsSync(tmpFile)) {
          fs.unlinkSync(tmpFile);
        }
      }
    } catch (error: any) {
      reply.code(500);
      return { error: error.message };
    }
  }
);

// Start server
const start = async () => {
  try {
    const port = parseInt(process.env.PORT || '3000');
    await fastify.listen({ port, host: '0.0.0.0' });
    console.log(`\n🚀 YNAB Web App running at http://localhost:${port}`);
    console.log(`\nMake sure you have configured your .env file with YNAB_ACCESS_TOKEN\n`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
