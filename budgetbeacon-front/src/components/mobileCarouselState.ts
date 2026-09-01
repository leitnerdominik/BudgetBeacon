const clampCarouselIndex = (index: number, slideCount: number): number =>
  Math.min(Math.max(index, 0), slideCount - 1);

const carouselAlignmentTolerancePx = 1;

export const resolveCarouselActiveIndex = (
  slideIds: readonly string[],
  activeSlideId: string | null,
): number => {
  if (slideIds.length === 0) {
    return -1;
  }

  const activeIndex = activeSlideId === null ? -1 : slideIds.indexOf(activeSlideId);

  return activeIndex === -1 ? 0 : activeIndex;
};

export const getAdjacentCarouselIndex = (
  activeIndex: number,
  direction: -1 | 1,
  slideCount: number,
): number => {
  if (slideCount === 0) {
    return -1;
  }

  return clampCarouselIndex(activeIndex + direction, slideCount);
};

export const getNearestCarouselIndex = (
  scrollLeft: number,
  viewportWidth: number,
  slideCount: number,
): number => {
  if (slideCount === 0 || viewportWidth <= 0) {
    return -1;
  }

  return clampCarouselIndex(Math.round(scrollLeft / viewportWidth), slideCount);
};

export const getCarouselProgrammaticTargetIndex = (
  scrollLeft: number,
  viewportWidth: number,
  targetIndex: number,
): number | null => {
  if (viewportWidth <= 0) {
    return null;
  }

  const targetScrollLeft = targetIndex * viewportWidth;

  return Math.abs(scrollLeft - targetScrollLeft) <= carouselAlignmentTolerancePx
    ? null
    : targetIndex;
};

export type CarouselScrollTransition = {
  activeIndex: number;
  programmaticTargetIndex: number | null;
  shouldNotify: boolean;
};

export const getCarouselScrollTransition = (
  activeIndex: number,
  observedIndex: number,
  programmaticTargetIndex: number | null,
  hasSettled = false,
): CarouselScrollTransition => {
  if (programmaticTargetIndex !== null) {
    if (observedIndex === programmaticTargetIndex) {
      return {
        activeIndex,
        programmaticTargetIndex: null,
        shouldNotify: false,
      };
    }

    if (hasSettled) {
      return {
        activeIndex: observedIndex,
        programmaticTargetIndex: null,
        shouldNotify: observedIndex !== activeIndex,
      };
    }

    return {
      activeIndex,
      programmaticTargetIndex,
      shouldNotify: false,
    };
  }

  return {
    activeIndex: observedIndex,
    programmaticTargetIndex: null,
    shouldNotify: observedIndex !== activeIndex,
  };
};
