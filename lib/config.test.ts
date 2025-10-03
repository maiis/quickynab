import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { getConfig, saveConfig, hasConfig } from './config.js';

describe('config', () => {
  const testConfigDir = path.join(os.homedir(), '.quickynab');
  const testConfigFile = path.join(testConfigDir, 'config');
  let originalEnv: NodeJS.ProcessEnv;
  let configExistedBefore = false;
  let originalConfigContent = '';

  beforeEach(() => {
    // Backup existing config if it exists
    configExistedBefore = fs.existsSync(testConfigFile);
    if (configExistedBefore) {
      originalConfigContent = fs.readFileSync(testConfigFile, 'utf-8');
    }

    // Clean config file for tests
    if (fs.existsSync(testConfigFile)) {
      fs.unlinkSync(testConfigFile);
    }

    // Save and clear environment variables
    originalEnv = { ...process.env };
    delete process.env.YNAB_ACCESS_TOKEN;
    delete process.env.YNAB_BUDGET_ID;
    delete process.env.YNAB_ACCOUNT_ID;
  });

  afterEach(() => {
    // Restore environment
    process.env = originalEnv;

    // Restore original config or clean up
    if (configExistedBefore) {
      fs.writeFileSync(testConfigFile, originalConfigContent, { mode: 0o600 });
    } else if (fs.existsSync(testConfigFile)) {
      fs.unlinkSync(testConfigFile);
    }
  });

  describe('saveConfig', () => {
    it('should create config directory and file', () => {
      // Ensure directory doesn't exist
      if (fs.existsSync(testConfigDir)) {
        fs.rmSync(testConfigDir, { recursive: true });
      }

      saveConfig({ YNAB_ACCESS_TOKEN: 'test-token' });

      expect(fs.existsSync(testConfigDir)).toBe(true);
      expect(fs.existsSync(testConfigFile)).toBe(true);
    });

    it('should save config to file with correct permissions', () => {
      saveConfig({ YNAB_ACCESS_TOKEN: 'test-token' });

      const stats = fs.statSync(testConfigFile);
      // Check file permissions (0o600 = owner read/write only)
      expect(stats.mode & 0o777).toBe(0o600);
    });

    it('should save single key-value pair', () => {
      saveConfig({ YNAB_ACCESS_TOKEN: 'test-token' });

      const content = fs.readFileSync(testConfigFile, 'utf-8');
      expect(content).toBe('YNAB_ACCESS_TOKEN=test-token\n');
    });

    it('should save multiple key-value pairs', () => {
      saveConfig({
        YNAB_ACCESS_TOKEN: 'test-token',
        YNAB_BUDGET_ID: 'budget-123',
        YNAB_ACCOUNT_ID: 'account-456',
      });

      const content = fs.readFileSync(testConfigFile, 'utf-8');
      expect(content).toContain('YNAB_ACCESS_TOKEN=test-token');
      expect(content).toContain('YNAB_BUDGET_ID=budget-123');
      expect(content).toContain('YNAB_ACCOUNT_ID=account-456');
    });
  });

  describe('getConfig', () => {
    it('should load token from file', () => {
      saveConfig({ YNAB_ACCESS_TOKEN: 'file-token' });

      const config = getConfig();
      expect(config.accessToken).toBe('file-token');
      expect(config.budgetId).toBeNull();
      expect(config.accountId).toBeNull();
    });

    it('should prioritize file config over environment', () => {
      saveConfig({ YNAB_ACCESS_TOKEN: 'file-token' });
      process.env.YNAB_ACCESS_TOKEN = 'env-token';

      const config = getConfig();
      expect(config.accessToken).toBe('file-token');
    });

    it('should load budget and account IDs from file', () => {
      saveConfig({
        YNAB_ACCESS_TOKEN: 'token',
        YNAB_BUDGET_ID: 'budget-123',
        YNAB_ACCOUNT_ID: 'account-456',
      });

      const config = getConfig();
      expect(config.accessToken).toBe('token');
      expect(config.budgetId).toBe('budget-123');
      expect(config.accountId).toBe('account-456');
    });

    it('should handle comments in config file', () => {
      fs.mkdirSync(testConfigDir, { recursive: true });
      fs.writeFileSync(
        testConfigFile,
        '# Comment line\nYNAB_ACCESS_TOKEN=token\n# Another comment\nYNAB_BUDGET_ID=budget',
        { mode: 0o600 }
      );

      const config = getConfig();
      expect(config.accessToken).toBe('token');
      expect(config.budgetId).toBe('budget');
    });

    it('should handle empty lines in config file', () => {
      fs.mkdirSync(testConfigDir, { recursive: true });
      fs.writeFileSync(testConfigFile, 'YNAB_ACCESS_TOKEN=token\n\n\nYNAB_BUDGET_ID=budget\n', {
        mode: 0o600,
      });

      const config = getConfig();
      expect(config.accessToken).toBe('token');
      expect(config.budgetId).toBe('budget');
    });

    it('should handle values with equals signs', () => {
      fs.mkdirSync(testConfigDir, { recursive: true });
      fs.writeFileSync(testConfigFile, 'YNAB_ACCESS_TOKEN=token=with=equals', { mode: 0o600 });

      const config = getConfig();
      expect(config.accessToken).toBe('token=with=equals');
    });

    it('should handle whitespace in values', () => {
      fs.mkdirSync(testConfigDir, { recursive: true });
      fs.writeFileSync(testConfigFile, 'YNAB_ACCESS_TOKEN = token-with-spaces ', {
        mode: 0o600,
      });

      const config = getConfig();
      expect(config.accessToken).toBe('token-with-spaces');
    });
  });

  describe('hasConfig', () => {
    it('should return true when config file exists', () => {
      saveConfig({ YNAB_ACCESS_TOKEN: 'token' });
      expect(hasConfig()).toBe(true);
    });
  });
});
