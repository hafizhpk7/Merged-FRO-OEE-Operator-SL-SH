import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2, Clock, Filter, Tag } from "lucide-react";
import type { MachineEvent } from "@/lib/oee/machineEvents";

export function PendingListModal({
  open,
  onOpenChange,
  events,
  initialFilter = "all",
  onSelectEventToClassify,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  events: MachineEvent[];
  initialFilter?: string;
  onSelectEventToClassify: (event: MachineEvent) => void;
}) {
  const [activeTab, setActiveTab] = useState<"not_tagged" | "tagged">("not_tagged");
  const [typeFilter, setTypeFilter] = useState<string>(initialFilter);

  // Filter events based on loss types (D, MS, SL only)
  const lossEvents = events.filter(
    (e) => e.type === "downtime" || e.type === "minor_stop" || e.type === "speed_loss",
  );

  const notTaggedList = lossEvents.filter((e) => !e.isTagged);
  const taggedList = lossEvents.filter((e) => e.isTagged);

  const currentList = activeTab === "not_tagged" ? notTaggedList : taggedList;

  const filteredList = currentList.filter((e) => {
    if (typeFilter === "all") return true;
    if (typeFilter === "downtime") return e.type === "downtime";
    if (typeFilter === "minor_stop") return e.type === "minor_stop";
    if (typeFilter === "speed_loss") return e.type === "speed_loss";
    return true;
  });

  const formatTime = (sec: number) => {
    const hh = String(Math.floor(sec / 3600)).padStart(2, "0");
    const mm = String(Math.floor((sec % 3600) / 60)).padStart(2, "0");
    return `${hh}:${mm}`;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md p-6 flex flex-col h-full">
        <SheetHeader className="space-y-1 border-b border-border pb-4">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-md bg-amber-500/10 text-amber-600">
              <Tag className="size-4" />
            </span>
            <SheetTitle className="text-lg font-bold">Pending Classifications</SheetTitle>
          </div>
          <SheetDescription className="text-xs text-muted-foreground">
            Review and tag unclassified downtime, minor stops, and speed loss events for the current
            shift.
          </SheetDescription>
        </SheetHeader>

        {/* Status Tabs: Not Tagged vs Tagged */}
        <div className="flex items-center gap-2 pt-3">
          <button
            onClick={() => setActiveTab("not_tagged")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold transition-colors ${
              activeTab === "not_tagged"
                ? "bg-amber-500 text-white shadow-xs"
                : "border border-border bg-card text-muted-foreground hover:bg-accent"
            }`}
          >
            <AlertTriangle className="size-3.5" />
            Not Tagged ({notTaggedList.length})
          </button>
          <button
            onClick={() => setActiveTab("tagged")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold transition-colors ${
              activeTab === "tagged"
                ? "bg-emerald-600 text-white shadow-xs"
                : "border border-border bg-card text-muted-foreground hover:bg-accent"
            }`}
          >
            <CheckCircle2 className="size-3.5" />
            Tagged ({taggedList.length})
          </button>
        </div>

        {/* Type Filter Chips */}
        <div className="flex items-center gap-1.5 pt-2">
          <Filter className="size-3.5 text-muted-foreground mr-1" />
          {[
            { id: "all", label: "All" },
            { id: "downtime", label: "Downtime" },
            { id: "minor_stop", label: "Minor Stop" },
            { id: "speed_loss", label: "Speed Loss" },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setTypeFilter(f.id)}
              className={`rounded-full px-2.5 py-1 text-[10px] font-semibold transition-colors ${
                typeFilter === f.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-accent"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Scrollable Event List */}
        <div className="flex-1 overflow-y-auto space-y-3 pt-3 pr-1">
          {filteredList.length === 0 ? (
            <div className="rounded-md border border-dashed border-border p-8 text-center text-xs text-muted-foreground">
              No events found in this view.
            </div>
          ) : (
            filteredList.map((e) => {
              const durMin = Math.round(e.durationSec / 60);
              const typeLabel =
                e.type === "downtime"
                  ? "Downtime"
                  : e.type === "minor_stop"
                    ? "Minor Stop"
                    : "Speed Loss";

              const badgeColor =
                e.type === "downtime"
                  ? "bg-red-500 text-white"
                  : e.type === "minor_stop"
                    ? "bg-purple-500 text-white"
                    : "bg-amber-500 text-white";

              return (
                <div
                  key={e.id}
                  className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3 shadow-2xs transition-all hover:border-primary/50"
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${badgeColor}`}
                    >
                      {typeLabel}
                    </span>
                    <span className="flex items-center gap-1 font-mono text-xs text-muted-foreground">
                      <Clock className="size-3" />
                      {formatTime(e.startSec)} – {formatTime(e.endSec)} ({durMin} min)
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <div>
                      <p className="text-xs font-semibold text-foreground">
                        {e.l3ReasonName || (e.isTagged ? "Tagged" : "Unclassified Event")}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        Machine: {e.machineCode} {e.plcAlarm ? `· ${e.plcAlarm}` : ""}
                      </p>
                    </div>

                    <Button
                      size="sm"
                      onClick={() => {
                        onOpenChange(false);
                        onSelectEventToClassify(e);
                      }}
                      className="h-7 px-3 text-xs font-semibold"
                    >
                      {activeTab === "not_tagged" ? "Classify" : "Edit"}
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
