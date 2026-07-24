import { subtractCalendarMonths } from "../../utils/calendarDate.ts";

export const TIPS_TIMEFRAMES = [
  { value: "all-time", label: "All time", allTime: true },
  { value: "12-months", label: "1 year", monthsBack: 12 },
  { value: "6-months", label: "6 months", monthsBack: 6 },
  { value: "3-months", label: "3 months", monthsBack: 3 },
  { value: "1-month", label: "1 month", monthsBack: 1 },
] as const;

export type TipsTimeframeValue = (typeof TIPS_TIMEFRAMES)[number]["value"];

export const DEFAULT_TIPS_TIMEFRAME: TipsTimeframeValue = "3-months";

export const getTipsTimeframe = (value: TipsTimeframeValue) =>
  TIPS_TIMEFRAMES.find((timeframe) => timeframe.value === value) ??
  TIPS_TIMEFRAMES.find((timeframe) => timeframe.value === DEFAULT_TIPS_TIMEFRAME)!;

export const isTipsTimeframeValue = (value: string): value is TipsTimeframeValue =>
  TIPS_TIMEFRAMES.some((timeframe) => timeframe.value === value);

export const getTipsTimeframeParams = (
  value: TipsTimeframeValue,
  asOfDate: string,
) => {
  const timeframe = getTipsTimeframe(value);

  if ("allTime" in timeframe) {
    return { allTime: true, asOfDate };
  }

  return { monthsBack: timeframe.monthsBack, asOfDate };
};

export const getTipsTransactionDateRange = (
  value: TipsTimeframeValue,
  asOfDate: string,
) => {
  const timeframe = getTipsTimeframe(value);

  if ("allTime" in timeframe) {
    return {
      startDate: "",
      endDate: asOfDate,
    };
  }

  return {
    startDate: subtractCalendarMonths(asOfDate, timeframe.monthsBack),
    endDate: asOfDate,
  };
};
