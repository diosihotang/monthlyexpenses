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

## Akses & proteksi

Seluruh aplikasi (halaman dan Server Actions) dilindungi HTTP Basic Auth lewat [`middleware.ts`](./middleware.ts).
Tanpa proteksi ini, siapa pun yang tahu URL bisa menambah/menghapus transaksi, karena Server Actions
berjalan di server dengan kredensial database. Browser sendiri tidak pernah konek langsung ke Supabase.

- Kredensial dari env `BASIC_AUTH_USER` dan `BASIC_AUTH_PASSWORD`; kalau belum di-set, aplikasi membalas `503` (fail closed).
- Pengecualian: `GET /api/health` tetap publik untuk monitoring dan tidak menampilkan data.
- Docker lokal memakai `admin` / `admin` (lihat `docker-compose.yml`).

## Environment & secrets

- Secret: `DATABASE_URL`, `BASIC_AUTH_USER`, `BASIC_AUTH_PASSWORD`. `DATABASE_URL` divalidasi saat start oleh [`lib/env.ts`](./lib/env.ts).
- Nilai asli **hanya** disimpan di Vercel → Project Settings → Environment Variables (Production dan Preview dipisah).
- CI tidak butuh secret: memakai nilai dummy karena test me-mock database dan build tidak konek ke database.
- `.env` di-`.gitignore`, dan gitleaks di CI akan gagal kalau ada kredensial ter-commit.

## Logging & monitoring

- **Structured logging** ([`lib/logger.ts`](./lib/logger.ts)): satu baris JSON per event, misalnya
  `transaction.created`, `transaction.create.invalid`, `transaction.create.failed`, `health.database.down`.
  Cari di Vercel → Logs (filter berdasarkan nama event) atau `docker compose logs app`.
- **Health check** `GET /api/health`: `200` jika app & database sehat, `503` jika database tidak bisa dihubungi.
  Dipakai oleh Docker `HEALTHCHECK`, smoke test CI, dan bisa didaftarkan ke uptime monitor (mis. UptimeRobot).

### Investigasi saat aplikasi error

1. Buka `/api/health` — kalau `database: "down"`, masalah ada di koneksi database (cek status project Supabase, project gratis otomatis di-pause jika tidak aktif).
2. Cari event `*.failed` di Vercel Logs — field `error.message` dan `error.stack` menunjukkan penyebabnya.
3. Reproduksi lokal dengan `docker compose up --build` untuk memisahkan masalah kode vs. infrastruktur.
