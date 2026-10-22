'use client';

import { deleteTransaction, updateTransaction } from '@/app/actions/transaction';
import type { Transaction } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { useState } from 'react';

const CATEGORIES = {
  INCOME:  ['Salary', 'Freelance', 'Business', 'Investment'],
  EXPENSE: ['Food', 'Entertainment', 'Shopping', 'Transport', 'Utilities', 'Other'],
};

// Format angka ke Rupiah — menerima Decimal (tipe Prisma) atau number/string
function formatRupiah(amount: Decimal | number | string) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(Number(amount));
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(date));
}

// Format date ke format yyyy-MM-dd untuk input[type=date]
function toInputDate(date: Date) {
  return new Date(date).toISOString().split('T')[0];
}

// ── Modal Edit ──────────────────────────────────────────────
function EditModal({
  transaction,
  onClose,
}: {
  transaction: Transaction;
  onClose: () => void;
}) {
  // State tipe untuk filter kategori secara dinamis (sama seperti TransactionForm)
  const [type, setType] = useState<'INCOME' | 'EXPENSE'>(transaction.type);

  async function handleSubmit(formData: FormData) {
    const result = await updateTransaction(transaction.id, formData);
    if (result?.success) onClose();
  }

  return (
    // Overlay gelap di belakang modal — klik di luar untuk tutup
    <div className="modal-overlay" onClick={onClose}>
      {/* stopPropagation supaya klik di dalam modal tidak nutup modal */}
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Edit Transaksi</h2>
          <button className="modal-close" onClick={onClose} aria-label="Tutup">✕</button>
        </div>

        <form action={handleSubmit}>
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="edit-type">Tipe</label>
              <select
                id="edit-type"
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
              <label htmlFor="edit-amount">Jumlah (Rp)</label>
              <input
                id="edit-amount"
                name="amount"
                type="number"
                min="0"
                step="0.01"
                defaultValue={Number(transaction.amount)}
                required
              />
            </div>

            {/* Kategori otomatis filter sesuai tipe */}
            <div className="form-group">
              <label htmlFor="edit-category">Kategori</label>
              <select
                id="edit-category"
                name="category"
                required
                defaultValue={transaction.category}
              >
                {CATEGORIES[type].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="edit-date">Tanggal</label>
              <input
                id="edit-date"
                name="date"
                type="date"
                defaultValue={toInputDate(transaction.date)}
              />
            </div>

            <div className="form-group full-width">
              <label htmlFor="edit-description">Deskripsi (opsional)</label>
              <input
                id="edit-description"
                name="description"
                type="text"
                placeholder="Catatan..."
                defaultValue={transaction.description ?? ''}
              />
            </div>

            <div className="modal-actions full-width">
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Batal
              </button>
              <button type="submit" className="btn btn-primary">
                Simpan Perubahan
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Tabel Utama ─────────────────────────────────────────────
export default function TransactionTable({ transactions }: { transactions: Transaction[] }) {
  // Simpan transaksi yang sedang di-edit — null berarti modal tutup
  const [editing, setEditing] = useState<Transaction | null>(null);

  if (transactions.length === 0) {
    return (
      <div className="table-card">
        <h2>Riwayat Transaksi</h2>
        <p className="empty-state">Belum ada transaksi. Tambah transaksi pertamamu!</p>
      </div>
    );
  }

  return (
    <>
      {/* Modal muncul kalau ada transaksi yang dipilih untuk diedit */}
      {editing && (
        <EditModal
          transaction={editing}
          onClose={() => setEditing(null)}
        />
      )}

      <div className="table-card">
        <h2>Riwayat Transaksi</h2>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>Kategori</th>
                <th>Tipe</th>
                <th>Jumlah</th>
                <th>Status</th>
                <th>Deskripsi</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => (
                <tr key={t.id}>
                  <td>{formatDate(t.date)}</td>
                  <td>{t.category}</td>
                  <td>
                    <span className={`badge badge-${t.type.toLowerCase()}`}>
                      {t.type === 'INCOME' ? 'Pemasukan' : 'Pengeluaran'}
                    </span>
                  </td>
                  <td style={{ fontWeight: 600, color: t.type === 'INCOME' ? '#16a34a' : '#dc2626' }}>
                    {t.type === 'EXPENSE' ? '-' : '+'}{formatRupiah(t.amount)}
                  </td>
                  <td>
                    <span className={`badge badge-${t.status.toLowerCase()}`}>
                      {t.status === 'SUCCESS' ? 'Sukses' : 'Pending'}
                    </span>
                  </td>
                  <td style={{ color: '#888', fontSize: '0.85rem' }}>{t.description ?? '-'}</td>
                  <td>
                    <div className="action-btns">
                      {/* Klik Edit → set state editing ke transaksi ini → modal muncul */}
                      <button
                        className="btn btn-edit"
                        onClick={() => setEditing(t)}
                      >
                        Edit
                      </button>
                      <form action={() => { void deleteTransaction(t.id); }}>
                        <button type="submit" className="btn btn-danger">Hapus</button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
