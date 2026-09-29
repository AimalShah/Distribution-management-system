"use client";

import * as React from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DateRange } from "react-day-picker";

type DateRangePickerProps = {
  value: { startDate: Date; endDate: Date };
  onChange: (range: { startDate: Date; endDate: Date }) => void;
};

export function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  const [internalRange, setInternalRange] = React.useState<DateRange>({
    from: value.startDate,
    to: value.endDate,
  });

  React.useEffect(() => {
    setInternalRange({ from: value.startDate, to: value.endDate });
  }, [value.startDate, value.endDate]);

  function handleSelect(range: DateRange | undefined) {
    if (!range?.from || !range?.to) {
      setInternalRange(range || { from: undefined, to: undefined });
      return;
    }
    setInternalRange(range);
    onChange({ startDate: range.from, endDate: range.to });
  }

  return (
    <div className={cn("grid gap-2")}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant="outline"
            className={cn(
              "w-[300px] justify-start text-left font-normal",
              !internalRange.from && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {internalRange.from ? (
              internalRange.to ? (
                <>
                  {format(internalRange.from, "LLL dd, y")} -{" "}
                  {format(internalRange.to, "LLL dd, y")}
                </>
              ) : (
                format(internalRange.from, "LLL dd, y")
              )
            ) : (
              <span>Pick a date range</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={internalRange.from}
            selected={internalRange}
            onSelect={handleSelect}
            numberOfMonths={2}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
