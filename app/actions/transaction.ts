'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { transactionSchema } from '@/lib/validations/transaction';
import { logger } from '@/lib/logger';

// CREATE
export async function createTransaction(formData: FormData) {
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
      },
    });
    logger.info('transaction.created', { id: created?.id, type });
  } catch (error) {
    logger.error('transaction.create.failed', { error });
    throw error;
  }

  revalidatePath('/');
  return { success: true };
}

// READ - semua transaksi
export async function getTransactions() {
  return prisma.transaction.findMany({
    orderBy: { date: 'desc' },
  });
}

// READ - summary bulanan (bisa pilih bulan/tahun tertentu)
export async function getMonthlySummary(year?: number, month?: number) {
  const now = new Date();
  const y = year ?? now.getFullYear();
  const m = month ?? now.getMonth() + 1;

  const startOfMonth = new Date(y, m - 1, 1);
  const endOfMonth = new Date(y, m, 0, 23, 59, 59);

  const transactions = await prisma.transaction.findMany({
    where: {
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
  const now = new Date();
  const y = year ?? now.getFullYear();
  const m = month ?? now.getMonth() + 1;

  const startOfMonth = new Date(y, m - 1, 1);
  const endOfMonth = new Date(y, m, 0, 23, 59, 59);

  return prisma.transaction.findMany({
    where: { date: { gte: startOfMonth, lte: endOfMonth } },
    orderBy: { date: 'desc' },
  });
}

// UPDATE
export async function updateTransaction(id: string, formData: FormData) {
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
    await prisma.transaction.update({
      where: { id },
      data: {
        amount,
        category,
        type: type as 'INCOME' | 'EXPENSE',
        description,
        date: date ? new Date(date) : undefined,
      },
    });
    logger.info('transaction.updated', { id });
  } catch (error) {
    logger.error('transaction.update.failed', { id, error });
    throw error;
  }

  revalidatePath('/');
  return { success: true };
}

// DELETE
export async function deleteTransaction(id: string) {
  try {
    await prisma.transaction.delete({ where: { id } });
    logger.info('transaction.deleted', { id });
  } catch (error) {
    logger.error('transaction.delete.failed', { id, error });
    throw error;
  }
  revalidatePath('/');
  return { success: true };
}
