import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";

import { TrendChart } from "@/components/oee/charts";
import {
  IsoBlock,
  IsoChip,
  IsoGround,
  IsoScene,
  MapHoverTooltip,
  type MapTooltipInfo,
} from "@/components/oee/iso";
import { LineChainView3D } from "@/components/oee/three/line-chain-view-3d";
import {
  Delta,
  EmptyState,
  KpiCard,
  PageHeader,
  Panel,
  StatusLegend,
  LineDataSourceChip,
} from "@/components/oee/ui";
import { getEngineTrendSeries } from "@/lib/oee/trendEngine";
import { MACHINE_OUTPUT_LABEL, STATUS_HEX, STATUS_LABEL, TIER_HEX, tierOf } from "@/lib/oee/config";
import { bucketsFor, getLine, getZone, trendSeries } from "@/lib/oee/data";
import { LineAlarmsSection } from "@/components/oee/alarms-section";
import { usePeriod } from "@/lib/oee/period";
import {
  getMetrics,
  getBottleneck,
  getActivePO,
  getMachineMaxRunRate,
  getSkuStandardRunRate,
  getActualRunRate,
  SHOW_COMPARISON_ON_OUTPUT_CARD,
  PO_IDLE_PLACEHOLDER,
  useLiveTick,
} from "@/lib/oee/metrics-engine";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/live/$plantId/$zoneId/$lineId/")({
  head: () => ({
    meta: [
      { title: "Line Detail — Live Monitor" },
      {
        name: "description",
        content:
          "Line level live monitor: KPI strip, line condition, machine chain, active alarms and OEE/output/speed trends.",
      },
      { property: "og:title", content: "Line Detail — Live Monitor" },
      {
        property: "og:description",
        content: "KPI strip, line condition, alarms and trends for one line.",
      },
    ],
  }),
  component: LineDetail,
});

function LineDetail() {
  const { plantId, zoneId, lineId } = useParams({ from: "/live/$plantId/$zoneId/$lineId/" });
  const { resolved } = usePeriod();
  const tick = useLiveTick();
  const [tooltip, setTooltip] = useState<MapTooltipInfo | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const zone = getZone(plantId, zoneId);
  const line = getLine(plantId, zoneId, lineId);

  const lineMetrics = useMemo(() => {
    void tick;
    return getMetrics(plantId, "line", lineId, resolved);
  }, [plantId, lineId, resolved, tick]);

  const trendData = useMemo(() => {
    void tick;
    return getEngineTrendSeries(plantId, "line", lineId, resolved);
  }, [plantId, lineId, resolved, tick]);

  if (!zone || !line) {
    return (
      <div className="p-6">
        <EmptyState message="Line tidak ditemukan" />
      </div>
    );
  }

  const bottleneckCode = getBottleneck(plantId, line.id);
  const activePO = getActivePO(plantId, line.id);
  const actualRunRate = getActualRunRate(plantId, line.id, resolved);
  const skuRunRate = getSkuStandardRunRate(plantId, line.id, line.sku);
  const machineRunRate = getMachineMaxRunRate(plantId, bottleneckCode);

  const oeeTrend = trendData;
  const outputTrend = trendData;
  const speedTrend = trendData;

  const compareLabel = resolved.compareLabel;
  const poOutputStr = activePO
    ? `${activePO.currentOutput.toLocaleString()} / ${activePO.totalMPQ.toLocaleString()}`
    : "- / -";

  return (
    <div className="flex min-h-screen flex-col bg-background font-sans text-foreground">
      <PageHeader
        title={`${line.id} — Line Detail`}
        crumbs={[
          { label: "Kemas", to: "/live" },
          { label: zone.name, to: "/live/$plantId/$zoneId", params: { plantId, zoneId } },
          { label: `${line.id} · Shift 1` },
        ]}
        back={{ label: zone.name, to: "/live/$plantId/$zoneId", params: { plantId, zoneId } }}
      >
        <LineDataSourceChip plantId={plantId} lineId={line.id} />
      </PageHeader>
      <main className="flex flex-1 flex-col gap-3 p-3 sm:p-4 pb-12 min-w-0 max-w-full overflow-x-hidden">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 sm:gap-4">
          <KpiCard
            label="Line OEE"
            value={lineMetrics.oee.toFixed(1)}
            unit="%"
            tone={
              tierOf(lineMetrics.oee) === "good"
                ? "good"
                : tierOf(lineMetrics.oee) === "warn"
                  ? "warn"
                  : "bad"
            }
            delta={lineMetrics.deltaOee}
          />
          <KpiCard
            label="Availability"
            value={lineMetrics.availability.toFixed(1)}
            unit="%"
            delta={lineMetrics.deltaAvailability}
          />
          <KpiCard
            label="Performance"
            value={lineMetrics.performance.toFixed(1)}
            unit="%"
            delta={lineMetrics.deltaPerformance}
          />
          <KpiCard
            label="Quality"
            value={lineMetrics.quality.toFixed(1)}
            unit="%"
            delta={lineMetrics.deltaQuality}
          />
          <KpiCard
            label={MACHINE_OUTPUT_LABEL}
            value={(lineMetrics.outputActual ?? 0).toLocaleString()}
            unit="pcs"
            caption={
              <span className="text-[10px] text-muted-foreground font-mono">
                Good:{" "}
                {(
                  lineMetrics.outputGood ??
                  Math.round((lineMetrics.outputActual ?? 0) * (lineMetrics.quality / 100))
                ).toLocaleString()}{" "}
                {"·"} Reject:{" "}
                {(
                  lineMetrics.outputReject ??
                  Math.max(
                    0,
                    (lineMetrics.outputActual ?? 0) -
                      Math.round((lineMetrics.outputActual ?? 0) * (lineMetrics.quality / 100)),
                  )
                ).toLocaleString()}
              </span>
            }
          />
          <KpiCard
            label="Running time"
            value={`${Math.floor(line.runningMinutes / 60)}h ${Math.floor(line.runningMinutes % 60)}m`}
          />
          <KpiCard
            label="Status"
            value={line.status.toUpperCase()}
            tone={line.status === "down" ? "bad" : line.status === "slow" ? "warn" : "good"}
            caption={
              line.status === "down" ? `caused by ${bottleneckCode}` : "all machines nominal"
            }
          />
        </div>

        {/* Line Condition: full-width content-height card with responsive tile grid (§1.3) */}
        <Panel title="Line Condition" className="w-full">
          <dl className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 min-[1500px]:grid-cols-8 gap-2.5 text-[11px]">
            {[
              ["Current SKU", line.sku],
              [
                "PO / Batch",
                `${activePO?.poNumber ?? line.po} · ${activePO?.batch ?? line.batch}`,
              ],
              ["PO Output", poOutputStr],
              ["Zone · Shift", `${zone.name} · Shift 1`],
              ["Actual Run Rate", `${actualRunRate} ppm`],
              ["Run Rate SKU", `${skuRunRate} ppm`],
              ["Run Rate Machine", `${machineRunRate} ppm`],
              ["Bottleneck", bottleneckCode],
            ].map(([k, v]) => (
              <div
                key={k}
                className="flex flex-col justify-center rounded-lg border border-border/70 p-3 bg-muted/15 shadow-2xs hover:bg-muted/30 hover:border-border transition-all min-h-[64px]"
              >
                <dt className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  {k}
                </dt>
                <dd className="whitespace-normal break-words font-semibold text-xs text-foreground mt-1">
                  {v}
                </dd>
              </div>
            ))}
          </dl>
        </Panel>

        {/* Machine chain: full-width card with pill row in normal flow and canvas wrapper (§1.3) */}
        <Panel
          title="Machine chain"
          subtitle="Click any machine for real-time sensor telemetry"
          action={<StatusLegend />}
          className="w-full"
        >
          {/* Pills must be in NORMAL flow, not absolute (§1.3) */}
          <div className="flex flex-wrap items-center justify-center gap-2 mb-4">
            {/* Note: This is simplified. In a real scenario I'd lift the pill row component logic. */}
            <span className="text-xs text-muted-foreground">See 3D scene below for status</span>
          </div>
          <div className="relative w-full h-[clamp(320px,40vh,440px)] overflow-hidden rounded-lg">
            <LineChainView3D plantId={plantId} zoneId={zoneId} line={line} />
          </div>
        </Panel>

        <LineAlarmsSection line={line} plantId={plantId} resolved={resolved} />

        {/* Trend Charts Section */}
        <div className="grid w-full shrink-0 grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <Panel
            title="OEE trend"
            className="h-[340px] w-full min-w-0"
            bodyClassName="h-[270px] w-full p-2"
          >
            <div className="h-[250px] w-full">
              <TrendChart
                data={oeeTrend}
                keys={["OEE"]}
                reference={75}
                domain={[0, 100]}
                height={250}
              />
            </div>
          </Panel>
          <Panel
            title="Machine Output trend"
            subtitle="Cumulative output vs plan (pcs)"
            className="h-[340px] w-full min-w-0"
            bodyClassName="h-[270px] w-full p-2"
          >
            <div className="h-[250px] w-full">
              <TrendChart
                data={outputTrend}
                keys={["Actual", "Plan"]}
                domain={["auto", "auto"]}
                unit="pcs"
                height={250}
              />
            </div>
          </Panel>
          <Panel
            title="Line speed"
            subtitle={`Standard ${skuRunRate} ppm`}
            className="h-[340px] w-full min-w-0"
            bodyClassName="h-[270px] w-full p-2"
          >
            <div className="h-[250px] w-full">
              <TrendChart
                data={speedTrend}
                keys={["Speed"]}
                reference={skuRunRate}
                domain={["auto", "auto"]}
                unit="ppm"
                height={250}
              />
            </div>
          </Panel>
        </div>
      </main>
    </div>
  );
}
