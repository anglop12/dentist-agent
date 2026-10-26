import { z } from 'zod';
import { config as dotenv } from 'dotenv';
import { existsSync } from 'fs';
import { dirname, resolve } from 'path';

/**
 * Carga el .env de la raíz del monorepo de forma determinista:
 * sube desde este archivo (src/config/) hasta encontrar .env.
 * Así no dependemos del cwd del proceso (pnpm filter, docker, etc.).
 */
(function loadRootEnv(): void {
  let dir = __dirname;
  for (let i = 0; i < 6; i++) {
    const candidate = resolve(dir, '.env');
    if (existsSync(candidate)) {
      dotenv({ path: candidate, override: true });
      return;
    }
    dir = dirname(dir);
  }
})();

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  APP_NAME: z.string().default('Consultorio Dental'),
  APP_PORT: z.coerce.number().int().positive().default(3000),
  APP_TZ: z.string().default('America/Mexico_City'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  DATABASE_URL: z.string().default('./storage/clinic.sqlite'),
  DATABASE_DRIVER: z.enum(['sqlite', 'postgres']).default('sqlite'),

  LLM_PROVIDER: z.enum(['ollama', 'anthropic', 'openai', 'openrouter', 'mock']).default('ollama'),
  LLM_MODEL: z.string().default('qwen2.5:7b'),
  LLM_TEMPERATURE: z.coerce.number().min(0).max(2).default(0.2),
  LLM_MAX_TOKENS: z.coerce.number().int().positive().default(2048),

  OLLAMA_BASE_URL: z.string().url().default('http://localhost:11434'),

  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default('claude-3-5-haiku-latest'),

  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),

  // OpenRouter (gateway multi-model; tiene modelos :free)
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_MODEL: z.string().default('meta-llama/llama-3.3-70b-instruct:free'),
  OPENROUTER_BASE_URL: z.string().url().default('https://openrouter.ai/api/v1'),
  // Cadena de failover: si el principal falla, prueba estos (separados por coma)
  OPENROUTER_MODELS: z.string().default(''),

  WA_ENABLED: z
    .union([z.string(), z.boolean()])
    .transform((v) => v === 'true' || v === true)
    .default(false),
  WA_SESSION_PATH: z.string().default('./storage/wa-session'),

  WS_ENABLED: z
    .union([z.string(), z.boolean()])
    .transform((v) => v === 'true' || v === true)
    .default(true),
  WS_PORT: z.coerce.number().int().positive().default(3001),

  AGENT_MAX_ITERATIONS: z.coerce.number().int().positive().default(8),
  AGENT_TOKEN_BUDGET: z.coerce.number().int().positive().default(4096),
  AGENT_MEMORY_WINDOW: z.coerce.number().int().positive().default(20),

  JOB_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(5000),

  ADMIN_TOKEN: z.string().default('change-me-in-production'),
  RATE_LIMIT_TTL: z.coerce.number().int().positive().default(60),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(30),

  STRIPE_ENABLED: z
    .union([z.string(), z.boolean()])
    .transform((v) => v === 'true' || v === true)
    .default(false),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  MERCADOPAGO_ENABLED: z
    .union([z.string(), z.boolean()])
    .transform((v) => v === 'true' || v === true)
    .default(false),
  MERCADOPAGO_ACCESS_TOKEN: z.string().optional(),

  GOOGLE_CALENDAR_ENABLED: z
    .union([z.string(), z.boolean()])
    .transform((v) => v === 'true' || v === true)
    .default(false),

  OTEL_ENABLED: z
    .union([z.string(), z.boolean()])
    .transform((v) => v === 'true' || v === true)
    .default(false),
  OTEL_EXPORTER: z.enum(['console', 'otlp']).default('console'),
  SENTRY_DSN: z.string().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

let cachedEnv: Env | null = null;

export function loadEnv(): Env {
  if (cachedEnv) return cachedEnv;
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('\n  ');
    throw new Error(`Invalid environment configuration:\n  ${issues}`);
  }
  cachedEnv = parsed.data;
  return cachedEnv;
}
