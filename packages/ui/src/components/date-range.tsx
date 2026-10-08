import * as React from "react";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import { CalendarIcon } from "lucide-react";

import { cn } from "../lib/utils";
import { Button } from "./button";
import { Calendar } from "./calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

/**
 * A start/end date range picker.
 *
 * shadcn ships `calendar` (a single-month grid) but no range control, and this
 * app filters sales and purchase reports by period, so the range selection lives
 * here rather than being rebuilt per screen. It is deliberately a thin
 * composition of the three primitives above -- if a report screen needs a
 * different shape, add it rather than forking this.
 *
 * `value` may be partial while the user is still choosing, so the label falls
 * back to "Pick a date" until at least one bound is set. The parent owns the
 * value: this component reports changes and never holds range state itself, so
 * the URL stays the single source of truth for a filtered report.
 */
export interface DateRangePickerProps {
  value?: DateRange;
  onChange?: (range: DateRange | undefined) => void;
  /** Restricts how far back the calendar may be paged. */
  startMonth?: Date;
  endMonth?: Date;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  id?: string;
}

export function DateRangePicker({
  value,
  onChange,
  startMonth,
  endMonth,
  placeholder = "Pick a date",
  className,
  disabled,
  id,
}: DateRangePickerProps) {
  const label = formatRangeLabel(value, placeholder);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-[260px] justify-start text-left font-normal",
            !value && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 size-4" />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          // `selected`/`onSelect` are the react-day-picker v9 names. The
          // component is uncontrolled-by-design here: the parent supplies
          // `value`, so a reset from outside the popover takes effect without
          // this component tracking a copy that could drift.
          selected={value}
          onSelect={onChange}
          defaultMonth={value?.from ?? startMonth}
          startMonth={startMonth}
          endMonth={endMonth}
          numberOfMonths={2}
        />
      </PopoverContent>
    </Popover>
  );
}

/**
 * "Jan 1 â€“ Jan 31" once both bounds exist, "Jan 1 â€“" for a half-finished
 * range, and the placeholder for neither. A range whose `to` precedes its
 * `from` is treated as unfinished rather than rendered backwards, because
 * react-day-picker can produce that mid-drag.
 */
function formatRangeLabel(range: DateRange | undefined, placeholder: string): string {
  if (!range?.from) return placeholder;

  if (!range.to || range.to < range.from) return `${format(range.from, "MMM d")} â€“`;

  return `${format(range.from, "MMM d")} â€“ ${format(range.to, "MMM d, yyyy")}`;
}
