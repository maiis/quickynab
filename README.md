# QuickYNAB

Quick and easy bank transaction imports to YNAB. Supports 116+ banks worldwide with both CLI and web interface.

> **Note:** This project uses TypeScript + Vite. Make sure to run `npm run build` before using the CLI or web app in production.

## Features

- 🚀 **Web App**: Self-hosted web interface with drag-and-drop
- 💻 **CLI**: Command-line tool for automation
- 🏦 **116+ Bank Formats**: Automatically supports 110+ banks from 25 countries via bank2ynab configs (fetched at build time)
- 📊 **Auto-detection**: Automatically detects CSV format by filename pattern
- 🔒 **Duplicate Prevention**: Smart import ID generation
- 👀 **Preview Mode**: See transactions before uploading
- ⚙️ **Multiple Accounts**: Support for multiple budgets and accounts

## Which One Should I Use?

### 🌐 Web App (Recommended for Most Users)

**Best for:** Occasional imports, visual interface, easy setup

- ✅ No installation required (just Docker or npm)
- ✅ Works on any device with a browser
- ✅ Visual drag-and-drop interface
- ✅ Preview transactions before importing
- ✅ Select budget and account from dropdown
- ✅ Perfect for personal use

### 💻 CLI (Recommended for Power Users)

**Best for:** Automation, scripting, batch processing

- ✅ Automate imports with cron jobs or scripts
- ✅ Batch process multiple files at once
- ✅ Integrate into existing workflows
- ✅ Faster for repetitive tasks
- ✅ Perfect for server environments

## Installation

### Option 1: Docker (Easiest - Web App Only)

**Using Docker Hub:**

```bash
docker run -d \
  -p 3000:3000 \
  -e YNAB_ACCESS_TOKEN=your_token_here \
  --name quickynab \
  --restart unless-stopped \
  ghcr.io/yourusername/quickynab:latest
```

**Using docker-compose:**

```bash
# 1. Create docker-compose.yml (see Deployment section)
# 2. Create .env file with your YNAB token
echo "YNAB_ACCESS_TOKEN=your_token_here" > .env

# 3. Start the container
docker-compose up -d
```

Then open http://localhost:3000 in your browser!

### Option 2: NPM Global Install (CLI + Web App)

Install globally via npm:

```bash
npm install -g quickynab
```

**For CLI usage:**

```bash
ynab init
ynab import statement.csv
```

**For Web App:**

```bash
# Set YNAB_ACCESS_TOKEN environment variable
export YNAB_ACCESS_TOKEN=your_token_here

# Start web server
ynab-web  # or: node $(npm root -g)/quickynab/dist/server.js
```

### Option 3: Local Development

1. Clone or download this repository
2. Install dependencies:

   ```bash
   npm install
   ```

3. Build the project:

   ```bash
   npm run build
   ```

4. Configure your YNAB access token:

   ```bash
   npm start init
   ```

   Or manually create a `.env` file (see Configuration section below)

## Configuration

### CLI Configuration

When you run `ynab init`, the configuration is saved to `~/.quickynab/config`.

During `init`, you'll be prompted to:

1. Enter your YNAB Personal Access Token (get it from https://app.ynab.com/settings/developer)

The tool will verify your token and save it to `~/.quickynab/config`.

### Manual Configuration

You can also manually create or edit `~/.quickynab/config`:

```
YNAB_ACCESS_TOKEN=your_token_here
YNAB_BUDGET_ID=your_budget_id
YNAB_ACCOUNT_ID=your_account_id
```

> **Note:** For local development/web app, you can also use a `.env` file in the project directory.

## Usage

### Web App (Recommended)

Start the web server:

```bash
npm run web
```

Then open http://localhost:3000 in your browser and drag-and-drop your CSV files!

**Features:**

- Visual drag-and-drop interface
- Transaction preview before upload
- Real-time configuration status
- Beautiful, modern UI

**Screenshots:**

- Drag and drop your CSV file
- Preview transactions before uploading
- Get instant feedback on upload status

### CLI

#### Import Transactions

Import transactions from a YNAB-formatted CSV:

```bash
ynab import statement.csv
```

Preview transactions without uploading:

```bash
ynab import statement.csv --dry-run
```

> **Note:** If you installed locally (not globally), use `npm start` instead of `ynab`.

### Supported Formats

The tool automatically fetches and bundles **116+ bank formats from [bank2ynab](https://github.com/bank2ynab/bank2ynab)** at build time, supporting banks from 25 countries including:

- **Switzerland**: CH Neon, UBS, ZKB, SwissCard
- **Germany**: N26, ING-DiBa, Deutsche Bank, Sparkasse
- **UK**: Revolut, Barclays, HSBC, Monzo
- **US**: Chase, Bank of America, Wells Fargo, Capital One
- **And 100+ more banks worldwide**

The tool automatically detects your bank by matching the filename pattern. Just drag and drop - it will parse correctly!

See the full list at: https://github.com/bank2ynab/bank2ynab/blob/master/bank2ynab.conf

### Standard YNAB CSV Format

If using YNAB format, your CSV should have these columns:

- **Date** (required): Transaction date (YYYY-MM-DD format recommended)
- **Payee**: Name of payee
- **Category**: Category name
- **Memo**: Transaction memo/notes
- **Outflow**: Amount spent (positive number)
- **Inflow**: Amount received (positive number)

Example CSV:

```
Date,Payee,Category,Memo,Outflow,Inflow
2025-09-30,Grocery Store,Food,Weekly shopping,150.50,
2025-09-29,Employer,Income,Salary,,3000.00
```

### List Budgets and Accounts

List all budgets:

```bash
ynab budgets
```

List all accounts in configured budget:

```bash
ynab accounts
```

> **Note:** If you installed locally (not globally), use `npm start` instead of `ynab`.

## Usage Examples

### CH Neon Bank (Switzerland)

**Web App:**

1. Export statement from Neon
2. Open http://localhost:3000
3. Select budget and account
4. Drag and drop CSV - done! ✨

**CLI:**

```bash
ynab import ~/Downloads/2025_9_account_statements*.csv
```

### Revolut, N26, or other supported banks

Just export your transactions and drag them into the web app. The tool will auto-detect the format!

### Adding Your Bank

Your bank is probably already supported! This tool uses the [bank2ynab](https://github.com/bank2ynab/bank2ynab) configuration which includes 116+ bank formats.

**If your bank is not supported:**

1. **Contribute to bank2ynab** (helps everyone!)
   - Add your bank's config to [bank2ynab.conf](https://github.com/bank2ynab/bank2ynab/blob/master/bank2ynab.conf)
   - Create a PR - it will automatically be included in this tool

2. **Use YNAB Format**
   - Convert your bank CSV to YNAB format using https://aniav.github.io/ynab-csv/
   - Then import via web app or CLI

## Deployment

### 🐳 Docker (Recommended)

QuickYNAB is available as a Docker image on both Docker Hub and GitHub Container Registry.

**Using pre-built image from Docker Hub:**

```bash
docker run -d \
  -p 3000:3000 \
  -e YNAB_ACCESS_TOKEN=your_token_here \
  --name quickynab \
  --restart unless-stopped \
  yourusername/quickynab:latest
```

**Using pre-built image from GitHub Container Registry:**

```bash
docker run -d \
  -p 3000:3000 \
  -e YNAB_ACCESS_TOKEN=your_token_here \
  --name quickynab \
  --restart unless-stopped \
  ghcr.io/yourusername/quickynab:latest
```

**Using docker-compose (recommended):**

Create a `docker-compose.yml` file:

```yaml
version: '3.8'

services:
  quickynab:
    image: ghcr.io/yourusername/quickynab:latest
    # Or use Docker Hub: yourusername/quickynab:latest
    container_name: quickynab
    ports:
      - '3000:3000'
    environment:
      - YNAB_ACCESS_TOKEN=${YNAB_ACCESS_TOKEN}
      - NODE_ENV=production
    restart: unless-stopped
```

Then:

```bash
# 1. Create .env file with your YNAB token
echo "YNAB_ACCESS_TOKEN=your_token_here" > .env

# 2. Start the container
docker-compose up -d

# 3. View logs
docker-compose logs -f

# 4. Stop the container
docker-compose down
```

**Building locally:**

```bash
# Build the image
docker build -t quickynab .

# Run with environment variables
docker run -d \
  -p 3000:3000 \
  -e YNAB_ACCESS_TOKEN=your_token_here \
  --name quickynab \
  --restart unless-stopped \
  quickynab
```

**Docker image features:**

- ✅ Multi-stage build (~150MB final image)
- ✅ Non-root user for security
- ✅ Health checks included
- ✅ Alpine Linux base (minimal attack surface)
- ✅ Production-optimized

### Running as a Service

**Using PM2:**

```bash
npm install -g pm2
npm run build
pm2 start dist/server.js --name ynab-web
pm2 save
pm2 startup
```

**Using systemd:**
Create `/etc/systemd/system/ynab-web.service`:

```ini
[Unit]
Description=YNAB Web App
After=network.target

[Service]
Type=simple
User=yourusername
WorkingDirectory=/path/to/ynab-cli
ExecStart=/usr/bin/node dist/server.js
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

### Environment Variables

- `YNAB_ACCESS_TOKEN`: Your YNAB Personal Access Token (required)
- `PORT`: Web server port (default: 3000)
- `NODE_ENV`: Environment (production/development)
- `ALLOWED_ORIGINS`: Comma-separated list of allowed CORS origins (optional)

**CLI-only variables** (ignored by web app):

- `YNAB_BUDGET_ID`: Default budget ID for CLI automation (optional)
- `YNAB_ACCOUNT_ID`: Default account ID for CLI automation (optional)

## Development

Build the project:

```bash
npm run build
```

Run in development mode (with hot reload):

```bash
npm run dev
```

Run the CLI locally:

```bash
npm start init
npm start import statement.csv
```

> **Note:** To use the CLI globally after publishing to npm, users can install with `npm install -g quickynab`.

## Troubleshooting

### "YNAB_ACCESS_TOKEN not found"

Run `ynab init` to configure your access token (or `npm start init` if installed locally). Configuration is saved to `~/.quickynab/config`.

### "Multiple budgets found"

Set `YNAB_BUDGET_ID` in `~/.quickynab/config` (or `.env` for local development).

### "Multiple accounts found"

Set `YNAB_ACCOUNT_ID` in `~/.quickynab/config` (or `.env` for local development).

### Duplicate transactions

The tool automatically detects duplicates using import IDs. If a transaction is imported twice, YNAB will skip it.

## Testing

Run the test suite:

```bash
npm test
```

Run tests in watch mode:

```bash
npm run test:watch
```

Run tests with coverage:

```bash
npm run test:coverage
```

## License

MIT
