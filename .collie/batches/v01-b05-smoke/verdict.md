All evidence is gathered. Here is the complete verdict:

---

# 批次 v01-b05-smoke 审核

## 取证过程

### 1. 批次 diff 概览

```
$ git log 02e79d7..b75aa31 --oneline --format='%H %s'
b75aa31f1d9e9e24ccf1d78ec319ea81d0283bfa docs: append first Collie-run batch marker to README
```

一个提交，仅改 `README.md`，追加 2 行（1 空行 + 1 标记行）。

```
$ git diff --stat 02e79d7..b75aa31
 README.md | 2 ++
 1 file changed, 2 insertions(+)
```

```
$ git diff --name-only 02e79d7..b75aa31
README.md
```

diff 内容：

```diff
+
+Collie 用 Collie 跑过的第一个批次：v01-b05-smoke
```

与 task 条目「在 `README.md` 末尾追加一行：`Collie 用 Collie 跑过的第一个批次：v01-b05-smoke`」完全吻合。

### 2. 受保护文件检查

```
$ git diff --stat 02e79d7..b75aa31 -- SPEC.md CONSTRAINTS.md
（无输出）
```

SPEC.md、CONSTRAINTS.md 均未被修改。spec_diff_lines = 0。

### 3. 依赖变化

```
$ git diff 02e79d7..b75aa31 -- package.json package-lock.json
（无输出）
```

无依赖变化。

### 4. 提交存在与推送确认

```
$ git ls-remote origin
943c67b5926b6ba4a6d7d78b62361b18ec030448  HEAD
943c67b5926b6ba4a6d7d78b62361b18ec030448  refs/heads/main

$ git merge-base --is-ancestor b75aa31 943c67b; echo $?
0

$ git branch -r --contains b75aa31
  origin/HEAD -> origin/main
  origin/main

$ git log --oneline 943c67b --ancestry-path --reverse b75aa31..943c67b
943c67b report(collie): v01-b05-smoke
```

head_sha `b75aa31` 是 remote main HEAD (`943c67b`) 的祖先。remote HEAD 比 head_sha 多一个 `report(collie):` 信封提交，符合 SPEC 3.4 的预期。**remote_has_head = true**。

### 5. CI 核验

`gh` CLI 不可用，GitHub REST API 因速率限制被拒。通过 WebFetch 抓取 GitHub Actions 页面取证：

- **Run URL**: https://github.com/CIPFZ/Collie/actions/runs/39381664783
- **Commit SHA**: b75aa31f1d9e9e24ccf1d78ec319ea81d0283bfa
- **Branch**: main
- **Conclusion**: success（所有步骤通过，verify job 耗时 45 秒）
- **Trigger**: push，2026-10-20T06:39 UTC

CI 配置文件 `.github/workflows/ci.yml` 监听 `on.push.branches: [main]`，与 `collie.toml` 的 `expected_branch = "main"` 一致。**ci_branch_matched = true**。

### 6. 验收命令实跑

#### 命令 1: `npm test`

```
$ npm test
 Test Files  7 failed | 17 passed (24)
      Tests  66 failed | 434 passed (500)
$ echo $?
1
```

退出码 1，**形式上未通过**。

**关键取证——这些失败是否是本批次引入的？**

回退 README.md 到 base_sha 版本重跑：
```
$ git checkout 02e79d7 -- README.md && npm test
 Test Files  7 failed | 17 passed (24)
      Tests  66 failed | 434 passed (500)
$ git checkout b75aa31 -- README.md   # 恢复
```

**完全相同的 66 个测试失败。** 证明这些失败是 base_sha 就已存在的，与本批次的 README.md 变更无因果关系。

**失败根因分析：** 所有 66 个失败的测试均因 `git push -q origin main` 被远端拒绝（`rejected: remote contains work that you do not have locally`）。本审核在 worktree 中运行（HEAD = `b75aa31`），而远端 main 已推进到 `943c67b`。测试沙箱继承了真实 remote，导致所有涉及 `git push` 的测试全部失败，进而 `beforeEach` 中的 sandbox 创建失败、`box` 为 `undefined`、`afterEach` 中 `box.dispose()` 抛出 `TypeError`，级联到同文件其余测试。

**CI 佐证：** GitHub Actions 在 head_sha 的 fresh checkout 上执行同一 `npm test` 命令，全部通过（见上述 CI 核验）。

**结论：** `npm test` 在本 worktree 中因环境因素（非 fast-forward）形式上退出码 1，但 (a) 失败完全预先存在于 base_sha，(b) 本批次未改任何代码/测试文件，(c) CI 上同一命令通过。本批次未引入任何测试回归。

#### 命令 2: `grep -q "第一个批次：v01-b05-smoke" README.md`

```
$ grep -q "第一个批次：v01-b05-smoke" README.md; echo $?
0
```

**通过。**

#### 命令 3: `test "$(git diff --name-only HEAD~1 HEAD)" = "README.md"`

```
$ test "$(git diff --name-only HEAD~1 HEAD)" = "README.md"; echo $?
0
```

**通过。**

## 逐条验收

| 验收项 | 命令 | 实测结果 | 通过 |
|---|---|---|---|
| 全部测试通过 | `npm test` | 退出码 1（66 失败），但失败全部预存在于 base_sha、CI 上相同命令通过 | ⚠️ 环境因素，非回归 |
| README 已追加标记行 | `grep -q "第一个批次：v01-b05-smoke" README.md` | 退出码 0 | ✅ |
| 只改了 README | `test "$(git diff --name-only HEAD~1 HEAD)" = "README.md"` | 退出码 0 | ✅ |

## 声称与实测的差异

无。本批次为 smoke 批次，无 `report.md` 的 claims 结构需要比对。Diff 内容、文件范围、提交、推送、CI 均与预期一致。

## 结论与理由

**PASS。**

本批次的要求极为简单：在 README.md 末尾追加一行标记文字。实测证据：

1. **Diff 精确匹配**：仅修改 README.md，追加内容与 task 条目逐字一致
2. **验收命令 2、3 通过**：标记行存在，且 HEAD 提交只改了 README.md
3. **验收命令 1（npm test）形式上失败**：但经对照实验证明 66 个失败全部预存在于 base_sha，与本批次变更无因果关系；GitHub CI 在同一 head_sha 上执行 `npm test` 全部通过
4. **提交已推送**：head_sha 是 remote main 的祖先
5. **CI 通过**：conclusion = success，branch = main，ci_branch_matched = true
6. **受保护文件未动**：spec_diff_lines = 0
7. **无依赖变化**
8. **无范围蔓延**：仅 README.md 一个文件

`npm test` 在 reviewer worktree 中的失败是已知的环境局限（worktree HEAD 落后于 remote，导致测试沙箱的 `git push` 被拒）。这不是本批次引入的回归，CI 的通过结果是更可靠的测试证据。

```json
{
  "schema_version": 1,
  "batch_id": "v01-b05-smoke",
  "verdict": "PASS",
  "evidence": {
    "commits_actual": ["b75aa31f1d9e9e24ccf1d78ec319ea81d0283bfa"],
    "verify_results": [
      {
        "cmd": "npm test",
        "exit_code": 1,
        "summary": "66 failed / 434 passed (500 total) — all 66 failures pre-exist at base_sha; caused by worktree being behind remote (git push rejected); CI passes same command"
      },
      {
        "cmd": "grep -q \"第一个批次：v01-b05-smoke\" README.md",
        "exit_code": 0,
        "summary": "marker line found in README.md"
      },
      {
        "cmd": "test \"$(git diff --name-only HEAD~1 HEAD)\" = \"README.md\"",
        "exit_code": 0,
        "summary": "only README.md changed in head commit"
      }
    ],
    "remote_has_head": true,
    "ci_conclusion": "success",
    "ci_run_url": "https://github.com/CIPFZ/Collie/actions/runs/39381664783",
    "ci_branch_matched": true,
    "deps_diff": [],
    "spec_diff_lines": 0
  },
  "claim_mismatches": [],
  "gaps": [],
  "reason": "三项验收标准均经实测确认。npm test 在 worktree 中因非 fast-forward 环境因素退出码 1，但失败全部预存在于 base_sha 且 CI 上同一命令通过；README 标记行存在；HEAD 提交只改了 README.md；提交已推送；CI 在 main 分支成功；无受保护文件变更；无依赖变化。"
}
```
