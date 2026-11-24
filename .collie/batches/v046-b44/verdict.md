I now have all the evidence needed. Let me compile the full verdict.

---

# 批次 v046-b44 审核

## 取证过程

### 1. 验收命令实跑

**npm run lint** → 退出码 0
```
> collie@0.1.0 lint
> eslint . && prettier --check .
Checking formatting...
All matched files use Prettier code style!
```

**npm run typecheck** → 退出码 0
```
> collie@0.1.0 typecheck
> tsc -p tsconfig.json
```

**npm test** → 退出码 0
```
 Test Files  90 passed (90)
      Tests  1610 passed (1610)
   Duration  28.78s
```

**npm test -- test/acceptance/v046-b44** → 退出码 0
```
 Test Files  2 passed (2)
      Tests  5 passed (5)
   Duration  835ms
```

**npx vitest run test/follow.test.ts**（原有 33 条全过）→ 退出码 0
```
 Test Files  1 passed (1)
      Tests  33 passed (33)
   Duration  9.29s
```

### 2. 提交事实

```
git log --format='%H %s' c9392581..acfaf3a6 -- . ':(exclude).collie/batches'
acfaf3a63d7a521b2df2ba4ee838676426a45044 cli: follow syncs before timeout exit and prints action each round
```

`git branch -r --contains acfaf3a63d7a521b2df2ba4ee838676426a45044` → `origin/main`，已推送。

### 3. 受保护路径

```
git diff --stat c9392581..acfaf3a6 -- SPEC.md CONSTRAINTS.md ROADMAP.md ROLES.md 'AGENT-*.md' docs/backlog.md docs/backlog-archive.md docs/decisions docs/progress.md .collie/collie.toml test/acceptance .github eslint.config.js vitest.config.ts
```

结果：只有 `test/acceptance/v046-b44/` 下 3 个文件（MAP.md、keep.test.ts、new.test.ts），来自 `d973e61 docs: issue v046-b44 task envelope`（R2 信封提交），worker 未动。

```
git log --format='%h %s' c9392581..acfaf3a6 -- test/acceptance
d973e61 docs: issue v046-b44 task envelope
```

只有 `docs: issue` 开头的提交，worker 没有碰 `test/acceptance`。

### 4. 依赖变化

`git diff c9392581..acfaf3a6 -- package.json package-lock.json` → 无输出，无依赖变化。

### 5. 变异检查清单

`git diff c9392581..acfaf3a6 -- scripts/mutation.ts` → 无输出，无改动。

### 6. 不变量数值变化

`git diff c9392581..acfaf3a6 -- test/invariants.test.ts` → 无输出，无改动。

### 7. 被改写或删去的断言

`git diff c9392581..acfaf3a6 -- 'test/*.test.ts' ':(exclude)test/acceptance'` → 无输出，无任何现有测试文件被修改。

无。

### 8. Diff 范围审查

Worker 只改了 `src/follow.ts`（57 行新增，36 行删除）。对照 diff：
- 新增 `doSyncCycle` 函数（行 741-787），共 47 行，将原有同步逻辑抽取为独立函数
- 在 timeout 检查处新增 5 行调用 `doSyncCycle`（行 827-831）
- 在 decide 之后新增 3 行打印 `follow: action=`（行 867-868）
- 删除原位置的 35 行内联同步代码，替换为 1 行 `await doSyncCycle(root, stateJson, sendNotify)`

范围在 task 条目之内，无蔓延。

## 逐条验收

| 验收项 | 命令 | 实测结果 | 通过 |
|---|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0，全部通过 | ✅ |
| 类型检查零错误 | `npm run typecheck` | exit 0 | ✅ |
| 全部测试通过 | `npm test` | exit 0，90 文件 1610 个测试全过 | ✅ |
| 本批次验收测试通过 | `npm test -- test/acceptance/v046-b44` | exit 0，2 文件 5 个测试全过 | ✅ |

## 条目要求与额外禁止

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| 超时到了后、退出之前，不是 dryRun 时先做一次与每圈开头相同的同步 | 条目 1 / SPEC 16.30 | `src/follow.ts:826-831`：`if (!dryRun) { const timeoutState = loadFollowState(root); await doSyncCycle(root, timeoutState, sendNotify); }` | ✅ |
| 同步必须抽成一个函数在两处调用，不要抄一份 | 条目 1 | `src/follow.ts:746-787`：`doSyncCycle` 函数定义；`src/follow.ts:830`：timeout 路径调用；`src/follow.ts:841`：主循环调用 | ✅ |
| doSyncCycle 与原有逻辑语义一致 | 条目 1 | diff 中删除的 35 行与新函数体逐行对照一致，无增删逻辑 | ✅ |
| 超时同步后才打印 `follow: timeout reached` 并返回 0 | 条目 1 / SPEC 16.30 | `src/follow.ts:832-833`：doSyncCycle 之后才 `out('follow: timeout reached\n'); return 0;` | ✅ |
| 每一圈算出动作之后打印 `follow: action=<动作>` | 条目 2 / SPEC 16.30 | `src/follow.ts:868`：`out(\`follow: action=${action.action}\n\`)` | ✅ |
| dryRun 的输出不变 | 条目 2 / SPEC 16.30 | `src/follow.ts:861-864`：dryRun 在行 864 `return 0` 提前退出，新行 868 在其之后，dryRun 执行不到 | ✅ |
| test/follow.test.ts 的 33 条都照常通过 | 条目 2 | `npx vitest run test/follow.test.ts` → `Tests 33 passed (33)`；且无对该文件的修改 | ✅ |
| 不改动受保护路径 | 额外禁止 | `git diff --stat` 仅有 test/acceptance（R2 信封）和 src/follow.ts | ✅ |
| 不改动 src/follow.ts 之外的 src/ 文件 | 额外禁止 | `git diff --stat` 确认只有 `src/follow.ts` 被改 | ✅ |
| 不改变超时之前的任何行为、退避与通知次数 | 额外禁止 | 重构为纯提取函数，函数体与原代码一致，无逻辑变更 | ✅ |
| 超时同步里不起队列或跑开跑前检查 | 额外禁止 | `src/follow.ts:746-787`：`doSyncCycle` 只含 `syncWithRemote`（push/pull）+ 失败计数 + pending 通知，无 preflight 或队列操作 | ✅ |
| 不删除或跳过任何测试 | 额外禁止 | 无任何测试文件被修改 | ✅ |
| 不改写任何已有断言 | 额外禁止 | 无任何测试文件被修改 | ✅ |
| 不新增依赖 | 额外禁止 | package.json 无改动 | ✅ |

**行为要求实测**：

超时同步行为（S1/S2）和每圈打印 action 行为（S3）由验收测试覆盖：
- `npm test -- test/acceptance/v046-b44` → 5 个测试全过，包括 S1（远端有 report 提交）、S2（恰好 1 条"结束"通知）、S3（至少 2 行 `follow: action=wait`）、K1（返回 0、spawn 未调用、有 timeout reached）、K2（dryRun 恰好 1 行输出以 `action: run` 开头、远端无新提交、无 follow.json）

## 情形与验收测试

| 情形 | 对应的用例 | 断言的是不是情形写的结果 | 拿掉这个行为会不会失败 |
|---|---|---|---|
| S1 [新] 超时后远端有 `ops: report queue` 提交 | `new.test.ts` → `S1: returns 0 and remote main has a commit starting with ops: report queue` | ✅ 断言 `returnCode === 0` 且远端 log 有以 `ops: report queue` 开头的提交 | ✅ 去掉 timeout 前同步，report 不会被 push 到远端 |
| S2 [新] 恰好 1 条含「结束」的通知 | `new.test.ts` → `S2: notification function received exactly 1 text containing 结束` | ✅ 断言 `endNotifs.toHaveLength(1)`，过滤条件是 `includes('结束')` | ✅ 去掉 timeout 前同步，`pendingReport` 不会被处理，通知不会发出 |
| S3 [新] 至少 2 行 `follow: action=wait` | `new.test.ts` → `S3: output has at least 2 lines starting with follow: action=wait` | ✅ 断言 `waitLines.length >= 2`，过滤以 `follow: action=wait` 开头 | ✅ 去掉每圈打印 action 行，不会有 `follow: action=wait` 输出 |
| K1 [保持] 返回 0、spawn 未调用、有 timeout reached | `keep.test.ts` → `K1: returns 0, spawn never called, output has follow: timeout reached` | ✅ 断言三个条件均正确 | 保持场景——验证既有行为不变 |
| K2 [保持] dryRun 恰好 1 行以 `action: run` 开头 | `keep.test.ts` → `K2: returns 0, exactly one output line starting with action: run, no remote commits, no follow.json` | ✅ 断言 `output.toHaveLength(1)` 和 `startsWith('action: run')` | 保持场景——验证 dryRun 输出不变 |

测试缺口：无。所有情形的期望结果都有对应断言，且去掉新行为后断言会失败（新场景）或验证既有行为不变（保持场景）。

## 结论与理由

全部 4 条验收命令实跑通过。diff 范围严格在 `src/follow.ts` 内，只做了两件事：
1. 将同步逻辑提取为 `doSyncCycle` 函数，在 timeout 路径和主循环两处调用（不重复），语义与原代码一致。
2. 在 decide 之后、dryRun 早退之后插入 `follow: action=<action>` 打印。

无受保护文件被改、无依赖变化、无测试被修改或删除、无范围蔓延。所有条目要求和额外禁止逐项核对通过。提交已推送至 `origin/main`。

PASS。

```json
{
  "schema_version": 1,
  "batch_id": "v046-b44",
  "verdict": "PASS",
  "evidence": {
    "commits_actual": ["acfaf3a63d7a521b2df2ba4ee838676426a45044"],
    "verify_results": [
      { "cmd": "npm run lint", "exit_code": 0, "summary": "eslint + prettier all pass" },
      { "cmd": "npm run typecheck", "exit_code": 0, "summary": "tsc clean" },
      { "cmd": "npm test", "exit_code": 0, "summary": "90 files, 1610 tests passed" },
      { "cmd": "npm test -- test/acceptance/v046-b44", "exit_code": 0, "summary": "2 files, 5 tests passed" }
    ],
    "remote_has_head": true,
    "ci_conclusion": "unknown",
    "ci_run_url": "",
    "ci_branch_matched": null,
    "deps_diff": [],
    "spec_diff_lines": 0
  },
  "gaps": [],
  "reason": "CI 以 R2 取证为准。全部验收命令通过，条目要求与额外禁止逐项核对均满足，同步逻辑正确抽取为函数复用，无受保护文件改动，无依赖变化，无测试修改。"
}
```
