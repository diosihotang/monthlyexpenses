import { z } from 'zod';

// Schema validasi untuk data transaksi yang masuk dari form.
// Zod akan cek tipe dan aturan setiap field sebelum disimpan ke database.
export const transactionSchema = z.object({

  // Harus angka positif — tidak boleh 0 atau minus
  amount: z.number().positive('Jumlah uang harus lebih besar dari 0'),

  // Harus diisi, tidak boleh string kosong
  category: z.string().min(1, 'Kategori tidak boleh kosong'),

  // Hanya boleh salah satu dari dua nilai ini (enum)
  // Zod v4: pakai 'error' bukan 'errorMap' (nama berubah di v4)
  type: z.enum(['INCOME', 'EXPENSE'], {
    error: 'Tipe transaksi harus INCOME atau EXPENSE',
  }),

  // Opsional — boleh tidak diisi
  description: z.string().optional(),

  // Opsional — kalau diisi harus string (nanti diconvert ke Date di server action)
  date: z.string().optional(),
});

// Type otomatis dari schema di atas — tidak perlu tulis manual
// Hasilnya: { amount: number, category: string, type: 'INCOME'|'EXPENSE', description?: string, date?: string }
export type TransactionInput = z.infer<typeof transactionSchema>;
