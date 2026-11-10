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
  headerExtra,
  children,
}: {
  plantId: string;
  lineId: string;
  onBeforeFinishWorkOrder?: (proceed: () => void) => void;
  onBeforeShiftChange?: (proceed: () => void) => void;
  /** Controls placed beside LIST SHIFT in the header card (SRR switch, Realisasi per jam, LIST MACHINE). */
  headerExtra?: ReactNode;
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
        {...(headerExtra ? { extra: headerExtra } : {})}
      />
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      <SrrBlockedModal />
    </OperatorFrame>
  );
}
