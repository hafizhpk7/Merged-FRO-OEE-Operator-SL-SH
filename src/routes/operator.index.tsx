import { createFileRoute } from "@tanstack/react-router";
import { LinePicker } from "@/components/oee/operator/LinePicker";
import { OperatorFrame } from "@/components/oee/operator/OperatorFrame";

export const Route = createFileRoute("/operator/")({
  component: OperatorIndexPage,
});

function OperatorIndexPage() {
  return (
    <OperatorFrame>
      <LinePicker />
    </OperatorFrame>
  );
}
