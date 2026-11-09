import { createFileRoute } from "@tanstack/react-router";
import { RejectConfigMaster } from "@/components/oee/RejectConfigMaster";

// Master Data: reject slot configuration. Registered in src/routeTree.gen.ts.
export const Route = createFileRoute("/master/reject-config")({
  component: RejectConfigMaster,
});
