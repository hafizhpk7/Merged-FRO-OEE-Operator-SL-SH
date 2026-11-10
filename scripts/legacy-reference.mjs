#!/usr/bin/env node
/**
 * Renders docs/legacy/Flowreport MES.html (saved page of the old FRO MES UI) with JavaScript disabled,
 * saves screenshots to reports/legacy/ref-1440.png and ref-1920.png and dumps the visible text outline to
 * reports/legacy/outline.txt. Failed requests (missing assets) are ignored; the logo is served from
 * docs/legacy/logo-long.png.
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright-core";

const html = path.resolve("docs/legacy/Flowreport MES.html");
const logo = fs.readFileSync(path.resolve("docs/legacy/logo-long.png"));
const out = path.resolve("reports/legacy");
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: "msedge", headless: true });
for (const [w, h] of [[1440, 900], [1920, 1080]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, javaScriptEnabled: false });
  await ctx.route("**/*", (route) => {
    const u = route.request().url();
    if (u.startsWith("file:") && u.endsWith(".html")) return route.continue();
    if (/logo/i.test(u)) return route.fulfill({ body: logo, contentType: "image/png" });
    return route.abort();
  });
  const page = await ctx.newPage();
  await page.goto(pathToFileURL(html).href, { waitUntil: "load" });
  await page.screenshot({ path: path.join(out, `ref-${w}.png`), fullPage: true });
  if (w === 1440) {
    const outline = await page.evaluate(() => {
      const lines = [];
      const walk = (el, depth) => {
        for (const n of el.childNodes) {
          if (n.nodeType === 3) {
            const t = n.textContent.replace(/\s+/g, " ").trim();
            if (t) lines.push(`${"  ".repeat(Math.min(depth, 12))}${t}  <${el.tagName.toLowerCase()}>`);
          } else if (n.nodeType === 1 && !["SCRIPT", "STYLE"].includes(n.tagName)) walk(n, depth + 1);
        }
      };
      walk(document.body, 0);
      return lines.join("\n");
    });
    fs.writeFileSync(path.join(out, "outline.txt"), outline);
  }
  await ctx.close();
}
await browser.close();
console.log("done");
