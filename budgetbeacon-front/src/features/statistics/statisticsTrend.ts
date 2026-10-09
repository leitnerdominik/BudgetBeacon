import type { StatisticsTrendPoint } from "../../types/api";

const monthFormatter = new Intl.DateTimeFormat("de-DE", {
  month: "short", year: "numeric", timeZone: "UTC",
});

export const formatTrendPointLabel = (point: StatisticsTrendPoint) => {
  if (point.month === null) return String(point.year);
  const date = new Date(0);
  date.setUTCFullYear(point.year, point.month - 1, 1);
  return monthFormatter.format(date);
};

// Presentation only: retain server income/net values and the existing expense magnitude.
// Normalize before combining the positive/negative spans to avoid scale overflow.
export const prepareStatisticsChart = (points: readonly StatisticsTrendPoint[]) => {
  const ordered = [...points].sort((a, b) => a.year - b.year || (a.month ?? 0) - (b.month ?? 0));
  let positiveMax = 0;
  let negativeMax = 0;
  for (const point of ordered) {
    positiveMax = Math.max(positiveMax, point.totalIncome, Math.abs(point.totalExpense));
    negativeMax = Math.max(negativeMax, -point.totalIncome);
  }
  const magnitude = Math.max(positiveMax, negativeMax);
  const span = magnitude === 0 ? 0 : positiveMax / magnitude + negativeMax / magnitude;
  const zeroPercent = span === 0 ? 100 : (positiveMax / magnitude / span) * 100;
  const bar = (value: number) => {
    const heightPercent = span === 0 ? 0 : (Math.abs(value) / magnitude / span) * 100;
    return { heightPercent, topPercent: value > 0 ? Math.max(0, zeroPercent - heightPercent) : zeroPercent };
  };
  // Keep tick steps at least one cent so currency formatting does not repeat labels.
  // This affects only the scale labels, never bar proportions or server amounts.
  const positiveTicks = positiveMax >= 0.04 && negativeMax === 0
    ? [positiveMax, positiveMax * 0.75, positiveMax / 2, positiveMax * 0.25]
    : positiveMax >= 0.02 ? [positiveMax, positiveMax / 2] : [positiveMax];
  const negativeTicks = negativeMax >= 0.02 ? [-negativeMax / 2, -negativeMax] : [-negativeMax];
  const tickValues = [...positiveTicks, 0, ...negativeTicks];
  return {
    zeroPercent,
    ticks: [...new Set(tickValues)].map((value) => ({
      value,
      topPercent: span === 0 ? 100 : Math.min(100, Math.max(0, zeroPercent - (value / magnitude / span) * 100)),
    })),
    points: ordered.map((point) => ({
      point, label: formatTrendPointLabel(point),
      income: point.totalIncome, expenses: Math.abs(point.totalExpense),
      incomeBar: bar(point.totalIncome), expenseBar: bar(Math.abs(point.totalExpense)),
    })),
  };
};
