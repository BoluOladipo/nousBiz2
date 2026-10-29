"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, ChevronDown } from "lucide-react";

export type DashboardPeriod = "this-month" | "last-month" | "this-year";

const periods: { value: DashboardPeriod; label: string }[] = [
  { value: "this-month", label: "This month" },
  { value: "last-month", label: "Last month" },
  { value: "this-year", label: "This year" },
];

export default function PeriodSelector({
  period,
}: {
  period: DashboardPeriod;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const selectedLabel =
    periods.find((option) => option.value === period)?.label ??
    "This month";

  function choosePeriod(value: DashboardPeriod) {
    setOpen(false);
    router.push(`/dashboard?period=${value}`);
  }

  return (
    <div className="relative w-full sm:w-auto">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 sm:w-auto"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-slate-500" />
          {selectedLabel}
        </span>
        <ChevronDown className="h-4 w-4 text-slate-500" />
      </button>

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-10 cursor-default"
            aria-label="Close period menu"
            onClick={() => setOpen(false)}
          />
          <div
            role="menu"
            aria-label="Dashboard date range"
            className="absolute right-0 z-20 mt-2 w-full min-w-40 rounded-xl border border-slate-200 bg-white p-1 shadow-lg sm:w-48"
          >
            {periods.map((option) => (
              <button
                key={option.value}
                type="button"
                role="menuitemradio"
                aria-checked={period === option.value}
                onClick={() => choosePeriod(option.value)}
                className={`w-full rounded-lg px-3 py-2 text-left text-sm ${
                  period === option.value
                    ? "bg-indigo-50 font-medium text-indigo-700"
                    : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
