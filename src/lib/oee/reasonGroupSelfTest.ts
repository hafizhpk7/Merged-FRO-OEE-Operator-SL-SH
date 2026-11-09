/**
 * Dev self-test for CR 2 (Grouping Tagging Issue). Run in the browser console with
 * `runReasonGroupSelfTest()`; it only touches windows it creates or untagged events it then purges.
 */
import { J2_LINES_CONFIG } from "./j2-layout-config";
import { countUncommentedByType, getShiftTimeline, operatorCauseKey, type MachineEvent } from "./machineEvents";
import { PARENTS } from "./lossTree";
import { reasonTagStore, type CauseTemplate } from "./reasonTagStore";
import { selectMachineNotTaggedState } from "./selectors";
import { getShiftInfo, SHIFT_SECONDS } from "./shiftClock";
import { classifyWindow } from "./windowEngine";
import {
  canAddCause,
  canSaveSingle,
  changeEnd,
  coverage,
  endOptions,
  removeCause,
  startOf,
  type DraftCause,
} from "./classifyDraft";

type Check = { name: string; passed: boolean; detail?: string };

const dc = (end: number, done = true): DraftCause => ({
  key: `k${end}`,
  categoryId: done ? "cat" : "",
  reasonId: done ? "rsn" : "",
  end,
  desc: "",
});

function template(l1: string, which = 0): CauseTemplate {
  const parent = PARENTS.find((p) => p.id === l1);
  const cat = parent?.categories[which] ?? parent?.categories[0];
  const reason = cat?.reasons[0];
  return {
    l1Parent: l1,
    l2CategoryId: cat?.id ?? "",
    l2CategoryName: cat?.name ?? "",
    l3ReasonId: reason?.id ?? "",
    l3ReasonName: reason?.name ?? "",
  };
}

export function runReasonGroupSelfTest(): { passed: boolean; results: Check[] } {
  const results: Check[] = [];
  const check = (name: string, passed: boolean, detail?: string) =>
    results.push({ name, passed, ...(detail !== undefined ? { detail } : {}) });

  const shift = getShiftInfo();
  const touched: string[] = [];
  const keyOf = (e: MachineEvent) => operatorCauseKey(shift.shiftKey, e.machineCode, e.id);
  const machines = J2_LINES_CONFIG.flatMap((l) => l.machines.map((m) => m.code || "")).filter(Boolean);
  const timelineOf = (m: string) => getShiftTimeline(m, shift, SHIFT_SECONDS, "J2");

  try {
    // ---- A. single-mode draft rules (GR-05) ------------------------------------------
    const total = 600;
    const one = [dc(total)];
    const opts = endOptions(one, 0, total);
    check(
      "30 s steps: options from +30 s to window end",
      opts.length === 20 && opts[0] === 30 && opts[19] === total && opts.every((t, i) => t === (i + 1) * 30),
    );
    const cut = changeEnd([dc(300), dc(total)], 0, 150);
    check("changing an end time cuts later causes", cut.length === 1 && cut[0]?.end === 150);
    check("next cause starts at previous end", startOf([dc(300), dc(total)], 1) === 300);
    check("end options of cause #2 start after cause #1 end", endOptions([dc(300), dc(total)], 1, total)[0] === 330);
    check("Add cause only while time remains", canAddCause([dc(300)], total) && !canAddCause([dc(total)], total));
    check(
      "Save needs full coverage by complete causes",
      !canSaveSingle([dc(300)], total, false) &&
        !canSaveSingle([dc(300), dc(total, false)], total, false) &&
        canSaveSingle([dc(300), dc(total)], total, false),
    );
    check("partial save when CLASSIFY_ALLOW_PARTIAL_SAVE is true", canSaveSingle([dc(300)], total, true));
    check(
      "removing a cause stretches the new last cause to the end",
      (() => {
        const r = removeCause([dc(200), dc(400), dc(total)], 1, total);
        return r.length === 1 && r[0]?.end === total;
      })(),
    );
    check("coverage counts only complete causes", coverage([dc(300), dc(total, false)], total).coveredSec === 300);

    // ---- B. store: group save is versioned and audited ----------------------------------
    const ids = ["__st__:a", "__st__:b", "__st__:c"];
    touched.push(...ids);
    const wins = ids.map((id, i) => ({ id, startSec: i * 1000, endSec: i * 1000 + 300 }));
    const exp1 = reasonTagStore.getVersions(ids);
    const r1 = reasonTagStore.saveGroup(wins, template("Minor Stop"), exp1);
    check("group save succeeds", r1.ok);
    check(
      "group save writes one cause per window with the same group id",
      ids.every((id) => reasonTagStore.getCauses(id).length === 1) &&
        new Set(ids.map((id) => reasonTagStore.getCauses(id)[0]?.groupId)).size === 1 &&
        ids.every((id) => reasonTagStore.getCauses(id)[0]?.mode === "group"),
    );
    check(
      "group cause spans the full window duration",
      wins.every((w) => {
        const c = reasonTagStore.getCauses(w.id)[0];
        return c?.startSec === w.startSec && c?.endSec === w.endSec;
      }),
    );
    check(
      "audit: user, mode, group_id, before and after per window",
      ids.every((id) => {
        const a = reasonTagStore.getAudit(id)[0];
        return !!a && a.mode === "group" && !!a.groupId && !!a.user && a.before.length === 0 && a.after.length === 1;
      }),
    );

    // ---- C. atomic failure: a window changed since the modal opened ----------------------
    const ids2 = ["__st__:d", "__st__:e", "__st__:f"];
    touched.push(...ids2);
    const wins2 = ids2.map((id, i) => ({ id, startSec: i * 1000, endSec: i * 1000 + 300 }));
    const exp2 = reasonTagStore.getVersions(ids2); // captured when "the modal opened"
    const other = reasonTagStore.saveSingle(
      "__st__:e",
      [
        {
          id: "x",
          startSec: 1000,
          endSec: 1300,
          ...template("Minor Stop"),
          taggedAt: new Date().toISOString(),
        },
      ],
      exp2["__st__:e"] ?? 0,
      "Other user",
    ); // simulates another user committing window e meanwhile
    check("simulated concurrent single save succeeds", other.ok);
    const r2 = reasonTagStore.saveGroup(wins2, template("Minor Stop", 1), exp2);
    check(
      "atomic: group save fails and lists the conflicting window",
      !r2.ok && r2.conflicts.length === 1 && r2.conflicts[0] === "__st__:e",
      r2.ok ? "unexpectedly ok" : r2.conflicts.join(","),
    );
    check(
      "atomic: nothing saved for the other windows",
      reasonTagStore.getCauses("__st__:d").length === 0 &&
        reasonTagStore.getCauses("__st__:f").length === 0 &&
        reasonTagStore.getVersion("__st__:d") === 0 &&
        reasonTagStore.getVersion("__st__:f") === 0 &&
        reasonTagStore.getCauses("__st__:e").length === 1 &&
        reasonTagStore.getCauses("__st__:e")[0]?.mode === "single",
    );

    // ---- D. timeline integration: group-classify up to 6 Minor Stop windows ---------------
    const pick = (type: MachineEvent["type"], min = 2) => {
      for (const m of machines) {
        const tl = timelineOf(m);
        const list = tl.events.filter((e) => e.type === type && !e.isTagged);
        if (list.length >= min) return { m, list };
      }
      return null;
    };
    const ms = pick("minor_stop", 2);
    check("a machine with >= 2 untagged Minor Stop windows exists", !!ms);
    if (ms) {
      const group = ms.list.slice(0, 6);
      const before = timelineOf(ms.m);
      const pendingBefore = before.events.filter((e) => e.type === "minor_stop" && !e.isTagged).length;
      const taggedBefore = selectMachineNotTaggedState(before.events).taggedCount;
      touched.push(...group.map(keyOf));
      const exp = reasonTagStore.getVersions(group.map(keyOf));
      const r = reasonTagStore.saveGroup(
        group.map((e) => ({ id: keyOf(e), startSec: e.startSec, endSec: e.endSec })),
        template("Minor Stop"),
        exp,
      );
      const after = timelineOf(ms.m);
      const grouped = after.events.filter((e) => group.some((g) => g.id === e.id));
      check("group save of Minor Stop windows ok", r.ok);
      check(
        "all grouped windows are committed",
        grouped.length === group.length && grouped.every((e) => e.isTagged && e.causes.length === 1),
      );
      check(
        "chip count drops by the number of committed windows",
        after.events.filter((e) => e.type === "minor_stop" && !e.isTagged).length ===
          pendingBefore - group.length,
        `${pendingBefore} -> ${after.events.filter((e) => e.type === "minor_stop" && !e.isTagged).length}`,
      );
      check(
        "SL/SH Loss Clarification selector shows the tags",
        selectMachineNotTaggedState(after.events).taggedCount === taggedBefore + group.length &&
          grouped.every((e) => !!e.l2CategoryName && e.l2CategoryName === grouped[0]?.l2CategoryName),
      );
      check(
        "tag does not change OEE for Minor Stop",
        before.snapshot.oee === after.snapshot.oee,
        `${before.snapshot.oee} vs ${after.snapshot.oee}`,
      );
    }

    // ---- E. Negative Speed Loss (speed gain): visible, not classifiable ---------------------
    const nslAll = machines.map((m) => ({ m, tl: timelineOf(m) }));
    const withNsl = nslAll.filter((x) => x.tl.events.some((e) => e.type === "negative_speed_loss"));
    check("speed-gain windows are still generated by the window engine data", withNsl.length > 0, `${withNsl.length} machines`);
    const nslMachine = withNsl[0];
    if (nslMachine) {
      const evs = nslMachine.tl.events.filter((e) => e.type === "negative_speed_loss");
      check(
        "NSL windows are NSL per the window engine",
        evs.every((e) => {
          const ws = nslMachine.tl.windows.filter((w) => w.eventId === e.id);
          return ws.length > 0 && ws.every((w) => classifyWindow(w.output, w.targetOutput) === "NSL");
        }),
      );
      const counts = countUncommentedByType(nslMachine.tl.events) as Record<string, number>;
      check(
        "speed gain is not a classifiable type and adds nothing to the pending counts",
        Object.keys(counts).sort().join() === "downtime,minor_stop,speed_loss" &&
          counts["downtime"]! + counts["minor_stop"]! + counts["speed_loss"]! ===
            nslMachine.tl.events.filter((e) => !e.isTagged && (e.type === "downtime" || e.type === "minor_stop" || e.type === "speed_loss")).length,
      );
      check("speed gain does not count as unclassified loss time", selectMachineNotTaggedState(nslMachine.tl.events).notTaggedCount === nslMachine.tl.events.filter((e) => !e.isTagged && e.type !== "run" && e.type !== "negative_speed_loss").length);
    }

    // ---- F. Planned Downtime on Downtime becomes PD (OI-2.1) -----------------------------
    const dt = pick("downtime", 1);
    check("a machine with an untagged Downtime window exists", !!dt);
    if (dt) {
      const evs = dt.list.slice(0, 3);
      touched.push(...evs.map(keyOf));
      const before = timelineOf(dt.m);
      const pdBefore = before.windows.filter((w) => w.type === "planned").length;
      // Breakdown tag first: must not change windows or OEE
      const rb = reasonTagStore.saveGroup(
        evs.map((e) => ({ id: keyOf(e), startSec: e.startSec, endSec: e.endSec })),
        template("Breakdown"),
        reasonTagStore.getVersions(evs.map(keyOf)),
      );
      const mid = timelineOf(dt.m);
      check(
        "Breakdown tag leaves PD windows and OEE unchanged",
        rb.ok &&
          mid.windows.filter((w) => w.type === "planned").length === pdBefore &&
          mid.snapshot.oee === before.snapshot.oee,
      );
      // Re-tag as Planned Downtime (single mode edit path: version must match)
      const rp = reasonTagStore.saveGroup(
        evs.map((e) => ({ id: keyOf(e), startSec: e.startSec, endSec: e.endSec })),
        template("Planned Downtime"),
        reasonTagStore.getVersions(evs.map(keyOf)),
      );
      const after = timelineOf(dt.m);
      const pdAfter = after.windows.filter((w) => w.type === "planned").length;
      const expectedWindows = evs.reduce((s, e) => s + Math.round((e.endSec - e.startSec) / 30), 0);
      check("Planned Downtime tag saves", rp.ok);
      check(
        "Downtime windows become PD after the tag",
        Math.abs(pdAfter - pdBefore - expectedWindows) <= evs.length,
        `PD windows ${pdBefore} -> ${pdAfter} (expected +${expectedWindows})`,
      );
      check(
        "PD leaves SPT: availability changes",
        before.snapshot.availability !== after.snapshot.availability,
        `${before.snapshot.availability} -> ${after.snapshot.availability}`,
      );
    }
  } finally {
    reasonTagStore._purgeForTest(touched);
  }

  const passed = results.every((r) => r.passed);
  if (typeof console !== "undefined") {
    console.table(results.map((r) => ({ name: r.name, passed: r.passed, detail: r.detail ?? "" })));
    console.info("[CR2] Group Self-Test Passed:", passed);
  }
  return { passed, results };
}

declare global {
  interface Window {
    runReasonGroupSelfTest?: typeof runReasonGroupSelfTest;
  }
}

if (typeof window !== "undefined") {
  window.runReasonGroupSelfTest = runReasonGroupSelfTest;
}
