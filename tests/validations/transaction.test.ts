import { describe, expect, it } from 'vitest';
import { transactionSchema } from '@/lib/validations/transaction';

const valid = {
  amount: 50000,
  category: 'Food',
  type: 'EXPENSE',
  description: 'Makan siang',
  date: '2026-10-15',
};

describe('transactionSchema', () => {
  it('menerima data transaksi yang valid', () => {
    expect(transactionSchema.safeParse(valid).success).toBe(true);
  });

  it('menerima transaksi tanpa field opsional (description, date)', () => {
    const required = { amount: valid.amount, category: valid.category, type: valid.type };
    expect(transactionSchema.safeParse(required).success).toBe(true);
  });

  it.each([0, -1000])('menolak amount %s (harus lebih dari 0)', (amount) => {
    const result = transactionSchema.safeParse({ ...valid, amount });
    expect(result.success).toBe(false);
    expect(result.error?.flatten().fieldErrors.amount).toContain(
      'Jumlah uang harus lebih besar dari 0',
    );
  });

  it('menolak amount NaN (input form kosong / bukan angka)', () => {
    expect(transactionSchema.safeParse({ ...valid, amount: Number('abc') }).success).toBe(false);
  });

  it('menolak kategori kosong', () => {
    const result = transactionSchema.safeParse({ ...valid, category: '' });
    expect(result.success).toBe(false);
    expect(result.error?.flatten().fieldErrors.category).toContain('Kategori tidak boleh kosong');
  });

  it('menolak tipe selain INCOME atau EXPENSE', () => {
    const result = transactionSchema.safeParse({ ...valid, type: 'TRANSFER' });
    expect(result.success).toBe(false);
    expect(result.error?.flatten().fieldErrors.type).toContain(
      'Tipe transaksi harus INCOME atau EXPENSE',
    );
  });
});
