import * as React from "react";

interface ListPageHeaderProps {
  breadcrumb: React.ReactNode;
  title: string;
  subtitle: string;
  actions: React.ReactNode;
}

export function ListPageHeader({ breadcrumb, title, subtitle, actions }: ListPageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">{breadcrumb}</div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">{title}</h1>
        <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
      </div>
      <div className="flex items-center gap-3">{actions}</div>
    </div>
  );
}
