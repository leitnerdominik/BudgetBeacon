import { useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
  Skeleton,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import LightbulbOutlinedIcon from "@mui/icons-material/LightbulbOutlined";

import { LoadingState, StatusMessage } from "../../../components/feedback/AsyncState";
import { useNetworkStatus } from "../../../hooks/useNetworkStatus";
import { useSlowLoading } from "../../../hooks/useSlowLoading";
import { useTips } from "../hooks/useTips";

const MOBILE_DESCRIPTION_LINES = 5;

export const TipList = () => {
  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down("sm"));
  const isOnline = useNetworkStatus();
  const [expandedTips, setExpandedTips] = useState<Record<string, boolean>>({});
  const { data: tips, isLoading, isError, refetch } = useTips();
  const isSlowLoading = useSlowLoading(isLoading);

  const toggleExpanded = (tipId: string) => {
    setExpandedTips((current) => ({
      ...current,
      [tipId]: !current[tipId],
    }));
  };

  if (isLoading) {
    return (
      <Box sx={{ flexGrow: 1 }}>
        <Typography variant={isSmallScreen ? "h5" : "h4"} gutterBottom>
          AI Financial Tips
        </Typography>
        <LoadingState
          label="Loading AI financial tips..."
          isOffline={!isOnline}
          isSlow={isSlowLoading}
          minHeight={180}
        />
        <Grid container spacing={{ xs: 1.5, sm: 3 }}>
          {[1, 2, 3].map((item) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={item}>
              <Card elevation={2} sx={{ borderRadius: { xs: 2.5, sm: 3 } }}>
                <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                  <Skeleton variant="text" height={36} width="70%" />
                  <Skeleton
                    variant="rectangular"
                    height={72}
                    sx={{ my: 1.5, borderRadius: 1.5 }}
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

  if (isError) {
    return (
      <Box sx={{ flexGrow: 1 }}>
        <Typography variant={isSmallScreen ? "h5" : "h4"} gutterBottom>
          AI Financial Tips
        </Typography>
        <StatusMessage
          title={isOnline ? "AI tips are currently unavailable" : "You're offline"}
          description={
            isOnline
              ? "We couldn't load AI financial tips right now. Please try again."
              : "Reconnect to the internet and retry to load your latest AI financial tips."
          }
          actionLabel="Retry"
          onAction={() => {
            void refetch();
          }}
        />
      </Box>
    );
  }

  if (!tips || tips.length === 0) {
    return (
      <Box sx={{ flexGrow: 1 }}>
        <Typography variant={isSmallScreen ? "h5" : "h4"} gutterBottom>
          AI Financial Tips
        </Typography>
        <StatusMessage
          title="No AI tips available yet"
          description="Upload fresh transaction data or check back later for new savings recommendations."
        />
      </Box>
    );
  }

  return (
    <Box sx={{ flexGrow: 1 }}>
      <Typography
        variant={isSmallScreen ? "h5" : "h4"}
        gutterBottom
        sx={{ display: "flex", alignItems: "center", gap: 1 }}
      >
        <LightbulbOutlinedIcon fontSize={isSmallScreen ? "medium" : "large"} color="primary" />
        AI Financial Tips
      </Typography>

      <Grid container spacing={{ xs: 1.5, sm: 3 }}>
        {tips.map((tip) => {
          const isExpanded = !!expandedTips[tip.id];
          const shouldCollapse = isSmallScreen && tip.description.length > 180;

          return (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={tip.id}>
              <Card
                elevation={2}
                sx={{
                  height: "100%",
                  borderRadius: { xs: 2.5, sm: 3 },
                  display: "flex",
                  flexDirection: "column",
                  transition: "transform 0.2s",
                  "&:hover": {
                    transform: isSmallScreen ? "none" : "translateY(-4px)",
                    boxShadow: isSmallScreen ? 2 : 4,
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
                      onClick={() => toggleExpanded(tip.id)}
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
                    <Chip label={tip.category} size="small" variant="outlined" />
                    <Chip
                      label={`${tip.impact} Impact`}
                      size="small"
                      color={tip.impact === "High" ? "success" : "default"}
                    />
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
