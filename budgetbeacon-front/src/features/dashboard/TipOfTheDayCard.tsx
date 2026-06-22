import { useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Typography,
} from "@mui/material";
import LightbulbCircleIcon from "@mui/icons-material/LightbulbCircle";

import { LoadingState, StatusMessage } from "../../components/AsyncState";
import { TransactionCategoryIcon } from "../transactions/components/TransactionCategoryIcon";
import type { RegionalTip } from "../../types/api";

const MOBILE_TIP_PREVIEW_LINES = 4;

type TipOfTheDayCardProps = {
  tip?: RegionalTip;
  isLoading: boolean;
  isError: boolean;
  hasNoTransactionsForTips: boolean;
  isOnline: boolean;
  isSmallScreen: boolean;
  isSlow: boolean;
  onRetry: () => void;
};

export const TipOfTheDayCard = ({
  tip,
  isLoading,
  isError,
  hasNoTransactionsForTips,
  isOnline,
  isSmallScreen,
  isSlow,
  onRetry,
}: TipOfTheDayCardProps) => {
  const [tipExpanded, setTipExpanded] = useState(false);

  return (
    <Card
      sx={{
        height: "100%",
        backgroundColor: "primary.dark",
        color: "primary.contrastText",
      }}
    >
      <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
        <Box sx={{ display: "flex", alignItems: "center", mb: 1.5, gap: 1 }}>
          <LightbulbCircleIcon fontSize={isSmallScreen ? "medium" : "large"} />
          <Typography variant={isSmallScreen ? "subtitle1" : "h6"}>
            Tip of the Day
          </Typography>
        </Box>

        {isLoading ? (
          <LoadingState
            label="Loading your tip of the day..."
            isOffline={!isOnline}
            isSlow={isSlow}
            minHeight={220}
            inverted
          />
        ) : tip ? (
          <>
            <Typography
              variant={isSmallScreen ? "body1" : "subtitle1"}
              fontWeight="bold"
              gutterBottom
            >
              {tip.title}
            </Typography>
            <Typography
              variant="body2"
              paragraph
              sx={
                isSmallScreen && !tipExpanded
                  ? {
                      display: "-webkit-box",
                      WebkitLineClamp: MOBILE_TIP_PREVIEW_LINES,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                      mb: 1,
                    }
                  : undefined
              }
            >
              {tip.description}
            </Typography>
            {isSmallScreen && tip.description.length > 140 ? (
              <Box sx={{ mb: 1.5 }}>
                <Button
                  size="small"
                  onClick={() => setTipExpanded((current) => !current)}
                  sx={{
                    px: 0,
                    minWidth: 0,
                    color: "inherit",
                    textTransform: "none",
                    fontWeight: 700,
                  }}
                >
                  {tipExpanded ? "Show less" : "Read more"}
                </Button>
              </Box>
            ) : null}
            <Chip
              label={tip.category}
              icon={
                <TransactionCategoryIcon
                  category={tip.category}
                  fontSize="small"
                />
              }
              size="small"
              sx={{
                backgroundColor: "rgba(255,255,255,0.14)",
                color: "inherit",
                border: "1px solid rgba(255,255,255,0.24)",
              }}
            />
          </>
        ) : isError && hasNoTransactionsForTips ? (
          <StatusMessage
            title="No transactions for tips yet"
            description="Add or import transactions first to generate an AI savings tip."
            minHeight={220}
            inverted
          />
        ) : isError ? (
          <StatusMessage
            title={isOnline ? "Tip of the day is unavailable" : "You're offline"}
            description={
              isOnline
                ? "We couldn't load AI savings tips right now. Retry to fetch a fresh tip."
                : "Reconnect to the internet and retry to load your latest AI tip."
            }
            actionLabel="Retry"
            onAction={onRetry}
            minHeight={220}
            inverted
          />
        ) : (
          <StatusMessage
            title="No tip available right now"
            description="Check back later or upload more transaction data for fresh recommendations."
            minHeight={220}
            inverted
          />
        )}
      </CardContent>
    </Card>
  );
};
