Now I have all the evidence. Let me compile the complete verdict.

# 批次 v045-b11 审核

## 取证过程

### 1. 提交事实

```
$ git log --oneline cf4e02bc..613b95cb
613b95c test: add sync failure and commit failure tests for follow (SPEC 14.15, v045-b11)
47dac07 cli: add syncFailures tracking and report commit failure handling (SPEC 14.15)
53e5dcf docs: issue v045-b11 task envelope
```

```
$ git rev-parse 613b95cb7684f5e1ddaf4362813b7cc8f7b32367
613b95cb7684f5e1ddaf4362813b7cc8f7b32367
```

```
$ git branch -r --contains 613b95cb7684f5e1ddaf4362813b7cc8f7b32367
  origin/HEAD -> origin/main
  origin/main
```

head SHA 已推送到 origin/main。

### 2. 受保护文件

```
$ git diff --stat cf4e02bc..613b95cb -- SPEC.md CONSTRAINTS.md ROADMAP.md ROLES.md 'AGENT-*.md' docs/backlog.md docs/decisions docs/progress.md .collie/collie.toml
(无输出)
```

无受保护文件被修改。spec_diff_lines = 0。

### 3. 依赖变化

```
$ git diff cf4e02bc..613b95cb -- package.json package-lock.json
(无输出)
```

无依赖变化。

### 4. 变更范围

变更文件：
- `.collie/batches/v045-b11/task.md` — 批次信封
- `src/follow.ts` — 实现 syncFailures 追踪和汇报提交失败处理
- `test/follow.test.ts` — 新增 3 个测试，改写 2 个允许的旧测试
- `test/invariants.test.ts` — 新增 syncFailures 不变量

无禁止文件（`src/handoff.ts`、`src/run.ts`、`src/view.ts`、`src/preflight.ts`、`templates/collie.toml`、`.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`）被改动。

### 5. 验收命令实跑

#### 命令 1: `npm run lint`
退出码 0。输出：`All matched files use Prettier code style!`

#### 命令 2: `npm run typecheck`
退出码 0。

#### 命令 3: `npm test`
退出码 0。`Test Files 58 passed (58)，Tests 1144 passed (1144)`

#### 命令 4: `npm test -- test/follow.test.ts`
退出码 0。`Test Files 1 passed (1)，Tests 33 passed (33)`

#### 命令 5: `grep -cE "^\s+it\(" test/follow.test.ts | grep -qE "^(3[3-9]|[4-9][0-9])$"`
退出码 0。实际计数 33。

#### 命令 6: `d=$(mktemp -d) && TMPDIR=$d npm test -- test/follow.test.ts && ! ls -d "$d"/collie-r2-* >/dev/null 2>&1`
退出码 0。无遗留目录。

#### 命令 7: `grep -vE "^\s*(//|\*|/\*)" src/follow.ts | grep -qE "syncFailures" && grep -qE "syncFailures" test/follow.test.ts`
退出码 0。

#### 命令 8: `grep -vE "^\s*(//|\*|/\*)" src/follow.ts | grep -qE "git pull 连续失败" && grep -vE "^\s*(//|\*|/\*)" test/follow.test.ts | grep -qE "git pull 连续失败"`
退出码 0。

#### 命令 9: `grep -vE "^\s*(//|\*|/\*)" src/follow.ts | grep -qE "汇报没能提交" && grep -vE "^\s*(//|\*|/\*)" test/follow.test.ts | grep -qE "汇报没能提交"`
退出码 0。

#### 命令 10: `grep -qE "syncFailures" test/invariants.test.ts`
退出码 0。

全部 10 条验收命令通过。

### 6. 行为测试实跑

```
$ npx vitest run test/follow.test.ts
Tests  33 passed (33)
```

```
$ npx vitest run test/follow.test.ts -t 'remote unreachable'
Tests  1 passed | 32 skipped (33)
```

```
$ npx vitest run test/follow.test.ts -t 'pull blocked by untracked'
Tests  1 passed | 32 skipped (33)
```

```
$ npx vitest run test/follow.test.ts -t 'report commit failure'
Tests  1 passed | 32 skipped (33)
```

```
$ npx vitest run test/follow.test.ts -t 'broken remote 4 cycles'
Tests  1 passed | 32 skipped (33)
```

```
$ npx vitest run test/follow.test.ts -t 'remote extra commit during queue'
Tests  1 passed | 32 skipped (33)
```

```
$ npx vitest run test/invariants.test.ts
Tests  68 passed (68)
```

## 逐条验收

| 验收项 | 命令 | 实测结果 | 通过 |
|---|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 | ✅ |
| 类型检查零错误 | `npm run typecheck` | exit 0 | ✅ |
| 全部测试通过 | `npm test` | exit 0, 1144 passed | ✅ |
| follow 专项测试通过 | `npm test -- test/follow.test.ts` | exit 0, 33 passed | ✅ |
| 专项测试不少于 33 个 | `grep -cE ...` | exit 0, 实际 33 个 | ✅ |
| 专项测试不留固定版本目录 | `d=$(mktemp -d) && ...` | exit 0 | ✅ |
| 同步失败有计数且有测试 | `grep ... syncFailures` | exit 0 | ✅ |
| 连续失败通知补回来了 | `grep ... git pull 连续失败` | exit 0 | ✅ |
| 汇报没提交成有通知且有测试 | `grep ... 汇报没能提交` | exit 0 | ✅ |
| 不变量同步 | `grep ... syncFailures test/invariants.test.ts` | exit 0 | ✅ |

## 条目要求与额外禁止

### 结构要求

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| `follow.json` 加 `syncFailures` 字段 | 条目 1 | `src/follow.ts:67`: `syncFailures?: number;` | ✅ |
| 连续 3 圈时通知一次，键 `pull`，文本 `[Collie] git pull 连续失败` | 条目 1 | `src/follow.ts:800-803`: `stateJson.syncFailures >= SYNC_FAILURE_THRESHOLD && !new Set(stateJson.notified).has('pull')` → `sendNotify('[Collie] git pull 连续失败')`, `notified = [..., 'pull']`; `src/follow.ts:118`: `SYNC_FAILURE_THRESHOLD = 3` | ✅ |
| 同步成功时 `syncFailures` 清零并去掉 `pull` | 条目 1 | `src/follow.ts:807-812`: `stateJson.syncFailures = 0; stateJson.notified = stateJson.notified.filter((k) => k !== 'pull')` | ✅ |
| `git fetch` 失败算同步失败 | 条目 1 | `src/follow.ts:622-625`: catch block 里 `syncFailed = true` | ✅ |
| 需要拉取而 `git pull --ff-only` 失败算同步失败 | 条目 1 | `src/follow.ts:659-661`: catch block 返回 `syncFailed: true` | ✅ |
| 推送失败通知不变 | 条目 1 | diff 中推送失败的通知代码（`src/follow.ts:674-676`）只加了 `syncFailed` 透传，逻辑未变 | ✅ |
| 提交后检查 `git status --porcelain -- <汇报文件>` | 条目 2 | `src/follow.ts:569`: `git(root, ['status', '--porcelain', '--', reportFile])` | ✅ |
| 不为空时不记 `pendingReport` | 条目 2 | `src/follow.ts:580-589`: `if (!reportCommitted)` 分支返回时无 `pendingReport` | ✅ |
| 通知键 `commit:<队列号>` | 条目 2 | `src/follow.ts:581`: `` const commitKey = `commit:${qRunId}` `` | ✅ |
| 通知文本含「汇报没能提交」、队列号、退出码 | 条目 2 | `src/follow.ts:583-584`: 文本模板包含 `qRunId`、`reason`、`runExitCode`、`汇报没能提交` | ✅ |
| 通知不含「到对话里说」 | 条目 2 | `src/follow.ts:584`: 通知文本不含「到对话里说」（全文搜索确认） | ✅ |
| 基准照样记为已处理 | 条目 2 | `src/follow.ts:589`: `return { handled: true, ... }` → 主循环 `src/follow.ts:899` 设 `handledBase` | ✅ |
| 队列不重跑 | 条目 2 | 返回 `handled: true` 意味着同一 baseSha 不会再次触发 run | ✅ |
| 提交成功时行为不变 | 条目 2 | `src/follow.ts:592-595`: 原有的 `pendingReportEntry` 逻辑完整保留 | ✅ |
| 新增测试 31（5+1+3 scenario）断言走了几圈 | 条目 3 | `test/follow.test.ts:1902`: `expect(sleepCount).toBe(PHASE1_CYCLES)`, `1949`: `expect(sleepCount).toBe(PHASE3_CYCLES)` | ✅ |
| 新增测试 32（pull blocked）断言走了几圈 | 条目 3 | `test/follow.test.ts:2001`: `expect(sleepCount).toBe(CYCLES)` | ✅ |
| 新增测试 33（commit failure）断言走了几圈 | 条目 3 | `test/follow.test.ts:2074`: `expect(sleepCount).toBe(CYCLES)` | ✅ |
| 旧用例 20 改回断言通知条数 | 条目 3 | `test/follow.test.ts:1211-1212`: `expect(pullNotifs.length).toBe(1)` | ✅ |
| 旧用例 22 补上圈数断言 | 条目 3 | `test/follow.test.ts:1393`: `expect(sleepCount).toBe(CYCLES)` | ✅ |
| `test/invariants.test.ts` 加「`src/follow.ts` 含 `syncFailures`」 | 条目 3 | `test/invariants.test.ts:523-525`: `expect(content).toContain('syncFailures')` | ✅ |
| 不改受保护路径 | 额外禁止 | `git diff --stat` 无输出 | ✅ |
| 不改 `templates/collie.toml`、`.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json` | 额外禁止 | `git diff --name-only` 确认无这些文件 | ✅ |
| 不删除或跳过测试 | 额外禁止 | diff 中无 `skip` 或删除 `it(` | ✅ |
| 不改写条目 3 点名之外的断言 | 额外禁止 | diff 中仅修改了 test 20 和 test 22（均在允许列表内），其余旧测试无变化 | ✅ |
| 不改注释或字面以通过验收 | 额外禁止（铁律 26） | 无此类变更 | ✅ |
| 测试不拉起真实 runner / npx / npm 子进程 | 额外禁止 | 新增测试均使用 `createFakeSpawn` 或自定义 fake spawn | ✅ |
| 不改 SPEC 14.12 的推送/rebase/「汇报上了远端才通知」 | 额外禁止 | diff 中推送/rebase 逻辑仅透传 `syncFailed`，行为未变; `pendingReport` 通知在 `src/follow.ts:816-819` 保持原样 | ✅ |
| 不改 `src/handoff.ts`、`src/run.ts`、`src/view.ts`、`src/preflight.ts` | 额外禁止 | `git diff --name-only` 确认无这些文件 | ✅ |
| 无新增依赖 | 额外禁止 | `package.json` 无变化 | ✅ |

### 行为要求

| 要求 | 出处 | 证据 | 满足 |
|---|---|---|---|
| 远端不可达 5 圈：通知 1 条，出现在第 3 圈；恢复后 syncFailures=0；再不可达 3 圈：再通知 1 条，共 2 条 | 条目 1 加粗 | `npx vitest run test/follow.test.ts -t 'remote unreachable'` → `Tests 1 passed`。但见下文分析：通知实际出现在第 4 圈而非第 3 圈 | ⚠️ |
| 本地落后而 pull 被未跟踪文件挡住 3 圈：通知 1 条 | 条目 1 加粗 | `npx vitest run test/follow.test.ts -t 'pull blocked by untracked'` → `Tests 1 passed` | ✅ |
| 汇报提交失败走 3 圈：run --continue 只起 1 次，通知 1 条含「汇报没能提交」，不含「到对话里说」 | 条目 2/3 | `npx vitest run test/follow.test.ts -t 'report commit failure'` → `Tests 1 passed` | ✅ |
| 旧用例 20 断言 pull 通知条数 | 条目 3 | `npx vitest run test/follow.test.ts -t 'broken remote 4 cycles'` → `Tests 1 passed` | ✅ |
| 旧用例 22 补圈数断言 | 条目 3 | `npx vitest run test/follow.test.ts -t 'remote extra commit during queue'` → `Tests 1 passed` | ✅ |

### 不变量数值变化

无。`test/invariants.test.ts` 仅新增了一个 `expect(content).toContain('syncFailures')` 断言，未修改任何现有数值。

### 被改写或删去的断言

**测试 20（`// 20. SPEC 14.9 item 2`）：**
- 用例重命名：`'broken remote 4 cycles → no crash, no queue-end notification'` → `'broken remote 4 cycles → 1 "git pull 连续失败" notification at cycle 3, no queue-end'`
- 原有断言 `expect(endNotifs.length).toBe(0)` **未改**
- 新增断言 `expect(pullNotifs.length).toBe(1)`
- 无断言被删除或修改

**测试 22（队列期间远端多一个提交）：**
- 用例重命名：追加 `', 4 cycles'`
- 原有 4 条 `expect` 断言全部保留（`remoteLog` 含 `'ops: report queue'`、含 `'extra commit'`、`localHead === remoteHead`、`divergedNotifs.length === 0`）
- 新增断言 `expect(sleepCount).toBe(CYCLES)`
- 结构改写：从两次 `once: true` 调用改为一次多圈调用，extra commit 在 sleep 回调中推送。行为等价，无断言丢失
- 无断言被删除或修改

## 声称与实测的差异

### 关键问题：`syncFailures` 在 `run` case 的 `updated` 对象中丢失

**代码分析：** `src/follow.ts:898-904` 的 `updated` FollowJson 对象没有包含 `syncFailures` 字段：

```typescript
const updated: FollowJson = {
  handledBase: result.handled ? action.baseSha : stateJson.handledBase,
  notified: [...stateJson.notified, ...result.newNotified],
  retry: result.retryState,
  retryBase: result.retryState !== undefined ? action.baseSha : stateJson.retryBase,
  pendingReport: result.pendingReport ?? stateJson.pendingReport,
};
saveFollowState(root, updated);
```

在同一圈的前半段（`src/follow.ts:795-805`），`stateJson.syncFailures` 被正确设置并保存。但当 `run` action 执行后，这个新建的 `updated` 对象覆写了 `follow.json`，丢掉了 `syncFailures`。

**后果：** 在远端不可达且有队列待处理的场景中（test 20 和 test 31 phase 1），第 1 圈执行了 run action → `syncFailures` 被丢弃 → 第 2 圈从 0 重新计数 → 通知出现在第 4 圈而非 SPEC 要求的第 3 圈。

**测试为什么还通过：** test 31 检查的是 5 圈内的通知总数（1 条），不检查出现在哪一圈。test 31 的注释写着 `// appeared at cycle 3`，但实际出现在 cycle 4。test 32（pull blocked 场景）和 test 31 phase 3 不受影响，因为它们的 `decide` 返回 `wait`（base 已处理），不走 `run` case，不覆写状态。

**SPEC 原文：** 14.15 第 1 条："连续 3 圈时通知一次"。task.md 和 SPEC 都明确写 "出现在第 3 圈"。实现在特定条件下延迟到第 4 圈。

**修复方式：** 在 `src/follow.ts:898-904` 的 `updated` 对象中加一行 `syncFailures: stateJson.syncFailures`。

## 结论与理由

**FIX。** 全部 10 条验收命令通过，全部测试通过（1144/1144），受保护文件未改，无新增依赖，改写的旧用例在允许范围内。

但存在一个实现缺陷：`run` action 保存状态时丢弃 `syncFailures`，导致「连续 3 圈通知」在有队列执行的场景中变为第 4 圈才通知，不符合 SPEC 14.15 "连续 3 圈时通知一次" 和 task "出现在第 3 圈" 的要求。测试只检查总数不检查时机，因此未能捕获此 bug。

此缺口可在同批次内修复：在 `src/follow.ts` 898-904 行的 `updated` 对象中加入 `syncFailures: stateJson.syncFailures`。

```json
{
  "schema_version": 1,
  "batch_id": "v045-b11",
  "verdict": "FIX",
  "evidence": {
    "commits_actual": [
      "53e5dcfa07e2e36d6fc7e12fe13cb54aaa1303a5",
      "47dac0748998c4804c87f555a36e5dd561fa08ee",
      "613b95cb7684f5e1ddaf4362813b7cc8f7b32367"
    ],
    "verify_results": [
      { "cmd": "npm run lint", "exit_code": 0, "summary": "lint + prettier pass" },
      { "cmd": "npm run typecheck", "exit_code": 0, "summary": "tsc pass" },
      { "cmd": "npm test", "exit_code": 0, "summary": "58 files, 1144 tests passed" },
      { "cmd": "npm test -- test/follow.test.ts", "exit_code": 0, "summary": "33 tests passed" },
      { "cmd": "grep -cE ... | grep -qE ...", "exit_code": 0, "summary": "33 it() blocks" },
      { "cmd": "TMPDIR=... npm test -- test/follow.test.ts && ! ls ...", "exit_code": 0, "summary": "no leftover dirs" },
      { "cmd": "grep ... syncFailures ...", "exit_code": 0, "summary": "syncFailures in src and test" },
      { "cmd": "grep ... git pull 连续失败 ...", "exit_code": 0, "summary": "pull notification in src and test" },
      { "cmd": "grep ... 汇报没能提交 ...", "exit_code": 0, "summary": "commit failure notification in src and test" },
      { "cmd": "grep ... syncFailures test/invariants.test.ts", "exit_code": 0, "summary": "invariant present" }
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
    "src/follow.ts:898-904 的 updated FollowJson 对象缺少 syncFailures 字段。run action 保存状态时覆写 follow.json，丢弃了同一圈内 sync 阶段设置的 syncFailures 计数。导致「远端不可达 + 有队列待处理」场景中通知延迟 1 圈（第 4 圈而非 SPEC 要求的第 3 圈）。修复：在 updated 对象中加 syncFailures: stateJson.syncFailures。"
  ],
  "reason": "全部验收命令与测试通过，但代码分析发现 run action 的状态保存丢弃 syncFailures 计数，导致同步失败通知在有队列执行时延迟 1 圈，不符合 SPEC 14.15「连续 3 圈时通知一次」和 task「出现在第 3 圈」。CI 以 R2 取证为准。"
}
```
