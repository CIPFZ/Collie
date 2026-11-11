Now I have all evidence. Let me compile the verdict.

# 批次 v04-b02 审核

## 取证过程

### 1. 提交事实

```
$ git log --format='%H' 7f9158beee07d5b31236a55a48c46bdc4260767c..23da11e85b1d10445c48e81ee3b8afc1d3f06bfc
23da11e85b1d10445c48e81ee3b8afc1d3f06bfc
673b28cd830d7f17e911e98f0ba9f03a5c9a8c67
```

两个提交：task 信封 + 实现提交。

远端推送状态：`git ls-remote origin` 显示 main 在 `b5170fc...`，head SHA `23da11e...` 未出现在远端任何 ref 上。`remote_has_head` = false。

### 2. 受保护文件

```
$ git diff --stat <base>..<head> -- SPEC.md CONSTRAINTS.md ROADMAP.md ROLES.md 'AGENT-*.md' docs/backlog.md docs/decisions docs/progress.md .collie/collie.toml
(空输出)
```

零行改动。✅

### 3. 依赖变化

```
$ git diff <base>..<head> -- package.json package-lock.json
(空输出)
```

无新增依赖。✅

### 4. 禁止文件

```
$ git diff --stat <base>..<head> -- src/run.ts src/gate.ts src/arbiter.ts
(空输出)
```

未改动。✅

### 5. 验收命令逐条实跑

| # | 命令 | 退出码 | 结果 |
|---|---|---|---|
| 1 | `npm run lint` | 0 | "All matched files use Prettier code style!" |
| 2 | `npm run typecheck` | 0 | 无错误输出 |
| 3 | `npm test` | 0 | 41 files, 846 tests passed |
| 4 | `npm test -- test/view.test.ts` | 0 | 1 file, 15 tests passed |
| 5 | `grep -cE … test/view.test.ts \| grep -qE …` | 0 | 计数 15，匹配 `^([8-9]\|[1-9][0-9])$` |
| 6 | `test -f src/view.ts && ! grep -qE …` | 0 | view.ts 存在且不含被禁 import |
| 7 | `grep -qE "unreadable" src/view.ts && …` | 0 | 两个文件都含 "unreadable" |
| 8 | `npx tsx src/cli.ts status` | 0 | 输出 "no runs recorded" |
| **9** | `npx tsx src/cli.ts status --json \| node -e "JSON.parse(…)"` | **1** | **输出 "no runs recorded"（纯文本），JSON.parse 抛 SyntaxError** |
| 10 | `grep -qE "view\.ts" test/invariants.test.ts` | 0 | 匹配成功 |
| 11 | `grep -vE … vitest.config.ts \| grep -qE "hookTimeout"` | 0 | 第 8 行 `hookTimeout: 30_000` |

## 逐条验收

| 验收项 | 命令 | 实测结果 | 通过 |
|---|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 | ✅ |
| 类型检查零错误 | `npm run typecheck` | exit 0 | ✅ |
| 全部测试通过 | `npm test` | exit 0, 846 passed | ✅ |
| 投影专项测试通过 | `npm test -- test/view.test.ts` | exit 0, 15 passed | ✅ |
| 专项测试不少于 8 个 | `grep -cE …` | 15 ≥ 8 | ✅ |
| 投影模块不依赖运行逻辑 | `test -f … && ! grep …` | exit 0 | ✅ |
| 坏 journal 有处理且有测试 | `grep -qE "unreadable" …` | exit 0 | ✅ |
| status 命令已接线 | `npx tsx src/cli.ts status` | exit 0 | ✅ |
| **status --json 输出合法 JSON** | `npx tsx src/cli.ts status --json \| node -e …` | **exit 1** | **❌** |
| 不变量同步 | `grep -qE "view\.ts" …` | exit 0 | ✅ |
| 钩子超时已配置 | `grep -vE … \| grep -qE "hookTimeout"` | exit 0 | ✅ |

## 条目要求与额外禁止

### 结构要求

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| `loadRuns(root)` 扫全部运行目录并重放 | task 条目 1 | `src/view.ts:97-113`：`readdirSync` + `journal.replay()` | ✅ |
| 单个运行 journal 校验失败不抛出，记为 `unreadable` 带原因 | task 条目 1 | `src/view.ts:107-112`：catch 块返回 `{ status: 'unreadable', reason }` | ✅ |
| `projectRuns` / `projectBatches` 是纯函数 | task 条目 2 | `src/view.ts:168-176` (projectRuns), `src/view.ts:179-201` (projectBatches)：无 I/O，无时钟调用 | ✅ |
| `now` 由参数传入，不 import `run.ts` / `runner/` / `roles/` | task 条目 2 | `src/view.ts:210` `buildStatus` 接收 `now: Date` 参数；imports 只有 `node:fs`, `node:path`, `./journal.js`, `./schema/index.js` (行 6-9) | ✅ |
| 13.1 字段缺失时给 `null` | task 条目 2 | `src/view.ts:131-132`：`asNumber`/`asString` 在字段缺失时返回 `null` | ✅ |
| `cli.ts` 只做接线 | task 条目 2 | `src/cli.ts:476-497`：status() 只调用 `loadRuns` + `buildStatus` + `formatStatus`，无业务逻辑 | ✅ |
| 没有 journal 时打印 `no runs recorded` 退出码 0 | task 条目 2 | `src/cli.ts:478-481`：`runDataList.length === 0` 时 `deps.out('no runs recorded\n')` return 0 | ✅ |
| **`--json` 输出同一结构** | SPEC 13.2 line 985 | `src/cli.ts:478-481`：early return 在 `json` 检查之前，`--json` 时仍输出纯文本 | **❌** |
| `vitest.config.ts` 加 `hookTimeout`，与 `testTimeout` 同值 | task 条目 3 | `vitest.config.ts:8`：`hookTimeout: 30_000` 与 `testTimeout: 30_000` 同值 | ✅ |
| invariants 加 view.ts 不 import run/runner/roles | task 条目 3 | `test/invariants.test.ts:278-284`：三条 `expect(content).not.toMatch(…)` | ✅ |
| 不改 run.ts / gate.ts / arbiter.ts | task 额外禁止 | `git diff --stat … -- src/run.ts src/gate.ts src/arbiter.ts` 空输出 | ✅ |
| 不让 status 写任何文件 | task 额外禁止 | `src/view.ts` 无 writeFile/appendFile/createWriteStream；`src/cli.ts:476-497` 只调 `deps.out()` | ✅ |
| 不新增依赖 | task 额外禁止 | `git diff … -- package.json package-lock.json` 空输出 | ✅ |
| 受保护路径无改动 | task 额外禁止 | diff 0 行 | ✅ |

### 行为要求

| 要求 | 出处 | 证据 | 满足 |
|---|---|---|---|
| 夹具覆盖 PASS / FIX→PASS / 进行中 / 旧 run_id / 坏 journal / 队列运行 / 旧 journal | task 条目 3 | `npx vitest run test/view.test.ts` → Tests 15 passed | ✅ |
| invariant: view.ts 不 import run/runner/roles | task 条目 3 | `npx vitest run test/invariants.test.ts` → Tests 37 passed | ✅ |

## 声称与实测的差异

**无法判断**——本次审核未收到 worker 的 report.md 声称。仅基于 diff 与实测。

## 缺陷分析

**验收命令 #9 失败：`status --json` 在无 journal 时输出非法 JSON**

根因在 `src/cli.ts:476-481`：

```typescript
function status(deps: CliDeps, json: boolean): number {
  const runDataList = loadRuns(deps.cwd);
  if (runDataList.length === 0) {
    deps.out('no runs recorded\n');   // ← 不区分 json/text
    return EXIT_CODES.PASS;
  }
```

当 `runDataList` 为空时，函数在检查 `json` 标志之前就 early-return 了，无论是否传了 `--json` 都输出纯文本 `no runs recorded`。SPEC 13.2 第 985 行明确写道："`--json` 输出同一结构"，即 JSON 模式应输出有效 JSON。

**修复方案（参考，由 worker 决定具体实现）：** 在 empty 分支中检查 `json` 标志，输出如 `JSON.stringify({ message: "no runs recorded" })` 或按正常路径走 `buildStatus([], batches, now)` 的 JSON 序列化。

## 结论与理由

**FIX** — 11 条验收命令中第 9 条失败。`collie status --json` 在无 journal 环境下输出纯文本，不是合法 JSON。这是一个可在同批次内修复的逻辑遗漏（early-return 路径未区分 `--json`）。其余 10 条验收命令全部通过，结构与行为要求均满足，无受保护文件改动，无新增依赖。

```json
{
  "schema_version": 1,
  "batch_id": "v04-b02",
  "verdict": "FIX",
  "evidence": {
    "commits_actual": [
      "673b28cd830d7f17e911e98f0ba9f03a5c9a8c67",
      "23da11e85b1d10445c48e81ee3b8afc1d3f06bfc"
    ],
    "verify_results": [
      { "cmd": "npm run lint", "exit_code": 0, "summary": "eslint + prettier pass" },
      { "cmd": "npm run typecheck", "exit_code": 0, "summary": "tsc no errors" },
      { "cmd": "npm test", "exit_code": 0, "summary": "41 files, 846 tests passed" },
      { "cmd": "npm test -- test/view.test.ts", "exit_code": 0, "summary": "1 file, 15 tests passed" },
      { "cmd": "grep -cE \"^\\s+it\\(\" test/view.test.ts | grep -qE \"^([8-9]|[1-9][0-9])$\"", "exit_code": 0, "summary": "count=15, >=8" },
      { "cmd": "test -f src/view.ts && ! grep -qE \"from '\\.\\/\\(run|runner|roles\\)[./]\" src/view.ts", "exit_code": 0, "summary": "no prohibited imports" },
      { "cmd": "grep -qE \"unreadable\" src/view.ts && grep -qE \"unreadable\" test/view.test.ts", "exit_code": 0, "summary": "unreadable in both files" },
      { "cmd": "npx tsx src/cli.ts status", "exit_code": 0, "summary": "prints 'no runs recorded'" },
      { "cmd": "npx tsx src/cli.ts status --json | node -e \"JSON.parse(require('fs').readFileSync(0,'utf8'))\"", "exit_code": 1, "summary": "SyntaxError: 'no runs recorded' is not valid JSON" },
      { "cmd": "grep -qE \"view\\.ts\" test/invariants.test.ts", "exit_code": 0, "summary": "found" },
      { "cmd": "grep -vE \"^\\s*(//|\\*|/\\*)\" vitest.config.ts | grep -qE \"hookTimeout\"", "exit_code": 0, "summary": "hookTimeout: 30_000 on non-comment line" }
    ],
    "remote_has_head": false,
    "ci_conclusion": "unknown",
    "ci_run_url": "",
    "ci_branch_matched": null,
    "deps_diff": [],
    "spec_diff_lines": 0
  },
  "claim_mismatches": [],
  "gaps": [
    "验收命令 #9 失败：src/cli.ts:478-481 的 early-return 路径在 runDataList 为空时不区分 --json 标志，输出纯文本 'no runs recorded' 而非合法 JSON。修复：在 empty 分支中检查 json 参数，json 模式下输出有效 JSON（如空 StatusView 或 {message:'no runs recorded'}）"
  ],
  "reason": "11 条验收命令中第 9 条（status --json 输出合法 JSON）失败：无 journal 时 --json 仍输出纯文本。其余 10 条全部通过。CI 以 R2 取证为准。"
}
```
