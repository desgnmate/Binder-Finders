"use client";

export type GridColumns = 4 | 6 | 8;

export function GridDensity({ value, onChange }: { value: GridColumns; onChange: (value: GridColumns) => void }) {
  return (
    <div className="hidden lg:flex items-center gap-2 font-body text-xs">
      <span>Cards per row</span>
      <div className="flex gap-1" role="group" aria-label="Cards per row">
        {([4, 6, 8] as const).map((count) => (
          <button key={count} type="button" aria-pressed={value === count} onClick={() => onChange(count)}
            className={`rounded-lg border-2 px-3 py-2 font-bold transition-colors ${value === count ? "border-brand-yellow bg-brand-yellow text-ink-black" : "border-current/30 hover:bg-brand-blue hover:text-white"}`}>
            {count}
          </button>
        ))}
      </div>
    </div>
  );
}
