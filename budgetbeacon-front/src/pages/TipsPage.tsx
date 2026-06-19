import { useState } from "react";

import { TipList } from "../features/tips/TipList";
import {
  DEFAULT_TIPS_TIMEFRAME,
  type TipsTimeframeValue,
} from "../features/tips/tipsTimeframes";

export const TipsPage = () => {
  const [selectedTimeframe, setSelectedTimeframe] =
    useState<TipsTimeframeValue>(DEFAULT_TIPS_TIMEFRAME);

  return (
    <TipList
      selectedTimeframe={selectedTimeframe}
      onSelectedTimeframeChange={setSelectedTimeframe}
    />
  );
};
