import { ReactNode } from "react";
import { Card, CardContent, cn } from "@dms/ui";

export interface StatChipProps {
  label: string;
  value: ReactNode;
  sublabel?: ReactNode;
  icon?: ReactNode;
  accent?: "neutral" | "amber" | "green" | "red" | "blue" | "emerald" | "rose";
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
};

const mapAccent = (accent: StatChipProps["accent"]): keyof typeof accentStyles => {
  if (accent === "green" || accent === "emerald") return "emerald";
  if (accent === "amber") return "amber";
  if (accent === "red" || accent === "rose") return "rose";
  return "blue";
};

export function StatChip({ label, value, sublabel, icon, accent = "neutral" }: StatChipProps) {
  const styleKey = mapAccent(accent);
  const currentStyle = accentStyles[styleKey];

  return (
    <Card className="border-border relative overflow-hidden bg-card transition-shadow hover:shadow-sm py-0 gap-0">
      <div className={cn("absolute top-0 left-0 right-0 h-0.5", currentStyle.indicator)} />
      <CardContent className="p-4 pt-4.5">
        <div className="flex items-start justify-between">
          <div className="min-w-0 pr-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider truncate">
              {label}
            </p>
            <div className="text-xl font-bold text-foreground mt-1 tracking-tight truncate">
              {value}
            </div>
            {sublabel && (
              <p className="text-xs text-muted-foreground mt-0.5 truncate">{sublabel}</p>
            )}
          </div>
          {icon && (
            <div
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg [&_svg]:size-4.5",
                currentStyle.icon
              )}
            >
              {icon}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

