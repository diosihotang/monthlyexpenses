import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/prisma', () => ({ prisma: { $queryRaw: vi.fn() } }));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { GET } from '@/app/api/health/route';

const queryRaw = vi.mocked(prisma.$queryRaw);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/health', () => {
  it('mengembalikan 200 dan status ok jika database bisa dihubungi', async () => {
    queryRaw.mockResolvedValue([{ '?column?': 1 }] as never);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ status: 'ok', database: 'up' });
    expect(typeof body.latencyMs).toBe('number');
  });

  it('mengembalikan 503 dan mencatat error jika database down', async () => {
    queryRaw.mockRejectedValue(new Error('connection refused'));

    const res = await GET();

    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ status: 'error', database: 'down' });
    expect(logger.error).toHaveBeenCalledWith('health.database.down', expect.anything());
  });
});
