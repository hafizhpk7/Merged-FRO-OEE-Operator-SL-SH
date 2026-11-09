import { createFileRoute } from "@tanstack/react-router";
import { LinePicker } from "@/components/oee/operator/LinePicker";
import { OperatorMiniSidebar } from "@/components/oee/operator/OperatorMiniSidebar";

export const Route = createFileRoute("/operator/")({
  component: OperatorIndexPage,
});

function OperatorIndexPage() {
  return (
    <div className="flex min-h-screen min-w-0 flex-1 flex-col bg-background pl-16">
      <OperatorMiniSidebar />
      <LinePicker />
    </div>
  );
}
