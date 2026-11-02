import { beforeEach, describe, expect, it, vi } from 'vitest';

const cookieStore = { get: vi.fn(), set: vi.fn(), delete: vi.fn() };
vi.mock('next/headers', () => ({ cookies: async () => cookieStore }));
vi.mock('@/lib/prisma', () => ({
  prisma: { session: { create: vi.fn(), findUnique: vi.fn(), deleteMany: vi.fn() } },
}));

import { prisma } from '@/lib/prisma';
import { createSession, getCurrentUser, hashPin, hashToken, verifyPin } from '@/lib/auth';

const sessions = vi.mocked(prisma.session);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('hashPin / verifyPin', () => {
  it('memverifikasi PIN yang benar dan menolak yang salah', async () => {
    const stored = await hashPin('1234');
    expect(stored).not.toContain('1234');
    await expect(verifyPin('1234', stored)).resolves.toBe(true);
    await expect(verifyPin('4321', stored)).resolves.toBe(false);
  });

  it('memakai salt acak, jadi PIN yang sama menghasilkan hash berbeda', async () => {
    expect(await hashPin('1234')).not.toBe(await hashPin('1234'));
  });

  it('menolak hash tersimpan yang rusak', async () => {
    await expect(verifyPin('1234', 'bukan-hash')).resolves.toBe(false);
  });
});

describe('createSession', () => {
  it('menyimpan hash token di database dan token asli di cookie httpOnly', async () => {
    await createSession('user_abc');

    const [name, token, options] = cookieStore.set.mock.calls[0];
    expect(name).toBe('session');
    expect(options).toMatchObject({ httpOnly: true, sameSite: 'lax', path: '/' });
    expect(sessions.create).toHaveBeenCalledWith({
      data: { tokenHash: hashToken(token), userId: 'user_abc', expiresAt: options.expires },
    });
  });
});

describe('getCurrentUser', () => {
  it('mengembalikan null tanpa cookie sesi', async () => {
    cookieStore.get.mockReturnValue(undefined);
    await expect(getCurrentUser()).resolves.toBeNull();
    expect(sessions.findUnique).not.toHaveBeenCalled();
  });

  it('mengembalikan user dari sesi yang masih berlaku', async () => {
    cookieStore.get.mockReturnValue({ value: 'token-valid' });
    sessions.findUnique.mockResolvedValue({
      expiresAt: new Date(Date.now() + 60000),
      user: { id: 'user_abc', username: 'abc' },
    } as never);

    await expect(getCurrentUser()).resolves.toEqual({ id: 'user_abc', username: 'abc' });
    expect(sessions.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tokenHash: hashToken('token-valid') } }),
    );
  });

  it('mengembalikan null jika sesi sudah kedaluwarsa', async () => {
    cookieStore.get.mockReturnValue({ value: 'token-lama' });
    sessions.findUnique.mockResolvedValue({
      expiresAt: new Date(Date.now() - 1000),
      user: { id: 'user_abc', username: 'abc' },
    } as never);

    await expect(getCurrentUser()).resolves.toBeNull();
  });
});
