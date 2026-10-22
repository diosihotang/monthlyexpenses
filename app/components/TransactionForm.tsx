'use client';

import { createTransaction } from '@/app/actions/transaction';
import { useRef, useState } from 'react';

const CATEGORIES = {
  INCOME:  ['Salary', 'Freelance', 'Business', 'Investment'],
  EXPENSE: ['Food', 'Entertainment', 'Shopping', 'Transport', 'Utilities', 'Other'],
};

export default function TransactionForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [type, setType] = useState<'INCOME' | 'EXPENSE'>('INCOME');

  async function handleSubmit(formData: FormData) {
    const result = await createTransaction(formData);
    if (result?.success) {
      formRef.current?.reset();
      setType('INCOME');
    }
  }

  return (
    <div className="form-card">
      <h2>Tambah Transaksi</h2>
      <form ref={formRef} action={handleSubmit}>
        <div className="form-grid">
          <div className="form-group">
            <label htmlFor="type">Tipe</label>
            <select
              id="type"
              name="type"
              required
              value={type}
              onChange={(e) => setType(e.target.value as 'INCOME' | 'EXPENSE')}
            >
              <option value="INCOME">Pemasukan</option>
              <option value="EXPENSE">Pengeluaran</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="amount">Jumlah (Rp)</label>
            <input
              id="amount"
              name="amount"
              type="number"
              min="0"
              step="0.01"
              placeholder="0"
              required
            />
          </div>

          {/* Kategori hanya tampil sesuai tipe yang dipilih */}
          <div className="form-group">
            <label htmlFor="category">Kategori</label>
            <select id="category" name="category" required>
              {CATEGORIES[type].map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="date">Tanggal</label>
            <input id="date" name="date" type="date" />
          </div>

          <div className="form-group full-width">
            <label htmlFor="description">Deskripsi (opsional)</label>
            <input id="description" name="description" type="text" placeholder="Catatan..." />
          </div>

          <div className="form-group full-width">
            <button type="submit" className="btn btn-primary">Simpan</button>
          </div>
        </div>
      </form>
    </div>
  );
}
