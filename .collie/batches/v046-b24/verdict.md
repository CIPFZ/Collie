Good - `opts` (which contains `signal`) is already passed to `scene.effect` via the `FakeSceneContext`, so the new test can access `opts.signal` without modifying `fake.ts`. The task mentioned this as a contingency ("假测试 agent 的场景拿不到中止信号时，可以给 `src/runner/fake.ts` 的场景上下文加上它"), but it wasn't needed.

Now I have all the evidence I need. Let me compile the verdict.

# 批次 v046-b24 审核

## 取证过程

### 1. 提交事实
```
git log --format='%H %s' 419ee096a084aa370389ea3ec8332411cb1d8a12..9798c8f8dd5e89d101eb368a914e206a7c7a86f0 -- . ':(exclude).collie/batches'
→ 9798c8f8dd5e89d101eb368a914e206a7c7a86f0 test: reviewer task.md from current run; tester wallclock uses worktree_secs (SPEC 16.18)
```

另一条提交 `cadeb3eaf686ac85c6db1a3e29531e17d4d22fc2` 是 `docs: issue v046-b24 task envelope`（R2 信封提交），不在取证范围。

远端推送状态：
```
git branch -r --contains 9798c8f8dd5e89d101eb368a914e206a7c7a86f0
→ origin/HEAD -> origin/main
  origin/main
```
已推送到 origin/main。

### 2. 受保护文件
```
git diff --stat 419ee09..9798c8f -- SPEC.md CONSTRAINTS.md ROADMAP.md ROLES.md 'AGENT-*.md' docs/backlog.md docs/decisions docs/progress.md .collie/collie.toml test/acceptance
→ （无输出）
```
无受保护文件被修改。

额外禁止文件：
```
git diff --stat 419ee09..9798c8f -- .github/ eslint.config.js vitest.config.ts package.json templates/collie.toml src/acceptance.ts src/redcheck.ts src/roles/ src/arbiter.ts src/gate.ts src/evidence.ts src/view.ts src/schema/index.ts
→ （无输出）
```
无额外禁止文件被修改。

### 3. 依赖变化
```
git diff 419ee09..9798c8f -- package.json package-lock.json
→ （无输出）
```
无依赖变化。

### 4. 验收命令实跑

**命令 1: `npm run lint`**
```
退出码: 0
输出: Checking formatting... All matched files use Prettier code style!
```

**命令 2: `npm run typecheck`**
```
退出码: 0
输出: (无错误)
```

**命令 3: `npm test`**
```
退出码: 0
输出: Test Files  70 passed (70) / Tests  1448 passed (1448)
```

**命令 4: `npm test -- test/reviewer-rerun.test.ts test/tester-step.test.ts`**
```
退出码: 0
输出: Test Files  2 passed (2) / Tests  27 passed (27)
```

**命令 5: `grep -qF "reviewer-rerun: task.md comes from the current run" test/reviewer-rerun.test.ts && grep -qF "tester wallclock uses worktree_secs" test/tester-step.test.ts`**
```
退出码: 0
```

### 5. 单独实跑新测试
```
npx vitest run test/reviewer-rerun.test.ts
→ Tests 14 passed (14)

npx vitest run test/tester-step.test.ts
→ Tests 13 passed (13)
```

## 逐条验收

| 验收项 | 命令 | 实测结果 | 通过 |
|---|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 | ✅ |
| 类型检查零错误 | `npm run typecheck` | exit 0 | ✅ |
| 全部测试通过 | `npm test` | exit 0, 1448 passed, 70 files | ✅ |
| 两个文件的测试通过 | `npm test -- test/reviewer-rerun.test.ts test/tester-step.test.ts` | exit 0, 27 passed, 2 files | ✅ |
| 新的一组与新的一条在 | `grep -qF …` | exit 0 | ✅ |

## 条目要求与额外禁止

### 条目 1：reviewer 读这一次运行的信封

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| `src/run.ts` 给 reviewer 准备工作目录的地方：task.md 换成主工作区里这一次运行的信封 | 条目 1 | `src/run.ts:250-256` — `copyFileSync(mainTaskPath, join(batchDir, 'task.md'))` 其中 `mainTaskPath = join(root, '.collie', 'batches', batchId, 'task.md')` | ✅ |
| 不用 head_sha 的树里的 | 条目 1 | `src/run.ts:252` — `mainTaskPath` 用的是 `root`（主工作区），不是 `dir`（worktree） | ✅ |
| 目录里仍然只有 task.md | 条目 1 | `src/run.ts:243-249` 先删非 task.md，再 `copyFileSync` 覆盖；测试 `test/reviewer-rerun.test.ts:398-399` 中 `expect(files).toEqual(['task.md'])` 断言通过 | ✅ |
| 第 2 次 reviewer 看到 attempt: 2 | 条目 1 | 行为要求：`npx vitest run test/reviewer-rerun.test.ts` → Tests 14 passed。测试 `test/reviewer-rerun.test.ts:430-434` "attempt 2 reviewer sees task.md with attempt: 2 frontmatter" 通过 | ✅ |
| 第 2 次 reviewer 看到「上一轮判 FIX」一节 | 条目 1 | 行为要求：同上。测试 `test/reviewer-rerun.test.ts:436-439` "attempt 2 reviewer sees '上一轮判 FIX' section in task.md" 通过 | ✅ |

### 条目 2：测试

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| 新加 describe `reviewer-rerun: task.md comes from the current run` | 条目 2 | `test/reviewer-rerun.test.ts:358` | ✅ |
| 照现有做法记下 reviewer 工作目录里的东西 | 条目 2 | `test/reviewer-rerun.test.ts:390-399` — 用 `readFileSync` 和 `readdirSync` 捕获内容，同现有做法 | ✅ |
| tester 删 `SPEC.md` 而非 `docs/progress.md` | 条目 2 | `test/tester-step.test.ts:355` — `rmSync(join(mainRoot, 'SPEC.md'))` | ✅ |
| 断言恢复之后内容与 HEAD 相同 | 条目 2 | `test/tester-step.test.ts:741-744` — `expect(diskContent).toBe(headContent)` | ✅ |
| 新加 `tester wallclock uses worktree_secs` | 条目 2 | `test/tester-step.test.ts:809` | ✅ |
| worktree_secs = 1, wallclock_secs 不动 | 条目 2 | `test/tester-step.test.ts:815-816` — 只替换 `worktree_secs` | ✅ |
| 不注入 testerSignal | 条目 2 | `test/tester-step.test.ts:851-852` — `box.run(runner, { redCheck })` 无 testerSignal 参数 | ✅ |
| 假测试 agent 等中止信号 | 条目 2 | `test/tester-step.test.ts:831-844` — 等待 `opts.signal` abort 事件 | ✅ |
| 以 tester_failed 上报，退出码 20 | 条目 2 | 行为要求：`npx vitest run test/tester-step.test.ts` → Tests 13 passed。`test/tester-step.test.ts:854` `expect(exit).toBe(20)` 通过；`test/tester-step.test.ts:858-860` `expect(escalated?.reason.startsWith('tester_failed')).toBe(true)` 通过 | ✅ |
| FIX then PASS 组加 `{ timeout: 300_000 }` | 条目 2 | `test/reviewer-rerun.test.ts:211` | ✅ |
| 新加的一组同样加上 300_000 | 条目 2 | `test/reviewer-rerun.test.ts:358` — `{ timeout: 300_000 }` | ✅ |
| 已有断言除点名的那一条外都不改 | 条目 2 | diff 中被删的 expect 仅 `docs/progress.md` → `SPEC.md` 替换（点名允许），无其他已有断言被删或改 | ✅ |

### 额外禁止

| 禁止 | 出处 | 证据 | 满足 |
|---|---|---|---|
| 改动任何受保护路径 | 额外禁止 | `git diff --stat` 无输出 | ✅ |
| 改动 `.github/`、`eslint.config.js` 等 | 额外禁止 | `git diff --stat` 无输出 | ✅ |
| 改动 `src/acceptance.ts`、`src/redcheck.ts` 等 | 额外禁止 | `git diff --stat` 无输出 | ✅ |
| reviewer 工作目录里出现 task.md 之外的信封文件 | 额外禁止 | 测试 `test/reviewer-rerun.test.ts:398-399` `expect(files).toEqual(['task.md'])` 通过 | ✅ |
| 为了让测试过而删除或跳过任何测试 | 额外禁止 | diff 无测试删除或 skip | ✅ |
| 为了让验收命令通过而改注释或字面 | 额外禁止 | diff 中无此类改动 | ✅ |
| 测试里拉起真实 runner 或真实网络请求 | 额外禁止 | 新测试使用 FakeRunner 和 Sandbox | ✅ |
| 新增依赖 | 额外禁止 | package.json 和 lock 文件无变化 | ✅ |

### 不变量数值变化

无。`git diff` 中无 `test/invariants.test.ts` 改动。

### 被改写或删去的断言

| 文件 | 用例 | 原断言 | 现断言 | SPEC 中仍有效 |
|---|---|---|---|---|
| `test/tester-step.test.ts` | `tester only deletes a tracked file → that file is restored, listed in tester.md` | `expect(existsSync(join(box.root, 'docs', 'progress.md'))).toBe(true)` | `expect(existsSync(join(box.root, 'SPEC.md'))).toBe(true)` | 是。这是点名允许的改写，断言不弱于原来（同样检查恢复存在性，且新增了内容匹配断言） |
| `test/tester-step.test.ts` | 同上 | `expect(testerMd).toContain('docs/progress.md')` | `expect(testerMd).toContain('SPEC.md')` | 是。同上 |

## 结论与理由

全部 5 条验收命令实跑通过。条目 1 的 `src/run.ts` 改动正确地从主工作区复制 task.md 到 reviewer worktree，条目 2 的所有新测试和修改后的测试均通过。受保护文件、禁止文件无改动。无新增依赖。diff 范围严格在 task.md 条目之内。已有断言仅做了点名允许的 `docs/progress.md` → `SPEC.md` 替换，且新增了更强的内容匹配断言。结论：PASS。

```json
{
  "schema_version": 1,
  "batch_id": "v046-b24",
  "verdict": "PASS",
  "evidence": {
    "commits_actual": ["9798c8f8dd5e89d101eb368a914e206a7c7a86f0"],
    "verify_results": [
      { "cmd": "npm run lint", "exit_code": 0, "summary": "All matched files use Prettier code style!" },
      { "cmd": "npm run typecheck", "exit_code": 0, "summary": "tsc -p tsconfig.json clean" },
      { "cmd": "npm test", "exit_code": 0, "summary": "70 files, 1448 passed" },
      { "cmd": "npm test -- test/reviewer-rerun.test.ts test/tester-step.test.ts", "exit_code": 0, "summary": "2 files, 27 passed" },
      { "cmd": "grep -qF \"reviewer-rerun: task.md comes from the current run\" test/reviewer-rerun.test.ts && grep -qF \"tester wallclock uses worktree_secs\" test/tester-step.test.ts", "exit_code": 0, "summary": "both patterns found" }
    ],
    "remote_has_head": true,
    "ci_conclusion": "unknown",
    "ci_run_url": "",
    "ci_branch_matched": null,
    "deps_diff": [],
    "spec_diff_lines": 0
  },
  "gaps": [],
  "reason": "All 5 acceptance commands pass. Code change in src/run.ts correctly copies task.md from the main workspace to the reviewer worktree (SPEC 16.18). New test group 'reviewer-rerun: task.md comes from the current run' verifies attempt: 2 frontmatter and '上一轮判 FIX' section. Tester test correctly changed from docs/progress.md to SPEC.md with added content verification. New 'tester wallclock uses worktree_secs' test verifies worktree_secs timeout with exit 20 and tester_failed escalation. Timeout increased to 300_000 on both describe blocks. No protected or forbidden files modified, no dependency changes, no assertions deleted or weakened. CI 以 R2 取证为准。"
}
```
