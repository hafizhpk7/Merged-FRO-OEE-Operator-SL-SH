import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";

import { GroupSiteMap, type PlantLineStats } from "@/components/oee/group-site-map";
import { Delta, Donut, MetricBar, PageHeader, Panel } from "@/components/oee/ui";
import { EntityKpiCard } from "@/components/oee/entity-kpi-card";
import { TIER_TEXT, tierOf } from "@/lib/oee/config";
import { PLANTS, PLANT_PHASE_LABELS, type Plant } from "@/lib/oee/data";
import { usePeriod } from "@/lib/oee/period";
import { getMetrics, useLiveTick } from "@/lib/oee/metrics-engine";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/live/")({
  head: () => ({
    meta: [
      { title: "Multi Plant View — Live Monitor" },
      {
        name: "description",
        content:
          "Group level live monitor: interactive open map of Paragon manufacturing facilities with real-time OEE telemetry.",
      },
      { property: "og:title", content: "Multi Plant View — Live Monitor" },
      {
        property: "og:description",
        content: "Group level live monitor with OEE per plant on interactive open map.",
      },
    ],
  }),
  component: MultiPlantView,
});

function getPlantLineStats(p: Plant): PlantLineStats {
  if (!p.isOperational || !p.zones?.length) {
    return {
      total: 0,
      running: 0,
      downOffline: 0,
      down: 0,
      slow: 0,
      idle: 0,
      totalMachines: 0,
      downMachines: 0,
    };
  }
  const allLines = p.zones.flatMap((z) => z.lines);
  const allMachines = allLines.flatMap((l) => l.machines);
  const running = allLines.filter((l) => l.status === "running").length;
  const down = allLines.filter((l) => l.status === "down").length;
  const slow = allLines.filter((l) => l.status === "slow").length;
  const idle = allLines.filter((l) => l.status === "idle").length;
  const downMachines = allMachines.filter((m) => m.status === "down").length;
  return {
    total: allLines.length,
    running,
    downOffline: down + slow + idle,
    down,
    slow,
    idle,
    totalMachines: allMachines.length,
    downMachines,
  };
}

export function MultiPlantView() {
  const { resolved } = usePeriod();
  const tick = useLiveTick();
  const navigate = useNavigate();

  // Metrics from central metrics engine
  const groupMetrics = useMemo(() => {
    void tick;
    return getMetrics("all", "group", "group", resolved);
  }, [resolved, tick]);

  const plantMetrics = useMemo(() => {
    void tick;
    const map: Record<string, ReturnType<typeof getMetrics>> = {};
    for (const p of PLANTS) {
      if (p.isOperational) {
        map[p.id] = getMetrics(p.id, "plant", p.id, resolved);
      }
    }
    return map;
  }, [resolved, tick]);

  const plantStats = useMemo(() => {
    const map: Record<string, PlantLineStats> = {};
    for (const p of PLANTS) {
      map[p.id] = getPlantLineStats(p);
    }
    return map;
  }, []);

  const operationalPlants = useMemo(() => PLANTS.filter((p) => p.isOperational), []);
  const upcomingPlants = useMemo(() => PLANTS.filter((p) => !p.isOperational), []);

  return (
    <div className="flex min-h-screen flex-col bg-background font-sans text-foreground">
      <PageHeader
        title="Multi Plant View"
        crumbs={[{ label: "Kemas", to: "/live" }, { label: "Multi Plant" }]}
      />
      <main className="flex flex-1 flex-col gap-3 p-3 sm:p-4 min-w-0 max-w-full overflow-x-hidden">
        {/* Top Summary & Plant KPI Cards */}
        <div className="flex flex-col 2xl:flex-row items-stretch gap-4 rounded-lg border border-border bg-surface p-3 sm:p-4 transition-colors">
          {/* Group Aggregate Overview: row above cards below 2xl, left block at 2xl+ */}
          <div className="flex flex-wrap sm:flex-nowrap items-center justify-center gap-4 pb-4 2xl:pb-0 2xl:pr-4 border-b 2xl:border-b-0 2xl:border-r border-border/60 2xl:w-[360px] 2xl:shrink-0">
            <div className="flex flex-col items-center shrink-0">
              <Donut value={groupMetrics.oee} size={92} label="Group OEE" />
              <div className="mt-1 flex flex-col items-center text-center">
                <Delta value={groupMetrics.deltaOee} label={resolved.compareLabel} />
              </div>
            </div>
            <div className="grid w-full sm:w-48 gap-1.5 min-w-36">
              <MetricBar label="Availability" value={groupMetrics.availability} />
              <MetricBar label="Performance" value={groupMetrics.performance} />
              <MetricBar label="Quality" value={groupMetrics.quality} />
            </div>
          </div>

          {/* Plant KPI Cards: Operational & Upcoming */}
          <div className="flex flex-1 flex-col gap-3 min-w-0">
            {/* Operational Plants (Jatake 1, Jatake 2, Jatake 4) */}
            <div className="grid w-full gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] min-w-0">
              {operationalPlants.map((p) => {
                const livePlant = plantMetrics[p.id] ?? getMetrics(p.id, "plant", "", resolved);
                return (
                  <EntityKpiCard
                    key={p.id}
                    name={p.name}
                    subtitle={p.block}
                    donutValue={livePlant.oee}
                    donutLabel={p.id}
                    oeeValue={livePlant.oee}
                    deltaValue={livePlant.deltaOee}
                    compareLabel={resolved.compareLabel}
                    availability={livePlant.availability}
                    performance={livePlant.performance}
                    quality={livePlant.quality}
                    dataMetric={`plant-oee-${p.id}`}
                    dataRaw={livePlant.oee}
                    onClick={() => navigate({ to: "/live/$plantId", params: { plantId: p.id } })}
                  />
                );
              })}
            </div>

            {/* Upcoming Plants (Klang, Batang) */}
            <div className="grid w-full gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,360px),1fr))] min-w-0">
              {upcomingPlants.map((p) => (
                <div
                  key={p.id}
                  className="flex flex-col justify-between rounded-lg border border-dashed border-border bg-surface/40 p-3 text-left transition-colors select-none min-w-0"
                >
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-1.5 pb-1">
                      <h4 className="text-xs font-semibold text-foreground/80 leading-snug">
                        {p.name}
                      </h4>
                      <span className="rounded bg-muted/80 px-1.5 py-0.5 font-mono text-[9px] font-medium text-muted-foreground shrink-0">
                        {PLANT_PHASE_LABELS[p.phase]}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground font-sans">{p.region}</p>
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-2 text-xs">
                    <span className="text-[11px] text-muted-foreground font-medium">Plant OEE</span>
                    <span className="font-mono text-xs font-bold text-muted-foreground">—</span>
                  </div>

                  <p className="mt-1 text-[10px] text-muted-foreground/75 italic">
                    Operational data not available
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Group Site Map Card (§2) */}
        <Panel
          className="flex-1 w-full min-w-0"
          title="Group site map"
          subtitle="Interactive map of Paragon manufacturing sites · Drag to pan, scroll to zoom · Click a marker to drill in"
          bodyClassName="relative p-0 overflow-hidden"
        >
          <GroupSiteMap
            plantMetrics={plantMetrics}
            plantStats={plantStats}
            onSelectPlant={(plantId) => {
              navigate({ to: "/live/$plantId", params: { plantId } });
            }}
          />
        </Panel>
      </main>
    </div>
  );
}
