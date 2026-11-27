import test from "node:test";
import assert from "node:assert/strict";
import { makeProject } from "./helpers.mjs";
import {
  answerDecision, gateApproved, latestGateDecision, newDecision,
} from "../scripts/lib/decision.mjs";

test("approve 后 reject 撤销批准", () => {
  const root = makeProject("decision-revoke");
  const approve = newDecision(root, { gate: "spec", question: "批准？" });
  answerDecision(root, approve.id, { answer: "yes", kind: "approve" });
  assert.equal(gateApproved(root, "spec"), true);

  const reject = newDecision(root, { gate: "spec", question: "再次确认？" });
  answerDecision(root, reject.id, { answer: "no", kind: "reject" });
  assert.equal(gateApproved(root, "spec"), false);
  assert.equal(latestGateDecision(root, "spec").id, reject.id);

  const approveAgain = newDecision(root, { gate: "spec", question: "最终确认？" });
  answerDecision(root, approveAgain.id, { answer: "yes", kind: "approve" });
  assert.equal(gateApproved(root, "spec"), true);
});

test("已回答决策默认不能重答，--reopen 才行", () => {
  const root = makeProject("decision-reopen");
  const decision = newDecision(root, { gate: "plan", question: "批准？" });
  answerDecision(root, decision.id, { answer: "yes", kind: "approve" });
  assert.throws(
    () => answerDecision(root, decision.id, { answer: "no", kind: "reject" }),
    /已经是 answered/,
  );
  answerDecision(root, decision.id, { answer: "no", kind: "reject", reopen: true });
  assert.equal(gateApproved(root, "plan"), false);
});

test("非法 gate 在写入前被拒绝", () => {
  const root = makeProject("decision-gate");
  assert.throws(() => newDecision(root, { gate: "bogus", question: "?" }), /未知门禁/);
});
