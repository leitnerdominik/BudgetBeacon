import type { StatisticsTrendPoint } from "../../types/api";

export const MOBILE_TREND_POINT_LIMIT = 6;

export const getCondensedTrendPoints = (
  points: readonly StatisticsTrendPoint[],
): readonly StatisticsTrendPoint[] => points.slice(-MOBILE_TREND_POINT_LIMIT);
