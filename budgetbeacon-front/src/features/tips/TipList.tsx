import { useState, type KeyboardEvent, type MouseEvent } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Grid,
  Skeleton,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { useNavigate } from "react-router-dom";

import { TransactionCategoryIcon } from "../transactions/components/TransactionCategoryIcon";
import LightbulbOutlinedIcon from "@mui/icons-material/LightbulbOutlined";
import RefreshIcon from "@mui/icons-material/Refresh";

import { LoadingState, StatusMessage } from "../../components/AsyncState";
import { useNetworkStatus } from "../../hooks/useNetworkStatus";
import { useSlowLoading } from "../../hooks/useSlowLoading";
import { isTipsSourceDataNotFound } from "./tipErrors";
import { TIPS_TIMEFRAMES, type TipsTimeframeValue } from "./tipsTimeframes";
import { useTips } from "./useTips";
import type { RegionalTip } from "../../types/api";

const MOBILE_DESCRIPTION_LINES = 5;

type TipListProps = {
  onSelectedTimeframeChange: (value: TipsTimeframeValue) => void;
  selectedTimeframe: TipsTimeframeValue;
};

export const TipList = ({
  onSelectedTimeframeChange,
  selectedTimeframe,
}: TipListProps) => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down("sm"));
  const isOnline = useNetworkStatus();
  const [expandedTips, setExpandedTips] = useState<Record<string, boolean>>({});
  const {
    data: tips,
    error: tipsError,
    isFetching,
    isLoading,
    isError,
    refreshTips,
  } = useTips({
    timeframe: selectedTimeframe,
  });
  const isSlowLoading = useSlowLoading(isLoading);
  const hasNoTransactionsForTips = isTipsSourceDataNotFound(tipsError);

  const handleTimeframeChange = (
    _: MouseEvent<HTMLElement>,
    value: TipsTimeframeValue | null,
  ) => {
    if (value) {
      onSelectedTimeframeChange(value);
    }
  };

  const toggleExpanded = (tipId: string) => {
    setExpandedTips((current) => ({
      ...current,
      [tipId]: !current[tipId],
    }));
  };

  const openTipDetail = (tip: RegionalTip) => {
    navigate(`/tips/${tip.id}?timeframe=${selectedTimeframe}`);
  };

  const handleTipKeyDown = (
    event: KeyboardEvent<HTMLDivElement>,
    tip: RegionalTip,
  ) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openTipDetail(tip);
    }
  };

  const renderHeader = () => (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      spacing={1.5}
      alignItems={{ xs: "stretch", sm: "center" }}
      justifyContent="space-between"
      sx={{ mb: 2 }}
    >
      <Typography
        variant={isSmallScreen ? "h5" : "h4"}
        sx={{ display: "flex", alignItems: "center", gap: 1 }}
      >
        <LightbulbOutlinedIcon fontSize={isSmallScreen ? "medium" : "large"} color="primary" />
        AI Financial Tips
      </Typography>
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={1}
        alignItems={{ xs: "stretch", md: "center" }}
        justifyContent={{ xs: "flex-start", sm: "flex-end" }}
      >
        <ToggleButtonGroup
          exclusive
          size="small"
          value={selectedTimeframe}
          onChange={handleTimeframeChange}
          aria-label="AI tips timeframe"
          sx={{
            display: "flex",
            flexWrap: "wrap",
            gap: 0.75,
            justifyContent: { xs: "flex-start", sm: "flex-end" },
            "& .MuiToggleButtonGroup-grouped": {
              m: 0,
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 1,
              px: { xs: 1, sm: 1.25 },
              py: 0.75,
              whiteSpace: "nowrap",
              "&:not(:first-of-type)": {
                borderLeft: "1px solid",
                borderColor: "divider",
              },
            },
          }}
        >
          {TIPS_TIMEFRAMES.map((timeframe) => (
            <ToggleButton
              key={timeframe.value}
              value={timeframe.value}
              aria-label={timeframe.label}
            >
              {timeframe.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        <Button
          variant="outlined"
          onClick={() => {
            void refreshTips();
          }}
          disabled={!isOnline || isFetching}
          startIcon={
            isFetching && !isLoading ? (
              <CircularProgress size={18} color="inherit" />
            ) : (
              <RefreshIcon />
            )
          }
          sx={{ whiteSpace: "nowrap" }}
        >
          {isFetching && !isLoading ? "Refreshing..." : "Refresh tips"}
        </Button>
      </Stack>
    </Stack>
  );

  if (isLoading) {
    return (
      <Box sx={{ flexGrow: 1 }}>
        {renderHeader()}
        <LoadingState
          label="Loading AI financial tips..."
          isOffline={!isOnline}
          isSlow={isSlowLoading}
          minHeight={180}
        />
        <Grid container spacing={{ xs: 1.5, sm: 3 }}>
          {[1, 2, 3].map((item) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={item}>
              <Card>
                <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                  <Skeleton variant="text" height={36} width="70%" />
                  <Skeleton
                    variant="rectangular"
                    height={72}
                    sx={{ my: 1.5, borderRadius: 1 }}
                  />
                  <Skeleton variant="text" width="42%" />
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  }

  if (isError && hasNoTransactionsForTips) {
    return (
      <Box sx={{ flexGrow: 1 }}>
        {renderHeader()}
        <StatusMessage
          title="No transactions found for AI tips"
          description="Add or import transactions first, then AI tips can analyze your recent spending."
        />
      </Box>
    );
  }

  if (isError) {
    return (
      <Box sx={{ flexGrow: 1 }}>
        {renderHeader()}
        <StatusMessage
          title={isOnline ? "AI tips are currently unavailable" : "You're offline"}
          description={
            isOnline
              ? "We couldn't load AI financial tips right now. Please try again."
              : "Reconnect to the internet and retry to load your latest AI financial tips."
          }
          actionLabel="Retry"
          onAction={() => {
            void refreshTips();
          }}
        />
      </Box>
    );
  }

  if (!tips || tips.length === 0) {
    return (
      <Box sx={{ flexGrow: 1 }}>
        {renderHeader()}
        <StatusMessage
          title="No AI tips available yet"
          description="Add fresh transaction data or check back later for new savings recommendations."
        />
      </Box>
    );
  }

  return (
    <Box sx={{ flexGrow: 1 }}>
      {renderHeader()}

      <Grid container spacing={{ xs: 1.5, sm: 3 }}>
        {tips.map((tip) => {
          const isExpanded = !!expandedTips[tip.id];
          const shouldCollapse = isSmallScreen && tip.description.length > 180;

          return (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={tip.id}>
              <Card
                role="button"
                tabIndex={0}
                aria-label={`View reasoning for ${tip.title}`}
                onClick={() => openTipDetail(tip)}
                onKeyDown={(event) => handleTipKeyDown(event, tip)}
                sx={{
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  cursor: "pointer",
                  transition: "border-color 0.2s ease, transform 0.2s ease",
                  "&:focus-visible": {
                    outline: "3px solid",
                    outlineColor: "primary.light",
                    outlineOffset: 2,
                  },
                  "&:hover": {
                    transform: isSmallScreen ? "none" : "translateY(-4px)",
                    borderColor: "primary.main",
                  },
                }}
              >
                <CardContent sx={{ flexGrow: 1, p: { xs: 2, sm: 3 } }}>
                  <Typography
                    variant={isSmallScreen ? "subtitle1" : "h6"}
                    component="h2"
                    gutterBottom
                    sx={{ lineHeight: 1.3 }}
                  >
                    {tip.title}
                  </Typography>

                  <Typography
                    variant="body2"
                    color="text.secondary"
                    paragraph
                    sx={
                      shouldCollapse && !isExpanded
                        ? {
                            display: "-webkit-box",
                            WebkitLineClamp: MOBILE_DESCRIPTION_LINES,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                            mb: 1,
                          }
                        : undefined
                    }
                  >
                    {tip.description}
                  </Typography>

                  {shouldCollapse ? (
                    <Button
                      size="small"
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleExpanded(tip.id);
                      }}
                      onKeyDown={(event) => event.stopPropagation()}
                      sx={{
                        mb: 1.5,
                        px: 0,
                        minWidth: 0,
                        textTransform: "none",
                        fontWeight: 700,
                      }}
                    >
                      {isExpanded ? "Show less" : "Read more"}
                    </Button>
                  ) : null}

                  <Stack
                    direction="row"
                    spacing={1}
                    mt="auto"
                    pt={shouldCollapse ? 0.5 : 1.5}
                    flexWrap="wrap"
                    useFlexGap
                  >
                    <Chip
                      label={tip.category}
                      icon={
                        <TransactionCategoryIcon
                          category={tip.category}
                          fontSize="small"
                        />
                      }
                      size="small"
                      variant="outlined"
                    />
                    <Chip
                      label={`${tip.impact} Impact`}
                      size="small"
                      color={tip.impact === "High" ? "success" : "default"}
                    />
                    <Button
                      size="small"
                      onClick={(event) => {
                        event.stopPropagation();
                        openTipDetail(tip);
                      }}
                      sx={{
                        ml: "auto",
                        px: 0,
                        minWidth: 0,
                        fontWeight: 700,
                      }}
                    >
                      View reasoning
                    </Button>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>
    </Box>
  );
};
