#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG_URL = 'https://raw.githubusercontent.com/bank2ynab/bank2ynab/develop/bank2ynab.conf';
const OUTPUT_FILE = path.join(__dirname, '../lib/parsers/bank2ynab-configs.json');

interface Bank2YnabConfig {
  name: string;
  pattern: string;
  useRegex?: boolean;
  delimiter?: string;
  headerRows?: number;
  footerRows?: number;
  columns?: string[];
  dateFormat?: string;
}

/**
 * Parses the bank2ynab.conf INI-style config file
 */
function parseIniConfig(configText: string): Record<string, Bank2YnabConfig> {
  const lines = configText.split('\n');
  const configs: Record<string, Bank2YnabConfig> = {};

  let currentSection: string | null = null;
  let currentConfig: Record<string, string> = {};

  const SECTION_REGEX = /^\s*\[([^\]]+)\]/;
  const KEY_VALUE_REGEX = /\s*(.*?)\s*[=:]\s*(.*)/;
  const COMMENT_REGEX = /^\s*[;#]/;

  for (const line of lines) {
    // Skip comments and empty lines
    if (COMMENT_REGEX.test(line) || line.trim() === '') {
      continue;
    }

    // Check for section header
    const sectionMatch = line.match(SECTION_REGEX);
    if (sectionMatch) {
      // Save previous section
      if (currentSection && currentSection !== 'DEFAULT') {
        configs[currentSection] = parseConfigSection(currentSection, currentConfig);
      }

      currentSection = sectionMatch[1];
      currentConfig = {};
      continue;
    }

    // Parse key-value pairs
    const keyMatch = line.match(KEY_VALUE_REGEX);
    if (keyMatch?.[1] && keyMatch[2]) {
      const key = keyMatch[1].trim();
      const value = keyMatch[2].trim();
      currentConfig[key] = value;
    }
  }

  // Save last section
  if (currentSection && currentSection !== 'DEFAULT') {
    configs[currentSection] = parseConfigSection(currentSection, currentConfig);
  }

  return configs;
}

/**
 * Converts a bank2ynab config section to our format
 */
function parseConfigSection(name: string, config: Record<string, string>): Bank2YnabConfig {
  const pattern = config['Source Filename Pattern'] || config['Source Filename'] || '';
  const useRegex = config['Use Regex For Filename'] === 'True';
  const delimiter = config['Source CSV Delimiter'] || ',';
  const headerRows = parseInt(config['Header Rows'] || '0', 10);
  const footerRows = parseInt(config['Footer Rows'] || '0', 10);
  const dateFormat = config['Date Format'];

  // Parse input columns
  let columns: string[] = [];
  if (config['Input Columns']) {
    columns = config['Input Columns'].split(',').map((col: string) => col.trim());
  }

  return {
    name,
    pattern,
    useRegex,
    delimiter,
    headerRows,
    footerRows,
    columns,
    dateFormat,
  };
}

async function main() {
  try {
    console.log('Fetching bank2ynab configs from GitHub...');
    const response = await fetch(CONFIG_URL);
    const configText = await response.text();
    const configs = parseIniConfig(configText);

    // Check if content has changed (compare actual data, not formatting)
    let shouldWrite = true;
    if (fs.existsSync(OUTPUT_FILE)) {
      try {
        const existingContent = fs.readFileSync(OUTPUT_FILE, 'utf-8');
        const existingConfigs = JSON.parse(existingContent);

        // Compare stringified versions to check for actual content changes
        if (JSON.stringify(existingConfigs) === JSON.stringify(configs)) {
          console.log(`✓ Bank configs are up to date (${Object.keys(configs).length} formats)`);
          shouldWrite = false;
        }
      } catch {
        // If we can't read/parse existing file, write it
        shouldWrite = true;
      }
    }

    // Only write if content changed or file doesn't exist
    if (shouldWrite) {
      fs.writeFileSync(OUTPUT_FILE, JSON.stringify(configs, null, 2));
      console.log(`✓ Saved ${Object.keys(configs).length} bank formats to ${OUTPUT_FILE}`);
    }
  } catch (error) {
    console.error('Failed to fetch bank2ynab configs:', error);
    process.exit(1);
  }
}

main();
