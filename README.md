# OEE FRO (Factory Real-time Operations) Dashboard

> **Interactive Frontend Prototype** untuk monitoring Overall Equipment Effectiveness (OEE) multi-pabrik, analisis kerugian produksi, dan antarmuka operator lini (Reason, Reject, Target Output, Summarization). Seluruh data adalah **mock yang deterministik** (seeded, tanpa `Math.random()`); prototype ini menjadi acuan untuk implementasi nyata oleh tim Data/IT.

Branch kerja saat ini: `cr-adjustments` (satu commit per CR). Versi build tampil di sidebar (`BUILD_ID` di `src/lib/oee/build-info.ts`).

---

## Peran dan Halaman

Layout dipilih dari pathname; role hanya mengarahkan (`RoleRouteGuard`).

| Role | Halaman |
| --- | --- |
| **Operator** | `/operator` (pilih line), `/operator/{plant}/{line}` Dashboard, `/reject`, `/reason`, `/hourly`, `/summarization`, `/reconcile` |
| **Shift Leader** | `/live` (Multi Plant), `/live/{plant}`, `/live/{plant}/{zone}`, `/live/.../{line}` (Line Detail), `.../{machine}` (Machine Detail), `/analytics` |
| **Section Head** | semua halaman Shift Leader + `/shift-performance` + `/analytics/pareto` + `/analytics/loss-tree` |
| **Master data** | `/master/reject-config` (konfigurasi slot reject per mesin) |

Jalur SCADA (OEE penuh) hanya untuk line pilot plant J2: **TUP01, TUP13, TUP14, BOP15, BOP16**. Line lain hanya menampilkan IDW.

---

## Fitur

### Operator
- **Dashboard** tiga blok (Inline Device Weigher, Process Order Performance, Shift Performance + kartu OEE). **TOTAL TARGET OUTPUT**, **TOTAL ACTUAL OUTPUT**, **GAP OUTPUT** dan **GAP WAKTU** memakai satu mesin target bersama (CR 5). Switch **SRR Line / SRR SKU**, shift multi-SKU dengan changeover, PO lanjutan, Pause Work Order (mock) dan Finish Work Order yang membekukan nilai.
- **Realisasi per jam** (`/hourly`): tabel per SKU/segmen, tabel per jam, scorecard jam terakhir.
- **Reject**: satu kartu per slot (satu L2 + satu L3), filter chip RM / RP / RS, grafik per jam (Current vs Actual), **Konfigurasi Detail** untuk koreksi per jam dan menit (satu Qty per baris, alasan, nama leader, audit trail).
- **Reason**: Production Timeline, chip Downtime / Minor Stop / Speed Loss, modal Overview (Uncommented / Committed, pilih semua, klasifikasi grup atomik), konfirmasi Planned Downtime, pengingat tagging T-60/30/20/10/0 menjelang akhir shift. Negative Speed Loss hanya terlihat di timeline (tidak bisa diklik, tidak dihitung sebagai action required).
- **Summarization Kemas** (`/summarization`) dengan langkah Sample, Reject, Resume, rekaman kumulatif per PO FG dengan riwayat per shift/Lanjutan, dan **Rekonsiliasi All Batch** (mock) yang terisi otomatis dari summarization terakhir.
- **LIST SHIFT**: shift lampau selalu ditampilkan sampai akhir shift (Reason, Reject, Hourly, Dashboard), aksi dinonaktifkan.

### Shift Leader dan Section Head
Drill-down `Multi Plant` ➔ `Plant` ➔ `Zone` ➔ `Line Detail` ➔ `Machine Detail`, peta lantai produksi isometrik/3D, alarm, OEE Waterfall, Loss Tree, Pareto, Shift Performance. Halaman Loss Clarification bersifat read-only (tagging dilakukan role Operator).

### Master Data Reject
Satu slot = satu pasangan (L2, L3). Pilih L2 dulu, lalu L3 di bawah L2 itu. Setiap L3 milik tepat satu L2; label yang sama di L2 lain adalah entri terpisah dengan id sendiri. Status: Assigned, Unassigned, Incomplete, Duplicate. Ada audit perubahan.

---

## Aturan Bisnis Kunci

- **Satu engine OEE**: `windowEngine.ts`, jendela sampling **30 detik** (`targetCount` = output standar per window).
- `SPT = T - NA - US - PD`, `GOT = SPT - D`, `NOT = GOT - MS - (posSL - negSL)`. Quality berbasis unit: `(unit - reject - rework) / unit`. Performance boleh lebih dari 100%.
- **Downtime** = tidak ada output **lebih dari** 10 menit (> 20 window); **Minor Stop** = 10 menit atau kurang.
- Taksonomi loss: `lossTree.ts` (master v2, label verbatim). Alarm = event downtime (L1 Breakdown), sumber PLC (kode alarm terpetakan) atau Non-PLC (perlu tag operator).
- Label SL/SH: "Machine Output"; halaman operator mengikuti URS ("Total Output", "Output OEE").
- **Asset Management mock** (`assetMaster.ts`): aset representatif (bottleneck), operasi SEQ/OR, **SRR Line**, standar per mesin dan bobot. Line tanpa SRR Line (demo: TUP14) masuk mode **IDW-only**: Dashboard hanya IDW + banner, tab Reason diblokir (modal), Reject tetap terbuka, chip "SRR Line belum terapply" di header.

---

## Panel Simulasi (di atas header operator)

Panel dapat di-minimize (default tertutup, tersimpan per tab). Badge **SIMULATION ACTIVE** muncul di panel dan di header SL/SH saat ada override.

- **Waktu**: pilih tanggal/jam simulasi (shift sekarang dan sebelumnya), play/pause, kecepatan x1 / x5 / x30 / x60 / x300, lompat (awal shift, +15 menit, T-60/30/20/10/0, shift berikutnya), reset ke waktu nyata. Semua kode waktu memakai `getNow()` (`shiftClock.ts`) yang membaca `simStore`.
- **Actual vs Target (%)** (slider 50-130): total actual (gross, sebelum reject) = persen x total target pada scope dan switch SRR yang sama dengan Dashboard. Mode **Hit now** (retro, tepat +-1 pcs, dihitung sekali saat apply) atau **From now on** (hanya window setelah saat apply). Hanya window Effective yang berubah; bila tidak ada window Effective, output disebar ke window Downtime/Minor Stop (status window tidak berubah). Event, tag dan availability/performance OEE tidak berubah. "Reset ke natural" mengembalikan angka asli.
- **SRR**: ubah SRR Line dan SRR per SKU, "Unset SRR Line" (demo mode terblokir), "Unset SRR SKU".
- **Event dan reject**: sisipkan Downtime / Minor Stop / Speed Loss untuk mesin terpilih pada waktu simulasi, reject burst per slot, slider rasio alarm Downtime terhubung PLC, trigger QA alert.
- **Skenario**: Single SKU, 3 SKU + changeover (mockup CR 5), PO lanjutan dari shift sebelumnya.
- **Event density** (Normal / High / Extreme; default High untuk line pilot): loss yang sama dipecah menjadi event pendek bergantian (1-3 menit, atau 30-60 detik); total menit loss dan OEE tidak berubah. Mengubahnya mereset tag, koreksi, counter QA dan summarization setelah konfirmasi.
- **Data**: reset override, reset data demo, export/import seluruh state simulasi (JSON).

Helper konsol: `window.sim`, `window.setSrrLine(plant, line, nilaiAtauNull)`, `window.setViewShift(indeks)`.

---

## Menjalankan

Di mesin ini PowerShell memblokir skrip npm: gunakan `npm.cmd` dan `npx.cmd` (di Bash/terminal lain cukup `npm`/`npx`).

```bash
npm.cmd install
npm.cmd run dev        # http://localhost:3000
npm.cmd run build      # jalankan lewat Bash (memakai rm -rf)
npx.cmd tsc --noEmit   # baseline 347 error (tsconfig strict); tidak boleh bertambah
npm.cmd run lint
```

Setelah `npm run dev`, buka halaman mana pun lalu jalankan di konsol browser (role dipilih lewat sidebar, atau `sessionStorage.setItem('paragon_oee_role','operator')` lalu muat ulang).

### Self-test (dijalankan di konsol browser)

| Fungsi | Isi |
| --- | --- |
| `runOeeSelfTest()` | rumus window engine (termasuk `runTargetSelfTest`) |
| `runParityAudit()` | konsistensi angka antar halaman (harus `[]`) |
| `runTargetSelfTest()` | target output, GAP, SRR, multi-SKU, hourly |
| `runReasonGroupSelfTest()`, `runReminderSelfTest()` | grouping tagging dan pengingat shift |
| `runRejectL2SelfTest()`, `runRejectEditorSelfTest()` | slot reject satu-L2 dan koreksi |
| `runSummarizationSelfTest()` | summarization dan prefill reconcile |
| `runAssetMasterSelfTest()` | master aset, mode operasional, override SRR |
| `runSimSelfTest()`, `runSimPanelSelfTest()`, `runSimOutputSelfTest()` | jam simulasi, density, panel, Actual vs Target |
| `runCalibrationCheck()` | kalibrasi OEE bulanan (lambat, sekitar 17 detik; J4 saat ini sedikit di atas rentang) |

### Audit responsif

`scripts/responsive-audit.mjs` membuka semua halaman untuk tiga role pada lebar 360, 768, 1024, 1280, 1440, 1920 dan 2560 px, menyimpan screenshot ke `reports/responsive/` dan menandai overflow horizontal, rasio lebar konten < 0,92 dan celah kosong > 160 px. Memakai `playwright-core` dan Edge/Chrome yang sudah terpasang. Server dev harus berjalan di port 3000.

```bash
node scripts/responsive-audit.mjs
node scripts/responsive-audit.mjs --roles=operator --widths=360,1280 --routes=dashboard,reject
```

### Zip bersih untuk upload manual ke GitHub

`scripts/make-zip.mjs` membuat zip dari commit terakhir (tanpa `node_modules`, `dist`, `reports`, `.claude`, `.git`), dipecah agar tiap file di bawah 25 MB (batas upload web GitHub): `paragon-fro-oee-code.zip` dan `paragon-fro-oee-docs.zip` di `../paragon-fro-oee-zip/`. Commit dulu; perubahan yang belum di-commit tidak ikut.

```bash
node scripts/make-zip.mjs
```

---

## Struktur Proyek

```
src/
  routes/                file-based routing (TanStack); daftarkan route baru di routeTree.gen.ts
  components/oee/        komponen SL/SH, panel peta, charts
  components/oee/operator/   halaman dan kartu operator, SimulationPanel
  components/ui/         primitif UI (shadcn)
  lib/oee/               engine dan store: windowEngine, machineEvents, targetEngine/Service,
                         rejectStore/ConfigStore, reasonTagStore, simStore, assetMaster, ...
docs/                    URS, CR (PDF), mapping Excel, screenshot, mockup HTML (docs/cr/mockups)
scripts/                 prod-server.js, copy-build-artifacts.js, responsive-audit.mjs, make-zip.mjs
```

## Tech Stack

React 19, TanStack Start / Router, Vite, Tailwind CSS v4, shadcn/ui (Radix), Recharts, Lucide, three.js untuk adegan 3D, `playwright-core` untuk audit responsif.

## Aturan Kontribusi

- Jangan pakai `Math.random()`; pakai `src/lib/oee/rng.ts` (seeded). Tidak boleh ada flicker atau remount adegan 3D pada tick live.
- Setiap file baru di `src/routes` wajib didaftarkan di `src/routeTree.gen.ts` pada perubahan yang sama.
- Naikkan `BUILD_ID` dan tambah flag `FEATURES` di `build-info.ts` pada setiap perubahan.
- Satu engine OEE saja (`windowEngine.ts`); jangan menduplikasi rumus target di komponen.
- Detail alur kerja CR dan batasan lain ada di `CLAUDE.md`, `AGENTS.md` dan `roadmap.md`.
