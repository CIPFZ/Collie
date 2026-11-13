I now have all the evidence needed. Let me compose the verdict.

---

# 批次 v04-b12 审核

## 取证过程

### 1. 受保护文件检查

```
$ git diff --stat 8bcdc0ad..b76f7358 -- SPEC.md CONSTRAINTS.md ROADMAP.md ROLES.md 'AGENT-*.md' docs/backlog.md docs/decisions docs/progress.md .collie/collie.toml
(无输出)
```
结论：无受保护文件被改动。

### 2. 依赖检查

```
$ git diff 8bcdc0ad..b76f7358 -- package.json package-lock.json
(无输出)
```
结论：无依赖变更。

### 3. src/ 文件检查

```
$ git diff --stat 8bcdc0ad..b76f7358 -- src/
(无输出)
```
结论：未改动 `src/` 下任何文件，符合额外禁止。

### 4. 提交事实

```
$ git log --format='%H %s' 8bcdc0ad..b76f7358
b76f7358f92959d867104813b739e8970592ec3b test: coupled fake clock for liveness tests (SPEC 13.19)
545806aeb1f3f56a71d6da1e942a186a18cc621e docs: issue v04-b12 task envelope
```

远端推送：head commit `b76f7358` 是远端 main（`3a740d60`）的祖先，已被推送。

### 5. 验收命令实跑

**5.1 `npm run lint`** → exit 0
```
All matched files use Prettier code style!
```

**5.2 `npm run typecheck`** → exit 0
```
(无错误输出)
```

**5.3 `npm test`** → exit 0
```
Test Files  48 passed (48)
     Tests  938 passed (938)
  Duration  15.19s
```

**5.4 三遍场景连跑** → exit 0
```
Run 1: Test Files 2 passed (2), Tests 10 passed (10)
Run 2: Test Files 2 passed (2), Tests 10 passed (10)
Run 3: Test Files 2 passed (2), Tests 10 passed (10)
```

**5.5 `! grep -qE "\+= stepMs" test/scenario-g.test.ts test/scenario-n.test.ts`** → exit 0

**5.6 `grep -qE "worker\.stalled" test/scenario-g.test.ts`** → exit 0

**5.7 `grep -qE "stepMs" test/invariants.test.ts`** → exit 0

### 6. 单独实跑关键测试文件

**scenario-g.test.ts**:
```
$ npx vitest run test/scenario-g.test.ts
Test Files  1 passed (1)
     Tests  4 passed (4)
```

**scenario-n.test.ts**:
```
$ npx vitest run test/scenario-n.test.ts
Test Files  1 passed (1)
     Tests  6 passed (6)
```

**invariants.test.ts**:
```
$ npx vitest run test/invariants.test.ts
Test Files  1 passed (1)
     Tests  50 passed (50)
```

## 逐条验收

| 验收项 | 命令 | 实测结果 | 通过 |
|---|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 | ✅ |
| 类型检查零错误 | `npm run typecheck` | exit 0 | ✅ |
| 全部测试通过 | `npm test` | exit 0, 48 files, 938 tests passed | ✅ |
| 两个场景连跑三遍都通过 | `for i in 1 2 3; do npm test -- test/scenario-g.test.ts test/scenario-n.test.ts \|\| exit 1; done` | exit 0, 3/3 runs all 10 tests passed | ✅ |
| 自增时钟已删掉 | `! grep -qE "\+= stepMs" test/scenario-g.test.ts test/scenario-n.test.ts` | exit 0 | ✅ |
| 慢开局用例断言没有判成卡死 | `grep -qE "worker\.stalled" test/scenario-g.test.ts` | exit 0 | ✅ |
| 不变量同步 | `grep -qE "stepMs" test/invariants.test.ts` | exit 0 | ✅ |

## 条目要求与额外禁止

### 条目 1：假时钟改为冻结前不走、冻结后由 setTimer 推进

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| `now()` 冻结前返回值不变 | task.md 条目 1 | `test/support/fake-clock.ts:22` — `now: () => t`，t 初始为 0 且 now() 中不自增 | ✅ |
| 冻结后由 setTimer 按传入间隔推进 | task.md 条目 1 | `test/support/fake-clock.ts:23-26` — `if (isFrozen()) { t += ms; }` | ✅ |
| 删掉每调用一次 now() 就自增的写法 | task.md 条目 1 | `grep -qE "\+= stepMs" test/scenario-g.test.ts test/scenario-n.test.ts` 无匹配；旧 `fakeClock` 函数在 diff 中已删 | ✅ |
| 共用辅助函数抽到 test/support/ 下 | task.md 条目 1 | `test/support/fake-clock.ts` 新建，85 行；两文件均导入：`test/scenario-g.test.ts:12`、`test/scenario-n.test.ts:12` | ✅ |
| scenario-g.test.ts 使用新时钟 | task.md 条目 1 | `test/scenario-g.test.ts:133` — `fakeLivenessClock(() => fp.isFrozen())` | ✅ |
| scenario-n.test.ts 使用新时钟 | task.md 条目 1 | `test/scenario-n.test.ts:254` — `fakeLivenessClock(() => fp.isFrozen())` | ✅ |
| 旧 fakeClock、fakeSetTimer、旧 controllableFingerprint、旧 instantDelay 从两文件中删除 | task.md 条目 1 | diff 确认：scenario-g 删除 78 行本地辅助函数（旧第 29-106 行）；scenario-n 删除 52 行本地辅助函数（旧第 14-65 行） | ✅ |

### 条目 2：慢开局用例

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| 在冻结指纹前用 setImmediate 让出 40 万次 | task.md 条目 2 | `test/scenario-g.test.ts:40-52` — `yieldLoop` 使用 `setImmediate`；`test/scenario-g.test.ts:195` — `preIdleYields: 400_000` | ✅ |
| 断言 journal 里有 worker.idling | task.md 条目 2 | `test/scenario-g.test.ts:215` — `expect(types).toContain('worker.idling')` | ✅ |
| 断言 journal 里没有 worker.stalled | task.md 条目 2 | `test/scenario-g.test.ts:216` — `expect(types).not.toContain('worker.stalled')` | ✅ |
| 行为验证：慢开局测试实际通过 | task.md 条目 2 | `npx vitest run test/scenario-g.test.ts` → Tests 4 passed (4)，包含 "slow startup" 用例 | ✅ |

### 条目 3：不变量测试

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| invariants.test.ts 加入「不含 += stepMs」检查 | task.md 条目 3 | `test/invariants.test.ts:357-364` — 检查 scenario-g 和 scenario-n 不含 `+= stepMs` | ✅ |
| 不变量测试实际通过 | task.md 条目 3 | `npx vitest run test/invariants.test.ts` → Tests 50 passed (50) | ✅ |

### 额外禁止

| 禁止项 | 出处 | 证据 | 满足 |
|---|---|---|---|
| 改动受保护路径 | task.md 额外禁止 | `git diff --stat` 对受保护路径无输出 | ✅ |
| 改动 src/ 下任何文件 | task.md 额外禁止 | `git diff --stat -- src/` 无输出 | ✅ |
| 删除或跳过测试 | task.md 额外禁止 | grep `.skip|.todo|.only` 在两文件中无匹配；测试数从上次无减少 | ✅ |
| 改注释或字面凑验收命令通过 | task.md 额外禁止 | diff 中新增内容均为功能性代码和合理注释 | ✅ |
| 新增依赖 | task.md 额外禁止 | package.json/lock 无变化 | ✅ |

## 声称与实测的差异

无。

## 结论与理由

全部 7 项验收命令均实跑通过。3 个条目全部满足：
1. 假时钟已从自增改为冻结前不走、冻结后由 setTimer 推进，旧写法已删除，共用辅助抽取到 `test/support/fake-clock.ts`
2. 慢开局用例（400k setImmediate 让出）正确断言 `worker.idling` 且 `!worker.stalled`，测试实际通过
3. 不变量测试已添加 `+= stepMs` 检查，实际通过

无受保护文件修改、无依赖变更、无 src/ 变更、无范围蔓延。提交已推送到远端。

结论：**PASS**

```json
{
  "schema_version": 1,
  "batch_id": "v04-b12",
  "verdict": "PASS",
  "evidence": {
    "commits_actual": [
      "545806aeb1f3f56a71d6da1e942a186a18cc621e",
      "b76f7358f92959d867104813b739e8970592ec3b"
    ],
    "verify_results": [
      { "cmd": "npm run lint", "exit_code": 0, "summary": "eslint + prettier pass" },
      { "cmd": "npm run typecheck", "exit_code": 0, "summary": "tsc clean" },
      { "cmd": "npm test", "exit_code": 0, "summary": "48 files, 938 tests passed" },
      { "cmd": "for i in 1 2 3; do npm test -- test/scenario-g.test.ts test/scenario-n.test.ts || exit 1; done", "exit_code": 0, "summary": "3/3 runs, 10 tests each, all passed" },
      { "cmd": "! grep -qE \"\\+= stepMs\" test/scenario-g.test.ts test/scenario-n.test.ts", "exit_code": 0, "summary": "no matches found" },
      { "cmd": "grep -qE \"worker\\.stalled\" test/scenario-g.test.ts", "exit_code": 0, "summary": "match found" },
      { "cmd": "grep -qE \"stepMs\" test/invariants.test.ts", "exit_code": 0, "summary": "match found" }
    ],
    "remote_has_head": true,
    "ci_conclusion": "unknown",
    "ci_run_url": "",
    "ci_branch_matched": null,
    "deps_diff": [],
    "spec_diff_lines": 0
  },
  "claim_mismatches": [],
  "gaps": [],
  "reason": "All 7 acceptance commands pass. Fake clock refactored to coupled model (frozen before freeze, setTimer-driven after). Slow startup test (400k yields) correctly asserts idling not stalled. Invariant test added. No protected files, no src/ changes, no new deps. CI以R2取证为准。"
}
```
