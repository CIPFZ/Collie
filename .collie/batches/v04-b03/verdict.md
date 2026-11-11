All checks are complete. Let me compile the final verdict.

# 批次 v04-b03 审核

## 取证过程

### 1. 提交事实

```
$ git log --format='%H' 3adc5be..89e557c
89e557c79448e5bd87e980b1d17955456897a626
5c549cce2cf5ea9b94ce108d764615d15ddf103c
```

两个提交：`5c549cc`（task.md 信封）和 `89e557c`（代码提交）。

```
$ git ls-remote origin
35c69ad2ef60304b082b3686989544f2dccc7f75  HEAD
35c69ad2ef60304b082b3686989544f2dccc7f75  refs/heads/main
```

```
$ git merge-base --is-ancestor 89e557c 35c69ad
yes, ancestor
```

`89e557c` 已在远端（是 `origin/main` 的祖先）。

### 2. 受保护路径

```
$ git diff --stat 3adc5be..89e557c -- SPEC.md CONSTRAINTS.md ROADMAP.md ROLES.md 'AGENT-*.md' docs/backlog.md docs/decisions docs/progress.md .collie/collie.toml
(无输出)
```

零行改动。

### 3. 依赖变化

```
$ git diff 3adc5be..89e557c -- package.json package-lock.json
(无输出)
```

无依赖改动。

### 4. 改动范围

只有 5 个文件改动：
- `.collie/batches/v04-b03/task.md`（信封，属于批次范围内）
- `src/cli.ts`（+71 行，添加 timeline 命令接线）
- `src/view.ts`（+311 行，添加 `projectTimeline` 等投影函数和格式化函数）
- `test/invariants.test.ts`（+5 行，添加 timeline 不变量）
- `test/timeline.test.ts`（+425 行，新增测试文件）

全部落在 task.md 的三个条目范围内，无范围蔓延。

## 逐条验收

| 验收项 | 命令 | 实测结果 | 通过 |
|---|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0，输出 "All matched files use Prettier code style!" | ✅ |
| 类型检查零错误 | `npm run typecheck` | exit 0，无输出 | ✅ |
| 全部测试通过 | `npm test` | exit 0，42 files passed, 858 tests passed | ✅ |
| timeline 专项测试通过 | `npm test -- test/timeline.test.ts` | exit 0，1 file passed, 11 tests passed | ✅ |
| 专项测试不少于 6 个 | `grep -cE "^\s+it\(" test/timeline.test.ts \| grep -qE "^([6-9]\|[1-9][0-9])$"` | exit 0（实际 11 个） | ✅ |
| timeline 命令已接线 | `npx tsx src/cli.ts timeline` | exit 0，输出 "no runs recorded" | ✅ |
| 按版本汇总可用 | `npx tsx src/cli.ts timeline --by version` | exit 0，输出 "no runs recorded" | ✅ |
| timeline --json 输出合法 JSON | `npx tsx src/cli.ts timeline --json \| node -e "..."` | exit 0 | ✅ |
| 不变量同步 | `grep -qE "timeline" test/invariants.test.ts` | exit 0 | ✅ |

全部 9 条验收通过。

## 条目要求与额外禁止

### 条目结构要求

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| `src/view.ts` 加 `projectTimeline` | 条目 1 | `src/view.ts:441` — `export function projectTimeline(runDataList: readonly RunData[]): TimelineNode[]` | ✅ |
| 按时间升序输出节点 | 条目 1 | `src/view.ts:532` — `nodes.sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0));` | ✅ |
| 批次首次开始节点 | 条目 1 | `src/view.ts:451-456` — `if (e.event === 'run.started' && !isQueue)` + `batchFirstSeen` dedup | ✅ |
| 每次运行结束节点 | 条目 1 | `src/view.ts:460-475` — `if (e.event === 'run.finished' && !isQueue)` | ✅ |
| `batch.status` 变化节点 | 条目 1 | `src/view.ts:478-488` — `if (e.event === 'batch.status')` | ✅ |
| 队列开始/停表/结束节点 | 条目 1 | `src/view.ts:492-528` — `queue_start`, `queue.paused`, `queue.finished` 三个分支 | ✅ |
| `collie timeline` 命令接线 | 条目 2 | `src/cli.ts:669-676` — `program.command('timeline')` with `.option` for `--since`, `--batch`, `--by`, `--json` | ✅ |
| `--by version` 按版本前缀汇总 | 条目 2 | `src/view.ts:549` — `export function projectVersionSummary(...)` | ✅ |
| 没有花费数据的运行不计入并注明个数 | 条目 2 | `src/view.ts:604-608` — `if (typeof cost === 'number') { ...totalCostUsd += cost; } else { entry.runsWithoutCost++; }` | ✅ |
| 输出末尾固定一行说明 ADR 与发布去 git log 看 | 条目 2 | `src/view.ts:718` — `const TIMELINE_FOOTER = 'ADR approvals and releases are in \`git log\`.';`, used at lines 755 and 778 | ✅ |
| `test/timeline.test.ts` 覆盖节点顺序 | 条目 3 | `test/timeline.test.ts:183` — `it('produces nodes in ascending time order', ...)` | ✅ |
| 覆盖 `--since` 过滤 | 条目 3 | `test/timeline.test.ts:219` — `it('filters by --since date', ...)` | ✅ |
| 覆盖 `--batch` 过滤 | 条目 3 | `test/timeline.test.ts:244` — `it('filters by --batch prefix', ...)` | ✅ |
| 覆盖按版本汇总 | 条目 3 | `test/timeline.test.ts:268` — `it('groups by version prefix and summarises correctly', ...)` | ✅ |
| 覆盖缺花费数据 | 条目 3 | `test/timeline.test.ts:310` — `it('notes runs without cost data in version summary', ...)` | ✅ |
| 覆盖空目录 | 条目 3 | `test/timeline.test.ts:177` — `it('returns empty array for an empty directory', ...)` | ✅ |
| `test/invariants.test.ts` 加 timeline 命令检查 | 条目 3 | `test/invariants.test.ts:287` — `it('src/cli.ts contains the timeline command (v04-b03)', ...)` | ✅ |

### 条目行为要求

| 要求 | 测试文件 | 命令与输出 | 满足 |
|---|---|---|---|
| 节点顺序、--since / --batch 过滤、版本汇总、缺花费、空目录 | `test/timeline.test.ts` | `npx vitest run test/timeline.test.ts` → Tests 11 passed | ✅ |
| 不变量检查 timeline 在 cli.ts 中 | `test/invariants.test.ts` | `npm test` → 858 tests passed (全量) | ✅ |

### 额外禁止

| 禁止项 | 出处 | 证据 | 满足 |
|---|---|---|---|
| 不改动受保护路径 | 额外禁止 | `git diff --stat` 对受保护路径输出为空 | ✅ |
| 不删除或跳过测试 | 额外禁止 | diff 无 `skip`/`todo`，且全量 858 测试通过 | ✅ |
| 不改注释/字面凑验收（铁律 26） | 额外禁止 | diff 中无此类改动 | ✅ |
| 不改动 `run.ts`/`gate.ts`/`arbiter.ts` | 额外禁止 | `git diff` 对这三个文件无输出 | ✅ |
| 不绕过 `src/view.ts` 直接读 journal | 额外禁止 | `cli.ts` 通过 `loadRuns` + `projectTimeline` + `projectVersionSummary`（均来自 `view.ts`） | ✅ |
| `timeline` 不写任何文件 | 额外禁止 | `view.ts` 无 `writeFileSync`/`appendFileSync`；`cli.ts` 的 `timeline` 函数只做 `deps.out()` | ✅ |
| 不新增依赖 | 额外禁止 | `package.json` 与 `package-lock.json` 无改动 | ✅ |

## 声称与实测的差异

无。

## 结论与理由

全部 9 条验收命令实跑通过。三个条目的结构要求和行为要求全部核实满足。额外禁止全部遵守。受保护路径零改动，无新增依赖。提交已推送到远端。
CI 以 R2 取证为准（本审核者无 GitHub 凭据）。

结论：**PASS**。

```json
{
  "schema_version": 1,
  "batch_id": "v04-b03",
  "verdict": "PASS",
  "evidence": {
    "commits_actual": [
      "5c549cce2cf5ea9b94ce108d764615d15ddf103c",
      "89e557c79448e5bd87e980b1d17955456897a626"
    ],
    "verify_results": [
      { "cmd": "npm run lint", "exit_code": 0, "summary": "eslint + prettier pass" },
      { "cmd": "npm run typecheck", "exit_code": 0, "summary": "tsc pass" },
      { "cmd": "npm test", "exit_code": 0, "summary": "42 files, 858 tests passed" },
      { "cmd": "npm test -- test/timeline.test.ts", "exit_code": 0, "summary": "1 file, 11 tests passed" },
      { "cmd": "grep -cE \"^\\s+it\\(\" test/timeline.test.ts | grep -qE \"^([6-9]|[1-9][0-9])$\"", "exit_code": 0, "summary": "11 it() blocks found (≥6)" },
      { "cmd": "npx tsx src/cli.ts timeline", "exit_code": 0, "summary": "no runs recorded" },
      { "cmd": "npx tsx src/cli.ts timeline --by version", "exit_code": 0, "summary": "no runs recorded" },
      { "cmd": "npx tsx src/cli.ts timeline --json | node -e \"JSON.parse(...)\"", "exit_code": 0, "summary": "valid JSON output" },
      { "cmd": "grep -qE \"timeline\" test/invariants.test.ts", "exit_code": 0, "summary": "timeline found in invariants" }
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
  "reason": "All 9 acceptance commands pass. Three items fully implemented: projectTimeline in view.ts, collie timeline CLI command with --since/--batch/--by version/--json, 11 tests in timeline.test.ts covering all required scenarios, invariant added. No protected file changes, no dependency changes, no scope creep. CI 以 R2 取证为准。"
}
```
