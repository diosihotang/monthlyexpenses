import { z } from 'zod';

// Validasi environment variable saat aplikasi start.
// Kalau ada yang hilang / salah format, aplikasi langsung gagal dengan pesan jelas
// daripada error misterius saat query pertama ke database.
const envSchema = z.object({
  DATABASE_URL: z
    .string({ error: 'DATABASE_URL belum di-set (lihat .env.example)' })
    .regex(/^postgres(ql)?:\/\//, 'DATABASE_URL harus berupa connection string PostgreSQL'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: Record<string, string | undefined>): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `- ${i.path.join('.')}: ${i.message}`);
    throw new Error(`Environment variable tidak valid:\n${issues.join('\n')}`);
  }
  return parsed.data;
}

export const env = parseEnv(process.env);
