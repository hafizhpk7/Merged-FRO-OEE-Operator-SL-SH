import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { OperatorShell } from "@/components/oee/operator/OperatorShell";
import { OperatorSelectors } from "@/components/oee/operator/OperatorSelectors";
import { RejectPageContent } from "@/components/oee/operator/RejectPageContent";
import { getShiftInfo } from "@/lib/oee/shiftClock";
import { getLine } from "@/lib/oee/data";

export const Route = createFileRoute("/operator/$plantId/$lineId/reject")({
  component: OperatorRejectPage,
});

function OperatorRejectPage() {
  const { plantId, lineId } = Route.useParams();
  const line =
    getLine(plantId, "A", lineId) || getLine(plantId, "B", lineId) || getLine(plantId, "C", lineId);
  const [selectedMachine, setSelectedMachine] = useState(line?.machines[0]?.id ?? "LCM07");
  // Same key the OEE engines use, so reject corrections reach Quality/OEE.
  const shiftKey = getShiftInfo().shiftKey;

  return (
    <OperatorShell plantId={plantId} lineId={lineId}>
      <div className="space-y-4">
        <OperatorSelectors
          plantId={plantId}
          lineId={lineId}
          showMachineSelect={true}
          selectedMachine={selectedMachine}
          onMachineChange={setSelectedMachine}
        />
        <RejectPageContent
          plantId={plantId}
          lineId={lineId}
          selectedMachine={selectedMachine}
          shiftKey={shiftKey}
        />
      </div>
    </OperatorShell>
  );
}
