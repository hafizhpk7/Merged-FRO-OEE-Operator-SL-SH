import { createFileRoute } from "@tanstack/react-router";
import { OperatorShell } from "@/components/oee/operator/OperatorShell";
import { OperatorSelectors } from "@/components/oee/operator/OperatorSelectors";
import { OperatorDashboardContent } from "@/components/oee/operator/OperatorDashboardContent";
import { getShiftInfo } from "@/lib/oee/shiftClock";

export const Route = createFileRoute("/operator/$plantId/$lineId/")({
  component: OperatorDashboardPage,
});

function OperatorDashboardPage() {
  const { plantId, lineId } = Route.useParams();
  // Real shift key (same as the OEE engines and the Reject page) so reject totals agree.
  const shiftKey = getShiftInfo().shiftKey;

  return (
    <OperatorShell plantId={plantId} lineId={lineId}>
      <div className="space-y-4">
        <OperatorSelectors plantId={plantId} lineId={lineId} />
        <OperatorDashboardContent plantId={plantId} lineId={lineId} shiftKey={shiftKey} />
      </div>
    </OperatorShell>
  );
}
