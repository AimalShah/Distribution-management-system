import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button } from "@dms/ui";

interface PageHeadProps {
  title: string;
  subtitle?: string;
  breadcrumb?: ReactNode;
  actions?: ReactNode;
}

export function PageHead({ title, subtitle, breadcrumb, actions }: PageHeadProps) {
  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-stone-900">{title}</h1>
          {subtitle && (
            <p className="text-xs text-stone-500 mt-0.5">{subtitle}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      {breadcrumb && (
        <nav className="flex items-center gap-1 text-xs text-stone-400 mb-4">
          {breadcrumb}
        </nav>
      )}
    </div>
  );
}

/** @deprecated — kept temporarily for backward compatibility with pages that still import `ListPageHeader` */
export { PageHead as ListPageHeader } from "./PageHead";
