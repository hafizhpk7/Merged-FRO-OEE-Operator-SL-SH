import { ReactNode } from "react";
import { OperatorSidebar } from "./OperatorSidebar";
import { OperatorHeader } from "./OperatorHeader";
import { SrrBlockedModal } from "./SrrBlockedModal";
import { SimulationPanel } from "./SimulationPanel";

export function OperatorShell({
  plantId,
  lineId,
  onBeforeFinishWorkOrder,
  children,
}: {
  plantId: string;
  lineId: string;
  onBeforeFinishWorkOrder?: (proceed: () => void) => void;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      <OperatorSidebar plantId={plantId} lineId={lineId} />
      <div className="flex min-h-screen flex-1 flex-col pl-16 min-w-0">
        <div className="flex w-full min-w-0 flex-1 flex-col gap-4 p-3 sm:p-4 lg:p-6">
          <SimulationPanel plantId={plantId} lineId={lineId} />
          <OperatorHeader
            plantId={plantId}
            lineId={lineId}
            {...(onBeforeFinishWorkOrder ? { onBeforeFinishWorkOrder } : {})}
          />
          <main className="flex min-w-0 flex-1 flex-col">{children}</main>
          <SrrBlockedModal />
        </div>
      </div>
    </div>
  );
}
