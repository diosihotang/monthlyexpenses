import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: { user: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() } },
}));
// Fungsi hash asli dipakai; hanya pembuatan/penghapusan sesi (cookie) yang di-mock
vi.mock('@/lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth')>()),
  createSession: vi.fn(),
  destroySession: vi.fn(),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { prisma } from '@/lib/prisma';
import { createSession, destroySession, hashPin } from '@/lib/auth';
import { signIn, signOut } from '@/app/actions/auth';

const users = vi.mocked(prisma.user);

function form(username: string, pin: string) {
  const fd = new FormData();
  fd.set('username', username);
  fd.set('pin', pin);
  return fd;
}

let existing: { id: string; username: string; pinHash: string; failedAttempts: number; lockedUntil: Date | null };

beforeEach(async () => {
  vi.clearAllMocks();
  existing = { id: 'user_abc', username: 'abc', pinHash: await hashPin('1234'), failedAttempts: 0, lockedUntil: null };
});

describe('signIn', () => {
  it('membuat username baru beserta sesinya jika belum ada', async () => {
    users.findUnique.mockResolvedValue(null);
    users.create.mockResolvedValue({ id: 'user_new' } as never);

    const result = await signIn(form('  Baru_1 ', '5678'));

    expect(result).toEqual({ success: true, created: true });
    expect(users.findUnique).toHaveBeenCalledWith({ where: { username: 'baru_1' } });
    const { data } = users.create.mock.calls[0][0] as { data: { username: string; pinHash: string } };
    expect(data.username).toBe('baru_1');
    expect(data.pinHash).not.toContain('5678'); // PIN tidak pernah disimpan mentah
    expect(createSession).toHaveBeenCalledWith('user_new');
  });

  it('masuk ke username yang sudah ada dengan PIN yang benar dan mereset hitungan gagal', async () => {
    users.findUnique.mockResolvedValue({ ...existing, failedAttempts: 2 } as never);

    await expect(signIn(form('abc', '1234'))).resolves.toEqual({ success: true, created: false });
    expect(users.update).toHaveBeenCalledWith({
      where: { id: 'user_abc' },
      data: { failedAttempts: 0, lockedUntil: null },
    });
    expect(createSession).toHaveBeenCalledWith('user_abc');
  });

  it('menolak PIN salah dan menambah hitungan percobaan gagal', async () => {
    users.findUnique.mockResolvedValue(existing as never);

    const result = await signIn(form('abc', '0000'));

    expect(result).toEqual({ error: expect.stringContaining('PIN salah') });
    expect(users.update).toHaveBeenCalledWith({ where: { id: 'user_abc' }, data: { failedAttempts: 1 } });
    expect(createSession).not.toHaveBeenCalled();
  });

  it('mengunci username setelah 5 kali PIN salah', async () => {
    users.findUnique.mockResolvedValue({ ...existing, failedAttempts: 4 } as never);

    const result = await signIn(form('abc', '0000'));

    expect(result).toEqual({ error: expect.stringContaining('Terlalu banyak PIN salah') });
    const { data } = users.update.mock.calls[0][0] as { data: { lockedUntil: Date } };
    expect(data.lockedUntil.getTime()).toBeGreaterThan(Date.now());
  });

  it('menolak masuk selama terkunci, bahkan dengan PIN yang benar', async () => {
    users.findUnique.mockResolvedValue({
      ...existing,
      lockedUntil: new Date(Date.now() + 10 * 60000),
    } as never);

    await expect(signIn(form('abc', '1234'))).resolves.toEqual({
      error: expect.stringContaining('Coba lagi dalam 10 menit'),
    });
    expect(createSession).not.toHaveBeenCalled();
  });

  it.each([
    ['username terlalu pendek', 'ab', '1234', 'Username 3–20 karakter'],
    ['username dengan spasi', 'a b c', '1234', 'Username 3–20 karakter'],
    ['PIN bukan angka', 'abc', '12a4', 'PIN harus 4 digit'],
    ['PIN 3 digit', 'abc', '123', 'PIN harus 4 digit'],
  ])('menolak %s', async (_, username, pin, message) => {
    await expect(signIn(form(username, pin))).resolves.toEqual({ error: expect.stringContaining(message) });
    expect(users.findUnique).not.toHaveBeenCalled();
  });
});

describe('signOut', () => {
  it('menghapus sesi perangkat ini', async () => {
    await signOut();
    expect(destroySession).toHaveBeenCalled();
  });
});
