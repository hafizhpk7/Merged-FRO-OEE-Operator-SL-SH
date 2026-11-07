/**
 * Single source of truth for PLC Alarm Mapping & Loss Classification Resolution.
 * Master v2 compliant.
 */

import { matchPlcAlarmCode, slugify, type LossComponent, type LossParent } from "./lossTree";
import type { EventType, LossCause } from "./machineEvents";
import { reasonTagStore } from "./reasonTagStore";

export const NOT_TAGGED_LABEL = "Not Tagged Yet";

export interface DowntimeClassificationResult {
  l0Component: LossComponent;
  l1Parent: LossParent;
  l2CategoryName: string;
  l3ReasonName: string;
  source: "PLC" | "Non-PLC";
  isTagged: boolean;
  l2CategoryId: string;
  l3ReasonId: string;
}

/**
 * Resolves classification for downtime events using master v2 mapping.
 */
export function resolveDowntimeClassification(
  plcAlarm?: string,
  eventId?: string,
): DowntimeClassificationResult {
  if (eventId) {
    const userTag = reasonTagStore.getTags(eventId);
    if (userTag) {
      const l2CategoryId = slugify(`availability.breakdown.${userTag.l2Category}`);
      const l3ReasonId = slugify(
        `availability.breakdown.${userTag.l2Category}.${userTag.l3Reason}`,
      );
      return {
        l0Component: "Availability",
        l1Parent: "Breakdown",
        l2CategoryName: userTag.l2Category,
        l3ReasonName: userTag.l3Reason,
        source: "Non-PLC",
        isTagged: true,
        l2CategoryId,
        l3ReasonId,
      };
    }
  }

  const match = matchPlcAlarmCode(plcAlarm);
  if (match) {
    const l2CategoryId = slugify(`availability.${match.l1Parent}.${match.l2CategoryName}`);
    const l3ReasonId = slugify(
      `availability.${match.l1Parent}.${match.l2CategoryName}.${match.l3ReasonName}`,
    );
    return {
      l0Component: "Availability",
      l1Parent: match.l1Parent,
      l2CategoryName: match.l2CategoryName,
      l3ReasonName: match.l3ReasonName,
      source: "PLC",
      isTagged: true,
      l2CategoryId,
      l3ReasonId,
    };
  }

  return {
    l0Component: "Availability",
    l1Parent: "Breakdown",
    l2CategoryName: NOT_TAGGED_LABEL,
    l3ReasonName: NOT_TAGGED_LABEL,
    source: "Non-PLC",
    isTagged: false,
    l2CategoryId: slugify(`availability.breakdown.${NOT_TAGGED_LABEL}`),
    l3ReasonId: slugify(`availability.breakdown.${NOT_TAGGED_LABEL}`),
  };
}

/**
 * Resolves classification for any machine event (downtime, minor stop, speed loss, planned).
 * Minor stops and speed loss are either auto-tagged (source PLC) or Not Tagged Yet (source Non-PLC) (~60/40),
 * strictly using master v2 categories and reasons.
 */
export function resolveEventClassification(
  type: EventType,
  plcAlarm?: string,
  eventId: string = "",
  index: number = 0,
): {
  l0Component: LossComponent;
  l1Parent: LossParent;
  l2CategoryName: string;
  l3ReasonName: string;
  source: "PLC" | "Non-PLC" | "Operator";
  isTagged: boolean;
  causes: LossCause[];
} {
  if (type === "downtime") {
    const res = resolveDowntimeClassification(plcAlarm);
    const causes: LossCause[] = res.isTagged
      ? [
          {
            id: `C-${eventId}-0`,
            durationSec: 0,
            l0Component: res.l0Component,
            l1Parent: res.l1Parent,
            l2CategoryId: res.l2CategoryId,
            l2CategoryName: res.l2CategoryName,
            l3ReasonId: res.l3ReasonId,
            l3ReasonName: res.l3ReasonName,
          },
        ]
      : [];
    return {
      ...res,
      causes,
    };
  }

  if (type === "planned") {
    return {
      l0Component: "Loading",
      l1Parent: "Planned Downtime",
      l2CategoryName: "Breaks & Meetings",
      l3ReasonName: "Briefing",
      source: "Operator",
      isTagged: true,
      causes: [
        {
          id: `C-${eventId}-0`,
          durationSec: 0,
          l0Component: "Loading",
          l1Parent: "Planned Downtime",
          l2CategoryId: "loading.planned-downtime.breaks-meetings",
          l2CategoryName: "Breaks & Meetings",
          l3ReasonId: "loading.planned-downtime.breaks-meetings.briefing",
          l3ReasonName: "Briefing",
        },
      ],
    };
  }

  if (type === "minor_stop") {
    // 60% tagged, 40% untagged
    const isTagged = plcAlarm ? true : index % 5 !== 1 && index % 5 !== 3;
    if (isTagged) {
      const minorReasons = [
        { cat: "Sensor / Detection", reason: "Product Sensing Error" },
        { cat: "Infeed / Outfeed Jam", reason: "Infeed Jam" },
        { cat: "Sensor / Detection", reason: "Sensor Jam" },
        { cat: "Cap / Lid Feeding Jam", reason: "Cap Chute Jam" },
      ];
      const sel = minorReasons[index % minorReasons.length];
      return {
        l0Component: "Performance",
        l1Parent: "Minor Stop",
        l2CategoryName: sel?.cat || NOT_TAGGED_LABEL,
        l3ReasonName: sel?.reason || NOT_TAGGED_LABEL,
        source: "PLC",
        isTagged: true,
        causes: [
          {
            id: `C-${eventId}-0`,
            durationSec: 0,
            l0Component: "Performance",
            l1Parent: "Minor Stop",
            l2CategoryId: slugify(`performance.minor-stop.${sel?.cat || ""}`),
            l2CategoryName: sel?.cat || "",
            l3ReasonId: slugify(`performance.minor-stop.${sel?.cat || ""}.${sel?.reason || ""}`),
            l3ReasonName: sel?.reason || "",
          },
        ],
      };
    }
    return {
      l0Component: "Performance",
      l1Parent: "Minor Stop",
      l2CategoryName: NOT_TAGGED_LABEL,
      l3ReasonName: NOT_TAGGED_LABEL,
      source: "Non-PLC",
      isTagged: false,
      causes: [],
    };
  }

  if (type === "speed_loss") {
    // 60% tagged, 40% untagged
    const isTagged = index % 5 !== 2 && index % 5 !== 4;
    if (isTagged) {
      const speedReasons = [
        { cat: "Reduced Speed for Quality", reason: "Slow run to prevent foaming" },
        { cat: "Reduced Speed for Quality", reason: "High viscosity adjustment" },
        { cat: "Operator Pacing", reason: "Manual infeed slow" },
      ];
      const sel = speedReasons[index % speedReasons.length];
      return {
        l0Component: "Performance",
        l1Parent: "Speed Loss",
        l2CategoryName: sel?.cat || NOT_TAGGED_LABEL,
        l3ReasonName: sel?.reason || NOT_TAGGED_LABEL,
        source: "PLC",
        isTagged: true,
        causes: [
          {
            id: `C-${eventId}-0`,
            durationSec: 0,
            l0Component: "Performance",
            l1Parent: "Speed Loss",
            l2CategoryId: slugify(`performance.speed-loss.${sel?.cat || ""}`),
            l2CategoryName: sel?.cat || "",
            l3ReasonId: slugify(`performance.speed-loss.${sel?.cat || ""}.${sel?.reason || ""}`),
            l3ReasonName: sel?.reason || "",
          },
        ],
      };
    }
    return {
      l0Component: "Performance",
      l1Parent: "Speed Loss",
      l2CategoryName: NOT_TAGGED_LABEL,
      l3ReasonName: NOT_TAGGED_LABEL,
      source: "Non-PLC",
      isTagged: false,
      causes: [],
    };
  }

  return {
    l0Component: "Loading",
    l1Parent: "Planned Downtime",
    l2CategoryName: NOT_TAGGED_LABEL,
    l3ReasonName: NOT_TAGGED_LABEL,
    source: "Non-PLC",
    isTagged: false,
    causes: [],
  };
}
