import { ReactNode } from "react";
import { OperatorFrame } from "./OperatorFrame";
import { OperatorHeader } from "./OperatorHeader";
import { SrrBlockedModal } from "./SrrBlockedModal";
import { SimulationPanel } from "./SimulationPanel";

export function OperatorShell({
  plantId,
  lineId,
  onBeforeFinishWorkOrder,
  onBeforeShiftChange,
  children,
}: {
  plantId: string;
  lineId: string;
  onBeforeFinishWorkOrder?: (proceed: () => void) => void;
  onBeforeShiftChange?: (proceed: () => void) => void;
  children: ReactNode;
}) {
  return (
    <OperatorFrame plantId={plantId} lineId={lineId}>
      <SimulationPanel plantId={plantId} lineId={lineId} />
      <OperatorHeader
        plantId={plantId}
        lineId={lineId}
        {...(onBeforeFinishWorkOrder ? { onBeforeFinishWorkOrder } : {})}
        {...(onBeforeShiftChange ? { onBeforeShiftChange } : {})}
      />
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      <SrrBlockedModal />
    </OperatorFrame>
  );
}
