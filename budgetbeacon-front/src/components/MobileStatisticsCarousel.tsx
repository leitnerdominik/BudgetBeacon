import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import IconButton from "@mui/material/IconButton";
import useMediaQuery from "@mui/material/useMediaQuery";
import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import type { SxProps, Theme } from "@mui/material/styles";

import {
  getAdjacentCarouselIndex,
  getCarouselProgrammaticTargetIndex,
  getCarouselScrollTransition,
  getNearestCarouselIndex,
  resolveCarouselActiveIndex,
} from "./mobileCarouselState";

const scrollIdleDelayMs = 150;

export type MobileStatisticsCarouselSlide = {
  id: string;
  label: string;
  content: ReactNode;
};

export type MobileStatisticsCarouselProps = {
  slides: readonly MobileStatisticsCarouselSlide[];
  activeSlideId: string | null;
  onActiveSlideChange: (slideId: string) => void;
  ariaLabel: string;
  sx?: SxProps<Theme>;
};

export const MobileStatisticsCarousel = ({
  slides,
  activeSlideId,
  onActiveSlideChange,
  ariaLabel,
  sx,
}: MobileStatisticsCarouselProps) => {
  const slideIds = slides.map((slide) => slide.id);
  const slideIdSignature = slideIds.join("\u0000");
  const controlledActiveIndex = resolveCarouselActiveIndex(slideIds, activeSlideId);
  const controlledStateKey = JSON.stringify([slideIdSignature, activeSlideId]);
  const [visibleState, setVisibleState] = useState({
    controlledStateKey,
    index: controlledActiveIndex,
  });
  const viewportRef = useRef<HTMLDivElement>(null);
  const visibleIndexRef = useRef(controlledActiveIndex);
  const slideIdsRef = useRef(slideIds);
  const controlledActiveIndexRef = useRef(controlledActiveIndex);
  const onActiveSlideChangeRef = useRef(onActiveSlideChange);
  const animationFrameRef = useRef<number | null>(null);
  const scrollIdleTimerRef = useRef<number | null>(null);
  const programmaticTargetIndexRef = useRef<number | null>(null);
  const hasAlignedViewportRef = useRef(false);
  const prefersReducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");

  if (visibleState.controlledStateKey !== controlledStateKey) {
    setVisibleState({
      controlledStateKey,
      index: controlledActiveIndex,
    });
  }

  const visibleIndex = visibleState.index;

  useLayoutEffect(() => {
    slideIdsRef.current = slideIds;
    controlledActiveIndexRef.current = controlledActiveIndex;
    onActiveSlideChangeRef.current = onActiveSlideChange;
  }, [controlledActiveIndex, onActiveSlideChange, slideIds]);

  const updateVisibleIndex = useCallback((index: number) => {
    visibleIndexRef.current = index;
    setVisibleState((currentState) =>
      currentState.index === index ? currentState : { ...currentState, index },
    );
  }, []);

  const clearScrollIdleTimer = useCallback(() => {
    if (scrollIdleTimerRef.current !== null) {
      window.clearTimeout(scrollIdleTimerRef.current);
      scrollIdleTimerRef.current = null;
    }
  }, []);

  const cancelPendingScrollWork = useCallback(() => {
    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    clearScrollIdleTimer();
  }, [clearScrollIdleTimer]);

  const navigateToIndex = useCallback(
    (requestedIndex: number, behavior: ScrollBehavior) => {
      const currentSlideIds = slideIdsRef.current;
      const targetIndex = Math.min(
        Math.max(requestedIndex, 0),
        currentSlideIds.length - 1,
      );
      const targetId = currentSlideIds[targetIndex];

      if (targetId === undefined) {
        return;
      }

      const previousId = currentSlideIds[visibleIndexRef.current];
      const viewport = viewportRef.current;

      if (targetId !== previousId) {
        cancelPendingScrollWork();
        programmaticTargetIndexRef.current =
          viewport === null
            ? null
            : getCarouselProgrammaticTargetIndex(
                viewport.scrollLeft,
                viewport.clientWidth,
                targetIndex,
              );
        updateVisibleIndex(targetIndex);
        onActiveSlideChangeRef.current(targetId);
      }

      if (viewport !== null && programmaticTargetIndexRef.current !== null) {
        viewport.scrollTo({
          left: targetIndex * viewport.clientWidth,
          behavior,
        });
      }
    },
    [cancelPendingScrollWork, updateVisibleIndex],
  );

  useLayoutEffect(() => {
    if (controlledActiveIndex === -1) {
      return;
    }

    cancelPendingScrollWork();
    visibleIndexRef.current = controlledActiveIndexRef.current;

    const viewport = viewportRef.current;
    programmaticTargetIndexRef.current =
      viewport === null
        ? null
        : getCarouselProgrammaticTargetIndex(
            viewport.scrollLeft,
            viewport.clientWidth,
            controlledActiveIndexRef.current,
          );

    if (viewport !== null && programmaticTargetIndexRef.current !== null) {
      viewport.scrollTo({
        left: controlledActiveIndexRef.current * viewport.clientWidth,
        behavior: hasAlignedViewportRef.current && !prefersReducedMotion ? "smooth" : "auto",
      });
    }

    hasAlignedViewportRef.current = true;
  }, [cancelPendingScrollWork, controlledActiveIndex, controlledStateKey, prefersReducedMotion]);

  const reconcileScrollPosition = useCallback(
    (hasSettled: boolean) => {
      const viewport = viewportRef.current;
      if (viewport === null) {
        return;
      }

      const nextIndex = getNearestCarouselIndex(
        viewport.scrollLeft,
        viewport.clientWidth,
        slideIdsRef.current.length,
      );
      const nextId = slideIdsRef.current[nextIndex];
      if (nextId === undefined) {
        return;
      }

      const transition = getCarouselScrollTransition(
        visibleIndexRef.current,
        nextIndex,
        programmaticTargetIndexRef.current,
        hasSettled,
      );
      programmaticTargetIndexRef.current = transition.programmaticTargetIndex;

      if (transition.shouldNotify) {
        updateVisibleIndex(transition.activeIndex);
        onActiveSlideChangeRef.current(nextId);
      }
    },
    [updateVisibleIndex],
  );

  useLayoutEffect(() => () => cancelPendingScrollWork(), [cancelPendingScrollWork]);

  const handleScroll = useCallback(() => {
    clearScrollIdleTimer();
    scrollIdleTimerRef.current = window.setTimeout(() => {
      scrollIdleTimerRef.current = null;
      reconcileScrollPosition(true);
    }, scrollIdleDelayMs);

    if (animationFrameRef.current !== null) {
      return;
    }

    animationFrameRef.current = window.requestAnimationFrame(() => {
      animationFrameRef.current = null;

      reconcileScrollPosition(false);
    });
  }, [clearScrollIdleTimer, reconcileScrollPosition]);

  const movementBehavior: ScrollBehavior = prefersReducedMotion ? "auto" : "smooth";
  const rootSx = {
    display: "flex",
    flexDirection: "column",
    height: "100%",
  } satisfies SxProps<Theme>;
  const combinedSx: SxProps<Theme> =
    sx === undefined ? rootSx : Array.isArray(sx) ? [rootSx, ...sx] : [rootSx, sx];

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) {
      return;
    }

    const direction = event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : null;
    if (direction === null) {
      return;
    }

    event.preventDefault();
    navigateToIndex(
      getAdjacentCarouselIndex(visibleIndexRef.current, direction, slideIdsRef.current.length),
      movementBehavior,
    );
  };

  if (controlledActiveIndex === -1) {
    return null;
  }

  return (
    <Box
      aria-label={ariaLabel}
      aria-roledescription="carousel"
      onKeyDown={handleKeyDown}
      role="region"
      sx={combinedSx}
      tabIndex={0}
    >
      <Box
        onScroll={handleScroll}
        ref={viewportRef}
        sx={{
          display: "flex",
          flex: "1 1 auto",
          minHeight: 0,
          msOverflowStyle: "none",
          overflowX: "auto",
          overflowY: "hidden",
          scrollbarWidth: "none",
          scrollSnapType: "x mandatory",
          "&::-webkit-scrollbar": {
            display: "none",
          },
        }}
      >
        {slides.map((slide, index) => {
          const isActive = index === visibleIndex;

          return (
            <Box
              aria-hidden={!isActive}
              aria-label={`${slide.label}, slide ${index + 1} of ${slides.length}`}
              aria-roledescription="slide"
              inert={!isActive}
              key={slide.id}
              role="group"
              sx={{
                flex: "0 0 100%",
                height: "100%",
                minWidth: 0,
                scrollSnapAlign: "start",
                scrollSnapStop: "always",
              }}
            >
              {slide.content}
            </Box>
          );
        })}
      </Box>

      <Box sx={{ alignItems: "center", display: "flex", gap: 1, pt: 1 }}>
        <IconButton
          aria-label="Previous slide"
          disabled={visibleIndex === 0}
          onClick={() =>
            navigateToIndex(
              getAdjacentCarouselIndex(visibleIndexRef.current, -1, slides.length),
              movementBehavior,
            )
          }
        >
          <ChevronLeftIcon />
        </IconButton>

        <Box
          sx={{
            display: "flex",
            flex: "1 1 auto",
            gap: 0.5,
            justifyContent: "center",
            minWidth: 0,
            overflowX: "auto",
          }}
        >
          {slides.map((slide, index) => {
            const isActive = index === visibleIndex;

            return (
              <ButtonBase
                aria-current={isActive ? "true" : undefined}
                aria-label={`Go to slide ${index + 1}: ${slide.label}`}
                key={slide.id}
                onClick={() => navigateToIndex(index, movementBehavior)}
                sx={{
                  flex: "0 0 auto",
                  height: 40,
                  width: 40,
                }}
              >
                <Box
                  aria-hidden="true"
                  sx={{
                    bgcolor: isActive ? "primary.main" : "action.disabled",
                    borderRadius: "50%",
                    height: 8,
                    width: 8,
                  }}
                />
              </ButtonBase>
            );
          })}
        </Box>

        <IconButton
          aria-label="Next slide"
          disabled={visibleIndex === slides.length - 1}
          onClick={() =>
            navigateToIndex(
              getAdjacentCarouselIndex(visibleIndexRef.current, 1, slides.length),
              movementBehavior,
            )
          }
        >
          <ChevronRightIcon />
        </IconButton>
      </Box>
    </Box>
  );
};
