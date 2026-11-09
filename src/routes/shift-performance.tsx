import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";

import { BarByLine, TrendChart } from "@/components/oee/charts";
import { FilterBar } from "@/components/oee/filter-bar";
import { EmptyState, KpiCard, PageHeader, Panel } from "@/components/oee/ui";
import { useApp } from "@/lib/oee/app-context";
import { shiftPerformance } from "@/lib/oee/data";
import { getMetrics } from "@/lib/oee/metrics-engine";
import { getEngineTrendSeries } from "@/lib/oee/trendEngine";
import { usePeriod } from "@/lib/oee/period";
import { useScope } from "@/lib/oee/scope";

export const Route = createFileRoute("/shift-performance")({
  head: () => ({
    meta: [
      { title: "Shift Performance — Section Head" },
      {
        name: "description",
        content:
          "Section Head periodic evaluation: OPE by shift leader, weekly performance, performance leaders and operator ranking.",
      },
      { property: "og:title", content: "Shift Performance — Section Head" },
      {
        property: "og:description",
        content:
          "OPE by shift leader, weekly performance and operator ranking (low priority prototype page).",
      },
    ],
  }),
  component: ShiftPerformancePage,
});

function ShiftPerformancePage() {
  const { role } = useApp();
  const scope = useScope();
  const { resolved } = usePeriod();

  const plantMetrics = useMemo(() => {
    return getMetrics(scope.plantId, "plant", "", resolved);
  }, [scope.plantId, resolved]);

  const weeklyTrend = useMemo(() => {
    return getEngineTrendSeries(scope.plantId, "plant", "", resolved);
  }, [scope.plantId, resolved]);

  const rawData = useMemo(() => shiftPerformance(scope.plantId), [scope.plantId]);

  const data = useMemo(() => {
    const baseOee = plantMetrics.oee;
    return {
      opeByLeader: rawData.opeByLeader.map((l: { name: string; batches: number; ope: number }) => ({
        ...l,
        ope:
          l.name === "Non Shift"
            ? 32.5
            : l.name === "Unmap"
              ? 18.2
              : Math.max(
                  0,
                  Math.min(100, Math.round((baseOee + ((l.batches % 5) - 2) * 1.5) * 10) / 10),
                ),
      })),
      weekly: weeklyTrend,
      operators: rawData.operators.map((o: { name: string; output: number }) => ({
        ...o,
        output: Math.round((plantMetrics.outputActual ?? 15000) * (0.8 + (o.output % 40) / 100)),
      })),
    };
  }, [plantMetrics, weeklyTrend, rawData]);

  if (role !== "section-head") {
    return (
      <div className="flex min-h-screen flex-col bg-background font-sans text-foreground">
        <PageHeader
          title="Shift Performance"
          crumbs={[{ label: "Kemas", to: "/live" }, { label: "Shift Performance" }]}
        />
        <main className="flex flex-1 flex-col p-4">
          <EmptyState message="Halaman ini khusus Section Head — ganti role di header untuk membukanya." />
        </main>
      </div>
    );
  }

  const leaders = [...data.opeByLeader].sort((a, b) => b.ope - a.ope);
  const top = leaders.slice(0, 3);
  const focus = leaders.slice(-3).reverse();

  return (
    <div className="flex min-h-screen flex-col bg-background font-sans text-foreground">
      <PageHeader
        title="Shift Performance"
        crumbs={[
          { label: "Kemas", to: "/live" },
          { label: "Section Head Dashboard", to: "/analytics" },
          { label: "Shift Performance" },
        ]}
        back={{ label: "Section Head Dashboard", to: "/analytics" }}
        meta="Bonus page · built from BR Section Head 3.1-3.8"
      />
      <FilterBar />
      <main className="flex flex-1 flex-col gap-3 p-3 sm:p-4 min-w-0 max-w-full overflow-x-hidden">
        <p className="rounded-md border border-dashed border-border px-3 py-2 text-[11px] text-muted-foreground">
          Marked “Outside Scope” in the URS but specified in BR Section Head — included here as a
          low priority preview only (§6).
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <KpiCard label="Shift leaders" value={data.opeByLeader.length - 2} />
          <KpiCard
            label="Best OPE"
            value={`${top[0]?.ope.toFixed(1) ?? "-"}%`}
            caption={top[0]?.name}
          />
          <KpiCard
            label="Growth focus"
            value={`${focus[0]?.ope.toFixed(1) ?? "-"}%`}
            caption={focus[0]?.name}
          />
          <KpiCard
            label="Batches counted"
            value={data.opeByLeader.reduce((a: number, b: { batches: number }) => a + b.batches, 0)}
          />
        </div>

        <div className="grid w-full flex-1 items-stretch gap-3 grid-cols-1 lg:grid-cols-2">
          <Panel
            title="OPE by Shift Leader"
            subtitle="“Non Shift” and “Unmap” shown as plain extra bars"
            bodyClassName="relative min-h-[250px] h-full w-full flex-1"
          >
            <BarByLine
              data={data.opeByLeader.map((l: { name: string; ope: number }) => ({
                label: l.name,
                value: l.ope,
              }))}
            />
          </Panel>
          <Panel
            title="Weekly Performance"
            subtitle="Tooltip shows all shifts; click legend to hide a shift"
            bodyClassName="relative min-h-[250px] h-full w-full flex-1"
          >
            <TrendChart
              data={data.weekly}
              keys={["Shift 1", "Shift 2", "Shift 3", "Non Shift"]}
              reference={75}
            />
          </Panel>
          <Panel title="Performance Leaders / Growth Focus">
            <div className="grid gap-3 sm:grid-cols-2 text-[11px]">
              <div>
                <p className="mb-1 font-semibold uppercase tracking-wide text-muted-foreground">
                  Leaders
                </p>
                <ul className="space-y-1">
                  {top.map((l) => (
                    <li
                      key={l.name}
                      className="flex justify-between rounded border border-border px-2 py-1"
                    >
                      <span>{l.name}</span>
                      <span className="font-mono text-tier-good">{l.ope.toFixed(1)}%</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="mb-1 font-semibold uppercase tracking-wide text-muted-foreground">
                  Growth focus
                </p>
                <ul className="space-y-1">
                  {focus.map((l) => (
                    <li
                      key={l.name}
                      className="flex justify-between rounded border border-border px-2 py-1"
                    >
                      <span>{l.name}</span>
                      <span className="font-mono text-tier-bad">{l.ope.toFixed(1)}%</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Panel>
          <Panel title="Batch Count & Top/Bottom Operators" subtitle={`Scope: ${scope.scopeLabel}`}>
            <ul className="space-y-1.5">
              {[...data.operators]
                .sort((a, b) => b.output - a.output)
                .map((o, i) => (
                  <li key={o.name} className="flex items-center gap-2 text-[11px]">
                    <span className="w-5 font-mono text-muted-foreground">{i + 1}</span>
                    <span className="w-24 truncate">{o.name}</span>
                    <div className="h-2.5 flex-1 overflow-hidden rounded bg-grid/40">
                      <div
                        className="h-full rounded bg-primary"
                        style={{ width: `${(o.output / 20000) * 100}%` }}
                      />
                    </div>
                    <span className="w-20 text-right font-mono">{o.output.toLocaleString()}</span>
                  </li>
                ))}
            </ul>
          </Panel>
        </div>
      </main>
    </div>
  );
}
