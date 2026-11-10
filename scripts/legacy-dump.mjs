#!/usr/bin/env node
/** Dumps a compact tree (rect + key computed styles) of the saved legacy page to reports/legacy/ref-tree.txt (design analysis aid). */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright-core";
const logo = fs.readFileSync(path.resolve("docs/legacy/logo-long.png"));
const browser = await chromium.launch({ channel: "msedge", headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, javaScriptEnabled: false });
await ctx.route("**/*", (r) => { const u = r.request().url(); if (u.startsWith("file:") && u.endsWith(".html")) return r.continue(); if (/logo/i.test(u)) return r.fulfill({ body: logo, contentType: "image/png" }); return r.abort(); });
const page = await ctx.newPage();
await page.goto(pathToFileURL(path.resolve("docs/legacy/Flowreport MES.html")).href, { waitUntil: "load" });
const txt = await page.evaluate(() => {
  const L = [];
  const walk = (el, d) => {
    const cs = getComputedStyle(el); const r = el.getBoundingClientRect();
    if (cs.display === "none" || ["SCRIPT", "STYLE", "SVG", "PATH"].includes(el.tagName.toUpperCase())) return;
    const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).filter(Boolean).join(" ");
    const bw = parseFloat(cs.borderTopWidth) > 0 || parseFloat(cs.borderBottomWidth) > 0;
    const bg = cs.backgroundColor !== "rgba(0, 0, 0, 0)";
    const flex = cs.display.includes("flex") || cs.display.includes("grid");
    if (own || bw || bg || flex || el.tagName === "BUTTON" || el.tagName === "SELECT") {
      const f = (v) => v.replace("rgba(0, 0, 0, 0)", "-");
      L.push(`${"  ".repeat(Math.min(d, 20))}${el.tagName.toLowerCase()} [${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)}] ${cs.display}${flex ? ` dir=${cs.flexDirection} gap=${cs.gap} jc=${cs.justifyContent} ai=${cs.alignItems}` : ""} pad=${cs.paddingTop}/${cs.paddingRight}/${cs.paddingBottom}/${cs.paddingLeft} ${bg ? `bg=${f(cs.backgroundColor)} ` : ""}${bw ? `bd=${cs.borderTopWidth}${cs.borderBottomWidth !== cs.borderTopWidth ? "/b" + cs.borderBottomWidth : ""} ${f(cs.borderTopColor)} ` : ""}r=${cs.borderRadius} ${cs.fontSize}/${cs.fontWeight} ${cs.color}${cs.textTransform !== "none" ? " " + cs.textTransform : ""}${cs.letterSpacing !== "normal" ? " ls=" + cs.letterSpacing : ""}${own ? ` "${own.slice(0, 40)}"` : ""}`);
    }
    for (const c of el.children) walk(c, d + 1);
  };
  walk(document.body, 0);
  return L.join("\n");
});
fs.writeFileSync("reports/legacy/ref-tree.txt", txt);
console.log(txt.split("\n").length, "lines");
await browser.close();
