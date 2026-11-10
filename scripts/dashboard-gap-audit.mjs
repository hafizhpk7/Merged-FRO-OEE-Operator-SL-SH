#!/usr/bin/env node
/**
 * Dashboard gap audit (generic). For every combination of line, dashboard version, theme, width and
 * height it opens the page, finds the FroCards (`[data-fro-card]`), and for each card measures the
 * vertical gap between the consecutive content blocks (children of the content container, which is the
 * card's 2nd child), the free space left inside the card, and the height difference between the cards.
 * A gap above MAX_SECTION_GAP is flagged together with the CSS that causes it.
 *
 *   BASE_URL=http://localhost:3000 node scripts/dashboard-gap-audit.mjs --tag=before
 *   node scripts/dashboard-gap-audit.mjs --tag=after --lines=J2/TUP13,J1/LPA01 --versions=new --widths=1440 --heights=900
 *   node scripts/dashboard-gap-audit.mjs --route=reason --card='[data-fro-card]'      (other pages / cards)
 *
 * Options (comma separated): --lines  --versions  --widths  --heights  --themes  --route (dashboard path
 * suffix, default empty)  --card (CSS selector of the cards)  --states (live,unscheduled)  --tag (file prefix)
 * --shots (default 1440x900 and 360x800 of the first line, all versions and themes)
 * Output: reports/dashboard-gaps/<tag>-*.png, reports/dashboard-gaps/<tag>.json, a printed table.
 * Exit code 1 when a gap exceeds MAX_SECTION_GAP or the card height difference rule fails (with --strict).
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const arg = (n, d) => {
  const a = process.argv.find((x) => x.startsWith(`--${n}=`));
  return a ? a.slice(n.length + 3) : d;
};
const list = (n, d) => String(arg(n, d)).split(",").filter(Boolean);
const BASE = process.env.BASE_URL || "http://localhost:3000";
const MAX_SECTION_GAP = Number(arg("max-gap", 24));
const MAX_CARD_DIFF = 80;
const TAG = arg("tag", "run");
const ROUTE = arg("route", "");
const CARD = arg("card", "[data-fro-card]");
const lines = list("lines", "J2/TUP13,J2/TUP01,J1/LPA01");
const versions = list("versions", "new,old");
const widths = list("widths", "1280,1440,1920,2560").map(Number);
const heights = list("heights", "800,1080").map(Number);
const themes = list("themes", "light,dark");
const states = list("states", "live,unscheduled");
const OUT = path.resolve("reports/dashboard-gaps");
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Runs in the page. */
function measure(sel) {
  const css = (el, props) => {
    const cs = getComputedStyle(el);
    const o = {};
    for (const p of props) o[p] = cs[p];
    return o;
  };
  const rect = (el) => el.getBoundingClientRect();
  const cards = [...document.querySelectorAll(sel)].filter((c) => rect(c).width > 0);
  const out = [];
  for (const card of cards) {
    const content = card.children[1];
    if (!content) continue;
    const cr = rect(card);
    const ccs = getComputedStyle(content);
    const blocks = [...content.children].filter((b) => rect(b).height > 0);
    const gaps = [];
    for (let i = 1; i < blocks.length; i++) {
      const a = rect(blocks[i - 1]);
      const b = rect(blocks[i]);
      const gap = Math.round((b.top - a.bottom) * 10) / 10;
      const entry = { gap, between: [i - 1, i], prevH: Math.round(a.height), nextH: Math.round(b.height) };
      entry.prev = (blocks[i - 1].dataset.testid || blocks[i - 1].className || blocks[i - 1].tagName).toString().slice(0, 50);
      entry.next = (blocks[i].dataset.testid || blocks[i].className || blocks[i].tagName).toString().slice(0, 50);
      entry.css = {
        container: css(content, ["display", "flexDirection", "justifyContent", "alignContent", "rowGap", "minHeight", "height"]),
        prev: css(blocks[i - 1], ["flexGrow", "marginTop", "marginBottom", "minHeight", "height"]),
        next: css(blocks[i], ["flexGrow", "marginTop", "marginBottom", "minHeight", "height"]),
        card: css(card, ["height", "gap", "justifyContent", "alignContent"]),
        parent: css(card.parentElement, ["display", "alignItems", "alignContent", "gridAutoRows", "gridTemplateRows"]),
      };
      gaps.push(entry);
    }
    const last = blocks.length ? rect(blocks[blocks.length - 1]) : null;
    const pb = parseFloat(getComputedStyle(card).paddingBottom) + parseFloat(getComputedStyle(card).borderBottomWidth);
    const free = last ? Math.round((cr.bottom - pb - last.bottom) * 10) / 10 : 0;
    out.push({ id: card.dataset.testid || "card", height: Math.round(cr.height), top: Math.round(cr.top + scrollY), blocks: blocks.length, gaps, freeBelow: free, contentGap: ccs.rowGap });
  }
  const hs = out.map((c) => c.height);
  // natural (hugging) heights: temporarily align the grid items to the start
  let naturalDiff = 0;
  const grid = cards[0] ? cards[0].parentElement : null;
  if (grid && out.length > 1) {
    const prev = grid.style.alignItems;
    grid.style.alignItems = "start";
    const nh = cards.map((c) => rect(c).height);
    grid.style.alignItems = prev;
    naturalDiff = Math.round(Math.max(...nh) - Math.min(...nh));
  }
  return {
    naturalDiff,
    freeMax: out.length ? Math.max(...out.map((c) => c.freeBelow)) : 0,
    cards: out,
    heightDiff: hs.length ? Math.max(...hs) - Math.min(...hs) : 0,
    overflowX: document.documentElement.scrollWidth > innerWidth + 1,
    gridAlign: cards[0] ? getComputedStyle(cards[0].parentElement).alignItems : null,
  };
}

const browser = await chromium.launch({ channel: "msedge", headless: true });
const rows = [];
const flagged = [];
for (const line of lines) {
  const [plant, lineId] = line.split("/");
  for (const version of versions) {
    for (const theme of themes) {
      for (const state of states) {
        if (state === "unscheduled" && !/J2\/(TUP13|TUP01)/.test(line)) continue;
        const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
        await ctx.addInitScript(
          ([v, t]) => {
            try {
              sessionStorage.setItem("paragon_oee_role", "operator");
              sessionStorage.setItem("fro_dashboard_version", v);
              localStorage.setItem("theme", t);
            } catch {
              // ignore
            }
          },
          [version, theme],
        );
        const page = await ctx.newPage();
        const errors = [];
        page.on("console", (m) => m.type() === "error" && !/Failed to load resource/.test(m.text()) && errors.push(m.text().slice(0, 160)));
        page.on("pageerror", (e) => errors.push(String(e).slice(0, 160)));
        await page.goto(`${BASE}/operator/${plant}/${lineId}${ROUTE ? "/" + ROUTE : ""}`, { waitUntil: "load" });
        await sleep(1800);
        await page.evaluate(
          ([t, st]) => {
            document.documentElement.classList.toggle("dark", t === "dark");
            // 09:23 WIB with output, or 09:35 of the 3-SKU scenario = Unscheduled window (no PO running)
            window.sim?.setSimNowMs(Date.parse(st === "unscheduled" ? "2026-11-10T09:35:00+07:00" : "2026-11-10T09:23:18+07:00"));
            window.sim?.pause();
            if (st === "unscheduled") window.sim?.applyPoScenario?.("three-sku");
            else window.sim?.setActualVsTarget?.("J2", "TUP01", 90, "now");
          },
          [theme, state],
        );
        await sleep(1500);
        const dismiss = async () => {
          // CR 4 shift-change reminder (Close) and the QA inspection dialog (Released + Submit) would cover the page
          const rem = page.getByText("Pengingat pergantian shift");
          if (await rem.count()) await page.getByRole("button", { name: "Close", exact: true }).first().click({ timeout: 1500 }).catch(() => {});
        };
        await dismiss();
        for (let i = 0; i < 3; i++) {
          const qa = page.getByText("Submit QA Inspection");
          if (!(await qa.count())) break;
          await page.getByText("Released", { exact: true }).first().click({ timeout: 1500 }).catch(() => {});
          await qa.first().click({ timeout: 1500 }).catch(() => {});
          await sleep(400);
        }
        for (const w of widths) {
          for (const h of heights) {
            await page.setViewportSize({ width: w, height: h });
            await sleep(450);
            await dismiss();
            const m = await page.evaluate(measure, CARD);
            const key = `${line} ${version} ${theme} ${state} ${w}x${h}`;
            const bad = [];
            for (const c of m.cards) for (const g of c.gaps) if (g.gap > MAX_SECTION_GAP) bad.push({ card: c.id, ...g });
            // the card height difference rule only applies when the cards are stretched to equal height
            const hugging = m.gridAlign === "start" || m.gridAlign === "flex-start";
            // equal-height cards are only acceptable while the natural height difference (what the growable regions must absorb) is small
            const diffFail = m.cards.length > 1 && !hugging && w >= 1280 && m.naturalDiff > MAX_CARD_DIFF;
            rows.push({ key, naturalDiff: m.naturalDiff, freeMax: m.freeMax, heightDiff: m.heightDiff, gridAlign: m.gridAlign, overflowX: m.overflowX, free: m.cards.map((c) => `${c.id}:${c.freeBelow}`), maxGap: Math.max(0, ...m.cards.flatMap((c) => c.gaps.map((g) => g.gap))), bad, diffFail, errors: errors.length });
            if (bad.length || diffFail || m.overflowX) flagged.push({ key, bad, diffFail, heightDiff: m.heightDiff, gridAlign: m.gridAlign, overflowX: m.overflowX });
            const wantShot = (w === 1440 && h === 900) || (w === 360 && h === 800);
            if (wantShot && state === "live") await page.screenshot({ path: path.join(OUT, `${TAG}-${version}-${lineId}-${w}x${h}-${theme}.png`), fullPage: false });
          }
        }
        // 360x800 (stacked) for the screenshots set
        if (state === "live") {
          await page.setViewportSize({ width: 360, height: 800 });
          await sleep(500);
          const m = await page.evaluate(measure, CARD);
          const bad = [];
          for (const c of m.cards) for (const g of c.gaps) if (g.gap > MAX_SECTION_GAP) bad.push({ card: c.id, ...g });
          rows.push({ key: `${line} ${version} ${theme} ${state} 360x800`, heightDiff: m.heightDiff, gridAlign: m.gridAlign, overflowX: m.overflowX, free: m.cards.map((c) => `${c.id}:${c.freeBelow}`), maxGap: Math.max(0, ...m.cards.flatMap((c) => c.gaps.map((g) => g.gap))), bad, diffFail: false, errors: errors.length });
          if (bad.length || m.overflowX) flagged.push({ key: `${line} ${version} ${theme} ${state} 360x800`, bad, diffFail: false, heightDiff: m.heightDiff, gridAlign: m.gridAlign, overflowX: m.overflowX });
          await page.screenshot({ path: path.join(OUT, `${TAG}-${version}-${lineId}-360x800-${theme}.png`), fullPage: true });
        }
        if (errors.length) console.log(`console errors for ${line} ${version} ${theme}: ${errors.join(" | ")}`);
        await ctx.close();
      }
    }
  }
}
await browser.close();
fs.writeFileSync(path.join(OUT, `${TAG}.json`), JSON.stringify({ MAX_SECTION_GAP, MAX_CARD_DIFF, rows, flagged }, null, 1));

console.log(`combinations: ${rows.length}, flagged: ${flagged.length} (MAX_SECTION_GAP=${MAX_SECTION_GAP}px, card height diff limit ${MAX_CARD_DIFF}px)`);
const seen = new Set();
for (const f of flagged) {
  const head = `${f.key} | grid align-items=${f.gridAlign} heightDiff=${f.heightDiff}${f.overflowX ? " OVERFLOW-X" : ""}${f.diffFail ? " CARD-HEIGHT-DIFF" : ""}`;
  console.log(head);
  for (const b of f.bad) {
    const sig = `${b.card}|${b.between}|${JSON.stringify(b.css.container)}|${b.css.next.flexGrow}|${b.css.next.marginTop}`;
    console.log(`   gap ${b.gap}px in ${b.card} between #${b.between[0]} (${b.prev}) and #${b.between[1]} (${b.next})`);
    if (!seen.has(sig)) {
      seen.add(sig);
      console.log(`      cause: container ${JSON.stringify(b.css.container)}`);
      console.log(`             prev ${JSON.stringify(b.css.prev)} next ${JSON.stringify(b.css.next)}`);
      console.log(`             card ${JSON.stringify(b.css.card)} grid ${JSON.stringify(b.css.parent)}`);
    }
  }
}
console.log(`largest natural card height difference (3 columns, >=1280): ${Math.max(0, ...rows.filter((r) => r.key.match(/ (1280|1440|1920|2560)x/)).map((r) => r.naturalDiff ?? 0))}px; largest free space left below the last block inside a stretched card: ${Math.max(0, ...rows.map((r) => r.freeMax ?? 0))}px`);
const ok = rows.filter((r) => !r.bad.length && !r.diffFail && !r.overflowX).length;
console.log(`\nok: ${ok}/${rows.length}; largest gap anywhere: ${Math.max(0, ...rows.map((r) => r.maxGap))}px; largest card height difference: ${Math.max(0, ...rows.map((r) => r.heightDiff))}px`);
if (process.argv.includes("--strict") && flagged.length) process.exit(1);
