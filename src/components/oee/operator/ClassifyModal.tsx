import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { Search, CheckCircle2, AlertTriangle, Info, Trash2, Plus, X, Edit2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  PARENTS,
  type LossParent,
  type LossCategoryNode,
  type LossReasonNode,
} from "@/lib/oee/lossTree";
import { REASON_L1_BY_TYPE } from "@/lib/oee/reasonConstants";
import { reasonTagStore } from "@/lib/oee/reasonTagStore";
import {
  notifyClassificationChanged,
  type MachineEvent,
  type LossCause,
} from "@/lib/oee/machineEvents";
import { getLineSiblingMachines } from "@/lib/oee/machineEvents";

export function ClassifyModal({
  event,
  open,
  onOpenChange,
}: {
  event: MachineEvent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const eventType: "downtime" | "minor_stop" | "speed_loss" =
    event?.type === "downtime"
      ? "downtime"
      : event?.type === "minor_stop"
        ? "minor_stop"
        : "speed_loss";

  const isPlcMapped = Boolean(event?.source === "PLC" && event?.plcAlarm);
  const totalDurationMin = event ? Math.round(event.durationSec / 60) : 0;

  // Available machines on current line
  const lineMachines = useMemo(
    () => (event ? getLineSiblingMachines(event.machineCode) : []),
    [event],
  );

  // Available L1 options
  const allowedL1s = useMemo(() => REASON_L1_BY_TYPE[eventType] || ["Breakdown"], [eventType]);

  // State
  const [selectedL1, setSelectedL1] = useState<LossParent>(allowedL1s[0] || "Breakdown");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedL2Id, setSelectedL2Id] = useState<string>("");
  const [selectedL3Id, setSelectedL3Id] = useState<string>("");
  const [selectedMachine, setSelectedMachine] = useState<string>(event?.machineCode || "");
  const [notes, setNotes] = useState<string>(event?.note || "");

  // Causes List
  const [causes, setCauses] = useState<LossCause[]>(event?.causes || []);
  const [timeError, setTimeError] = useState<string>("");

  // Start & End time inputs (in minutes relative to event start, or hh:mm string)
  const formatSecToTime = (startSec: number) => {
    const hh = String(Math.floor(startSec / 3600)).padStart(2, "0");
    const mm = String(Math.floor((startSec % 3600) / 60)).padStart(2, "0");
    return `${hh}:${mm}`;
  };

  const startSec = event?.startSec ?? 0;
  const endSec = event?.endSec ?? 0;

  // Compute next available start time for cause
  const classifiedSec = causes.reduce((sum, c) => sum + c.durationSec, 0);
  const nextStartSec = startSec + classifiedSec;
  const defaultNextEndSec = endSec;

  const [inputStartStr, setInputStartStr] = useState(formatSecToTime(nextStartSec));
  const [inputEndStr, setInputEndStr] = useState(formatSecToTime(defaultNextEndSec));

  // Reset inputs when event or open changes
  useEffect(() => {
    if (event) {
      setSelectedL1(allowedL1s[0] || "Breakdown");
      setSelectedMachine(event.machineCode);
      setNotes(event.note || "");
      setCauses(event.causes || []);
      const currentTag = reasonTagStore.getTags(event.id);
      if (currentTag) {
        setNotes(currentTag.notes || "");
      }
    }
  }, [event, open, allowedL1s]);

  // Categories under selected L1
  const activeL1Node = PARENTS.find((p) => p.id === selectedL1);
  const categories: LossCategoryNode[] = activeL1Node ? activeL1Node.categories : [];

  // Set default L2 & L3 when L1 changes
  useEffect(() => {
    if (categories.length > 0 && categories[0]) {
      setSelectedL2Id(categories[0].id);
      if (categories[0].reasons.length > 0 && categories[0].reasons[0]) {
        setSelectedL3Id(categories[0].reasons[0].id);
      }
    }
  }, [selectedL1, categories]);

  // Reasons under selected L2
  const activeL2Node = categories.find((c) => c.id === selectedL2Id);
  const reasons: LossReasonNode[] = activeL2Node ? activeL2Node.reasons : [];

  // Search filter across categories & reasons
  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return categories;
    const q = searchQuery.toLowerCase();
    return categories.filter(
      (cat) =>
        cat.name.toLowerCase().includes(q) ||
        cat.reasons.some((r) => r.name.toLowerCase().includes(q)),
    );
  }, [categories, searchQuery]);

  // Classified duration stats
  const classifiedMin = Math.round(classifiedSec / 60);
  const unclassifiedMin = Math.max(0, totalDurationMin - classifiedMin);

  // Handle Add Cause
  const handleAddCause = () => {
    if (!event) return;
    setTimeError("");
    const catNode = categories.find((c) => c.id === selectedL2Id);
    const reasonNode = catNode?.reasons.find((r) => r.id === selectedL3Id);

    if (!catNode || !reasonNode) {
      setTimeError("Please select both Category (L2) and Reason (L3)");
      return;
    }

    if (unclassifiedMin <= 0) {
      setTimeError("Event is already fully classified.");
      return;
    }

    const causeDurationSec = Math.max(30, unclassifiedMin * 60);
    const newCause: LossCause = {
      id: `C-${event.id}-${causes.length + 1}`,
      durationSec: causeDurationSec,
      l0Component: activeL1Node?.component || "Availability",
      l1Parent: selectedL1,
      l2CategoryId: catNode.id,
      l2CategoryName: catNode.name,
      l3ReasonId: reasonNode.id,
      l3ReasonName: reasonNode.name,
      causeMachineCode: selectedMachine,
      note: notes,
    };

    setCauses([...causes, newCause]);
  };

  // Handle Remove Cause
  const handleRemoveCause = (index: number) => {
    setCauses(causes.filter((_, i) => i !== index));
  };

  // Handle Save Classification
  const handleSave = () => {
    if (causes.length === 0) {
      toast.error("Please add at least one cause before saving.");
      return;
    }

    const firstCause = causes[0];
    if (event && firstCause) {
      reasonTagStore.addTags(event.id, {
        l2Category: firstCause.l2CategoryName,
        l3Reason: firstCause.l3ReasonName,
        notes,
      });
    }

    notifyClassificationChanged();

    const remaining = unclassifiedMin;
    if (remaining > 0) {
      toast.info(`Saved. ${remaining} min still unclassified`, {
        icon: <Info className="size-4 text-amber-500" />,
      });
    } else {
      toast.success("Classification saved successfully!", {
        icon: <CheckCircle2 className="size-4 text-emerald-500" />,
      });
    }

    onOpenChange(false);
  };

  if (!event || !open) return null;

  const titleType =
    eventType === "downtime"
      ? "Downtime"
      : eventType === "minor_stop"
        ? "Minor Stop"
        : "Speed Loss";

  const typeBadgeClass =
    eventType === "downtime"
      ? "bg-red-500 text-white"
      : eventType === "minor_stop"
        ? "bg-purple-500 text-white"
        : "bg-amber-500 text-white";

  const isFullyClassified = unclassifiedMin === 0;
  const statusBadge = isFullyClassified ? (
    <span className="flex items-center gap-1 text-emerald-600 font-bold text-xs bg-emerald-100 px-2 py-0.5 rounded-md">
      <CheckCircle2 className="size-3.5" /> Fully Classified
    </span>
  ) : (
    <span className="flex items-center gap-1 text-amber-600 font-bold text-xs bg-amber-100 px-2 py-0.5 rounded-md">
      <AlertTriangle className="size-3.5" /> Incomplete
    </span>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-6">
        <DialogHeader className="space-y-2 border-b border-border pb-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <DialogTitle className="text-xl font-bold">Edit {titleType}</DialogTitle>
              <span
                className={`rounded-md px-2.5 py-0.5 text-xs font-bold uppercase ${typeBadgeClass}`}
              >
                {titleType}
              </span>
            </div>
            <div className="text-xs font-mono text-muted-foreground">
              {formatSecToTime(event.startSec)} – {formatSecToTime(event.endSec)} (
              {totalDurationMin} mins duration)
            </div>
          </div>

          {/* PLC Read-Only Info Banner */}
          {isPlcMapped && (
            <div className="flex items-center gap-2 rounded-md border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/60 p-3 text-xs text-blue-800 dark:text-blue-200">
              <Info className="size-4 shrink-0 text-blue-600" />
              <span>
                Auto-tagged by PLC alarm code: <strong>{event.plcAlarm}</strong> (Read-Only)
              </span>
            </div>
          )}
        </DialogHeader>

        <div className="grid grid-cols-1 gap-6 pt-2 lg:grid-cols-12">
          {/* Left Column: Cascading Selection Controls */}
          <div className="space-y-4 lg:col-span-7">
            {/* Search Reason */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Search reason..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                disabled={isPlcMapped}
                className="pl-9 text-xs"
              />
            </div>

            {/* PARENT ISSUE (L1) */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                PARENT ISSUE (L1)
              </label>
              <div className="flex flex-wrap gap-1.5">
                {allowedL1s.map((l1) => (
                  <button
                    key={l1}
                    disabled={isPlcMapped}
                    onClick={() => setSelectedL1(l1)}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                      selectedL1 === l1
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "border border-border bg-card text-foreground hover:bg-accent"
                    }`}
                  >
                    {l1}
                  </button>
                ))}
              </div>
            </div>

            {/* CATEGORY (L2) Searchable Select */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                CATEGORY ISSUE (L2)
              </label>
              <select
                disabled={isPlcMapped}
                value={selectedL2Id}
                onChange={(e) => setSelectedL2Id(e.target.value)}
                className="w-full rounded-md border border-border bg-card px-3 py-2 text-xs font-medium text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
              >
                {filteredCategories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* REASON (L3) List */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                REASON ISSUE (L3)
              </label>
              <div className="max-h-40 overflow-y-auto rounded-md border border-border bg-card p-1">
                {reasons.length === 0 ? (
                  <div className="p-3 text-center text-xs text-muted-foreground">
                    No reasons available
                  </div>
                ) : (
                  reasons.map((r) => (
                    <button
                      key={r.id}
                      disabled={isPlcMapped}
                      onClick={() => setSelectedL3Id(r.id)}
                      className={`flex w-full items-center justify-between rounded-sm px-2.5 py-1.5 text-xs transition-colors ${
                        selectedL3Id === r.id
                          ? "bg-primary/10 font-semibold text-primary"
                          : "text-foreground hover:bg-accent"
                      }`}
                    >
                      <span>{r.name}</span>
                      {selectedL3Id === r.id && <CheckCircle2 className="size-3.5 text-primary" />}
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* MACHINE Selection Chips */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                MACHINE
              </label>
              <div className="flex flex-wrap gap-1.5">
                {lineMachines.map((m) => (
                  <button
                    key={m.code}
                    disabled={isPlcMapped}
                    onClick={() => setSelectedMachine(m.code)}
                    className={`rounded-md px-2.5 py-1 text-xs font-mono font-medium transition-colors ${
                      selectedMachine === m.code
                        ? "bg-foreground text-background"
                        : "border border-border bg-card text-foreground hover:bg-accent"
                    }`}
                  >
                    {m.code}
                  </button>
                ))}
              </div>
            </div>

            {/* TIME RANGE */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground uppercase">
                  START TIME
                </label>
                <Input value={inputStartStr} disabled className="mt-1 h-8 text-xs font-mono" />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground uppercase">
                  END TIME
                </label>
                <Input
                  value={inputEndStr}
                  onChange={(e) => setInputEndStr(e.target.value)}
                  disabled={isPlcMapped}
                  className="mt-1 h-8 text-xs font-mono"
                />
              </div>
            </div>

            {timeError && <p className="text-xs text-destructive">{timeError}</p>}

            <Button
              onClick={handleAddCause}
              disabled={isPlcMapped || unclassifiedMin <= 0}
              className="w-full h-8 text-xs font-medium"
            >
              <Plus className="size-3.5 mr-1" /> Add Cause
            </Button>
          </div>

          {/* Right Column: Cause List & Status */}
          <div className="space-y-4 lg:col-span-5">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                CAUSE LIST
              </span>
              <span className="text-xs font-mono text-muted-foreground">
                {classifiedMin} / {totalDurationMin} min
              </span>
            </div>

            {/* Classification Status Bar */}
            <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 p-2.5">
              <span className="text-xs font-medium text-foreground">Classification Status</span>
              {statusBadge}
            </div>

            {/* Cause Items */}
            <div className="space-y-2 min-h-[120px] max-h-[220px] overflow-y-auto">
              {causes.length === 0 ? (
                <div className="rounded-md border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                  No causes added yet. Select Category & Reason and click "+ Add cause".
                </div>
              ) : (
                causes.map((c, idx) => (
                  <div
                    key={c.id || idx}
                    className="flex items-start justify-between rounded-md border border-border bg-card p-3 shadow-2xs"
                  >
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-foreground">{c.l3ReasonName}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {c.l2CategoryName} ({c.l1Parent})
                      </p>
                      <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground">
                        <span>Machine: {c.causeMachineCode || event.machineCode}</span>
                        <span>·</span>
                        <span>{Math.round(c.durationSec / 60)} mins</span>
                      </div>
                    </div>
                    {!isPlcMapped && (
                      <button
                        onClick={() => handleRemoveCause(idx)}
                        className="text-muted-foreground hover:text-destructive p-1 rounded hover:bg-accent"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* NOTES */}
            <div className="space-y-1.5 pt-2">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                NOTES
              </label>
              <Textarea
                placeholder="Add investigation notes, root cause analysis, or operator comments..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={isPlcMapped}
                className="h-20 text-xs"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="mt-4 flex gap-2 border-t border-border pt-4 sm:justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isPlcMapped || causes.length === 0}
            className="bg-primary text-primary-foreground font-medium text-xs px-6"
          >
            Save Classification
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
