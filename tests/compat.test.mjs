import test from "node:test";
import assert from "node:assert/strict";
import { parseVersion, satisfiesRange } from "../scripts/lib/compat.mjs";

test("parseVersion 支持两段/三段", () => {
  assert.deepEqual(parseVersion("1.4.5"), [1, 4, 5]);
  assert.deepEqual(parseVersion("2.0"), [2, 0, 0]);
  assert.equal(parseVersion("abc"), null);
});

test("satisfiesRange 支持 >= 与 <", () => {
  assert.equal(satisfiesRange("1.4.5", ">=1.4.5 <2.0"), true);
  assert.equal(satisfiesRange("1.5.0", ">=1.4.5 <2.0"), true);
  assert.equal(satisfiesRange("1.4.4", ">=1.4.5 <2.0"), false);
  assert.equal(satisfiesRange("2.0.0", ">=1.4.5 <2.0"), false);
});
