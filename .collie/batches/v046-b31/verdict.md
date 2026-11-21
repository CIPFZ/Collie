All evidence collected. Let me compile the verdict.

---

# 批次 v046-b31 审核

## 取证过程

### 1. 受保护路径检查

```
git diff --stat 90123bf..3eab3fe -- SPEC.md CONSTRAINTS.md ROADMAP.md ROLES.md 'AGENT-*.md' docs/backlog.md docs/decisions docs/progress.md .collie/collie.toml test/acceptance .github eslint.config.js vitest.config.ts
```
**结果**：无输出，0 行受保护文件被改动。

### 2. 依赖变化检查

```
git diff --stat 90123bf..3eab3fe -- package.json package-lock.json
```
**结果**：无输出，无依赖变化。

### 3. 提交确认

单一提交 `3eab3fe4833f7fc14549ae3067b2c68b74d02178`，消息为 `verify: add .github, eslint.config.js, vitest.config.ts as protected paths (SPEC 16.21)`。

`git ls-remote origin` 显示 main 在 `5a8302a`（report 信封之后），`git log --oneline origin/main` 确认 `3eab3fe` 在 origin/main 上。已推送。

### 4. 范围检查

修改的文件（排除 `.collie/batches/`）：
- `src/evidence.ts` — 加 3 行（三个受保护路径）
- `scripts/mutation.ts` — 加 19 行改 1 行（三个变异项 + 注释更新）
- `test/evidence.test.ts` — 加 9 行（`it.each` 测试）
- `test/mutation.test.ts` — 改 1 行（10 → 13）
- `test/invariants.test.ts` — 加 7 行（不变量测试）

未改动 `src/` 下 `src/evidence.ts` 以外的任何文件（`git diff` 确认空）。

### 5. 验收命令实跑

| # | 命令 | 退出码 | 输出摘要 |
|---|---|---|---|
| 1 | `npm run lint` | 0 | `All matched files use Prettier code style!` |
| 2 | `npm run typecheck` | 0 | 无错误 |
| 3 | `npm test` | 0 | 72 test files passed, 1486 tests passed |
| 4 | `npm test -- test/evidence.test.ts test/mutation.test.ts` | 0 | 2 test files passed, 52 tests passed |
| 5 | `grep -qF` 组合 | 0 | 三个路径和用例名均找到 |
| 6 | 变异检查 | 0 | `mutation: caught 46 survived 0 invalid 0 timeout 0 stale 0`，无 `.vitest` 残留 |
| 7 | `grep -qF "in PROTECTED_PATHS (v046-b31)"` | 0 | 匹配到 |

### 6. 单独实跑行为测试

```
npx vitest run test/evidence.test.ts → Tests 30 passed
npx vitest run test/mutation.test.ts → Tests 22 passed
npx vitest run test/invariants.test.ts → Tests 93 passed
```

## 逐条验收

| 验收项 | 命令 | 实测结果 | 通过 |
|---|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0, all clean | ✅ |
| 类型检查零错误 | `npm run typecheck` | exit 0 | ✅ |
| 全部测试通过 | `npm test` | exit 0, 72 files 1486 tests | ✅ |
| 取证与变异清单的测试通过 | `npm test -- test/evidence.test.ts test/mutation.test.ts` | exit 0, 52 tests | ✅ |
| 三个路径进了清单，新用例在 | grep 组合 | exit 0 | ✅ |
| 变异检查全部被发现 | mutation.ts | exit 0, caught 46 survived 0 | ✅ |
| 不变量同步 | grep invariants | exit 0 | ✅ |

## 条目要求与额外禁止

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| `PROTECTED_PATHS` 加 `.github` | 条目 1 | `src/evidence.ts:41` — `'.github',` | ✅ |
| `PROTECTED_PATHS` 加 `eslint.config.js` | 条目 1 | `src/evidence.ts:42` — `'eslint.config.js',` | ✅ |
| `PROTECTED_PATHS` 加 `vitest.config.ts` | 条目 1 | `src/evidence.ts:43` — `'vitest.config.ts',` | ✅ |
| 写法照现有各项，每项一行 | 条目 1 | diff 确认每项一行，格式一致 | ✅ |
| mutation 加 `protected:.github` | 条目 2 | `scripts/mutation.ts` diff 确认，name 为 `protected:.github`，file 为 `src/evidence.ts` | ✅ |
| mutation 加 `protected:eslint.config.js` | 条目 2 | `scripts/mutation.ts` diff 确认，同上 | ✅ |
| mutation 加 `protected:vitest.config.ts` | 条目 2 | `scripts/mutation.ts` diff 确认，同上 | ✅ |
| mutation 共 46 项 | 条目 2 | `scripts/mutation.ts:58` 注释 `46 items`；变异检查输出 `caught 46` | ✅ |
| evidence.test.ts 加 `it.each`，用例名 `counts %s as protected (SPEC 16.21)` | 条目 3 | `test/evidence.test.ts:177-184` — `it.each(['.github/workflows/ci.yml', 'eslint.config.js', 'vitest.config.ts'])('counts %s as protected (SPEC 16.21)', ...)` | ✅ |
| mutation.test.ts 10 改 13 | 条目 3 | `test/mutation.test.ts:43` — `expect(protectedNames.length).toBe(13)` | ✅ |
| invariants.test.ts 加用例，名字正确 | 条目 3 | `test/invariants.test.ts:753-758` — `it('src/evidence.ts has .github, eslint.config.js and vitest.config.ts in PROTECTED_PATHS (v046-b31)', ...)` | ✅ |
| 行为：三个路径确实被 collect 计为 protected | 条目 3 | `npx vitest run test/evidence.test.ts` → Tests 30 passed（含 `counts .github/workflows/ci.yml as protected`、`counts eslint.config.js as protected`、`counts vitest.config.ts as protected`） | ✅ |
| 禁止改动受保护路径 | 额外禁止 | `git diff --stat` 对受保护路径全空 | ✅ |
| 禁止改 `.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`、`templates/collie.toml` | 额外禁止 | diff 不涉及这些文件 | ✅ |
| 禁止改 `src/` 下 `src/evidence.ts` 以外的文件 | 额外禁止 | `git diff -- 'src/' ':(exclude)src/evidence.ts'` 空 | ✅ |
| 禁止删除或跳过测试 | 额外禁止 | diff 无 `skip`/`todo`/删除行为 | ✅ |
| 禁止改写条目 3 点名之外的已有断言 | 额外禁止 | 仅 `toBe(10)` → `toBe(13)` 在条目 3 点名范围内 | ✅ |
| 禁止新增依赖 | 额外禁止 | `package.json` 未改 | ✅ |
| 不变量数值变化 | — | `test/invariants.test.ts`: 无数值上下限改动，仅新增用例 | 无 |
| 被改写或删去的断言 | — | `test/mutation.test.ts:43`: `expect(protectedNames.length).toBe(10)` → `expect(protectedNames.length).toBe(13)`；条目 3 明确要求此改写（"10 改成 13"）；SPEC 中受保护路径从 10 增到 13 仍然有效 | 无缺口 |

## 结论与理由

全部 7 条验收命令实跑通过。3 个新受保护路径正确添加到 `src/evidence.ts`（行 41-43），3 个对应的变异项正确添加到 `scripts/mutation.ts`，注释更新为 46 项。测试方面，`test/evidence.test.ts` 新增了 `it.each` 覆盖三个路径的受保护检测，`test/mutation.test.ts` 中 `10` 改为 `13`（条目点名允许），`test/invariants.test.ts` 新增了结构不变量检查。无受保护文件被改动，无依赖变化，无范围蔓延。唯一被改写的断言（`toBe(10)` → `toBe(13)`）是条目 3 明确要求的。

```json
{
  "schema_version": 1,
  "batch_id": "v046-b31",
  "verdict": "PASS",
  "evidence": {
    "commits_actual": ["3eab3fe4833f7fc14549ae3067b2c68b74d02178"],
    "verify_results": [
      { "cmd": "npm run lint", "exit_code": 0, "summary": "eslint + prettier clean" },
      { "cmd": "npm run typecheck", "exit_code": 0, "summary": "tsc clean" },
      { "cmd": "npm test", "exit_code": 0, "summary": "72 files, 1486 tests passed" },
      { "cmd": "npm test -- test/evidence.test.ts test/mutation.test.ts", "exit_code": 0, "summary": "2 files, 52 tests passed" },
      { "cmd": "grep -qF \"'.github',\" src/evidence.ts && grep -qF \"'eslint.config.js',\" src/evidence.ts && grep -qF \"'vitest.config.ts',\" src/evidence.ts && grep -qF \"as protected (SPEC 16.21)\" test/evidence.test.ts", "exit_code": 0, "summary": "all patterns found" },
      { "cmd": "out=$(npx tsx scripts/mutation.ts 2>&1) && printf '%s\\n' \"$out\" | tail -n 1 | grep -qE \"^mutation: caught 46 survived 0 invalid 0 timeout 0 stale 0$\" && ! test -e .vitest", "exit_code": 0, "summary": "caught 46 survived 0" },
      { "cmd": "grep -qF \"in PROTECTED_PATHS (v046-b31)\" test/invariants.test.ts", "exit_code": 0, "summary": "pattern found" }
    ],
    "remote_has_head": true,
    "ci_conclusion": "unknown",
    "ci_run_url": "",
    "ci_branch_matched": null,
    "deps_diff": [],
    "spec_diff_lines": 0
  },
  "gaps": [],
  "reason": "All 7 acceptance commands pass. Three protected paths added to PROTECTED_PATHS, three mutation items added (total 46), three test files updated as specified. No protected files modified, no dependency changes, no scope creep. CI conclusion unknown — CI verification deferred to R2."
}
```
