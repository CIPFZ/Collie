Good. Here is my complete verdict:

---

# 批次 v04-b02 审核

## 取证过程

### 1. 提交事实

本批次 diff 范围 `7f9158beee07d5b31236a55a48c46bdc4260767c..4278c4b2927b077c594f68115dba0705d79d5a97` 包含 6 个提交：

| SHA | 前缀 | 类型 |
|---|---|---|
| `673b28cd830d7f17e911e98f0ba9f03a5c9a8c67` | `docs: issue` | R2 task 签发 (attempt 1) |
| `23da11e85b1d10445c48e81ee3b8afc1d3f06bfc` | `cli:` | Worker 代码 (attempt 1) |
| `b5170fcefb5a72f6da1d6d2ad395e9eaff945dc5` | `report(collie):` | R2 报告信封 |
| `25b4c575389d8245c2d9bc68dad12e4829298df2` | `progress:` | R2 进度 (FIX 记录) |
| `342859bb0f577b527c5937d0cd6ae290ac3d34b7` | `docs: issue` | R2 task 签发 (attempt 2) |
| `4278c4b2927b077c594f68115dba0705d79d5a97` | `cli:` | Worker 代码 (attempt 2) |

Worker 代码提交为 `23da11e` 和 `4278c4b`。`git merge-base --is-ancestor 4278c4b origin/main` 退出码 0，已推送。

### 2. 受保护路径检查

```
git diff --stat 7f9158b..4278c4b -- SPEC.md CONSTRAINTS.md ROADMAP.md ROLES.md 'AGENT-*.md' docs/backlog.md docs/decisions docs/progress.md .collie/collie.toml
```
结果：`docs/progress.md | 23 ++`

23 行全部来自 R2 的 `25b4c57 progress: v04-b02 FIX` 提交，属 R2 职责范围（铁律 3）。两个 worker 提交均不触碰任何受保护路径（逐提交验证，输出为空）。

### 3. 依赖变化

`git diff 7f9158b..4278c4b -- package.json package-lock.json` — 无输出，无依赖变化。

### 4. 验收命令实跑

逐条原样实跑。

## 逐条验收

| 验收项 | 命令 | 实测结果 | 通过 |
|---|---|---|---|
| 1. 代码规范零错误 | `npm run lint` | exit 0, "All matched files use Prettier code style!" | ✅ |
| 2. 类型检查零错误 | `npm run typecheck` | exit 0, `tsc -p tsconfig.json` 无输出 | ✅ |
| 3. 全部测试通过 | `npm test` | exit 0, 41 files, 846 passed | ✅ |
| 4. 投影专项测试通过 | `npm test -- test/view.test.ts` | exit 0, 15 passed | ✅ |
| 5. 专项测试不少于 8 个 | `grep -cE "^\s+it\(" test/view.test.ts \| grep -qE "^([8-9]\|[1-9][0-9])$"` | exit 0, count=15 | ✅ |
| 6. 投影模块不依赖运行逻辑 | `test -f src/view.ts && ! grep -qE "from '\./(run\|runner\|roles)[./]" src/view.ts` | exit 0 | ✅ |
| 7. 坏 journal 有处理且有测试 | `grep -qE "unreadable" src/view.ts && grep -qE "unreadable" test/view.test.ts` | exit 0 | ✅ |
| 8. status 命令已接线 | `npx tsx src/cli.ts status` | exit 0, 输出 "no runs recorded" | ✅ |
| 9. status --json 输出合法 JSON | `npx tsx src/cli.ts status --json \| node -e "JSON.parse(...)"` | exit 0 | ✅ |
| 10. 不变量同步 | `grep -qE "view\.ts" test/invariants.test.ts` | exit 0 | ✅ |
| 11. 钩子超时已配置（不看注释行） | `grep -vE "^\s*(//\|\*\|/\*)" vitest.config.ts \| grep -qE "hookTimeout"` | exit 0 | ✅ |

## 条目要求与额外禁止

### 条目 1：`src/view.ts` 读取层 `loadRuns(root)`

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| 扫全部运行目录并重放 | 条目 1 | `src/view.ts:97-118`，`readdirSync(runsDir)` + `journal.replay(runId)` | ✅ |
| 单个运行的 journal 校验失败不抛出 | 条目 1 | `src/view.ts:110-116`，try/catch 包裹 `journal.replay`，catch 返回 `{ status: 'unreadable', reason }` | ✅ |
| 记为 `unreadable` 带原因 | 条目 1 | `src/view.ts:115`，`reason` 取 `error.message` 或 `String(error)` | ✅ |

行为验证（bad journal 不影响其他运行）：

```
npx vitest run test/view.test.ts
```
输出：`Tests  15 passed (15)` — 包括 "loads a run with bad lines without affecting other runs" 用例验证了好坏混合场景。

### 条目 2：投影层 `projectRuns` / `projectBatches`

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| 纯函数，`now` 由参数传入 | 条目 2 | `src/view.ts:296-299`，`buildStatus(runDataList, batches, now: Date)` | ✅ |
| 不 import `run.ts` / `runner/` / `roles/` | 条目 2 | `src/view.ts:6-9`，imports 仅为 `node:fs`、`node:path`、`./journal.js`、`./schema/index.js` | ✅ |
| 13.1 字段缺失时给 `null` | 条目 2 | `src/view.ts:177-190`，`asNumber()` 返回 `null` 当字段不存在 | ✅ |
| `collie status [--json]` 按 13.2 输出 | 条目 2 | `src/cli.ts:475-504`，三段输出：current / queue / last queue run | ✅ |
| `cli.ts` 只做接线 | 条目 2 | `src/cli.ts:475-504`，status 函数仅调用 `loadRuns` → `loadBacklog` → `buildStatus` → `formatStatus` / `JSON.stringify` | ✅ |
| 没有 journal 时打印 `no runs recorded` 退出码 0 | 条目 2 | `src/cli.ts:479-485`，`runDataList.length === 0` 时输出 "no runs recorded" 并返回 `EXIT_CODES.PASS` | ✅ |

### 条目 3：`test/view.test.ts` 夹具覆盖

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| 一次 PASS | 条目 3 | `test/view.test.ts:233`，"projectRun handles a PASS run with 13.1 fields" | ✅ |
| FIX 后 PASS | 条目 3 | `test/view.test.ts:249`，"handles FIX followed by PASS across two runs" | ✅ |
| 进行中的运行 | 条目 3 | `test/view.test.ts:264`，"detects an in-progress run (no run.finished)" | ✅ |
| 旧格式 run_id 目录 | 条目 3 | `test/view.test.ts:305`，"marks an old-format run_id directory as valid if events parse" | ✅ |
| 含坏行的 journal | 条目 3 | `test/view.test.ts:326`，"marks a run with bad journal lines as unreadable" | ✅ |
| 一次队列运行 | 条目 3 | `test/view.test.ts:353`，"projects a queue run correctly" | ✅ |
| 不含 13.1 字段的旧 journal | 条目 3 | `test/view.test.ts:380`，"gives null for 13.1 fields missing from old journal" | ✅ |
| `test/invariants.test.ts` 加不变量 | 条目 3 | `test/invariants.test.ts:278-284`，"src/view.ts does not import run.ts, runner/, or roles/ (v04-b02)" | ✅ |
| `vitest.config.ts` 加 `hookTimeout` | 条目 3 | `vitest.config.ts:8`，`hookTimeout: 30_000` | ✅ |

行为验证：

```
npx vitest run test/view.test.ts
```
输出：`Tests  15 passed (15)`

```
npx vitest run test/invariants.test.ts
```
输出：`Tests  37 passed (37)`

### 额外禁止

| 要求 | 出处 | 证据 | 满足 |
|---|---|---|---|
| 不改动任何受保护路径 | 额外禁止 | Worker 提交 `23da11e` 和 `4278c4b` 逐个 diff 受保护路径均为空 | ✅ |
| 不为了让测试过而删除或跳过任何测试 | 额外禁止 | diff 未删除或 `skip` 任何测试 | ✅ |
| 不为了让验收命令通过而改注释或字面（铁律 26） | 额外禁止 | diff 中无此类操作 | ✅ |
| 不改动 `run.ts`、`gate.ts`、`arbiter.ts`、规则 1~10 | 额外禁止 | `git diff 7f9158b..4278c4b -- src/run.ts src/gate.ts src/arbiter.ts` 无输出 | ✅ |
| `status` 不写任何文件 | 额外禁止 | `src/view.ts` 无 `writeFileSync`/`appendFileSync`/`writeFile` 调用 | ✅ |
| 不新增依赖 | 额外禁止 | `package.json` / `package-lock.json` 无改动 | ✅ |

## 声称与实测的差异

无。

## 结论与理由

**PASS。** 

全部 11 条验收命令实跑通过。三个条目的功能要求与结构要求均已满足：

- `src/view.ts` 两层设计清晰，读取层容错（坏 journal → unreadable 不抛出），投影层为纯函数且不依赖运行时模块。
- `test/view.test.ts` 有 15 个用例，覆盖了条目要求的全部 7 类夹具。
- `collie status [--json]` 正确接线，空 journal 输出 "no runs recorded"，非空时三段输出且 JSON 合法。
- `vitest.config.ts` 的 `hookTimeout` 已配置为 30000ms。
- `test/invariants.test.ts` 新增了 view.ts 不 import run/runner/roles 的永久回归检查。
- 额外禁止全部满足。
- Worker 提交已推送到远端。
- CI 以 R2 取证为准。

```json
{
  "schema_version": 1,
  "batch_id": "v04-b02",
  "verdict": "PASS",
  "evidence": {
    "commits_actual": [
      "23da11e85b1d10445c48e81ee3b8afc1d3f06bfc",
      "4278c4b2927b077c594f68115dba0705d79d5a97"
    ],
    "verify_results": [
      { "cmd": "npm run lint", "exit_code": 0, "summary": "eslint + prettier pass" },
      { "cmd": "npm run typecheck", "exit_code": 0, "summary": "tsc zero errors" },
      { "cmd": "npm test", "exit_code": 0, "summary": "41 files, 846 passed" },
      { "cmd": "npm test -- test/view.test.ts", "exit_code": 0, "summary": "15 passed" },
      { "cmd": "grep -cE \"^\\s+it\\(\" test/view.test.ts | grep -qE \"^([8-9]|[1-9][0-9])$\"", "exit_code": 0, "summary": "count=15, >=8" },
      { "cmd": "test -f src/view.ts && ! grep -qE \"from '\\./(run|runner|roles)[./]\" src/view.ts", "exit_code": 0, "summary": "no forbidden imports" },
      { "cmd": "grep -qE \"unreadable\" src/view.ts && grep -qE \"unreadable\" test/view.test.ts", "exit_code": 0, "summary": "both files contain unreadable" },
      { "cmd": "npx tsx src/cli.ts status", "exit_code": 0, "summary": "outputs 'no runs recorded'" },
      { "cmd": "npx tsx src/cli.ts status --json | node -e \"JSON.parse(require('fs').readFileSync(0,'utf8'))\"", "exit_code": 0, "summary": "valid JSON parsed" },
      { "cmd": "grep -qE \"view\\.ts\" test/invariants.test.ts", "exit_code": 0, "summary": "invariant present" },
      { "cmd": "grep -vE \"^\\s*(//|\\*|/\\*)\" vitest.config.ts | grep -qE \"hookTimeout\"", "exit_code": 0, "summary": "hookTimeout configured" }
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
  "reason": "11/11 验收命令通过，三条目功能与结构要求全部满足，额外禁止无违反，worker 提交已推送。CI 以 R2 取证为准。"
}
```
