import { Link, createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowDownUp } from "lucide-react";

import { BarByLine, DivergingList, Sparkline, TrendChart } from "@/components/oee/charts";
import { FilterBar } from "@/components/oee/filter-bar";
import { MetricDropdown, METRICS_ORDER, type MetricId } from "@/components/oee/metric-dropdown";
import { Delta, Donut, KpiCard, NoDataForFilters, PageHeader, Panel } from "@/components/oee/ui";
import { useApp } from "@/lib/oee/app-context";
import { biggestLoss, comparison, type Point } from "@/lib/oee/data";
import { MACHINE_OUTPUT_LABEL } from "@/lib/oee/config";
import { RESOLUTIONS, SPANS } from "@/lib/oee/filters";
import { useScope } from "@/lib/oee/scope";
import { getMetrics, type EntityType } from "@/lib/oee/metrics-engine";
import { getEngineTrendSeries } from "@/lib/oee/trendEngine";
import { usePeriod } from "@/lib/oee/period";

export const Route = createFileRoute("/analytics/")({
  head: () => ({
    meta: [
      { title: "OEE Analytics Dashboard — Shift Leader & Section Head" },
      {
        name: "description",
        content:
          "OEE analytics with filter bar, summary cards, OEE trend, period comparison and OEE by line ranking.",
      },
      { property: "og:title", content: "OEE Analytics Dashboard" },
      {
        property: "og:description",
        content:
          "Summary cards, OEE trend, period comparison and OEE by line ranking on mock data.",
      },
    ],
  }),
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const { role, filters } = useApp();
  const scope = useScope();
  const { resolved } = usePeriod();
  const [sortAsc, setSortAsc] = useState(true);
  const [selectedLines, setSelectedLines] = useState<string[]>([]);
  const [selectedMetrics, setSelectedMetrics] = useState<MetricId[]>(["OEE"]);

  const title =
    role === "section-head" ? "Section Head Dashboard — OEE" : "Shift Leader Dashboard — OEE";

  const level: EntityType =
    filters.lineIds.length === 1 ? "line" : filters.zoneIds.length === 1 ? "zone" : "plant";
  const entityId =
    filters.lineIds.length === 1
      ? (filters.lineIds[0] ?? "")
      : filters.zoneIds.length === 1
        ? (filters.zoneIds[0] ?? "")
        : scope.plantId;

  const scopeMetrics = useMemo(() => {
    return getMetrics(scope.plantId, level, entityId, resolved);
  }, [scope.plantId, level, entityId, resolved]);

  const trend = useMemo(() => {
    return getEngineTrendSeries(scope.plantId, level, entityId, resolved);
  }, [scope.plantId, level, entityId, resolved]);

  const isOeeSelected = selectedMetrics.includes("OEE");
  const trendSubtitle = isOeeSelected
    ? "Dashed line = reference target 75%"
    : selectedMetrics.length > 1
      ? `${selectedMetrics.length} metrics selected`
      : `${selectedMetrics[0]} trend`;

  const spark = (offset: number) =>
    Array.from({ length: 7 }, (_, i) => ({
      label: `D${i + 1}`,
      v: Math.max(
        0,
        Math.min(100, Math.round((scopeMetrics.oee + offset + Math.sin(i + offset) * 2) * 10) / 10),
      ),
    }));

  const byLine = useMemo(() => {
    const rows = scope.lines
      .filter((l) => selectedLines.length === 0 || selectedLines.includes(l.id))
      .map((l) => ({
        label: l.id,
        value: getMetrics(scope.plantId, "line", l.id, resolved).oee,
      }));
    return rows.sort((a, b) => (sortAsc ? a.value - b.value : b.value - a.value));
  }, [scope.plantId, scope.lines, selectedLines, sortAsc, resolved]);

  const cmp = useMemo(() => comparison(scope.seed, scope.lines), [scope.seed, scope.lines]);
  const loss = useMemo(() => biggestLoss(scope.seed), [scope.seed]);

  const goodOutput = scopeMetrics.outputActual ?? 0;
  const planOutput = scope.lines.reduce((a, l) => a + l.outputTarget, 0) || 1;
  const attained = Math.round((goodOutput / planOutput) * 1000) / 10;

  return (
    <div className="flex min-h-screen flex-col bg-background font-sans text-foreground">
      <PageHeader
        title={title}
        crumbs={[{ label: "Kemas", to: "/live" }, { label: title }]}
        meta={`Week 32 · ${scope.spanLabel}`}
      />
      <FilterBar />

      {!scope.hasData ? (
        <main className="flex-1 p-4">
          <NoDataForFilters />
        </main>
      ) : (
        <main className="flex flex-1 flex-col gap-3 p-3 sm:p-4 min-w-0 max-w-full overflow-x-hidden">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
            <div className="flex items-center justify-center rounded-lg border border-border bg-surface py-3">
              <Donut value={scopeMetrics.oee} size={96} label="Average OEE" />
            </div>
            <KpiCard label="Availability" value={scopeMetrics.availability.toFixed(1)} unit="%">
              <Sparkline data={spark(2)} />
            </KpiCard>
            <KpiCard label="Performance" value={scopeMetrics.performance.toFixed(1)} unit="%">
              <Sparkline data={spark(-4)} />
            </KpiCard>
            <KpiCard label="Quality" value={scopeMetrics.quality.toFixed(1)} unit="%">
              <Sparkline data={spark(8)} />
            </KpiCard>
            <KpiCard
              label={MACHINE_OUTPUT_LABEL.toUpperCase()}
              value={goodOutput.toLocaleString()}
              unit="pcs"
            />
            <KpiCard
              label="Biggest loss this week"
              value={loss.label}
              caption={`${loss.minutes} min lost`}
            >
              <Link
                to="/analytics/loss-tree"
                className="text-[11px] font-medium text-primary hover:underline"
              >
                Open loss anatomy →
              </Link>
            </KpiCard>
          </div>

          <div className="grid w-full flex-1 items-stretch gap-3 grid-cols-1 lg:grid-cols-[1.4fr_1fr]">
            <Panel
              title="OEE Trend"
              subtitle={trendSubtitle}
              action={<MetricDropdown selected={selectedMetrics} onChange={setSelectedMetrics} />}
              bodyClassName="relative min-h-[250px] h-full w-full flex-1"
            >
              <TrendChart data={trend} selectedMetrics={selectedMetrics} reference={75} />
            </Panel>

            <Panel
              className="h-full"
              title="OEE Comparison"
              subtitle="Read-only comparison of two periods"
              action={
                <div className="flex flex-wrap items-center gap-1 text-[10px]">
                  <select
                    aria-label="Compare period"
                    className="rounded border border-border bg-surface px-1 py-0.5"
                  >
                    {SPANS.map((s) => (
                      <option key={s.id}>{`Compare: ${s.label}`}</option>
                    ))}
                  </select>
                  <select
                    aria-label="Against period"
                    className="rounded border border-border bg-surface px-1 py-0.5"
                  >
                    {SPANS.map((s) => (
                      <option key={s.id}>{`Against: ${s.label}`}</option>
                    ))}
                  </select>
                </div>
              }
            >
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-2xl font-semibold text-muted-foreground">
                  {cmp.before.toFixed(1)}%
                </span>
                <span className="text-muted-foreground">→</span>
                <span className="font-mono text-2xl font-semibold">{cmp.after.toFixed(1)}%</span>
                <Delta value={cmp.delta} />
              </div>
              <p className="mt-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                By OEE Component
              </p>
              <div className="mt-1.5">
                <DivergingList rows={cmp.components} />
              </div>
              <p className="mt-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                By Line
              </p>
              <div className="mt-1.5 max-h-40 overflow-auto pr-1">
                <DivergingList rows={cmp.byLine} />
              </div>
            </Panel>
          </div>

          <Panel
            className="min-h-[340px] flex-1"
            title="OEE by Line"
            subtitle={sortAsc ? "Lowest → highest" : "Highest → lowest"}
            action={
              <div className="flex flex-wrap items-center gap-2">
                <select
                  aria-label="Select Line"
                  multiple={false}
                  value={selectedLines[0] ?? "all"}
                  onChange={(e) =>
                    setSelectedLines(e.target.value === "all" ? [] : [e.target.value])
                  }
                  className="rounded border border-border bg-surface px-1.5 py-0.5 text-[11px]"
                >
                  <option value="all">Select Line: all</option>
                  {scope.lines.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.id}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setSortAsc((s) => !s)}
                  className="inline-flex items-center gap-1 rounded border border-border px-1.5 py-0.5 text-[11px]"
                >
                  <ArrowDownUp className="size-3" /> Sort
                </button>
              </div>
            }
            bodyClassName="relative min-h-[250px] h-full w-full flex-1"
          >
            {byLine.length === 0 ? <NoDataForFilters /> : <BarByLine data={byLine} />}
          </Panel>
        </main>
      )}
    </div>
  );
}
