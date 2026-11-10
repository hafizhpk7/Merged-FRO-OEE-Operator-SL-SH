import { createFileRoute } from "@tanstack/react-router";
import { OperatorShell } from "@/components/oee/operator/OperatorShell";
import { OperatorDashboardContent } from "@/components/oee/operator/OperatorDashboardContent";
import { ShiftReminderHost } from "@/components/oee/operator/ShiftReminderHost";
import { SrrSwitch } from "@/components/oee/operator/SrrSwitch";
import { useViewShift } from "@/lib/oee/viewShiftStore";
import { useLineOperationalMode } from "@/lib/oee/assetMaster";
import { useDashboardVersion } from "@/lib/oee/dashboardVersionStore";

export const Route = createFileRoute("/operator/$plantId/$lineId/")({
  component: OperatorDashboardPage,
});

function OperatorDashboardPage() {
  const { plantId, lineId } = Route.useParams();
  // Real shift key (same as the OEE engines and the Reject page) so reject totals agree.
  const view = useViewShift();
  const shiftKey = view.info.shiftKey;
  const legacy = useDashboardVersion() === "old";
  const opMode = useLineOperationalMode(plantId, lineId);
  const srrMissing = opMode.reason === "srr-line-missing";
  const idwOnly = opMode.mode !== "full"; // no OEE: no shift-change reminder

  return (
    <OperatorShell
      plantId={plantId}
      lineId={lineId}
      {...(srrMissing || legacy ? {} : { headerExtra: <SrrSwitch plantId={plantId} lineId={lineId} /> })}
    >
      <div className="page-fill">
        <OperatorDashboardContent plantId={plantId} lineId={lineId} shiftKey={shiftKey} />
        {!idwOnly && !legacy && !view.isPast && <ShiftReminderHost plantId={plantId} lineId={lineId} />}
      </div>
    </OperatorShell>
  );
}
