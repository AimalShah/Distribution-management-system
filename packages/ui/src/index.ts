/**
 * `@dms/ui` barrel.
 *
 * Screens import from `@dms/ui` rather than reaching into `src/components/*`,
 * so a component can be moved or split without touching every call site.
 *
 * Re-exported with `export *` per component rather than one wide file: these
 * are ES modules with no import-time side effects, so a bundler drops the ones
 * a given screen does not reference. That matters here because `chart` pulls in
 * recharts and `sidebar` is large on their own -- the `size-limit` budget in
 * `apps/web` is what keeps the barrel honest, and it fails the build if
 * something starts pulling these in wholesale.
 *
 * `date-range` is the one component here that is not from shadcn: shadcn ships
 * a single-month `calendar` but no range control, and the report screens filter
 * by period.
 */

export * from "./lib/utils";
export * from "./hooks/use-mobile";

export * from "./components/accordion";
export * from "./components/alert";
export * from "./components/avatar";
export * from "./components/badge";
export * from "./components/button";
export * from "./components/calendar";
export * from "./components/card";
export * from "./components/chart";
export * from "./components/checkbox";
export * from "./components/date-range";
export * from "./components/data-table";
export * from "./components/dialog";
export * from "./components/dropdown-menu";
export * from "./components/form";
export * from "./components/input";
export * from "./components/label";
export * from "./components/popover";
export * from "./components/progress";
export * from "./components/select";
export * from "./components/separator";
export * from "./components/sheet";
export * from "./components/sidebar";
export * from "./components/skeleton";
export * from "./components/sonner";
export * from "./components/switch";
export * from "./components/table";
export * from "./components/tabs";
export * from "./components/textarea";
export * from "./components/tooltip";
