import { useMemo } from "react";

import { useApp } from "./app-context";
import { DEFAULT_ZONE_ID, allLines, allSkus, getPlant, type Line } from "./data";
import { SPANS } from "./filters";

/**
 * Resolves the active filter combination into the mock rows a page should show.
 * Implements the cascading + empty-state rules from §5.
 */
export function useScope() {
  const { role, filters } = useApp();
  const plantId = role === "section-head" ? filters.plantId : "J2";
  const plant = getPlant(plantId);

  return useMemo(() => {
    const zoneIds = filters.zoneIds.length
      ? filters.zoneIds
      : role === "shift-leader"
        ? [DEFAULT_ZONE_ID]
        : [];
    const zoneScoped = allLines(plantId, zoneIds);
    const byLine = filters.lineIds.length
      ? zoneScoped.filter((l) => filters.lineIds.includes(l.id))
      : zoneScoped;
    const lines: Line[] =
      filters.sku === "all" ? byLine : byLine.filter((l) => l.sku === filters.sku);

    const spanLabel = SPANS.find((s) => s.id === filters.span)?.label ?? "";
    const seed = [
      plantId,
      zoneIds.join("+"),
      filters.lineIds.join("+"),
      filters.sku,
      filters.span,
    ].join("|");

    return {
      plant,
      plantId,
      zoneIds,
      zoneOptions: plant?.zones ?? [],
      lineOptions: zoneScoped,
      skuOptions: allSkus(zoneScoped),
      lines,
      hasData: lines.length > 0,
      seed,
      spanLabel,
      scopeLabel: [
        filters.lineIds.length === 1 ? filters.lineIds[0] : `${lines.length} lines`,
        spanLabel,
        filters.sku === "all" ? "All SKU" : filters.sku,
      ].join(" · "),
    };
  }, [plant, plantId, role, filters]);
}
