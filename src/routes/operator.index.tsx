import { createFileRoute } from "@tanstack/react-router";
import { LinePicker } from "@/components/oee/operator/LinePicker";
import { OperatorMiniSidebar } from "@/components/oee/operator/OperatorMiniSidebar";

export const Route = createFileRoute("/operator/")({
  component: OperatorIndexPage,
});

function OperatorIndexPage() {
  return (
    <div className="min-h-screen bg-background py-8 pl-16">
      <OperatorMiniSidebar />
      <LinePicker />
    </div>
  );
}
