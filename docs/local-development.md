# Local Development Setup

## 1. Install Node.js and pnpm

### Install nvm (Node Version Manager)

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
```

### Install and use Node.js 24.12.0

```bash
nvm install 24.12.0
nvm use 24.12.0
```

The `.nvmrc` file ensures the correct version is used automatically.

### Enable pnpm via corepack

```bash
corepack enable
corepack prepare pnpm@9.15.4 --activate
```

### Verify installation

```bash
node --version  # Should output v24.12.0
pnpm --version  # Should output 9.15.4
```

## 2. Install Dependencies

```bash
pnpm install
```

This uses `pnpm-lock.yaml` to ensure reproducible builds with pinned dependencies.

## 3. Setup PostgreSQL

### Option A: Using Docker

```bash
docker run -d \
  --name football-predictor-db \
  -e POSTGRES_DB=football_predictor \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 \
  postgres:18-alpine
```

### Option B: Local PostgreSQL

```bash
# macOS
brew install postgresql@18
brew services start postgresql@18

# Create database
createdb football_predictor
```

## 4. Configure Environment

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
# Required
TELEGRAM_BOT_TOKEN=your_bot_token_here
API_FOOTBALL_KEY=your_api_key_here
API_FOOTBALL_BASE_URL=https://api.football-data.org/v4

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=football_predictor
DB_USER=postgres
DB_PASSWORD=postgres

# Application
NODE_ENV=development
LOG_LEVEL=info

# Background Jobs (optional, defaults shown)
FETCH_NEW_FIXTURES_CRON=0 */6 * * *
REFRESH_MATCHES_STATUSES_CRON=*/5 * * * *
CALCULATE_USER_POINTS_CRON=*/10 * * * *

# Competition
DEFAULT_LEAGUE_IDS=WC
DEFAULT_SEASON=2022

# Admin (comma-separated Telegram user IDs)
ADMIN_TELEGRAM_IDS=
```

## 5. Build and Run Migrations

Build the TypeScript code:

```bash
pnpm run build
```

Run database migrations:

```bash
pnpm run migrate
```

This creates all required tables, views, and schema.

## 6. Start the Bot

### Development mode with auto-reload

```bash
pnpm run dev
```

### Production mode

```bash
pnpm run build
pnpm start
```

## What Happens on Startup

The bot will:
1. Connect to PostgreSQL
2. Run any pending migrations
3. Launch the Telegram bot
4. Start background job scheduler
5. Run initial fixture sync

## Running Tests

Run all tests:

```bash
pnpm test
```

Run tests with coverage:

```bash
pnpm test -- --coverage
```

Run tests in watch mode:

```bash
pnpm run test:watch
```
