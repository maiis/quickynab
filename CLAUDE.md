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
bun run dev              # Run both frontend (Vite) and backend (bun --watch) concurrently
                         # IMPORTANT: Runs in development mode - all uploads are DRY-RUN only
bun run dev:vite         # Frontend only (http://localhost:5173)
bun run dev:server       # Backend only (http://localhost:3000) - also in dev mode

# Building
bun run build            # Full build: fetch configs → build frontend → build backend → copy configs
bun run build:frontend   # Vite build only (outputs to dist/public/)
bun run build:backend    # TypeScript compile with bun x tsc (outputs to dist/)

# Testing
bun test                 # Run all tests with Bun's test runner
bun test --watch         # Watch mode
bun test --coverage      # Coverage report

# Other
bun run format           # Format with Biome
bun run format:check     # Check formatting (used in CI)
bun run start            # Run CLI (bun dist/cli.js)
bun run web              # Run web server (bun dist/server.js)
```

## Architecture

### Build Process Flow

1. **`bun run build`** triggers 4 sequential steps:
   - `fetch:configs` - Downloads bank2ynab.conf from GitHub using Bun, parses INI format, saves as `lib/parsers/bank2ynab-configs.json`
   - `build:frontend` - Vite bundles React/TS frontend to `dist/public/`
   - `build:backend` - TypeScript compiles backend to `dist/` using `bun x tsc`
   - `copy:configs` - Copies JSON config to `dist/lib/parsers/`

**Critical:** Bank configs are fetched at **build time**, not runtime. This keeps the bundle small and startup fast.

**Runtime:** The project runs on Bun, which provides faster startup times and native TypeScript support compared to Node.js.

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
  ├── main.ts           # Frontend orchestration (event listeners, initialization)
  ├── api.ts            # API layer (fetch calls to backend)
  ├── ui.ts             # UI helpers (DOM manipulation, rendering)
  ├── state.ts          # State management (centralized state with getters/setters)
  └── index.html        # Entry HTML
lib/
  ├── config.ts         # Loads from ~/.quickynab/config or .env
  ├── constants.ts      # Centralized constants (file limits, rate limits, security patterns)
  ├── converter.ts      # Main CSV parsing entry point
  ├── uploader.ts       # YNAB API interaction
  ├── types.ts          # Shared TypeScript types (with helper type guards)
  ├── errors.ts         # Custom error classes
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

### Frontend Architecture

No React/Vue framework - vanilla TypeScript with modular architecture:

**State Management** (`src/state.ts`):
- Centralized state object with getters/setters
- State vars: `currentFile`, `previewData`, `budgets`, `accounts`, `selectedBudgetId`, `selectedAccountId`, `currencyFormat`
- Single source of truth for frontend state

**API Layer** (`src/api.ts`):
- All backend communication isolated in dedicated module
- Functions: `checkConfig()`, `loadBudgets()`, `loadAccounts()`, `uploadFile()`, `dryRunFile()`
- Clean separation between UI and network logic

**UI Layer** (`src/ui.ts`):
- DOM manipulation and rendering functions
- Functions: `showPreview()`, `showResult()`, `resetUI()`, `populateBudgetDropdown()`, etc.
- Reusable UI components

**Orchestration** (`src/main.ts`):
- Event listeners on drop-zone, file input, budget select, account select
- Initialization and coordination between api, ui, and state modules
- Reduced from 485 lines to ~340 lines through modularization

**Dark mode:** Uses Tailwind's `dark:` classes with `media` strategy (system preference)

### Security (Web App)

- Helmet for security headers (CSP, XSS protection)
- Rate limiting (100 req/15min global, 10 req/1min for uploads)
- File validation (max 10MB, CSV only, malicious content detection)
- Temp files with crypto-random names, cleaned up in finally blocks
- **Alpine-based Docker image** - Minimal base image with only required dependencies
- Built-in health checks for container orchestration
- **Zod validation** for runtime type safety on API inputs

### Development Mode Protection

**Critical:** The server automatically detects `NODE_ENV` and enforces dry-run mode in development:

- When `NODE_ENV=development` (default for `bun run dev`), all uploads are **forced to dry-run**
- Server logs show `⚠️ DEVELOPMENT MODE: All uploads are DRY-RUN only`
- Frontend displays yellow warning banner
- Upload responses include `devMode: true` flag
- **No data is sent to YNAB** - completely safe for testing

To enable real uploads:
```bash
NODE_ENV=production bun run web
```

This prevents accidental data modifications during development. The protection is enforced server-side, so even direct API calls cannot bypass it.

## Testing Strategy

Tests use Bun's built-in test runner (compatible with Vitest API) with 106+ tests across 10 files:

**Backend Tests:**
- `bank2ynab-fetcher.test.ts` - Pattern matching (regex vs string, edge cases)
- `bank2ynab-generic.test.ts` - CSV parsing (delimiters, skip rows, sanitization)
- `date-parser.test.ts` - Date format detection (DD.MM.YYYY, YYYY-MM-DD, etc.)
- `date-parser.edge-cases.test.ts` - Date/amount parsing edge cases (whitespace, formats, currencies)
- `uploader.test.ts` - Milliunits conversion, import_id generation
- `converter.test.ts` - Full CSV parsing flow
- `config.test.ts` - Configuration loading and validation
- `cli.test.ts` - CLI integration tests (real file I/O, no mocks)

**Server Tests:**
- `server.test.ts` - Web server endpoints and security
- `server.integration.test.ts` - Security validation (file size, XSS detection, rate limits)

**When modifying parsers:** Run `bun test --watch` and ensure existing tests pass. Add tests for new bank formats.

**Performance:** Bun's test runner is fast, completing the full suite in ~300-400ms.

**Important:** Tests are excluded from the build via `tsconfig.node.json` (`exclude: ["**/*.test.ts"]`). Never use global module mocks (`mock.module()`) as they can leak state between test files.

## Publishing

Automated via GitHub Actions:

- **npm:** `.github/workflows/publish-npm.yml` (on release)
  - Uses Bun for testing and building
  - Still uses npm for publishing (better provenance support)
- **Docker:** `.github/workflows/docker-publish.yml` (on git tag)
  - Builds multi-platform (linux/amd64, linux/arm64)
  - Pushes to both Docker Hub and GHCR
  - Uses official Bun Alpine image for smaller size and faster startup

Manual: `npm publish` (runs `prepublishOnly` → `bun run check && bun run build`)

## Common Gotchas

1. **Bank configs not updating?** Run `bun run fetch:configs` to re-download from GitHub
2. **Web app not detecting bank?** Check that original filename is passed to `parseCSV()` - temp file prefix breaks pattern matching
3. **Date parsing fails?** The `date-parser.ts` tries multiple formats - add new format if needed
4. **Duplicate transactions?** import_id must be consistent - check hash generation in `uploader.ts`
5. **Frontend changes not showing?** Run `bun run build:frontend` (dev server runs on :5173, production on :3000)
6. **Bun compatibility issues?** Bun has excellent Node.js compatibility, but check https://bun.sh/docs/runtime/nodejs-apis for any edge cases