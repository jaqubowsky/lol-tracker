import type { QueueFilter, TimeRangeFilter, CustomDateRange } from "@/utils/types";

interface RankFiltersProps {
  queue: QueueFilter;
  timeRange: TimeRangeFilter;
  customDateRange?: CustomDateRange;
  onQueueChange: (queue: QueueFilter) => void;
  onTimeRangeChange: (timeRange: TimeRangeFilter) => void;
  onCustomDateChange?: (range: CustomDateRange) => void;
}

function ToggleGroup<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex">
      {options.map((option, i) => {
        const isActive = option.value === value;
        const isFirst = i === 0;
        const isLast = i === options.length - 1;
        return (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            className={`
              px-3 py-1.5 text-xs uppercase tracking-wider font-medium transition-all duration-200 cursor-pointer
              border border-gold-dark/40
              ${isFirst ? "" : "-ml-px"}
              ${isFirst ? "rounded-l" : ""} ${isLast ? "rounded-r" : ""}
              ${isActive
                ? "bg-gold-dark/40 text-gold-bright border-gold-secondary/60 relative z-10"
                : "bg-bg-secondary/40 text-text-muted hover:text-text-secondary hover:bg-bg-surface/40"
              }
            `}
            style={{ fontFamily: "var(--font-display)" }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

const queueOptions: { value: QueueFilter; label: string }[] = [
  { value: "all", label: "Wszystkie" },
  { value: "solo", label: "Solo/Duo" },
  { value: "flex", label: "Flex" },
];

const timeOptions: { value: TimeRangeFilter; label: string }[] = [
  { value: "7d", label: "7 dni" },
  { value: "14d", label: "14 dni" },
  { value: "30d", label: "30 dni" },
  { value: "all", label: "Cały czas" },
  { value: "custom", label: "Własny" },
];

export function RankFilters({ queue, timeRange, customDateRange, onQueueChange, onTimeRangeChange, onCustomDateChange }: RankFiltersProps) {
  return (
    <div className="flex flex-wrap items-start sm:items-center gap-3 sm:gap-4 mb-6">
      <div className="flex items-center gap-2">
        <span className="text-text-muted text-[10px] uppercase tracking-widest hidden sm:inline">Kolejka</span>
        <ToggleGroup options={queueOptions} value={queue} onChange={onQueueChange} />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-text-muted text-[10px] uppercase tracking-widest hidden sm:inline">Okres</span>
        <ToggleGroup options={timeOptions} value={timeRange} onChange={onTimeRangeChange} />
      </div>
      {timeRange === "custom" && onCustomDateChange && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-text-muted text-[10px] uppercase tracking-widest">Od</span>
          <input
            type="date"
            value={customDateRange?.startDate ?? ""}
            max={customDateRange?.endDate || new Date().toISOString().split("T")[0]}
            onChange={(e) => onCustomDateChange({ startDate: e.target.value, endDate: customDateRange?.endDate ?? "" })}
            className="bg-bg-secondary/60 border border-gold-dark/40 text-text-primary text-xs px-2 py-1 rounded focus:outline-none focus:border-gold-secondary/60"
          />
          <span className="text-text-muted text-[10px] uppercase tracking-widest">Do</span>
          <input
            type="date"
            value={customDateRange?.endDate ?? ""}
            min={customDateRange?.startDate || undefined}
            max={new Date().toISOString().split("T")[0]}
            onChange={(e) => onCustomDateChange({ startDate: customDateRange?.startDate ?? "", endDate: e.target.value })}
            className="bg-bg-secondary/60 border border-gold-dark/40 text-text-primary text-xs px-2 py-1 rounded focus:outline-none focus:border-gold-secondary/60"
          />
        </div>
      )}
    </div>
  );
}
