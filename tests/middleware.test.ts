import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { config, middleware } from '@/middleware';

function request(authorization?: string) {
  return new NextRequest('http://localhost/', {
    headers: authorization ? { authorization } : {},
  });
}

const basic = (credentials: string) => `Basic ${btoa(credentials)}`;

beforeEach(() => {
  vi.stubEnv('BASIC_AUTH_USER', 'dio');
  vi.stubEnv('BASIC_AUTH_PASSWORD', 's3cret:with-colon');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('middleware (Basic Auth)', () => {
  it('meloloskan request dengan kredensial yang benar', () => {
    const res = middleware(request(basic('dio:s3cret:with-colon')));
    expect(res.headers.get('x-middleware-next')).toBe('1');
  });

  it('meminta login (401 + WWW-Authenticate) jika tanpa kredensial', () => {
    const res = middleware(request());
    expect(res.status).toBe(401);
    expect(res.headers.get('www-authenticate')).toContain('Basic');
  });

  it.each([
    ['password salah', basic('dio:salah')],
    ['username salah', basic('orang-lain:s3cret:with-colon')],
    ['tanpa titik dua', basic('dio')],
    ['base64 rusak', 'Basic %%%'],
    ['skema bukan Basic', 'Bearer token'],
  ])('menolak %s', (_, header) => {
    expect(middleware(request(header)).status).toBe(401);
  });

  it('fail closed (503) jika kredensial belum dikonfigurasi', () => {
    vi.stubEnv('BASIC_AUTH_PASSWORD', '');
    expect(middleware(request(basic('dio:'))).status).toBe(503);
  });

  it('tidak memproteksi /api/health dan aset statis, tapi memproteksi halaman lain', () => {
    const pattern = new RegExp(`^${config.matcher[0]}$`);
    expect(pattern.test('/')).toBe(true);
    expect(pattern.test('/api/other')).toBe(true);
    expect(pattern.test('/api/health')).toBe(false);
    expect(pattern.test('/_next/static/chunk.js')).toBe(false);
  });
});
