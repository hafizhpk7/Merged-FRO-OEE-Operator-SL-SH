import { useMemo, useState, useSyncExternalStore } from "react";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  getL3Options,
  getLineMachineCodesForConfig,
  l3Name,
  REJECT_L2,
  rejectConfigStore,
  type L2Id,
  type SlotConfig,
  type SlotStatus,
} from "@/lib/oee/rejectConfigStore";

const PLANT = "J2";
const LINES = ["TUP01", "TUP13", "TUP14", "BOP15", "BOP16"];
const STATUS_CLASS: Record<SlotStatus, string> = {
  Assigned: "bg-emerald-100 text-emerald-800",
  Unassigned: "bg-muted text-muted-foreground",
  Incomplete: "bg-amber-100 text-amber-800",
  Duplicate: "bg-red-100 text-red-800",
};

/**
 * Master Data: reject slot configuration per machine. A slot = one (L2, L3) pair: choose the L2
 * first, then an L3 entry under that L2. The same (machine, L2, L3) is blocked (Duplicate). To show
 * the same label under RM and RS, configure two slots (two entries).
 */
export function RejectConfigMaster() {
  const [lineId, setLineId] = useState(LINES[0] as string);
  const machines = getLineMachineCodesForConfig(PLANT, lineId);
  const [machine, setMachine] = useState(machines[0] ?? "");
  const m = machines.includes(machine) ? machine : (machines[0] ?? "");

  useSyncExternalStore(rejectConfigStore.subscribe, () => rejectConfigStore.getAudit().length, () => 0);
  const stored = rejectConfigStore.getSlots(PLANT, lineId, m);
  const storedSig = JSON.stringify(stored);
  const [draft, setDraft] = useState<{ sig: string; slots: SlotConfig[] }>({ sig: "", slots: [] });
  // Draft follows the stored config until the user edits (reset when machine/config changes).
  const key = `${lineId}|${m}|${storedSig}`;
  const [draftKey, setDraftKey] = useState("");
  if (draftKey !== key) {
    setDraftKey(key);
    setDraft({ sig: storedSig, slots: stored.map((s) => ({ ...s })) });
  }
  const slots = draft.slots;
  const setSlots = (fn: (cur: SlotConfig[]) => SlotConfig[]) =>
    setDraft((d) => ({ ...d, slots: fn(d.slots) }));

  const statuses = useMemo(() => rejectConfigStore.validate(slots), [slots]);
  const statusOf = (no: number) => statuses.find((s) => s.slotNo === no)?.status ?? "Unassigned";
  const count = (st: SlotStatus) => statuses.filter((s) => s.status === st).length;
  const perL2 = (l2: L2Id) => slots.filter((s) => s.l2Id === l2 && s.l3Id).length;
  const dirty = JSON.stringify(slots) !== draft.sig;
  const blocked = count("Duplicate") + count("Incomplete") > 0;
  const audit = rejectConfigStore.getAudit().filter((a) => a.machineKey === `${PLANT}:${lineId}:${m}`).reverse();

  const patch = (no: number, p: Partial<SlotConfig>) =>
    setSlots((cur) => cur.map((s) => (s.slotNo === no ? { ...s, ...p } : s)));

  return (
    <div className="space-y-4 p-6" data-testid="reject-config-master">
      <div>
        <h1 className="text-lg font-bold">Master Data: Reject Config</h1>
        <p className="text-xs text-muted-foreground">
          Satu slot = satu pasangan (L2, L3). Pilih L2 dulu, lalu L3 di bawah L2 tersebut. Untuk menampilkan label yang
          sama di RS dan RM, konfigurasikan dua slot.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <select
          aria-label="Line"
          data-testid="mc-line"
          value={lineId}
          onChange={(e) => {
            setLineId(e.target.value);
            setMachine(getLineMachineCodesForConfig(PLANT, e.target.value)[0] ?? "");
          }}
          className="h-9 rounded-md border border-border bg-card px-2 text-sm"
        >
          {LINES.map((l) => (
            <option key={l}>{l}</option>
          ))}
        </select>
        <select
          aria-label="Mesin"
          data-testid="mc-machine"
          value={m}
          onChange={(e) => setMachine(e.target.value)}
          className="h-9 rounded-md border border-border bg-card px-2 text-sm"
        >
          {machines.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <div className="ml-auto flex items-center gap-2 text-xs" data-testid="mc-summary">
          <span className="rounded bg-emerald-100 px-2 py-1 font-semibold text-emerald-800" data-testid="mc-assigned">
            Assigned {count("Assigned")}
          </span>
          <span className="rounded bg-muted px-2 py-1 font-semibold" data-testid="mc-unassigned">
            Unassigned {count("Unassigned")}
          </span>
          {REJECT_L2.map((l) => (
            <span key={l.id} className="rounded border px-2 py-1" data-testid={`mc-l2-${l.id}`}>
              {l.id} {perL2(l.id)}
            </span>
          ))}
        </div>
      </div>

      <table className="w-full border-collapse text-sm" data-testid="mc-slots">
        <thead>
          <tr className="bg-muted/50 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
            <th className="border px-3 py-2">Slot</th>
            <th className="border px-3 py-2">L2</th>
            <th className="border px-3 py-2">L3 (reason)</th>
            <th className="border px-3 py-2">Status</th>
            <th className="border px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {slots.map((s) => {
            const st = statusOf(s.slotNo);
            return (
              <tr key={s.slotNo} data-testid="mc-slot" data-status={st}>
                <td className="border px-3 py-1.5 font-mono">{s.slotNo}</td>
                <td className="border px-3 py-1.5">
                  <select
                    aria-label={`L2 slot ${s.slotNo}`}
                    data-testid={`mc-l2-select-${s.slotNo}`}
                    value={s.l2Id ?? ""}
                    onChange={(e) => {
                      const l2 = (e.target.value || null) as L2Id | null;
                      // L3 must stay under the chosen L2
                      const keep = l2 && s.l3Id && getL3Options(l2).some((o) => o.id === s.l3Id);
                      patch(s.slotNo, { l2Id: l2, l3Id: keep ? s.l3Id : null });
                    }}
                    className="h-8 w-44 rounded-md border border-border bg-card px-2 text-sm"
                  >
                    <option value="">Pilih L2</option>
                    {REJECT_L2.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.chipLabel}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="border px-3 py-1.5">
                  <select
                    aria-label={`L3 slot ${s.slotNo}`}
                    data-testid={`mc-l3-select-${s.slotNo}`}
                    value={s.l3Id ?? ""}
                    disabled={!s.l2Id}
                    onChange={(e) => patch(s.slotNo, { l3Id: e.target.value || null })}
                    className="h-8 w-56 rounded-md border border-border bg-card px-2 text-sm disabled:opacity-50"
                  >
                    <option value="">{s.l2Id ? "Pilih L3" : "Pilih L2 dulu"}</option>
                    {(s.l2Id ? getL3Options(s.l2Id) : []).map((o) => (
                      <option key={o.id} value={o.id}>
                        {l3Name(o.id)}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="border px-3 py-1.5">
                  <span className={`rounded px-2 py-0.5 text-[11px] font-semibold ${STATUS_CLASS[st]}`} data-testid="mc-status">
                    {st}
                  </span>
                </td>
                <td className="border px-3 py-1.5 text-right">
                  <button
                    type="button"
                    aria-label={`Kosongkan slot ${s.slotNo}`}
                    onClick={() => patch(s.slotNo, { l2Id: null, l3Id: null })}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-4" />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          data-testid="mc-add"
          onClick={() => setSlots((cur) => [...cur, { slotNo: cur.length + 1, l2Id: null, l3Id: null }])}
        >
          <Plus className="mr-1 size-3.5" /> Tambah slot
        </Button>
        {blocked && (
          <span className="text-xs text-destructive" data-testid="mc-blocked">
            Perbaiki slot Duplicate / Incomplete sebelum menyimpan.
          </span>
        )}
        <div className="ml-auto flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            data-testid="mc-cancel"
            disabled={!dirty}
            onClick={() => setSlots(() => stored.map((s) => ({ ...s })))}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            data-testid="mc-save"
            disabled={!dirty || blocked}
            onClick={() => {
              const r = rejectConfigStore.saveSlots(PLANT, lineId, m, slots, "Master Data");
              if (r.ok) toast.success(`Konfigurasi reject ${m} disimpan.`);
              else toast.error(r.errors.join(", "));
            }}
          >
            Save
          </Button>
        </div>
      </div>

      <div className="space-y-1" data-testid="mc-audit">
        <p className="text-sm font-semibold">Audit konfigurasi</p>
        {audit.length === 0 ? (
          <p className="text-xs text-muted-foreground">Belum ada perubahan tersimpan.</p>
        ) : (
          <ul className="space-y-1 text-xs">
            {audit.slice(0, 10).map((a, i) => (
              <li key={i} className="rounded border px-3 py-1.5">
                {a.at.slice(0, 19).replace("T", " ")} · {a.user} · {a.before.filter((x) => x.l3Id).length} →{" "}
                {a.after.filter((x) => x.l3Id).length} slot terisi
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
