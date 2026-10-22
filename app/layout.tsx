import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Monthly Expense Tracker',
  description: 'Catat pemasukan dan pengeluaran bulanan kamu',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
