#!/usr/bin/env node
/**
 * Responsive audit: opens every route for the three roles at seven widths, takes screenshots and
 * reports per page (1) horizontal overflow, (2) content width / available width on wide viewports
 * (flag < 0.92) and (3) empty vertical gaps larger than 160 px between sections (also a void below
 * the last section on a tall viewport). Uses playwright-core with the system Edge or Chrome.
 *
 *   node scripts/responsive-audit.mjs                       # everything
 *   node scripts/responsive-audit.mjs --roles=operator --widths=360,1280 --routes=dashboard,reject
 *   BASE_URL=http://localhost:3000 node scripts/responsive-audit.mjs
 *
 * Output: reports/responsive/<role>/<route>-<width>.png and reports/responsive/report.json.
 * Exit code 1 when any flag is raised.
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const OUT = path.resolve("reports/responsive");
const WIDTHS = [360, 768, 1024, 1280, 1440, 1920, 2560];
const arg = (n) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split("=")[1]?.split(",");

const LINE = "BOP16";
const ZONE = "B";
const OPERATOR_ROUTES = [
  { id: "line-picker", url: "/operator" },
  { id: "dashboard", url: `/operator/J2/${LINE}` },
  { id: "dashboard-sim-open", url: `/operator/J2/${LINE}`, session: { fro_sim_panel_open: "1" } },
  { id: "dashboard-idw-only", url: "/operator/J2/TUP14" },
  { id: "reject", url: `/operator/J2/${LINE}/reject` },
  { id: "reason", url: `/operator/J2/${LINE}/reason` },
  { id: "hourly", url: `/operator/J2/${LINE}/hourly` },
  { id: "summarization", url: `/operator/J2/${LINE}/summarization` },
  { id: "reconcile", url: `/operator/J2/${LINE}/reconcile` },
  { id: "modal-konfigurasi-detail", url: `/operator/J2/${LINE}/reject`, modal: "konfigurasi" },
  { id: "modal-classify", url: `/operator/J2/${LINE}/reason`, modal: "overview" },
];
const SLSH_ROUTES = [
  { id: "multi-plant", url: "/live" },
  { id: "plant", url: "/live/J2" },
  { id: "zone", url: `/live/J2/${ZONE}` },
  { id: "line-detail", url: `/live/J2/${ZONE}/${LINE}` },
  { id: "machine-detail", url: `/live/J2/${ZONE}/${LINE}/SHR01` },
  { id: "analytics", url: "/analytics" },
  { id: "analytics-pareto", url: "/analytics/pareto" },
  { id: "analytics-loss-tree", url: "/analytics/loss-tree" },
  { id: "shift-performance", url: "/shift-performance" },
  { id: "master-reject-config", url: "/master/reject-config" },
];
const ROLES = {
  operator: OPERATOR_ROUTES,
  "shift-leader": SLSH_ROUTES,
  "section-head": SLSH_ROUTES,
};

const selRoles = arg("roles") || Object.keys(ROLES);
const selWidths = (arg("widths") || WIDTHS).map(Number);
const selRoutes = arg("routes");

/** Runs inside the page. */
function measure() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const doc = document.documentElement;
  let overflowPx = Math.max(doc.scrollWidth, document.body.scrollWidth) - vw;
  // content cut off by overflow-x-hidden on the page main area counts as overflow too
  for (const m of document.querySelectorAll("main")) overflowPx = Math.max(overflowPx, m.scrollWidth - m.clientWidth);

  const visible = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    const cs = getComputedStyle(el);
    return cs.visibility !== "hidden" && cs.display !== "none" && Number(cs.opacity) > 0.05;
  };
  // fixed side bars (operator rail, SL/SH sidebar) are not part of the content area
  let sideW = 0;
  for (const el of document.querySelectorAll("aside, nav, div")) {
    const cs = getComputedStyle(el);
    if (cs.position !== "fixed") continue;
    const r = el.getBoundingClientRect();
    if (r.left <= 1 && r.height >= vh * 0.8 && r.width < vw * 0.5) sideW = Math.max(sideW, r.right);
  }
  // dashboards use a sidebar that is a sticky/flex child on large screens
  if (sideW === 0) {
    const sb = document.querySelector("aside");
    if (sb && visible(sb)) {
      const r = sb.getBoundingClientRect();
      if (r.left <= 1 && r.width < vw * 0.5) sideW = r.right;
    }
  }
  const available = vw - sideW;

  // content leaves: elements that directly hold text or are media/controls, outside fixed layers
  const leaves = [];
  const all = document.body.querySelectorAll("*");
  for (const el of all) {
    if (el.closest("[role=dialog], [data-radix-popper-content-wrapper], [data-sonner-toaster], nav[aria-label=breadcrumb]")) continue;
    const tag = el.tagName;
    let isLeaf = false;
    if (["IMG", "CANVAS", "SVG", "TABLE", "INPUT", "SELECT", "TEXTAREA", "BUTTON", "VIDEO"].includes(tag.toUpperCase())) isLeaf = true;
    else {
      for (const n of el.childNodes) if (n.nodeType === 3 && n.textContent.trim().length > 1) isLeaf = true;
    }
    if (!isLeaf || !visible(el)) continue;
    let fixed = false;
    for (let p = el; p && p !== document.body; p = p.parentElement) {
      if (getComputedStyle(p).position === "fixed") {
        fixed = true;
        break;
      }
    }
    if (fixed) continue;
    const r = el.getBoundingClientRect();
    // ignore anything positioned outside the document (off-screen helpers)
    if (r.top + window.scrollY > Math.max(doc.scrollHeight, document.body.scrollHeight) + 2 || r.bottom + window.scrollY < 0) continue;
    leaves.push({ top: r.top + window.scrollY, bottom: r.bottom + window.scrollY, left: r.left, right: r.right });
  }

  let minL = Infinity;
  let maxR = 0;
  for (const l of leaves) {
    if (l.left < sideW - 1) continue;
    minL = Math.min(minL, l.left);
    maxR = Math.max(maxR, l.right);
  }
  const contentW = leaves.length ? Math.max(0, Math.min(maxR, vw) - Math.max(minL, sideW)) : 0;
  const ratio = available > 0 ? contentW / available : 1;

  // panels (bordered / filled boxes) count as content for vertical gaps: a card that fills the page is not a void
  const docH0 = Math.max(doc.scrollHeight, document.body.scrollHeight);
  const boxes = [];
  for (const el of all) {
    if (el.closest("[role=dialog], [data-radix-popper-content-wrapper], [data-sonner-toaster]")) continue;
    if (!visible(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 60 || r.height < 24) continue;
    if (r.height > docH0 * 0.85 && r.width > vw * 0.6) continue; // page wrappers
    if (r.width >= vw * 0.99 && r.height > vh * 0.8) continue;
    const cs = getComputedStyle(el);
    if (cs.position === "fixed") continue;
    const bw = parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth) + parseFloat(cs.borderLeftWidth);
    const bg = cs.backgroundColor.match(/[d.]+/g) || [];
    const alpha = bg.length >= 4 ? Number(bg[3]) : bg.length === 3 ? 1 : 0;
    if (bw > 0 || alpha > 0.05 || (cs.boxShadow && cs.boxShadow !== "none")) {
      if (r.left < sideW - 1) continue;
      boxes.push({ top: r.top + window.scrollY, bottom: r.bottom + window.scrollY, left: r.left, right: r.right });
    }
  }
  // vertical gaps: merge the y-intervals of all leaves and panels, report gaps between them
  const iv = [...leaves, ...boxes].filter((l) => l.left >= sideW - 1).sort((a, b) => a.top - b.top);
  const gaps = [];
  let curEnd = iv.length ? iv[0].bottom : 0;
  for (const l of iv) {
    if (l.top - curEnd > 160) gaps.push({ at: Math.round(curEnd), height: Math.round(l.top - curEnd) });
    curEnd = Math.max(curEnd, l.bottom);
  }
  const docH = Math.max(doc.scrollHeight, document.body.scrollHeight);
  const lastBottom = iv.length ? Math.max(...iv.map((l) => l.bottom)) : 0;
  const bottomVoid = Math.max(0, Math.min(docH, Math.max(vh, docH)) - lastBottom);
  // a short page must still fill the viewport: the area below the last block counts as a void
  const voidBelow = docH <= vh + 2 ? Math.round(vh - lastBottom) : 0;

  const small = [];
  if (vw <= 768) {
    for (const el of document.querySelectorAll("button, a[href], select, input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=range]):not([type=file]), [role=tab], [role=switch]")) {
      if (!visible(el) || el.closest("table, [data-radix-popper-content-wrapper]")) continue;
      const r = el.getBoundingClientRect();
      if (r.height < 40 && r.width < 40 * 3) small.push((el.getAttribute("aria-label") || el.textContent || el.tagName).trim().slice(0, 30));
    }
  }
  // modal fits
  const dlg = document.querySelector("[role=dialog]");
  let modal = null;
  if (dlg) {
    const r = dlg.getBoundingClientRect();
    modal = { left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width), overflowX: dlg.scrollWidth > dlg.clientWidth + 1, fits: r.left >= -1 && r.right <= vw + 1 };
  }
  return {
    vw,
    vh,
    overflowPx: Math.round(overflowPx),
    sideW: Math.round(sideW),
    available: Math.round(available),
    contentW: Math.round(contentW),
    ratio: Number(ratio.toFixed(3)),
    gaps,
    docH,
    voidBelow,
    bottomVoid: Math.round(bottomVoid),
    smallTargets: small.length,
    smallSample: small.slice(0, 6),
    modal,
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const browser = await chromium.launch({ channel: fs.existsSync("C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe") ? "msedge" : "chrome", headless: true });

for (const role of selRoles) {
  const routes = ROLES[role].filter((r) => !selRoutes || selRoutes.includes(r.id));
  fs.mkdirSync(path.join(OUT, role), { recursive: true });
  for (const route of routes) {
    for (const width of selWidths) {
      const height = { 360: 800, 768: 1024, 1024: 768, 1280: 800, 1440: 900, 1920: 1080, 2560: 1440 }[width] || 900;
      const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
      await ctx.addInitScript(
        ([r, session]) => {
          try {
            sessionStorage.setItem("paragon_oee_role", r);
            for (const [k, v] of Object.entries(session || {})) sessionStorage.setItem(k, v);
          } catch {
            // ignore
          }
        },
        [role, route.session || {}],
      );
      const page = await ctx.newPage();
      const errors = [];
      page.on("console", (m) => m.type() === "error" && !/Failed to load resource/.test(m.text()) && errors.push(m.text().slice(0, 160)));
      page.on("pageerror", (e) => errors.push(String(e).slice(0, 160)));
      let m = null;
      try {
        await page.goto(BASE + route.url, { waitUntil: "load", timeout: 30000 });
        await sleep(2200);
        // dismiss the mandatory QA dialog on the operator dashboard so the page is measurable
        if (role === "operator" && !route.modal) {
          for (let i = 0; i < 3; i++) {
            const qa = page.getByText("Submit QA Inspection");
            if (!(await qa.count())) break;
            await page.getByText("Released", { exact: true }).first().click({ timeout: 1500 }).catch(() => {});
            await qa.first().click({ timeout: 1500 }).catch(() => {});
            await sleep(400);
          }
        }
        if (route.modal === "konfigurasi") {
          await page.getByText("Konfigurasi Detail").first().click({ timeout: 4000 }).catch(() => {});
          await sleep(700);
        }
        if (route.modal === "overview") {
          await page.locator("button", { hasText: /Speed Loss ·/ }).first().click({ timeout: 4000 }).catch(() => {});
          await sleep(700);
        }
        m = await page.evaluate(measure);
        const file = path.join(OUT, role, `${route.id}-${width}.png`);
        await page.screenshot({ path: file, fullPage: true });
        m.file = path.relative(process.cwd(), file).replaceAll("\\", "/");
      } catch (e) {
        m = { error: String(e).slice(0, 200) };
      }
      const flags = [];
      if (m.error) flags.push(`error: ${m.error}`);
      else {
        if (m.overflowPx > 1) flags.push(`overflow ${m.overflowPx}px`);
        if (m.vw >= 1280 && !route.modal && m.ratio < 0.92) flags.push(`width ratio ${m.ratio}`);
        if (!route.modal && m.gaps.length) flags.push(`gap ${m.gaps.map((g) => g.height).join("/")}px`);
        if (!route.modal && m.voidBelow > 160) flags.push(`void below ${m.voidBelow}px`);
        if (m.modal && (!m.modal.fits || m.modal.overflowX)) flags.push("modal does not fit");
      }
      results.push({ role, route: route.id, width, flags, errors, ...m });
      process.stdout.write(`${flags.length ? "FLAG" : " ok "} ${role}/${route.id}@${width} ${flags.join("; ")}${errors.length ? ` [console: ${errors.length}]` : ""}\n`);
      await ctx.close();
    }
  }
}
await browser.close();

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, `report-${selRoles.join("+")}.json`), JSON.stringify(results, null, 2));
const flagged = results.filter((r) => r.flags.length);
const consoleErr = results.filter((r) => r.errors?.length);
const small = results.filter((r) => r.smallTargets > 0);
console.log(`\n${results.length} page checks, ${flagged.length} flagged, ${consoleErr.length} with console errors, ${small.length} with tap targets < 40px (info).`);
process.exit(flagged.length ? 1 : 0);
