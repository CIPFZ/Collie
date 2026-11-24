Good - nothing changed in `src/runner/`.

Now I have all the evidence needed. Let me compile the verdict.

# 批次 v046-b40 审核

## 取证过程

### 1. 提交事实

```
git log --format='%H %s' a60d6e8..85bdf6c -- . ':(exclude).collie/batches'
```
- `85bdf6c53f493550e9e4fbc1106328158f5ab960` — `backlog: archive file merge in loadBacklog (SPEC 16.27)` ← worker 的产出
- `452ba27f102fc6c592c58677a9e361cfce27f249` — `docs: issue v046-b40 task envelope` ← R2 信封

`git rev-parse 85bdf6c53f493550e9e4fbc1106328158f5ab960` → 确认存在。
`git ls-remote origin` → 未匹配到 head sha（`remote_has_head: false`）——worktree 环境限制。

### 2. 受保护路径

```
git diff --stat a60d6e8..85bdf6c -- SPEC.md CONSTRAINTS.md ROADMAP.md ROLES.md 'AGENT-*.md' docs/backlog.md docs/backlog-archive.md docs/decisions docs/progress.md .collie/collie.toml test/acceptance .github eslint.config.js vitest.config.ts
```
输出只有 `test/acceptance/v046-b40/` 下三个文件（MAP.md、keep.test.ts、new.test.ts），合计 596 行。

```
git log --format='%h %s' a60d6e8..85bdf6c -- test/acceptance
```
只有 `452ba27 docs: issue v046-b40 task envelope`——全部来自信封提交，worker 没有动验收测试。

排除 `test/acceptance` 后受保护文件改动行数 = **0**。

### 3. 额外禁止文件

```
git diff a60d6e8..85bdf6c -- src/run.ts src/cli.ts src/view.ts src/arbiter.ts src/gate.ts 'src/roles/' 'src/runner/' docs/backlog-archive.md
```
全部无输出。worker 未动这些文件，也未创建或修改 `docs/backlog-archive.md`。

### 4. 依赖变化

```
git diff a60d6e8..85bdf6c -- package.json package-lock.json
```
无输出——无新增依赖。

### 5. 变异检查清单

`git diff a60d6e8..85bdf6c -- scripts/mutation.ts` 变动分析：
- 注释行 "Mutation list" 计数从 46 → 47 ✓
- 注释行 "Protected paths" 节内计数从 (10) → (11) ✓
- 新增一项 `protected:docs/backlog-archive.md`，共 6 行（name/file/original/replacement）✓
- **无删除项，无已有项被改写**

### 6. 验收命令实跑

| # | 命令 | 退出码 | 结果 |
|---|---|---|---|
| 1 | `npm run lint` | 0 | eslint + prettier 均通过 |
| 2 | `npm run typecheck` | 0 | tsc 零错误 |
| 3 | `npm test` | 0 | 82 test files, 1569 tests passed |
| 4 | `npm test -- test/acceptance/v046-b40` | 0 | 2 test files, 9 tests passed |
| 5 | `grep -qF "protected:docs/backlog-archive.md" scripts/mutation.ts` | 0 | 匹配到 |

## 逐条验收

| 验收项 | 命令 | 实测结果 | 通过 |
|---|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 | ✅ |
| 类型检查零错误 | `npm run typecheck` | exit 0 | ✅ |
| 全部测试通过 | `npm test` | exit 0, 82 files, 1569 tests | ✅ |
| 本批次验收测试通过 | `npm test -- test/acceptance/v046-b40` | exit 0, 2 files, 9 tests | ✅ |
| 变异清单有新项 | `grep -qF "protected:docs/backlog-archive.md" scripts/mutation.ts` | exit 0 | ✅ |

## 条目要求与额外禁止

### 条目 1 要求

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| 导出常量 `BACKLOG_ARCHIVE_RELATIVE_PATH`（`docs/backlog-archive.md`） | 条目 1 | `src/backlog.ts:17` — `export const BACKLOG_ARCHIVE_RELATIVE_PATH = join('docs', 'backlog-archive.md');` | ✅ |
| `loadBacklog` 在归档文件存在时两处都读 | 条目 1 | `src/backlog.ts:762-773` — `existsSync(archivePath)` → `readFileSync(archivePath, 'utf8')` | ✅ |
| 归档里的批次排在前面 | 条目 1 | `src/backlog.ts:809` — `return [...archiveBatches, ...mainBatches];` | ✅ |
| 依赖在两处的并集里核对 | 条目 1 | `src/backlog.ts:779-781` — `mainIds = extractOverviewIds(text, path)`, `archiveIds = extractOverviewIds(archiveText, archivePath)`, 分别传 `mainIds` 和 `archiveIds` 作为 `externalIds`；`src/backlog.ts:602` — `knownIds = new Set([...ids, ...externalIds])` | ✅ |
| 同一个批次号两处都有时报错（信息里有批次号与归档文件名） | 条目 1 | `src/backlog.ts:798-806` — `archiveIds.has(batch.id)` → `BacklogError(..., batch.id, 'batch also exists in ${BACKLOG_ARCHIVE_RELATIVE_PATH}')` | ✅ |
| 归档里的批次状态不是 `passed` 或 `blocked` 时报错（信息里有批次号） | 条目 1 | `src/backlog.ts:741` — `ARCHIVE_ALLOWED_STATUSES = new Set(['passed', 'blocked'])`；`src/backlog.ts:784-793` — 检查后抛 `BacklogError(archivePath, undefined, batch.id, ...)` | ✅ |
| `parseBacklog` 对单份文本的现有检查不变 | 条目 1 | `src/backlog.ts:592-596` — 新参数 `externalIds?: ReadonlySet<string>` 是可选的；无归档时调 `parseBacklog(text, path)` 不传（`src/backlog.ts:764`）；`npx vitest run test/backlog.test.ts` → 37 tests passed | ✅ |
| 行为：S1 归档+活跃两批次合并 | 条目 1 (S1) | `npx vitest run test/acceptance/v046-b40/new.test.ts` → Tests 6 passed | ✅ |
| 行为：S2 重复批次号报错 | 条目 1 (S2) | 同上 | ✅ |
| 行为：S3 归档里非法状态报错 | 条目 1 (S3) | 同上（2 个用例 pending+running） | ✅ |
| 行为：S4 队列模式跑通 | 条目 1 (S4) | 同上 | ✅ |
| 行为：S5 worker 改归档文件→spec_diff_lines>0 | 条目 1 (S5) | 同上 | ✅ |
| 行为：K1 无归档文件时不变 | 条目 1 (K1) | `npx vitest run test/acceptance/v046-b40/keep.test.ts` → Tests 3 passed | ✅ |
| 行为：K2 依赖不存在的批次→报错 | 条目 1 (K2) | 同上 | ✅ |
| 行为：K3 运行后归档文件逐字节不变 | 条目 1 (K3) | 同上 | ✅ |

### 条目 2 要求

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| `PROTECTED_PATHS` 加 `docs/backlog-archive.md` | 条目 2 | `src/evidence.ts:37` — `'docs/backlog-archive.md',` | ✅ |
| `scripts/mutation.ts` 加 `protected:docs/backlog-archive.md`，共 47 项 | 条目 2 | 注释行 `src/backlog.ts` → `scripts/mutation.ts:58` 写 "47 items"；`grep -qF` 验证通过；实际新增项在 mutation.ts 316-321 行 | ✅ |
| 注释里项数相应改 | 条目 2 | `scripts/mutation.ts:58` — "47 items"；`scripts/mutation.ts:279` — "Protected paths (11)" | ✅ |

### 条目 3 要求

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| `test/evidence.test.ts` 加测试 `counts docs/backlog-archive.md as protected (SPEC 16.27)` | 条目 3 | `test/evidence.test.ts:186-190` — 写 `docs/backlog-archive.md` 后检查 `spec_diff_lines` 为 1 | ✅ |
| `test/mutation.test.ts` 13 改 14 | 条目 3 | `test/mutation.test.ts:43` — `expect(protectedNames.length).toBe(14);` | ✅ |
| `test/invariants.test.ts` 加测试 `src/evidence.ts has docs/backlog-archive.md in PROTECTED_PATHS (v046-b40)` | 条目 3 | `test/invariants.test.ts:759-762` — 用例名精确匹配，断言 `expect(content).toContain("'docs/backlog-archive.md'")` | ✅ |
| 不许删断言、不许把断言改松 | 条目 3 | diff 中唯一被修改的断言：`expect(protectedNames.length).toBe(13)` → `.toBe(14)`——这是条目 3 点名允许的改写 | ✅ |

### 额外禁止

| 禁止项 | 出处 | 证据 | 满足 |
|---|---|---|---|
| 不改受保护路径 | 额外禁止 | `git diff --stat` 排除 test/acceptance 后无输出 | ✅ |
| 不新建/改动 `docs/backlog-archive.md` | 额外禁止 | `git diff ... -- docs/backlog-archive.md` 无输出 | ✅ |
| 不改 `src/run.ts` 等 | 额外禁止 | `git diff ... -- src/run.ts src/cli.ts src/view.ts src/arbiter.ts src/gate.ts 'src/roles/' 'src/runner/'` 无输出 | ✅ |
| `PROTECTED_PATHS` 不去掉已有项 | 额外禁止 | diff 中 `src/evidence.ts` 只有一行新增 `'docs/backlog-archive.md',`，无删除 | ✅ |
| 不删/跳过测试 | 额外禁止 | diff 中无 `.skip`、`.todo`；无用例被删除 | ✅ |
| 不新增依赖 | 额外禁止 | `package.json` 和 `package-lock.json` 无变化 | ✅ |

### 不变量数值变化

- `test/mutation.test.ts:43`: `expect(protectedNames.length).toBe(13)` → `.toBe(14)` —— 条目 3 点名允许的改写，对应新增 `protected:docs/backlog-archive.md`。
- `test/invariants.test.ts`: 无现有数值改动（只有新增用例）。
- 无其他不变量数值变化。

### 被改写或删去的断言

- `test/mutation.test.ts:43`: `expect(protectedNames.length).toBe(13)` → `.toBe(14)` — 原来守的是受保护路径变异项数 = 13，SPEC 新增 `docs/backlog-archive.md` 为受保护路径后需要变为 14。条目 3 点名允许。
- 无其他断言被删除或修改。

## 情形与验收测试

| 情形 | 对应的用例 | 断言的是不是情形写的结果 | 拿掉这个行为会不会失败 |
|---|---|---|---|
| S1 | `S1: returns exactly two batches in order, with depends_on populated` (new.test.ts:113) | 是：断言 `batches.length===2`、`[0].id==='v01-a01'`、`[1].id==='v01-b01'`、`[1].depends_on===['v01-a01']` | 是：不合并归档则只有一个批次且依赖解析会报错 |
| S2 | `S2: loadBacklog throws BacklogError with batch id and archive filename` (new.test.ts:155) | 是：断言 `instanceof BacklogError`、`message` 含 `v01-a01` 和 `backlog-archive.md` | 是：不做重复检测则不会抛错 |
| S3 | `S3: pending status...` + `S3: running status...` (new.test.ts:196, 219) | 是：均断言 `instanceof BacklogError` 且 `message` 含批次号 | 是：不做状态检查则不会抛错 |
| S4 | `S4: exit 0, backlog shows v99-b01 as passed` (new.test.ts:258) | 是：断言 exit=0 且 backlog 包含 `v99-b01.*passed` | 是：不合并归档则依赖解析失败 |
| S5 | `S5: exit 20, evidence.collected spec_diff_lines > 0` (new.test.ts:309) | 是：断言 exit=20 且 `spec_diff_lines > 0` | 是：不保护归档文件则 diff 行数=0 |
| K1 | `K1: loadBacklog returns exactly one batch` (keep.test.ts:99) | 是：断言 `batches.length===1`、`[0].id==='v01-b01'` | 是：回归会破坏单文件加载 |
| K2 | `K2: loadBacklog throws BacklogError with unknown batch id v00-x99` (keep.test.ts:126) | 是：断言 `instanceof BacklogError`、`message` 含 `v00-x99` | 是：移除未知依赖检查则不抛错 |
| K3 | `K3: backlog-archive.md content is identical before and after the run` (keep.test.ts:167) | 是：`archiveAfter === archiveBefore` 逐字节相等 | 是：若 runner 写了归档文件就不等了 |

S2 使用 `expect.assertions(3)`，S3 两个用例使用 `expect.assertions(2)`——若 `loadBacklog` 不抛错，测试因断言计数不匹配而失败。模式正确。

**测试缺口**：MAP.md 假定 S3 中"归档批次只允许 `passed` 状态"，但 task 明确写了 `passed` 或 `blocked`，代码实现正确（`ARCHIVE_ALLOWED_STATUSES` 包含两者），验收测试没有覆盖 `blocked` 作为合法状态的用例。这是测试 Agent 的遗漏，不影响 worker 的评判。

## 结论与理由

全部 5 条验收命令实跑通过。3 个条目的结构要求和行为要求逐条验证满足。
额外禁止项逐条核对无违反。受保护文件零改动（test/acceptance 来自信封提交）。
无新增依赖。变异清单只增不减。唯一改变的断言是条目 3 点名允许的 13→14。
情形与验收测试 S1-S5、K1-K3 全覆盖且断言有效。

测试缺口：验收测试未覆盖 `blocked` 作为归档文件的合法状态（MAP.md 假定只允许 `passed`）。转 R1。

结论：**PASS**。

```json
{
  "schema_version": 1,
  "batch_id": "v046-b40",
  "verdict": "PASS",
  "evidence": {
    "commits_actual": ["85bdf6c53f493550e9e4fbc1106328158f5ab960"],
    "verify_results": [
      { "cmd": "npm run lint", "exit_code": 0, "summary": "eslint + prettier passed" },
      { "cmd": "npm run typecheck", "exit_code": 0, "summary": "tsc zero errors" },
      { "cmd": "npm test", "exit_code": 0, "summary": "82 test files, 1569 tests passed" },
      { "cmd": "npm test -- test/acceptance/v046-b40", "exit_code": 0, "summary": "2 test files, 9 tests passed" },
      { "cmd": "grep -qF \"protected:docs/backlog-archive.md\" scripts/mutation.ts", "exit_code": 0, "summary": "pattern found" }
    ],
    "remote_has_head": false,
    "ci_conclusion": "unknown",
    "ci_run_url": "",
    "ci_branch_matched": null,
    "deps_diff": [],
    "spec_diff_lines": 0
  },
  "gaps": [],
  "reason": "All 5 acceptance commands pass. All 3 items implemented correctly: BACKLOG_ARCHIVE_RELATIVE_PATH exported, loadBacklog merges archive when present, duplicate batch / invalid status errors with correct messages, PROTECTED_PATHS and mutation list updated, tests added per spec. No protected files modified, no new dependencies, no forbidden files touched. 测试缺口：验收测试未覆盖 blocked 作为归档文件的合法状态（MAP.md 假定只允许 passed），转 R1。CI 以 R2 取证为准。"
}
```
