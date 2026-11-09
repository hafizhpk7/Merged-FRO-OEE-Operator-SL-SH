import { useEffect, useMemo, useState } from "react";
import { getTargetSnapshot, type TargetSnapshot } from "@/lib/oee/targetService";
import { useSrrMode } from "@/lib/oee/srrStore";
import { useWorkOrder } from "@/lib/oee/workOrderStore";
import { getNowMs, getShiftInfo, subscribeClock } from "@/lib/oee/shiftClock";
import { useViewShift } from "@/lib/oee/viewShiftStore";
import { TARGET_WINDOW_SEC } from "@/lib/oee/targetEngine";
import { useSimDataVersion } from "@/lib/oee/useSimTick";

/**
 * Target snapshot of a line, refreshed every 30 s sampling window (TG-07), on a clock jump, a
 * shift override change, an SRR switch or a work order change.
 */
export function useTargetSnapshot(plantId: string, lineId: string): TargetSnapshot {
  const mode = useSrrMode();
  const view = useViewShift();
  const dataVer = useSimDataVersion();
  const shiftKey = view.info.shiftKey;
  const wo = useWorkOrder(lineId, shiftKey);
  const [, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setTick((n) => n + 1), 5000);
    const unsub = subscribeClock(() => setTick((n) => n + 1));
    return () => {
      clearInterval(timer);
      unsub();
    };
  }, []);

  const bucket = Math.floor(getNowMs() / (TARGET_WINDOW_SEC * 1000));
  return useMemo(
    () => getTargetSnapshot(plantId, lineId, mode, getNowMs(), view.isPast ? view.info.startSec : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [plantId, lineId, mode, view.isPast ? 0 : bucket, shiftKey, wo.status, wo.finishedAtSec, getShiftInfo().startSec, view.info.startSec, dataVer],
  );
}
