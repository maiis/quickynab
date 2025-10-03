# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

QuickYNAB is a TypeScript-based tool for importing bank transactions to YNAB with two interfaces:

- **Web App**: Fastify server with Vite frontend (drag-and-drop CSV upload)
- **CLI**: Commander.js-based command-line tool for automation

The project auto-detects 116+ bank CSV formats using configs fetched from [bank2ynab](https://github.com/bank2ynab/bank2ynab).

## Essential Commands

```bash
# Development
npm run dev              # Run both frontend (Vite) and backend (tsx watch) concurrently
npm run dev:vite         # Frontend only (http://localhost:5173)
npm run dev:server       # Backend only (http://localhost:3000)

# Building
npm run build            # Full build: fetch configs → build frontend → build backend → copy configs
npm run build:frontend   # Vite build only (outputs to dist/public/)
npm run build:backend    # TypeScript compile only (outputs to dist/)

# Testing
npm test                 # Run all tests with Vitest
npm run test:watch       # Watch mode
npm run test:ui          # Vitest UI
npm run test:coverage    # Coverage report

# Other
npm run format           # Format with Prettier
npm run format:check     # Check formatting (used in CI)
npm start               # Run CLI (node dist/cli.js)
npm run web             # Run web server (node dist/server.js)
```

## Architecture

### Build Process Flow

1. **`npm run build`** triggers 4 sequential steps:
   - `fetch:configs` - Downloads bank2ynab.conf from GitHub, parses INI format, saves as `lib/parsers/bank2ynab-configs.json`
   - `build:frontend` - Vite bundles React/TS frontend to `dist/public/`
   - `build:backend` - TypeScript compiles backend to `dist/`
   - `copy:configs` - Copies JSON config to `dist/lib/parsers/`

**Critical:** Bank configs are fetched at **build time**, not runtime. This keeps the bundle small and startup fast.

### CSV Parsing Pipeline

The parsing flow differs for CLI vs Web App but uses the same core logic:

```
parseCSV(filePath, originalFilename?)
  ↓
getBank2YnabConfigs() - loads bundled configs from JSON
  ↓
findMatchingConfig(filename) - regex or string matching against patterns
  ↓
[IF MATCH] → parseBank2YnabCSV() - handles semicolons, headers, footers, date formats
[IF NO MATCH] → parseYnabCSV() - standard YNAB format (Date, Payee, Outflow, Inflow)
  ↓
Returns Transaction[] with normalized format
```

**Web App caveat:** The server saves uploads as temp files with random prefixes (`ynab-{hash}-{originalFilename}.csv`). The `originalFilename` parameter is essential for pattern matching since bank configs use `^` anchors that expect specific filename patterns (e.g., `^(\d{4})_(\d{1,2})_account_statements` for CH Neon).

### Transaction Upload Flow

```
uploadTransactions(transactions, config, accountIdOverride?, budgetIdOverride?)
  ↓
Resolve budget ID (override > config > auto-select if only 1 > error)
  ↓
Resolve account ID (override > config > auto-select if only 1 > error)
  ↓
Generate import_id for each transaction (MD5 hash of account:date:amount:payee)
  ↓
Convert amounts to milliunits (multiply by 1000, round)
  ↓
ynabAPI.transactions.createTransactions()
  ↓
Returns { imported, duplicates } - YNAB skips transactions with duplicate import_ids
```

### File Structure

```
cli.ts                   # CLI entry point (Commander.js)
server.ts                # Web server (Fastify + multipart uploads)
src/                     # Frontend (Vite + TypeScript + Tailwind)
  ├── main.ts           # Frontend logic (drag-drop, preview, upload)
  └── index.html        # Entry HTML
lib/
  ├── config.ts         # Loads from ~/.quickynab/config or .env
  ├── converter.ts      # Main CSV parsing entry point
  ├── uploader.ts       # YNAB API interaction
  └── parsers/
      ├── bank2ynab-fetcher.ts       # Config loading & pattern matching
      ├── bank2ynab-generic.ts       # Generic bank CSV parser
      └── bank2ynab-configs.json     # Generated at build time
scripts/
  └── fetch-bank-configs.ts          # Downloads & parses bank2ynab.conf
```

## Key Implementation Details

### Bank Format Detection

Pattern matching happens in `findMatchingConfig()`:

1. Iterates through all configs in order (order matters - more specific patterns should come first)
2. For each config, checks `useRegex` flag:
   - `true`: Tests filename against regex pattern
   - `false`: Checks if filename includes pattern string
3. Returns first match or null

**When adding/fixing banks:** Check the pattern in `bank2ynab-configs.json`. If a pattern is too generic (e.g., `[0-9]{10}`), it may match before more specific patterns.

### Configuration Loading

Two separate config systems:

- **CLI**: Reads `~/.quickynab/config` (created by `ynab init` command)
- **Web**: Reads `.env` file or environment variables
- Both use `lib/config.ts` which exports `getConfig()`

**Budget/Account preselection:**

- **CLI**: Automatically uses `YNAB_BUDGET_ID` and `YNAB_ACCOUNT_ID` from `~/.quickynab/config` (created by `ynab init`). Can be overridden with `--budget-id` and `--account-id` flags.
- **Web App**: If `YNAB_BUDGET_ID` and/or `YNAB_ACCOUNT_ID` are set in `.env`, the web app will automatically preselect them in the dropdowns on page load. Users can still change the selections if desired.

### Frontend State Management

No React/Vue framework - vanilla TypeScript with DOM manipulation:

- Global state vars (`currentFile`, `previewData`, `selectedBudgetId`, `selectedAccountId`)
- Event listeners on drop-zone, file input, budget select, account select
- Dynamic HTML generation for preview and results

**Dark mode:** Uses Tailwind's `dark:` classes with `media` strategy (system preference)

### Security (Web App)

- Helmet for security headers (CSP, XSS protection)
- Rate limiting (100 req/15min global, 10 req/1min for uploads)
- File validation (max 10MB, CSV only, malicious content detection)
- Temp files with crypto-random names, cleaned up in finally blocks
- **Distroless Docker image** - No shell, no package manager, minimal attack surface (gcr.io/distroless/nodejs22-debian12)
- Non-root Docker user (distroless nonroot: uid:gid 65532:65532)
- **Zod validation** for runtime type safety on API inputs

## Testing Strategy

Tests use Vitest with 32 tests across 4 files:

- `bank2ynab-fetcher.test.ts` - Pattern matching (regex vs string, edge cases)
- `bank2ynab-generic.test.ts` - CSV parsing (delimiters, skip rows, sanitization)
- `date-parser.test.ts` - Date format detection (DD.MM.YYYY, YYYY-MM-DD, etc.)
- `uploader.test.ts` - Milliunits conversion, import_id generation

**When modifying parsers:** Run `npm run test:watch` and ensure existing tests pass. Add tests for new bank formats.

## Publishing

Automated via GitHub Actions:

- **npm:** `.github/workflows/publish-npm.yml` (on release)
- **Docker:** `.github/workflows/docker-publish.yml` (on git tag)
  - Builds multi-platform (linux/amd64, linux/arm64)
  - Pushes to both Docker Hub and GHCR
  - Uses distroless base image (53.5 MB compressed, 175 MB uncompressed)

Manual: `npm publish` (runs `prepublishOnly` → format + build)

## Common Gotchas

1. **Bank configs not updating?** Run `npm run fetch:configs` to re-download from GitHub
2. **Web app not detecting bank?** Check that original filename is passed to `parseCSV()` - temp file prefix breaks pattern matching
3. **Date parsing fails?** The `date-parser.ts` tries multiple formats - add new format if needed
4. **Duplicate transactions?** import_id must be consistent - check hash generation in `uploader.ts`
5. **Frontend changes not showing?** Run `npm run build:frontend` (dev server runs on :5173, production on :3000)
6. **Can't shell into Docker container?** Distroless has no shell - use `docker logs` for debugging or switch to alpine-based image temporarily
