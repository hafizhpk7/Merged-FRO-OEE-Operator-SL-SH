@'
# Paragon OEE FRO prototype (Shift Leader, Section Head, Operator)

Stack: Vite + React 19 + TanStack Router + Tailwind. 100% mock data, deterministic (seeded). Prototype that becomes the reference for the real implementation by the Data/IT teams.

## Environment
- On this machine PowerShell blocks npm scripts. Always use `npm.cmd` and `npx.cmd`, never `npm` or `npx`.
- The `build` script uses `rm -rf dist`, which does not exist in PowerShell/cmd. Run `npm.cmd run build` through Bash, not PowerShell.

## Commands
- `npm.cmd run build` must pass.
- `npx.cmd tsc --noEmit`: the current baseline is 347 errors because tsconfig is strict (`noPropertyAccessFromIndexSignature`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`). Do NOT fix old errors unless asked. Done means: no new errors and a total of at most 347. Report the error count before and after the change.
- Self-tests: `runOeeSelfTest()` (window engine) must return passed:true. `runParityAudit()` must return no mismatches.
- Before saying a task is done: build, tsc, both self-tests, and a headless smoke test of /, /live, /operator, /operator/J2/TUP01, /reason, /reject for the three roles. Report real outputs, not assumptions.

## Hard rules
- No `Math.random()`; use `src/lib/oee/rng.ts` (seeded). No flicker or 3D remount on live ticks.
- This project has no router plugin: every new file in `src/routes` MUST be registered in `src/routeTree.gen.ts` in the same change (or add the router plugin).
- Do not touch vite.config.ts, scripts/prod-server.js, package scripts, or the 3D scenes unless asked.
- Bump BUILD_ID and add a FEATURES flag in `src/lib/oee/build-info.ts` on every change set.
- One OEE engine only: `windowEngine.ts` (`targetCount` = standard output PER 30 s window). Formulas per docs/CR: SPT = T - NA - US - PD; GOT = SPT - D; NOT = GOT - MS - (posSL - negSL); Quality is unit based (units - reject - rework) / units. Performance may exceed 100%.
- Downtime = no output MORE THAN 10 min (> 20 windows of 30 s); Minor Stop = 10 min or less.
- Loss tree master v2 (`lossTree.ts`) is the only taxonomy; labels are verbatim. Alarms = downtime events (L1 Breakdown), Source PLC (mapped alarm code) or Non-PLC (needs operator tag, shows "Not Tagged Yet").
- SL/SH Loss Clarification is read-only. Tagging and rejects are done by the Operator role through `reasonTagStore` and `rejectStore`.
- SL/SH label "Machine Output"; the operator pages follow the URS wording ("Total Output", "Output OEE").
- SCADA pilot lines exist ONLY in plant J2 (TUP01, TUP13, TUP14, BOP15, BOP16): `isOeeActiveLine(plantId, lineId)`; other lines are IDW only.
- Roles: shift-leader, section-head, operator; layout is chosen by pathname, role only redirects (RoleRouteGuard).

## Docs
docs/ contains (read the relevant pages before changing formulas):
- `CR - Adjustment OEE Dashboard Development.pdf` (CR, formulas)
- `URS & RNI Form OEE DASHBOARD FRO.pdf` and `URS & RNI Form OEE (Master Data).pdf` (URS)
- `[Draft] OEE Loss Tree Mapping.xlsx` is the loss tree master (status: DRAFT)
- `[Draft] AUK - FRO OEE Mapping Translation.xlsx` (mapping translation)
- `Main Dashboard Page.png`, `Reason Page.png`, `Reject Page.png` (screenshots)
- `flowreport_public_machine_readings.csv` (machine readings sample)

Other reference files: `roadmap.md`, `AGENTS.md` (Lovable git-history rule), `src/routes/README.md`.
'@ | Set-Content CLAUDE.md

## CR workflow
- CR sources: docs/cr/CR-requirements.pdf and docs/cr/mockups/*.html (interactive; read the JS for exact behavior). Reference rules by ID (GR-xx, RM-xx, MD-xx, OP-xx, SM-xx, SR-xx, TG-xx, RH-xx). Where the written rules and a mockup disagree, the written rules win.
- Work on branch `cr-adjustments`; one commit per prompt. Before coding: list conflicts with the current implementation, then proceed with the defaults stated in the prompt.
- New route files: register them (or keep routeTree.gen.ts in sync). Bump BUILD_ID and add a FEATURES flag per change set.
- Done = build + tsc clean for touched files + runOeeSelfTest/runParityAudit pass + Playwright smoke script (if present) with no console errors. Report real outputs.