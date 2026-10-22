# Pembaruan keamanan — 22 Oktober 2026

## Hasil verifikasi
- Node.js pengujian: 26.12.1, Linux. Windows perlu uji ulang lokal.
- Build berhasil dengan NestJS 12.2.0 dan TypeScript 6.0.3.
- 5 smoke test lulus: health HTTP, UUID request ID, penerusan request ID, respons 404, middleware audit pada route API bertingkat, serta bcrypt (dua pemeriksaan request ID dalam rangkaian HTTP).
- npm audit seluruh dependency: 0 vulnerability pada waktu pemeriksaan. Laporan lengkap: verification/npm-audit.json. Hasil audit dapat berubah saat advisory baru terbit.
- Tidak memakai --force, --legacy-peer-deps, atau overrides untuk menyembunyikan konflik.

## Perubahan
- Paket NestJS inti/pendamping ke versi kompatibel 12; throttler 6.7.1.
- bcrypt 6.0.0 dipertahankan; Axios 1.20.0; TypeORM tetap pada 0.3.31.
- UUID aplikasi menggunakan node:crypto randomUUID; paket uuid langsung dan types-nya dihapus. UUID internal dependency tetap dikelola paket induknya.
- Middleware api/* diubah ke api/{*path}, kompatibel Express 5; query parser extended dipertahankan.
- Import compression diperbaiki untuk interop CommonJS/ESM.
- TypeScript 6: rootDir build eksplisit, strict false mempertahankan default konfigurasi lama, esModuleInterop true, ignoreDeprecations 6.0 untuk opsi lama. Aplikasi tetap CommonJS.
- Docker builder/runtime memakai node:26.12.1-alpine; .nvmrc dan engines menentukan Node 26.12.1+. .dockerignore mengecualikan env, git, node_modules, dan hasil build.
- Jest/ts-jest beserta test Hello World diganti Node test runner. Tidak ada test bisnis lain dalam ZIP awal. Test baru memakai repository palsu dan tidak menghubungi database/ERP.

## Cara menerapkan
1. Backup/commit pekerjaan pada branch maintenance. Ekstrak ZIP ke folder pengujian baru atau salin file yang berubah ke branch maintenance.
2. Pastikan `node -v` menunjukkan v26.12.1 atau versi 26.x lebih baru.
3. Jalankan `npm ci` memakai package.json DAN package-lock.json dari ZIP ini.
4. Jalankan `npm test` (termasuk build), lalu `npm audit` dan `npm audit --omit=dev`.
5. Salin konfigurasi env secara lokal untuk staging. Uji login/token lama, scope akses, API produk/penjualan/stok, Swagger, database, serta scheduler.
6. Setelah uji staging lulus, deploy dan restart service agar memakai Node baru. Untuk Docker, rebuild image; Docker build belum diuji di lingkungan ini.

PERHATIAN: startup asli menjalankan pemeriksaan data dan bisa memulai full sync otomatis jika database kosong. Gunakan database staging dan endpoint ERP pengujian saat uji integrasi. Pengujian otomatis yang disertakan tidak memulai AppModule penuh atau sinkronisasi.

## Batas verifikasi
Koneksi PostgreSQL, Redis, ERP, autentikasi end-to-end dengan data nyata, scheduler, migration CLI terhadap database, dan image Docker belum diuji. Build/smoke test/audit bersih bukan jaminan seluruh alur bisnis sudah terverifikasi. Script lint lama tetap memerlukan konfigurasi ESLint yang tidak disertakan dalam ZIP awal.

## File lama yang dihapus
Jika menimpa folder lama, hapus test/app.e2e-spec.ts dan test/jest-e2e.json (test contoh Jest). `npm test` baru memakai test/migration.test.cjs.

## File berubah dari ZIP awal
- MODIFIED Dockerfile
- MODIFIED package.json
- MODIFIED package-lock.json
- MODIFIED tsconfig.build.json
- MODIFIED tsconfig.json
- MODIFIED src/app.module.ts
- MODIFIED src/common/filters/http-exception.filter.ts
- MODIFIED src/common/interceptors/response-transform.interceptor.ts
- MODIFIED src/main.ts
- REMOVED test/app.e2e-spec.ts
- REMOVED test/jest-e2e.json
