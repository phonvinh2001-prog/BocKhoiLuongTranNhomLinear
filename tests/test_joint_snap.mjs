import assert from "assert";

// Mock Engine State for Testing
const state = {
  strips: [],
  points: [
    { x: 0, y: 0 }, // Corner 1
    { x: 5, y: 0 }, // Corner 2
    { x: 5, y: 8 }, // Corner 3
    { x: 0, y: 8 }, // Corner 4
    { x: 0, y: 4 }, // Helper Point (e.g. inner U corner)
    { x: 2, y: 4 },
  ],
  edges: [
    { p1: { x: 0, y: 0 }, p2: { x: 5, y: 0 }, type: "WALL_V" }, // Horizontal Edge at Y=0
    { p1: { x: 0, y: 4 }, p2: { x: 2, y: 4 }, type: "WALL_V" }, // Horizontal Edge at Y=4
  ],
};

// Extracted Snap Logic from Engine.js (Simplified for Test)
// Parameters:
// - jointVal: scalar value on strip (distance from start)
// - strip: { start, end, pos, isVert }
// - corners: [{x,y}]
// - edges: [{p1,p2}]
// Returns: { val: snappedGlobalPos, type: 'VERT'|'HOZS' } or null
function findSnapPoint(jointVal, strip, corners, edges) {
  const SNAP_DIST = 0.2; // 20cm
  let globalPos = strip.start + jointVal;
  let isVertStrip = strip.isVert;

  // 1. Snap to Vertices
  for (let p of corners) {
    const target = isVertStrip ? p.y : p.x;
    if (Math.abs(globalPos - target) < SNAP_DIST) {
      return { val: target, type: "VERTEX" };
    }
  }

  // 2. Snap to Edges
  for (let e of edges) {
    if (isVertStrip) {
      // Cut is Horizontal (Y) -> Look for Horizontal Edges (p1.y == p2.y)
      if (Math.abs(e.p1.y - e.p2.y) < 0.01) {
        const target = e.p1.y;
        if (Math.abs(globalPos - target) < SNAP_DIST) {
          return { val: target, type: "EDGE" };
        }
      }
    } else {
      // Cut is Vertical (X) -> Look for Vertical Edges
      if (Math.abs(e.p1.x - e.p2.x) < 0.01) {
        const target = e.p1.x;
        if (Math.abs(globalPos - target) < SNAP_DIST) {
          return { val: target, type: "EDGE" };
        }
      }
    }
  }

  return null;
}

// TESTS
console.log("🧪 TESTING SNAP LOGIC...");

// Case 1: Vertical Strip (x=1.5, y: 0->8). Joint at 3.9m. Wall Corner at y=4.
// Expected: Snap to 4.0
{
  const strip = { start: 0, end: 8, pos: 1.5, isVert: true };
  const res = findSnapPoint(3.9, strip, state.points, state.edges);
  assert.ok(res, "Should find snap point");
  assert.strictEqual(res.val, 4.0, "Should snap to 4.0");
  console.log("✅ Case 1 (Vertex Snap): PASS");
}

// Case 2: Horizontal Strip (y=2.0, x: 0->5). Joint at 4.9m. Wall Corner at x=5.
// Expected: Snap to 5.0
{
  const strip = { start: 0, end: 5, pos: 2.0, isVert: false };
  const res = findSnapPoint(4.9, strip, state.points, state.edges);
  assert.ok(res, "Should find snap point");
  assert.strictEqual(res.val, 5.0, "Should snap to 5.0");
  console.log("✅ Case 2 (Vertex Snap Horz): PASS");
}

// Case 3: Edge Snap. Vertical Strip. Joint near 0.1m. Wall Edge at Y=0.
{
  const strip = { start: 0, end: 8, pos: 1.5, isVert: true };
  const res = findSnapPoint(0.1, strip, state.points, state.edges);
  assert.ok(res, "Should find snap point");
  assert.strictEqual(res.val, 0.0, "Should snap to 0.0");
  console.log("✅ Case 3 (Edge Snap): PASS");
}

// Case 4: No Snap (Far from anything)
{
  const strip = { start: 0, end: 8, pos: 1.5, isVert: true };
  const res = findSnapPoint(2.5, strip, state.points, state.edges); // 2.5 is far from 0, 4, 8
  assert.strictEqual(res, null, "Should NOT snap");
  console.log("✅ Case 4 (No Snap): PASS");
}

console.log("🏁 ALL TESTS PASSED");
