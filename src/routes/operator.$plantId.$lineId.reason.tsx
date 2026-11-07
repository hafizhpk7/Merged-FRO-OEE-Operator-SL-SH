import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { OperatorShell } from "@/components/oee/operator/OperatorShell";
import { OperatorSelectors } from "@/components/oee/operator/OperatorSelectors";
import { OperatorOeeStrip } from "@/components/oee/operator/OperatorOeeStrip";
import { ProductionTimelineCard } from "@/components/oee/operator/ProductionTimelineCard";
import { ClassifyModal } from "@/components/oee/operator/ClassifyModal";
import { PendingListModal } from "@/components/oee/operator/PendingListModal";
import { ShiftClosingBlockerModal } from "@/components/oee/operator/ShiftClosingBlockerModal";
import {
  getShiftTimeline,
  useClassificationVersion,
  type MachineEvent,
} from "@/lib/oee/machineEvents";
import { getShiftInfo } from "@/lib/oee/shiftClock";

export const Route = createFileRoute("/operator/$plantId/$lineId/reason")({
  component: OperatorReasonPage,
});

function OperatorReasonPage() {
  const { plantId, lineId } = Route.useParams();
  const [selectedMachine, setSelectedMachine] = useState("LCM07");

  // Re-render trigger when tags change
  const version = useClassificationVersion();
  void version;

  // Selected shift info
  const shiftInfo = useMemo(() => getShiftInfo(), []);

  // Shift timeline and snapshot for selected machine (re-computed when version changes)
  const timeline = useMemo(() => {
    return getShiftTimeline(selectedMachine, shiftInfo, undefined, plantId);
  }, [selectedMachine, shiftInfo, plantId, version]);

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
    >
      <div className="space-y-4">
        {/* Selectors Row */}
        <OperatorSelectors
          plantId={plantId}
          lineId={lineId}
          showMachineSelect={true}
          selectedMachine={selectedMachine}
          onMachineChange={setSelectedMachine}
          onBeforeShiftChange={(proceed) => handleTriggerShiftFinish(proceed)}
        />

        {/* Read-Only OEE Strip */}
        <OperatorOeeStrip snapshot={timeline.snapshot} />

        {/* Production Timeline Card */}
        <ProductionTimelineCard
          timeline={timeline}
          onOpenPendingList={handleOpenPendingList}
          onSelectEventToClassify={(ev) => handleOpenClassify([ev])}
        />

        {/* Classify Modal (single / group) */}
        <ClassifyModal
          key={classifySession}
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
