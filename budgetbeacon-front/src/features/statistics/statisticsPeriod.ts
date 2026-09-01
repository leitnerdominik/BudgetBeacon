export type StatisticsTimeframeValue = "all" | "12" | "6" | "3" | "1";

export type MonthReference = {
  month: number;
  year: number;
};

export const STATISTICS_TIMEFRAME_OPTIONS: ReadonlyArray<{
  label: string;
  value: StatisticsTimeframeValue;
}> = [
  { value: "all", label: "All time" },
  { value: "12", label: "1 year" },
  { value: "6", label: "6 months" },
  { value: "3", label: "3 months" },
  { value: "1", label: "1 month" },
];

const timeframeValues = new Set<StatisticsTimeframeValue>(
  STATISTICS_TIMEFRAME_OPTIONS.map((option) => option.value),
);

const monthFormatter = new Intl.DateTimeFormat("de-DE", {
  month: "long",
  year: "numeric",
});

export const getCurrentMonthSelection = (
  referenceDate: Date = new Date(),
): MonthReference => ({
  month: referenceDate.getMonth() + 1,
  year: referenceDate.getFullYear(),
});

export const toMonthInputValue = ({ month, year }: MonthReference) =>
  `${year}-${String(month).padStart(2, "0")}`;

export const parseMonthInputValue = (value: string): MonthReference | null => {
  const [yearValue, monthValue] = value.split("-");
  const year = Number(yearValue);
  const month = Number(monthValue);

  if (!Number.isInteger(year) || !Number.isInteger(month)) {
    return null;
  }

  if (year < 2000 || year > 2100 || month < 1 || month > 12) {
    return null;
  }

  return { year, month };
};

export const parseTimeframeValue = (
  value: string | null,
): StatisticsTimeframeValue =>
  value && timeframeValues.has(value as StatisticsTimeframeValue)
    ? (value as StatisticsTimeframeValue)
    : "1";

export const shiftMonth = (
  { month, year }: MonthReference,
  offset: number,
): MonthReference => {
  const date = new Date(year, month - 1 + offset, 1);

  return {
    month: date.getMonth() + 1,
    year: date.getFullYear(),
  };
};

export const formatMonthLabel = ({ month, year }: MonthReference) =>
  monthFormatter.format(new Date(year, month - 1, 1));

export const formatPeriodLabel = (
  timeframe: StatisticsTimeframeValue,
  endMonth: MonthReference,
) => {
  if (timeframe === "all") {
    return "All time";
  }

  const monthCount = Number(timeframe);
  if (monthCount === 1) {
    return formatMonthLabel(endMonth);
  }

  const startMonth = shiftMonth(endMonth, -monthCount + 1);
  return `${formatMonthLabel(startMonth)} - ${formatMonthLabel(endMonth)}`;
};

export const buildStatisticsSearchParams = (
  currentSearchParams: URLSearchParams,
  timeframe: StatisticsTimeframeValue,
  selectedMonth: MonthReference,
) => {
  const params = new URLSearchParams(currentSearchParams);

  params.set("timeframe", timeframe);

  if (timeframe === "all") {
    params.delete("month");
  } else {
    params.set("month", toMonthInputValue(selectedMonth));
  }

  return params;
};
