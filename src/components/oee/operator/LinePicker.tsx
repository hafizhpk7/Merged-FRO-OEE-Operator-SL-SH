import { Link } from "@tanstack/react-router";
import { Activity, Factory } from "lucide-react";
import { PLANTS } from "@/lib/oee/data";
import { isOeeActiveLine } from "@/lib/oee/config";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export function LinePicker() {
  const operationalPlants = PLANTS.filter((p) => p.isOperational);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="space-y-1 text-center md:text-left">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Operator Line Selection
        </h1>
        <p className="text-sm text-muted-foreground">
          Select a production line to access the operator dashboard, reject logging, and reason
          tagging interface.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {operationalPlants.map((plant) => (
          <Card key={plant.id} className="border border-border bg-card shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Factory className="size-4" />
                </span>
                <div>
                  <CardTitle className="text-base font-semibold">{plant.name}</CardTitle>
                  <CardDescription className="text-xs">{plant.region}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {plant.zones.map((zone) => (
                <div key={zone.id} className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Zone {zone.id}
                  </span>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {zone.lines.map((line) => {
                      const isActive = isOeeActiveLine(plant.id, line.id);
                      return (
                        <Link
                          key={line.id}
                          to="/operator/$plantId/$lineId"
                          params={{ plantId: plant.id, lineId: line.id }}
                          className="flex flex-col items-start justify-between rounded-md border border-border bg-background p-3 transition-all hover:border-primary hover:bg-accent/50 hover:shadow-xs"
                        >
                          <div className="flex w-full items-center justify-between">
                            <span className="text-xs font-bold text-foreground">{line.id}</span>
                            <span
                              className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                                isActive
                                  ? "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-300"
                                  : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {isActive ? "OEE Live" : "IDW only"}
                            </span>
                          </div>
                          <span className="mt-1 text-[11px] text-muted-foreground truncate w-full">
                            {line.sku}
                          </span>
                          <div className="mt-2 flex items-center gap-1 text-[10px] font-semibold text-primary">
                            <Activity className="size-3" />
                            <span>Select Line</span>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
