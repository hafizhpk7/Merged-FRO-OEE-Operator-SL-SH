#!/usr/bin/env node
/**
 * Extracts computed-style tokens of the key elements of the saved legacy MES page (JS disabled) into
 * reports/legacy/tokens.json. docs/legacy/design-tokens.md and src/styles/legacy-fro-tokens.css are
 * written from this output.
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright-core";

const html = path.resolve("docs/legacy/Flowreport MES.html");
const logo = fs.readFileSync(path.resolve("docs/legacy/logo-long.png"));
const browser = await chromium.launch({ channel: "msedge", headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, javaScriptEnabled: false });
await ctx.route("**/*", (r) => {
  const u = r.request().url();
  if (u.startsWith("file:") && u.endsWith(".html")) return r.continue();
  if (/logo/i.test(u)) return r.fulfill({ body: logo, contentType: "image/png" });
  return r.abort();
});
const page = await ctx.newPage();
await page.goto(pathToFileURL(html).href, { waitUntil: "load" });
const tokens = await page.evaluate(() => {
  const P = ["color", "backgroundColor", "backgroundImage", "borderTopWidth", "borderTopStyle", "borderTopColor", "borderBottomColor", "borderRadius", "boxShadow", "fontFamily", "fontSize", "fontWeight", "lineHeight", "letterSpacing", "textTransform", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "width", "height", "gap"];
  const clear = "rgba(0, 0, 0, 0)";
  const style = (el) => {
    if (!el) return null;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const o = { tag: el.tagName.toLowerCase(), rect: { w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.x), y: Math.round(r.y) } };
    for (const p of P) o[p] = cs[p];
    return o;
  };
  const byText = (txt, tag = "*") => {
    const it = document.evaluate(`//${tag}[normalize-space(text())="${txt}"]`, document, null, XPathResult.ORDERED_NODE_ITERATOR_TYPE, null);
    return it.iterateNext();
  };
  const up = (el, test, max = 12) => {
    let e = el;
    for (let i = 0; i < max && e; i++, e = e.parentElement) if (test(e)) return e;
    return null;
  };
  const isButton = (e) => e.tagName === "BUTTON";
  const hasBorderAndRadius = (e) => {
    const cs = getComputedStyle(e);
    return parseFloat(cs.borderTopWidth) > 0 && parseFloat(cs.borderTopLeftRadius) > 0 && e.getBoundingClientRect().width > 300;
  };
  const coloured = (e) => getComputedStyle(e).backgroundColor !== clear;
  const out = {};
  out.body = style(document.body);
  out.pageBg = style(up(byText("Beranda"), (e) => e.getBoundingClientRect().width > 1000 && coloured(e)));
  out.sidebar = style(up(byText("Beranda"), (e) => { const r = e.getBoundingClientRect(); return r.height > 600 && r.width < 400; }));
  out.sidebarMenuText = style(byText("Beranda", "p"));
  out.sidebarGroupTitle = style(byText("Produksi", "p"));
  out.sidebarItemActive = style(up(byText("Pengemasan"), (e) => e.tagName === "A" || isButton(e) || coloured(e), 6));
  out.sidebarItem = style(up(byText("Penimbangan"), (e) => e.tagName === "A" || isButton(e) || coloured(e), 6));
  out.topbar = style(up(byText("Week 46"), (e) => e.getBoundingClientRect().width > 800, 8));
  out.weekChip = style(byText("Week 46", "span"));
  out.dateText = style(byText("Tuesday, 10 November 2026 - 09:23:18 WIB", "p"));
  out.avatar = style(up(byText("SA"), (e) => e.getBoundingClientRect().width < 60 && getComputedStyle(e).borderRadius !== "0px", 4));
  out.headerCard = style(up(byText("Overall Equipment Effectiveness", "p"), hasBorderAndRadius));
  out.headerTitle = style(byText("Overall Equipment Effectiveness", "p"));
  out.chipPlant = style(byText("Liquid Plant", "span"));
  out.chipZone = style(byText("LIQUID A", "span"));
  out.chipLine = style(byText("JAP03", "span"));
  out.btnPause = style(up(byText("Pause Work Order"), isButton));
  out.btnFinish = style(up(byText("Finish Work Order"), isButton));
  out.btnMenu = style(up(byText("Menu"), isButton));
  out.tabBar = style(up(byText("Dashboard", "p"), (e) => e.getBoundingClientRect().width > 250, 5));
  out.tabActive = style(up(byText("Dashboard", "p"), coloured, 4));
  out.tabText = style(byText("Reject", "p"));
  out.shiftLabel = style(byText("List Shift", "p"));
  out.shiftSelect = style(up(byText("Current"), (e) => parseFloat(getComputedStyle(e).borderTopWidth) > 0 && e.getBoundingClientRect().width > 150, 6));
  out.currentTag = style(byText("Current", "span"));
  out.sectionCard = style(up(byText("Inline Device Weigher", "p"), hasBorderAndRadius));
  out.sectionTitle = style(byText("Inline Device Weigher", "p"));
  out.labelCounter = style(byText("Counter", "p"));
  out.labelInnerbox = style(byText("Innerbox", "p"));
  out.valueInnerbox = style(byText("0 / 12", "p"));
  out.btnCounterDetail = style(up(byText("Counter Detail"), isButton));
  out.select = style(byText("ABCD", "div"));
  out.btnTestPrint = style(up(byText("Test Print"), isButton));
  out.btnBroken = style(up(byText("Broken Inner Box"), isButton));
  out.btnAmr = style(up(byText("Request Material"), isButton));
  out.rowLabel = style(byText("Output IDW", "p"));
  out.rowValue = style(byText("35,861", "p"));
  out.poTitleBox = style(up(byText("Process Order", "p"), (e) => coloured(e) && e.getBoundingClientRect().width > 300, 5));
  out.poTitle = style(document.evaluate('//p[starts-with(normalize-space(text()),"LABORE")]', document, null, 9, null).singleNodeValue);
  out.poKey = style(byText("Process Order", "p"));
  out.poValue = style(byText("210000040323", "p"));
  out.runRateTitle = style(byText("Run rate SKU", "p"));
  out.runRateTarget = style(byText("Target", "p"));
  out.runRateNumber = style(byText("38", "p"));
  out.runRateStd = style(byText("/ 35", "span"));
  out.totalOutputLabel = style(byText("Total output", "p"));
  out.totalOutputValue = style(byText("35,861", "p"));
  out.totalReject = style(byText("(827)", "span"));
  out.qaSampleValue = style(byText("238", "p"));
  out.qaReleasedValue = style(byText("198", "p"));
  out.qaRejectValue = style(byText("40", "p"));
  out.mulaiBox = style(up(byText("Mulai", "p"), (e) => coloured(e) && e.getBoundingClientRect().width > 250, 4));
  out.sisaChip = style(up(byText("Sisa 42h 14j 53m", "p"), coloured, 3));
  out.oeeCard = style(up(byText("SKU", "p"), (e) => coloured(e) && e.getBoundingClientRect().width > 300, 8));
  out.oeeToggle = style(up(byText("SKU", "p"), (e) => e.getBoundingClientRect().width > 60 && e.getBoundingClientRect().width < 120, 4));
  out.oeeValue = style(byText("344.05%", "p"));
  out.avaLabel = style(byText("AVA", "p"));
  out.avaValue = style(byText("80.63%", "p"));
  out.footer = style(up(byText("Developed by IT Paragon Technology & Innovation", "p"), (e) => e.getBoundingClientRect().width > 600, 4));
  out.footerText = style(byText("Developed by IT Paragon Technology & Innovation", "p"));
  out.svgColors = [...new Set([...document.querySelectorAll("circle, rect, path, line, stop")].flatMap((e) => [e.getAttribute("stroke"), e.getAttribute("fill"), e.getAttribute("stop-color")]).filter((c) => c && c.startsWith("#")))].slice(0, 40);
  out.coloredBlocks = [...document.querySelectorAll("div")]
    .filter((e) => { const r = e.getBoundingClientRect(); return r.height > 4 && r.height < 14 && r.width > 8 && coloured(e); })
    .map((e) => ({ bg: getComputedStyle(e).backgroundColor, w: Math.round(e.getBoundingClientRect().width), h: Math.round(e.getBoundingClientRect().height), r: getComputedStyle(e).borderRadius, x: Math.round(e.getBoundingClientRect().x), y: Math.round(e.getBoundingClientRect().y) }))
    .slice(0, 50);
  const vars = {};
  for (const sheet of document.styleSheets) {
    try {
      for (const rule of sheet.cssRules) {
        if (rule.selectorText && /:root|:host|\.dark|\.light|\[data-theme/.test(rule.selectorText) && rule.style) {
          for (const name of rule.style) if (/^--chakra-(colors|radii|fonts|shadows)/.test(name)) vars[`${rule.selectorText} ${name}`] = rule.style.getPropertyValue(name);
        }
      }
    } catch { /* ignore */ }
  }
  out.darkSelectors = [...new Set([...document.styleSheets].flatMap((s) => { try { return [...s.cssRules].map((r) => r.selectorText).filter((t) => t && /\.dark|data-theme=dark|color-mode/.test(t)); } catch { return []; } }))].slice(0, 20);
  out.rootVarCount = Object.keys(vars).length;
  out.rootVars = Object.fromEntries(Object.entries(vars).slice(0, 500));
  return out;
});
fs.mkdirSync("reports/legacy", { recursive: true });
fs.writeFileSync("reports/legacy/tokens.json", JSON.stringify(tokens, null, 1));
console.log("keys:", Object.keys(tokens).length, "| missing:", Object.entries(tokens).filter(([, v]) => v === null).map(([k]) => k).join(", "), "| dark selectors:", tokens.darkSelectors.length, "| root vars:", tokens.rootVarCount);
await browser.close();
