import * as React from "react";
import { Card, CardContent, cn } from "@dms/ui";

export type StatTileTone = "neutral" | "success" | "warning" | "destructive" | "info" | "purple";

export interface StatTile {
  label: string;
  value: React.ReactNode;
  sublabel?: React.ReactNode;
  icon: React.ReactNode;
  tone?: StatTileTone;
  sublabelTone?: "muted" | "success";
}

const accentStyles = {
  emerald: {
    icon: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20",
    indicator: "bg-emerald-500",
  },
  blue: {
    icon: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20",
    indicator: "bg-sky-500",
  },
  amber: {
    icon: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20",
    indicator: "bg-amber-500",
  },
  rose: {
    icon: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20",
    indicator: "bg-rose-500",
  },
  purple: {
    icon: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20",
    indicator: "bg-purple-500",
  },
};

const defaultAccents: Array<keyof typeof accentStyles> = ["blue", "emerald", "amber", "rose"];

export function StatTileRow({ tiles }: { tiles: StatTile[] }) {
  return (
    <div
      className={cn(
        "grid gap-3",
        tiles.length === 1 && "grid-cols-1",
        tiles.length === 2 && "grid-cols-1 sm:grid-cols-2",
        tiles.length === 3 && "grid-cols-1 sm:grid-cols-3",
        tiles.length >= 4 && "grid-cols-2 lg:grid-cols-4"
      )}
    >
      {tiles.map((tile, index) => {
        let accent: keyof typeof accentStyles = defaultAccents[index % defaultAccents.length];

        if (tile.tone === "success") accent = "emerald";
        else if (tile.tone === "warning") accent = "amber";
        else if (tile.tone === "destructive") accent = "rose";
        else if (tile.tone === "purple") accent = "purple";
        else if (tile.tone === "info") accent = "blue";

        const currentStyle = accentStyles[accent];

        return (
          <Card
            key={index}
            className="border-border relative overflow-hidden bg-card transition-shadow hover:shadow-sm py-0 gap-0"
          >
            <div className={cn("absolute top-0 left-0 right-0 h-0.5", currentStyle.indicator)} />
            <CardContent className="p-4 pt-4.5">
              <div className="flex items-start justify-between">
                <div className="min-w-0 pr-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider truncate">
                    {tile.label}
                  </p>
                  <div className="text-xl font-bold text-foreground mt-1 tracking-tight truncate">
                    {tile.value}
                  </div>
                  {tile.sublabel && (
                    <p
                      className={cn(
                        "text-xs truncate mt-0.5",
                        tile.sublabelTone === "success"
                          ? "text-emerald-600 dark:text-emerald-400 font-medium"
                          : "text-muted-foreground"
                      )}
                    >
                      {tile.sublabel}
                    </p>
                  )}
                </div>
                <div
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg [&_svg]:size-4.5",
                    currentStyle.icon
                  )}
                >
                  {tile.icon}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

