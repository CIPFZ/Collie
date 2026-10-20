I now have all the evidence needed. Let me compile the complete verdict.

# 批次 v01-b05-smoke 审核

## 取证过程

### 1. 批次 diff 范围检查

```
$ git log ebf8c943dd0d31f53bdb13ed05eb90e7c13f2612..ebf8c943dd0d31f53bdb13ed05eb90e7c13f2612 --oneline
（无输出）

$ git diff ebf8c943dd0d31f53bdb13ed05eb90e7c13f2612..ebf8c943dd0d31f53bdb13ed05eb90e7c13f2612
（无输出）
```

**关键发现：base\_sha 与 head\_sha 是同一个 SHA (`ebf8c943`)。diff 范围为空，worker 本次运行产出了零个提交。**

`ebf8c94` 本身是任务信封提交（`docs: issue v01-b05-smoke task envelope`），仅改了 `.collie/batches/v01-b05-smoke/task.md`，不包含任何 worker 工作产物。

### 2. 历史溯源：README 行的来源

README 末尾确实包含 `Collie 用 Collie 跑过的第一个批次：v01-b05-smoke`，但此行来自**之前的尝试**：

```
$ git show --stat b75aa31
commit b75aa31f1d9e9e24ccf1d78ec319ea81d0283bfa
Author: tonynyyan <tonynyyan@tencent.com>
Date:   Tue Oct 20 14:39:27 2026 +0800

    docs: append first Collie-run batch marker to README
    Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>

 README.md | 2 ++
 1 file changed, 2 insertions(+)
```

该提交 (`b75aa31`) 是 `ebf8c94` 的祖先，中间隔了 6 个提交（包括 arbiter 规则修改、进度更新、SPEC 修订、新任务信封）。这意味着 README 行在本批次签发之前就已存在。

### 3. 验收命令逐条实跑

**命令 1：`npm test`**
```
$ npm test
 RUN  v5.0.5

 Test Files  25 passed (25)
      Tests  512 passed (512)
   Duration  6.41s
```
退出码：0。但这是先前累积状态的结果，与本批次 worker 无关（worker 未改任何文件）。

**命令 2：`grep -q "第一个批次：v01-b05-smoke" README.md`**
退出码：0。行确实存在，但来源是之前的尝试（`b75aa31`），不是本批次 worker 的产出。

**命令 3：`test "$(git diff --name-only HEAD~1 HEAD)" = "README.md"`**
```
$ git diff --name-only HEAD~1 HEAD
.collie/batches/v01-b05-smoke/task.md
```
退出码：1。**失败。** HEAD (`ebf8c94`) 改的是 `task.md`（任务信封），不是 `README.md`。worker 本次未产出任何提交，因此不存在一个「只改了 README」的 HEAD 提交。

### 4. 提交与推送状态

```
$ git ls-remote origin | head -5
fe8cf23  HEAD
fe8cf23  refs/heads/main

$ git branch -r --contains ebf8c943
  origin/HEAD -> origin/main
  origin/main
```

`head_sha`（`ebf8c94`）是 remote main（`fe8cf23`）的祖先，已推送。`fe8cf23` 是 `report(collie): v01-b05-smoke` 信封提交，按 SPEC 3.4 不在取证范围内。

### 5. CI 状态

```
$ gh run list ...
/bin/bash: line 1: gh: command not found
```

`gh` CLI 不可用，无法查询 CI 运行状态。`ci_conclusion` 记为 `unknown`，`ci_branch_matched` 记为 `null`。

### 6. 受保护文件检查

```
$ git diff --stat ebf8c94..ebf8c94 -- SPEC.md CONSTRAINTS.md
（无输出）
```

diff 为空，无受保护文件被修改。（因为 worker 未产出任何提交。）

### 7. 依赖变化

```
$ git diff ebf8c94..ebf8c94 -- package.json package-lock.json
（无输出）
```

无依赖变化。（同上理由。）

## 逐条验收

| 验收项 | 命令 | 实测结果 | 通过 |
|---|---|---|---|
| 全部测试通过 | `npm test` | 512 passed, exit 0 | ✅ (但 worker 未改代码，此为先前状态) |
| README 已追加该行 | `grep -q "第一个批次：v01-b05-smoke" README.md` | exit 0 | ✅ (行来自之前的尝试 `b75aa31`，非本批次产出) |
| 只改了 README | `test "$(git diff --name-only HEAD~1 HEAD)" = "README.md"` | exit 1，HEAD 改的是 task.md | ❌ |

## 声称与实测的差异

无法核对——因为 diff 为空（worker 声称的 head\_sha 等于 base\_sha），本批次不存在 worker 产出的代码提交，因此无法比对 worker 的 claims 与实测。worker 的 report.md 按审核手册要求不读取，但基于 diff 范围可确认：worker 在本次执行中未产出任何新提交。

## 结论与理由

**FIX。**

核心问题：**worker 本次运行产出零个提交**（base\_sha == head\_sha == `ebf8c943`），diff 范围为空。

三条验收标准中，命令 1 和命令 2 之所以通过，完全是因为先前尝试（`b75aa31`）遗留的状态已经满足条件，而非本批次 worker 的工作成果。命令 3 明确失败（exit 1），因为 HEAD 提交改的是 task.md（任务信封），而非 README.md。

具体缺口清单：
1. **Worker 必须实际产出至少一个提交**，使 head\_sha ≠ base\_sha，且该提交仅修改 `README.md`
2. **验收命令 3 必须通过**：worker 的提交应成为 HEAD，`git diff --name-only HEAD~1 HEAD` 应仅输出 `README.md`
3. **CI 无法验证**：`gh` CLI 不可用，CI 状态未知；重跑时需确保可验证 CI

```json
{
  "schema_version": 1,
  "batch_id": "v01-b05-smoke",
  "verdict": "FIX",
  "evidence": {
    "commits_actual": [],
    "verify_results": [
      { "cmd": "npm test", "exit_code": 0, "summary": "512 passed, 0 failed (25 test files). But worker made no commits; this is pre-existing state." },
      { "cmd": "grep -q \"第一个批次：v01-b05-smoke\" README.md", "exit_code": 0, "summary": "Line exists from prior attempt b75aa31, not from this batch run." },
      { "cmd": "test \"$(git diff --name-only HEAD~1 HEAD)\" = \"README.md\"", "exit_code": 1, "summary": "FAILED. HEAD commit (ebf8c94) changed .collie/batches/v01-b05-smoke/task.md, not README.md. Worker produced zero commits." }
    ],
    "remote_has_head": true,
    "ci_conclusion": "unknown",
    "ci_run_url": "",
    "ci_branch_matched": null,
    "deps_diff": [],
    "spec_diff_lines": 0
  },
  "claim_mismatches": [],
  "gaps": [
    "Worker produced zero commits (base_sha == head_sha == ebf8c943). Must produce at least one commit that modifies only README.md.",
    "Acceptance command 3 fails (exit 1): HEAD~1..HEAD shows task.md change, not README.md. Worker's commit must be HEAD and change only README.md.",
    "CI status could not be verified (gh CLI unavailable). On re-run, ensure CI can be queried."
  ],
  "reason": "Diff range is empty — worker produced no commits this attempt. Acceptance command 3 explicitly fails. Commands 1 and 2 pass only due to pre-existing state from a prior attempt (b75aa31), not from this batch's worker output."
}
```
