import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, Skeleton } from "@dms/ui";

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
  tileClassName: string;
}

export function KpiCardGrid({ cards }: { cards: ReportKpiCard[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <Card key={c.title}>
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">{c.title}</p>
                <p className="text-2xl font-bold mt-1 text-foreground">{c.value}</p>
              </div>
              <div className={`p-3 rounded-full ${c.tileClassName}`}>
                <Icon className="size-5" />
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
