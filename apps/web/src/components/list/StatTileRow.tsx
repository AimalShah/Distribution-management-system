import * as React from "react";
import { cn } from "@dms/ui";

export type StatTileTone = "neutral" | "success" | "warning";

export interface StatTile {
  label: string;
  value: React.ReactNode;
  sublabel: React.ReactNode;
  icon: React.ReactNode;
  tone?: StatTileTone;
  sublabelTone?: "muted" | "success";
}

const valueTone: Record<StatTileTone, string> = {
  neutral: "text-foreground",
  success: "text-emerald-700 dark:text-emerald-400",
  warning: "text-amber-700 dark:text-amber-400",
};

const iconTone: Record<StatTileTone, string> = {
  neutral: "bg-muted text-muted-foreground",
  success: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  warning: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
};

/** @deprecated — replaced by inline KPI pattern */
export function StatTileRow({ tiles }: { tiles: StatTile[] }) {
  return (
    <div className="rounded-md border border-border bg-card p-0 divide-y sm:divide-y-0 sm:divide-x divide-border flex flex-col sm:flex-row items-stretch overflow-hidden">
      {tiles.map((tile, index) => (
        <div
          key={index}
          className="flex-1 p-3.5 sm:p-4 flex items-center justify-between min-w-0"
        >
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground truncate">{tile.label}</p>
            <p className={cn("text-2xl font-semibold tabular-nums mt-0.5 tracking-tight", valueTone[tile.tone ?? "neutral"])}>{tile.value}</p>
            <span
              className={cn(
                "text-xs truncate block mt-0.5",
                tile.sublabelTone === "success"
                  ? "text-emerald-700 dark:text-emerald-400 font-medium"
                  : "text-muted-foreground"
              )}
            >
              {tile.sublabel}
            </span>
          </div>
          <div className="text-muted-foreground/60 shrink-0 ml-3 [&_svg]:size-5">
            {tile.icon}
          </div>
        </div>
      ))}
    </div>
  );
}
