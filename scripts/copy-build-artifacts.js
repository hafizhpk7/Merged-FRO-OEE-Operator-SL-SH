import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const outputDir = path.join(rootDir, ".output");
const outputPublicDir = path.join(outputDir, "public");
const outputServerDir = path.join(outputDir, "server");
const distDir = path.join(rootDir, "dist");
const publicDir = path.join(rootDir, "public");

console.log("Preparing build artifacts in dist/ for static hosting...");

// 1. Ensure dist directory exists
fs.mkdirSync(distDir, { recursive: true });

// 2. Copy static public assets from public/ into dist/ and .output/public/
if (fs.existsSync(publicDir)) {
  fs.cpSync(publicDir, distDir, { recursive: true });
  if (fs.existsSync(outputPublicDir)) {
    fs.cpSync(publicDir, outputPublicDir, { recursive: true });
  }
}

// 3. Copy all files and folders from .output/public into dist/
if (fs.existsSync(outputPublicDir)) {
  fs.cpSync(outputPublicDir, distDir, { recursive: true });
  console.log("Copied .output/public assets into dist/");
}

// 4. Copy .output/server into dist/server for server runtime if needed
if (fs.existsSync(outputServerDir)) {
  const distServerDir = path.join(distDir, "server");
  fs.mkdirSync(distServerDir, { recursive: true });
  fs.cpSync(outputServerDir, distServerDir, { recursive: true });
  console.log("Copied .output/server into dist/server");
}

// 5. Set up index.html and 404.html for static SPA export
const shellHtmlPath = path.join(outputPublicDir, "_shell.html");
const distIndexPath = path.join(distDir, "index.html");
const dist404Path = path.join(distDir, "404.html");

let htmlContent = "";

if (fs.existsSync(shellHtmlPath)) {
  htmlContent = fs.readFileSync(shellHtmlPath, "utf-8");
  console.log("Using prerendered SPA _shell.html for index.html and 404.html");
} else if (
  fs.existsSync(distIndexPath) &&
  fs.readFileSync(distIndexPath, "utf-8").includes("/assets/") &&
  !fs.readFileSync(distIndexPath, "utf-8").includes("/src/main.tsx")
) {
  htmlContent = fs.readFileSync(distIndexPath, "utf-8");
  console.log("Kept existing Vite-built dist/index.html");
} else {
  const assetsDir = path.join(distDir, "assets");
  let mainJs = "";
  let mainCss = "";

  if (fs.existsSync(assetsDir)) {
    const files = fs.readdirSync(assetsDir);
    const jsFiles = files.filter((f) => f.startsWith("index-") && f.endsWith(".js"));
    if (jsFiles.length > 0) mainJs = `/assets/${jsFiles[0]}`;
    const cssFiles = files.filter((f) => f.startsWith("styles-") && f.endsWith(".css"));
    if (cssFiles.length > 0) mainCss = `/assets/${cssFiles[0]}`;
  }

  if (!mainJs) throw new Error("Could not find main JS bundle in dist/assets");

  htmlContent = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>OEE FRO Dashboard Prototype</title>
    <meta name="description" content="Clickable OEE dashboard prototype for Shift Leader and Section Head." />
    <link rel="icon" href="/favicon.ico" sizes="any" />
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
    <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap" />
    ${mainCss ? `<link rel="stylesheet" href="${mainCss}" />` : ""}
  </head>
  <body>
    <div id="root"></div>
    ${mainJs ? `<script type="module" src="${mainJs}"></script>` : ""}
  </body>
</html>
`;
}

if (htmlContent.includes("/src/main.tsx")) {
  throw new Error("Generated/selected HTML still contains /src/main.tsx!");
}

fs.writeFileSync(distIndexPath, htmlContent, "utf-8");
fs.writeFileSync(dist404Path, htmlContent, "utf-8");

if (fs.existsSync(outputPublicDir)) {
  fs.writeFileSync(path.join(outputPublicDir, "index.html"), htmlContent, "utf-8");
  fs.writeFileSync(path.join(outputPublicDir, "404.html"), htmlContent, "utf-8");
}

// 6. Verification of key artifacts in dist/
const distFiles = fs.readdirSync(distDir);
console.log("dist/ root entries:", distFiles.join(", "));
if (!fs.existsSync(path.join(distDir, "index.html"))) {
  throw new Error("Verification failed: dist/index.html does not exist!");
}

console.log("Build artifacts successfully prepared and verified in dist/.");
