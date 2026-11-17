---
schema_version: 1
run_id: r-20261117123555
batch_id: v046-b02
base_sha: 9c6631066d5fefc46b3e3ee0c75999fd45c41ed7
created_at: 2026-11-17T12:35:56.651Z
attempt: 1
interrupted_at: null
issued_by: collie
---

# 批次 v046-b02：测试 agent 的角色模块：角色、配置段、提示词（不接进队列）

## 你的身份与边界

你的身份、权限边界与工作协议见 `AGENT-worker.md`，全局铁律见 `CONSTRAINTS.md`，
方案来源见 `SPEC.md`。本文件只做本批次提醒。

## 本批次条目（3 个）

1. 角色与配置：`src/runner/index.ts` 的 `AgentRole` 加 `'tester'`；`src/schema/index.ts` 的配置里 `agent.tester` 是可选的一段，结构与 reviewer 段相同（含 `bash_deny`）；
   `templates/collie.toml` 加 `[agent.tester]`：`model = "claude-opus-4-6"`、`allowed_tools = ["Read", "Write", "Edit", "Glob", "Grep", "Bash"]`、`max_turns = 100`、
   `permission_mode = "bypassPermissions"`、`bash_deny` 与 reviewer 段的两条相同。没有这一段的配置照常能加载（本仓库的 `.collie/collie.toml` 就没有，本批次不许动它）。
2. `src/runner/claude.ts`：角色是 `tester` 时用 `agent.tester` 的白名单与轮数；`bash_deny` 的拦截对 tester 同样生效；reviewer 专有的「禁用写工具」不套到 tester 上（它要写文件）；
   配置里没有这一段而被要求以 tester 运行 → 抛出一个点名 `[agent.tester]` 的错误。worker 与 reviewer 的行为不变。
   **tester 运行一条匹配 `bash_deny` 的命令（`git commit -m x`）被拦下，和 reviewer 被拦时是同一条路径；传给 SDK 的 tester 工具清单里有 `Write` 与 `Edit`**
3. 新文件 `src/roles/tester.ts`，导出：`TESTER_MANUAL`（值是 `'AGENT-tester.md'`）；`TesterInputSchema`（严格对象，只有 `batch_id`、`items`、`spec_paths`、`out_dir` 四个字段，多一个字段就拒绝）；
   `buildTesterPrompt(input)`（提示词里有：批次号；条目原文，一字不改；要读的 SPEC 路径；输出目录与三个文件名 `new.test.ts`、`keep.test.ts`、`MAP.md`；自检用的两条 `npx vitest run <输出目录>/…` 命令）；
   `runTester(runner, cfg, input, cwd)`（以角色 `tester`、`agent.tester` 的工具与轮数、`cwd` 下的 `AGENT-tester.md` 作系统提示词拉起；配置里没有这一段时抛出点名 `[agent.tester]` 的错误）。
   新文件 `test/tester.test.ts` 用 `FakeRunner` 覆盖上面每一点；`test/runner-claude.test.ts` 加条目 2 的用例；
   `test/config.test.ts`：模板配置一组里加一条「有 tester 段」，另加一条「没有 tester 段的配置能加载」。
   允许改写的旧用例只有一处：`test/config.test.ts` 的 `equals the inline SPEC 3.1 fixture used by the error tests` 所用的内联配置 `VALID_TOML`，要跟着模板加上 tester 段（断言本身不变）；在「偏离或疑问」里写明。
   R1 查过：`reports an unknown agent role` 用的是 `[agent.auditor]`，仍然应当被拒绝，不要改。
   `test/invariants.test.ts` 加「`src/roles/tester.ts` 的源码里不出现 `report.md`」（它在 worker 之前运行，和 worker 的产出无关）

## 验收标准（可机器判定）

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 角色模块、配置、运行器的测试通过 | `npm test -- test/tester.test.ts test/config.test.ts test/runner-claude.test.ts` | exit 0 |
| 角色模块的三个导出都在 | `grep -qE "export (async )?function runTester" src/roles/tester.ts && grep -qE "export function buildTesterPrompt" src/roles/tester.ts && grep -qE "export const TesterInputSchema" src/roles/tester.ts` | exit 0 |
| 角色模块的专项测试不少于 8 个 | `grep -cE "^\s+it(\.each)?\(" test/tester.test.ts \| grep -qE "^([8-9]\|[1-9][0-9])$"` | exit 0 |
| 模板里有 tester 段，角色类型里有 tester | `grep -qE "^\[agent\.tester\]" templates/collie.toml && grep -qF "'tester'" src/runner/index.ts` | exit 0 |
| 不变量同步 | `grep -qE "roles/tester" test/invariants.test.ts` | exit 0 |

## 本批次额外禁止

- 改动任何受保护路径（含 `.collie/collie.toml` 与 `AGENT-tester.md`）；改动 `.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`
- 改动 `src/run.ts`、`src/roles/reviewer.ts`、`src/roles/worker.ts`、`src/arbiter.ts`、`src/gate.ts`、`src/evidence.ts`、`src/view.ts`、`src/follow.ts`；把测试 agent 接进队列或加命令行子命令
- 为了让测试过而删除或跳过任何测试；改写条目 3 点名之外的任何已有断言；改动 worker、reviewer 两个角色的任何行为
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；新增依赖

## 汇报要求

完成后写 `.collie/batches/v046-b02/report.md`：固定四段（做了什么 / 测试结果 / 偏离或疑问 / 下一步建议）
+ 尾部围栏 JSON 块，格式见 SPEC 3.4。
写完后以 `report(collie): v046-b02` 为提交信息单独提交并推送该文件。
