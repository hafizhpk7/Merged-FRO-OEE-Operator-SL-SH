# OEE FRO (Factory Real-time Operations) Dashboard

> **Interactive Frontend Prototype** untuk sistem monitoring Overall Equipment Effectiveness (OEE) multi-pabrik dan analisis kerugian produksi (_Loss Analysis_).

---

## 🎯 Target Pengguna & Persona

1. **Shift Leader**  
   Fokus pada operasional _real-time_ per shift di zona yang ditugaskan:
   - Pemantauan status mesin (_Running, Slow, Down, Idle_)
   - Peta lantai produksi isometrik interaktif (zoom & pan)
   - Indikator sensor dan alarm aktif

2. **Section Head**  
   Fokus pada evaluasi lintas zona dan analisis performa periodik:
   - Agregasi performa multi-plant (Group Site & Plant View)
   - Analisis _OEE Waterfall_ & hierarki _Loss Tree_
   - Analisis akar masalah (_Root Cause Pareto Analysis_)
   - Perbandingan _Shift Performance_

---

## ✨ Fitur Utama

- **Control Tower Full-Screen Layout**: Tampilan tanpa batas margin sempit, optimal untuk TV display di control room pabrik maupun desktop workstation.
- **Multi-Level Drill-Down**: Navigasi hierarkis lengkap:  
  `Multi Plant` ➔ `Plant View` ➔ `Zone View` ➔ `Line Detail` ➔ `Machine Detail`.
- **Interactive Isometric Floor Map**: Visualisasi denah pabrik bergaya 3D berbasis proyeksi murni **Isometric SVG** yang sangat ringan (responsif, mendukung mouse-wheel zoom & drag-to-pan tanpa beban GPU 3D).
- **OEE Waterfall & Loss Tree**: Sinkronisasi alur waktu operasi (_Calendar Time_ hingga _Effective Time_) serta pengelompokan breakdown kerugian operasional.
- **Cascading Filter & Quick Switcher**: Filter dinamis (Plant, Zone, Line, SKU, rentang tanggal) serta penggantian role & dark/light mode secara instan via sidebar.

---

## 🛠️ Tech Stack

- **Framework**: [React 19](https://react.dev/) + [TanStack Start / Router](https://tanstack.com/router)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Charts**: [Recharts](https://recharts.org/) & Lucide React Icons
- **Visualisasi Peta**: Pure SVG Mathematical Isometric Projection
