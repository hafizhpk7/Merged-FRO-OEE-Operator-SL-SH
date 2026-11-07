import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { LossTree, MeasureToggle, Waterfall, type Measure } from "@/components/oee/charts";
import { FilterBar } from "@/components/oee/filter-bar";
import { KpiStrip, NoDataForFilters, PageHeader, Panel, type KpiItem } from "@/components/oee/ui";
import { useApp } from "@/lib/oee/app-context";
import { getCompareLabel, getPriorPeriodKpis } from "@/lib/oee/data";
import { getEngineWaterfall, getEngineLossTree } from "@/lib/oee/lossTreeEngine";
import { getMetrics, type EntityType } from "@/lib/oee/metrics-engine";
import { usePeriod } from "@/lib/oee/period";
import { useScope } from "@/lib/oee/scope";

export const Route = createFileRoute("/analytics/loss-tree")({
  head: () => ({
    meta: [
      { title: "Loss Tree & OEE Waterfall — Loss Anatomy" },
      {
        name: "description",
        content:
          "OEE waterfall from calendar time to effective time next to a multi-level loss tree, switchable by minutes or occurrences.",
      },
      { property: "og:title", content: "Loss Tree & OEE Waterfall" },
      {
        property: "og:description",
        content: "Waterfall plus multi-level loss tree, by minutes or by occurrences.",
      },
    ],
  }),
  component: LossTreePage,
});

function LossTreePage() {
  const { role, filters } = useApp();
  const scope = useScope();
  const { resolved } = usePeriod();
  const navigate = useNavigate();
  const [measure, setMeasure] = useState<Measure>("minutes");

  const level: EntityType =
    filters.lineIds.length === 1 ? "line" : filters.zoneIds.length === 1 ? "zone" : "plant";
  const entityId =
    filters.lineIds.length === 1
      ? (filters.lineIds[0] ?? "")
      : filters.zoneIds.length === 1
        ? (filters.zoneIds[0] ?? "")
        : scope.plantId;

  const dashboard = role === "section-head" ? "Section Head Dashboard" : "Shift Leader Dashboard";
  const wf = useMemo(
    () => getEngineWaterfall(scope.plantId, level, entityId, resolved),
    [scope.plantId, level, entityId, resolved],
  );
  const tree = useMemo(
    () => getEngineLossTree(scope.plantId, level, entityId, resolved),
    [scope.plantId, level, entityId, resolved],
  );

  const compareLabel = getCompareLabel(filters.span);

  const kpiItems: KpiItem[] = useMemo(() => {
    const scheduled = wf.milestones.find((m) => m.label === "Scheduled Time")?.value ?? 0;
    const gross = wf.milestones.find((m) => m.label === "Gross Operating Time")?.value ?? 0;
    const net = wf.milestones.find((m) => m.label === "Net Operating Time")?.value ?? 0;
    const effective = wf.milestones.find((m) => m.label === "Effective Time")?.value ?? 0;
    const totalLoss = wf.losses.reduce((sum, item) => sum + item.value, 0);

    if (scheduled <= 0) {
      return [
        { id: "oee", label: "OEE", value: "—" },
        { id: "availability", label: "Availability", value: "—" },
        { id: "performance", label: "Performance", value: "—" },
        { id: "quality", label: "Quality", value: "—" },
        { id: "total-loss", label: "Total loss", value: "—" },
        { id: "effective-time", label: "Effective time", value: "—" },
      ];
    }

    const availPct = (gross / scheduled) * 100;
    const perfPct = gross > 0 ? (net / gross) * 100 : 0;
    const qualPct = net > 0 ? (effective / net) * 100 : 0;
    const oeePct = (effective / scheduled) * 100;

    const prior = getPriorPeriodKpis(scope.seed);

    // Formatted current percentages
    const currOeeFmt = Math.round(oeePct * 10) / 10;
    const prevOeeFmt = Math.round(prior.oeePct * 10) / 10;

    const currAvailFmt = Math.round(availPct * 10) / 10;
    const prevAvailFmt = Math.round(prior.availabilityPct * 10) / 10;

    const currPerfFmt = Math.round(perfPct * 10) / 10;
    const prevPerfFmt = Math.round(prior.performancePct * 10) / 10;

    const currQualFmt = Math.round(qualPct * 10) / 10;
    const prevQualFmt = Math.round(prior.qualityPct * 10) / 10;

    return [
      {
        id: "oee",
        label: "OEE",
        value: `${currOeeFmt.toFixed(1)}%`,
        trend: currOeeFmt >= prevOeeFmt ? "up" : "down",
        comparisonText: `${compareLabel} ${prevOeeFmt.toFixed(1)}%`,
      },
      {
        id: "availability",
        label: "Availability",
        value: `${currAvailFmt.toFixed(1)}%`,
        trend: currAvailFmt >= prevAvailFmt ? "up" : "down",
        comparisonText: `${compareLabel} ${prevAvailFmt.toFixed(1)}%`,
      },
      {
        id: "performance",
        label: "Performance",
        value: `${currPerfFmt.toFixed(1)}%`,
        trend: currPerfFmt >= prevPerfFmt ? "up" : "down",
        comparisonText: `${compareLabel} ${prevPerfFmt.toFixed(1)}%`,
      },
      {
        id: "quality",
        label: "Quality",
        value: `${currQualFmt.toFixed(1)}%`,
        trend: currQualFmt >= prevQualFmt ? "up" : "down",
        comparisonText: `${compareLabel} ${prevQualFmt.toFixed(1)}%`,
      },
      {
        id: "total-loss",
        label: "Total loss",
        value: totalLoss.toLocaleString(),
        unit: "min",
        comparisonText: `${compareLabel} ${prior.totalLossMinutes.toLocaleString()} min`,
      },
      {
        id: "effective-time",
        label: "Effective time",
        value: effective.toLocaleString(),
        unit: "min",
        subText: `${currOeeFmt.toFixed(1)}% of scheduled time`,
      },
    ];
  }, [wf, scope.seed, compareLabel]);

  return (
    <div className="flex min-h-screen flex-col bg-background font-sans text-foreground">
      <PageHeader
        title="Loss Anatomy"
        crumbs={[{ label: dashboard, to: "/analytics" }, { label: "Loss Tree" }]}
        back={{ label: dashboard, to: "/analytics" }}
        meta={`Week 32 · ${scope.spanLabel}`}
      />
      <FilterBar />
      {!scope.hasData ? (
        <main className="flex-1 p-4">
          <NoDataForFilters />
        </main>
      ) : (
        <main className="flex flex-1 flex-col gap-3 p-3 sm:p-4 min-w-0 max-w-full overflow-x-hidden">
          {/* KPI Card Strip directly below FilterBar and above OEE Waterfall + Loss Tree */}
          <KpiStrip ariaLabel="Loss anatomy KPIs" columnsDesktop={6} items={kpiItems} />

          <div className="grid w-full flex-1 items-stretch gap-3 grid-cols-1 lg:grid-cols-2">
            <Panel
              title="OEE Waterfall"
              subtitle={scope.scopeLabel}
              className="w-full min-w-0 overflow-hidden"
              bodyClassName="min-h-0 p-0 w-full min-w-0 overflow-x-auto"
            >
              <div className="w-full min-w-[460px] sm:min-w-0">
                <Waterfall milestones={wf.milestones} losses={wf.losses} />
              </div>
            </Panel>

            <Panel
              title="Loss Tree"
              action={<MeasureToggle value={measure} onChange={setMeasure} />}
              className="w-full min-w-0 overflow-hidden"
              bodyClassName="min-h-0 overflow-auto p-3"
            >
              <LossTree
                nodes={tree}
                measure={measure}
                onOpen={(node) =>
                  navigate({
                    to: "/analytics/pareto",
                    search: { category: node.label, measure },
                  })
                }
              />
            </Panel>
          </div>
        </main>
      )}
    </div>
  );
}
