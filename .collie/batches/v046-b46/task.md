---
schema_version: 1
run_id: r-20261124140249
batch_id: v046-b46
base_sha: 19f34379cfe907bc4f9c619f26febdd1c9eeb782
created_at: 2026-11-24T14:09:20.721Z
attempt: 1
interrupted_at: null
issued_by: collie
---

# 批次 v046-b46：把 R2 的取证结果交给 reviewer，它输出里的证据一块改成可选（需求审查第 2a 批，带情形）

## 你的身份与边界

你的身份、权限边界与工作协议见 `AGENT-worker.md`，全局铁律见 `CONSTRAINTS.md`，
方案来源见 `SPEC.md`。本文件只做本批次提醒。

## 本批次条目（3 个）

1. 读 SPEC 16.30 的第三段（方案在 16.24，分批在 16.29）。`src/schema/index.ts`：把结论里证据那一块单独成一个导出的 `EvidenceSchema`，`VerdictSchema` 的 `evidence` 改成可选；R2 自己用的证据类型（`src/evidence.ts` 的 `Evidence`）仍然是必有各字段的那个形状，不许变成可选。
   `src/roles/reviewer.ts`：`ReviewerInputSchema` 加可选的 `evidence`；有它时，提示词在「验收命令」一节之后多一节「R2 的取证结果」，写法照 SPEC 16.30 里那个代码块（每条验收命令一行，另四行各一行）。输入里没有它时，提示词与现在逐字节相同。
2. `src/run.ts`：拉起 reviewer 时把 R2 的取证结果传进去。reviewer 的结论没有 `evidence` 时照常解析、照常仲裁（仲裁本来就用 R2 自己的证据），`verdict.md` 原样落盘。仲裁、门禁、事件与它们的字段都不变。
3. 点名允许改写的旧用例，在「偏离或疑问」里列出：`test/reviewer-isolation.test.ts` 的 `accepts exactly the SPEC 4.2 allow-list of input fields`（类型清单里加 `'evidence'`）。
   R1 查过：现有的假 reviewer 回的结论都带 `evidence`，改成可选不影响它们；`test/reviewer.test.ts` 里断言提示词内容的用例，输入都不带 `evidence`，提示词不变。reviewer 仍然拿不到 worker 的汇报：`evidence` 是 R2 实测的，不含 `claims`。
   别的现有用例因为本批次的新行为而失败时：只许做新行为直接要求的最小改动（往序列里加事件、个数加一这一类），不许删断言、不许把断言改松，在「偏离或疑问」里逐条列出原断言与现断言；拿不准是不是新行为直接要求的，才停下不改，写明是哪一条。

## 本批次情形

- S1 [新] `buildReviewerPrompt` 的输入除了现有各项，多一项 `evidence`：`verify_results` 是一条 `cmd` 为 `npm test`、`exit_code` 0、`summary` 为 `Tests 12 passed (12)`，`remote_has_head` 是 true，`ci_conclusion` 是 `success`，`spec_diff_lines` 是 0，其余照现有形状填合法的值：返回的提示词里有一行恰好是 `## R2 的取证结果`，并且有 `Tests 12 passed (12)`
- S2 [新] `VerdictSchema` 解析一份没有 `evidence` 这个键、其余都合法的结论（`verdict` 是 `PASS`，`gaps` 是空数组）：解析成功
- S3 [新] 沙箱默认配置，假 worker 如实；假 reviewer 的最终回复里那份 JSON 没有 `evidence` 这个键、`verdict` 是 `PASS`；单批次跑一次：退出码 0；`run.finished` 的 `verdict` 是 `PASS`
- S4 [新] 沙箱默认配置，假 worker 如实，假 reviewer 判 PASS（`fooledReviewerScene`），单批次跑一次：假运行器第 2 次被调用（角色是 reviewer）时拿到的提示词里有一行恰好是 `## R2 的取证结果`，并且有 `受保护文件改动行数：0`
- K1 [保持] `buildReviewerPrompt` 的输入不带 `evidence`：照常返回提示词，其中没有 `## R2 的取证结果`
- K2 [保持] `VerdictSchema` 解析一份带 `evidence` 的结论（现有的形状）：解析成功，结果里 `evidence.spec_diff_lines` 是原来的数
- K3 [保持] S4 那一次运行：退出码 0；假运行器被调用的先后是 worker、reviewer
- K4 [保持] 沙箱默认配置，假 worker 如实；假 reviewer 的 JSON 里 `evidence.spec_diff_lines` 写成 99、`verdict` 是 `PASS`；单批次跑一次：退出码 0；`evidence.collected` 事件的 `spec_diff_lines` 是 0

## 本批次接口

- `src/roles/reviewer.ts` 已有的导出 `buildReviewerPrompt(input)` 与类型 `ReviewerInput`（现有各项：`batch_id`、`base_sha`、`head_sha`、`items`、`acceptance`、`spec_paths`；怎么填合法的值照 `test/reviewer.test.ts`）。本批次起多一项可选的 `evidence`，实现之前带这个键的输入会被拒绝
- `evidence` 的形状就是现在结论里 `evidence` 那一块：`commits_actual`、`verify_results`（每项 `cmd`、`exit_code`、`summary`）、`remote_has_head`、`ci_conclusion`、`ci_run_url`、`ci_branch_matched`、`deps_diff`、`spec_diff_lines`
- `src/schema/index.ts` 已有的导出 `VerdictSchema`（用 `safeParse`）；一份合法的结论怎么写，照 `test/support/sandbox.ts` 的 `fooledReviewerScene`。要让假 reviewer 回一份不带 `evidence` 的结论，在测试文件里自己写一个场景
- 沙箱用 `test/support/sandbox.ts` 导出的 `Sandbox`、`workerScene`、`fooledReviewerScene`、`honestClaims`；假运行器 `FakeRunner` 的 `calls` 每项有 `role` 与 `prompt`

## 验收标准（可机器判定）

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过（含各批次的验收测试） | `npm test` | exit 0 |
| 本批次的验收测试通过 | `npm test -- test/acceptance/v046-b46` | exit 0 |

`test/acceptance/v046-b46/` 下是本批次的验收测试，由测试 agent 写好，你不能改（受保护路径）。

## 本批次额外禁止

- 改动任何受保护路径（含 `AGENT-reviewer.md`：手册由 R1 之后改）；改动 `src/arbiter.ts`、`src/gate.ts`、`src/view.ts`、`src/runner/`、`src/roles/worker.ts`、`src/roles/tester.ts`
- 把 worker 的汇报、`claims` 或它们的任何一部分放进 reviewer 的输入或提示词；让 R2 读 reviewer 结论里的 `evidence`
- 改任何一条规则的判定、门禁的条件、事件与它们的字段；改提示词里别的小节
- 为了让测试过而删除或跳过任何测试；改写条目 3 点名之外的任何已有断言
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；用到机器的 git 全局配置；新增依赖

## 汇报要求

完成后写 `.collie/batches/v046-b46/report.md`：固定四段（做了什么 / 测试结果 / 偏离或疑问 / 下一步建议）
+ 尾部围栏 JSON 块，格式见 SPEC 3.4。
写完后以 `report(collie): v046-b46` 为提交信息单独提交并推送该文件。
