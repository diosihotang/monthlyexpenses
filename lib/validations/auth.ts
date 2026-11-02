import { z } from 'zod';

export const signInSchema = z.object({
  // Disimpan huruf kecil supaya "Dio" dan "dio" dianggap username yang sama
  username: z
    .string({ error: 'Username wajib diisi' })
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_]{3,20}$/, 'Username 3–20 karakter: huruf, angka, atau _'),

  pin: z.string({ error: 'PIN wajib diisi' }).regex(/^\d{4}$/, 'PIN harus 4 digit angka'),
});

export type SignInInput = z.infer<typeof signInSchema>;
