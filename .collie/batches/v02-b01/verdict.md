I now have all the evidence I need. Let me produce the verdict.

---

# 批次 v02-b01 审核

## 取证过程

### 1. 提交事实

```
$ git log --oneline f29432f577af057d80850690f8b5d02cba9a8ce6..99627610c0635880d069141500cbf8f0ae95f76a
9962761 ci: descendant attribution and per-run progress append
```

单个代码提交，scope `ci:`，内容与批次条目吻合。

```
$ git branch -r --contains 99627610c0635880d069141500cbf8f0ae95f76a
  origin/HEAD -> origin/main
  origin/main
```

head_sha 已推送到 `origin/main`。

### 2. 受保护文件检查

```
$ git diff --stat f29432f..9962761 -- SPEC.md CONSTRAINTS.md ROLES.md
（无输出）
```

受保护文件零改动。

### 3. 依赖变化检查

```
$ git diff f29432f..9962761 -- package.json package-lock.json
（无输出）
```

无依赖变化。

### 4. CI 实际结论

`gh` CLI 不可用（command not found），GitHub REST API 返回 rate limit exceeded。
无法从远端查询 head_sha 的 CI 运行状态。

CI 配置核对：
- `.github/workflows/ci.yml` 监听 `branches: [main]`
- `.collie/collie.toml` 中 `expected_branch = "main"`
- 二者一致。

结论：`ci_conclusion: unknown`，`ci_branch_matched: null`（未能取证）。

### 5. 验收命令逐条实跑

**命令 1：`npm run lint`**
```
> eslint . && prettier --check .
Checking formatting...
All matched files use Prettier code style!
```
退出码：0 ✓

**命令 2：`npm run typecheck`**
```
> tsc -p tsconfig.json
（无输出）
```
退出码：0 ✓

**命令 3：`npm test`**
```
 Test Files  25 passed (25)
      Tests  525 passed (525)
   Duration  6.34s
```
退出码：0 ✓

**命令 4：`npm test -- test/ci.test.ts`**
```
 Test Files  1 passed (1)
      Tests  48 passed (48)
   Duration  265ms
```
退出码：0 ✓

**命令 5：`test "$(grep -c 'v01-b05-smoke' docs/progress.md)" -ge 4`**
```
exit_code=0
```
实测 `grep -c 'v01-b05-smoke' docs/progress.md` = 5（4 个 `### ` 标题行 + 1 行 acceptance 命令内引用），≥ 4。退出码：0 ✓

### 6. diff 范围审查

改动文件（7 个）：

| 文件 | 变更 | 对应条目 |
|---|---|---|
| `src/ci.ts` +67 | `isEnvelopeOnlyDiff`、`DescendantCandidate`、`AttributedCiResult`、`queryCiWithAttribution` | 条目 1 |
| `src/evidence.ts` +29/-1 | `collectEvidence` 内 descendant attribution 内联逻辑，导入 `isEnvelopeOnlyDiff` 和 `diffNameOnly` | 条目 1 |
| `src/git.ts` +6 | `diffNameOnly` 函数（`git diff --name-only -z`） | 条目 1 支撑 |
| `src/progress.ts` +6/-1 | `applyEntry` filter 改为 `batchId · runId` 匹配，按运行追加而非按批次覆盖 | 条目 2 |
| `test/ci.test.ts` +136 | `isEnvelopeOnlyDiff` 4 个用例 + `queryCiWithAttribution` 6 个用例 | 条目 1 测试 |
| `test/progress.test.ts` +23/-7 | 修改 `entry` helper 支持 runId 参数，新增 "appends per run, not per batch" 测试 | 条目 2 测试 |
| `docs/progress.md` +33 | 回填 4 次 v01-b05-smoke 运行记录 | 条目 2 |

全部改动落在两个批次条目范围内，无范围蔓延。

### 7. 测试内容核验（三种 CI 归属情况）

task 要求：测试覆盖三种情况（自身运行 / 合规后代 / 改了代码的后代）。

在 `test/ci.test.ts` 的 `describe('ci: queryCiWithAttribution (SPEC 3.5)')` 中：

1. **自身运行**："uses head_sha own run when it exists (no descendant fallback)" — head_sha 有 run 时直接返回，不查后代。`attributedSha` 为 undefined。✓
2. **合规后代**："adopts a qualifying descendant when head_sha has no runs" — head_sha 无 run，后代 diff 只含 `.collie/` 和 `docs/progress.md`，采信后代 run。`attributedSha` 为后代 sha，`sha` 保持为 head_sha。✓
3. **改了代码的后代**："rejects a descendant that changed code files" — 后代 diff 含 `src/ci.ts`，不采信。返回空 runs。✓

额外覆盖 3 个边界：
- 跳过坏后代、采信下一个好后代 ✓
- 空后代列表 ✓
- 后代 CI 仍 pending，不采信 ✓

`isEnvelopeOnlyDiff` 独立测试 4 个用例：空 diff / .collie/ + progress.md / 含源码 / docs/backlog.md（不在白名单）。✓

### 8. progress.md 回填核验

4 个 `### v01-b05-smoke` 标题行：
1. `r-20261020-051154 · (中断)` — 中断运行
2. `r-20261020-060511 · BLOCK` — 无报告
3. `r-20261020-063533 · PASS` — reviewer 通过
4. `r-20261020-081526 · FIX` — 规则 9 降级

均位于 `<!-- collie:runs:start -->` 与 `<!-- collie:runs:end -->` 标记之间。按运行追加，不覆盖。

### 9. 代码观察（非缺口）

`queryCiWithAttribution` 在 `ci.ts` 中导出，但从未被任何生产模块 import——`evidence.ts` 的 `collectEvidence` 以内联方式实现了相同的后代归属逻辑（使用相同的 `isEnvelopeOnlyDiff` + `queryCi` 构件）。该函数目前仅作为可测试单元被 `test/ci.test.ts` 使用。这是代码结构选择，不影响正确性，且核心逻辑（`isEnvelopeOnlyDiff`、`queryCi`）在两条路径中共享。

## 逐条验收

| 验收项 | 命令 | 实测结果 | 通过 |
|---|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0，lint + prettier 均通过 | ✅ |
| 类型检查零错误 | `npm run typecheck` | exit 0，无输出 | ✅ |
| 全部测试通过 | `npm test` | exit 0，25 文件 525 测试全通过 | ✅ |
| CI 归属三种情况 | `npm test -- test/ci.test.ts` | exit 0，48 测试全通过 | ✅ |
| progress 含 4 次烟雾运行 | `test "$(grep -c 'v01-b05-smoke' docs/progress.md)" -ge 4` | exit 0，实测 5 ≥ 4 | ✅ |

## 声称与实测的差异

无（本批次未收到 report.md，我在干净的 head_sha worktree 中独立取证）。

## 结论与理由

**PASS。**

全部 5 条验收命令实跑通过。提交 `9962761` 存在且已推送至 `origin/main`。受保护文件零改动，无依赖变化。diff 范围严格落在 task.md 的两个条目之内，无范围蔓延。CI 归属三种情况的测试覆盖完整（自身运行 / 合规后代 / 改了代码的后代），progress.md 成功回填 4 次 v01-b05-smoke 运行记录。

CI 远端状态因 GitHub API rate limit 和 `gh` CLI 不可用而无法取证（`ci_branch_matched: null`）。CI workflow 配置（`branches: [main]`）与 collie.toml（`expected_branch = "main"`）一致，但实际运行状态无法确认。这与本项目已知问题一致（progress.md 已记录 "R4 用未鉴权 GitHub API 查 CI 在共享出口 IP 下不可用"）。

```json
{
  "schema_version": 1,
  "batch_id": "v02-b01",
  "verdict": "PASS",
  "evidence": {
    "commits_actual": ["99627610c0635880d069141500cbf8f0ae95f76a"],
    "verify_results": [
      { "cmd": "npm run lint", "exit_code": 0, "summary": "eslint + prettier clean" },
      { "cmd": "npm run typecheck", "exit_code": 0, "summary": "tsc clean" },
      { "cmd": "npm test", "exit_code": 0, "summary": "25 files, 525 passed, 0 failed" },
      { "cmd": "npm test -- test/ci.test.ts", "exit_code": 0, "summary": "1 file, 48 passed, 0 failed" },
      { "cmd": "test \"$(grep -c 'v01-b05-smoke' docs/progress.md)\" -ge 4", "exit_code": 0, "summary": "5 >= 4" }
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
  "reason": "全部 5 条验收命令实跑通过；提交已推送至 origin/main；受保护文件与依赖均无变化；CI 归属三种情况测试覆盖完整；progress 回填 4 次烟雾运行；CI 远端状态因 API rate limit 无法取证"
}
```
