#!/usr/bin/env node
/**
 * Legacy-compare: the saved MES page (docs/legacy/Flowreport MES.html, JS disabled) against the app
 * Main Dashboard in "old" version (role operator, J2 pilot line) at 1440x900 and 1920x1080.
 *
 *   BASE_URL=http://localhost:3000 node scripts/legacy-compare.mjs [--strict]
 *
 * Output: reports/legacy/compare-<width>-{ref,app-old}.png, app-new-<width>.png, toggle-old.png,
 * toggle-new.png, reports/legacy/compare-report.json and a printed list of every difference.
 * Thresholds: block boxes within 16 px, colors within 4 per RGB channel, fonts and radii equal,
 * every static label present in the same order.
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright-core";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const OUT = path.resolve("reports/legacy");
fs.mkdirSync(OUT, { recursive: true });
const html = path.resolve("docs/legacy/Flowreport MES.html");
const logo = fs.readFileSync(path.resolve("docs/legacy/logo-long.png"));
const BOX_TOL = 16;
const COLOR_TOL = 4;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Static labels of the saved page, in page order (dynamic values such as numbers, SKU, shift are left out). */
const LABELS = [
  "Beranda", "Produksi", "Penimbangan", "Pengolahan", "Pengemasan", "Manajemen", "Manajemen Produksi",
  "Manajemen Kemasan", "Manajemen Bulk", "Manajemen Kualitas", "Manajemen Jadwal", "Manajemen User", "Master", "Master Data",
  "Overall Equipment Effectiveness", "Menu", "Pause Work Order", "Finish Work Order", "Dashboard", "Reject", "Reason", "List Shift", "Current",
  "Inline Device Weigher", "Counter", "Counter Detail", "Innerbox", "Karbox", "Pallet", "OP Karbox", "OP Innerbox", "Print Label",
  "Test Print", "Broken Inner Box", "Broken Cart Box", "Autonomous Mobile Robot", "Request Material", "FG Release A", "FG Release B", "Refresh",
  "Output IDW", "Output OEE", "Gap", "Total MPQ",
  "Process Order Performance", "Process Order", "Material", "Sediaan", "Run rate SKU", "Target", "Actual / Standard", "Run rate line",
  "Total output", "Sample", "Released", "Reject", "Mulai",
  "Shift Performance", "Actual output", "Shift run rate line", "Overall Equipment Effectiveness", "SKU", "Line", "AVA", "PER", "QUA",
  "Developed by IT Paragon Technology & Innovation", "FlowReport", "v4.0.0",
];

/** Runs inside the page: ordered visible text, block boxes and computed styles of key elements (same finders for both pages). */
function measure() {
  const norm = (c) => {
    const cv = document.createElement("canvas");
    cv.width = cv.height = 1;
    const g = cv.getContext("2d", { willReadFrequently: true });
    g.clearRect(0, 0, 1, 1);
    g.fillStyle = "rgba(0,0,0,0)";
    g.fillStyle = c;
    g.fillRect(0, 0, 1, 1);
    const d = g.getImageData(0, 0, 1, 1).data;
    if (d[3] === 0) return "transparent";
    const a = d[3] / 255;
    return [0, 1, 2].map((i) => Math.round(d[i] * a + 255 * (1 - a))).join(","); // composited over white
  };
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return false;
    const cs = getComputedStyle(el);
    return cs.visibility !== "hidden" && cs.display !== "none";
  };
  const skip = (el) => el.closest('[data-testid="sim-panel"], script, style, [data-sonner-toaster], [data-testid="role-switcher"]');
  const own = (el) => [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join("").replace(/\s+/g, " ").trim();

  // ordered visible text (element-level own text)
  const texts = [];
  const domTexts = [];
  const walk = (el, vis) => {
    if (skip(el)) return;
    const v = vis && visible(el);
    const t = own(el);
    if (t) {
      domTexts.push(t.toLowerCase());
      if (v) texts.push(t.toLowerCase());
    }
    for (const c of el.children) walk(c, v);
  };
  walk(document.body, true);

  const sx = window.scrollX;
  const sy = window.scrollY;
  const rectOf = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x + sx), y: Math.round(r.y + sy), w: Math.round(r.width), h: Math.round(r.height) };
  };
  const all = [...document.querySelectorAll("body *")].filter((e) => !skip(e) && visible(e));
  const byText = (txt, nth = 0) => {
    const re = txt instanceof RegExp ? txt : null;
    const m = all.filter((e) => {
      const t = own(e);
      return re ? re.test(t) : t.toLowerCase() === txt.toLowerCase();
    });
    return m[nth] ?? null;
  };
  const up = (el, test, max = 14) => {
    for (let e = el, i = 0; e && i < max; e = e.parentElement, i++) if (test(e)) return e;
    return null;
  };
  const bw = (e) => parseFloat(getComputedStyle(e).borderTopWidth) > 0;
  const rad = (e) => parseFloat(getComputedStyle(e).borderTopLeftRadius) > 0;
  const wide = (e, w) => e.getBoundingClientRect().width > w;
  const card = (e) => bw(e) && rad(e) && wide(e, 250);
  const coloured = (e) => getComputedStyle(e).backgroundColor !== "rgba(0, 0, 0, 0)";
  const closestBtn = (el) => (el ? el.closest("button, a") || el : null);

  const sideTop = document.elementFromPoint(5, 5);
  let sidebarEl = sideTop;
  while (sidebarEl && sidebarEl.parentElement && sidebarEl.parentElement.getBoundingClientRect().width < 200) sidebarEl = sidebarEl.parentElement;
  let sidebarRect = rectOf(sidebarEl);
  if (sidebarEl && sidebarRect && getComputedStyle(sidebarEl).position === "fixed") sidebarRect.y = Math.round(sidebarEl.getBoundingClientRect().y);
  if (sidebarEl && sidebarEl.nextElementSibling && Math.abs(sidebarEl.nextElementSibling.getBoundingClientRect().width - sidebarEl.getBoundingClientRect().width) < 2 && sidebarRect && sidebarRect.h < 100) {
    const n = rectOf(sidebarEl.nextElementSibling);
    sidebarRect = { x: sidebarRect.x, y: sidebarRect.y, w: sidebarRect.w, h: n.y + n.h - sidebarRect.y };
  }

  const week = byText(/^Week \d+$/);
  const oee0 = byText("Overall Equipment Effectiveness", 0);
  const oee1 = byText("Overall Equipment Effectiveness", 1);
  const dash = byText("Dashboard");
  const tabBar = up(dash, (e) => wide(e, 250) && coloured(e), 6);
  const qaLabel = (name) => byText(name, name === "Reject" ? 1 : 0);

  const boxes = {
    sidebar: sidebarRect,
    topBar: rectOf(week ? week.closest("nav") : null),
    headerCard: rectOf(up(oee0, card)),
    tabs: rectOf(tabBar),
    idwCard: rectOf(up(byText("Inline Device Weigher"), card)),
    poCard: rectOf(up(byText("Process Order Performance"), card)),
    shiftCard: rectOf(up(byText("Shift Performance"), card)),
    oeeCard: rectOf(up(byText("SKU"), (e) => coloured(e) && wide(e, 300), 10)),
    footer: rectOf(up(byText("Developed by IT Paragon Technology & Innovation"), (e) => e.tagName === "FOOTER" || (wide(e, 600) && bw(e)), 6)),
  };

  const S = (el, kind = "text") => {
    if (!el) return null;
    const cs = getComputedStyle(el);
    const o = {
      color: norm(cs.color),
      font: cs.fontFamily.split(",")[0].replace(/["']/g, "").trim(),
      size: cs.fontSize,
      weight: String(Number(cs.fontWeight)),
    };
    if (kind === "box") {
      o.bg = norm(cs.backgroundColor);
      o.radius = cs.borderTopLeftRadius;
      o.border = parseFloat(cs.borderTopWidth) > 0 ? norm(cs.borderTopColor) : "none";
    }
    return o;
  };
  const sib = (el) => (el ? el.nextElementSibling : null);
  const bigPct = all.find((e) => /^\d+(\.\d+)?%$/.test(own(e)) && parseFloat(getComputedStyle(e).fontSize) > 30);
  const selectBox = (() => {
    const s0 = document.querySelector("select");
    if (s0 && visible(s0)) return up(s0, (e) => bw(e) && rad(e) && wide(e, 100), 4);
    return up(byText("ABCD"), (e) => bw(e) && rad(e) && wide(e, 100), 6);
  })();
  const styles = {
    weekChip: S(week, "box"),
    dateText: S(byText(/^Tuesday, 10 November 2026/)),
    headerCard: S(up(oee0, card), "box"),
    headerTitle: S(oee0),
    chipPlant: S(byText("Liquid Plant"), "box"),
    chipZone: S(byText("LIQUID A"), "box"),
    chipLine: S(byText(/^(JAP03|TUP01)$/), "box"),
    btnPause: S(closestBtn(byText("Pause Work Order")), "box"),
    btnFinish: S(closestBtn(byText("Finish Work Order")), "box"),
    tabBar: S(tabBar, "box"),
    tabActive: S(closestBtn(dash), "box"),
    tabText: S(byText("Reject", 0)),
    shiftLabel: S(byText("List Shift")),
    currentTag: S(byText("Current"), "box"),
    shiftSelect: S(up(byText("Current"), (e) => bw(e) && wide(e, 150), 8), "box"),
    sectionCard: S(up(byText("Inline Device Weigher"), card), "box"),
    sectionTitle: S(byText("Inline Device Weigher")),
    labelCounter: S(byText("Counter")),
    labelInnerbox: S(byText("Innerbox")),
    valueInnerbox: S(byText(/^\d+ \/ 12$/)),
    btnCounterDetail: S(closestBtn(byText("Counter Detail")), "box"),
    selectBox: S(selectBox, "box"),
    btnTestPrint: S(closestBtn(byText("Test Print")), "box"),
    btnBroken: S(closestBtn(byText("Broken Inner Box")), "box"),
    btnAmr: S(closestBtn(byText("Request Material")), "box"),
    btnRefresh: S(closestBtn(byText("Refresh")), "box"),
    rowLabel: S(byText("Output IDW")),
    rowValue: S(sib(byText("Output OEE"))),
    poTitleBox: S(up(byText("Process Order"), (e) => coloured(e) && wide(e, 300), 5), "box"),
    poKey: S(byText("Process Order")),
    poValue: S(byText(/^2100000403\d\d$/)),
    runRateTitle: S(byText("Run rate SKU")),
    runRateTarget: S(byText("Target")),
    runRateActualLabel: S(byText("Actual / Standard")),
    totalOutputLabel: S(byText("Total output")),
    totalReject: S(byText(/^\(\d[\d,]*\)$/)),
    qaSampleLabel: S(qaLabel("Sample")),
    qaSampleValue: S(sib(qaLabel("Sample"))),
    qaReleasedValue: S(sib(qaLabel("Released"))),
    qaRejectValue: S(sib(qaLabel("Reject"))),
    mulaiBox: S(up(byText("Mulai"), (e) => coloured(e) && wide(e, 250), 4), "box"),
    sisaChip: S(up(byText(/^Sisa /), coloured, 3), "box"),
    oeeCard: S(up(byText("SKU"), (e) => coloured(e) && wide(e, 300), 10), "box"),
    oeeValue: S(bigPct),
    avaLabel: S(byText("AVA")),
    avaValue: S(sib(byText("AVA"))),
    footerText: S(byText("Developed by IT Paragon Technology & Innovation")),
    footerLink: S(byText("FlowReport")),
    footerVersion: S(byText("v4.0.0")),
  };
  return { texts, domTexts, boxes, styles, doc: { w: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight } };
}

const toRGB = (s) => (s === "transparent" || s === "none" ? null : s.split(",").map(Number));

const deviations = [];
function compare(ref, app, tag, vh) {
  const diffs = [];
  // The app fills the viewport (no blank area below the cards, requirement of the responsive pass), so a
  // short page stretches the three cards and moves the footer; the reference leaves a blank area there.
  const stretched = app.doc.h <= vh + 1;
  // labels: ordered subsequence. A label visible in the reference must be visible in the app in the same
  // order; a label that is hidden in the reference (collapsed sidebar menu, mobile Menu button) must exist
  // in the app DOM in the same order.
  const orderCheck = (list, refList, appList, what) => {
    let rp = 0;
    let ap = 0;
    for (const lab of list) {
      const l = lab.toLowerCase();
      const ri = refList.indexOf(l, rp);
      if (ri < 0) continue; // not part of this pass
      rp = ri + 1;
      const ai = appList.indexOf(l, ap);
      if (ai < 0) diffs.push(`[${tag}] label ${appList.includes(l) ? "OUT OF ORDER" : "MISSING"} (${what}): "${lab}"`);
      else ap = ai + 1;
    }
  };
  const visibleInRef = LABELS.filter((l) => ref.texts.includes(l.toLowerCase()));
  const hiddenInRef = LABELS.filter((l) => !ref.texts.includes(l.toLowerCase()));
  orderCheck(visibleInRef, ref.texts, app.texts, "visible");
  orderCheck(hiddenInRef, ref.domTexts, app.domTexts, "dom");
  for (const l of hiddenInRef) if (!ref.domTexts.includes(l.toLowerCase())) diffs.push(`[${tag}] (reference does not contain "${l}": fix the script label list)`);
  if (app.doc.w > (tag === "1440" ? 1440 : 1920)) diffs.push(`[${tag}] horizontal overflow: ${app.doc.w}`);
  for (const [k, rb] of Object.entries(ref.boxes)) {
    const ab = app.boxes[k];
    if (!rb) continue;
    if (!ab) { diffs.push(`[${tag}] box ${k}: not found in app`); continue; }
    let d = ["x", "y", "w", "h"].filter((p) => Math.abs(ab[p] - rb[p]) > BOX_TOL);
    if (stretched && ["idwCard", "poCard", "shiftCard"].includes(k) && d.includes("h") && ab.h > rb.h) {
      deviations.push(`[${tag}] box ${k}: h app ${ab.h} vs ref ${rb.h} (cards stretch to fill the viewport)`);
      d = d.filter((p) => p !== "h");
    }
    if (stretched && k === "footer" && d.includes("y") && ab.y > rb.y - 400) {
      deviations.push(`[${tag}] box footer: y app ${ab.y} vs ref ${rb.y} (page fills the viewport, footer at the bottom)`);
      d = d.filter((p) => p !== "y");
    }
    if (d.length) diffs.push(`[${tag}] box ${k}: ${d.map((p) => `${p} app ${ab[p]} vs ref ${rb[p]}`).join(", ")}`);
  }
  for (const [k, rs] of Object.entries(ref.styles)) {
    const as = app.styles[k];
    if (!rs) continue;
    if (!as) { diffs.push(`[${tag}] style ${k}: element not found in app`); continue; }
    for (const [p, rv] of Object.entries(rs)) {
      const av = as[p];
      if (["color", "bg", "border"].includes(p)) {
        const a = toRGB(av);
        const r = toRGB(rv);
        if (!a && !r) continue;
        if (!a || !r || a.some((c, i) => Math.abs(c - r[i]) > COLOR_TOL)) diffs.push(`[${tag}] style ${k}.${p}: app ${av} vs ref ${rv}`);
      } else if (p === "radius" && parseFloat(av) >= 9999 && parseFloat(rv) >= 9999) {
        // both fully round
      } else if (p === "size" && Math.abs(parseFloat(av) - parseFloat(rv)) <= 0.5) {
        // sub-pixel difference
      } else if (av !== rv) diffs.push(`[${tag}] style ${k}.${p}: app ${av} vs ref ${rv}`);
    }
  }
  return diffs;
}

const browser = await chromium.launch({ channel: "msedge", headless: true });
const report = { thresholds: { boxPx: BOX_TOL, colorPerChannel: COLOR_TOL }, diffs: [], deviations: [], screenshots: [] };
const shot = async (page, name, full = true) => {
  const p = path.join(OUT, name);
  await page.screenshot({ path: p, fullPage: full });
  report.screenshots.push(p);
};

for (const [w, h] of [[1440, 900], [1920, 1080]]) {
  // reference
  const rctx = await browser.newContext({ viewport: { width: w, height: h }, javaScriptEnabled: false });
  await rctx.route("**/*", (r) => {
    const u = r.request().url();
    if (u.startsWith("file:") && u.endsWith(".html")) return r.continue();
    if (/logo/i.test(u)) return r.fulfill({ body: logo, contentType: "image/png" });
    return r.abort();
  });
  const rp = await rctx.newPage();
  await rp.goto(pathToFileURL(html).href, { waitUntil: "load" });
  await shot(rp, `compare-${w}-ref.png`);
  const ref = await rp.evaluate(measure);
  await rctx.close();

  // app, old version, role operator, J2 pilot line, simulated clock 10 Nov 2026 09:23 WIB like the reference
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, colorScheme: "light" });
  await ctx.addInitScript(() => {
    try {
      sessionStorage.setItem("paragon_oee_role", "operator");
      sessionStorage.setItem("fro_dashboard_version", "old");
      localStorage.setItem("theme", "light");
    } catch {
      // ignore
    }
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => m.type() === "error" && !/Failed to load resource/.test(m.text()) && errors.push(m.text().slice(0, 200)));
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
  await page.goto(`${BASE}/operator/J2/TUP01`, { waitUntil: "load" });
  await sleep(2000);
  await page.evaluate(() => {
    window.sim?.setSimNowMs(Date.parse("2026-11-10T09:23:18+07:00"));
    window.sim?.pause();
    window.sim?.setActualVsTarget?.("J2", "TUP01", 90, "now"); // non-zero output, like the reference page
  });
  await sleep(1500);
  for (let i = 0; i < 3; i++) {
    const qa = page.getByText("Submit QA Inspection");
    if (!(await qa.count())) break;
    await page.getByText("Released", { exact: true }).first().click({ timeout: 1500 }).catch(() => {});
    await qa.first().click({ timeout: 1500 }).catch(() => {});
    await sleep(500);
  }
  await page.addStyleTag({ content: '[data-testid="sim-panel"]{display:none !important}' }); // prototype-only element
  await sleep(300);
  await shot(page, `compare-${w}-app-old.png`);
  await page.evaluate(() => window.scrollTo(0, 0));
  const app = await page.evaluate(measure);
  const diffs = compare(ref, app, `${w}`, h);
  report.diffs.push(...diffs);
  if (errors.length) report.diffs.push(`[${w}] console errors: ${errors.join(" | ")}`);
  await ctx.close();
}

// new view screenshots at 1280, 1440, 1920, 360 + the toggle switching in the simulation panel
for (const [w, h] of [[360, 800], [1280, 800], [1440, 900], [1920, 1080]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await ctx.addInitScript(() => {
    try {
      sessionStorage.setItem("paragon_oee_role", "operator");
      sessionStorage.setItem("fro_dashboard_version", "new");
    } catch {
      // ignore
    }
  });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/operator/J2/TUP01`, { waitUntil: "load" });
  await sleep(2000);
  await page.evaluate(() => {
    window.sim?.setSimNowMs(Date.parse("2026-11-10T09:23:18+07:00"));
    window.sim?.pause();
    window.sim?.setActualVsTarget?.("J2", "TUP01", 90, "now"); // non-zero output, like the reference page
  });
  await sleep(1500);
  for (let i = 0; i < 3; i++) {
    const qa = page.getByText("Submit QA Inspection");
    if (!(await qa.count())) break;
    await page.getByText("Released", { exact: true }).first().click({ timeout: 1500 }).catch(() => {});
    await qa.first().click({ timeout: 1500 }).catch(() => {});
    await sleep(500);
  }
  await shot(page, `app-new-${w}.png`);
  if (w === 1440) {
    await page.getByTestId("sim-toggle").click();
    await sleep(400);
    await page.getByTestId("sim-version-old").click();
    await sleep(1200);
    await shot(page, "toggle-old.png");
    await page.getByTestId("sim-version-new").click();
    await sleep(1200);
    await shot(page, "toggle-new.png");
    const same = await page.evaluate(() => sessionStorage.getItem("fro_dashboard_version"));
    if (same !== "new") report.diffs.push("toggle did not switch back to new");
  }
  await ctx.close();
}
await browser.close();

report.deviations = deviations;
fs.writeFileSync(path.join(OUT, "compare-report.json"), JSON.stringify(report, null, 2));
console.log(report.diffs.length ? report.diffs.join("\n") : "no differences");
console.log(`\n${report.diffs.length} difference(s). Screenshots:\n${report.screenshots.join("\n")}`);
if (process.argv.includes("--strict") && report.diffs.length) process.exit(1);
