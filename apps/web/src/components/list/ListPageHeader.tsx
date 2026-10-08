import * as React from "react";

interface ListPageHeaderProps {
  breadcrumb: React.ReactNode;
  title: string;
  subtitle: string;
  actions: React.ReactNode;
}

/** @deprecated — replaced by PageHead. Re-export so stale imports still compile. */
export { PageHead as ListPageHeader } from "./PageHead";

/** @deprecated — kept temporarily for backward compatibility */
export function ListPageHeaderLegacy(_props: ListPageHeaderProps) {
  return null;
}
