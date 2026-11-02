import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

// Selalu dijalankan saat request (jangan di-cache saat build)
export const dynamic = 'force-dynamic';

// GET /api/health — dipakai untuk uptime monitoring dan Docker healthcheck.
// 200 kalau aplikasi dan database sehat, 503 kalau database tidak bisa dihubungi.
export async function GET() {
  const startedAt = Date.now();
  const version = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'local';

  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      status: 'ok',
      database: 'up',
      latencyMs: Date.now() - startedAt,
      version,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('health.database.down', { error });
    return NextResponse.json(
      { status: 'error', database: 'down', version, timestamp: new Date().toISOString() },
      { status: 503 },
    );
  }
}
