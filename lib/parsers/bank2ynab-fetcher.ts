import fs from 'node:fs';

interface Bank2YnabConfig {
  name: string;
  pattern: string;
  useRegex?: boolean;
  delimiter?: string;
  headerRows?: number;
  footerRows?: number;
  columns?: string[];
  dateFormat?: string;
  [key: string]: string | number | boolean | string[] | undefined;
}

// Load pre-bundled configs (fetched at build time)
const bank2ynabConfigs: Record<string, Bank2YnabConfig> = JSON.parse(
  fs.readFileSync(new URL('./bank2ynab-configs.json', import.meta.url), 'utf-8')
);

/**
 * Gets bank2ynab configs (loaded from pre-bundled file)
 */
export function getBank2YnabConfigs(): Record<string, Bank2YnabConfig> {
  return bank2ynabConfigs;
}

/**
 * Finds a matching bank config for a given filename
 */
export function findMatchingConfig(
  filename: string,
  configs: Record<string, Bank2YnabConfig>
): Bank2YnabConfig | null {
  for (const [_name, config] of Object.entries(configs)) {
    try {
      if (config.useRegex) {
        const regex = new RegExp(config.pattern);
        if (regex.test(filename)) {
          return config;
        }
      } else {
        if (filename.includes(config.pattern)) {
          return config;
        }
      }
    } catch (_error) {}
  }

  return null;
}
