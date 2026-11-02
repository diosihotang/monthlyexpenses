import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    // Samakan alias '@/...' dengan tsconfig.json
    alias: { '@': path.resolve(__dirname, '.') },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Nilai dummy supaya lib/env.ts lolos validasi; test tidak pernah konek ke database
    env: { DATABASE_URL: 'postgresql://test:test@localhost:5432/test' },
  },
});
