import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CONFIG_DIR = path.join(os.homedir(), '.quickynab');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config');
const LOCAL_ENV = path.join(__dirname, '..', '.env');

dotenv.config({ path: LOCAL_ENV });

export interface Config {
  accessToken: string;
  budgetId: string | null;
  accountId: string | null;
}

function loadConfigFile(): Record<string, string> {
  if (!fs.existsSync(CONFIG_FILE)) {
    return {};
  }

  const content = fs.readFileSync(CONFIG_FILE, 'utf-8');
  const config: Record<string, string> = {};

  content.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        config[key.trim()] = valueParts.join('=').trim();
      }
    }
  });

  return config;
}

export function getConfig(): Config {
  const fileConfig = loadConfigFile();
  const token = fileConfig.YNAB_ACCESS_TOKEN || process.env.YNAB_ACCESS_TOKEN;

  if (!token) {
    throw new Error(
      'YNAB_ACCESS_TOKEN not found. Please run "ynab init" to set up your configuration.'
    );
  }

  return {
    accessToken: token,
    budgetId: fileConfig.YNAB_BUDGET_ID || process.env.YNAB_BUDGET_ID || null,
    accountId: fileConfig.YNAB_ACCOUNT_ID || process.env.YNAB_ACCOUNT_ID || null,
  };
}

export function saveConfig(config: Record<string, string>): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }

  const envContent = Object.entries(config)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  fs.writeFileSync(CONFIG_FILE, envContent + '\n', { mode: 0o600 });
}

export function hasConfig(): boolean {
  return fs.existsSync(CONFIG_FILE) || fs.existsSync(LOCAL_ENV);
}
