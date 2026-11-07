import { createFileRoute } from "@tanstack/react-router";
import { MultiPlantView } from "./live.index";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Paragon OEE FRO Dashboard — Live Monitor" },
      {
        name: "description",
        content:
          "Paragon OEE FRO dashboard prototype: Group level live monitor with interactive open map and real-time OEE telemetry.",
      },
      { property: "og:title", content: "Paragon OEE FRO Dashboard — Live Monitor" },
      {
        property: "og:description",
        content: "Live monitor drill-down and OEE analytics prototype for Paragon Manufacturing.",
      },
    ],
  }),
  component: MultiPlantView,
});
