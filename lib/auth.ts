import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { prisma } from '@/lib/prisma';

const scrypt = promisify(scryptCallback) as (pin: string, salt: string, keylen: number) => Promise<Buffer>;

export const SESSION_COOKIE = 'session';
export const SESSION_TTL_DAYS = 365;
export const MAX_FAILED_ATTEMPTS = 5;
export const LOCK_MINUTES = 15;

// PIN disimpan sebagai hash scrypt + salt acak, tidak pernah dalam bentuk asli
export async function hashPin(pin: string) {
  const salt = randomBytes(16).toString('hex');
  const hash = await scrypt(pin, salt, 32);
  return `${salt}:${hash.toString('hex')}`;
}

export async function verifyPin(pin: string, stored: string) {
  const [salt, hashHex] = stored.split(':');
  if (!salt || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = await scrypt(pin, salt, expected.length);
  return timingSafeEqual(actual, expected);
}

export function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

// Buat sesi baru untuk perangkat ini dan simpan token-nya di cookie httpOnly
export async function createSession(userId: string) {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

  await prisma.session.create({ data: { tokenHash: hashToken(token), userId, expiresAt } });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  cookieStore.delete(SESSION_COOKIE);
}

// User yang sedang login di perangkat ini, atau null.
// cache() supaya dalam satu request database hanya ditanya sekali.
export const getCurrentUser = cache(async () => {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { expiresAt: true, user: { select: { id: true, username: true } } },
  });
  if (!session || session.expiresAt < new Date()) return null;
  return session.user;
});
