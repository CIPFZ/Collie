---
schema_version: 1
run_id: r-0002
batch_id: v01-b02
base_sha: 4a690f567397beb10bfc2b93ab9023a71c3af30e
created_at: 2026-10-16T22:00:00Z
attempt: 1
revised_at: 2026-10-16T23:00:00Z
interrupted_at: null
issued_by: human-placeholder-r2
---

# 批次 v01-b02：批次解析与 worker 角色

> 由人工占位调度器（R2）签发。v01-b01 已 PASS（verdict 见 `.collie/batches/v01-b01/verdict.md`）。
> 你的身份与边界见 `AGENT-worker.md`，全局铁律见 `CONSTRAINTS.md`，方案来源见 `SPEC.md`。

## 开工前

1. `git pull` 到 `4a690f5` 或之后。上一轮后 SPEC 2.2 / 3.2 / 3.3 / 3.6、CONSTRAINTS 铁律 13 / 19 / 20、
   ROLES 第 6 节、ADR-002 §4 均有修订，ADR-003 已批准。先读 `docs/progress.md` 的「本轮裁决记录」。
2. 若你本地的 `.collie/batches/v01-b01/report.md` 尚未推送，先以 `report(collie): v01-b01` 单独提交推送它。

## 本批次范围

三个条目，严格按顺序做。做完全部三条后汇报并停下。

### 条目 1：backlog 解析

`src/backlog.ts`：把 `docs/backlog.md` 解析为 `Batch[]`（schema 已在 b01 定义）。

- 解析「队列总览」表格得到 id / title / depends_on / status
- 解析每个 `## <batch_id> <title>` 小节得到 items / acceptance / forbidden
- `priority` 取总览表的优先级列
- `acceptance[].expect`：验收表「期望」列为 `exit 0` 时映射为 `'exit_zero'`；
  其他写法本批次一律视为不可判定并拒绝
- **可判定性校验**：每条 `acceptance[].cmd` 必须非空且不含形容词式描述。
  判定规则本批次定为：`cmd` 非空、`expect` 可映射。无法映射则抛 `BacklogError`，
  消息含 batch id 与该条验收的说明，**拒绝返回该批次**而非静默跳过
- `depends_on` 引用的 id 必须存在于总览表，否则 `BacklogError`
- 对外：`parseBacklog(text)` 与 `loadBacklog(root)`

解析对象是人写的 Markdown，格式会漂。要求：对 `docs/backlog.md` **当前内容**解析成功
并与手写期望一致；对缺列、缺小节、状态值不在枚举内的输入给出带位置的错误。
不要试图兼容任意 Markdown。

### 条目 2：runner 接口与 fake 实现

`src/runner/index.ts`：Agent 调用的统一接口。按 SPEC 4.1 定义 `AgentRunner`，
并补一个 `RunResult` 类型。这是胶水与 agent 侧的解耦层（ROADMAP 0.4）：
**任何 agent 侧特有概念（session id、权限模式、模型名、流事件格式）不得出现在
此接口的类型签名之外的模块中。** 本批次不实现真实的 `claude.ts`。

`src/runner/fake.ts`：测试用实现。按脚本返回预设结果：
- 构造时传入一组「剧本」：对每次 `run` 调用，按顺序返回预设的 `RunResult`，
  并可选地在 `cwd` 下写入预设文件（用于模拟 worker 产出 `report.md`）
- 记录每次调用的完整参数供断言（prompt、systemPrompt、allowedTools、cwd、maxTurns）
- 剧本耗尽时抛错，不静默返回

设计约束：fake 必须能表达 v01-b03 的三个验证场景——
「产出声称 CI 全绿的 report」「产出声称测试全过的 report」「产出 diff 含 SPEC 改动」。
本批次只需保证接口能承载，场景本身在 b03 构造。

### 条目 3：worker 角色

`src/roles/worker.ts`：

- `buildTask(batch, ctx)`：组装 `task.md`，YAML frontmatter（SPEC 3.3 全部字段）+ Markdown 正文。
  正文至少含：批次标题、条目清单、验收表、额外禁止、汇报要求。
  `interrupted_at` 本批次恒为 `null`，但字段必须存在
- `writeTask(root, batch, task)`：写到 `.collie/batches/<id>/task.md`
- `runWorker(runner, cfg, batch, root)`：经 runner 拉起 worker，
  systemPrompt 取 `AGENT-worker.md` 内容，allowedTools / maxTurns 取 `cfg.agent.worker`
- `readReport(root, batchId)`：读回 `report.md`，提取**最后一个**围栏 JSON 块，
  用 zod 校验（schema 按 SPEC 3.4 在 `src/schema/` 补 `ReportSchema`，含 `claims`；
  **`claims` 含 `ci_passed: boolean`**，SPEC 3.4 已于 2026-10-16 修订）。
  找不到 JSON 块、多个块取最后一个、校验失败——都抛 `ReportError` 并说明原因
- `TaskFrontmatterSchema` 为 strict，但须接受 SPEC 3.3 新增的两个可选字段
  `issued_by?: string` 与 `revised_at?: string | null`（人工签发期实际在用）
- `Usage` 定为 `{ inputTokens: number; outputTokens: number }`（采纳计划提案）
- `RunOptions` 不含 `model`：运行时实现在构造时接收配置、按 role 自查（采纳计划提案，b03 落实）

铁律 15：此模块只依赖 `runner/index.ts` 的接口类型，不 import `fake.ts` 或任何 SDK。
同时在 ESLint 上对 `src/roles/**` 配置 `no-restricted-imports` 物理隔离，
并在 `src/runner/` 以外的整个 `src/` 禁止导入 `@anthropic-ai/*`（采纳计划提案）。

## 验收标准

全部可机器判定。reviewer 会逐条实跑。

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| backlog 解析 | `npm test -- test/backlog.test.ts` | exit 0 |
| 拒绝不可判定验收 | `npm test -- test/backlog-reject.test.ts` | exit 0 |
| fake runner 闭环 | `npm test -- test/worker.test.ts` | exit 0 |
| task.md 格式 | `npm test -- test/task-envelope.test.ts` | exit 0 |
| roles 不直接依赖 SDK 或 fake | `test -d src/roles && ! grep -rE "from ['\"](@anthropic-ai\|\.\./runner/fake\|\./fake)" src/roles/` | exit 0 |

能力边界（如实声明）：最后一条 grep 只查 import 字面，R4 另读代码核验。
（修订 2026-10-16：原命令在 `src/roles/` 不存在时会空跑通过，且未转义的 `|` 会切坏表格；
已加 `test -d` 前置并按 GFM 转义。感谢执行计划中的指出。）
测试内容是否覆盖下方要求由 R4 读代码核验。

测试内容要求（R4 读代码核验）：
- backlog：解析当前 `docs/backlog.md` 得到 3 个批次，id / priority / depends_on / status /
  items 数量 / acceptance 数量与手写期望逐一相等；`v01-b01` 的 7 条验收 cmd 原样还原
- backlog-reject：期望列写「exit 1」「人工确认」「质量良好」的三种输入分别被拒绝，
  错误消息含 batch id；`depends_on` 引用不存在的 id 被拒绝；状态值 `已签发` 被拒绝
- worker：用 fake runner 跑通 buildTask → writeTask → runWorker → readReport 全链路；
  断言 runner 收到的 systemPrompt 等于 `AGENT-worker.md` 内容、allowedTools 等于配置；
  fake 写出的 report.md 被正确读回且 claims 字段类型正确
- task-envelope：frontmatter 可被 `yaml` 解析且含 SPEC 3.3 全部字段；
  正文含验收表且行数等于 acceptance 条数；`interrupted_at: null` 存在
- readReport 边界：无 JSON 块、两个 JSON 块（取后者）、JSON 块校验失败——各一个用例

## 本批次额外禁止

- 在 `src/roles/` 中直接 import Agent SDK 或 `runner/fake.ts`（铁律 15）
- 实现 `src/runner/claude.ts`、`src/roles/reviewer.ts`、`src/arbiter.ts`、`src/cli.ts`、
  `src/verify.ts`、`src/git.ts`、`src/ci.ts`（属 b03）
- 实现任何 v0.2 及以后的内容（失败恢复、信号阶梯、resume、活性检测）
- 新增 SPEC 2.2 与 ADR-002 之外的依赖。本批次需要新装的只有 `yaml`（ISC，已在 SPEC 2.2）
- 修改受保护文件与 `.collie/collie.toml`（`schema_version` 字段除外，见铁律 27）

## 汇报要求

写 `.collie/batches/v01-b02/report.md`：中文四段正文 + 尾部围栏 JSON 块（AGENT-worker.md 第 5 节）。
写完后以 `report(collie): v01-b02` 单独提交并推送该文件（铁律 19 例外）。
`claims` 会被 R4 逐项取证，如实填写。

## 给本轮的特别说明

本批次产出的 `ReportSchema` 与 `readReport` 会在 b03 被 R2 用来读取你自己的汇报。
请把你在 b01 写 report 时觉得别扭的地方（如果有）在「偏离或疑问」段提出，
这是设计信封格式最直接的反馈来源。
