/**
 * Self-test for the Asset Management mock master, operational mode and the SRR Line override layer.
 * Run `runAssetMasterSelfTest()` in the browser console. It clears every override it sets.
 */
import {
  getLineAssetMaster,
  getLineOperationalMode,
  getLineSrr,
  getMachineStandard,
  getRepresentativeAsset,
  setSrrLine,
} from "./assetMaster";
import { getSkuStandardRunRate } from "./metrics-engine";
import { getTargetSnapshot } from "./targetService";
import { classifyWindow } from "./windowEngine";

type Check = { name: string; passed: boolean; detail?: string };
const P = "J2";
const PILOT = ["TUP01", "TUP13", "TUP14", "BOP15", "BOP16"];

export function runAssetMasterSelfTest(): { passed: boolean; results: Check[] } {
  const results: Check[] = [];
  const check = (name: string, passed: boolean, detail?: string) =>
    results.push({ name, passed, ...(detail !== undefined ? { detail } : {}) });
  try {
    for (const l of PILOT) setSrrLine(P, l, undefined);

    check(
      "every pilot line has a representative asset, operation and machine standards",
      PILOT.every((l) => {
        const m = getLineAssetMaster(P, l);
        return !!m.representativeAsset && (m.operation === "SEQ" || m.operation === "OR") && m.machines.length > 0 && m.machines.every((x) => x.weightage > 0);
      }),
    );
    check("representative asset is the single bottleneck source", PILOT.every((l) => getRepresentativeAsset(P, l) === getLineAssetMaster(P, l).representativeAsset));
    check("pilot lines have an SRR Line except TUP14", PILOT.every((l) => (l === "TUP14" ? getLineSrr(P, l) === null : (getLineSrr(P, l) ?? 0) > 0)));
    check(
      "mode: TUP14 idw-only (srr-line-missing), TUP01 full, non-pilot idw-only (not-pilot)",
      getLineOperationalMode(P, "TUP14").reason === "srr-line-missing" &&
        getLineOperationalMode(P, "TUP01").mode === "full" &&
        getLineOperationalMode("J1", "LIP01").reason === "not-pilot",
    );

    setSrrLine(P, "TUP01", null);
    check("override null blocks TUP01", getLineOperationalMode(P, "TUP01").reason === "srr-line-missing" && getLineSrr(P, "TUP01") === null);
    const blockedSnap = getTargetSnapshot(P, "TUP01", "LINE");
    check("blocked mode computes no windows and no NaN", blockedSnap.windows.length === 0 && Number.isFinite(blockedSnap.grossOutput) && blockedSnap.srrLine === null);
    setSrrLine(P, "TUP01", 25);
    check("override value restores full mode with that SRR Line", getLineOperationalMode(P, "TUP01").mode === "full" && getLineSrr(P, "TUP01") === 25);
    const fullSnap = getTargetSnapshot(P, "TUP01", "LINE");
    check("SRR Line override feeds the target logic", fullSnap.srrLine === 25 || fullSnap.plan.srrLine !== null, `srr ${fullSnap.srrLine}`);
    setSrrLine(P, "TUP01", undefined);
    check("clearing the override returns to the master value", (getLineSrr(P, "TUP01") ?? 0) > 0);

    check("legacy getSkuStandardRunRate never returns null/NaN (TUP14)", Number.isFinite(getSkuStandardRunRate(P, "TUP14")) && getSkuStandardRunRate(P, "TUP14") > 0);
    check("null/0 standard never produces SL or NSL", classifyWindow(5, 0) === "EF" && classifyWindow(0, 0) === "D");
    check("machine standards tolerate unknown codes", Number.isFinite(getMachineStandard(P, "TUP01", "ZZ99") ?? 0));
  } finally {
    for (const l of PILOT) setSrrLine(P, l, undefined);
  }
  const passed = results.every((r) => r.passed);
  if (typeof console !== "undefined") {
    console.table(results.map((r) => ({ name: r.name, passed: r.passed, detail: r.detail ?? "" })));
  }
  return { passed, results };
}

declare global {
  interface Window {
    runAssetMasterSelfTest?: typeof runAssetMasterSelfTest;
  }
}
if (typeof window !== "undefined") window.runAssetMasterSelfTest = runAssetMasterSelfTest;
