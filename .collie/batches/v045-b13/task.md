---
schema_version: 1
run_id: r-20261117085145
batch_id: v045-b13
base_sha: d59e17c98cd9d5e8f5c596a77bb443fae6e012fb
created_at: 2026-11-17T08:51:46.126Z
attempt: 1
interrupted_at: null
issued_by: collie
---

# 批次 v045-b13：删除仲裁规则 4：reviewer 报的「声称不符」不再改裁定

## 你的身份与边界

你的身份、权限边界与工作协议见 `AGENT-worker.md`，全局铁律见 `CONSTRAINTS.md`，
方案来源见 `SPEC.md`。本文件只做本批次提醒。

## 本批次条目（3 个）

1. `src/arbiter.ts`：删掉规则 4 这一段。规则 5~10 的编号不变，4 空着。`src/schema/index.ts` 的 `VerdictSchema`：`claim_mismatches` 改为可选，缺省按空数组，`SCHEMA_VERSION` 不变；R2 不再读它。
   放行判定（`src/gate.ts`）不动：它的第 2 项数的是 R2 自己记的 `claim.mismatch`。旧 journal 里的 `rule: 4` 照常显示，`src/view.ts` 不动。
   **reviewer 判 PASS、`claim_mismatches` 非空、其余证据都好：结论是 PASS、规则 10、没有降级，队列照常放行并取下一个批次**
2. `scripts/mutation.ts`：清单去掉 `rule4-reviewer-mismatch` 与 `rule4-pass-to-fix`，共 42 项；其余 42 项的名字不动。
3. 测试。允许改写或删除的旧用例只有下面几处，每一处都在「偏离或疑问」里列出用例名、原断言、现断言：
   `test/arbiter.test.ts` 的 `arbiter: rule 4, reviewer-reported mismatches` 一组（2 条）删掉；`rule 3 beats rule 4` 改成「`claim_mismatches` 非空时规则 3 照常命中」；
   `rule 4 beats rule 5` 改成「`claim_mismatches` 非空、声称已推送而远端没有 → 规则 5」；`test/mutation.test.ts` 的 `has at least 44 items` 改为 42，末行格式那条里的示例数字可以跟着改。
   新增：`test/arbiter.test.ts` 里条目 1 加粗的情形，以及「reviewer 判 FIX、`claim_mismatches` 非空 → FIX、规则 10」；
   `test/reviewer.test.ts` 里「没有 `claim_mismatches` 字段的 verdict 能解析，取出来是空数组」；
   新文件 `test/no-rule4.test.ts`：用 `FakeRunner` 跑真实的 `run --continue`，两个批次，第一个的 reviewer 判 PASS 且 `claim_mismatches` 非空，第二个正常 PASS →
   退出码 0、两个批次都是 `passed`、第一个批次记了 `queue.gate_passed`、它的 journal 里没有 `verdict.downgraded`。
   `test/invariants.test.ts` 加「`src/arbiter.ts` 的非注释行不含 `claim_mismatches`」

## 验收标准（可机器判定）

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 删除规则 4 的专项测试通过 | `npm test -- test/no-rule4.test.ts` | exit 0 |
| 仲裁、裁决解析、变异清单的测试通过 | `npm test -- test/arbiter.test.ts test/reviewer.test.ts test/mutation.test.ts` | exit 0 |
| 专项测试跑的是真实队列并断言了放行 | `grep -qE "FakeRunner" test/no-rule4.test.ts && grep -qE "gate_passed" test/no-rule4.test.ts` | exit 0 |
| 仲裁不再读 reviewer 报的声称不符（不看注释行） | `! grep -vE "^\s*(//\|\*\|/\*)" src/arbiter.ts \| grep -qE "claim_mismatches"` | exit 0 |
| 变异清单是 42 项 | `npx tsx scripts/mutation.ts --list \| grep -c . \| grep -qx 42` | exit 0 |
| 变异检查全部被发现，工作区里没有留下报告 | `out=$(npx tsx scripts/mutation.ts 2>&1) && printf '%s\n' "$out" \| tail -n 1 \| grep -qE "^mutation: caught 42 survived 0 invalid 0 timeout 0 stale 0$" && ! test -e .vitest` | exit 0 |
| 不变量同步 | `grep -qE "claim_mismatches" test/invariants.test.ts` | exit 0 |

## 本批次额外禁止

- 改动任何受保护路径；改动 `.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`
- 改动 `src/gate.ts`、`src/evidence.ts`、`src/run.ts`、`src/view.ts`、`src/follow.ts`；重排规则编号；改动规则 1~3、5~10 的任何判断
- 删除或跳过条目 3 点名之外的任何测试；改写点名之外的任何已有断言；从变异清单里去掉点名之外的项
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；新增依赖

## 汇报要求

完成后写 `.collie/batches/v045-b13/report.md`：固定四段（做了什么 / 测试结果 / 偏离或疑问 / 下一步建议）
+ 尾部围栏 JSON 块，格式见 SPEC 3.4。
写完后以 `report(collie): v045-b13` 为提交信息单独提交并推送该文件。
