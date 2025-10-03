# QuickYNAB

Import bank transactions to YNAB. Supports 116+ banks worldwide with drag-and-drop web interface and CLI.

![QuickYNAB Web Interface](screenshot.png)

## Features

- 🌐 **Web App** - Drag-and-drop interface with transaction preview
- 💻 **CLI** - Command-line tool for automation
- 🏦 **116+ Banks** - Auto-detects format from 25+ countries ([bank2ynab](https://github.com/bank2ynab/bank2ynab))
- 🔒 **Smart Imports** - Prevents duplicates automatically

## Quick Start

### Docker (Easiest)

```bash
docker run -d \
  -p 3000:3000 \
  -e YNAB_ACCESS_TOKEN=your_token \
  ghcr.io/maiis/quickynab:latest
```

Then open http://localhost:3000

### NPM

```bash
npm install -g quickynab
ynab init
ynab import statement.csv
```

## Configuration

Get your YNAB token from https://app.ynab.com/settings/developer

**Docker:** Set `YNAB_ACCESS_TOKEN` environment variable
**CLI:** Run `ynab init` (saves to `~/.quickynab/config`)

## Supported Banks

Auto-detects CSV format for 116+ banks including:

- 🇨🇭 Switzerland: Neon, UBS, ZKB, SwissCard
- 🇩🇪 Germany: N26, ING-DiBa, Deutsche Bank, Sparkasse
- 🇬🇧 UK: Revolut, Barclays, HSBC, Monzo
- 🇺🇸 US: Chase, Bank of America, Wells Fargo

[Full list](https://github.com/bank2ynab/bank2ynab/blob/master/bank2ynab.conf)

## CLI vs Web App

**Use Web App if:** You want a visual interface, occasional imports, select account per import

**Use CLI if:** You want automation, batch processing, cron jobs, scripting

## Development

```bash
git clone https://github.com/maiis/quickynab
cd quickynab
npm install
npm run build
npm run web  # Start web server
```

## License

MIT
