import { useSearchParams } from "react-router-dom";

import { TipList } from "../features/tips/TipList";
import {
  DEFAULT_TIPS_TIMEFRAME,
  isTipsTimeframeValue,
  type TipsTimeframeValue,
} from "../features/tips/tipsTimeframes";

export const TipsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const timeframeParam = searchParams.get("timeframe") ?? DEFAULT_TIPS_TIMEFRAME;
  const selectedTimeframe = isTipsTimeframeValue(timeframeParam)
    ? timeframeParam
    : DEFAULT_TIPS_TIMEFRAME;

  const handleSelectedTimeframeChange = (value: TipsTimeframeValue) => {
    setSearchParams({ timeframe: value }, { replace: true });
  };

  return (
    <TipList
      selectedTimeframe={selectedTimeframe}
      onSelectedTimeframeChange={handleSelectedTimeframeChange}
    />
  );
};
