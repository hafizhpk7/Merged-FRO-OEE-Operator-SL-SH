import { ReactNode } from "react";
import { OperatorSidebar } from "./OperatorSidebar";
import { OperatorHeader } from "./OperatorHeader";
import { SrrBlockedModal } from "./SrrBlockedModal";

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
      <div className="flex flex-1 flex-col pl-16 min-w-0">
        <div className="container mx-auto max-w-7xl p-6 space-y-4">
          <OperatorHeader
            plantId={plantId}
            lineId={lineId}
            {...(onBeforeFinishWorkOrder ? { onBeforeFinishWorkOrder } : {})}
          />
          <main className="min-w-0 flex-1">{children}</main>
          <SrrBlockedModal />
        </div>
      </div>
    </div>
  );
}
