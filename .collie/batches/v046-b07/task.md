---
schema_version: 1
run_id: r-20261118033352
batch_id: v046-b07
base_sha: d26b74b3034a09dc0f02888ba5f90e4c7d0e31ab
created_at: 2026-11-18T03:33:53.439Z
attempt: 1
interrupted_at: null
issued_by: collie
---

# 批次 v046-b07：配置加 tester_max 与静态检查命令、三个事件类型、test/acceptance 受保护（不接进队列）

## 你的身份与边界

你的身份、权限边界与工作协议见 `AGENT-worker.md`，全局铁律见 `CONSTRAINTS.md`，
方案来源见 `SPEC.md`。本文件只做本批次提醒。

## 本批次条目（3 个）

1. 读 SPEC 16.12 的「测试 agent 这一步怎么走」。`src/schema/index.ts` 与 `templates/collie.toml`：
   `[limits]` 加可选的 `tester_max`（正整数，缺省 2，缺省值的写法照 `grace_secs`）；`[verify]` 加可选的 `static`（非空字符串的数组；不写时解析结果里没有这个键）。
   模板里写上 `tester_max = 2` 与 `static = ["npm run lint", "npm run typecheck"]`，各带一行注释。本仓库的 `.collie/collie.toml` 不许动：它没有这两项，必须照常能加载。
   **没有这两项的配置能加载，`limits.tester_max` 是 2、`verify` 里没有 `static`；`tester_max = 0` 被拒绝，报错点名 `limits.tester_max`**
2. `src/schema/index.ts` 的事件类型加三个：`tester.started`、`tester.finished`、`redcheck.result`。这一批只加类型，不在任何地方记录它们。
3. `src/evidence.ts` 的受保护路径加 `test/acceptance`；`scripts/mutation.ts` 的清单加一项 `protected:test/acceptance`（写法照已有的 9 项），共 43 项。
   **worker 的提交在 `test/acceptance/` 下新增或改动一个文件：`spec_diff_lines` 大于 0**
   测试与允许改写的旧用例（只有下面四处，每处在「偏离或疑问」里列出原断言与现断言）：
   `test/config.test.ts` 的 `has the limits of SPEC 3.1`：期望对象里加 `tester_max: 2`；同一文件的内联配置 `VALID_TOML`：跟着模板加上 `static` 一行（`equals the inline SPEC 3.1 fixture…` 的断言本身不变）；
   `test/schema.test.ts` 的 `defines the v0.1 event types plus v0.2 and v0.3 types added so far`：个数 37 改成 40，并加三条 `toContain`；
   `test/mutation.test.ts` 的 `every protected path is in the mutation list`：9 改成 10。
   R1 查过：`test/cli.test.ts` 里比较 `limits` 的那条两边都取自模板，不受影响；`test/mutation.test.ts` 的 `has at least 42 items` 用的是「不少于」，不用改；
   没有现有测试在沙箱仓库里往 `test/acceptance/` 写文件。你发现有别的现有用例因此失败，停下，在「偏离或疑问」里写明是哪一条，不要自己改。
   新用例：`test/config.test.ts` 新加一组 `describe('config: tester_max and verify.static', …)`，含条目 1 加粗的情形、模板里两项的值；
   `test/evidence.test.ts` 加一条 `counts test/acceptance as protected (SPEC 16.12)`。
   `test/invariants.test.ts` 加「`src/evidence.ts` 里有 `test/acceptance`」

## 验收标准（可机器判定）

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 配置、事件、取证、变异清单的测试通过 | `npm test -- test/config.test.ts test/schema.test.ts test/evidence.test.ts test/mutation.test.ts` | exit 0 |
| 配置的新用例组与受保护路径的新用例在 | `grep -qF "config: tester_max and verify.static" test/config.test.ts && grep -qF "counts test/acceptance as protected (SPEC 16.12)" test/evidence.test.ts` | exit 0 |
| 模板里有两项，本仓库的配置没有被动 | `grep -qE "^tester_max = 2" templates/collie.toml && grep -qE "^static = " templates/collie.toml && ! grep -qE "tester_max\|^static = " .collie/collie.toml` | exit 0 |
| 变异清单是 43 项 | `npx tsx scripts/mutation.ts --list \| grep -c . \| grep -qx 43` | exit 0 |
| 变异检查全部被发现，工作区里没有留下报告 | `out=$(npx tsx scripts/mutation.ts 2>&1) && printf '%s\n' "$out" \| tail -n 1 \| grep -qE "^mutation: caught 43 survived 0 invalid 0 timeout 0 stale 0$" && ! test -e .vitest` | exit 0 |
| 不变量同步 | `grep -qF "test/acceptance" test/invariants.test.ts` | exit 0 |

## 本批次额外禁止

- 改动任何受保护路径（含 `.collie/collie.toml`）；改动 `.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`
- 改动 `src/run.ts`、`src/redcheck.ts`、`src/roles/`、`src/runner/`、`src/arbiter.ts`、`src/gate.ts`、`src/backlog.ts`、`src/view.ts`、`src/follow.ts`；在任何地方记录新加的三个事件；在仓库里建 `test/acceptance/` 目录
- 为了让测试过而删除或跳过任何测试；改写条目 3 点名之外的任何已有断言；从变异清单里去掉任何一项
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；新增依赖

## 汇报要求

完成后写 `.collie/batches/v046-b07/report.md`：固定四段（做了什么 / 测试结果 / 偏离或疑问 / 下一步建议）
+ 尾部围栏 JSON 块，格式见 SPEC 3.4。
写完后以 `report(collie): v046-b07` 为提交信息单独提交并推送该文件。
