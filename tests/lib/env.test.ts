import { describe, expect, it } from 'vitest';
import { parseEnv } from '@/lib/env';

describe('parseEnv', () => {
  it('menerima connection string PostgreSQL yang valid', () => {
    const env = parseEnv({ DATABASE_URL: 'postgresql://user:pass@host:5432/db', NODE_ENV: 'production' });
    expect(env.DATABASE_URL).toBe('postgresql://user:pass@host:5432/db');
    expect(env.NODE_ENV).toBe('production');
  });

  it('memakai NODE_ENV development jika tidak di-set', () => {
    expect(parseEnv({ DATABASE_URL: 'postgres://u:p@h/db' }).NODE_ENV).toBe('development');
  });

  it('gagal dengan pesan jelas jika DATABASE_URL hilang', () => {
    expect(() => parseEnv({})).toThrow(/DATABASE_URL belum di-set/);
  });

  it('gagal jika DATABASE_URL bukan PostgreSQL', () => {
    expect(() => parseEnv({ DATABASE_URL: 'mysql://u:p@h/db' })).toThrow(
      /harus berupa connection string PostgreSQL/,
    );
  });
});
