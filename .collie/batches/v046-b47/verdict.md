I have all the evidence I need. Let me compile the verdict.

# 批次 v046-b47 审核

## 取证过程

### 1. 验收命令实跑

**命令 1：`npm run lint`**
```
> collie@0.1.0 lint
> eslint . && prettier --check .
Checking formatting...
All matched files use Prettier code style!
```
退出码：0 ✓

**命令 2：`npm run typecheck`**
```
> collie@0.1.0 typecheck
> tsc -p tsconfig.json
```
退出码：0 ✓

**命令 3：`npm test`**
```
 Test Files  96 passed (96)
      Tests  1634 passed (1634)
   Duration  29.67s
```
退出码：0 ✓

**命令 4：`npm test -- test/acceptance/v046-b47`**
```
 Test Files  2 passed (2)
      Tests  6 passed (6)
   Duration  987ms
```
退出码：0 ✓

### 2. 提交事实

```
git log --oneline 9c098ef..0dd48b1 -- . ':(exclude).collie/batches'
0dd48b1 roles: reviewer prompt no longer asks to rerun acceptance commands when evidence is provided
0c465af docs: issue v046-b47 task envelope
```

Worker 的提交是 `0dd48b11ad95ca972cffe9a8284e23cc88581917`，只改 `src/roles/reviewer.ts`。
`0c465af` 是测试 agent 的信封提交（`docs: issue` 开头），只加了 `test/acceptance/v046-b47/` 下的文件。

`git rev-parse 0dd48b11ad95ca972cffe9a8284e23cc88581917` 确认提交存在。
`git ls-remote` 在此 worktree 环境下未找到 head_sha（worktree 隔离），R2 取证确认已推送。

### 3. 受保护路径

```
git diff --stat 9c098ef..0dd48b1 -- SPEC.md CONSTRAINTS.md ROADMAP.md ROLES.md 'AGENT-*.md' docs/backlog.md docs/backlog-archive.md docs/decisions docs/progress.md .collie/collie.toml test/acceptance .github eslint.config.js vitest.config.ts
```

输出中只有 `test/acceptance/v046-b47/` 下的 3 个文件（MAP.md、keep.test.ts、new.test.ts），全部来自 `docs: issue` 开头的信封提交 `0c465af`，不是 worker 的改动。

Worker 是否动了验收测试：
```
git log --format='%h %s' 9c098ef..0dd48b1 -- test/acceptance
0c465af docs: issue v046-b47 task envelope
```
只有 `docs: issue` 开头的提交，worker 没有碰验收测试。✓

受保护文件改动行数（worker 产出）：**0**。

### 4. 依赖变化

`git diff 9c098ef..0dd48b1 -- package.json package-lock.json`：无输出。**0 项**。

### 5. 变异检查清单

`git diff 9c098ef..0dd48b1 -- scripts/mutation.ts`：无输出。**未改动**。

### 6. 不变量数值变化

`git diff 9c098ef..0dd48b1 -- test/invariants.test.ts`：无输出。**无**。

### 7. 被改写或删去的断言

Worker 没有修改任何现有测试文件：
```
git diff 9c098ef..0dd48b1 -- 'test/**' ':(exclude)test/acceptance/v046-b47'
```
无输出。**无**。

### 8. 范围检查

Worker 只改了 `src/roles/reviewer.ts`（+14 行，-2 行），未改任何其他 src/ 文件：
```
git diff 9c098ef..0dd48b1 -- 'src/**' ':(exclude)src/roles/reviewer.ts'
```
无输出。✓

## 逐条验收

| 验收项 | 命令 | 实测结果 | 通过 |
|---|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0, All matched files use Prettier code style! | ✓ |
| 类型检查零错误 | `npm run typecheck` | exit 0 | ✓ |
| 全部测试通过 | `npm test` | exit 0, 1634 passed, 0 failed | ✓ |
| 本批次验收测试 | `npm test -- test/acceptance/v046-b47` | exit 0, 6 passed, 0 failed | ✓ |

## 条目要求与额外禁止

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| 输入带 evidence 时，验收命令标题下两行换成 SPEC 16.31 代码块里的两行 | 条目 1 / SPEC 16.31 | `src/roles/reviewer.ts:137-139`：`data.evidence !== undefined` 时插入 `'以下命令 R2 已经实跑过，结果在下面「R2 的取证结果」一节，不用重跑。'` 和 `'要看某条命令的完整输出、或者做别的核对时可以再跑：命令取这里的形式，不要从任何 \`.md\` 源码复制。'`，与 SPEC 3246-3247 行逐字相同 | ✓ |
| 输出一节末尾多一行 ``JSON 块里不要写 `evidence`：证据以 R2 的取证结果为准。`` | 条目 1 / SPEC 16.31 | `src/roles/reviewer.ts:160`：`'JSON 块里不要写 \`evidence\`：证据以 R2 的取证结果为准。'`，与 SPEC 3251 行逐字相同 | ✓ |
| 命令清单与别的小节不变 | 条目 1 | `src/roles/reviewer.ts:146-149`：`data.acceptance.map(...)` 未改；diff 显示 acceptance.map 和其他 sections 都未动 | ✓ |
| 输入不带 evidence 时提示词逐字节相同 | 条目 1 / SPEC 16.31 | `src/roles/reviewer.ts:141-143`：else 分支原样保留旧的两行；`src/roles/reviewer.ts:159-161`：else 分支为空数组。K1 测试通过确认 | ✓ |
| 不改别的文件 | 条目 2 | `git diff --stat` 只有 `src/roles/reviewer.ts`（worker commit）；`git diff -- 'src/**' ':(exclude)src/roles/reviewer.ts'` 无输出 | ✓ |
| 已有断言一条都不改 | 条目 2 | `git diff -- 'test/**' ':(exclude)test/acceptance/v046-b47'` 无输出 | ✓ |
| 禁止改动受保护路径（含 AGENT-reviewer.md） | 额外禁止 | `git diff --stat` 受保护路径只有 test agent 的 docs:issue 提交 | ✓ |
| 禁止改动 src/roles/reviewer.ts 之外的 src/ 文件 | 额外禁止 | `git diff -- 'src/**' ':(exclude)src/roles/reviewer.ts'` 无输出 | ✓ |
| 禁止把 worker 的汇报、claims 或其任何部分放进提示词 | 额外禁止 | `src/roles/reviewer.ts:33-43`：ReviewerInputSchema 仍然是 strictObject，没有 report/claims 字段；diff 只添加了条件分支和三行文字 | ✓ |
| 禁止改提示词里别的小节或命令清单的写法 | 额外禁止 | diff 仅改了「验收命令」节的说明行（+条件分支）和「输出」节末尾（+条件分支），其他节（取证范围、条目、SPEC 章节）未动 | ✓ |
| 禁止为了让测试过而删除或跳过任何测试 | 额外禁止 | 无现有测试被删除或跳过 | ✓ |
| 禁止为了让验收命令过而改注释或字面 | 额外禁止 | 改动全是逻辑代码 | ✓ |
| 禁止测试里拉起真实 runner 或真实网络请求 | 额外禁止 | 新测试使用 FakeRunner 和 Sandbox，无真实网络 | ✓ |
| 禁止新增依赖 | 额外禁止 | package.json/lock 无变化 | ✓ |

## 情形与验收测试

| 情形 | 对应的用例 | 断言的是不是情形写的结果 | 拿掉这个行为会不会失败 |
|---|---|---|---|
| S1 [新] 带 evidence → 没有「逐条原样实跑」，有「R2 已经实跑过」那行 | `new.test.ts` S1: `expect(prompt).not.toContain('逐条原样实跑')` + 精确匹配那行 | 是——断言了 not.toContain 和精确行匹配 | 是——如果不替换那两行，prompt 仍会含「逐条原样实跑」→ not.toContain 失败 |
| S2 [新] 同输入 → 有「JSON 块里不要写」 | `new.test.ts` S2: `expect(prompt).toContain('JSON 块里不要写')` | 是——直接断言包含 | 是——如果不加那一行，prompt 里不会有这段文字 → toContain 失败 |
| S3 [新] sandbox 跑一次 → reviewer prompt 没有「逐条原样实跑」 | `new.test.ts` S3: `expect(prompt).not.toContain('逐条原样实跑')` | 是——断言 reviewer 拿到的 prompt 不含旧文字 | 是——sandbox 中 R2 会传 evidence 给 reviewer，如果不做条件分支，prompt 仍含「逐条原样实跑」→ 失败 |
| K1 [保持] 不带 evidence → 有「逐条原样实跑」，没有「R2 已经实跑过」，没有「JSON 块里不要写」 | `keep.test.ts` K1: 三条断言 | 是——精确匹配三个条件 | 是——如果错误地在无 evidence 时也替换了文字，toContain('逐条原样实跑') 失败 |
| K2 [保持] 带 evidence + 特定 cmd → prompt 有 cmd 原文、有 `## 验收命令`、有 `## R2 的取证结果` | `keep.test.ts` K2: toContain cmd、精确行匹配两个标题 | 是——验证命令清单保留、两个小节标题存在 | 是——如果命令清单被删或标题被改，断言失败 |
| K3 [保持] S3 那次运行 → exit 0、顺序是 worker→reviewer | `keep.test.ts` K3: `expect(exitCode).toBe(0)` + role 检查 | 是——断言退出码和调用顺序 | 是——退出码非 0 或顺序错误时失败 |

所有 6 条情形的验收测试都能守住对应行为。无测试缺口。

## 结论与理由

全部 4 条验收命令实跑通过。worker 只修改了 `src/roles/reviewer.ts`，改动精确匹配 SPEC 16.31 要求的两处变化（验收命令说明行的条件替换、输出节末尾的条件追加），且无 evidence 时 prompt 保持不变（通过 K1 测试验证）。无受保护文件被修改，无依赖变化，无变异检查清单变动，无已有断言被改写。6 条情形的验收测试全部精确断言对应行为且能守住。

**PASS**。

```json
{
  "schema_version": 1,
  "batch_id": "v046-b47",
  "verdict": "PASS",
  "evidence": {
    "commits_actual": ["0dd48b11ad95ca972cffe9a8284e23cc88581917"],
    "verify_results": [
      { "cmd": "npm run lint", "exit_code": 0, "summary": "All matched files use Prettier code style!" },
      { "cmd": "npm run typecheck", "exit_code": 0, "summary": "tsc -p tsconfig.json" },
      { "cmd": "npm test", "exit_code": 0, "summary": "96 files, 1634 passed, 0 failed" },
      { "cmd": "npm test -- test/acceptance/v046-b47", "exit_code": 0, "summary": "2 files, 6 passed, 0 failed" }
    ],
    "remote_has_head": true,
    "ci_conclusion": "unknown",
    "ci_run_url": "",
    "ci_branch_matched": null,
    "deps_diff": [],
    "spec_diff_lines": 0
  },
  "gaps": [],
  "reason": "CI 以 R2 取证为准。全部验收命令通过，代码改动精确匹配 SPEC 16.31 要求，无 evidence 时提示词不变，6 条情形验收测试全部通过且守得住。"
}
```
