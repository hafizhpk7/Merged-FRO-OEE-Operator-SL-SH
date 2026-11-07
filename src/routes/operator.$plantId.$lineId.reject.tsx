import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { OperatorShell } from "@/components/oee/operator/OperatorShell";
import { OperatorSelectors } from "@/components/oee/operator/OperatorSelectors";
import { RejectPageContent } from "@/components/oee/operator/RejectPageContent";
import { getMockShifts } from "@/lib/oee/shiftMaster";

export const Route = createFileRoute("/operator/$plantId/$lineId/reject")({
  component: OperatorRejectPage,
});

function OperatorRejectPage() {
  const { plantId, lineId } = Route.useParams();
  const [selectedMachine, setSelectedMachine] = useState("ALL");
  const shifts = getMockShifts();
  const currentShift = shifts.find((s) => s.isCurrent) || shifts[0];
  const shiftKey = currentShift?.id || "shift-3-current";

  return (
    <OperatorShell plantId={plantId} lineId={lineId}>
      <div className="space-y-4">
        <OperatorSelectors
          plantId={plantId}
          lineId={lineId}
          showMachineSelect={true}
          selectedMachine={selectedMachine}
          onMachineChange={setSelectedMachine}
          includeAllMachines={true}
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
