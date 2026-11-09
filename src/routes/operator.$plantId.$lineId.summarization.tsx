import { createFileRoute } from "@tanstack/react-router";
import { OperatorShell } from "@/components/oee/operator/OperatorShell";
import { SummarizationPage } from "@/components/oee/operator/SummarizationPage";

// CR 3: registered in src/routeTree.gen.ts.
export const Route = createFileRoute("/operator/$plantId/$lineId/summarization")({
  component: Page,
});

function Page() {
  const { plantId, lineId } = Route.useParams();
  return (
    <OperatorShell plantId={plantId} lineId={lineId}>
      <SummarizationPage plantId={plantId} lineId={lineId} />
    </OperatorShell>
  );
}
