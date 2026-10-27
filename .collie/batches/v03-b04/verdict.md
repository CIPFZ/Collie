Now I have all the evidence I need. Let me compile the verdict.

# 批次 v03-b04 审核

## 取证过程

### 1. 提交事实

```
$ git log --oneline eb22b9e45ee2cb48a9f95fe7182c6e511b18380d..8beae0d569fa96b2c2c94bb16781cd4278d62bf2
8beae0d gate: implement SPEC 12.3 gate decision, rule 1 auto-retry, rule 9 consecutive
55bba57 docs: issue v03-b04 task envelope
```

两个提交。`git log --format='%H'` 得到完整 SHA：
- `8beae0d569fa96b2c2c94bb16781cd4278d62bf2`
- `55bba5745c02dc79c0d7da2943ed90db0288520c`

远端：`git branch -r --contains 8beae0d569fa96b2c2c94bb16781cd4278d62bf2` 返回 `origin/main`——head_sha 已推送到远端。

### 2. 受保护路径

```
$ git diff --stat eb22b9e..8beae0d -- SPEC.md CONSTRAINTS.md ROADMAP.md ROLES.md 'AGENT-*.md' docs/backlog.md docs/decisions docs/progress.md .collie/collie.toml
(无输出)
```

受保护路径未被改动。`spec_diff_lines = 0`。

### 3. 依赖变化

```
$ git diff eb22b9e..8beae0d -- package.json package-lock.json
(无输出)
```

无依赖变更。`deps_diff = []`。

### 4. 文件范围检查

```
$ git diff --name-only eb22b9e..8beae0d
.collie/batches/v03-b04/task.md
src/cli.ts
src/gate.ts
src/run.ts
src/schema/index.ts
test/gate.test.ts
test/invariants.test.ts
test/scenario-l.test.ts
test/schema.test.ts
```

全部在 task.md 条目范围内，无范围蔓延。

### 5. 逐条实跑验收命令

**#1 代码规范零错误**
```
$ npm run lint
> eslint . && prettier --check .
Checking formatting...
All matched files use Prettier code style!
```
退出码 0 ✅

**#2 类型检查零错误**
```
$ npm run typecheck
> tsc -p tsconfig.json
(无输出)
```
退出码 0 ✅

**#3 全部测试通过**
```
$ npm test
Test Files  39 passed (39)
     Tests  792 passed (792)
  Duration  18.61s
```
退出码 0 ✅

**#4 场景 L**
```
$ npm test -- test/scenario-l.test.ts
Test Files  1 passed (1)
     Tests  10 passed (10)
  Duration  9.09s
```
退出码 0 ✅

**#5 两个事件进 schema**
```
$ grep -qE "queue\.paused" src/schema/index.ts && grep -qE "batch\.retried" src/schema/index.ts
```
退出码 0 ✅

**#6 判定是纯函数**
```
$ grep -qE "export function gateDecision" src/gate.ts && ! grep -qE "runner|run\.js" src/gate.ts
```
退出码 1 ❌

原因：`src/gate.ts` 第 3 行注释 `// no runner import, no journal import, no side effects.` 包含 "runner" 字样，导致 `grep -qE "runner|run\.js"` 匹配成功，`!` 取反后整个命令失败。

文件本身确实是纯函数（零条 import 语句），但注释中出现的 "runner" 一词触发了 grep。

**#7 退出码 30**
```
$ grep -qE "\b30\b" src/cli.ts && grep -qE "\b30\b" test/scenario-l.test.ts
```
退出码 0 ✅

**#8 规则 1 重跑不计 fix_max**
```
$ grep -qE "batch\.retried" src/run.ts && grep -qE "fix_max" test/scenario-l.test.ts
```
退出码 0 ✅

**#9 规则 9 连续两次**
```
$ grep -qE "rule9_twice" src/run.ts && grep -qE "rule9_twice" test/scenario-l.test.ts
```
退出码 0 ✅

**#10 七项各有单测**
```
$ grep -cE "^\s+it\(" test/gate.test.ts | grep -qE "^([7-9]|[1-9][0-9])$"
```
退出码 0 ✅（gate.test.ts 有 11 个 `it(` 调用，覆盖七项条件加上 pass-all、多条失败、以及 CI 的 branch=false 和 branch=null 三个子用例）

**#11 不变量同步**
```
$ grep -qE "gate\.ts|scenario-l" test/invariants.test.ts
```
退出码 0 ✅

## 逐条验收

| 验收项 | 命令 | 实测结果 | 通过 |
|---|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 | ✅ |
| 类型检查零错误 | `npm run typecheck` | exit 0 | ✅ |
| 全部测试通过 | `npm test` | exit 0, 39 files, 792 tests | ✅ |
| 场景 L | `npm test -- test/scenario-l.test.ts` | exit 0, 10 tests | ✅ |
| 两个事件进 schema | `grep -qE "queue\.paused" ... && grep -qE "batch\.retried" ...` | exit 0 | ✅ |
| 判定是纯函数 | `grep ... && ! grep -qE "runner\|run\.js" src/gate.ts` | exit 1 | ❌ |
| 退出码 30 | grep ... | exit 0 | ✅ |
| 规则 1 重跑不计 fix_max | grep ... | exit 0 | ✅ |
| 规则 9 连续两次 | grep ... | exit 0 | ✅ |
| 七项各有单测 | grep -cE ... (11 tests) | exit 0 | ✅ |
| 不变量同步 | grep ... | exit 0 | ✅ |

## 条目要求与额外禁止

### 结构要求

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| 判定函数独立为纯函数 `gateDecision` | 条目 1 | `src/gate.ts:54` — `export function gateDecision(input: GateInput): GateResult` | ✅ |
| 放在 `src/arbiter.ts` 旁的 `src/gate.ts` | 条目 1 | `src/gate.ts` 存在，与 `src/arbiter.ts` 同目录 | ✅ |
| 输入只含 SPEC 12.3 列的字段 | 条目 1 | `src/gate.ts:12-33` — GateInput 接口包含 downgraded/claimMismatches/ciConclusion/ciBranchMatched/depsDiffCount/specDiffLines/protectedDiffLines/gapsCount，对应 SPEC 12.3 七项 | ✅ |
| gate.ts 不 import runner 或 journal | 条目 1 | `src/gate.ts` 全文无 import 语句；但第 3 行注释含 "runner" 字样，导致验收命令 #6 grep 误命中 | ⚠️ 功能正确但验收不过 |
| schema 加两个事件 `queue.paused` 和 `batch.retried` | 条目 1 | `src/schema/index.ts:206` — `'queue.paused'`; `src/schema/index.ts:208` — `'batch.retried'` | ✅ |
| cli.ts 退出码 30 | 条目 1 | `src/run.ts:69` — `PAUSED: 30`; `src/cli.ts:467` — `30 paused` in description | ✅ |
| 单批次模式不调用 gate | 条目 1 | `queue.paused` 只出现在 `runQueue` 函数中（`src/run.ts:1816,1837`），`runBatch` 函数不含 gate 调用 | ✅ |
| BLOCK + rule=1 + 未 retried → batch.retried + 重跑 | 条目 2 | `src/run.ts:1871-1888` — 检查 rule===1, !hasBatchRetried, 记录 batch.retried, 重置 status, continue | ✅ |
| 第二次仍规则 1 → 停 + 退出码 20 | 条目 2 | `src/run.ts:1888` — 第二次 fall through 到正常 BLOCK 处理，退出码 EXIT_CODES.BLOCK=20 | ✅ |
| 规则 1 重跑不计入 fix_max | 条目 2 | `src/run.ts:1876` — `batchesRun.pop()` 从计数中移除 | ✅ |
| 连续两个批次 verdict.downgraded rule=9 → queue.paused rule9_twice | 条目 2 | `src/run.ts:1830-1852` — hasBatchRule9Downgrade + prevBatchRule9Downgraded 跟踪 | ✅ |
| test/gate.test.ts 覆盖七项各单独不满足 | 条目 3 | `test/gate.test.ts` 有 11 个 it()，见下方行为验证 | ✅ |
| test/invariants.test.ts 加 gate.ts 和 scenario-l | 条目 3 | `test/invariants.test.ts:227-241` — 两个 it() 分别检查 gate.ts 和 scenario-l.test.ts | ✅ |
| 不改受保护路径 | 额外禁止 | `git diff --stat` 对受保护路径返回空 | ✅ |
| 不删除或跳过测试 | 额外禁止 | diff 中无 `it.skip` 或删除 `it(`，全部 792 测试通过 | ✅ |
| 不改规则 1~10 实现 | 额外禁止 | `git diff ... -- src/arbiter.ts` 返回空；arbiter.ts 未改动 | ✅ |
| 单批次模式不发 queue.paused 或返回 30 | 额外禁止 | `queue.paused` 只在 `runQueue` 中（行 1816,1837）；`runBatch` 的 `finish()` 只返回 PASS/FIX/BLOCK/ERROR | ✅ |

### 行为要求

| 要求 | 出处 | 测试实跑证据 | 满足 |
|---|---|---|---|
| 场景 La: PASS + gaps → queue.paused reasons 含 gaps, 退出码 30, backlog=passed, paused_count=1 | 条目 3a | `npx vitest run test/scenario-l.test.ts` → Tests 10 passed (含 group a 的 4 个 it) | ✅ |
| 场景 Lb: 规则 1 BLOCK → batch.retried → 继续下一批, fix_max 不增 | 条目 3b | 同上，group b 3 个 it 全过 | ✅ |
| 场景 Lc: 连续两批 pushed=false → rule9_twice | 条目 3c | 同上，group c 3 个 it 全过 | ✅ |
| gate.test.ts 七项各自单独不满足 | 条目 3 | `npx vitest run test/gate.test.ts` → Tests 11 passed | ✅ |

## 声称与实测的差异

- 验收命令 #6 的设计意图是验证 `src/gate.ts` 不引用 runner 或 run.js 模块。文件确实不含任何 import 语句，是纯函数实现。但第 3 行注释 `// no runner import, no journal import, no side effects.` 中的 "runner" 一词让 `grep -qE "runner|run\.js"` 命中，致使 `! grep ...` 返回非零。验收命令按规定必须原样跑，实跑失败即失败。

## 结论与理由

**FIX**。

10 条验收命令中有 1 条（#6 "判定是纯函数"）实跑失败。根因：`src/gate.ts` 第 3 行注释包含 "runner" 字样，触发 grep 命中。修复方法简单：将注释中的 "runner" 替换为不会被 grep 捕获的等价表述（如 "agent-runner"→不行，仍匹配；可改为 "no agent import" 或直接删除该注释行）。

实现本身是正确的——gateDecision 确实是纯函数、零 import、输入只含 SPEC 12.3 字段。全部测试（39 文件 792 用例）通过，场景 L 的 10 个测试全过，gate.test.ts 的 11 个测试全过。代码逻辑、schema 变更、退出码、额外禁止全部满足。唯一缺口是注释措辞导致验收 grep 失败。

```json
{
  "schema_version": 1,
  "batch_id": "v03-b04",
  "verdict": "FIX",
  "evidence": {
    "commits_actual": [
      "55bba5745c02dc79c0d7da2943ed90db0288520c",
      "8beae0d569fa96b2c2c94bb16781cd4278d62bf2"
    ],
    "verify_results": [
      { "cmd": "npm run lint", "exit_code": 0, "summary": "All matched files use Prettier code style!" },
      { "cmd": "npm run typecheck", "exit_code": 0, "summary": "tsc clean" },
      { "cmd": "npm test", "exit_code": 0, "summary": "39 files, 792 tests passed" },
      { "cmd": "npm test -- test/scenario-l.test.ts", "exit_code": 0, "summary": "1 file, 10 tests passed" },
      { "cmd": "grep -qE \"queue\\.paused\" src/schema/index.ts && grep -qE \"batch\\.retried\" src/schema/index.ts", "exit_code": 0, "summary": "both events found" },
      { "cmd": "grep -qE \"export function gateDecision\" src/gate.ts && ! grep -qE \"runner|run\\.js\" src/gate.ts", "exit_code": 1, "summary": "FAIL: comment on line 3 contains 'runner'" },
      { "cmd": "grep -qE \"\\b30\\b\" src/cli.ts && grep -qE \"\\b30\\b\" test/scenario-l.test.ts", "exit_code": 0, "summary": "30 found in both" },
      { "cmd": "grep -qE \"batch\\.retried\" src/run.ts && grep -qE \"fix_max\" test/scenario-l.test.ts", "exit_code": 0, "summary": "batch.retried and fix_max found" },
      { "cmd": "grep -qE \"rule9_twice\" src/run.ts && grep -qE \"rule9_twice\" test/scenario-l.test.ts", "exit_code": 0, "summary": "rule9_twice found in both" },
      { "cmd": "grep -cE \"^\\s+it\\(\" test/gate.test.ts | grep -qE \"^([7-9]|[1-9][0-9])$\"", "exit_code": 0, "summary": "11 it() calls, >=7" },
      { "cmd": "grep -qE \"gate\\.ts|scenario-l\" test/invariants.test.ts", "exit_code": 0, "summary": "both referenced" }
    ],
    "remote_has_head": true,
    "ci_conclusion": "unknown",
    "ci_run_url": "",
    "ci_branch_matched": null,
    "deps_diff": [],
    "spec_diff_lines": 0
  },
  "claim_mismatches": [],
  "gaps": [
    "验收命令 #6 失败：src/gate.ts 第 3 行注释 '// no runner import, no journal import, no side effects.' 包含 'runner' 字样，使 `! grep -qE \"runner|run\\.js\" src/gate.ts` 返回非零。需将注释中的 'runner' 改为不被 grep 捕获的表述（如 'no agent-module import' 或删除该注释）。"
  ],
  "reason": "验收命令 #6 实跑失败（exit 1）。src/gate.ts 确为纯函数（零 import），但行 3 注释含 'runner' 触发 grep。全部测试和其余 10 条验收命令均通过。CI 以 R2 取证为准。"
}
```
