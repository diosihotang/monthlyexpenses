Oke, saya breakdown secara menyeluruh.

---

# Arsitektur Sistem Monthly Expense Tracker

## Gambaran Besar

Program ini adalah **full-stack web app** yang berjalan di satu codebase — tidak ada backend terpisah. Semua logic server dan client ada di dalam Next.js. Ini yang disebut **monolithic full-stack architecture** dengan pola modern Next.js App Router.

```
Browser (Client)
      ↕  HTTP
Next.js Server (App Router)
      ↕  Prisma ORM
PostgreSQL di Supabase (Cloud)
```

---

## Layer 1 — Database (Supabase + PostgreSQL)

File: `prisma/schema.prisma`, `.env`

Ini adalah lapisan paling bawah — tempat data disimpan secara permanen.

**Supabase** adalah platform PostgreSQL cloud. Kamu tidak manage server-nya sendiri, Supabase yang handle infrastruktur. Kamu cukup connect via connection string di `.env`:

```
DATABASE_URL="postgresql://..."
```

**Schema** mendefinisikan struktur tabel di database:

```
Transaction
├── id          → primary key, auto-generated (cuid)
├── amount      → Decimal(12,2) — bisa simpan sampai 9,999,999,999.99
├── category    → string bebas (Salary, Food, dll)
├── type        → enum: INCOME | EXPENSE
├── description → opsional
├── date        → kapan transaksi terjadi
├── status      → enum: SUCCESS | PENDING
├── createdAt   → auto-filled saat create
└── updatedAt   → auto-update setiap kali data berubah
```

Ada dua index (`date` dan `type`) — artinya query yang filter/sort by tanggal atau tipe akan lebih cepat, database tidak perlu scan seluruh tabel.

---

## Layer 2 — ORM (Prisma)

File: `lib/prisma.ts`

**ORM** (Object Relational Mapper) adalah jembatan antara kode TypeScript dan database. Kamu tidak perlu tulis SQL mentah — Prisma mengubah method TypeScript jadi query SQL di belakang layar.

```
prisma.transaction.findMany(...)  →  SELECT * FROM "Transaction" ...
prisma.transaction.create(...)    →  INSERT INTO "Transaction" ...
prisma.transaction.update(...)    →  UPDATE "Transaction" SET ...
prisma.transaction.delete(...)    →  DELETE FROM "Transaction" ...
```

**`lib/prisma.ts`** punya pola penting:

```ts
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export const prisma = globalForPrisma.prisma ?? new PrismaClient(...);

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

Kenapa seperti ini? Karena di **development mode**, Next.js melakukan **hot reload** — setiap kali kamu save file, server di-restart sebagian. Tanpa pola ini, setiap reload akan membuat koneksi database baru, sampai akhirnya kehabisan koneksi (connection pool exhausted). Dengan menyimpan instance di `globalThis`, koneksi yang sama dipakai ulang selama development.

Di **production**, pola ini tidak diperlukan karena server tidak hot reload.

---

## Layer 3 — Validation (Zod)

File: `lib/validations/transaction.ts`

Sebelum data dari user masuk ke database, harus divalidasi dulu. Zod adalah library untuk mendefinisikan "bentuk" data yang valid dan mengeceknya di runtime.

```
User input (FormData/string)
        ↓
   Zod Schema
        ↓
  ✅ valid   →  lanjut ke Prisma
  ❌ invalid →  return error ke user
```

Ini penting karena **TypeScript hanya mengecek tipe saat compile time** — tapi data dari form HTML selalu masuk sebagai string di runtime. Zod mengecek tipe dan aturan saat kode beneran berjalan.

---

## Layer 4 — Server Actions (Business Logic)

File: `app/actions/transaction.ts`

Ini adalah **lapisan logika bisnis** sekaligus **API endpoint** — tapi tanpa perlu bikin route `/api/...` secara manual. Server Actions adalah fungsi yang berjalan di server, tapi bisa dipanggil langsung dari komponen React di client.

```
'use server'  ←  directive ini yang bikin Next.js tahu ini kode server
```

Cara kerjanya di balik layar: Next.js otomatis membuat HTTP POST endpoint untuk setiap server action. Ketika client memanggil `createTransaction(formData)`, sebenarnya browser mengirim POST request ke endpoint yang di-generate Next.js, server menjalankan fungsinya, dan hasilnya dikirim balik ke client — semua transparan tanpa kamu perlu tahu detail-nya.

Alur data di setiap action:

```
FormData masuk
    ↓
Ekstrak nilai dari FormData
    ↓
Validasi dengan Zod
    ↓ (kalau gagal → return error)
Query ke database via Prisma
    ↓
revalidatePath('/') → paksa Next.js refresh cache halaman
    ↓
Return { success: true }
```

**`revalidatePath('/')`** ini penting — Next.js secara default meng-cache hasil render halaman. Setelah data berubah (create/update/delete), cache harus di-invalidate supaya halaman menampilkan data terbaru.

---

## Layer 5 — Components (UI)

Ini dibagi dua jenis yang fundamental di Next.js App Router:

### Server Components (default)
File: `app/page.tsx`

Berjalan **di server**, hasilnya dikirim sebagai HTML ke browser. Bisa langsung `await` data dari database tanpa useEffect atau loading state.

```
Request masuk ke /
      ↓
Next.js jalankan page.tsx di server
      ↓
page.tsx memanggil getTransactionsByMonth() + getMonthlySummary()
      ↓
Prisma query ke Supabase
      ↓
Data balik, di-render jadi HTML
      ↓
HTML dikirim ke browser
```

Keuntungannya: **tidak ada loading spinner**, data sudah ada di HTML pertama yang diterima browser. Baik untuk SEO dan initial load performance.

### Client Components
File: `app/components/TransactionForm.tsx`, `TransactionTable.tsx`, `MonthNavigator.tsx`

Tandanya: `'use client'` di baris pertama. Berjalan **di browser**, bisa pakai `useState`, `useEffect`, event handlers.

- **TransactionForm** — butuh `useState` untuk track tipe yang dipilih supaya kategori bisa filter secara dinamis
- **TransactionTable** — butuh `useState` untuk track transaksi mana yang sedang di-edit (buka/tutup modal)
- **MonthNavigator** — butuh `useRouter` untuk navigasi ke bulan berbeda tanpa full page reload

---

## Layer 6 — Routing (Next.js App Router)

Struktur folder `app/` **adalah** routing-nya:

```
app/
├── page.tsx        →  route: /
├── layout.tsx      →  wrapper untuk semua halaman (html, body, metadata)
├── globals.css     →  CSS global
├── actions/        →  bukan route — folder untuk server actions
└── components/     →  bukan route — folder untuk komponen UI
```

Navigasi bulan pakai **URL Search Params** (`?year=2026&month=10`). Ini pola yang baik karena:
- URL bisa di-bookmark/share, orang lain buka URL yang sama dapat bulan yang sama
- Browser back/forward button bekerja natural
- Server bisa langsung baca parameter dan fetch data yang tepat tanpa client-side state tambahan

---

## Alur Data Lengkap — Contoh: User Tambah Transaksi

```
1. User isi form → klik "Simpan"
2. Browser panggil handleSubmit(formData) di TransactionForm
3. handleSubmit memanggil createTransaction(formData) — server action
4. Next.js kirim POST request ke server (transparan)
5. Server: ekstrak FormData → validasi Zod → Prisma INSERT ke Supabase
6. revalidatePath('/') → invalidate cache halaman /
7. Return { success: true } ke client
8. Client: form di-reset
9. Next.js otomatis re-fetch data untuk halaman / (karena cache invalid)
10. Halaman re-render dengan data terbaru termasuk transaksi baru
```

---

## Ringkasan Stack per Layer

| Layer | Teknologi | Tanggung Jawab |
|---|---|---|
| Database | PostgreSQL (Supabase) | Simpan data permanen |
| ORM | Prisma | Jembatan TS ↔ SQL |
| Validation | Zod | Cek data sebelum masuk DB |
| Business Logic | Next.js Server Actions | CRUD operations |
| UI Server | Next.js Server Components | Render halaman + fetch data |
| UI Client | React Client Components | Interaktivitas (state, events) |
| Routing | Next.js App Router | URL → halaman |
| Styling | Plain CSS | Tampilan + responsive |