import { beforeEach, describe, expect, it, vi } from 'vitest';

// Prisma, sesi, dan revalidatePath di-mock supaya test tidak butuh database / runtime Next.js
vi.mock('@/lib/prisma', () => ({
  prisma: {
    transaction: {
      create: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));
vi.mock('@/lib/auth', () => ({ getCurrentUser: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { logger } from '@/lib/logger';
import {
  createTransaction,
  deleteTransaction,
  getMonthlySummary,
  getTransactions,
  getTransactionsByMonth,
  updateTransaction,
} from '@/app/actions/transaction';

const db = vi.mocked(prisma.transaction);
const currentUser = vi.mocked(getCurrentUser);
const USER = { id: 'user_abc', username: 'abc' };

function form(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

const validFields = {
  amount: '75000',
  category: 'Transport',
  type: 'EXPENSE',
  description: 'Bensin',
  date: '2026-10-20',
};

beforeEach(() => {
  vi.clearAllMocks();
  currentUser.mockResolvedValue(USER);
});

describe('tanpa sesi login', () => {
  beforeEach(() => {
    currentUser.mockResolvedValue(null);
  });

  it('menolak semua operasi tulis tanpa menyentuh database', async () => {
    await expect(createTransaction(form(validFields))).resolves.toHaveProperty('error.auth');
    await expect(updateTransaction('tx_1', form(validFields))).resolves.toHaveProperty('error.auth');
    await expect(deleteTransaction('tx_1')).resolves.toHaveProperty('error.auth');
    expect(db.create).not.toHaveBeenCalled();
    expect(db.updateMany).not.toHaveBeenCalled();
    expect(db.deleteMany).not.toHaveBeenCalled();
  });

  it('mengembalikan data kosong untuk operasi baca', async () => {
    await expect(getTransactions()).resolves.toEqual([]);
    await expect(getTransactionsByMonth(2026, 10)).resolves.toEqual([]);
    await expect(getMonthlySummary(2026, 10)).resolves.toEqual({ income: 0, expense: 0, balance: 0 });
    expect(db.findMany).not.toHaveBeenCalled();
  });
});

describe('createTransaction', () => {
  it('menyimpan transaksi valid atas nama user yang login', async () => {
    const result = await createTransaction(form(validFields));

    expect(result).toEqual({ success: true });
    expect(db.create).toHaveBeenCalledWith({
      data: {
        amount: 75000,
        category: 'Transport',
        type: 'EXPENSE',
        description: 'Bensin',
        date: new Date('2026-10-20'),
        userId: 'user_abc',
      },
    });
    expect(revalidatePath).toHaveBeenCalledWith('/');
  });

  it('mengembalikan error dan tidak menyentuh database jika input tidak valid', async () => {
    const result = await createTransaction(form({ ...validFields, amount: '0', category: '' }));

    expect(result).toHaveProperty('error.amount');
    expect(result).toHaveProperty('error.category');
    expect(db.create).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith('transaction.create.invalid', {
      fields: ['amount', 'category'],
    });
  });

  it('mencatat error lalu melempar ulang jika database gagal', async () => {
    const dbError = new Error('connection refused');
    db.create.mockRejectedValueOnce(dbError);

    await expect(createTransaction(form(validFields))).rejects.toThrow('connection refused');
    expect(logger.error).toHaveBeenCalledWith('transaction.create.failed', {
      error: dbError,
      userId: 'user_abc',
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe('updateTransaction', () => {
  it('hanya memperbarui transaksi milik user yang login', async () => {
    db.updateMany.mockResolvedValue({ count: 1 });

    const result = await updateTransaction('tx_1', form({ ...validFields, amount: '90000' }));

    expect(result).toEqual({ success: true });
    expect(db.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'tx_1', userId: 'user_abc' },
        data: expect.objectContaining({ amount: 90000 }),
      }),
    );
  });

  it('menolak jika transaksi milik user lain / tidak ada', async () => {
    db.updateMany.mockResolvedValue({ count: 0 });

    const result = await updateTransaction('tx_orang_lain', form(validFields));

    expect(result).toHaveProperty('error.id');
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('menolak update dengan tipe tidak valid', async () => {
    const result = await updateTransaction('tx_1', form({ ...validFields, type: 'TRANSFER' }));

    expect(result).toHaveProperty('error.type');
    expect(db.updateMany).not.toHaveBeenCalled();
  });
});

describe('deleteTransaction', () => {
  it('hanya menghapus transaksi milik user yang login', async () => {
    db.deleteMany.mockResolvedValue({ count: 1 });

    await expect(deleteTransaction('tx_1')).resolves.toEqual({ success: true });
    expect(db.deleteMany).toHaveBeenCalledWith({ where: { id: 'tx_1', userId: 'user_abc' } });
    expect(revalidatePath).toHaveBeenCalledWith('/');
  });

  it('menolak jika transaksi milik user lain / tidak ada', async () => {
    db.deleteMany.mockResolvedValue({ count: 0 });

    await expect(deleteTransaction('tx_orang_lain')).resolves.toHaveProperty('error.id');
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe('getMonthlySummary', () => {
  it('menghitung income, expense, dan balance dari transaksi SUCCESS', async () => {
    // amount dari Prisma bertipe Decimal; Number() di action harus bisa mengonversinya
    db.findMany.mockResolvedValue([
      { type: 'INCOME', amount: '5000000.00' },
      { type: 'EXPENSE', amount: '1250000.50' },
      { type: 'EXPENSE', amount: '249999.50' },
    ] as never);

    await expect(getMonthlySummary(2026, 10)).resolves.toEqual({
      income: 5000000,
      expense: 1500000,
      balance: 3500000,
    });
  });

  it('memfilter per user, rentang satu bulan penuh, dan hanya status SUCCESS', async () => {
    db.findMany.mockResolvedValue([]);

    await getMonthlySummary(2026, 2);

    expect(db.findMany).toHaveBeenCalledWith({
      where: {
        userId: 'user_abc',
        date: {
          gte: new Date(2026, 1, 1),
          lte: new Date(2026, 1, 28, 23, 59, 59),
        },
        status: 'SUCCESS',
      },
    });
  });
});

describe('getTransactionsByMonth', () => {
  it('mengambil transaksi user di bulan terpilih, terbaru lebih dulu', async () => {
    db.findMany.mockResolvedValue([]);

    await getTransactionsByMonth(2026, 12);

    expect(db.findMany).toHaveBeenCalledWith({
      where: {
        userId: 'user_abc',
        date: {
          gte: new Date(2026, 11, 1),
          lte: new Date(2026, 11, 31, 23, 59, 59),
        },
      },
      orderBy: { date: 'desc' },
    });
  });
});
