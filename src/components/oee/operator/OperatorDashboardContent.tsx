import { useState, useEffect } from "react";
import { IdwBlock } from "./IdwBlock";
import { ProcessOrderCard } from "./ProcessOrderCard";
import { ShiftPerformanceCard } from "./ShiftPerformanceCard";
import { QaInspectionModal } from "./QaInspectionModal";
import { LegacyShiftReminderModal } from "./LegacyShiftReminderModal";
import { isOeeActiveLine, LEGACY_SHIFT_REMINDER, SHIFT_REMINDER_LEAD_MIN } from "@/lib/oee/config";
import { getPoForLine } from "@/lib/oee/poMaster";
import { getQaIntervalForMpq } from "@/lib/oee/qaConfig";
import { useRejectStore, rejectStore } from "@/lib/oee/rejectStore";
import { AlertCircle } from "lucide-react";

export function OperatorDashboardContent({
  plantId,
  lineId,
  shiftKey,
}: {
  plantId: string;
  lineId: string;
  shiftKey: string;
}) {
  const isActiveLine = isOeeActiveLine(plantId, lineId);
  const poInfo = getPoForLine(lineId);

  const { totals } = useRejectStore(plantId, lineId, shiftKey);
  const grossOutput = 1576; // base sensor output
  const totalReject = totals.totalReject;
  const outputOee = Math.max(0, grossOutput - totalReject);

  // QA Inspection Alert state
  const intervalPcs = getQaIntervalForMpq(poInfo.mpq);
  const [qaStats, setQaStats] = useState({ sample: 227, released: 187, reject: 40 });
  const [qaModalOpen, setQaModalOpen] = useState(false);
  const [lastTriggeredOutput, setLastTriggeredOutput] = useState(0);

  useEffect(() => {
    if (isActiveLine && outputOee > 0 && outputOee - lastTriggeredOutput >= intervalPcs) {
      setQaModalOpen(true);
      setLastTriggeredOutput(outputOee);
    }
  }, [outputOee, lastTriggeredOutput, intervalPcs, isActiveLine]);

  const handleQaSubmit = (result: "Released" | "Reject", note: string) => {
    setQaStats((prev) => ({
      sample: prev.sample + 1,
      released: result === "Released" ? prev.released + 1 : prev.released,
      reject: result === "Reject" ? prev.reject + 1 : prev.reject,
    }));

    if (result === "Reject") {
      rejectStore.addQaReject({
        plantId,
        lineId,
        machineCode: "LCM07",
        rejectTypeId: "reject-seal",
        rejectTypeName: "Reject seal (QA)",
        qty: 1,
        at: Math.floor(Date.now() / 1000),
        note: note || "QA Inspection rejection",
        shiftKey,
      });
    }

    setQaModalOpen(false);
  };

  // Shift Reminder Modal state
  const [reminderOpen, setReminderOpen] = useState(false);

  useEffect(() => {
    // CR 4 replaced this pop-up; it only runs when LEGACY_SHIFT_REMINDER is turned on.
    if (!LEGACY_SHIFT_REMINDER) return;
    // Check if shift is ending within SHIFT_REMINDER_LEAD_MIN (10 min)
    const checkTimer = setInterval(() => {
      const now = new Date();
      const endHour = 15; // Shift end at 15:00
      const endMin = 0;
      const targetMin = endHour * 60 + endMin;
      const currentMin = now.getHours() * 60 + now.getMinutes();

      if (targetMin - currentMin <= SHIFT_REMINDER_LEAD_MIN && targetMin - currentMin >= 0) {
        const dismissedKey = `shift_reminder_dismissed_${shiftKey}`;
        if (!localStorage.getItem(dismissedKey)) {
          setReminderOpen(true);
          try {
            localStorage.setItem(dismissedKey, "true");
          } catch {
            // ignore
          }
        }
      }
    }, 15000);

    return () => clearInterval(checkTimer);
  }, [shiftKey]);

  if (!isActiveLine) {
    return (
      <div className="space-y-6 py-4">
        {/* Banner */}
        <div className="flex items-center gap-3 rounded-lg border border-amber-500/50 bg-amber-500/10 p-4 text-amber-700 dark:text-amber-300 shadow-xs">
          <AlertCircle className="size-5 shrink-0" />
          <p className="text-sm font-bold">
            OEE is not active for this line yet ({lineId}). Only Inline Device Weigher monitoring is
            available.
          </p>
        </div>

        {/* IDW Block Only */}
        <div className="max-w-md">
          <IdwBlock plantId={plantId} lineId={lineId} outputOee={outputOee} totalMpq={poInfo.mpq} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6 items-start">
      <IdwBlock plantId={plantId} lineId={lineId} outputOee={outputOee} totalMpq={poInfo.mpq} />
      <ProcessOrderCard
        plantId={plantId}
        lineId={lineId}
        poInfo={poInfo}
        outputOee={outputOee}
        totalReject={totalReject}
        qaStats={qaStats}
      />
      <ShiftPerformanceCard
        plantId={plantId}
        lineId={lineId}
        outputOee={outputOee}
        totalReject={totalReject}
      />

      <QaInspectionModal
        open={qaModalOpen}
        sampleNo={qaStats.sample + 1}
        onSubmitInspection={handleQaSubmit}
      />

      <LegacyShiftReminderModal
        open={LEGACY_SHIFT_REMINDER && reminderOpen}
        onOpenChange={setReminderOpen}
        currentShiftLabel="Shift 3 (23:00 - 09:30)"
        endTime="09:30"
        onChangeShift={(newShiftId) => {
          console.info("Changed shift to", newShiftId);
        }}
      />
    </div>
  );
}
