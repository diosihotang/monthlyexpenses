'use client';

import { useRouter, useSearchParams } from 'next/navigation';

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

export default function MonthNavigator({ year, month }: { year: number; month: number }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function navigate(newYear: number, newMonth: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('year', String(newYear));
    params.set('month', String(newMonth));
    router.push(`?${params.toString()}`);
  }

  function prev() {
    if (month === 1) navigate(year - 1, 12);
    else navigate(year, month - 1);
  }

  function next() {
    if (month === 12) navigate(year + 1, 1);
    else navigate(year, month + 1);
  }

  const now = new Date();
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;

  return (
    <div className="month-nav">
      <button className="month-nav-btn" onClick={prev} aria-label="Bulan sebelumnya">‹</button>
      <span className="month-nav-label">
        {MONTH_NAMES[month - 1]} {year}
      </span>
      <button
        className="month-nav-btn"
        onClick={next}
        disabled={isCurrentMonth}
        aria-label="Bulan berikutnya"
      >
        ›
      </button>
    </div>
  );
}
