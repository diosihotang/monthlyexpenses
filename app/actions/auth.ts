'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { signInSchema } from '@/lib/validations/auth';
import {
  LOCK_MINUTES,
  MAX_FAILED_ATTEMPTS,
  createSession,
  destroySession,
  hashPin,
  verifyPin,
} from '@/lib/auth';

export type SignInResult = { success: true; created: boolean } | { error: string };

// Masuk dengan username + PIN.
// Username yang belum ada otomatis dibuat dengan PIN tersebut (tanpa halaman daftar terpisah).
export async function signIn(formData: FormData): Promise<SignInResult> {
  const parsed = signInSchema.safeParse({
    username: formData.get('username'),
    pin: formData.get('pin'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { username, pin } = parsed.data;
  const user = await prisma.user.findUnique({ where: { username } });

  // Username baru → buat ruang data baru
  if (!user) {
    const created = await prisma.user.create({ data: { username, pinHash: await hashPin(pin) } });
    await createSession(created.id);
    logger.info('auth.user.created', { userId: created.id });
    revalidatePath('/');
    return { success: true, created: true };
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const minutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
    logger.warn('auth.signin.locked', { userId: user.id });
    return { error: `Terlalu banyak PIN salah. Coba lagi dalam ${minutes} menit.` };
  }

  if (!(await verifyPin(pin, user.pinHash))) {
    const attempts = user.failedAttempts + 1;
    const locked = attempts >= MAX_FAILED_ATTEMPTS;
    await prisma.user.update({
      where: { id: user.id },
      data: locked
        ? { failedAttempts: 0, lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60000) }
        : { failedAttempts: attempts },
    });
    logger.warn('auth.signin.failed', { userId: user.id, attempts, locked });
    return {
      error: locked
        ? `Terlalu banyak PIN salah. Coba lagi dalam ${LOCK_MINUTES} menit.`
        : `PIN salah untuk username "${username}". Sisa percobaan: ${MAX_FAILED_ATTEMPTS - attempts}.`,
    };
  }

  await prisma.user.update({ where: { id: user.id }, data: { failedAttempts: 0, lockedUntil: null } });
  await createSession(user.id);
  logger.info('auth.signin.success', { userId: user.id });
  revalidatePath('/');
  return { success: true, created: false };
}

export async function signOut() {
  await destroySession();
  revalidatePath('/');
}
