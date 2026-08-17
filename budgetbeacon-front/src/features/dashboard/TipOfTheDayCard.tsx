import { useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Stack,
  Typography,
} from "@mui/material";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import LightbulbCircleIcon from "@mui/icons-material/LightbulbCircle";

import { LoadingState, StatusMessage } from "../../components/AsyncState";
import { TransactionCategoryIcon } from "../transactions/components/TransactionCategoryIcon";
import type { RegionalTip } from "../../types/api";

const MOBILE_TIP_PREVIEW_LINES = 4;

type TipOfTheDayCardProps = {
  tip?: RegionalTip;
  hasGeneratedTips: boolean;
  isGenerating: boolean;
  isError: boolean;
  hasNoTransactionsForTips: boolean;
  isOnline: boolean;
  isSmallScreen: boolean;
  isSlow: boolean;
  onGenerate: () => void;
};

export const TipOfTheDayCard = ({
  tip,
  hasGeneratedTips,
  isGenerating,
  isError,
  hasNoTransactionsForTips,
  isOnline,
  isSmallScreen,
  isSlow,
  onGenerate,
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
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1.25}
          alignItems={{ xs: "stretch", sm: "center" }}
          justifyContent="space-between"
          sx={{ mb: 1.5 }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <LightbulbCircleIcon fontSize={isSmallScreen ? "medium" : "large"} />
            <Typography variant={isSmallScreen ? "subtitle1" : "h6"}>
              Tip of the Day
            </Typography>
          </Box>
          <Button
            variant="outlined"
            size="small"
            onClick={onGenerate}
            disabled={!isOnline || isGenerating}
            startIcon={
              isGenerating ? (
                <CircularProgress size={16} color="inherit" />
              ) : (
                <AutoAwesomeIcon />
              )
            }
            sx={{
              color: "inherit",
              borderColor: "rgba(255,255,255,0.38)",
              whiteSpace: "nowrap",
              "&:hover": {
                borderColor: "rgba(255,255,255,0.6)",
                backgroundColor: "rgba(255,255,255,0.08)",
              },
              "&.Mui-disabled": {
                color: "rgba(255,255,255,0.5)",
                borderColor: "rgba(255,255,255,0.2)",
              },
            }}
          >
            {isGenerating
              ? "Generating..."
              : hasGeneratedTips
                ? "Regenerate tip"
                : "Generate tip"}
          </Button>
        </Stack>

        {isGenerating && !tip ? (
          <LoadingState
            label="Generating your tip of the day..."
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
            title={isOnline ? "Tip generation failed" : "You're offline"}
            description={
              isOnline
                ? "We couldn't generate an AI savings tip right now. Use the button above to try again."
                : "Reconnect to the internet to generate your AI savings tip."
            }
            minHeight={220}
            inverted
          />
        ) : hasGeneratedTips ? (
          <StatusMessage
            title="No AI tip was generated"
            description="Add fresh transaction data or try regenerating your savings tip later."
            minHeight={220}
            inverted
          />
        ) : (
          <StatusMessage
            title="Generate your AI savings tip"
            description="Use the Generate tip button when you want AI to analyze your recent spending."
            minHeight={220}
            inverted
          />
        )}
      </CardContent>
    </Card>
  );
};
