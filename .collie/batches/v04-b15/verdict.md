Good. Now I have all evidence gathered. Let me produce the verdict.

---

# 批次 v04-b15 审核

## 取证过程

### 1. 提交确认

```
git log --oneline 6b222063..dc366ea8
dc366ea cli: why conclusion line rule/reason fallback from verdict.downgraded (SPEC 13.20)
12bc09e docs: issue v04-b15 task envelope
```

两个提交，SHA 分别为：
- `12bc09edf583a99f8d6c5f653d81dc9f6900d363`（task envelope）
- `dc366ea89b8a6a9b1efe054aedd9cb9e489d2cba`（代码提交）

`git rev-parse` 两个均可解析。远端 main 位于 `0917cdceacb57f512bd68de6943d3ce76f784a3b`，`git merge-base --is-ancestor dc366ea 0917cdce` 退出码 0——已推送。

### 2. 受保护文件

```
git diff --stat 6b222063..dc366ea8 -- SPEC.md CONSTRAINTS.md ROADMAP.md ROLES.md 'AGENT-*.md' docs/backlog.md docs/decisions docs/progress.md .collie/collie.toml
```
输出为空。无受保护文件被修改。`spec_diff_lines = 0`。

### 3. 依赖变化

```
git diff 6b222063..dc366ea8 -- package.json package-lock.json
```
输出为空。无依赖变化。

### 4. 变更文件清单

```
.collie/batches/v04-b15/task.md
src/view.ts
test/invariants.test.ts
test/why.test.ts
```

全部在 task.md 条目范围内，无范围蔓延。

### 5. 禁止改动的文件

```
git diff --stat 6b222063..dc366ea8 -- src/run.ts src/gate.ts src/arbiter.ts
```
输出为空。未改动 run.ts、gate.ts、arbiter.ts。`show`/`status`/`timeline`/`watch` 输出函数无变动（grep 确认）。

### 6. 验收命令实跑

#### 6.1 `npm run lint` → 退出码 0
```
> eslint . && prettier --check .
Checking formatting...
All matched files use Prettier code style!
```

#### 6.2 `npm run typecheck` → 退出码 0
```
> tsc -p tsconfig.json
```

#### 6.3 `npm test` → 退出码 0
```
 Test Files  50 passed (50)
      Tests  961 passed (961)
   Duration  15.62s
```

#### 6.4 `npm test -- test/why.test.ts` → 退出码 0
```
 Test Files  1 passed (1)
      Tests  19 passed (19)
   Duration  1.62s
```

#### 6.5 缺规则号的写法进代码与测试
```
grep -vE "^\s*(//|\*|/\*)" src/view.ts | grep -qE "规则 —" && grep -qE "规则 —" test/why.test.ts
```
退出码 0。

#### 6.6 测试覆盖从降级事件推出规则 9
```
grep -qE "规则 9" test/why.test.ts
```
退出码 0。

#### 6.7 不变量同步
```
grep -qE "规则 —" test/invariants.test.ts
```
退出码 0。

## 逐条验收

| 验收项 | 命令 | 实测结果 | 通过 |
|---|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 | ✅ |
| 类型检查零错误 | `npm run typecheck` | exit 0 | ✅ |
| 全部测试通过 | `npm test` | 50 files, 961 tests passed, exit 0 | ✅ |
| why 专项测试通过 | `npm test -- test/why.test.ts` | 1 file, 19 tests passed, exit 0 | ✅ |
| 缺规则号的写法进代码与测试 | `grep -vE ... src/view.ts \| grep -qE "规则 —" && grep -qE "规则 —" test/why.test.ts` | exit 0 | ✅ |
| 测试覆盖从降级事件推出规则 9 | `grep -qE "规则 9" test/why.test.ts` | exit 0 | ✅ |
| 不变量同步 | `grep -qE "规则 —" test/invariants.test.ts` | exit 0 | ✅ |

## 条目要求与额外禁止

### 结构要求

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| 规则号依次取 `run.finished.rule` → 最后一条 `verdict.downgraded.rule` → null | task 条目 1 | `src/view.ts:1032-1035`：`const finishedRule = finished !== undefined ? asNumber(finished.rule) : null; const rule = finishedRule ?? (downgradeEvent !== undefined ? asNumber(downgradeEvent.rule) : null);` | ✅ |
| 原因依次取 `run.finished.reason` → 同一条 `verdict.downgraded.reason` → null | task 条目 1 | `src/view.ts:1033-1037`：`const finishedReason = finished !== undefined ? asString(finished.reason) : null; const reason = finishedReason ?? (downgradeEvent !== undefined ? asString(downgradeEvent.reason) : null);` | ✅ |
| 都没有显示 `规则 —` | task 条目 1 | `src/view.ts:1168`：`: '规则 —';`（非注释行 `grep -vE` 确认） | ✅ |
| 结论行不得以逗号结尾 | task 条目 1 | `src/view.ts:1170`：`return \`结论：${a.verdict}，${ruleDisplay}${reasonPart}\`` — 当 rule 为 null 时 ruleDisplay 是 `'规则 —'`，reasonPart 是 `''`，结果为 `结论：FIX，规则 —`，不以逗号结尾 | ✅ |
| `--json` 的 `rule`/`reason` 按同样的顺序取值 | task 条目 1 | `src/view.ts:1034-1037`：rule/reason 计算在 `projectWhyAttempt` 返回对象中（行 1057-1058），JSON 序列化直接取这些值 | ✅ |
| 取最后一条 `verdict.downgraded`（不是第一条） | task 条目 1 | `src/view.ts:995`：`const downgradeEvent = findLastEvent(events, 'verdict.downgraded');`（`findLastEvent` 定义在行 128-133，从末尾向前搜索） | ✅ |
| 不改动受保护路径 | 额外禁止 | `git diff --stat` 保护文件输出为空 | ✅ |
| 不删除或跳过任何测试 | 额外禁止 | diff 中无 `.skip`、无测试删除（仅新增 177 行测试代码） | ✅ |
| 不为验收通过而改注释或字面（铁律 26） | 额外禁止 | diff 中注释修改仅为描述性说明（`// 7. Downgraded / escalated`→加 `(SPEC 13.20:...)`，非为凑验收） | ✅ |
| 不改动 `run.ts`、`gate.ts`、`arbiter.ts`、规则 1~10 | 额外禁止 | `git diff --stat` 确认这些文件无变动 | ✅ |
| 不改动 show/status/timeline/watch 输出 | 额外禁止 | `git diff` grep 确认无 `formatShow`/`formatStatus`/`formatTimeline`/`formatWatch` 变动 | ✅ |
| `why` 不写任何文件 | 额外禁止 | diff 中无文件写入逻辑新增 | ✅ |
| 新增依赖 | 额外禁止 | package.json / package-lock.json 无变更 | ✅ |

### 行为要求

| 要求 | 出处 | 证据（命令 + 输出） | 满足 |
|---|---|---|---|
| 没有 `rule` 但有规则 9 的 `verdict.downgraded` → 结论行含 `规则 9` | task 条目 2 | `npx vitest run test/why.test.ts` → `Tests 19 passed`（测试 `'no rule on run.finished but verdict.downgraded has rule 9 → conclusion shows 规则 9'` 包含 `expect(text).toContain('规则 9')` 和 `expect(a.rule).toBe(9)`） | ✅ |
| 两者都没有 → 含 `规则 —` 且不以逗号结尾 | task 条目 2 | `npx vitest run test/why.test.ts` → `Tests 19 passed`（测试 `'neither run.finished nor verdict.downgraded has rule → 规则 —, no trailing comma'` 包含 `expect(text).toContain('规则 —')` 和 `expect(text).not.toMatch(/结论：FIX，$/m)`） | ✅ |
| 带 `rule` 的运行输出不变 | task 条目 2 | `npx vitest run test/why.test.ts` → `Tests 19 passed`（测试 `'run.finished with rule present → output unchanged'` 包含 `expect(a.rule).toBe(10)` 和 `expect(text).toContain('规则 10')`） | ✅ |
| `--json` 的取值 | task 条目 2 | `npx vitest run test/why.test.ts` → `Tests 19 passed`（测试 `'--json rule/reason fallback from verdict.downgraded'` 验证 JSON rule=9/reason='evidence missing'，测试 `'--json rule/reason are null when neither source has them'` 验证 JSON rule=null/reason=null） | ✅ |
| `test/invariants.test.ts` 加「`src/view.ts` 含 `规则 —`」 | task 条目 3 | `npx vitest run test/invariants.test.ts` → `Tests 53 passed`（测试 `'src/view.ts contains 规则 — for missing rule fallback (v04-b15)'`） | ✅ |

### 事件字段合规性（SPEC 3.6）

测试夹具中使用的事件：
- `run.started`、`worker.started`、`worker.finished`、`run.finished`：基础事件类型 ✅
- `verdict.downgraded`：字段 `from`/`to`/`rule`/`reason` — 与 SPEC 3.6 定义完全一致 ✅

## 声称与实测的差异

无。

## 结论与理由

全部 7 条验收命令实跑通过。代码逻辑正确实现了 SPEC 13.20 的 rule/reason 降级取值顺序（`run.finished` → 最后一条 `verdict.downgraded` → null/`规则 —`）。结论行不以逗号结尾。测试覆盖了全部要求的场景（降级事件推规则 9、两者都没有、已有 rule 的输出不变、JSON 取值）。不变量测试已同步。无受保护文件修改，无依赖变化，无范围蔓延，无额外禁止违反。提交已推送至远端。

结论：**PASS**。

```json
{
  "schema_version": 1,
  "batch_id": "v04-b15",
  "verdict": "PASS",
  "evidence": {
    "commits_actual": [
      "12bc09edf583a99f8d6c5f653d81dc9f6900d363",
      "dc366ea89b8a6a9b1efe054aedd9cb9e489d2cba"
    ],
    "verify_results": [
      { "cmd": "npm run lint", "exit_code": 0, "summary": "eslint + prettier pass" },
      { "cmd": "npm run typecheck", "exit_code": 0, "summary": "tsc pass" },
      { "cmd": "npm test", "exit_code": 0, "summary": "50 files, 961 tests passed" },
      { "cmd": "npm test -- test/why.test.ts", "exit_code": 0, "summary": "1 file, 19 tests passed" },
      { "cmd": "grep -vE \"^\\s*(//|\\*|/\\*)\" src/view.ts | grep -qE \"规则 —\" && grep -qE \"规则 —\" test/why.test.ts", "exit_code": 0, "summary": "规则 — found in non-comment code and tests" },
      { "cmd": "grep -qE \"规则 9\" test/why.test.ts", "exit_code": 0, "summary": "规则 9 found in test" },
      { "cmd": "grep -qE \"规则 —\" test/invariants.test.ts", "exit_code": 0, "summary": "规则 — found in invariants test" }
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
  "reason": "全部 7 条验收命令通过；代码正确实现 SPEC 13.20 的 rule/reason 降级取值（run.finished → last verdict.downgraded → null/规则 —）；结论行不以逗号结尾；测试覆盖降级事件推规则 9、两者都没有、已有 rule 不变、JSON 取值四个场景；不变量已同步；无受保护文件修改、无依赖变化、无范围蔓延。CI 以 R2 取证为准。"
}
```
