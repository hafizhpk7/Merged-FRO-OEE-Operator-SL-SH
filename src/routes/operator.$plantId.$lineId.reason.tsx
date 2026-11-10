import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useLineOperationalMode } from "@/lib/oee/assetMaster";
import { SRR_BLOCKED_TABS } from "@/lib/oee/config";
import { srrBlockStore } from "@/lib/oee/srrBlockStore";
import { useEffect, useState, useMemo } from "react";
import { OperatorShell } from "@/components/oee/operator/OperatorShell";
import { OperatorSelectors } from "@/components/oee/operator/OperatorSelectors";
import { ProductionTimelineCard } from "@/components/oee/operator/ProductionTimelineCard";
import { ClassifyModal } from "@/components/oee/operator/ClassifyModal";
import { PendingListModal } from "@/components/oee/operator/PendingListModal";
import { ShiftClosingBlockerModal } from "@/components/oee/operator/ShiftClosingBlockerModal";
import {
  getShiftTimeline,
  useClassificationVersion,
  type MachineEvent,
} from "@/lib/oee/machineEvents";
import { getShiftInfoAt } from "@/lib/oee/shiftClock";
import { useViewShift } from "@/lib/oee/viewShiftStore";
import { useSimDataVersion, useSimWindowBucket } from "@/lib/oee/useSimTick";
import { getLine } from "@/lib/oee/data";

export const Route = createFileRoute("/operator/$plantId/$lineId/reason")({
  // CR 4: "Classify Issue" opens Reason for a given machine and shift (shift = start epoch sec).
  validateSearch: (search: Record<string, unknown>): { machine?: string; shift?: number } => {
    const shift = Number(search["shift"]);
    return {
      ...(typeof search["machine"] === "string" && search["machine"]
        ? { machine: search["machine"] }
        : {}),
      ...(search["shift"] !== undefined && Number.isFinite(shift) ? { shift } : {}),
    };
  },
  component: OperatorReasonPage,
});

/** IDW-only line (not pilot, or SRR Line missing): Reason is blocked (also by direct URL); stay on / go back to the Dashboard with the modal. */
function OperatorReasonPage() {
  const { plantId, lineId } = Route.useParams();
  const navigate = useNavigate();
  // IDW-only: not a SCADA pilot line, or the SRR Line is not set
  const blocked = useLineOperationalMode(plantId, lineId).mode !== "full" && SRR_BLOCKED_TABS.includes("reason");
  useEffect(() => {
    if (!blocked) return;
    srrBlockStore.open();
    void navigate({ to: "/operator/$plantId/$lineId", params: { plantId, lineId }, replace: true });
  }, [blocked, plantId, lineId, navigate]);
  if (blocked) return null;
  return <OperatorReasonInner />;
}

function OperatorReasonInner() {
  const { plantId, lineId } = Route.useParams();
  const search = Route.useSearch();
  // Default to the first machine of the line (the old "LCM07" default is not on every line).
  const line =
    getLine(plantId, "A", lineId) || getLine(plantId, "B", lineId) || getLine(plantId, "C", lineId);
  const [selectedMachine, setSelectedMachine] = useState(
    search.machine ?? line?.machines[0]?.id ?? "LCM07",
  );
  useEffect(() => {
    if (search.machine) setSelectedMachine(search.machine);
  }, [search.machine]);

  // Re-render trigger when tags change
  const version = useClassificationVersion();
  void version;

  // Selected shift info
  // (CR 4: the reminder can open a shift that has just ended, identified by its start time)
  // A completed shift always shows until its end (view.info.elapsedSec is the full shift); the current
  // shift grows with the central clock, one sampling window (30 s simulated) at a time.
  const view = useViewShift();
  const bucket = useSimWindowBucket();
  const dataVer = useSimDataVersion();
  const rawShift = search.shift !== undefined ? getShiftInfoAt(search.shift) : view.info;
  const elapsedKey = Math.floor(rawShift.elapsedSec / 30) * 30;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const shiftInfo = useMemo(() => ({ ...rawShift, elapsedSec: elapsedKey }), [rawShift.startSec, elapsedKey, bucket, dataVer]);
  const isPastShift = !rawShift.isCurrent && rawShift.elapsedSec >= 28800;

  // Shift timeline and snapshot for selected machine (re-computed when version changes)
  const timeline = useMemo(() => {
    return getShiftTimeline(selectedMachine, shiftInfo, undefined, plantId, "this-shift", lineId);
  }, [selectedMachine, shiftInfo, plantId, lineId, version]);

  // Modals state
  const [classifyModalOpen, setClassifyModalOpen] = useState(false);
  // 1 event = single mode, 2+ events = group mode (CR 2). Session bumps on every open so the
  // modal captures fresh window versions.
  const [classifyEvents, setClassifyEvents] = useState<MachineEvent[]>([]);
  const [classifySession, setClassifySession] = useState(0);

  const [pendingListOpen, setPendingListOpen] = useState(false);
  const [pendingTypeFilter, setPendingTypeFilter] = useState("downtime");

  const [blockerModalOpen, setBlockerModalOpen] = useState(false);
  const [pendingFinishCallback, setPendingFinishCallback] = useState<(() => void) | null>(null);

  // Unclassified events count
  const unclassifiedEvents = useMemo(() => {
    return timeline.events.filter(
      (e) =>
        (e.type === "downtime" || e.type === "minor_stop" || e.type === "speed_loss") &&
        !e.isTagged,
    );
  }, [timeline]);

  const unclassifiedMin = useMemo(() => {
    return Math.round(unclassifiedEvents.reduce((sum, e) => sum + e.durationSec, 0) / 60);
  }, [unclassifiedEvents]);

  // Open the Classify modal for one window (single) or a selection (group)
  const handleOpenClassify = (selected: MachineEvent[]) => {
    if (selected.length === 0) return;
    setClassifyEvents(selected);
    setClassifySession((n) => n + 1);
    setClassifyModalOpen(true);
  };

  // Open the per-type Overview
  const handleOpenPendingList = (filter = "downtime") => {
    setPendingTypeFilter(filter);
    setPendingListOpen(true);
  };

  // Shift change or finish work order trigger
  const handleTriggerShiftFinish = (onConfirm: () => void) => {
    if (unclassifiedMin > 0) {
      setPendingFinishCallback(() => onConfirm);
      setBlockerModalOpen(true);
    } else {
      onConfirm();
    }
  };

  return (
    <OperatorShell
      plantId={plantId}
      lineId={lineId}
      onBeforeFinishWorkOrder={(proceed) => handleTriggerShiftFinish(proceed)}
      onBeforeShiftChange={(proceed) => handleTriggerShiftFinish(proceed)}
      headerExtra={
        <OperatorSelectors
          plantId={plantId}
          lineId={lineId}
          showMachineSelect={true}
          selectedMachine={selectedMachine}
          onMachineChange={setSelectedMachine}
        />
      }
    >
      <div className="page-fill">

        {/* Production Timeline Card */}
        <ProductionTimelineCard
          timeline={timeline}
          onOpenPendingList={handleOpenPendingList}
          onSelectEventToClassify={(ev) => handleOpenClassify([ev])}
        />

        {/* Classify Modal (single / group) */}
        <ClassifyModal
          key={classifySession}
          shift={shiftInfo}
          events={classifyEvents}
          open={classifyModalOpen}
          onOpenChange={setClassifyModalOpen}
        />

        {/* Overview per type (Uncommented / Committed) */}
        <PendingListModal
          open={pendingListOpen}
          onOpenChange={setPendingListOpen}
          events={timeline.events}
          initialFilter={pendingTypeFilter}
          onClassify={handleOpenClassify}
        />

        {/* Shift Closing Blocker Modal */}
        <ShiftClosingBlockerModal
          open={blockerModalOpen}
          onOpenChange={setBlockerModalOpen}
          unclassifiedMin={unclassifiedMin}
          onClassifyNow={() => handleOpenPendingList("downtime")}
          onFinishAnyway={() => {
            if (pendingFinishCallback) {
              pendingFinishCallback();
            }
          }}
        />
      </div>
    </OperatorShell>
  );
}
