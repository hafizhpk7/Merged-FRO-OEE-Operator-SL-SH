import { useEffect, useMemo, useState } from "react";
import { type Alarm, type Line, type Plant } from "@/lib/oee/data";
import { type ResolvedPeriod } from "@/lib/oee/period";
import { formatTimeWib, getWibNow, getShiftInfo } from "@/lib/oee/shiftClock";
import { makeRng } from "@/lib/oee/rng";
import { matchPlcAlarmCode, ALARM_L1_PARENTS } from "@/lib/oee/lossTree";
import { getShiftTimeline, DOWNTIME_THRESHOLD_SEC } from "@/lib/oee/machineEvents";

/**
 * Evaluates the period context to determine:
 * 1. includesCurrentDay: Whether the period includes the ongoing today (allows live real-time updates)
 * 2. isStrictlyToday: Whether the period spans only today (determines time-only vs date+time formatting)
 */
export function getPeriodAlarmContext(resolved: ResolvedPeriod, now: Date = new Date()) {
  const wibNow = getWibNow(now);
  // Start of today in WIB: 00:00:00 WIB
  const startOfTodayMs =
    Date.UTC(wibNow.getUTCFullYear(), wibNow.getUTCMonth(), wibNow.getUTCDate(), 0, 0, 0, 0) -
    7 * 3600000;
  const endOfTodayMs = startOfTodayMs + 24 * 3600 * 1000 - 1;

  let includesCurrentDay = false;
  let isStrictlyToday = false;

  if (resolved.periodKey === "this-shift" || resolved.periodKey === "today") {
    includesCurrentDay = true;
    isStrictlyToday = true;
  } else if (resolved.periodKey === "this-week" || resolved.periodKey === "this-month") {
    includesCurrentDay = true;
    isStrictlyToday = false;
  } else if (resolved.periodKey === "custom") {
    const endMs = resolved.end.getTime();
    const startMs = resolved.start.getTime();

    // Custom Range includes current day ONLY IF the selected end-date is today (or greater)
    includesCurrentDay = endMs >= startOfTodayMs;

    // Strictly for today ONLY IF it only spans today's date
    isStrictlyToday = startMs >= startOfTodayMs && endMs <= endOfTodayMs + 1000;
  }

  return {
    includesCurrentDay,
    isStrictlyToday,
    startOfTodayMs,
    endOfTodayMs,
  };
}

/**
 * Formats alarm timestamp:
 * - If strictly for TODAY ("This Shift", "Today", or Custom Range spanning only today): time only (e.g. "14:30:45")
 * - If multi-day or strictly historical ("This Week", "This Month", or multi-day/historical Custom Range): date + time (e.g. "21 Oct, 14:30:45")
 */
export function formatAlarmTimestamp(timestamp: number, isStrictlyToday: boolean): string {
  const timeStr = formatTimeWib(timestamp, true);
  if (isStrictlyToday) {
    return timeStr;
  }
  const wib = getWibNow(new Date(timestamp));
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const dNum = String(wib.getUTCDate()).padStart(2, "0");
  const mName = months[wib.getUTCMonth()];
  return `${dNum} ${mName}, ${timeStr}`;
}

export function generateInitialAlarms({
  plant,
  line,
  resolved,
  includesCurrentDay,
  isStrictlyToday,
}: {
  plant?: Plant;
  line?: Line;
  resolved: ResolvedPeriod;
  includesCurrentDay: boolean;
  isStrictlyToday: boolean;
}): Alarm[] {
  const startMs = resolved.start.getTime();
  const endMs = resolved.end.getTime();
  const shift = getShiftInfo();
  const periodKey = resolved.periodKey;

  const lines: Line[] = line ? [line] : plant?.zones?.flatMap((z) => z.lines) || [];
  if (!lines.length) return [];

  const plantId = plant?.id || "J2";
  const allDowntimeAlarms: Alarm[] = [];

  // For each line, gather downtime events from its machines
  for (const l of lines) {
    for (const m of l.machines) {
      const machineCode = m.code || m.id;
      const timeline = getShiftTimeline(machineCode, shift, undefined, plantId, periodKey);

      // Filter for downtime events (type === "downtime", duration > 10 min / 600s)
      // Minor stops (10m or less), speed loss, planned events are strictly NOT alarms.
      const downtimeEvents = timeline.events.filter(
        (e) => e.type === "downtime" && e.durationSec > DOWNTIME_THRESHOLD_SEC,
      );

      for (const e of downtimeEvents) {
        // Must fall within period window if historical
        if (!includesCurrentDay) {
          if (e.startAt < startMs || e.startAt > endMs) {
            continue;
          }
        }

        const match = matchPlcAlarmCode(e.plcAlarm);
        let source: "PLC" | "Non-PLC" = "Non-PLC";
        let l2Category = "Not Tagged Yet";
        let l3Reason = "Not Tagged Yet";
        let isTagged = false;

        if (match && ALARM_L1_PARENTS.includes(match.l1Parent)) {
          source = "PLC";
          l2Category = match.l2CategoryName;
          l3Reason = match.l3ReasonName;
          isTagged = true;
        } else if (e.causes && e.causes.length > 0 && e.causes[0]?.l2CategoryName) {
          const firstCause = e.causes[0];
          source = "Non-PLC";
          l2Category = firstCause.l2CategoryName;
          l3Reason = firstCause.l3ReasonName;
          isTagged = true;
        } else {
          source = "Non-PLC";
          l2Category = "Not Tagged Yet";
          l3Reason = "Not Tagged Yet";
          isTagged = false;
        }

        const durationMinutes = Math.max(10, Math.round(e.durationSec / 60));
        const isOccurring = Boolean(e.isOngoing && includesCurrentDay);

        allDowntimeAlarms.push({
          id: `${l.id}-${machineCode}-${e.id}`,
          lineId: l.id,
          machineId: machineCode,
          issue: e.plcAlarm || e.note || "Unscheduled downtime stoppage",
          timestamp: e.startAt,
          start: formatAlarmTimestamp(e.startAt, isStrictlyToday),
          durationMinutes,
          status: isOccurring ? "OCCURRING" : "Resolved",
          severity:
            isOccurring || durationMinutes >= 30
              ? "CRITICAL"
              : durationMinutes >= 15
                ? "HIGH"
                : "MEDIUM",
          l2Category,
          l3Reason,
          source,
          ...(e.plcAlarm ? { plcAlarmCode: e.plcAlarm } : {}),
          isTagged,
        });
      }
    }
  }

  // Ensure deterministic fallback if no machine timeline produced a downtime event
  if (allDowntimeAlarms.length === 0) {
    const seed = `${line ? line.id : plantId}-${periodKey}-${startMs}`;
    const rng = makeRng(seed);
    const count = line ? 2 : Math.min(6, lines.length);

    for (let i = 0; i < count; i++) {
      const l = lines[i % lines.length];
      if (!l) continue;
      const m = l.machines[i % l.machines.length];
      const machineCode = m?.code || m?.id || "LTF01";
      const isOccurring =
        includesCurrentDay && i === 0 && (l.status === "down" || l.status === "slow");
      const duration = 12 + Math.floor(rng() * 35);
      const alarmTime = isOccurring
        ? Date.now() - duration * 60000
        : Math.max(startMs + 60000, endMs - (i + 1) * (3600000 * 2));

      // 50% mapped PLC, 50% Non-PLC untagged
      const usePlc = rng() > 0.5;
      const plcAlarm = usePlc ? "Air Hose Leakage" : undefined;
      const match = matchPlcAlarmCode(plcAlarm);

      allDowntimeAlarms.push({
        id: `${l.id}-${machineCode}-dt-${i}`,
        lineId: l.id,
        machineId: machineCode,
        issue: plcAlarm || "Unscheduled downtime stoppage",
        timestamp: alarmTime,
        start: formatAlarmTimestamp(alarmTime, isStrictlyToday),
        durationMinutes: duration,
        status: isOccurring ? "OCCURRING" : "Resolved",
        severity: isOccurring ? "CRITICAL" : "MEDIUM",
        source: match ? "PLC" : "Non-PLC",
        l2Category: match ? match.l2CategoryName : "Not Tagged Yet",
        l3Reason: match ? match.l3ReasonName : "Not Tagged Yet",
        ...(plcAlarm ? { plcAlarmCode: plcAlarm } : {}),
        isTagged: Boolean(match),
      });
    }
  }

  return allDowntimeAlarms.sort((a, b) =>
    a.status === b.status
      ? (b.timestamp ?? 0) - (a.timestamp ?? 0)
      : a.status === "OCCURRING"
        ? -1
        : 1,
  );
}

export function useAlarms({
  plant,
  line,
  resolved,
}: {
  plant?: Plant;
  line?: Line;
  resolved: ResolvedPeriod;
}) {
  const { includesCurrentDay, isStrictlyToday } = useMemo(
    () => getPeriodAlarmContext(resolved),
    [resolved],
  );

  const [alarms, setAlarms] = useState<Alarm[]>(() =>
    generateInitialAlarms({
      ...(plant ? { plant } : {}),
      ...(line ? { line } : {}),
      resolved,
      includesCurrentDay,
      isStrictlyToday,
    }),
  );

  const startMs = resolved.start.getTime();
  const endMs = resolved.end.getTime();
  const plantId = plant?.id;
  const lineId = line?.id;
  const periodKey = resolved.periodKey;

  // Sync state whenever period or target plant/line changes
  useEffect(() => {
    setAlarms(
      generateInitialAlarms({
        ...(plant ? { plant } : {}),
        ...(line ? { line } : {}),
        resolved,
        includesCurrentDay,
        isStrictlyToday,
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plantId, lineId, periodKey, startMs, endMs, includesCurrentDay, isStrictlyToday]);

  // Real-time polling / simulation: ONLY runs if includesCurrentDay is true
  useEffect(() => {
    if (!includesCurrentDay) {
      // Historical period: NO interval, static data
      return;
    }

    const interval = setInterval(() => {
      setAlarms((prev) => {
        const now = Date.now();
        let changed = false;
        const updated = prev.map((a) => {
          if (a.status === "OCCURRING" && a.timestamp) {
            const currentDuration = Math.max(1, Math.floor((now - a.timestamp) / 60000));
            if (currentDuration !== a.durationMinutes) {
              changed = true;
              return { ...a, durationMinutes: currentDuration };
            }
          }
          return a;
        });
        return changed ? updated : prev;
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [includesCurrentDay, periodKey, startMs, endMs]);

  return { alarms, includesCurrentDay, isStrictlyToday };
}
