import { createFileRoute } from "@tanstack/react-router";
import { OperatorShell } from "@/components/oee/operator/OperatorShell";
import { OperatorSelectors } from "@/components/oee/operator/OperatorSelectors";
import { OperatorDashboardContent } from "@/components/oee/operator/OperatorDashboardContent";
import { ShiftReminderHost } from "@/components/oee/operator/ShiftReminderHost";
import { SrrSwitch } from "@/components/oee/operator/SrrSwitch";
import { getShiftInfo } from "@/lib/oee/shiftClock";
import { useLineOperationalMode } from "@/lib/oee/assetMaster";

export const Route = createFileRoute("/operator/$plantId/$lineId/")({
  component: OperatorDashboardPage,
});

function OperatorDashboardPage() {
  const { plantId, lineId } = Route.useParams();
  // Real shift key (same as the OEE engines and the Reject page) so reject totals agree.
  const shiftKey = getShiftInfo().shiftKey;
  const srrMissing = useLineOperationalMode(plantId, lineId).reason === "srr-line-missing";

  return (
    <OperatorShell plantId={plantId} lineId={lineId}>
      <div className="space-y-4">
        <OperatorSelectors
          plantId={plantId}
          lineId={lineId}
          extra={srrMissing ? undefined : <SrrSwitch plantId={plantId} lineId={lineId} />}
        />
        <OperatorDashboardContent plantId={plantId} lineId={lineId} shiftKey={shiftKey} />
        {!srrMissing && <ShiftReminderHost plantId={plantId} lineId={lineId} />}
      </div>
    </OperatorShell>
  );
}
