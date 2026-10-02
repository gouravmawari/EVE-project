export type AppConfig = {
  DATABASE_URL: string;
  JWT_SECRET: string;
  WEBHOOK_SECRET: string;
};

export function loadConfig(env = process.env): AppConfig {
  const required = ['DATABASE_URL', 'JWT_SECRET', 'WEBHOOK_SECRET'] as const;
  const missing = required.filter((key) => !env[key]?.trim());
  if (missing.length)
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`,
    );
  if (
    env.JWT_SECRET!.trim().length < 16 ||
    env.WEBHOOK_SECRET!.trim().length < 16
  )
    throw new Error(
      'JWT_SECRET and WEBHOOK_SECRET must be at least 16 characters',
    );
  return {
    DATABASE_URL: env.DATABASE_URL?.trim() ?? '',
    JWT_SECRET: env.JWT_SECRET?.trim() ?? '',
    WEBHOOK_SECRET: env.WEBHOOK_SECRET?.trim() ?? '',
  };
}

export const config = loadConfig();
