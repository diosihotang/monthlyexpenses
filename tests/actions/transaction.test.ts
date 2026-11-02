import { beforeEach, describe, expect, it, vi } from 'vitest';

// Prisma dan revalidatePath di-mock supaya test tidak butuh database / runtime Next.js
vi.mock('@/lib/prisma', () => ({
  prisma: {
    transaction: {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { logger } from '@/lib/logger';
import {
  createTransaction,
  deleteTransaction,
  getMonthlySummary,
  getTransactionsByMonth,
  updateTransaction,
} from '@/app/actions/transaction';

const db = vi.mocked(prisma.transaction);

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
});

describe('createTransaction', () => {
  it('menyimpan transaksi valid dan me-refresh halaman', async () => {
    const result = await createTransaction(form(validFields));

    expect(result).toEqual({ success: true });
    expect(db.create).toHaveBeenCalledWith({
      data: {
        amount: 75000,
        category: 'Transport',
        type: 'EXPENSE',
        description: 'Bensin',
        date: new Date('2026-10-20'),
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
    expect(logger.error).toHaveBeenCalledWith('transaction.create.failed', { error: dbError });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe('updateTransaction', () => {
  it('memperbarui transaksi berdasarkan id', async () => {
    const result = await updateTransaction('tx_1', form({ ...validFields, amount: '90000' }));

    expect(result).toEqual({ success: true });
    expect(db.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'tx_1' },
        data: expect.objectContaining({ amount: 90000 }),
      }),
    );
  });

  it('menolak update dengan tipe tidak valid', async () => {
    const result = await updateTransaction('tx_1', form({ ...validFields, type: 'TRANSFER' }));

    expect(result).toHaveProperty('error.type');
    expect(db.update).not.toHaveBeenCalled();
  });
});

describe('deleteTransaction', () => {
  it('menghapus transaksi berdasarkan id', async () => {
    await expect(deleteTransaction('tx_1')).resolves.toEqual({ success: true });
    expect(db.delete).toHaveBeenCalledWith({ where: { id: 'tx_1' } });
    expect(revalidatePath).toHaveBeenCalledWith('/');
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

  it('memfilter rentang tanggal satu bulan penuh dan hanya status SUCCESS', async () => {
    db.findMany.mockResolvedValue([]);

    await getMonthlySummary(2026, 2);

    expect(db.findMany).toHaveBeenCalledWith({
      where: {
        date: {
          gte: new Date(2026, 1, 1),
          lte: new Date(2026, 1, 28, 23, 59, 59),
        },
        status: 'SUCCESS',
      },
    });
  });

  it('mengembalikan nol jika tidak ada transaksi', async () => {
    db.findMany.mockResolvedValue([]);
    await expect(getMonthlySummary(2026, 10)).resolves.toEqual({
      income: 0,
      expense: 0,
      balance: 0,
    });
  });
});

describe('getTransactionsByMonth', () => {
  it('mengambil transaksi bulan terpilih, terbaru lebih dulu', async () => {
    db.findMany.mockResolvedValue([]);

    await getTransactionsByMonth(2026, 12);

    expect(db.findMany).toHaveBeenCalledWith({
      where: {
        date: {
          gte: new Date(2026, 11, 1),
          lte: new Date(2026, 11, 31, 23, 59, 59),
        },
      },
      orderBy: { date: 'desc' },
    });
  });
});
