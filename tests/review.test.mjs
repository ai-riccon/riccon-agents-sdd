import test from "node:test";
import assert from "node:assert/strict";
import { reviewPasses } from "../scripts/lib/review.mjs";

function review(findings = [], verdict = "pass", extra = {}) {
  return {
    id: "REV-TASK-0001-001",
    kind: "task",
    task: "TASK-0001",
    verdict,
    independent: true,
    reviewed_commit: "abc123",
    reviewed_evidence: ["EV-0001"],
    findings,
    ...extra,
  };
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

test("reviewPasses 拒绝未知 severity 与缺失绑定", () => {
  assert.equal(reviewPasses(review([{ severity: "critical", title: "x", status: "open" }])), false);
  assert.equal(reviewPasses(review([{ severity: "p0", title: "x", status: "open" }])), false);
  assert.equal(reviewPasses(review([{ title: "x", status: "open" }])), false);
  assert.equal(reviewPasses(review([], "pass", { reviewed_commit: null })), false);
  assert.equal(reviewPasses(review([], "pass", { reviewed_evidence: [] })), false);
  assert.equal(reviewPasses(review([], "pass", { independent: false })), false);
});

test("reviewPasses 校验 task commit 绑定", () => {
  assert.equal(reviewPasses(review([]), { task: { end_commit: "abc123" } }), true);
  assert.equal(reviewPasses(review([]), { task: { end_commit: "other" } }), false);
});
