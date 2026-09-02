import assert from "node:assert/strict";
import test from "node:test";

import {
  getAdjacentCarouselIndex,
  getCarouselProgrammaticTargetIndex,
  getCarouselScrollTransition,
  getNearestCarouselIndex,
  resolveCarouselActiveIndex,
} from "../src/components/mobileCarouselState.ts";

test("resolves known active slide IDs and defaults null or unknown IDs to the first slide", () => {
  const slideIds = ["overview", "categories", "trends"];

  assert.equal(resolveCarouselActiveIndex(slideIds, "categories"), 1);
  assert.equal(resolveCarouselActiveIndex(slideIds, null), 0);
  assert.equal(resolveCarouselActiveIndex(slideIds, "missing"), 0);
});

test("returns no active index when there are no slides", () => {
  assert.equal(resolveCarouselActiveIndex([], null), -1);
  assert.equal(resolveCarouselActiveIndex([], "overview"), -1);
});

test("moves to adjacent slides and clamps at both boundaries", () => {
  assert.equal(getAdjacentCarouselIndex(1, -1, 3), 0);
  assert.equal(getAdjacentCarouselIndex(1, 1, 3), 2);
  assert.equal(getAdjacentCarouselIndex(0, -1, 3), 0);
  assert.equal(getAdjacentCarouselIndex(2, 1, 3), 2);
});

test("returns no adjacent index when there are no slides", () => {
  assert.equal(getAdjacentCarouselIndex(0, -1, 0), -1);
  assert.equal(getAdjacentCarouselIndex(0, 1, 0), -1);
});

test("rounds scroll offsets to the nearest full-width slide", () => {
  assert.equal(getNearestCarouselIndex(149, 100, 4), 1);
  assert.equal(getNearestCarouselIndex(150, 100, 4), 2);
});

test("clamps negative and excessive scroll offsets to valid slides", () => {
  assert.equal(getNearestCarouselIndex(-25, 100, 4), 0);
  assert.equal(getNearestCarouselIndex(900, 100, 4), 3);
});

test("returns no nearest index without slides or a positive viewport width", () => {
  assert.equal(getNearestCarouselIndex(0, 100, 0), -1);
  assert.equal(getNearestCarouselIndex(0, 0, 3), -1);
});

test("suppresses intermediate programmatic scroll positions until the latest target is reached", () => {
  assert.deepEqual(getCarouselScrollTransition(2, 0, 2), {
    activeIndex: 2,
    programmaticTargetIndex: 2,
    shouldNotify: false,
  });

  assert.deepEqual(getCarouselScrollTransition(2, 2, 2), {
    activeIndex: 2,
    programmaticTargetIndex: null,
    shouldNotify: false,
  });
});

test("reports native user scrolls after programmatic suppression is cleared", () => {
  assert.deepEqual(getCarouselScrollTransition(2, 1, null), {
    activeIndex: 1,
    programmaticTargetIndex: null,
    shouldNotify: true,
  });

  assert.deepEqual(getCarouselScrollTransition(1, 1, null), {
    activeIndex: 1,
    programmaticTargetIndex: null,
    shouldNotify: false,
  });
});

test("adopts an interrupted programmatic scroll once it settles away from its target", () => {
  assert.deepEqual(getCarouselScrollTransition(2, 1, 2, true), {
    activeIndex: 1,
    programmaticTargetIndex: null,
    shouldNotify: true,
  });

  assert.deepEqual(getCarouselScrollTransition(2, 2, 2, true), {
    activeIndex: 2,
    programmaticTargetIndex: null,
    shouldNotify: false,
  });
});

test("does not suppress the first native observation after a no-op alignment", () => {
  const programmaticTargetIndex = getCarouselProgrammaticTargetIndex(200, 100, 2);

  assert.equal(programmaticTargetIndex, null);
  assert.deepEqual(getCarouselScrollTransition(2, 1, programmaticTargetIndex), {
    activeIndex: 1,
    programmaticTargetIndex: null,
    shouldNotify: true,
  });
});
