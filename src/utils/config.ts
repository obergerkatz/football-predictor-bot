import dotenv from 'dotenv';

dotenv.config();

interface Config {
  telegram: {
    botToken: string;
  };
  apiFootball: {
    apiKey: string;
    baseUrl: string;
  };
  database: {
    host: string;
    port: number;
    name: string;
    user: string;
    password: string;
  };
  app: {
    nodeEnv: string;
    logLevel: string;
  };
  jobs: {
    fetchNewFixturesCron: string;
    refreshMatchesStatusesCron: string;
    calculateUserPointsCron: string;
  };
  leagues: {
    defaultLeagueIds: string[];
    defaultSeason: number;
  };
  admin: {
    telegramIds: string[];
  };
}

function getEnv(key: string, defaultValue?: string): string {
  const value = process.env[key] || defaultValue;
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function getEnvNumber(key: string, defaultValue?: number): number {
  const value = process.env[key];
  if (!value) {
    if (defaultValue !== undefined) return defaultValue;
    throw new Error(`Missing required environment variable: ${key}`);
  }
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error(`Invalid number for environment variable ${key}: ${value}`);
  }
  return parsed;
}

function getEnvArray(key: string, defaultValue: string[] = []): string[] {
  const value = process.env[key];
  if (!value) return defaultValue;
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export const config: Config = {
  telegram: {
    botToken: getEnv('TELEGRAM_BOT_TOKEN'),
  },
  apiFootball: {
    apiKey: getEnv('API_FOOTBALL_KEY'),
    baseUrl: getEnv('API_FOOTBALL_BASE_URL', 'https://v3.football.api-sports.io'),
  },
  database: {
    host: getEnv('DB_HOST', 'localhost'),
    port: getEnvNumber('DB_PORT', 5432),
    name: getEnv('DB_NAME', 'footy_predictor'),
    user: getEnv('DB_USER', 'postgres'),
    password: getEnv('DB_PASSWORD'),
  },
  app: {
    nodeEnv: getEnv('NODE_ENV', 'development'),
    logLevel: getEnv('LOG_LEVEL', 'info'),
  },
  jobs: {
    fetchNewFixturesCron: getEnv('FETCH_NEW_FIXTURES_CRON', '0 */6 * * *'),
    refreshMatchesStatusesCron: getEnv('REFRESH_MATCHES_STATUSES_CRON', '*/5 * * * *'),
    calculateUserPointsCron: getEnv('CALCULATE_USER_POINTS_CRON', '*/10 * * * *'),
  },
  leagues: {
    defaultLeagueIds: getEnvArray('DEFAULT_LEAGUE_IDS', ['PL', 'PD', 'CL']),
    defaultSeason: getEnvNumber('DEFAULT_SEASON', new Date().getFullYear()),
  },
  admin: {
    telegramIds: getEnvArray('ADMIN_TELEGRAM_IDS', []),
  },
};

export default config;
