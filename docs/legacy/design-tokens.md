# Legacy FRO MES: design tokens and page structure

Source: `docs/legacy/Flowreport MES.html` (saved page of the production FRO MES, Chakra UI v3), rendered with
JavaScript disabled by `scripts/legacy-reference.mjs` (screenshots `reports/legacy/ref-1440.png`,
`ref-1920.png`) and measured with `getComputedStyle` by `scripts/legacy-tokens.mjs`
(`reports/legacy/tokens.json`). The numbers on that page (OEE 344%, PER 435%, ...) are test/bug values and are
NOT copied; only structure and styling are. The CSS version of these tokens is
`src/styles/legacy-fro-tokens.css` (scope `.fro-theme`).

## Palette (Chakra zinc scale) and semantic colours

| Token | Light | Dark (Chakra `.dark` semantic tokens) |
| --- | --- | --- |
| page background | `#ffffff` | `#000000` (bg black) |
| panel / card | `#ffffff` | `#09090b` (gray-950) |
| foreground | `#09090b` | `#fafafa` (gray-50) |
| muted text | `#71717a` (gray-500); labels `rgba(0,0,0,.64)`; secondary `#52525b` | `#a1a1aa` (gray-400) |
| border | `#e4e4e7` (gray-200); card hairline `#fafafa` | `#27272a` (gray-800) |
| muted fill / track | `#f4f4f5` (gray-100) | `#18181b` (gray-900) |
| primary | `#173da6` (blue-700); active tab text `#2563eb` (blue-600) | `#93c5fd` (blue-300) |
| primary subtle (active menu, chips) | `#dbeafe` (blue-100), fg `#173da6` | `#172554` / `#93c5fd` |
| danger | `#dc2626` (red-600); button fill `rgb(228,91,74)` | red-600 |
| success | `#16a34a` (green-600); chip bg `#dcfce7`, fg `#116932` | green-300 on green-950 |
| warning / orange | `#ea580c` (orange-600); "Current" tag bg `#ea580c` | orange-300 on orange-950 |
| remaining-time chip | bg `#ffedd5`, fg `#92310a` | |
| Pause button | border `#fef08a`, text `#713f12` | |
| OEE card background | `#eff6ff` (blue-50) | |

Radii: md `0.375rem`, lg `0.5rem`; chips `0.375rem`, pills `9999px`; buttons and selects `0.5rem`; tab bar `12px`.
Shadow (cards, active tab): `0 2px 4px rgba(24,24,27,.10), 0 0 1px rgba(24,24,27,.30)`.
Font: `Inter`, then `system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif`.

## Key elements (light, measured at 1440 px)

| Element | Measured |
| --- | --- |
| Sidebar | width 69 px, icon rail; item 40x40, radius 6 px, icon colour `rgba(0,0,0,.48)`; active item bg `#dbeafe`, colour `#173da6`, radius `0 6 6 0` with a left indicator; group titles 10 px / 700 / `rgba(0,0,0,.36)`; expanded labels 14 px / 600 |
| Top bar | height 55 px; Week chip: pill, bg `#dbeafe`, text `#173da6` 12 px / 700, padding 4x12; date text 12 px / 600 `#52525b`; avatar circle bg orange-200, text `#92310a` 12 px / 500 |
| Header card | padding 20, radius 6, border 1 px `#fafafa`, shadow as above; title 14 px / 700 uppercase, letter-spacing .8 px, colour `rgba(0,0,0,.8)` |
| Chips | 12 px / 700, padding 2x8, radius 6; plant and zone blue (`#dbeafe` / `#173da6`), line green (`#dcfce7` / `#116932`) |
| Buttons | 12 px / 500, height 32, padding 0x10, radius 8, gap 4; Pause: outline (border `#fef08a`, text `#713f12`); Finish and Broken: solid `rgb(228,91,74)` white text; Counter Detail / Test Print: outline blue (border `#bfdbfe`, text `#173da6`); AMR buttons disabled: bg `#f4f4f5`, border `#d4d4d8`, text `#52525b` |
| Tab bar | track bg `rgba(0,0,0,.06)`, radius 12, height 36; active tab white, text `#2563eb` 14 px / 600, shadow; inactive text `#52525b` 14 px / 500 |
| Shift select | width 250, height 32, border 1 px `#e4e4e7`, radius 8; "Current" tag: bg `#ea580c`, white, 10 px / 500, radius 4; label "LIST SHIFT" 10 px / 600 uppercase `rgba(0,0,0,.64)` |
| Section card | padding 20, radius 6, border `#fafafa`, shadow; title 16 px / 600 `#09090b` with a 32 px tinted icon square |
| Labels | 10 px / 600 uppercase, letter-spacing .8 px, colour `rgba(0,0,0,.64)` |
| Values | 14 px / 700 (counters), 16 px / 700 (run rate), 14 px / 600 (rows, totals), 18 px / 700 (QA counters; released `#116932`, reject `#991919`); reject in red brackets `rgb(255,0,0)` 16 px / 600 |
| Progress tracks | height 10, radius 9999, track `#f4f4f5`; fills: counters and MPQ/shift bars `#173da6`, AVA `#16a34a`, PER `#ea580c`, QUA `#2563eb` |
| Run rate bar | height 10, three segments radius 4: red `rgb(228,91,74)` (50%), green `rgb(139,175,60)` (25%), yellow `rgb(240,180,41)` (25%); a red triangle marker (target) above and a thin line over the bar; yellow triangle at the right end when above the scale |
| PO box | bg `#eff6ff`, radius 8, padding 8x12; SKU title 16 px / 700 uppercase, ellipsis; keys 14 px `#52525b`, values 14 px / 600 |
| Mulai box | bg `#fafafa`, border `#fafafa`, radius 8, padding 10x12 |
| OEE card | bg `#eff6ff`, radius 8, padding 16; SKU/Line switch 66x26 pill (blue when SKU); donut ring (olive/green) with value 33 px / 700 letter-spacing -.8 px |
| Footer | border-top 1 px `#e4e4e7`, padding 16: "Developed by IT Paragon Technology & Innovation" 14 px / 500, "FlowReport" link, version `v4.0.0` |

## Page structure (order as rendered)

**Sidebar (icon rail, logo on top):** Beranda | Produksi: Penimbangan, Pengolahan, **Pengemasan** (active) | Manajemen:
Manajemen Produksi, Manajemen Kemasan, Manajemen Bulk, Manajemen Kualitas, Manajemen Jadwal, Manajemen User | Master: Master Data.

**Top bar:** Week 46 chip, date and time with WIB, theme toggle, avatar `SA`.

**Header card:** icon + "OVERALL EQUIPMENT EFFECTIVENESS" (+ "Menu" button on small screens), chips Liquid Plant /
LIQUID A / JAP03, buttons Pause Work Order and Finish Work Order; tab switcher Dashboard / Reject / Reason; "List Shift"
select (`Current` tag, `Shift test 1 (07:00 – 15:00) · 10 Nov 2026`).

**Block 1, Inline Device Weigher:** Counter + Counter Detail; Innerbox, Karbox, Pallet (value / max, bar); OP Karbox and OP Innerbox
selects; Print Label (Test Print, Broken Inner Box, Broken Cart Box); Autonomous Mobile Robot (Request Material, FG Release A,
FG Release B, Refresh); rows Output IDW, Output OEE, Gap, Total MPQ.

**Block 2, Process Order Performance:** SKU title; Process Order, Material, Sediaan; Run rate SKU (Target, Actual / Standard + bar);
Run rate line (same); Total output with reject and `x / MPQ (y%) total MPQ` bar; Sample, Released, Reject; Mulai and Sisa.

**Block 3, Shift Performance:** Actual output with reject and `x / target (y%)` bar; Shift run rate line (Target, Actual / Standard +
bar); Overall Equipment Effectiveness card with the SKU / Line switch, expand icon, donut, AVA / PER / QUA bars.

**Footer.** Hidden in the DOM: two popovers "Nama QC" (input, placeholder `Masukkan nama QC...`, button `Jalankan`, disabled until
filled) belonging to the AMR buttons **FG Release A** and **FG Release B**.
