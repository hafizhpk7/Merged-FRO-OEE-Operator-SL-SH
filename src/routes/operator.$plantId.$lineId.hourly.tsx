import { createFileRoute } from "@tanstack/react-router";
import { OperatorShell } from "@/components/oee/operator/OperatorShell";
import { HourlyRealisasi } from "@/components/oee/operator/HourlyRealisasi";

// CR 5 part B: opened by "Realisasi per jam" on the Dashboard. Registered in src/routeTree.gen.ts.
export const Route = createFileRoute("/operator/$plantId/$lineId/hourly")({
  component: OperatorHourlyPage,
});

function OperatorHourlyPage() {
  const { plantId, lineId } = Route.useParams();
  return (
    <OperatorShell plantId={plantId} lineId={lineId}>
      <HourlyRealisasi plantId={plantId} lineId={lineId} />
    </OperatorShell>
  );
}
