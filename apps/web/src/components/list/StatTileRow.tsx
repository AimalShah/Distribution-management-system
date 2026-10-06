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

export function StatTileRow({ tiles }: { tiles: StatTile[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {tiles.map((tile, index) => (
        <div
          key={index}
          className={cn(
            "card p-4 flex items-center justify-between",
            index === 2 && tiles.length === 3 && "sm:col-span-2 lg:col-span-1"
          )}
        >
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{tile.label}</p>
            <p className={cn("text-2xl font-bold mt-1", valueTone[tile.tone ?? "neutral"])}>{tile.value}</p>
            <span
              className={cn(
                "text-xs",
                tile.sublabelTone === "success"
                  ? "text-emerald-700 dark:text-emerald-400 font-medium"
                  : "text-muted-foreground"
              )}
            >
              {tile.sublabel}
            </span>
          </div>
          <div className={cn("w-12 h-12 rounded-lg flex items-center justify-center", iconTone[tile.tone ?? "neutral"])}>
            {tile.icon}
          </div>
        </div>
      ))}
    </div>
  );
}
