import { ReactNode } from "react";

interface StatChipProps {
  label: string;
  value: string | number;
  accent?: "neutral" | "amber" | "green" | "red";
}

const accentClasses: Record<NonNullable<StatChipProps["accent"]>, string> = {
  neutral: "bg-stone-50 text-stone-700",
  amber: "bg-amber-50 text-amber-700",
  green: "bg-emerald-50 text-emerald-700",
  red: "bg-red-50 text-red-700",
};

export function StatChip({ label, value, accent = "neutral" }: StatChipProps) {
  return (
    <div className={`rounded-lg border border-stone-200 p-3 ${accentClasses[accent]}`}>
      <p className="text-[11px] font-medium uppercase tracking-wider">{label}</p>
      <p className="text-lg font-semibold mt-0.5">{value}</p>
    </div>
  );
}
