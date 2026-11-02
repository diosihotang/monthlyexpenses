import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    // Samakan alias '@/...' dengan tsconfig.json
    alias: {
      '@': path.resolve(__dirname, '.'),
      // 'server-only' sengaja melempar error di luar React Server Components; di test tidak perlu
      'server-only': path.resolve(__dirname, 'node_modules/server-only/empty.js'),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Nilai dummy supaya lib/env.ts lolos validasi; test tidak pernah konek ke database
    env: { DATABASE_URL: 'postgresql://test:test@localhost:5432/test' },
  },
});
