import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { OperatorShell } from "@/components/oee/operator/OperatorShell";
import { OperatorSelectors } from "@/components/oee/operator/OperatorSelectors";
import { RejectPageContent } from "@/components/oee/operator/RejectPageContent";
import { useViewShift } from "@/lib/oee/viewShiftStore";
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
  const shiftKey = useViewShift().info.shiftKey;

  return (
    <OperatorShell
      plantId={plantId}
      lineId={lineId}
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
