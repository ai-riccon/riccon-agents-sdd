import test from "node:test";
import assert from "node:assert/strict";
import { reviewPasses } from "../scripts/lib/review.mjs";

function review(findings = [], verdict = "pass") {
  return { verdict, independent: true, findings };
}

test("reviewPasses 拒绝 open P0/P1", () => {
  assert.equal(reviewPasses(review([])), true);
  assert.equal(reviewPasses(review([{ severity: "P1", title: "x", status: "open" }])), false);
  assert.equal(reviewPasses(review([{ severity: "P1", title: "x", status: "fixed" }])), true);
});

test("reviewPasses 要求 P2/P3 fixed 或带 owner/due/reason 的 accepted", () => {
  assert.equal(reviewPasses(review([{ severity: "P2", title: "x", status: "open" }])), false);
  assert.equal(reviewPasses(review([{ severity: "P2", title: "x", status: "accepted" }])), false);
  assert.equal(reviewPasses(review([{
    severity: "P2", title: "x", status: "accepted", owner: "lead", due: "2026-12-01", accepted_reason: "低风险",
  }])), true);
  assert.equal(reviewPasses(review([{ severity: "P3", title: "x", status: "fixed" }])), true);
});
