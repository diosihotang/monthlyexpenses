import { getMonthlySummary, getTransactionsByMonth } from '@/app/actions/transaction';
import TransactionForm from '@/app/components/TransactionForm';
import TransactionTable from '@/app/components/TransactionTable';
import MonthNavigator from '@/app/components/MonthNavigator';
import SignInForm from '@/app/components/SignInForm';
import { signOut } from '@/app/actions/auth';
import { getCurrentUser } from '@/lib/auth';
import { Suspense } from 'react';

function formatRupiah(amount: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount);
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const user = await getCurrentUser();

  // Perangkat ini belum masuk → tampilkan form username + PIN
  if (!user) {
    return (
      <main className="container">
        <h1 className="page-title">💰 Monthly Expense Tracker</h1>
        <SignInForm />
      </main>
    );
  }

  const params = await searchParams;
  const now = new Date();
  const year  = params.year  ? parseInt(params.year)  : now.getFullYear();
  const month = params.month ? parseInt(params.month) : now.getMonth() + 1;

  const [transactions, summary] = await Promise.all([
    getTransactionsByMonth(year, month),
    getMonthlySummary(year, month),
  ]);

  return (
    <main className="container">
      <div className="page-header">
        <h1 className="page-title">💰 Monthly Expense Tracker</h1>
        <form action={signOut} className="user-bar">
          <span>
            Masuk sebagai <strong>{user.username}</strong>
          </span>
          <button type="submit" className="btn btn-secondary">Keluar</button>
        </form>
      </div>

      {/* Month Navigator */}
      <Suspense>
        <MonthNavigator year={year} month={month} />
      </Suspense>

      {/* Summary Cards */}
      <div className="summary-grid">
        <div className="card">
          <p className="card-label">Pemasukan</p>
          <p className="card-value income">{formatRupiah(summary.income)}</p>
        </div>
        <div className="card">
          <p className="card-label">Pengeluaran</p>
          <p className="card-value expense">{formatRupiah(summary.expense)}</p>
        </div>
        <div className="card">
          <p className="card-label">Saldo</p>
          <p className="card-value balance">{formatRupiah(summary.balance)}</p>
        </div>
      </div>

      {/* Form */}
      <TransactionForm />

      {/* Table */}
      <TransactionTable transactions={transactions} />
    </main>
  );
}
