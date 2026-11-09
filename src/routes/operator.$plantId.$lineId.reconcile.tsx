import { createFileRoute } from "@tanstack/react-router";
import { OperatorShell } from "@/components/oee/operator/OperatorShell";
import { ReconcilePage } from "@/components/oee/operator/ReconcilePage";

// CR 3: registered in src/routeTree.gen.ts.
export const Route = createFileRoute("/operator/$plantId/$lineId/reconcile")({
  component: Page,
});

function Page() {
  const { plantId, lineId } = Route.useParams();
  return (
    <OperatorShell plantId={plantId} lineId={lineId}>
      <ReconcilePage plantId={plantId} lineId={lineId} />
    </OperatorShell>
  );
}
