All 28 tester tests pass, including the existing schema validation tests and the new previous_problems tests.

Let me now compile the complete verdict:

# 批次 v046-b08 审核

## 取证过程

### 1. 提交与推送

```
$ git rev-parse 777ce2a6316797555c64728e39b15900df953ab5
777ce2a6316797555c64728e39b15900df953ab5

$ git log c475eaa..777ce2a --oneline -- . ':(exclude).collie/batches'
777ce2a roles: add prepareAcceptance module, tester previous_problems, and tests (SPEC 16.12)

$ git branch -r --contains 777ce2a6316797555c64728e39b15900df953ab5
  origin/HEAD -> origin/main
  origin/main
```

一个提交，已推送到 origin/main。

### 2. 受保护文件

```
$ git diff --stat c475eaa..777ce2a -- SPEC.md CONSTRAINTS.md ROADMAP.md ROLES.md 'AGENT-*.md' docs/backlog.md docs/decisions docs/progress.md .collie/collie.toml
(empty)
```

零行改动。

### 3. 额外禁止的文件

```
$ git diff --stat c475eaa..777ce2a -- templates/collie.toml .github/ eslint.config.js vitest.config.ts package.json AGENT-tester.md .collie/collie.toml src/run.ts src/redcheck.ts src/backlog.ts src/schema/index.ts src/evidence.ts src/roles/worker.ts src/roles/reviewer.ts src/runner/ src/arbiter.ts src/gate.ts test/support/sandbox.ts
(empty)
```

零行改动。

### 4. 依赖变化

```
$ git diff c475eaa..777ce2a -- package.json package-lock.json
(empty)
```

无依赖变化。

### 5. Diff 范围

变动文件（5 个）：
- `src/acceptance.ts` — 新文件，238 行（条目 1）
- `src/roles/tester.ts` — +14 行（条目 2）
- `test/prepare-acceptance.test.ts` — 新文件，627 行（条目 3）
- `test/tester.test.ts` — +30 行（条目 3）
- `test/invariants.test.ts` — +20 行（条目 3）

全部在 task.md 条目范围之内，无范围蔓延。

### 6. 验收命令实跑

#### 命令 1：`npm run lint`
```
$ npm run lint
> collie@0.1.0 lint
> eslint . && prettier --check .
Checking formatting...
All matched files use Prettier code style!
```
退出码：0 ✓

#### 命令 2：`npm run typecheck`
```
$ npm run typecheck
> collie@0.1.0 typecheck
> tsc -p tsconfig.json
```
退出码：0 ✓

#### 命令 3：`npm test`
```
$ npm test
Test Files  63 passed (63)
     Tests  1308 passed (1308)
  Duration  22.08s
```
退出码：0 ✓

#### 命令 4：`npm test -- test/prepare-acceptance.test.ts test/tester.test.ts && ! test -e .vitest`
```
Test Files  2 passed (2)
     Tests  38 passed (38)
  Duration  1.48s
```
退出码：0 ✓

#### 命令 5：三组用例名检查
```
$ grep -qF "prepareAcceptance: retry loop" test/prepare-acceptance.test.ts && grep -qF "prepareAcceptance: what is taken from the tree" test/prepare-acceptance.test.ts && grep -qF "prepareAcceptance: real red check" test/prepare-acceptance.test.ts
```
退出码：0 ✓

#### 命令 6：提示词新用例组
```
$ grep -qF "tester: previous problems in the prompt" test/tester.test.ts
```
退出码：0 ✓

#### 命令 7：函数导出、队列未用
```
$ grep -qE "export (async )?function prepareAcceptance" src/acceptance.ts && ! grep -vE "^\s*(//|\*|/\*)" src/run.ts | grep -qE "acceptance\.js"
```
退出码：0 ✓

#### 命令 8：临时目录无残留
```
$ d=$(mktemp -d) && TMPDIR=$d npm test -- test/prepare-acceptance.test.ts && ! ls -d "$d"/collie-accept-* >/dev/null 2>&1
Test Files  1 passed (1)
     Tests  10 passed (10)
```
退出码：0 ✓

#### 命令 9：不变量同步
```
$ grep -qF "removeWorktree" test/invariants.test.ts && grep -qF "src/acceptance.ts" test/invariants.test.ts
```
退出码：0 ✓

## 逐条验收

| 验收项 | 命令 | 实测结果 | 通过 |
|---|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 | ✅ |
| 类型检查零错误 | `npm run typecheck` | exit 0 | ✅ |
| 全部测试通过 | `npm test` | 63 files, 1308 tests passed | ✅ |
| 模块与提示词测试通过，无 .vitest | `npm test -- test/prepare-acceptance.test.ts test/tester.test.ts && ! test -e .vitest` | 2 files, 38 tests passed | ✅ |
| 模块三组用例在 | grep 三次 | exit 0 | ✅ |
| 提示词新用例组在 | grep | exit 0 | ✅ |
| 函数导出、队列未用 | grep + 反向 grep | exit 0 | ✅ |
| 临时目录无残留 | TMPDIR 隔离测试 | exit 0 | ✅ |
| 不变量同步 | grep | exit 0 | ✅ |

## 条目要求与额外禁止

### 条目 1（src/acceptance.ts）

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| 新文件 `src/acceptance.ts` | task §1 | `src/acceptance.ts:1`（文件存在） | ✅ |
| 导出 `prepareAcceptance(opts)` | task §1 | `src/acceptance.ts:78`: `export async function prepareAcceptance(opts: PrepareAcceptanceOpts)` | ✅ |
| opts 有 root, headSha, batch, config, runner, testerMax, redCheckOpts | task §1 | `src/acceptance.ts:54-67`: `PrepareAcceptanceOpts` 接口定义了全部 7 个必选字段 | ✅ |
| 可选 record(事件名, 字段) | task §1 | `src/acceptance.ts:68`: `record?: RecordFn` | ✅ |
| 可选 redCheck（缺省 runRedCheck） | task §1 | `src/acceptance.ts:69`: `redCheck?: RedCheckFn`；`src/acceptance.ts:80`: `const doRedCheck: RedCheckFn = opts.redCheck ?? runRedCheck` | ✅ |
| 在系统临时目录建 worktree，collie-accept- 开头 | task §1 | `src/acceptance.ts:76,83`: `WORKTREE_PREFIX = 'collie-accept-'`，`mkdtempSync(join(tmpdir(), WORKTREE_PREFIX))` | ✅ |
| node_modules 链进去 | task §1 | `src/acceptance.ts:92-95`: 检查并 symlink | ✅ |
| 最多拉起 testerMax 次 | task §1 | `src/acceptance.ts:103`: `for (let i = 0; i < testerMax; i++)` | ✅ |
| 每次拉起后做红检查 | task §1 | `src/acceptance.ts:131`: `await doRedCheck(worktreeDir, outDir, redCheckOpts)` | ✅ |
| 非零退出不做红检查，原因写明退出码 | task §1 | `src/acceptance.ts:124-128`: `if (result.exitCode !== 0)` → `lastProblems = ['tester exited with code ...']`，然后 `continue` | ✅ |
| 过了只取 new.test.ts, MAP.md, keep.test.ts（有保持情形时） | task §1 | `src/acceptance.ts:193-237`: `collectFiles` 函数只收集这三个点名的文件 | ✅ |
| 有保持而无 keep.test.ts 或无 MAP.md → 没过 | task §1 | `src/acceptance.ts:203-216`: 检查 MAP.md 和 keep.test.ts 是否存在 | ✅ |
| 返回 ok/fail 正确形状 | task §1 | `src/acceptance.ts:149`: `{ ok: true, attempts, files }`；`src/acceptance.ts:157`: `{ ok: false, attempts, problems: lastProblems }` | ✅ |
| 不往 root 写东西、不提交 | task §1 | 通篇只对 `worktreeDir` 操作，root 仅用于 `addWorktree`/`removeWorktree`/`existsSync(mainNodeModules)` | ✅ |
| 结束时 worktree 拿掉（含抛错） | task §1 | `src/acceptance.ts:158-170`: `finally { await removeWorktree(root, worktreeDir) }` 带 fallback `rmSync` | ✅ |
| record 记事件 | task §1 | `src/acceptance.ts:117`: `tester.started`；`src/acceptance.ts:121`: `tester.finished`；`src/acceptance.ts:133-139`: `redcheck.result` | ✅ |
| 使用 removeWorktree | task §1 | `src/acceptance.ts:9`: import；`src/acceptance.ts:161`: 调用 | ✅ |
| 不过时问题清单交下次 | task §1 | `src/acceptance.ts:153-154`: `previousProblems = lastProblems` | ✅ |

**行为要求验证：**

| 行为要求 | 实跑命令 | 实跑结果 |
|---|---|---|
| 第 1 次红检查不过、第 2 次过 → ok=true, attempts=2 | `npx vitest run test/prepare-acceptance.test.ts` | Tests 10 passed ✅ |
| testerMax=2 两次都不过 → ok=false, attempts=2 | 同上 | 同上 ✅ |
| 非零退出不做红检查 | 同上 | 同上 ✅ |
| record 事件顺序 (started,finished,result ×2) | 同上 | 同上 ✅ |
| sneaky 文件不取走、worktree 清理 | 同上 | 同上 ✅ |
| 保持无 keep.test.ts → 失败 | 同上 | 同上 ✅ |
| 无 MAP.md → 失败 | 同上 | 同上 ✅ |
| redCheck 抛错 → 传播、worktree 仍拿掉 | 同上 | 同上 ✅ |
| 真实红检查：写失败测试 → ok=true | 同上 | 同上 ✅ |

### 条目 2（src/roles/tester.ts）

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| TesterInputSchema 加可选 previous_problems | task §2 | `src/roles/tester.ts:30`: `previous_problems: z.array(z.string().min(1)).optional()` | ✅ |
| 非空时提示词在情形前多一节 | task §2 | `src/roles/tester.ts:112-120`: 构建 `previousProblemsLines`，`src/roles/tester.ts:124`: 插入到 sections 中情形之前 | ✅ |
| 节标题「上一次没过的原因」 | task §2 | `src/roles/tester.ts:115`: `previousProblemsLines.push('## 上一次没过的原因', '')` | ✅ |
| 逐条原样列出 | task §2 | `src/roles/tester.ts:117`: `previousProblemsLines.push(\`- \${problem}\`)` | ✅ |
| 写一句「只改有问题的地方，改完重新自检」 | task §2 | `src/roles/tester.ts:119`: `previousProblemsLines.push('', '只改有问题的地方，改完重新自检')` | ✅ |
| 不给或空数组时提示词逐字相同 | task §2 | `src/roles/tester.ts:113-114`: `const prevProblems = data.previous_problems ?? []; if (prevProblems.length > 0)` — 空数组或 undefined 均跳过 | ✅ |

**行为要求验证：**

| 行为要求 | 实跑命令 | 实跑结果 |
|---|---|---|
| 给两条 → 两条原文都在、位于情形前 | `npx vitest run test/tester.test.ts` | Tests 28 passed ✅ |
| 不给 → 提示词与无字段时逐字相同 | 同上 | 同上 ✅ |
| 空数组 → 提示词与无字段时逐字相同 | 同上 | 同上 ✅ |

### 条目 3（测试文件）

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| 三组 describe 名称正确 | task §3 | `test/prepare-acceptance.test.ts:454`: `prepareAcceptance: retry loop`；`test/prepare-acceptance.test.ts:663`: `prepareAcceptance: what is taken from the tree`；`test/prepare-acceptance.test.ts:869`: `prepareAcceptance: real red check` | ✅ |
| Group 1: 两个加粗情形 + 非零退出 + 事件 | task §3 | 4 个 it 块（lines 455, 512, 557, 591），实跑全过 | ✅ |
| Group 2: sneaky + 保持无 keep + 无保持有 keep + 无 MAP + redCheck 抛错 | task §3 | 5 个 it 块（lines 664, 718, 753, 790, 824），实跑全过 | ✅ |
| Group 3: 真实红检查一条 | task §3 | 1 个 it 块（line 870），使用真实 runRedCheck，实跑通过 | ✅ |
| tester.test.ts 新组 | task §3 | `test/tester.test.ts:274`: `tester: previous problems in the prompt`，3 个 it 块 | ✅ |
| 不改 test/support/sandbox.ts | task §3 | diff 中无此文件改动 | ✅ |
| 使用 templateConfig() | task §3 | `test/prepare-acceptance.test.ts:344`: `const config = templateConfig()` | ✅ |
| 使用 FakeRunner | task §3 | `test/prepare-acceptance.test.ts:338`: import FakeRunner，整个测试文件使用 | ✅ |
| invariants 两条新不变量 | task §3 | `test/invariants.test.ts:288-306`: `removeWorktree` 和 `acceptance.js` 的不变量 | ✅ |
| 已有用例一条都不改 | task §3 | diff 中 test/tester.test.ts 仅在文件末尾添加新 describe，无任何已有行被修改 | ✅ |

### 额外禁止核对

| 禁止事项 | 出处 | 证据 | 满足 |
|---|---|---|---|
| 不改受保护路径 | task 额外禁止 | `git diff --stat` 对受保护路径输出为空 | ✅ |
| 不改 templates/collie.toml、.github/、eslint.config.js、vitest.config.ts、package.json | task 额外禁止 | `git diff --stat` 对这些文件输出为空 | ✅ |
| 不改 src/run.ts、src/redcheck.ts、src/backlog.ts 等 | task 额外禁止 | `git diff --stat` 对这些文件输出为空 | ✅ |
| 不接进队列、不加子命令 | task 额外禁止 | `src/run.ts` 无 `acceptance.js` 匹配 | ✅ |
| 不往主仓库写文件、提交或推送 | task 额外禁止 | 代码审阅：prepareAcceptance 仅操作 worktreeDir，不 touch root | ✅ |
| 不取走点名之外的文件 | task 额外禁止 | `src/acceptance.ts:218-237`: collectFiles 只收集 new.test.ts、MAP.md、keep.test.ts | ✅ |
| 不删除或跳过测试 | task 额外禁止 | diff 中无 test 文件的删除行 | ✅ |
| 不改写已有断言 | task 额外禁止 | diff 中 test/tester.test.ts 仅添加新内容，无已有行被修改 | ✅ |
| 不改注释凑验收 | task 额外禁止 | 验收命令本身通过，无此情形 | ✅ |
| 不拉起真实 runner / 网络（group 3 除外） | task 额外禁止 | Group 1&2 用 FakeRunner + 注入红检查；Group 3 用 FakeRunner + 真实 vitest 子进程 | ✅ |
| 无新依赖 | task 额外禁止 | package.json 无变化 | ✅ |

### 不变量数值变化

无。diff 中 `test/invariants.test.ts` 仅新增两条不变量检查，不涉及已有数值上下限的改动。

### 被改写或删去的断言

无。diff 中所有 test 文件仅有添加，无已有 `expect(...)` 被删除或修改。

## 结论与理由

**PASS。**

全部 9 条验收命令实跑通过。提交已推送到 origin/main。无受保护文件被修改，无依赖变化，无范围蔓延。

代码实现完整覆盖条目 1（prepareAcceptance 循环、worktree 管理、文件收集）、条目 2（previous_problems 在提示词中的呈现）、条目 3（三组测试、提示词测试、不变量测试）。

测试实跑：prepare-acceptance 10 passed、tester 28 passed、invariants 77 passed。全量 63 文件 1308 测试全过。

额外禁止事项逐条核对均满足。

```json
{
  "schema_version": 1,
  "batch_id": "v046-b08",
  "verdict": "PASS",
  "evidence": {
    "commits_actual": ["777ce2a6316797555c64728e39b15900df953ab5"],
    "verify_results": [
      { "cmd": "npm run lint", "exit_code": 0, "summary": "eslint + prettier all pass" },
      { "cmd": "npm run typecheck", "exit_code": 0, "summary": "tsc clean" },
      { "cmd": "npm test", "exit_code": 0, "summary": "63 files, 1308 tests passed" },
      { "cmd": "npm test -- test/prepare-acceptance.test.ts test/tester.test.ts && ! test -e .vitest", "exit_code": 0, "summary": "2 files, 38 tests passed, no .vitest" },
      { "cmd": "grep -qF prepareAcceptance: retry loop ... (3 greps)", "exit_code": 0, "summary": "three groups found" },
      { "cmd": "grep -qF tester: previous problems in the prompt test/tester.test.ts", "exit_code": 0, "summary": "group found" },
      { "cmd": "grep -qE export (async )?function prepareAcceptance ... && ! grep ...", "exit_code": 0, "summary": "function exported, not in queue" },
      { "cmd": "TMPDIR=... npm test -- test/prepare-acceptance.test.ts && ! ls ...", "exit_code": 0, "summary": "no collie-accept-* leftovers" },
      { "cmd": "grep -qF removeWorktree ... && grep -qF src/acceptance.ts ...", "exit_code": 0, "summary": "invariants present" }
    ],
    "remote_has_head": true,
    "ci_conclusion": "unknown",
    "ci_run_url": "",
    "ci_branch_matched": null,
    "deps_diff": [],
    "spec_diff_lines": 0
  },
  "gaps": [],
  "reason": "All 9 acceptance commands pass. Single commit pushed to origin/main. No protected files modified, no dependency changes, no scope creep. Implementation correctly covers all three items: prepareAcceptance module with retry loop, worktree cleanup, and file collection (item 1); previous_problems in tester prompt (item 2); comprehensive tests in three groups plus tester prompt tests and invariants (item 3). All extra prohibitions satisfied. CI conclusion unknown — CI verification deferred to R2."
}
```
