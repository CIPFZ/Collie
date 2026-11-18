All evidence gathered. Here is the complete verdict:

---

# 批次 v046-b07 审核

## 取证过程

### 1. 受保护路径检查

```
git diff --stat d26b74b3..97d79b03 -- SPEC.md CONSTRAINTS.md ROADMAP.md ROLES.md 'AGENT-*.md' docs/backlog.md docs/decisions docs/progress.md .collie/collie.toml
```
结果：无输出，0 行变化。

### 2. 额外禁止路径检查

```
git diff --stat d26b74b3..97d79b03 -- .github/ eslint.config.js vitest.config.ts package.json
```
结果：无输出，未改动。

```
git diff --stat d26b74b3..97d79b03 -- src/run.ts src/redcheck.ts src/roles/ src/runner/ src/arbiter.ts src/gate.ts src/backlog.ts src/view.ts src/follow.ts
```
结果：无输出，未改动。

### 3. 依赖变化

```
git diff d26b74b3..97d79b03 -- package.json package-lock.json
```
结果：无输出，无依赖变化。

### 4. 提交事实

```
git rev-parse 97d79b03da298fc5e68ff114682b426fee185eb5
→ 97d79b03da298fc5e68ff114682b426fee185eb5
```

```
git branch -a --contains 97d79b03da298fc5e68ff114682b426fee185eb5
→ main, remotes/origin/main
```

提交存在且已推送至远端 main。

### 5. 验收命令逐条实跑

| # | 命令 | 退出码 | 输出摘要 |
|---|---|---|---|
| 1 | `npm run lint` | 0 | eslint + prettier 通过 |
| 2 | `npm run typecheck` | 0 | tsc 无错误 |
| 3 | `npm test` | 0 | 62 files, 1293 tests passed |
| 4 | `npm test -- test/config.test.ts test/schema.test.ts test/evidence.test.ts test/mutation.test.ts` | 0 | 4 files, 159 tests passed |
| 5 | `grep -qF "config: tester_max and verify.static" test/config.test.ts && grep -qF "counts test/acceptance as protected (SPEC 16.12)" test/evidence.test.ts` | 0 | 匹配 |
| 6 | `grep -qE "^tester_max = 2" templates/collie.toml && grep -qE "^static = " templates/collie.toml && ! grep -qE "tester_max\|^static = " .collie/collie.toml` | 0 | 模板有两项，仓库配置无 |
| 7 | `npx tsx scripts/mutation.ts --list \| grep -c . \| grep -qx 43` | 0 | 43 项 |
| 8 | `out=$(npx tsx scripts/mutation.ts 2>&1) && printf '%s\n' "$out" \| tail -n 1 \| grep -qE "^mutation: caught 43 survived 0 invalid 0 timeout 0 stale 0$" && ! test -e .vitest` | 0 | caught 43, survived 0 |
| 9 | `grep -qF "test/acceptance" test/invariants.test.ts` | 0 | 匹配 |

### 6. 单独实跑各测试文件

| 测试文件 | 结果 |
|---|---|
| `test/config.test.ts` | 32 passed |
| `test/evidence.test.ts` | 27 passed |
| `test/schema.test.ts` | 78 passed |
| `test/mutation.test.ts` | 22 passed |
| `test/invariants.test.ts` | 75 passed |

### 7. 事件类型未被记录

在 `src/` 目录下搜索 `tester.started|tester.finished|redcheck.result`，仅命中 `src/schema/index.ts:283-285` 的 EVENT_TYPES 定义数组。符合「这一批只加类型，不在任何地方记录它们」。

### 8. test/acceptance 目录未创建

`test -d test/acceptance` → NOT_EXISTS。符合额外禁止。

## 逐条验收

| 验收项 | 命令 | 实测结果 | 通过 |
|---|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 | ✅ |
| 类型检查零错误 | `npm run typecheck` | exit 0 | ✅ |
| 全部测试通过 | `npm test` | exit 0, 1293 passed | ✅ |
| 配置、事件、取证、变异清单的测试通过 | `npm test -- test/config.test.ts test/schema.test.ts test/evidence.test.ts test/mutation.test.ts` | exit 0, 159 passed | ✅ |
| 配置的新用例组与受保护路径的新用例在 | `grep -qF …` | exit 0 | ✅ |
| 模板里有两项，本仓库的配置没有被动 | `grep -qE …` | exit 0 | ✅ |
| 变异清单是 43 项 | `npx tsx scripts/mutation.ts --list \| grep -c . \| grep -qx 43` | exit 0 | ✅ |
| 变异检查全部被发现 | `out=$(npx tsx scripts/mutation.ts 2>&1) …` | exit 0, caught 43 survived 0 | ✅ |
| 不变量同步 | `grep -qF "test/acceptance" test/invariants.test.ts` | exit 0 | ✅ |

## 条目要求与额外禁止

### 条目 1：配置加 tester_max 与 verify.static

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| `[limits]` 加可选的 `tester_max`（正整数，缺省 2，写法照 `grace_secs`） | 条目 1 | `src/schema/index.ts:134` — `tester_max: z.number().int().positive().optional().default(DEFAULT_TESTER_MAX)`，`DEFAULT_TESTER_MAX = 2` 在 `:34` | ✅ |
| `[verify]` 加可选的 `static`（非空字符串的数组；不写时解析结果里没有这个键） | 条目 1 | `src/schema/index.ts:161` — `static: z.array(NonEmptyString).optional()` | ✅ |
| 模板里写上 `tester_max = 2` 与 `static = [...]`，各带一行注释 | 条目 1 | `templates/collie.toml:42-43` — `# SPEC 16.12；…` + `tester_max = 2`；`templates/collie.toml:48-49` — `# SPEC 16.12；…` + `static = ["npm run lint", "npm run typecheck"]` | ✅ |
| `.collie/collie.toml` 不许动 | 条目 1 | `git diff --stat` 受保护路径输出为空 | ✅ |
| 没有这两项的配置能加载，`limits.tester_max` 是 2 | 条目 1 加粗 | `test/config.test.ts:272-276` — 移除 `tester_max = 2` 后 `parsed.limits.tester_max` 为 2。实跑：`npx vitest run test/config.test.ts` → 32 passed | ✅ |
| `verify` 里没有 `static` | 条目 1 加粗 | `test/config.test.ts:301-304` — 移除 `static` 行后 `parsed.verify.static` 为 undefined。实跑同上 32 passed | ✅ |
| `tester_max = 0` 被拒绝，报错点名 `limits.tester_max` | 条目 1 加粗 | `test/config.test.ts:279-283` — `configError` 检查 `err.issues.map(i => i.path)` 为 `['limits.tester_max']`。实跑同上 32 passed | ✅ |
| `.collie/collie.toml` 照常能加载 | 条目 1 | `test/config.test.ts:307-311` — `loadConfig(repoRoot)` 成功，`tester_max` 为 2，`static` 为 undefined。实跑同上 32 passed | ✅ |

### 条目 2：三个事件类型

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| 加 `tester.started`、`tester.finished`、`redcheck.result` | 条目 2 | `src/schema/index.ts:283-285` | ✅ |
| 只加类型，不在任何地方记录 | 条目 2 | 在 `src/` 下 grep 仅命中 `src/schema/index.ts:283-285` 的 EVENT_TYPES 数组定义 | ✅ |

### 条目 3：受保护路径与变异清单

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| `src/evidence.ts` 受保护路径加 `test/acceptance` | 条目 3 | `src/evidence.ts:40` — `'test/acceptance',` | ✅ |
| `scripts/mutation.ts` 加 `protected:test/acceptance`，共 43 项 | 条目 3 | `scripts/mutation.ts:334-339` — mutation item with name `protected:test/acceptance`；`npx tsx scripts/mutation.ts --list \| grep -c .` → 43 | ✅ |
| `test/config.test.ts` `has the limits of SPEC 3.1`：加 `tester_max: 2` | 条目 3 | `test/config.test.ts:129` — `tester_max: 2,` | ✅ |
| `VALID_TOML` 加 `static` 一行 | 条目 3 | `test/config.test.ts:50` — `static = ["npm run lint", "npm run typecheck"]` | ✅ |
| `test/schema.test.ts` 事件类型：37→40，加三条 toContain | 条目 3 | `test/schema.test.ts:253` — `toHaveLength(40)`；`:289-291` — 三条 `toContain` | ✅ |
| `test/mutation.test.ts` 受保护路径：9→10 | 条目 3 | `test/mutation.test.ts:43` — `expect(protectedNames.length).toBe(10)` | ✅ |
| 新 describe `config: tester_max and verify.static` | 条目 3 | `test/config.test.ts:271` | ✅ |
| `test/evidence.test.ts` 加 `counts test/acceptance as protected (SPEC 16.12)` | 条目 3 | `test/evidence.test.ts:171` — test case with exact title。实跑 `npx vitest run test/evidence.test.ts` → 27 passed | ✅ |
| `test/invariants.test.ts` 加 `src/evidence.ts` 里有 `test/acceptance` | 条目 3 | `test/invariants.test.ts:586-591` — invariant test。实跑 `npx vitest run test/invariants.test.ts` → 75 passed | ✅ |

### 额外禁止

| 禁止项 | 出处 | 证据 | 遵守 |
|---|---|---|---|
| 改动任何受保护路径（含 `.collie/collie.toml`） | 额外禁止 | `git diff --stat` 受保护路径无输出 | ✅ |
| 改动 `.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json` | 额外禁止 | `git diff --stat` 无输出 | ✅ |
| 改动 `src/run.ts`、`src/redcheck.ts`、`src/roles/`、`src/runner/`、`src/arbiter.ts`、`src/gate.ts`、`src/backlog.ts`、`src/view.ts`、`src/follow.ts` | 额外禁止 | `git diff --stat` 无输出 | ✅ |
| 在任何地方记录新加的三个事件 | 额外禁止 | grep 仅命中 EVENT_TYPES 定义 | ✅ |
| 在仓库里建 `test/acceptance/` 目录 | 额外禁止 | `test -d test/acceptance` → NOT_EXISTS | ✅ |
| 删除或跳过任何测试 | 额外禁止 | diff 中无 `.skip`、`.todo` 添加 | ✅ |
| 改写条目 3 点名之外的已有断言 | 额外禁止 | diff 中被删的 expect 仅 `toBe(9)` 和 `toHaveLength(37)`，均为条目 3 允许的修改 | ✅ |
| 从变异清单里去掉任何一项 | 额外禁止 | diff 仅添加不删除 | ✅ |
| 新增依赖 | 额外禁止 | package.json 无变化 | ✅ |

### 不变量数值变化

无。`test/invariants.test.ts` 的 diff 仅新增了一个测试用例，无数值上下限改动。

### 被改写或删去的断言

| 文件 | 用例名 | 原断言 | 现断言 | SPEC 仍有效 |
|---|---|---|---|---|
| `test/mutation.test.ts` | `every protected path is in the mutation list` | `expect(protectedNames.length).toBe(9)` | `expect(protectedNames.length).toBe(10)` | 是（新增了 `test/acceptance` 受保护路径） |
| `test/schema.test.ts` | `defines the v0.1 event types plus v0.2 and v0.3 types added so far` | `expect(EVENT_TYPES).toHaveLength(37)` | `expect(EVENT_TYPES).toHaveLength(40)` | 是（新增 3 个事件类型） |

两处均为条目 3 明确点名允许的改写，原守要求（路径计数、事件类型计数）仍有效且新值正确反映了新增。

## 结论与理由

全部 9 条验收命令实跑通过。三个条目的所有具体要求逐条核对均满足。额外禁止的每一项均遵守。受保护路径无修改。无新增依赖。提交存在且已推送至 origin/main。diff 范围严格在 task.md 条目之内（schema、模板、evidence、mutation 脚本、及相应测试），无范围蔓延。

结论：**PASS**。

```json
{
  "schema_version": 1,
  "batch_id": "v046-b07",
  "verdict": "PASS",
  "evidence": {
    "commits_actual": ["97d79b03da298fc5e68ff114682b426fee185eb5"],
    "verify_results": [
      { "cmd": "npm run lint", "exit_code": 0, "summary": "eslint + prettier pass" },
      { "cmd": "npm run typecheck", "exit_code": 0, "summary": "tsc no errors" },
      { "cmd": "npm test", "exit_code": 0, "summary": "62 files, 1293 tests passed" },
      { "cmd": "npm test -- test/config.test.ts test/schema.test.ts test/evidence.test.ts test/mutation.test.ts", "exit_code": 0, "summary": "4 files, 159 tests passed" },
      { "cmd": "grep -qF 'config: tester_max and verify.static' test/config.test.ts && grep -qF 'counts test/acceptance as protected (SPEC 16.12)' test/evidence.test.ts", "exit_code": 0, "summary": "both patterns found" },
      { "cmd": "grep -qE '^tester_max = 2' templates/collie.toml && grep -qE '^static = ' templates/collie.toml && ! grep -qE 'tester_max|^static = ' .collie/collie.toml", "exit_code": 0, "summary": "template has both, repo config has neither" },
      { "cmd": "npx tsx scripts/mutation.ts --list | grep -c . | grep -qx 43", "exit_code": 0, "summary": "43 items" },
      { "cmd": "out=$(npx tsx scripts/mutation.ts 2>&1) && printf '%s\\n' \"$out\" | tail -n 1 | grep -qE '^mutation: caught 43 survived 0 invalid 0 timeout 0 stale 0$' && ! test -e .vitest", "exit_code": 0, "summary": "caught 43 survived 0" },
      { "cmd": "grep -qF 'test/acceptance' test/invariants.test.ts", "exit_code": 0, "summary": "pattern found" }
    ],
    "remote_has_head": true,
    "ci_conclusion": "unknown",
    "ci_run_url": "",
    "ci_branch_matched": null,
    "deps_diff": [],
    "spec_diff_lines": 0
  },
  "gaps": [],
  "reason": "All 9 acceptance commands pass. All 3 items implemented correctly: tester_max with positive-int validation and default 2, verify.static as optional string array, 3 event types in EVENT_TYPES only, test/acceptance in PROTECTED_PATHS and mutation list (43 items). No protected paths modified, no forbidden files touched, no new dependencies. CI以R2取证为准。"
}
```
