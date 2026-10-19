# 批次 v01-b02 审核

审核者：R4（由 R1 所在会话以干净上下文占位执行）
审核对象：`b68d23b..e30c4ee`（worker 的 4 个代码提交；`f21b664` 为信封提交，不在取证范围）
审核时间：2026-10-16

## 取证过程

全部为实跑命令，未采信汇报。

| 取证项 | 命令 | 真实结果 |
|---|---|---|
| 提交存在于远端 | `git fetch && git log 4a690f5..origin/main` | `0ff9ef5` `8e7dbd4` `4785816` `e30c4ee` + 信封 `f21b664`，与声称一致 |
| 受保护文件 | `git diff --stat b68d23b..e30c4ee -- SPEC.md … .collie/collie.toml` | 空，零触碰 |
| 改动范围 | `git diff --stat b68d23b..e30c4ee` | 17 文件，全在 `src/` `test/` 与 lint 配置，无越界 |
| 验收 1~3 | `npm run lint` / `typecheck` / `npm test` | 全部 exit 0 |
| 测试数 | `npm test` | **236 passed / 0 failed**，10 文件 |
| 验收 4~7 | 四个 `npm test -- test/<file>` | 全部 exit 0 |
| 验收 8 | `test -d src/roles && ! grep -rE …`（解析后形式） | exit 0 |
| 新增依赖 | `git diff package.json` | 仅 `yaml ^2.9.1`，ISC |
| 强 copyleft | 全树扫描 GPL/SSPL | 无 |
| import 隔离（变异 1） | `src/roles/worker.ts` 追加 `import fake` 后 eslint | `no-restricted-imports` 1 error |
| import 隔离（变异 2） | `src/backlog.ts` 追加 `import @anthropic-ai/*` 后 eslint | `no-restricted-imports` 1 error |
| fake 承载 b03 场景 | `grep files\|effect\|expectRole src/runner/fake.ts` | 三种能力均实现 |
| 裁决项 1 事实 | 原样复制含 `\|` 的 grep 对违规代码执行 | **exit 0，放行**。声称成立 |
| 裁决项 2 事实 | 解析 b01 report 尾部 JSON | `schema_version: 1`，无 `ci_passed`。声称成立 |
| CI 实际结论 | GitHub API | 未查（上轮配额耗尽未恢复），待项目所有者目视确认 4 个代码提交 |

## 逐条验收

| 验收项 | 通过 |
|---|---|
| 8 条命令 | 全部通过 |
| 测试内容覆盖 task 要求 | **超出要求**：backlog-reject 20 个用例（含交叉核对、重复 id、列重排、代码 span 校验）；readReport 8 个边界（含截断、跨批次、不安全 id）；runner 崩溃传播与工具列表不可变 |
| 铁律 15 物理隔离 | 通过，两个变异均被拦下 |
| 铁律 19 信封交接 | 通过，`report(collie): v01-b02` 单独提交 |
| 铁律 13（ADR-003） | 通过，运行时树干净 |

## 声称与实测的差异

无。4 个代码 SHA、236/0、8 条验收、`new_deps=["yaml"]`、`spec_touched=false`、裁决项 1 与 2 的事实——全部与实测一致。

## 本轮发现的流程缺口（非 worker 过失）

1. 验收命令在 Markdown 源码中的 `\|` 转义与 shell 原样执行语义冲突（裁决项 1）
2. SPEC 3.4 加字段未 bump `SCHEMA_VERSION`，违反铁律 14，是 R1 的过失（裁决项 2）
3. `wallclock_secs` 在 v0.1 无执行点（留 b03）

## 结论与理由

**PASS，附条件**：4 个代码提交的 CI 结论待项目所有者目视确认。
其余全部验收项由实测证据支持，无声称不符，无范围蔓延，测试质量超出要求，
两处变异测试证实隔离物理生效。

```json
{
  "schema_version": 1,
  "batch_id": "v01-b02",
  "verdict": "PASS",
  "evidence": {
    "commits_actual": ["0ff9ef5", "8e7dbd4", "4785816", "e30c4ee"],
    "verify_results": [
      { "cmd": "npm run lint", "exit_code": 0, "summary": "clean" },
      { "cmd": "npm run typecheck", "exit_code": 0, "summary": "clean" },
      { "cmd": "npm test", "exit_code": 0, "summary": "236 passed, 0 failed" },
      { "cmd": "npm test -- test/backlog.test.ts", "exit_code": 0, "summary": "pass" },
      { "cmd": "npm test -- test/backlog-reject.test.ts", "exit_code": 0, "summary": "pass, 20 cases" },
      { "cmd": "npm test -- test/worker.test.ts", "exit_code": 0, "summary": "pass, 14 cases" },
      { "cmd": "npm test -- test/task-envelope.test.ts", "exit_code": 0, "summary": "pass" },
      { "cmd": "test -d src/roles && ! grep -rE \"from ['\\\"](@anthropic-ai|\\.\\./runner/fake|\\./fake)\" src/roles/", "exit_code": 0, "summary": "no violating import" }
    ],
    "remote_has_head": true,
    "ci_conclusion": "UNVERIFIED (API rate limit; owner visual confirmation pending)",
    "ci_run_url": "https://github.com/CIPFZ/Collie/actions",
    "ci_branch_matched": null,
    "deps_diff": ["yaml"],
    "spec_diff_lines": 0
  },
  "claim_mismatches": [],
  "gaps": [],
  "conditions": ["CI conclusion for 0ff9ef5 8e7dbd4 4785816 e30c4ee to be confirmed by owner"],
  "reason": "全部可实跑验收项通过且与声称一致；测试覆盖超出要求；import 隔离经变异测试证实；唯一未取证项为 CI 实际结论，因 API 限流而非 worker 问题"
}
```
