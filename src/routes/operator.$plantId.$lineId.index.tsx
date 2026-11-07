import { createFileRoute } from "@tanstack/react-router";
import { OperatorShell } from "@/components/oee/operator/OperatorShell";
import { OperatorSelectors } from "@/components/oee/operator/OperatorSelectors";
import { OperatorDashboardContent } from "@/components/oee/operator/OperatorDashboardContent";
import { getMockShifts } from "@/lib/oee/shiftMaster";

export const Route = createFileRoute("/operator/$plantId/$lineId/")({
  component: OperatorDashboardPage,
});

function OperatorDashboardPage() {
  const { plantId, lineId } = Route.useParams();
  const shifts = getMockShifts();
  const currentShift = shifts.find((s) => s.isCurrent) || shifts[0];
  const shiftKey = currentShift?.id || "shift-3-current";

  return (
    <OperatorShell plantId={plantId} lineId={lineId}>
      <div className="space-y-4">
        <OperatorSelectors plantId={plantId} lineId={lineId} />
        <OperatorDashboardContent plantId={plantId} lineId={lineId} shiftKey={shiftKey} />
      </div>
    </OperatorShell>
  );
}
