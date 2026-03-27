# Quick Start

## Using Docker Compose (Recommended)

### 1. Clone the repository

```bash
git clone https://github.com/obergerkatz/football-predictor-bot.git
cd football-predictor-bot
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
API_FOOTBALL_KEY=your_football_data_org_api_key_here
API_FOOTBALL_BASE_URL=https://api.football-data.org/v4
```

### 3. Start the application

```bash
docker-compose up -d
```

### 4. View logs

```bash
docker-compose logs -f app
```

## What Happens on Startup

The bot will automatically:
1. Run database migrations
2. Sync football fixtures and groups on startup
3. Start scheduled background jobs
4. Connect to Telegram

Your bot is now ready to receive commands on Telegram!

## Stopping the Application

```bash
docker-compose down
```

To also remove volumes (database data):

```bash
docker-compose down -v
```
