#!/usr/bin/env node
/**
 * Makes clean zips of the COMMITTED project (git archive of HEAD), for manual upload to GitHub.
 * node_modules, dist, reports, .claude and .git are never included (they are not tracked).
 * The web uploader of GitHub accepts files up to 25 MB, so the project is split into
 *   paragon-fro-oee-code.zip   everything except docs/
 *   paragon-fro-oee-docs.zip   docs/ (PDF, xlsx, screenshots)
 * and a warning is printed when a zip is still above the limit.
 *
 *   node scripts/make-zip.mjs                 # output: ../paragon-fro-oee-zip/
 *   node scripts/make-zip.mjs --out=C:/tmp/zip --limit=25
 *
 * Note: only committed changes are included. Commit first.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const arg = (n, d) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split("=").slice(1).join("=") ?? d;
const root = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
const out = path.resolve(arg("out", path.join(root, "..", "paragon-fro-oee-zip")));
const limitMb = Number(arg("limit", "25"));
fs.mkdirSync(out, { recursive: true });

const git = (args) => execFileSync("git", args, { cwd: root, encoding: "utf8", maxBuffer: 1 << 28 });
const top = git(["ls-tree", "--name-only", "HEAD"]).split("\n").filter(Boolean);
const head = git(["log", "--oneline", "-1"]).trim();
const dirty = git(["status", "--porcelain", "--untracked-files=no"]).trim();

const make = (name, paths) => {
  const file = path.join(out, name);
  fs.rmSync(file, { force: true });
  execFileSync("git", ["archive", "--format=zip", "--prefix=paragon-fro-oee/", "-o", file, "HEAD", ...paths], { cwd: root });
  const mb = fs.statSync(file).size / 1024 / 1024;
  console.log(`${mb > limitMb ? "TOO BIG" : "ok     "} ${name}  ${mb.toFixed(1)} MB`);
  return mb;
};

console.log(`HEAD: ${head}`);
if (dirty) console.log("WARNING: uncommitted changes exist and are NOT in the zips:\n" + dirty);
fs.rmSync(path.join(out, "paragon-fro-oee.zip"), { force: true });
const a = make("paragon-fro-oee-code.zip", top.filter((p) => p !== "docs"));
const b = make("paragon-fro-oee-docs.zip", top.includes("docs") ? ["docs"] : []);
console.log(`Output: ${out}`);
process.exit(a > limitMb || b > limitMb ? 1 : 0);
