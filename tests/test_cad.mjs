import { CAD_UTILS } from "../js/CADParser.js";
import assert from "assert";

console.log("🧪 STARTING CAD PARSER TESTS...");

// Test Helper
const test = (desc, fn) => {
  try {
    fn();
    console.log(`✅ PASS: ${desc}`);
  } catch (e) {
    console.error(`❌ FAIL: ${desc}`);
    console.error(e);
  }
};

// 1. Direct Distance
test("Parse Direct Distance (5.5)", () => {
  const res = CAD_UTILS.parseInput("5.5");
  assert.deepStrictEqual(res, { type: "DIST", val: 5.5 });
});

// 2. Relative Coordinates
test("Parse Relative Coords (@2,3)", () => {
  const res = CAD_UTILS.parseInput("@2,3");
  assert.deepStrictEqual(res, { type: "REL_COORD", x: 2, y: 3 });
});

test("Parse Relative Negative (@-2,-3.5)", () => {
  const res = CAD_UTILS.parseInput("@-2,-3.5");
  assert.deepStrictEqual(res, { type: "REL_COORD", x: -2, y: -3.5 });
});

// 3. Polar Coordinates (Standard)
test("Parse Polar Standard (@5<45)", () => {
  const res = CAD_UTILS.parseInput("@5<45");
  assert.deepStrictEqual(res, { type: "POLAR", dist: 5, angle: 45 });
});

// 4. Polar Coordinates (Simplified)
test("Parse Polar Simplified (5<30)", () => {
  const res = CAD_UTILS.parseInput("5<30");
  assert.deepStrictEqual(res, { type: "POLAR", dist: 5, angle: 30 });
});

// 5. Absolute Coordinates
test("Parse Absolute Coords (10,10)", () => {
  const res = CAD_UTILS.parseInput("10,10");
  assert.deepStrictEqual(res, { type: "ABS_COORD", x: 10, y: 10 });
});

// 6. Commands
test("Parse Command (L)", () => {
  const res = CAD_UTILS.parseInput("L");
  assert.deepStrictEqual(res, { type: "CMD", val: "L" });
});

test("Parse Command (CLOSE)", () => {
  const res = CAD_UTILS.parseInput("CLOSE");
  assert.deepStrictEqual(res, { type: "CMD", val: "CLOSE" });
});

// 7. Calculation Test
test("Calculate Destination (Polar)", () => {
  const start = { x: 0, y: 0 };
  // 5 meters at 90 degrees (should be x=0, y=5)
  // Note: JS Math.sin/cos use radians.
  // Float precision might be tricky, use approximation check if needed
  const dest = CAD_UTILS.calcDest(start, 5, 90);

  // Check with epsilon
  const isXZero = Math.abs(dest.x) < 0.0001;
  const isYFive = Math.abs(dest.y - 5) < 0.0001;

  assert.ok(isXZero, `Expected X ~ 0, got ${dest.x}`);
  assert.ok(isYFive, `Expected Y ~ 5, got ${dest.y}`);
});

console.log("🏁 TESTS COMPLETED");
