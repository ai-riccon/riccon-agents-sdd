import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { makeProject } from "./helpers.mjs";
import { defaultConfig, loadConfig, saveConfig, mergeDeep } from "../scripts/lib/config.mjs";
import { writeYaml } from "../scripts/lib/util.mjs";

test("config 默认值与项目覆盖合并", () => {
  const root = makeProject("config");
  const defaults = defaultConfig();
  assert.equal(defaults.language, "zh-CN");
  assert.equal(defaults.evidence.hash, false);
  const config = loadConfig(root);
  assert.equal(config.coverage.line, 80);

  config.coverage.line = 90;
  config.models.builder = "provider/model";
  saveConfig(root, config);
  const reloaded = loadConfig(root);
  assert.equal(reloaded.coverage.line, 90);
  assert.equal(reloaded.models.builder, "provider/model");
  assert.equal(reloaded.coverage.branch, 70);
});

test("mergeDeep 不丢默认键", () => {
  const merged = mergeDeep({ a: { b: 1, c: 2 } }, { a: { b: 3 } });
  assert.deepEqual(merged, { a: { b: 3, c: 2 } });
});

test("config 非映射被拒绝", () => {
  const root = makeProject("config-bad");
  writeYaml(path.join(root, ".sdd", "config.yml"), "not: [valid");
  assert.throws(() => loadConfig(root), /YAML|flow|sequence/i);
});
