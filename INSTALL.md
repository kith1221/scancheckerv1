# ScanChecker — Vercel (Node + Postgres) — INSTALL

Versi cloud dari ScanChecker: backend **Vercel Serverless Functions (Node.js)** + database **Postgres (Neon)**. Ini menggantikan versi PHP+MySQL yang tidak bisa jalan di Vercel.

> Status: **Tahap 1** — Login + Scan (login, logout, sesi session-cookie httpOnly, scan add / cek-duplikat / list hari ini). Fitur lain (kelola user, settings, export xlsx, feedback) menyusul.

---

## 1. Prasyarat

- Akun [Vercel](https://vercel.com) (login via CLI atau dashboard).
- Akun [Neon](https://console.neon.tech) (Postgres gratis / free tier).
- Node.js ≥ 18 terpasang di mesin (uji `node -v`).
- Vercel CLI: `npm install -g vercel` (kalau belum).

---

## 2. Buat database di Neon

1. Login ke Neon → **New Project** → pilih region terdekat → **Create**.
2. Di halaman **Connection Details** (atau tab SQL), pilih region tabel `us-east-1` / sesuai.
3. Salin **connection string**:
   ```
   postgres://USER:PASSWORD@HOST:5432/DBNAME?sslmode=require
   ```
4. Buka tab **SQL Editor** di Neon, tempel isi `schema.sql`, jalankan (Create/Execute).
   - Ini membuat tabel: `users`, `scans`, `settings`, `feedback`, `sessions` + 2 user default (`admin`, `operator1`) dengan hash **placeholder**.

> Penting: hash placeholder di `schema.sql` BUKAN password asli. Setelah skema siap, kamu **wajib** menjalankan seed bcryptjs (step 4) agar bisa login.

---

## 3. Set environment variable

**Variabel:** `DATABASE_URL` (connection string Neon di atas).

- **Lokal (vercel dev):** buat file `.env.local` (salin dari `.env.example`) berisi:
  ```
  DATABASE_URL=postgres://...
  ```
- **Vercel (production):** Dashboard → pilih project → **Settings → Environment Variables** → tambah `DATABASE_URL` untuk environments Production / Preview / Development.

---

## 4. Buat ulang password user (seed bcryptjs)

Hash PHP `$2y$` dinormalkan ke `$2a$` otomatis di `api/_auth.js`, jadi hash bcrypt PHP asli **tetap bisa diverifikasi**. Tapi user default memakai placeholder, jadi set password nyata dengan:

```bash
npm install
node scripts/seed-users.js admin "passwordAnda"
node scripts/seed-users.js operator1 "passwordAnda"
```

Jalankan dengan env `DATABASE_URL` tersedia (`.env.local` dipakai otomatis oleh `vercel dev`; untuk local tanpa vercel dev, set variabel di terminal/mesin).

---

## 5. Jalankan lokal (vercel dev)

```bash
npm install
vercel login           # sekali saja
vercel dev             # atau: npm run dev
```

Buka `http://localhost:3000`. Login di `/login.html`, lalu Scan di `/scan.html?jenis=barang` / `?jenis=retur`.

---

## 6. Deploy ke Vercel

```bash
vercel --prod          # production
# atau cukup: vercel   # preview
```

Setelah deploy, pastikan env `DATABASE_URL` diatur di dashboard (step 3). Buka URL produksi.

---

## Catatan teknis

- **Waktu WIB** dihitung server-side di `api/scan-add.js` (`wibDate()`/`wibTime()`, UTC+7) — bebas bug timezone client.
- **Sesi** pakai cookie httpOnly `sc_session`, token disimpan di tabel `sessions` (7 hari). Logout menghapus sesi & cookie.
- **Deteksi ekspedisi** di frontend via `js/courier.js` (`detectCourier`), ekspedisi disimpan di kolom `ekspedisi`/`ekspedisi_kode`.
- **Kamera QR** memakai `assets/html5-qrcode.min.js`; tombol kamera di halaman scan diinisialisasi bila library tersedia (butuh izin kamera & koneksi HTTPS).
- **Ekspedisi tak dikenal** dianggap `OTHER`/`Lainnya`.

## Struktur folder

```
vercel-app/
  api/                     # serverless functions
    _db.js                 # Pool pg (env DATABASE_URL)
    _auth.js               # verify/hash password + session
    login.js logout.js me.js
    scan-add.js scan-list.js scan-check-duplicate.js
  scripts/seed-users.js    # set password bcryptjs
  css/ js/ assets/         # frontend statis
  login.html index.html scan.html
  schema.sql vercel.json package.json .env.example
```

## Bug / bantuan

Laporkan di repo opencode (issue) atau di menu Feedback (akan hadir di tahap berikutnya).
