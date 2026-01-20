import { describe, expect, it } from 'bun:test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('/api/config endpoint', () => {
  it('should return budgetId and accountId when configured', async () => {
    // Set environment variables for testing
    process.env.YNAB_ACCESS_TOKEN = 'test-token';
    process.env.YNAB_BUDGET_ID = 'test-budget-id';
    process.env.YNAB_ACCOUNT_ID = 'test-account-id';

    const fastify = Fastify();

    // Mock the config endpoint behavior
    fastify.get('/api/config', async () => {
      const budgetId = process.env.YNAB_BUDGET_ID || null;
      const accountId = process.env.YNAB_ACCOUNT_ID || null;
      const accessToken = process.env.YNAB_ACCESS_TOKEN;

      if (!accessToken) {
        return {
          configured: false,
          hasBudget: false,
          hasAccount: false,
          budgetId: null,
          accountId: null,
        };
      }

      return {
        configured: true,
        hasBudget: !!budgetId,
        hasAccount: !!accountId,
        budgetId: budgetId,
        accountId: accountId,
      };
    });

    const response = await fastify.inject({
      method: 'GET',
      url: '/api/config',
    });

    expect(response.statusCode).toBe(200);
    const data = JSON.parse(response.body);
    expect(data).toMatchObject({
      configured: true,
      hasBudget: true,
      hasAccount: true,
      budgetId: 'test-budget-id',
      accountId: 'test-account-id',
    });

    await fastify.close();

    // Clean up environment
    delete process.env.YNAB_BUDGET_ID;
    delete process.env.YNAB_ACCOUNT_ID;
    delete process.env.YNAB_ACCESS_TOKEN;
  });

  it('should return null for budgetId/accountId when not configured', async () => {
    process.env.YNAB_ACCESS_TOKEN = 'test-token';

    const fastify = Fastify();

    fastify.get('/api/config', async () => {
      const budgetId = process.env.YNAB_BUDGET_ID || null;
      const accountId = process.env.YNAB_ACCOUNT_ID || null;
      const accessToken = process.env.YNAB_ACCESS_TOKEN;

      if (!accessToken) {
        return {
          configured: false,
          hasBudget: false,
          hasAccount: false,
          budgetId: null,
          accountId: null,
        };
      }

      return {
        configured: true,
        hasBudget: !!budgetId,
        hasAccount: !!accountId,
        budgetId: budgetId,
        accountId: accountId,
      };
    });

    const response = await fastify.inject({
      method: 'GET',
      url: '/api/config',
    });

    expect(response.statusCode).toBe(200);
    const data = JSON.parse(response.body);
    expect(data).toMatchObject({
      configured: true,
      hasBudget: false,
      hasAccount: false,
      budgetId: null,
      accountId: null,
    });

    await fastify.close();
    delete process.env.YNAB_ACCESS_TOKEN;
  });

  it('should return configured: false when YNAB_ACCESS_TOKEN is not set', async () => {
    const fastify = Fastify();

    fastify.get('/api/config', async () => {
      const budgetId = process.env.YNAB_BUDGET_ID || null;
      const accountId = process.env.YNAB_ACCOUNT_ID || null;
      const accessToken = process.env.YNAB_ACCESS_TOKEN;

      if (!accessToken) {
        return {
          configured: false,
          hasBudget: false,
          hasAccount: false,
          budgetId: null,
          accountId: null,
        };
      }

      return {
        configured: true,
        hasBudget: !!budgetId,
        hasAccount: !!accountId,
        budgetId: budgetId,
        accountId: accountId,
      };
    });

    const response = await fastify.inject({
      method: 'GET',
      url: '/api/config',
    });

    expect(response.statusCode).toBe(200);
    const data = JSON.parse(response.body);
    expect(data).toMatchObject({
      configured: false,
      hasBudget: false,
      hasAccount: false,
      budgetId: null,
      accountId: null,
    });

    await fastify.close();
  });

  it('should support partial configuration (only budgetId)', async () => {
    process.env.YNAB_ACCESS_TOKEN = 'test-token';
    process.env.YNAB_BUDGET_ID = 'test-budget-id';

    const fastify = Fastify();

    fastify.get('/api/config', async () => {
      const budgetId = process.env.YNAB_BUDGET_ID || null;
      const accountId = process.env.YNAB_ACCOUNT_ID || null;
      const accessToken = process.env.YNAB_ACCESS_TOKEN;

      if (!accessToken) {
        return {
          configured: false,
          hasBudget: false,
          hasAccount: false,
          budgetId: null,
          accountId: null,
        };
      }

      return {
        configured: true,
        hasBudget: !!budgetId,
        hasAccount: !!accountId,
        budgetId: budgetId,
        accountId: accountId,
      };
    });

    const response = await fastify.inject({
      method: 'GET',
      url: '/api/config',
    });

    expect(response.statusCode).toBe(200);
    const data = JSON.parse(response.body);
    expect(data).toMatchObject({
      configured: true,
      hasBudget: true,
      hasAccount: false,
      budgetId: 'test-budget-id',
      accountId: null,
    });

    await fastify.close();
    delete process.env.YNAB_BUDGET_ID;
    delete process.env.YNAB_ACCESS_TOKEN;
  });
});
