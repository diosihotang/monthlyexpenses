# Monthly Expense Tracker

Aplikasi pencatat pemasukan & pengeluaran bulanan — Next.js 15 (App Router, Server Actions), Prisma, PostgreSQL (Supabase), Zod.
Penjelasan arsitektur lengkap ada di [`penjelasan.md`](./penjelasan.md).

## Menjalankan secara lokal

```bash
cp .env.example .env      # isi DATABASE_URL
npm install               # otomatis menjalankan prisma generate
npm run dev
```

Atau tanpa Supabase, pakai Docker (app + PostgreSQL lokal):

```bash
docker compose up --build
# http://localhost:3000  ·  health: http://localhost:3000/api/health
```

## Scripts

| Script | Fungsi |
| --- | --- |
| `npm run dev` | Development server |
| `npm run lint` | ESLint (aturan Next.js + TypeScript) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Unit test (Vitest) — validasi Zod, Server Actions, env, logger, health check |
| `npm run build` | Production build (output `standalone` untuk Docker) |

## Delivery pipeline

```
push / pull request ─► GitHub Actions CI ─────────────────────────────► Vercel
                       ├─ lint · type check · unit tests · build          (deploy otomatis
                       ├─ secret scan (gitleaks, seluruh riwayat commit)   dari branch main,
                       └─ Docker build + smoke test /api/health            preview untuk PR)
```

Workflow ada di [`.github/workflows/ci.yml`](./.github/workflows/ci.yml). Disarankan aktifkan
**branch protection** di `main` (Settings → Branches) dengan status check CI wajib lolos sebelum merge.

## Akun & data per user

Tidak ada halaman daftar: masuk cukup dengan **username + PIN 4 digit**. Username yang belum ada otomatis
dibuat. Perangkat diingat lewat cookie sesi (1 tahun); di perangkat lain cukup masuk dengan username + PIN yang sama.

- Setiap transaksi punya `userId`; semua Server Action mengambil pemilik dari sesi, tidak pernah dari parameter,
  dan edit/hapus memakai filter `userId` sehingga data user lain tidak bisa disentuh.
- PIN disimpan sebagai hash scrypt + salt. 5 kali PIN salah mengunci username selama 15 menit.
- Cookie hanya berisi token acak (`httpOnly`, `secure`); database menyimpan hash SHA-256-nya.

## Environment & secrets

- Satu-satunya secret: `DATABASE_URL`. Divalidasi saat start oleh [`lib/env.ts`](./lib/env.ts).
- Nilai asli **hanya** disimpan di Vercel → Project Settings → Environment Variables (Production dan Preview dipisah).
- CI tidak butuh secret: memakai nilai dummy karena test me-mock database dan build tidak konek ke database.
- `.env` di-`.gitignore`, dan gitleaks di CI akan gagal kalau ada kredensial ter-commit.

## Logging & monitoring

- **Structured logging** ([`lib/logger.ts`](./lib/logger.ts)): satu baris JSON per event, misalnya
  `transaction.created`, `transaction.create.invalid`, `transaction.create.failed`, `health.database.down`.
  Cari di Vercel → Logs (filter berdasarkan nama event) atau `docker compose logs app`.
- **Health check** `GET /api/health`: `200` jika app & database sehat, `503` jika database tidak bisa dihubungi.
  Dipakai oleh Docker `HEALTHCHECK`, smoke test CI, dan workflow terjadwal di bawah.
- **Keep-alive & uptime check** ([`.github/workflows/keepalive.yml`](./.github/workflows/keepalive.yml)):
  memanggil `/api/health` production setiap 2 hari. Karena endpoint itu menjalankan query, project Supabase gratis
  tidak di-pause karena idle; kalau app/database down, job gagal dan GitHub mengirim email.
  Catatan: GitHub menonaktifkan jadwal di repo publik yang tidak ada aktivitas selama 60 hari.

### Investigasi saat aplikasi error

1. Buka `/api/health` — kalau `database: "down"`, masalah ada di koneksi database (cek status project Supabase, project gratis otomatis di-pause jika tidak aktif).
2. Cari event `*.failed` di Vercel Logs — field `error.message` dan `error.stack` menunjukkan penyebabnya.
3. Reproduksi lokal dengan `docker compose up --build` untuk memisahkan masalah kode vs. infrastruktur.
