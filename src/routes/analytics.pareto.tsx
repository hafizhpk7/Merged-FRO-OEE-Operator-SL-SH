import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { z } from "zod";
import { fallback, zodValidator } from "@tanstack/zod-adapter";

import { MeasureToggle, ParetoChart, type Measure } from "@/components/oee/charts";
import { FilterBar } from "@/components/oee/filter-bar";
import {
  EmptyState,
  KpiStrip,
  NoDataForFilters,
  PageHeader,
  Panel,
  type KpiItem,
} from "@/components/oee/ui";
import { useApp } from "@/lib/oee/app-context";
import { getEngineLossTree } from "@/lib/oee/lossTreeEngine";
import { usePeriod } from "@/lib/oee/period";
import { findNode, getLossNodeStats, getScopePpm, type LossNode } from "@/lib/oee/data";
import { useScope } from "@/lib/oee/scope";
import type { EntityType } from "@/lib/oee/metrics-engine";

const searchSchema = z.object({
  category: fallback(z.string(), "").default(""),
  measure: fallback(z.string(), "minutes").default("minutes"),
});

export const Route = createFileRoute("/analytics/pareto")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({
    meta: [
      { title: "Root Cause Pareto Chart — OEE Analytics" },
      {
        name: "description",
        content:
          "Pareto drill-down across every loss category: parent issues, child issues level 1 and level 2, plus rank by machines.",
      },
      { property: "og:title", content: "Root Cause Pareto Chart" },
      {
        property: "og:description",
        content: "Parent issues → child issues level 1 → level 2 pareto drill-down.",
      },
    ],
  }),
  component: ParetoPage,
});

function ParetoPage() {
  const { role, filters } = useApp();
  const scope = useScope();
  const { resolved } = usePeriod();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [measure, setMeasure] = useState<Measure>(
    search.measure === "occurrences" ? "occurrences" : "minutes",
  );

  const level: EntityType =
    filters.lineIds.length === 1 ? "line" : filters.zoneIds.length === 1 ? "zone" : "plant";
  const entityId =
    filters.lineIds.length === 1
      ? (filters.lineIds[0] ?? "")
      : filters.zoneIds.length === 1
        ? (filters.zoneIds[0] ?? "")
        : scope.plantId;

  const tree = useMemo(
    () =>
      getEngineLossTree(
        scope.plantId,
        level,
        entityId,
        resolved,
      ) as unknown as LossNode[],
    [scope.plantId, level, entityId, resolved],
  );
  const initialParent = tree.find((n) => n.label === search.category)?.id ?? "";
  const [parentId, setParentId] = useState<string>(initialParent);
  const [childId, setChildId] = useState<string>("");
  const [child2Id, setChild2Id] = useState<string>("");

  const dashboard = role === "section-head" ? "Section Head Dashboard" : "Shift Leader Dashboard";
  const val = (n: LossNode) => (measure === "minutes" ? n.minutes : n.occurrences);
  const toRow = (n: LossNode) => ({ id: n.id, label: n.label, value: val(n) });

  const activeParent = parentId ? findNode(tree, parentId) : undefined;
  const activeChild = activeParent && childId ? findNode(tree, childId) : undefined;
  const activeChild2 = activeChild && child2Id ? findNode(tree, child2Id) : undefined;

  const deepestNode = activeChild2 ?? activeChild ?? activeParent;
  const rankNode = deepestNode;

  // Selected issue title for card header (e.g. "Breakdown › Bearing seizure analysis · BOP21, BOP22, BOP23")
  const selectedIssueTitle = useMemo(() => {
    if (activeChild2 && activeChild && activeParent) {
      return `${activeParent.label} › ${activeChild.label} › ${activeChild2.label}`;
    }
    if (activeChild && activeParent) {
      return `${activeParent.label} › ${activeChild.label}`;
    }
    if (activeParent) {
      return activeParent.label;
    }
    return "All loss categories";
  }, [activeParent, activeChild, activeChild2]);

  // Scope label text (<= 3 lines list names, otherwise "{n} lines")
  const scopeText = useMemo(() => {
    if (scope.lines.length <= 3) {
      return scope.lines.map((l) => l.id).join(", ");
    }
    return `${scope.lines.length} lines`;
  }, [scope.lines]);

  // Calculate Node Stats & PPM
  const nodeKey = deepestNode?.id ?? "all";
  const stats = useMemo(
    () => getLossNodeStats(scope.seed, nodeKey, tree),
    [scope.seed, nodeKey, tree],
  );
  const ppm = useMemo(() => getScopePpm(scope.lines), [scope.lines]);

  const cell1Label = deepestNode ? `${deepestNode.label} events` : "Loss events";
  const kind = stats.kind;

  const avgValueText = useMemo(() => {
    if (stats.events <= 0) return "—";
    const rawAvg = stats.minutes / stats.events;
    if (rawAvg >= 10) {
      return Math.round(rawAvg).toLocaleString();
    }
    return (Math.round(rawAvg * 10) / 10).toFixed(1);
  }, [stats.minutes, stats.events]);

  const paretoKpiItems: KpiItem[] = useMemo(() => {
    const totalLostPcs = stats.minutes * ppm;

    const items: KpiItem[] = [
      {
        id: "events",
        label: cell1Label,
        value: stats.events > 0 ? stats.events.toLocaleString() : "—",
      },
      {
        id: "total-lost",
        label: "Total lost",
        value: stats.minutes > 0 ? stats.minutes.toLocaleString() : "0",
        unit: "min",
      },
      {
        id: "longest",
        label: kind === "stop" ? "Longest stop" : "Longest event",
        value: stats.longest > 0 ? stats.longest.toLocaleString() : "—",
        ...(stats.longest > 0 ? { unit: "min" } : {}),
      },
      {
        id: "avg",
        label: kind === "stop" ? "Avg stop" : "Avg event",
        value: avgValueText,
        ...(stats.events > 0 ? { unit: "min" } : {}),
      },
      {
        id: "estimated-output",
        label: "Estimated lost output",
        value: totalLostPcs.toLocaleString(),
        unit: "pcs",
        subText: `${stats.minutes.toLocaleString()} min x ${ppm} ppm`,
        emphasized: true,
      },
    ];
    return items;
  }, [cell1Label, stats, ppm, avgValueText, kind]);

  return (
    <div className="flex min-h-screen flex-col bg-background font-sans text-foreground">
      <PageHeader
        title="Root Cause Pareto Chart"
        crumbs={[
          { label: dashboard, to: "/analytics" },
          { label: "Loss Tree", to: "/analytics/loss-tree" },
          { label: "Root Cause Pareto Chart" },
        ]}
        back={{ label: "Loss Tree", to: "/analytics/loss-tree" }}
        meta={`Week 32 · ${scope.spanLabel}`}
      />
      <FilterBar />
      {!scope.hasData ? (
        <main className="flex-1 p-4">
          <NoDataForFilters />
        </main>
      ) : (
        <main className="flex flex-1 flex-col gap-3 p-3 sm:p-4 min-w-0 max-w-full overflow-x-hidden">
          {/* Analysis Card with Header & 5-Cell KPI Strip */}
          <Panel
            title={`${selectedIssueTitle} analysis · ${scopeText}`}
            action={
              <span className="text-xs text-muted-foreground font-medium">{scope.spanLabel}</span>
            }
            bodyClassName="p-0"
          >
            <KpiStrip
              ariaLabel="Loss analysis KPIs"
              columnsDesktop={5}
              items={paretoKpiItems}
              className="border-0 shadow-none rounded-none rounded-b-lg"
            />
          </Panel>

          <Panel
            className="min-h-[340px] flex-1 w-full min-w-0"
            title="Parent Issues"
            subtitle="All loss categories at once · click a bar to drill down"
            action={
              <MeasureToggle
                value={measure}
                onChange={(m) => {
                  setMeasure(m);
                  navigate({ to: "/analytics/pareto", search: { ...search, measure: m } });
                }}
              />
            }
          >
            <ParetoChart
              data={[...tree].sort((a, b) => val(b) - val(a)).map(toRow)}
              selected={parentId}
              onSelect={(id) => {
                setParentId(id);
                setChildId("");
                setChild2Id("");
              }}
            />
          </Panel>

          <div className="grid w-full flex-1 items-stretch gap-3 grid-cols-1 lg:grid-cols-2">
            <Panel
              title="Child Issues Level 1"
              subtitle={activeParent ? `Scoped to ${activeParent.label}` : undefined}
            >
              {activeParent?.children?.length ? (
                <ParetoChart
                  data={[...activeParent.children].sort((a, b) => val(b) - val(a)).map(toRow)}
                  selected={childId}
                  onSelect={(id) => {
                    setChildId(id);
                    setChild2Id("");
                  }}
                />
              ) : (
                <EmptyState message="Silahkan Pilih Child Issues Level 1" />
              )}
            </Panel>

            <Panel
              title="Child Issues Level 2"
              subtitle={activeChild ? `Scoped to ${activeChild.label}` : undefined}
            >
              {activeChild?.children?.length ? (
                <ParetoChart
                  data={[...activeChild.children].sort((a, b) => val(b) - val(a)).map(toRow)}
                  selected={child2Id}
                  onSelect={(id) => setChild2Id(id)}
                />
              ) : (
                <EmptyState message="Silahkan Pilih Child Issues Level 2" />
              )}
            </Panel>
          </div>

          <Panel
            title="Rank by Machines"
            subtitle={
              rankNode
                ? `${rankNode.label} · ${measure === "minutes" ? "minutes" : "occurrences"}`
                : "Select an issue above"
            }
          >
            {rankNode ? (
              <ul className="space-y-1.5">
                {rankNode.machines.map((m) => {
                  const max = Math.max(
                    ...rankNode.machines.map((x) =>
                      measure === "minutes" ? x.minutes : x.occurrences,
                    ),
                    1,
                  );
                  const v = measure === "minutes" ? m.minutes : m.occurrences;
                  return (
                    <li key={m.id} className="flex items-center gap-2">
                      <span className="w-20 shrink-0 font-mono text-[11px]">{m.id}</span>
                      <div className="h-2.5 flex-1 overflow-hidden rounded bg-grid/40">
                        <div
                          className="h-full rounded bg-primary"
                          style={{ width: `${(v / max) * 100}%` }}
                        />
                      </div>
                      <span className="w-16 shrink-0 text-right font-mono text-[11px]">
                        {measure === "minutes" ? `${v} min` : `${v}×`}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState message="Silahkan Pilih Parent Issue" />
            )}
          </Panel>
        </main>
      )}
    </div>
  );
}
