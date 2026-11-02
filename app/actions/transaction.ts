'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { transactionSchema } from '@/lib/validations/transaction';
import { logger } from '@/lib/logger';
import { getCurrentUser } from '@/lib/auth';

// Semua fungsi di file 'use server' bisa dipanggil langsung dari browser,
// jadi pemilik data SELALU diambil dari sesi (cookie), tidak pernah dari parameter.
export type ActionResult = { success?: true; error?: Record<string, string[] | undefined> };

const NOT_SIGNED_IN: ActionResult = { error: { auth: ['Sesi berakhir, silakan masuk lagi'] } };

// CREATE
export async function createTransaction(formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return NOT_SIGNED_IN;

  const raw = {
    amount: Number(formData.get('amount')),
    category: formData.get('category') as string,
    type: formData.get('type') as string,
    description: formData.get('description') as string | undefined,
    date: formData.get('date') as string | undefined,
  };

  const parsed = transactionSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    logger.warn('transaction.create.invalid', { fields: Object.keys(fieldErrors) });
    return { error: fieldErrors };
  }

  const { amount, category, type, description, date } = parsed.data;

  try {
    const created = await prisma.transaction.create({
      data: {
        amount,
        category,
        type: type as 'INCOME' | 'EXPENSE',
        description,
        date: date ? new Date(date) : undefined,
        userId: user.id,
      },
    });
    logger.info('transaction.created', { id: created?.id, type, userId: user.id });
  } catch (error) {
    logger.error('transaction.create.failed', { error, userId: user.id });
    throw error;
  }

  revalidatePath('/');
  return { success: true };
}

// READ - semua transaksi milik user yang login
export async function getTransactions() {
  const user = await getCurrentUser();
  if (!user) return [];

  return prisma.transaction.findMany({
    where: { userId: user.id },
    orderBy: { date: 'desc' },
  });
}

// READ - summary bulanan (bisa pilih bulan/tahun tertentu)
export async function getMonthlySummary(year?: number, month?: number) {
  const user = await getCurrentUser();
  if (!user) return { income: 0, expense: 0, balance: 0 };

  const now = new Date();
  const y = year ?? now.getFullYear();
  const m = month ?? now.getMonth() + 1;

  const startOfMonth = new Date(y, m - 1, 1);
  const endOfMonth = new Date(y, m, 0, 23, 59, 59);

  const transactions = await prisma.transaction.findMany({
    where: {
      userId: user.id,
      date: { gte: startOfMonth, lte: endOfMonth },
      status: 'SUCCESS',
    },
  });

  const income = transactions
    .filter((t) => t.type === 'INCOME')
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const expense = transactions
    .filter((t) => t.type === 'EXPENSE')
    .reduce((sum, t) => sum + Number(t.amount), 0);

  return { income, expense, balance: income - expense };
}

// READ - transaksi per bulan
export async function getTransactionsByMonth(year?: number, month?: number) {
  const user = await getCurrentUser();
  if (!user) return [];

  const now = new Date();
  const y = year ?? now.getFullYear();
  const m = month ?? now.getMonth() + 1;

  const startOfMonth = new Date(y, m - 1, 1);
  const endOfMonth = new Date(y, m, 0, 23, 59, 59);

  return prisma.transaction.findMany({
    where: { userId: user.id, date: { gte: startOfMonth, lte: endOfMonth } },
    orderBy: { date: 'desc' },
  });
}

// UPDATE
export async function updateTransaction(id: string, formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return NOT_SIGNED_IN;

  const raw = {
    amount: Number(formData.get('amount')),
    category: formData.get('category') as string,
    type: formData.get('type') as string,
    description: formData.get('description') as string | undefined,
    date: formData.get('date') as string | undefined,
  };

  const parsed = transactionSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    logger.warn('transaction.update.invalid', { id, fields: Object.keys(fieldErrors) });
    return { error: fieldErrors };
  }

  const { amount, category, type, description, date } = parsed.data;

  try {
    // updateMany dengan filter userId: transaksi milik user lain tidak akan tersentuh
    const { count } = await prisma.transaction.updateMany({
      where: { id, userId: user.id },
      data: {
        amount,
        category,
        type: type as 'INCOME' | 'EXPENSE',
        description,
        date: date ? new Date(date) : undefined,
      },
    });
    if (count === 0) {
      logger.warn('transaction.update.not_found', { id, userId: user.id });
      return { error: { id: ['Transaksi tidak ditemukan'] } };
    }
    logger.info('transaction.updated', { id, userId: user.id });
  } catch (error) {
    logger.error('transaction.update.failed', { id, error, userId: user.id });
    throw error;
  }

  revalidatePath('/');
  return { success: true };
}

// DELETE
export async function deleteTransaction(id: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return NOT_SIGNED_IN;

  try {
    const { count } = await prisma.transaction.deleteMany({ where: { id, userId: user.id } });
    if (count === 0) {
      logger.warn('transaction.delete.not_found', { id, userId: user.id });
      return { error: { id: ['Transaksi tidak ditemukan'] } };
    }
    logger.info('transaction.deleted', { id, userId: user.id });
  } catch (error) {
    logger.error('transaction.delete.failed', { id, error, userId: user.id });
    throw error;
  }
  revalidatePath('/');
  return { success: true };
}
