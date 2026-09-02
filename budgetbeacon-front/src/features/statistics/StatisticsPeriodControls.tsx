import {
  Box,
  Button,
  Collapse,
  IconButton,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import BarChartIcon from "@mui/icons-material/BarChart";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { useState } from "react";

import {
  STATISTICS_TIMEFRAME_OPTIONS,
  shouldShowStatisticsPeriodOptions,
  toMonthInputValue,
  type MonthReference,
  type StatisticsTimeframeValue,
} from "./statisticsPeriod";

type StatisticsPeriodControlsProps = {
  timeframe: StatisticsTimeframeValue;
  selectedMonth: MonthReference;
  periodLabel: string;
  isSmallScreen: boolean;
  isMobileView: boolean;
  isAllTime: boolean;
  isMonthlyView: boolean;
  onTimeframeChange: (value: StatisticsTimeframeValue) => void;
  onMonthChange: (value: string) => void;
  onMonthShift: (offset: number) => void;
  onCurrentMonthSelect: () => void;
};

export const StatisticsPeriodControls = ({
  timeframe,
  selectedMonth,
  periodLabel,
  isSmallScreen,
  isMobileView,
  isAllTime,
  isMonthlyView,
  onTimeframeChange,
  onMonthChange,
  onMonthShift,
  onCurrentMonthSelect,
}: StatisticsPeriodControlsProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const showPeriodOptions = shouldShowStatisticsPeriodOptions(
    isMobileView,
    isExpanded,
  );

  return (
    <Stack
      direction={{ xs: "column", md: "row" }}
      spacing={showPeriodOptions ? { xs: 1.75, sm: 2 } : 0}
      justifyContent="space-between"
      alignItems={{ xs: "stretch", md: "flex-start" }}
      sx={{ mb: { xs: 2, sm: 3 }, minWidth: 0, maxWidth: "100%" }}
    >
      <Box
        sx={{
          alignItems: "center",
          display: "flex",
          gap: 1,
          justifyContent: "space-between",
          minWidth: 0,
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Stack direction="row" spacing={1.25} alignItems="center">
            <Box
              aria-hidden="true"
              sx={{
                width: { xs: 34, sm: 38 },
                height: { xs: 34, sm: 38 },
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
                borderRadius: 1,
                color: "primary.dark",
                bgcolor: "primary.light",
                border: "1px solid",
                borderColor: "divider",
              }}
            >
              <BarChartIcon fontSize={isSmallScreen ? "small" : "medium"} />
            </Box>
            <Typography variant={isSmallScreen ? "h5" : "h4"} fontWeight={700}>
              Statistics
            </Typography>
          </Stack>
          <Typography
            variant="body1"
            color="text.secondary"
            sx={{ mt: 0.75, overflowWrap: "anywhere" }}
          >
            {periodLabel}
          </Typography>
        </Box>

        {isMobileView ? (
          <IconButton
            aria-controls="statistics-period-options"
            aria-expanded={isExpanded}
            aria-label={
              isExpanded ? "Hide period controls" : "Show period controls"
            }
            onClick={() => setIsExpanded((current) => !current)}
            sx={{ flexShrink: 0 }}
          >
            <ExpandMoreIcon
              sx={{
                transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                transition: (theme) => theme.transitions.create("transform"),
              }}
            />
          </IconButton>
        ) : null}
      </Box>

      <Collapse
        id="statistics-period-options"
        in={showPeriodOptions}
        timeout="auto"
        sx={{
          minWidth: 0,
          width: { xs: "100%", md: "auto" },
          "& .MuiCollapse-wrapperInner": { width: "100%" },
        }}
      >
        <Stack
          spacing={1}
          alignItems={{ xs: "stretch", md: "flex-end" }}
          sx={{
            width: { xs: "100%", md: "auto" },
            minWidth: 0,
            maxWidth: "100%",
          }}
        >
          <ToggleButtonGroup
            value={timeframe}
            exclusive
            onChange={(_, value: StatisticsTimeframeValue | null) => {
              if (value) {
                onTimeframeChange(value);
              }
            }}
            aria-label="Statistics timeframe"
            size="small"
            sx={{
              width: { xs: "100%", md: "auto" },
              flexWrap: "wrap",
              "& .MuiToggleButton-root": {
                flex: { xs: "1 1 calc(50% - 1px)", sm: "initial" },
                minWidth: { xs: 0, sm: "auto" },
                px: { xs: 1, sm: 1.5 },
                whiteSpace: "nowrap",
              },
            }}
          >
            {STATISTICS_TIMEFRAME_OPTIONS.map((option) => (
              <ToggleButton
                key={option.value}
                value={option.value}
                aria-label={option.label}
              >
                {option.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>

          {!isAllTime ? (
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1}
              alignItems={{ xs: "stretch", sm: "center" }}
              sx={{
                width: { xs: "100%", sm: "auto" },
                minWidth: 0,
                p: { xs: 1, sm: 0 },
                border: { xs: "1px solid", sm: "none" },
                borderColor: "divider",
                borderRadius: { xs: 1, sm: 0 },
                bgcolor: { xs: "background.paper", sm: "transparent" },
              }}
            >
              <Stack direction="row" spacing={0.75} sx={{ minWidth: 0 }}>
                <Tooltip title="Previous month">
                  <IconButton
                    aria-label="Previous month"
                    onClick={() => onMonthShift(-1)}
                    sx={{ flex: { xs: 1, sm: "initial" } }}
                  >
                    <ChevronLeftIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Next month">
                  <IconButton
                    aria-label="Next month"
                    onClick={() => onMonthShift(1)}
                    sx={{ flex: { xs: 1, sm: "initial" } }}
                  >
                    <ChevronRightIcon />
                  </IconButton>
                </Tooltip>
              </Stack>
              <TextField
                label={isMonthlyView ? "Month" : "End month"}
                type="month"
                size="small"
                value={toMonthInputValue(selectedMonth)}
                onChange={(event) => onMonthChange(event.target.value)}
                inputProps={{
                  min: "2000-01",
                  max: "2100-12",
                }}
                InputLabelProps={{ shrink: true }}
                sx={{ minWidth: 0, width: { xs: "100%", sm: 170 } }}
              />
              <Button
                variant="outlined"
                startIcon={<CalendarMonthIcon />}
                onClick={onCurrentMonthSelect}
                sx={{
                  whiteSpace: "nowrap",
                  width: { xs: "100%", sm: "auto" },
                }}
              >
                Current
              </Button>
            </Stack>
          ) : null}
        </Stack>
      </Collapse>
    </Stack>
  );
};
