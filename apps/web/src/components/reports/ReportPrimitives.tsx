import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, Skeleton, cn } from "@dms/ui";

export function ReportTabsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
      <Skeleton className="h-80 w-full" />
    </div>
  );
}

export interface ReportKpiCard {
  title: string;
  value: ReactNode;
  icon: LucideIcon;
  tileClassName?: string;
  accent?: "blue" | "emerald" | "amber" | "rose" | "purple";
  sublabel?: string;
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

function resolveAccent(card: ReportKpiCard, index: number): keyof typeof accentStyles {
  if (card.accent) return card.accent;
  const cls = card.tileClassName || "";
  if (cls.includes("destructive") || cls.includes("red") || cls.includes("rose")) return "rose";
  if (cls.includes("emerald") || cls.includes("green")) return "emerald";
  if (cls.includes("amber") || cls.includes("yellow")) return "amber";
  if (cls.includes("sky") || cls.includes("blue")) return "blue";
  if (cls.includes("purple") || cls.includes("violet")) return "purple";
  return defaultAccents[index % defaultAccents.length];
}

export function KpiCardGrid({ cards }: { cards: ReportKpiCard[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((c, index) => {
        const Icon = c.icon;
        const accent = resolveAccent(c, index);
        const currentStyle = accentStyles[accent];

        return (
          <Card
            key={c.title}
            className="border-border relative overflow-hidden bg-card transition-shadow hover:shadow-sm py-0 gap-0"
          >
            <div className={cn("absolute top-0 left-0 right-0 h-0.5", currentStyle.indicator)} />
            <CardContent className="p-4 pt-4.5">
              <div className="flex items-start justify-between">
                <div className="min-w-0 pr-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider truncate">
                    {c.title}
                  </p>
                  <div className="text-xl font-bold text-foreground mt-1 tracking-tight truncate">
                    {c.value}
                  </div>
                  {c.sublabel && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{c.sublabel}</p>
                  )}
                </div>
                <div
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg [&_svg]:size-4.5",
                    currentStyle.icon
                  )}
                >
                  <Icon className="size-4.5" />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export interface ReportSectionCardProps {
  title: ReactNode;
  description: ReactNode;
  titleClassName?: string;
  children: ReactNode;
}

export function ReportSectionCard({
  title,
  description,
  titleClassName = "text-base font-semibold",
  children,
}: ReportSectionCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className={titleClassName}>{title}</CardTitle>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent className="pt-2">{children}</CardContent>
    </Card>
  );
}

export interface ReportBreakdownRow {
  key: string | number;
  label: ReactNode;
  sub: ReactNode;
  right: ReactNode;
}

export interface ReportBreakdownListProps {
  title: ReactNode;
  description: ReactNode;
  rows: ReportBreakdownRow[];
  emptyText: string;
}

export function ReportBreakdownList({
  title,
  description,
  rows,
  emptyText,
}: ReportBreakdownListProps) {
  return (
    <ReportSectionCard title={title} description={description}>
      {rows.length > 0 ? (
        <div className="divide-y divide-border">
          {rows.map((row) => (
            <div
              key={row.key}
              className="py-3 flex items-center justify-between text-sm"
            >
              <div>
                <p className="font-medium text-foreground">{row.label}</p>
                <p className="text-xs text-muted-foreground">{row.sub}</p>
              </div>
              <span className="font-semibold text-foreground">{row.right}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
          {emptyText}
        </div>
      )}
    </ReportSectionCard>
  );
}
