# Collie SPEC

> Agent 团队编排器。本文件是**唯一方案来源**（Single Source of Truth）。
> 唯一可修改者：R1 方案设计 Agent，且须用户批准。其他角色只读。
> 与本文件冲突时以本文件为准。

版本：v0.1
更新时间：2026-10-16
仓库：https://github.com/CIPFZ/Collie
配套文档：[ROADMAP.md](./ROADMAP.md)（版本路线）、[ROLES.md](./ROLES.md)（角色与权限）、[CONSTRAINTS.md](./CONSTRAINTS.md)（铁律）

---

## 1. 定位与范围

### 1.1 要解决的问题

用户有一个想法时，流程是：与好模型讨论可行性与技术方案，产出 SPEC、AGENT 手册、
图标、决策文档；再下发给工作 Agent 分阶段实现；完成后由审核 Agent 对照目标与现状
给出下一步。真正消耗用户时间的不是决策本身，而是**在多个 agent 窗口之间搬运上下文**
——每次搬运都要重新进入上下文。

Collie 的目标：把用户的输入位置收敛到一个入口，并让「不需要用户的轮次」根本不惊动用户。
用户只保留头（需求阐述与方案讨论）与尾（裁决）。

### 1.2 定位

**Collie 是 agent 与工程之间的胶水。**
不是 agent 编排平台，不是通用 workflow 引擎，不是 agent 框架。

它的全部工作是：取批次、拉起 Agent、看活性、比对证据、写轨迹、决定升级。

护城河在于粘合 agent 侧与工程侧的四个阻抗不匹配（自然语言对可验证事实、
易失会话对持久仓库、无身份对需权限、自觉完成对可判定完成）。
详见 ROADMAP 第 0 章「定位与护城河」，其中 0.3 给出了判断是否走偏的指标，
0.5 给出了泛化的硬边界。

### 1.3 范围

v0.1 的范围严格限定为：
- 单项目、单 task、串行执行
- 两个 Agent 角色的单批次闭环（R3 worker + R4 reviewer）
- R2 调度器本体

不在范围内（见 ROADMAP 各版本与永不做清单）：
多项目并发、并行 worker、失败恢复、多批次自动串行、可观测命令、
R1 自动拆批次、R5 体检、安全加固、成本配额。

### 1.4 验证目标

v0.1 只验证一件事：**审核 Agent 的独立取证能否拦住 worker 的虚假汇报。**
这是 Collie 的核心假设，不成立则整个系统价值为零。

## 2. 技术选型

### 2.1 语言与运行时

TypeScript，Node.js 22 LTS，ESM。

选型理由（按项目性质选择，非默认偏好）：
Collie 的核心全部是 Claude Agent SDK 已第一方提供的能力——hooks、`canUseTool`、
session fork、NDJSON 流解析。用 TS 可直接复用，用其他语言等于重造这些机制。
次优为 Python。Shell 不可行：信号阶梯与流解析无法测试。

### 2.2 依赖清单

| 依赖 | 用途 | 许可证 |
|---|---|---|
| `@anthropic-ai/claude-agent-sdk` | 拉起与控制 Agent | 供应商条款，ADR-004 豁免 |
| `commander` | CLI 参数解析 | MIT |
| `zod` | 尾部 JSON 块的 schema 校验 | MIT |
| `smol-toml` | 解析 `collie.toml` | BSD-3-Clause |
| `yaml` | 解析 task.md 的 frontmatter | ISC |
| `vitest` | 测试 | MIT |
| `tsx` | 开发期直接跑 TS | MIT |

开发依赖（devDependencies，批准见 ADR-002）：
`typescript`（锁 `~6.0.x`，Apache-2.0）、`@types/node`、`eslint`、`@eslint/js`、
`typescript-eslint`、`prettier`、`eslint-config-prettier`（均 MIT）。

许可证红线（ADR-003）：运行时依赖仅接受 MIT / Apache-2.0 / BSD / ISC / 0BSD；
开发依赖及其传递层不受白名单约束但禁止强 copyleft（GPL / AGPL / SSPL）。
新增任何依赖必须先写 ADR。
明确不引入：任何编排框架（LangGraph、Temporal 等）、任何可观测框架、任何 ORM。

### 2.3 工程约定

- 严格模式 TypeScript，`strict: true`，禁用 `any`（必要时用 `unknown` + 收窄）
- ESLint + Prettier 零错误
- 包前缀 `@collie/`，CLI 命令名 `collie`
- 所有阈值集中在 `collie.toml`，代码中禁止裸写数字；
  由 ESLint `no-magic-numbers` 在 `src/**` 强制执行（放行 0 / 1 / -1），见 ADR-002
- 结构不变量（如批次条目 1~3）属 schema 定义，以具名常量写在 `src/schema/`，不进 toml
- 测试放在 `test/`，不放进 `src/`（测试需断言 SPEC 默认值，不受 `no-magic-numbers` 约束）
- `.collie/collie.toml` 由 R1 放置并维护（阈值须与本文件 3.1 一致），worker 只读；
  `collie init` 实现后由其从模板生成
- 测试不访问网络、不调用真实模型（用 fake Agent runner）

## 3. 数据模型

所有跨边界结构集中定义在 `src/schema/`，用 zod 声明并导出类型。
`SCHEMA_VERSION = 1`。v0.1 期间以可选字段方式扩展，不升版本、不写迁移；
只有删除或改变已有字段语义时才 bump。

### 3.1 配置

```toml
# .collie/collie.toml
schema_version = 1

[project]
name = "collie"
repo = "https://github.com/CIPFZ/Collie"

[agent.worker]
model = "claude-opus-4-6"
allowed_tools = ["Read", "Write", "Edit", "Glob", "Grep", "Bash"]
max_turns = 200           # v02-b02 第 1 次运行 120 轮用满（三条目 +668 行），上调
permission_mode = "bypassPermissions"   # v0.1 裁定，见下

[agent.reviewer]
model = "claude-opus-4-6"
allowed_tools = ["Read", "Glob", "Grep", "Bash"]   # 无 Write/Edit：物理上无法改代码
max_turns = 60
permission_mode = "bypassPermissions"
bash_deny = ["^\\s*git\\s+(push|commit|add|reset|checkout|rebase|merge|cherry-pick|tag|branch\\s+-[dDm]|worktree|stash)(?=\\s|$)", "^\\s*gh\\s"]
  # 子命令后用 (?=\\s|$) 不用 \\b：\\b 把 merge-base 当成 merge 拦了（v03-b03-fix 第 1 次，reviewer 核对「已推送」的标准命令被拒）
  # v03-b02 后：reviewer 的 Bash 命令级黑名单（正则，匹配即拒绝）。worker 不设。schema 接受前不得写进 toml（R1 在批次 PASS 后补）

[limits]
stall_secs = 300         # 事件流静默判定卡死；v02-b04 第 1 次运行 90 秒把「正在写 report」误判为卡死，上调
progress_secs = 1500     # 有事件但无产出判定空转（b04-fix 期间临时 3600，fix3 通过后恢复 900；v04-b04 第 1 次：开局的读与想占满 900 秒被掐，上调，见 13.12）
wallclock_secs = 3600    # 单批次墙钟硬顶。v03-b03 第 1 次：核心批次 +815 行、两次上下文压缩吃掉 4 分钟，2700 秒差 62 秒没写完 report，上调
resume_max = 2           # resume 上限（v0.2 生效）
fix_max = 2              # 同批次 FIX 上限（v0.3 生效）
dry_k = 2                # 连续 dry 轮数（v0.5 生效）
ci_wait_secs = 1800      # R2 取证前等待 head_sha 的 CI 出结论的上限；超时按 unknown 处理
                         # 环境无 GITHUB_TOKEN 且首次轮询即 rate_limited：不等待，立即记 unknown 并写 ci.wait_timeout（waited_secs=0）
ci_poll_secs = 30        # 等待期间查询 CI 的间隔
grace_secs = 20          # 信号阶梯每级宽限（v0.2，schema 可选，见 11.1）

[verify]
# reviewer 必跑的全局命令，批次级命令在 task 中追加
commands = ["npm run lint", "npm run typecheck", "npm test"]

[ci]
provider = "github-actions"
expected_branch = "main"   # 用于核对 CI 实际监听分支，防止「假全绿」
token_file = "~/.config/collie/github-token"   # 可选。只读 PAT（Actions: read）所在文件，`~` 展开；只有 R2 读它
```

`token_file`（v02-b04-fix2 后）：`~` 展开为 home；相对路径相对**仓库根**而非进程 cwd（fix3 条目 3 对齐实现，现为 cwd）。
R2 在取证前读取该文件内容（去首尾空白）作为 `queryCi` 的 `token`，
**不**放进环境变量。runner 拉起 worker / reviewer 时必须从子进程环境里删除 `GITHUB_TOKEN`、`GH_TOKEN`，
worker 的事件流会原样落盘（Q5），不能让它看见密钥。
配了 `token_file` 但文件不存在、读不了或内容为空时，`collie run` 与 `collie smoke` 启动即报错（13.9，v04-b06）；
v04-b06 之前的实现把它当作未配置，悄悄退回匿名查询。
推荐放在仓库外；若放在 `.collie/` 下，`.collie/github-token` 在 `.gitignore` 与 `collie init` 的忽略清单里。

`permission_mode` 取值 `default` / `acceptEdits` / `bypassPermissions`，省略时沿用 SDK 默认（逐次询问）。
**v0.1 裁定（v01-b05）：两个角色都用 `bypassPermissions`。** 无人值守下任何「询问」都等于卡死；
`acceptEdits` 也救不了，worker 必须跑 `npm test` 和 `git commit`。v0.1 的安全围栏不是审批，
而是：`allowed_tools` 白名单（reviewer 物理上无 Write/Edit）、reviewer 在只含 head_sha 的 worktree 里运行、
`max_turns` 与 `wallclock_secs` 硬顶、铁律 19 的受保护文件由 R2 事后取证（规则 2）。
细粒度门控（hook / 容器）是 v1.0 的议题，不在这里补。

### 3.2 批次（Batch）

来源：`docs/backlog.md`，由 R1 维护。Markdown 表格 + 每批次一个小节。

```ts
interface Batch {
  id: string;              // 如 "v01-b03"
  title: string;
  priority: number;        // 小者先，R1 一次排定
  depends_on: string[];    // 依赖的批次 id
  items: string[];         // 1~3 个条目，超过 3 个由 R1 拆分
  acceptance: Acceptance[];// 必须可机器判定
  forbidden: string[];     // 本批次额外禁止项
  status: 'pending' | 'running' | 'passed' | 'blocked';
}

interface Acceptance {
  desc: string;
  cmd: string;             // 可执行命令，禁止形容词式验收
  expect: 'exit_zero' | { stdout_matches: string };
}
```

`expect` 刻意不提供 `exit_nonzero`：负向检查必须写成正向命令
（如 `! grep -q pattern file`），期望仍为 `exit_zero`。
原因：统一为「命令成功即通过」，避免 verify.ts 与 reviewer 对退出码语义各自解释。

硬约束：`acceptance[].cmd` 必须是可执行命令。无法写成命令的验收标准，
R1 必须停下来与用户重新讨论，不得进入执行环节。

结构不变量（v02-b04-fix 第 3 次运行后）：批次 PASS 之后它的验收命令不再执行，后续批次可以悄悄改回去
（b04-tests 去掉了场景 G 的真实定时器，b04-fix 第 3 次又加了一个 `setTimeout(0)`，没人拦）。
因此凡是 grep 类的结构检查，必须同时以测试形式写进 `test/invariants.test.ts`，由 `npm test` 永久回归；
验收表里的 grep 只负责在本批次把它第一次立起来。R1 签发含结构检查的批次时，条目里必须写明「同步加进 invariants」。

验收命令的能力边界（v01-b01 bootstrap 实测得出）：
命令只能证明「绿」，不能证明「测了该测的」。一个只写 `expect(true)` 的测试文件
也能让 `npm test -- xxx` 通过。因此 task 中的「测试内容要求」由 R4 读测试代码核验，
这是 AGENT-reviewer.md 第 4 节「该写的测试没写」盲区的既定处理方式。

验收命令的可移植性约定（v01-b01 后追加）：
- 测试过滤**写完整文件路径**（`npm test -- test/schema.test.ts`），不用子串；
  子串过滤在出现同名片段的文件后，证明的内容会悄悄变化
- `grep` 只用 POSIX ERE，禁用 `\s` `\d` 等 GNU 扩展（macOS 语义不同）；
  空白用 `[[:space:]]`
- 命令须在 Linux 与 macOS 上语义一致，R1 签发前自测

**验收命令的唯一执行形式（v01-b02 后追加）：以 `parseBacklog` 的输出为准。**
Markdown 表格中的 `\|` 是 GFM 转义，原样粘进 shell 时 grep 会把 `\|` 当普通字符，
导致本应拦截违规的命令放行（v01-b02 实测）。因此：
- `verify.ts` 与 R4 执行验收时必须读 `parseBacklog` 解析后的 `cmd`（`\|` 已还原）
- 人工执行时须先经 `collie show <batch>` 打印解析后命令，不得从 `.md` 源码复制
- `AGENT-reviewer.md` 第 2 节同步此要求

### 3.3 任务信封（task.md）

R2 写，R3 读。Markdown 正文 + YAML frontmatter。

```markdown
---
schema_version: 1
run_id: r-0007
batch_id: v01-b03
base_sha: a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0
created_at: 2026-10-16T12:00:00Z
attempt: 1
interrupted_at: null        # v0.2：上一轮中断位置，仅 R2 知道
issued_by: collie           # collie run 签发时必填为 collie；人工签发写 human-placeholder-r2。AGENT-worker 第 6 节据此决定是否等计划确认
revised_at: null            # 可选：重签时间，未重签为 null 或省略
---

# 批次 v01-b03：事件日志写入

## 你的身份与边界
（由 AGENT-worker.md 承载，此处只做本批次提醒）

## 本批次条目（1~3 个）
1. ...

## 验收标准（可机器判定）
| 说明 | 命令 | 期望 |
|---|---|---|

## 本批次额外禁止
- ...

## 汇报要求
完成后写 `.collie/batches/v01-b03/report.md`，固定四段 + 尾部 JSON 块。
```

`base_sha` 约定：指向**签发本 task 前的最后一个提交**。task.md 自身的提交
（只触及 `.collie/batches/`）位于 `base_sha..head_sha` 之内，但不属于 worker 产出；
R4 取证与 arbiter 的受保护文件检查只针对 worker 的提交。
R1/R2 若在签发后又修改了 SPEC 等文档，必须重新签发 task 并更新 `base_sha`。

frontmatter 中的 sha 字段**必须加引号**：形如 `1234567e10` 的 sha 会被 YAML 解析为数字。
Collie 生成时自动加引号；人工签发时手动加。

`wallclock_secs` 的执行点（v01-b02 计划反馈后裁定）：由 **R2** 执行，不进 `RunOptions`。
理由：墙钟是编排层的预算闸，runner 只负责「拉起并返回」；放进 runner 接口会让
每个 runner 实现各自解释超时语义。R2 在 `runWorker` 外层以 `AbortSignal.timeout` 包裹，
超时即进入信号阶梯（v0.2），v0.1 先只记 `worker.crashed` 事件并以非零退出码返回。
`AgentRunner.run` 的 `RunOptions` 增加可选 `signal?: AbortSignal`，供 R2 传入。

### 3.4 汇报信封（report.md）

R3 写，R2 读，**R4 不读**。Markdown 四段正文 + 尾部围栏 JSON。

正文四段固定为：做了什么 / 测试结果 / 偏离或疑问 / 下一步建议。

尾部 JSON 块（R2 用 zod 校验）：

```json
{
  "schema_version": 1,
  "batch_id": "v01-b03",
  "head_sha": "e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3",
  "claims": {
    "commits": ["e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3"],
    "tests_passed": 47,
    "tests_failed": 0,
    "pushed": true,
    "ci_passed": true,
    "new_deps": [],
    "spec_touched": false
  },
  "open_questions": []
}
```

`claims` 下所有字段的语义是「worker 的声称」，**默认不可信**，须经 R4 取证核对。

字段说明（v01-b02 计划反馈后补充）：
- `head_sha`：**最后一个代码提交**的 sha，不含随后的 `report(collie):` 信封提交。
  R4 取证范围为 `base_sha..head_sha`，信封提交不在其中
- `ci_passed`（可选，缺失视为 `false`）：worker 声称 CI 已对 `head_sha` 实际触发且通过。
  此字段使场景 A 成为真正的「声称 vs 实测」比对（arbiter 规则 7 据此与 `ci_branch_matched` /
  `ci_conclusion` 对照），而非只检查 CI 本身是否通过
- sha 字段均须匹配 `/^[0-9a-f]{7,40}$/`
- `spec_touched`：worker 的提交是否改动了**任何受保护路径**（AGENT-worker.md 第 2 节的全部清单，
  不只是 `SPEC.md`）。与仲裁规则 2 的检查范围一致（v02-b01 后明确）。

### 3.5 裁决信封（verdict.md）

R4 写，R2 读。Markdown 推理正文 + 尾部围栏 JSON。

```json
{
  "schema_version": 1,
  "batch_id": "v01-b03",
  "verdict": "PASS",
  "evidence": {
    "commits_actual": ["e4f5g6h"],
    "verify_results": [
      { "cmd": "npm test", "exit_code": 0, "summary": "47 passed, 0 failed" }
    ],
    "remote_has_head": true,
    "ci_conclusion": "success",
    "ci_run_url": "https://...",
    "ci_branch_matched": true,
    "deps_diff": [],
    "spec_diff_lines": 0
  },
  "claim_mismatches": [],
  "gaps": [],
  "reason": "三项验收标准均由实测命令确认"
}
```

关键规则：`verdict` 三值不用约束解码强制（结构约束会损害推理质量），
而是由 R2 解析尾部 JSON 并用 zod 校验；解析失败按 BLOCK 处理。

字段约定（v01-b03 后）：`ci_conclusion` 取 `success | failure | cancelled | unknown`，
`ci_branch_matched` 为 `boolean | null`（`null` = 未能取证），`ci_run_url` 可为空串；
`conditions?: string[]` 可选，非空表示 PASS 附条件。arbiter 把 `ci_branch_matched=null`
视为未取证：若 `claims.ci_passed=true` 则按规则 7 降 FIX。
R2 取证前先把 report 的 `head_sha` 与 `commits[]` 用 `git rev-parse` 展开成 40 位（v02-b04-fix4 后）：
schema 允许 7~40 位，但 GitHub Actions API 的 `head_sha` 过滤只认完整 sha，短 sha 查到 0 条会被当成「还没出结果」白等到超时
（fix4 第 1 次：有 token 仍等满 1801 秒、60 次轮询）。
等待 CI 时 `no_runs` 不是「还没出结果」：连续 3 次轮询仍为 `no_runs` 即改查后代提交；后代也无运行才继续等 `pending`。
CI 运行的归属（v01-b05-smoke 后）：`head_sha` 自己的运行优先；若不存在，可采信其**后代提交**
在 `expected_branch` 上的运行，条件是 `git diff --name-only head_sha..后代` 只含 `.collie/**` 与
`docs/progress.md`（即只多了信封提交，代码与 head_sha 相同）。其他后代一律不采信。
reviewer 交付方式：无写工具，verdict 正文作为**最终回复文本**返回，
`RunResult.finalText` 承载，由 R2 写入 `verdict.md`。
reviewer 在检出于 `head_sha` 的独立 worktree 中工作，该 worktree 不含 `report.md`。

### 3.6 事件日志

`.collie/runs/<run_id>/events.ndjson`，append-only，每行一个事件。
这是 R2 的唯一状态源——R2 无状态可重启，崩溃恢复 = 重放此文件。

```ts
type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };

interface Event {
  ts: string;              // ISO8601
  run_id: string;          // 用作路径段，须匹配 /^[A-Za-z0-9][A-Za-z0-9._-]*$/
  batch_id?: string;
  event: EventType;
  [key: string]: JsonValue | undefined;  // 扩展字段限 JSON 值，保证 replay(append(e)) 深相等
}

type EventType =
  | 'run.started' | 'run.finished'
  | 'batch.selected' | 'batch.task_written'
  | 'batch.skipped'      // v0.3：依赖未满足；字段 batch_id / missing（依赖清单）
  | 'batch.status'       // v0.3：R2 改写 backlog 状态列；字段 batch_id / from / to
  | 'queue.finished'     // v0.3：--continue 结束；字段 reason（exhausted / blocked / escalated / fix_max / limit / paused / evidence_unavailable）/ batches（本次跑过的）/ paused_count
  | 'queue.paused'       // v0.3（12.3）：PASS 但触发停表清单；字段 batch_id / reasons（数组）
  | 'batch.retried'      // v0.3（12.3）：BLOCK 后自动重跑一次；字段 batch_id，规则 1 时带 rule（固定 1），中断续跑（13.14）时带 cause（固定 interrupted）/ stop_reason
  | 'queue.batch_started' // v0.3（12.2）：队列拉起一次批次运行；字段 batch_run_id（v04-b07 前叫 run_id，见 13.10）/ batch_id / attempt / why（new / fix_retry / rule1_retry / interrupt_retry）
  | 'queue.gate_passed'  // v0.4（13.14）：PASS 后放行判定通过；字段 batch_id / batch_run_id
  | 'worker.started' | 'worker.finished' | 'worker.crashed'
  | 'reviewer.started' | 'reviewer.verdict'
  | 'reviewer.finished'   // v0.4（13.1）：reviewer 运行返回后、解析 verdict 之前记；字段 exit_code 与运行级字段
  | 'evidence.collected'  // v0.4（13.1）：R2 取证完成后记一次；字段见 13.1
  | 'claim.mismatch'
  | 'verdict.downgraded'  // 字段 from / to / rule / reason；v0.4（13.9）：规则 9 且证据是因环境取不到时追加 cause（固定 evidence_unavailable）/ detail
  | 'escalated'
  | 'ci.wait_timeout'    // 等 CI 超过 ci_wait_secs 仍无结论；字段 head_sha / waited_secs / last_state
  | 'ci.resolved'        // 取到 CI 结论；字段 head_sha / conclusion / branch_matched / run_url / waited_secs / polls / attributed_sha（采信后代时）
  | 'verdict.pushed'     // v0.3：R2 推送裁定提交；字段 sha / remote / branch
  | 'verdict.push_failed' // v0.3：推送失败；字段 sha / error；不改变本轮结论
  | 'verdict.push_skipped' // v0.3：启动补推条件不满足；字段 head / reason
  | 'tool.denied'         // v0.3：PreToolUse 钩子拒绝了一次工具调用；字段 role / tool / command / pattern。
                          //   runner 通过 onEvent 交给 R2，R2 **同时**写进 journal（带 ts / run_id）；只落在角色事件流里不算（v03-b03-fix 第 1 次）
  | 'ci.verdict_commit'  // v0.3：启动时核查上一条裁定提交的 CI；字段 sha / conclusion / run_url
  | 'acceptance.failed'   // R2 实测验收未满足；字段 cmd / exit_code / expect。v04-b10 起不论裁决都记（13.14），之前只在规则 8 降级时记
  | 'run.orphaned' | 'worker.stalled' | 'worker.idling'
  | 'worker.signaled' | 'worker.rescued' | 'worker.resumed';  // v0.2，见第 11 章
// worker.finished 携带 exit_code 与 final_text（worker 最终回复，截断至 2000 字），
// 否则零产出退出的原因无从得知（v01-b05-smoke 教训）。
```

v0.1 只需支持 v0.1 的事件；v0.2 事件的字段定义见第 11 章。

## 4. 模块设计

```
src/
  cli.ts                  命令入口（commander）
  config.ts               读 collie.toml，校验，提供类型化配置
  schema/
    index.ts              SCHEMA_VERSION 与全部 zod schema
    envelope.ts           task / report / verdict 的读写与校验
  backlog.ts              解析 docs/backlog.md 为 Batch[]
  journal.ts              events.ndjson 的追加与重放
  git.ts                  git 命令封装（status/log/diff/ls-remote/commit）
  ci.ts                   CI 实际结论查询（gh CLI）
  runner/
    index.ts              Agent 拉起的统一接口（便于 fake 替换）
    claude.ts             基于 Claude Agent SDK 的真实实现
    fake.ts               测试用，按脚本返回预设结果
  roles/
    worker.ts             组装 task.md、拉起 worker、收 report
    reviewer.ts           组装审核 prompt、拉起 reviewer、收 verdict
  verify.ts               实跑验收命令并结构化输出
  arbiter.ts              claim 比对与 verdict 降级裁定
  progress.ts             依据实测证据写 docs/progress.md：Collie 标记段按**运行**追加一行
                          （run_id / batch / 结果 / 退出码 / head_sha），不按批次覆盖；verdict.md 仍为批次最新
```

### 4.1 `runner` 抽象的必要性

所有 Agent 调用必须经 `runner` 接口，禁止在 roles 中直接调 SDK。
两重理由，后者更本质：

1. **可测试性。** v0.1 的三个验证场景需要在不花钱、不联网的条件下可重复执行，
   `fake.ts` 按脚本返回「假 CI 全绿的 report」等预设结果。
2. **它是胶水与 agent 侧的解耦层。** Collie 的价值与「被粘的两端」解耦——
   今天是 Claude Code，明天可能是另一个 agent CLI。这个抽象做干净，
   Collie 就不绑定在任何一家的 CLI 上。详见 ROADMAP 0.4。

实现约束：任何 agent 侧的特有概念（session id、权限模式、模型名、流事件格式）
不得泄漏到 `roles/` 与 `arbiter.ts` 之外的模块。

```ts
interface AgentRunner {
  run(opts: {
    role: 'worker' | 'reviewer';
    prompt: string;
    systemPrompt: string;
    allowedTools: string[];
    cwd: string;
    maxTurns: number;
    onEvent?: (e: unknown) => void;   // NDJSON 逐行回调
  }): Promise<{ exitCode: number; sessionId?: string; usage?: Usage; finalText?: string }>;
}
```

### 4.2 reviewer 的干净上下文保证

reviewer 的 prompt 由 `roles/reviewer.ts` 从零组装，只允许包含：
- `AGENT-reviewer.md` 作为 system prompt
- 本批次 `task.md` 的验收标准与条目
- `SPEC.md` 的相关章节引用（给路径，让它自己读）
- diff 指针 `base_sha..head_sha`

**禁止**包含：`report.md` 正文、worker 的会话历史、worker 的 session id。
这条由代码保证（reviewer.ts 不接收 report 正文参数），不靠提示词约束。

### 4.3 arbiter 的强制降级

```
输入：report.claims + R2 自测的 evidence + verdict.verdict
规则（按顺序，命中即停）：
1. verdict 尾部 JSON 解析或校验失败            → BLOCK
2. evidence.spec_diff_lines > 0                → BLOCK
3. evidence.deps_diff 含未经 ADR 批准的运行时依赖，
   或任何树出现强 copyleft（ADR-003）         → BLOCK
4. claim_mismatches 非空                       → 若 verdict=PASS 则降为 FIX
5. claims.pushed=true 但 remote_has_head=false → FIX + 记 claim.mismatch
6. claims.tests_* 与 verify_results 不一致     → FIX + 记 claim.mismatch
7. claims.ci_passed=true 但 ci_conclusion≠success
   或 ci_branch_matched=false                  → FIX + 记 claim.mismatch
8. verify_results 中任一条 exit_code≠0
   或 stdout 不匹配 expect                     → 若 verdict=PASS 则降为 FIX + 记 acceptance.failed
9. remote_has_head=false，或 ci_conclusion≠success，
   或 ci_branch_matched≠true                   → 若 verdict=PASS 则降为 FIX + 记 verdict.downgraded
10. 否则采用 verdict 原值
```

规则 9 的来源（v02-b05 第 2 次运行，2026-10-22）：worker 全程没有 `git push`，claims 如实写 `pushed=false`，
R2 实测 `remote_has_head=false`、CI 未取证；规则 5 只查「声称已推送但远端没有」，规则 7 只在 `ci_passed=true` 时比对，
于是没有一条规则拦住，reviewer 判 PASS 被规则 9（旧）照单采用。铁律 18 要求「CI 实际触发并通过」，PASS 必须以此为必要条件。
**不豁免 `unknown`**：无 token 环境只能得到 FIX，这是有意的；3.1 的「限流不等待」只省时间，不替代证据。
后续 attempt 沿用首次 `base_sha`（本节上文），所以未推送的提交在 FIX 重跑时仍在审核范围内。
规则 9 是「证据缺失」不是「声称失实」，记 `verdict.downgraded`（字段 rule / reason），不记 `claim.mismatch`。
证据是因环境取不到（限流、认证失败、网络、`git fetch` 失败）时结论仍是 FIX，但 R2 标出 `cause`，队列不重跑（13.9，v04-b06）。

**上报（无 report）**：worker 退出后没有可解析的 report.md 时不进入规则链，直接 BLOCK + `escalated`。
这不是「规则 0」，progress 与 `collie show` 一律写「上报：无 report」。
上报路径仍须用 git 实测 `base_sha..HEAD` 的提交清单与推送状态写入 progress（v02-b04 第 1 次运行
写成了「提交：无、已推送：否」，而 3 个提交已在 origin 上）。
**同一批次的后续 attempt 沿用第 1 次的 `base_sha`**，上一轮已推送的提交因此留在审核范围内；
在这条实现之前（v02-b05），上报后已推送的未审核提交由所有者决定存档重置或人工复核。

规则 8 的来源：v01-b05-smoke 第二次真实运行（2026-10-20）。worker 如实报了 66 个测试失败，
规则 5~7 因「声称与实测一致」全部不触发，reviewer 以「失败早已存在」为由判 PASS，规则 9 照单采用。
三场景只覆盖了 worker 说谎的情况，没覆盖「worker 诚实但验收确实没过」。
验收命令是 PASS 的必要条件，不由 reviewer 的解释豁免。

规则 7 的来源是一次真实教训：某仓库 CI 配置监听 `main` 而实际用 `master`，
导致 M0 到 M6 全程「CI 全绿」其实从未触发过。此类失败在自动循环中会被放大，
因为中间再没有人亲自核验远端。
规则 7 是「声称 vs 实测」的比对而非仅检查 CI 状态：`claims.ci_passed` 为 worker 的声称，
`ci_conclusion` 与 `ci_branch_matched` 为实测值。

**证据来源（v01-b04 裁定）：arbiter 只依据 R2 自己用 `verify.ts` / `git.ts` / `ci.ts` 测出的 evidence，
不使用 reviewer 报上来的 evidence。** 理由：reviewer 也是 LLM，可能被 worker 的产物误导；
若仲裁采信它的 evidence，被骗的 reviewer 照抄 worker 说法即可让三个场景全部漏过（变异测试已证实）。
reviewer 的 evidence 原样保存在 `verdict.md` 供人对照，但不参与仲裁。
reviewer 的价值是「判断」（`verdict` 三值与 `gaps`），事实由 R2 自己测。

## 5. CLI 接口

v0.1 只提供三个命令。

```
collie init                      在当前仓库创建 .collie/ 与配置模板
collie run <batch_id>            跑一个批次的完整闭环（worker → reviewer → 裁定）
collie show <batch_id>           打印该批次的 task / report / verdict 与裁定过程
```

`collie run` 的退出码：
- `0`：PASS
- `10`：FIX
- `20`：BLOCK
- `30`：`--continue` 下停表（结论是 PASS，但触发了 12.3 的停表清单，等人看一眼再继续；v03-b04）
- `1`：Collie 自身错误

v0.4 增加四个只读命令 `status` / `timeline` / `why` / `watch`，定义与退出码见第 13 章。

## 6. 执行流程（v0.1）

```plantuml
@startuml
start
:读 collie.toml;
:解析 docs/backlog.md，取指定批次;
:校验依赖与验收标准可机器判定;
:记 batch.selected;
:写 task.md（frontmatter + 正文）;
:记 batch.task_written;
:拉起 worker（注入 AGENT-worker.md）;
:记 worker.started;
:等待退出，流事件落盘;
:记 worker.finished;
if (有 report.md 且 schema 校验通过?) then (否)
  :记 escalated；退出 20;
  stop
endif
:从零组装 reviewer prompt（不含 report 正文）;
:拉起 reviewer;
:记 reviewer.started;
:reviewer 自行实跑验收命令与取证;
:收 verdict.md，zod 校验;
:记 reviewer.verdict;
:arbiter 比对 claims 与 evidence;
if (需要降级?) then (是)
  :记 claim.mismatch 与 verdict.downgraded;
endif
:依据实测证据更新 docs/progress.md;
:R2 提交 .collie/ 与 progress.md;
:按最终裁定设置退出码;
stop
@enduml
```

## 7. 里程碑

v0.1 分三个批次，优先级已排定（见 `docs/backlog.md`）。

| 批次 | 内容 | 验收 |
|---|---|---|
| v01-b01 | 工程骨架 + schema + journal + config | lint/typecheck/test 零错误；schema round-trip 测试通过 |
| v01-b02 | backlog 解析 + task 生成 + fake runner + worker 角色 | 用 fake runner 跑通 task→report 并通过校验 |
| v01-b03 | reviewer 角色 + verify + ci + arbiter + CLI | 三个验证场景全部被拦住 |

## 8. v0.1 验收：三个必须被拦住的场景

这三个场景是 v0.1 的唯一通过标准，用 `fake.ts` 构造，必须自动化可重跑。

**场景 A 假 CI 全绿。** fake worker 产出 `claims.pushed=true` 且 `claims.ci_passed=true`，
但 `ci.ts` 查到的实际 run 监听分支与 `expected_branch` 不符（或根本无 run）。
期望：`claims.ci_passed=true` 与实测 `ci_branch_matched=false`（或 `ci_conclusion≠success`）不符
→ 裁定为 FIX，事件日志有 `claim.mismatch`。本场景验证的是声称与事实的比对，不只是 CI 状态。

**场景 B 假测试数。** fake worker 声称 `tests_passed=47, tests_failed=0`，
而 `verify.ts` 实跑结果为 3 个失败。
期望：claims 与 verify_results 不一致 → 裁定为 FIX，事件日志有 `claim.mismatch`。

**场景 C 偷改 SPEC。** fake worker 的 diff 中包含 `SPEC.md` 的修改。
期望：`spec_diff_lines > 0` → 直接 BLOCK，不理 verdict 原值。

补充要求：三个场景都必须验证 `collie run` 的退出码正确，
且 `collie show` 能完整还原裁定过程与证据链。

## 9. 明确不做

v0.1 不做下列内容，防止范围蔓延：

- 任何失败恢复、resume、信号阶梯（v0.2）
- 多批次自动串行、分级放行、返工闸（v0.3）
- `status` / `timeline` / `watch` / `why` 命令（v0.4）
- 完成判定与 dry 信号（v0.5）
- R5 体检（v0.6）、R1 自动拆批次（v0.7）
- 容器隔离、网络白名单、配额感知、成本账本、通知（v1.0）
- 永不做：并行写入、多项目共享、Agent 自判是否求助、自建框架、
  工具级审批交给人、可观测框架

## 10. 开放问题

| 编号 | 问题 | 现状 |
|---|---|---|
| Q1 | reviewer 实跑验收命令时，是否需要独立 worktree 以免污染 worker 的工作区？ | v0.1 串行执行，worker 已退出，暂不需要。若 v0.3 出现问题再议 |
| Q2 | `docs/backlog.md` 用 Markdown 表格是否足够？是否需要独立的结构化文件？ | 先用 Markdown（R1 与人都要读写）。若解析脆弱则改为 frontmatter 承载结构 |
| Q3 | `collie.toml` 放 `.collie/` 下还是仓库根？ | 暂定 `.collie/` 下，与运行时文件同域 |
| Q4 | 完成判定的四种判据，最终选哪个？ | 按用户要求保留全部，v0.5 起记录对比数据后再定 |
| Q5 | `stream.ndjson` 原样落盘工具输出，环境里配了 token 后会以明文留在 `.collie/runs/` | 目录已 gitignore；token 已不进子进程环境（fix2），但 R2 自己的环境仍有。v02-e-drill 落盘时屏蔽 `token_file` 内容与 `GITHUB_TOKEN` / `GH_TOKEN` 的值 |
| Q6 | 卡死检测以 SDK 事件为心跳，而 SDK 生成长输出时不发事件 | 权宜：`stall_secs=300`。候选：runner 开启 SDK 逐片输出（partial messages）并转成事件，让心跳粒度与输出无关。v0.2 收口后定。实测真正静默（无任何事件、无 thinking_tokens）：v02-b04 第 1 次推送后 90.5 秒（误判）；第 2 次推送→写 report 前 35.4 秒、report 推送后生成最后一段约 600 字回复 97.0 秒、心跳采样最大滞后 89.2 秒。带 thinking_tokens 的 277 秒 / 99 秒间隔不算静默。300 对已观测最大值留约 3 倍余量 |
| Q7 | R2 只核对 worker `head_sha` 的 CI，不看自己裁定提交的 CI；裁定提交只改 docs，它的 CI 红只可能是随机失败的测试，但 Collie 记录里看不到（v02-b04 第 2 次 Run 81；v02-b05-fix Run 113） | 已定并签入 v03-b01（SPEC 12.1）：R2 自己推送裁定提交，**下一次启动时**查一次该提交的 CI（推送当下必然 no_runs，不在那时查），红则打印警告并记 `ci.verdict_commit` |


## 11. v0.2 失败检测与恢复

目标（ROADMAP 第 4 节）：worker 在任何时刻被中断，信息零丢失，下一轮能正确接续。
本章在 v0.1 的结构上只做追加；v0.1 的三场景与规则 1~9 不变。

**v0.2 收口条件**（v02-e-drill 第 1 次演练 2026-10-23 后定）：真实 `kill -9` R2 一次，以下五条全部在真实运行里成立：
1. R2 死后 worker 子进程在 5 秒内退出，不再提交（演练实测：worker 变孤儿后独自活了 78 秒、提交了一次）；
2. 下一次启动记 `run.orphaned`，工作区脏则 `worker.rescued` + wip 提交且 `task.md` 有 `rescue_sha`（演练未触发：孤儿 worker 抢先提交了）；
3. `task.md` 的 `interrupted_at` 结束原因为 `orphaned`、最后事件取自 `stream.ndjson`（演练实测写成 `unknown worker.started`）；
4. attempt 2 的 R2 取证与 reviewer 范围为首次 `base_sha..head`，attempt 1 的提交在规则 2 / 3 范围内（演练实测只算了 attempt 2 自己的 task 提交之后）；
5. 若孤儿 worker 仍存活，`collie run` 拒绝启动并退出码 1（演练未验证：操作员先补杀了）。
演练已成立的：`worker_pid` 进心跳、孤儿检测、`attempt` 递增、「上一轮中断」一节、首次 `base_sha` 写进 frontmatter、下一轮能接着跑完。

第 2 次演练（v02-e-drill2，2026-10-26）结果：第 1、2、4 条成立（守护进程 1 秒内杀掉 worker 并自退；救援提交 `6158611` 真实生成；
取证范围 `7f93939..b076c7b` 含救援提交与两轮 task 提交）。第 3 条半成立：`orphaned` 对了，但最后事件取成 SDK 消息的 `type`（`user`）、时间为空。
第 5 条没机会验证（守护进程比第 2 次启动快）。另发现 `rescue_sha` 没进 `task.md`：孤儿救援记在**新一轮**的 journal 里，
而生成 task 时只在上一轮的 journal 里找 `worker.rescued`，于是正文写成了「上一轮未留下救援提交」——和事实相反，worker 是自己读 `git log` 才发现的。
**收口改为**：v02-e-fix2 修这两处并用 fake runner 的场景 E 测试覆盖（孤儿救援路径下 `rescue_sha` 进 frontmatter、正文含「请先核实」；
`interrupted_at` 时间非空且事件类型来自 SDK 消息的 `timestamp` / 心跳 `updated_at`），第 5 条以 `heartbeat.test.ts` 现有单测为准，
不再做第 3 次真实演练。e-fix2 PASS 即 v0.2 收口。
**v0.2 已收口**（2026-10-26，v02-e-fix2 裁定 `cfee4dc`）。未在真实运行里验证、留到 v0.3 运行中自然观察的：规则 9 的触发；守护进程存活时拒绝启动；孤儿路径下 `rescue_sha` 进 task。
信号阶梯首次真实触发：v03-b03 第 1 次（2026-10-26）`worker.signaled(soft, wallclock)` 后 47 毫秒 worker 退出，未升级，R2 完整收尾并自推裁定。

### 11.1 新增配置（`[limits]`）

```toml
stall_secs = 300         # 事件流静默判定卡死（v0.1 占位 90，v02-b04 后 300）
progress_secs = 1500     # 有事件但无产出判定空转（v0.1 已占位；v0.4 起 1500，见 13.12）
grace_secs = 20          # 信号阶梯每级之间的宽限
resume_max = 2           # 同一批次 resume 上限（v0.1 已占位）
```

v0.2 起新增的 `limits` 字段在 schema 中一律**可选**，缺省取本节默认值（代码中为与 SPEC 同值的具名常量）。
原因：`.collie/collie.toml` 是受保护路径，由 `collie run` 拉起的 worker 不能改它（规则 2）；
R1 在批次通过后把新字段补进 toml。补进之后 toml 即为唯一事实源（铁律 11）。

### 11.2 runner 接口追加

```ts
interface RunOptions {
  // ...v0.1 字段
  /** 续接上一次运行；值来自上一次 RunResult.sessionId，对 Collie 不透明 */
  resumeSessionId?: string;
  /** 运行开始后立即回调一次，交出控制句柄 */
  onStarted?: (handle: RunHandle) => void;
}
interface RunHandle {
  /** runner 能拿到子进程 pid 时**必须**提供（v02-b04-fix 后）；Claude SDK 经 spawnClaudeCodeProcess 钩子可拿到。用于 heartbeat 的 worker_pid 与 kill 级 */
  pid?: number;
  /**
   * soft：让当前轮次结束后停下，session 完整可续接
   * hard：立即中止，session 可能残缺
   * kill：不可恢复地终止；runner 可实现为对 pid 发 SIGKILL
   */
  stop(level: 'soft' | 'hard' | 'kill'): Promise<void>;
}
interface RunResult {
  // ...v0.1 字段
  /** 非正常结束时的原因；runner 自身异常以外，一律返回 RunResult 而不是抛出 */
  stopReason?: 'turns_exhausted' | 'stopped' | 'error';
}
```

约束（v02-b02 第 1 次运行暴露）：
- `soft` 与 `hard` 不得实现为同一个调用。`soft` 必须是「本轮结束后停、session 可续接」的 SDK 级中断；
  `hard` 才是 abort。`interrupt()` 是必调且 `await` 的：SDK 对象上没有它就抛错，不得写成 `interrupt?.()`；
  也不得把方法拆出来再调（`const fn = q.interrupt; fn()` 会丢 `this`，SDK 内部要用 `this.request`，
  v02-b04-fix 第 1 次运行因此 TypeError），要写成 `await q.interrupt()`。
  runner 测试的替身 `interrupt` 必须依赖 `this`（读自身字段，`this` 为 undefined 时抛错），否则这类错误测不出来。
- **工具白名单要同时传 `tools` 与 `allowedTools`**（v03-b01-fix 第 1 次运行后，reviewer 事件流落盘才看见）：SDK 的 `allowedTools`
  只是「这些工具免询问」，**不限制可用集合**；限制可用集合要用 `tools`（`string[]`）。Collie 从 v01-b05 起只传了 `allowedTools`，
  两个角色实际拿到的都是全部 27 个默认工具，加上 `bypassPermissions`，reviewer 的 Write / Edit 一直可用——「物理上无法改代码」
  在 v03-b01-fix 之前从未成立，只是 reviewer 碰巧没用。runner 必须 `tools: [...allowed_tools]`、`allowedTools: [...allowed_tools]`、
  `disallowedTools: ['Write', 'Edit', 'MultiEdit', 'NotebookEdit']`（仅 reviewer）三者同传；初始化消息里的工具清单必须等于白名单。
- **reviewer 的 Bash 命令级黑名单**：工具白名单挡不住 `Bash` 里的 `git push` / `git commit` / `gh`。runner 为 reviewer 注册 SDK
  `hooks.PreToolUse`（matcher `Bash`），命令匹配 `[agent.reviewer].bash_deny` 任一正则即返回
  `{ hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason }`，并在事件流记一条 `tool.denied`
  （字段 role / tool / command / pattern）。`bypassPermissions` 不影响 hooks。黑名单来自配置，runner 不内置。
- **凡传给 SDK 的选项，其类型必须 `import type` 自 `@anthropic-ai/claude-agent-sdk` 的导出**（`Options`、`SpawnOptions`、
  `SpawnedProcess` 等），用 `Pick` / 索引类型派生，不得在 Collie 里手写一份。`import type` 在运行时被擦除，不影响惰性加载。
  手写签名与 SDK 不一致时 typecheck 不报、替身测试照过，只有真实运行才炸：v02-b02 `resume` 字段名、v02-b04 `interrupt` 丢 `this`、
  v02-b05 第 1 次 `spawnClaudeCodeProcess` 写成三参数（SDK 实际传一个 `SpawnOptions` 对象），三次同一类错误。
- `spawnClaudeCodeProcess` 的真实签名：`(options: SpawnOptions) => SpawnedProcess`，`options` 含 `command / args / cwd / env / signal`。
  runner 测试调用钩子时必须按这个形状传单个对象。
- SDK 因轮数用满等原因中止时，runner 须捕获并返回 `RunResult`（`exitCode` 非零、`stopReason`、
  以及已从事件流里拿到的 `sessionId`），不得让 `sessionId` 随异常丢失。
- runner 的测试须断言注入的 `query()` 实际收到的选项：`resumeSessionId` 落到 SDK 认的续接字段上。
  字段名对不上时 typecheck 不会报错，只有这条断言能抓住。

ROADMAP 写的 SIGINT → SIGTERM → SIGKILL 是子进程语义；Collie 只认 soft / hard / kill 三级，
映射到具体信号或 SDK 调用是 runner 内部的事（ROADMAP 0.4）。`fake.ts` 必须实现三级并可脚本化「不响应 soft」。

### 11.3 落盘与心跳

- `.collie/runs/<run_id>/stream.ndjson`：worker 的原始事件流，`onEvent` 每收一条追加一行，不做任何解析。
  与 `events.ndjson`（Collie 自己的 journal）分开。
- `.collie/heartbeat.json`：`{ run_id, batch_id, pid, worker_pid?, phase, started_at, updated_at }`。
  run 开始时写入，`run.finished` 写完之后才删除——覆盖 worker、reviewer、等 CI、仲裁的全程，
  不是只覆盖 worker（v02-b03 实测只覆盖了 worker，reviewer 与等 CI 的 36 分钟里并行启动不会被拒绝）。
  `phase` 取 `worker | reviewer | ci | arbiter`；worker 阶段每收到一条事件更新 `updated_at`，
  其他阶段每 `ci_poll_secs` 更新一次。`worker_pid` 为 `RunHandle.pid`，拿得到就记。
  worker 子进程必须随 R2 一起死：runner 用 `detached: true` 把子进程放进自己的进程组，R2 在 `exit` / `SIGTERM` / `SIGINT` 时对
  `-worker_pid` 发 `SIGTERM`；R2 被 `SIGKILL` 没机会清理时，子进程靠 `prctl(PR_SET_PDEATHSIG)` 不可移植，改为 worker 侧
  **父进程看门狗**：runner 给子进程的 env 加 `COLLIE_PARENT_PID`，并以 `--parent-watch` 之类方式让子进程每 2 秒 `kill(ppid, 0)`，
  父进程不在就自杀——Claude Code 不接受这种参数，因此退而求其次：R2 启动一个极小的守护进程（`node -e`，与 R2 同组之外），
  它持有 R2 pid 与 worker_pid，每 2 秒探测，R2 消失即对 worker_pid 发 `SIGKILL` 后自退。守护进程的 pid 也写进心跳（`guard_pid`）。
  下一次 `collie run` 启动时若文件存在：`pid` / `worker_pid` / `guard_pid` 任一存活则拒绝启动（铁律 1），退出码 1；
  两者都不存活判定「上一次被 kill」：记 `run.orphaned`（字段 run_id / batch_id / phase / updated_at），
  执行 11.4 的救援，再删除该文件。

R2 自救（v02-b05 第 1 次运行后）：R2 依赖的代码在真实运行里坏掉、`collie run` 无法完成一轮时，
不在 Collie 之外手改 `src/`。操作员从**最近一次 PASS 裁定提交**建 worktree 并 `npm ci`，
用 `npx tsx <worktree>/src/cli.ts run <修复批次>`、cwd 仍为主仓库根来运行 R2；R1 签发只含该修复的批次。
R2 以 `process.cwd()` 为仓库根，手册、配置、journal 都读写主仓库，只有 R2 自身的代码来自 worktree。
这和「R2 总是运行启动时加载的旧代码」是同一件事，只是把「旧」显式指定为已验证的那一版。修好后删掉 worktree。

R2 的异常兜底（v02-b04-fix 第 1 次运行后）：`collie run` 的主流程必须有最外层的 try / finally。
任何未预期的异常（含 `stop()` 抛出、Promise 未处理拒绝）都不得让进程直接退出：
先记 `run.finished`（`result: error`，带错误信息与当时的 phase），再执行 11.4 的救援、追加 progress 运行记录、
删除心跳，最后以退出码 1 结束。进程级别须注册 `unhandledRejection` 处理，走同一条收尾路径。
v02-b04-fix 第 1 次运行：soft 停止时 `interrupt()` 抛 TypeError 未被捕获，Node 直接终止，
run.finished / 救援 / progress / 心跳删除全部没有执行。

### 11.4 脏工作区救援

worker 退出后（无论原因），若 `git status --porcelain` 非空，R2 执行
`git add -A && git commit -m "wip(collie): <batch_id> rescue"`，记 `worker.rescued` 事件（字段 sha / files）。
救援提交不推送。它位于 `base_sha..head_sha` 之内，规则 2 照常统计其中的受保护路径改动。

### 11.5 活性检测

R2 在 worker 运行期间按两条独立计时判定：

- **卡死**：距上一条事件超过 `stall_secs` → 记 `worker.stalled`，进入 11.6 阶梯。
- **空转**：持续收到事件，但「产出指纹」超过 `progress_secs` 无变化 → 记 `worker.idling`，进入 11.6 阶梯。
  产出指纹必须随**文件内容**变化：`HEAD` sha + `git diff HEAD` 输出的哈希 + 未跟踪文件的 (路径, 大小, mtime) 列表哈希，
  每收到一条事件采样一次。不能只用 `git status --porcelain`：它对已变脏的文件只输出 ` M path`，
  内容再改也不变，worker 在同一组文件上连续改超过 `progress_secs` 就会被判空转
  （v02-b04-fix 第 1 次运行：最后一个新变脏文件在 03:05:09，900 秒后 03:20:09 判空转，其间 worker 一直在编辑）。

两者都以事件为驱动，没有事件时只有 stall 计时在走。
空转计时从 worker 启动算起，开局的读与想也算在里面；阈值的取舍见 13.12。
卡死只认「完全没有事件」。SDK 在模型生成一段长输出（正文或工具参数）期间不发任何事件，
所以 `stall_secs` 必须大于单次最长输出的时长；report.md 的 Write 调用就是最长的一次
（v02-b04 第 1 次运行：推送后 90.5 秒无事件被判卡死，实为正在写 report）。
300 秒是权宜值；根治靠 runner 开启 SDK 的逐片输出事件作为事件来源（Q6）。
计时器、时钟、产出指纹函数三者都必须注入（`now()` / `setTimer()` / `fingerprint()`），
默认实现才用 `Date.now` / `setTimeout` / 真实 git（v02-b04-tests 证明只注入前两者不够：
取指纹的 git 子进程仍是真实时序，单核加压下场景 G 3 次挂 2 次）；
测试用假时钟推进，不得断言真实耗时（v02-b03 的场景 G 用真实时钟，全量并发下 2.8~3.1 秒，随机失败）。

### 11.6 信号阶梯

```
stop('soft') → 等 grace_secs → 未退出则 stop('hard') → 等 grace_secs → 未退出则 stop('kill')
```

每级记一条 `worker.signaled`（字段 level / reason，reason 取 stalled / idling / wallclock）。
v0.1 的 `wallclock_secs` 超时从「直接 abort + 记 crashed」改为走本阶梯，reason=wallclock。
阶梯结束后一律执行 11.4 救援。
某一级 `stop()` 抛出或拒绝时不得向上冒泡：记 `worker.signaled`（该级，字段 `error` 为消息），视同「未退出」直接进入下一级；
`kill` 级也失败则进入 11.3 的异常兜底。

### 11.7 中断标记与 resume

一次运行若以 stalled / idling / wallclock / orphaned / turns_exhausted / 非零退出结束，
**且仲裁结论不是 PASS**，称为**中断**。worker 非零退出但 report 已提交、仲裁按证据判 PASS 的运行
（v02-b03 第 1 次：200 轮用满，但交付在前）不算中断，下一轮 `attempt` 不递增。
**FIX 重跑也不是中断**（v03-b04 后明确）：`attempt` **递增**（每次运行一个号，便于对照 journal 与汇报），
`base_sha` 沿用首次，但 frontmatter 的 `interrupted_at` 为 `null`、正文**不写**「上一轮中断」一节，
改写一节「上一轮判 FIX」：原样列出上一轮 verdict 的 `gaps` 与未通过的验收命令及其退出码，以及上一轮的代码提交清单，
并写明「这些提交已在审核范围内，只补缺口，不要重做」。v03-b04 第 2 次把 FIX 写成了「中断、原因 unknown」，worker 靠自己读 progress 才没被误导。
v04-b07 起这一节还要写上一轮的降级规则与原因，提交清单只列 worker 的代码提交（13.10）。
无论哪种结束方式，`run.finished` 事件与 `docs/progress.md` 的运行记录都带 worker 的
`exit_code` 与 `stop_reason`，让人看得出它是怎么结束的（2.3）。
下一次对同一批次 `collie run` 时：

- `task.md` frontmatter：`attempt` 递增；`interrupted_at` 填
  `"<上次 run_id> <结束原因> <最后一条事件类型>@<时间>"`；若有救援提交，加 `rescue_sha`。
  结束原因的来源按序：**本轮有 `worker.signaled` 则取其 `reason`（`wallclock` / `stalled` / `idling`）** → `run.finished.worker_stop_reason`
  → `run.finished.result` → 本轮有 `run.orphaned` 则 `orphaned` → `unknown`。SDK 被 soft 中断后返回的是 `error_during_execution`，
  那不是结束原因，是中断的副作用（v03-b03 第 1 次：`worker.finished stop_reason=error`，真正的原因是 `wallclock`）；
  `worker.finished` 本身也应在有 `worker.signaled` 时把 `stop_reason` 记成阶梯 reason、把 SDK 的值放进 `sdk_stop_reason`。
  最后一条事件在 journal 没有 `run.finished` 时取 `stream.ndjson` 的最后一行，journal 的 `worker.started` 不算。
  `stream.ndjson` 的行是 SDK 消息：事件类型取 `type`，若 `type` 为 `assistant` / `user` 则细化为 `type/subtype` 或工具名
  （`tool_use` 的 `name`），时间取该消息的 `timestamp`，没有则向前找最近一条有 `timestamp` 的，再没有用心跳的 `updated_at`；时间不得为空。
- `rescue_sha` 的来源：救援提交可能记在**上一轮**的 journal（阶梯收尾路径）或**本轮**的 journal（孤儿救援路径，`run.orphaned` 之后）；
  生成 task 时两处都查，取最后一条 `worker.rescued`。有 `rescue_sha` 时正文必须写
  「请先核实 `rescue_sha` 中的半成品是否完整，不要把它当作已完成」；没有时写「上一轮未留下救援提交，请从 `git log` 核实已完成到哪一步」。
- 取证范围：attempt ≥ 2 时 R2 的 `evidence` 与 reviewer 的 `base_sha` 一律用 frontmatter 里沿用的首次 `base_sha`，不是本次 task 提交；
  `commits_actual` 因此含上一轮的提交。
- **FIX 重跑同样沿用首次 `base_sha`**：`attempt` 只在中断时递增，但 `base_sha` 的沿用不看 attempt，看的是本批次第一条 `batch.selected`；
  FIX 后重跑取证范围仍是首次 `base_sha..head_sha`（v02-b05-fix 起如此，v03-b03-fix 第 1 次操作员问到，补写明）。
- **`head_sha` 的后代检查也按首次 `base_sha`**（v03-b03 第 2 次后）：`head_sha` 必须是首次 `base_sha` 的后代且是当前 `HEAD` 的祖先（或等于 `HEAD`），
  **不是**本轮 task 提交的后代——上一轮已把代码全部提交、本轮只补 report 时，正确的 `head_sha` 早于本轮 task 提交
  （第 2 次：`09f229c` 早于 `67d74f6`，R2 误报上报）。attempt 1 时首次 `base_sha` 就是 task 提交的父，两种写法等价。
- **取证范围排除 R2 自己的提交**：`base_sha..head_sha` 里提交信息以 `docs: issue ` / `progress: ` / `report(collie): ` / `ops: ` 开头的提交
  是 R2 或操作员的信封、裁定、汇报，不是 worker 产出，`commits_actual` 与规则 2 / 3 的 diff 都要跳过它们（按提交逐个 diff 再合并，
  不能直接 `git diff base..head`）。R1 的提交（`r1: ` 开头）**不排除**：R1 在同一批次两次 attempt 之间不得往 main 推受保护路径的改动
  （第 2 次：`357e110` 落在 `556049e..HEAD` 内，改了 5 个受保护文件；这次因 `head_sha` 停在它之前没触发规则 2）。
  这是对 R1 的约束，写进 AGENT_KICKOFF.md 与 R1 自己的流程：一个批次 BLOCK / FIX 后要改规格，先把该批次收掉（标 blocked 或改签新批次），再推。
- **续接的成本判断**：上一轮若已有代码提交且推送、工作区干净（即只缺 report），**不续接会话**，`session_id: null` 新开
  （第 2 次：续接 15 轮花 $21.49，新开会话做同样的事约 $2）；只有上一轮代码未完成（有救援提交，或最后一次代码提交之后还有未推送的改动）才续接。
- `task.md` 正文追加一节「上一轮中断」：原样写出上述信息，并写明
  「请先核实 `rescue_sha` 中的半成品是否完整，不要把它当作已完成」。这段只有 R2 知道，worker 自己说不出来。
- 若上次 `RunResult.sessionId` 存在且本批次累计 resume 次数 < `resume_max`：
  传 `resumeSessionId`，记 `worker.resumed`（字段 session_id / attempt）。
- 否则：不传 session，新 worker 按 task 正文的中断说明自行从 `git log` 与 `docs/progress.md` 定位。
  记 `worker.resumed` 且 `session_id: null`。

### 11.8 新增事件类型

`run.orphaned` / `worker.stalled` / `worker.idling` / `worker.signaled` / `worker.rescued` / `worker.resumed`。
只新增，不升 `SCHEMA_VERSION`（铁律 14 新解）。

### 11.9 v0.2 验收：三种中断必须被接住

全部用 `fake.ts` 构造，自动化可重跑，断言只看仓库与 journal 状态。

**场景 E 中途被杀。** fake worker 改了两个文件后进程被 kill（fake 以「写文件后 stop('kill') 自己」模拟）。
期望：`worker.rescued` 事件存在，`wip(collie): <batch_id> rescue` 提交存在且含那两个文件；
再次 `collie run` 同一批次，`task.md` 的 `attempt=2`、`interrupted_at` 非空、正文含 `rescue_sha`。

**场景 F 模型断连。** fake worker 第一次以非零退出且给出 sessionId；第二次运行收到 `resumeSessionId` 后成功。
期望：第二次 `worker.resumed` 带该 session_id；构造第三、四次仍失败，第四次（超过 `resume_max`）
`worker.resumed.session_id` 为 null。

**场景 G 空转。** fake worker 持续发事件但不改任何文件，超过 `progress_secs`（测试里配成 1 秒）。
期望：`worker.idling` → `worker.signaled(soft)` → fake 响应 soft 退出 → 无救援（工作区干净）；
变体：fake 不响应 soft，期望 `signaled(hard)` 继续出现。

补充：场景 E/F/G 的 `collie show` 输出必须能按顺序还原事件链。

## 12. v0.3 连续

目标（ROADMAP 第 5 节）：无人干预连跑多个批次，只在该打扰人时打扰。通过标准：零误放行；被打扰次数 ≤ 应打扰次数 + 1。
本章在 v0.2 的结构上只做追加；规则 1~10 不变。三个批次：12.1 收回人工动作，12.2 队列与分流，12.3 放行与停表。

### 12.1 收回人工动作（v03-b01）

v0.2 期间每轮有两个人工动作：操作员推送 R2 的裁定提交、操作员转发汇报。前者从本批次起由 R2 自己做，后者是 v0.4 的事。

- **R2 推送裁定提交**：写完 progress 与信封、提交之后，`git push --quiet origin <expected_branch>`，记 `verdict.pushed`。
  推送失败（网络、拒绝）记 `verdict.push_failed`（字段 error），**不改变本轮结论、不重试、不抛出**，退出码照旧；
  **补推的唯一条件**（v03-b01 第 1 次运行后收紧）：journal 里最近一条 `verdict.push_failed.sha` 恰好等于当前 `HEAD`，且远端不含它。
  满足才 `push` 一次并记 `verdict.pushed`；`HEAD` 是别的东西（救援提交、worker 未审提交、任何不是裁定提交的 sha）一律不推，
  记 `verdict.push_skipped`（字段 head / reason）。没有 `push_failed` 事件时启动阶段**不执行任何 push**。
  补推必须在 11.3 孤儿检测与 11.4 救援**之前**执行：救援提交不推送是铁规则，启动时的 push 不得把它带上 main
  （b01 的实现无条件推送且位于救援之后，下一次真实孤儿救援就会把 wip 提交推上 main）。推送用的 remote 与凭据和 worker 相同（`.git/config`）。
- **启动时核查上一条裁定提交的 CI**（Q7）：`collie run` 启动阶段，取 journal 里最近一条 `verdict.pushed.sha`，
  用 token 查一次它的 CI（`queryCi`，不等待）：`failure` / `cancelled` 则 stderr 打印
  `warning: previous verdict commit <sha> CI <conclusion> (<run_url>)`，并记 `ci.verdict_commit`；
  `success` 只记事件；`no_runs` / `pending` / 限流不记、不警告。警告不阻止启动——裁定提交只改 docs，红只可能是随机失败的测试，
  但人必须能在 journal 与 stderr 看见。
- **reviewer 事件流落盘**：`.collie/runs/<run_id>/reviewer.stream.ndjson`，与 worker 的 `stream.ndjson` 同一套写入与 `redact` 屏蔽。
  目的：AGENT-reviewer.md 要求「行为要求必须实跑」，没有落盘就只能信 reviewer 自述（v02-e-fix2 操作员无法独立确认）。
- **规则 9 的场景测试**（场景 H）：fake worker 产出 `claims.pushed=false` 且远端确实没有 head，reviewer 判 PASS；
  期望 arbiter 降为 FIX，journal 有 `verdict.downgraded`（rule=9）。规则 9 在 v0.2 期间从未真实触发，场景 H 是它唯一的回归证据。

### 12.2 队列与分流（v03-b03）

`collie run --continue [--max N]`：不带批次名，按 backlog 优先级取第一个 `pending` 且所有依赖已 `passed` 的批次，跑完按裁决分流：
- PASS → R2 把 backlog 状态表该行改为 `passed`（记 `batch.status`）、提交进裁定提交、推送（12.1），取下一个；
- FIX → 同批次返工计数 +1；**计数只数本次 `--continue` 内本批次的 FIX 次数**（不是所有历史运行的 `run.finished`——v03-b04 的实现跨全部历史累计，
  同一批次以前单批次模式跑过的 FIX 会把队列一上来就顶到 `fix_max`）；计数 ≤ `fix_max` 则立即重跑同批次
  （attempt 递增、沿用首次 `base_sha`，11.7）；超过则按 BLOCK 处理并记 `escalated`（reason `fix_max`），
  这条路径上的 backlog 提交同样按 12.1 推送（13.10；v04-b07 前没有推）；
- BLOCK / 上报 → 停下，退出码 20；backlog 状态改为 `blocked`。两种情况各自动重跑一次、不停：规则 1（12.3）；被信号阶梯掐掉且没有 report 的中断（13.14，v04-b10）。
依赖未满足的批次跳过并记 `batch.skipped`；队列里没有可执行批次则记 `queue.finished`（reason `exhausted` 或 `escalated`）退出码 0 / 20。
`--max N` 限制本次最多跑 N 个批次（缺省不限；数的是 PASS 的批次，FIX 重跑不计），到数记 `queue.finished`（reason `limit`）退出码 0。
队列 journal（`q-` 运行目录）要能独立还原队列做了什么：每次拉起批次运行前记 `queue.batch_started`
（字段 batch_run_id / batch_id / attempt / why：`new` / `fix_retry` / `rule1_retry`；批次运行号不能叫 `run_id`，见 13.10），`queue.finished.batches` 改为对象数组
`{batch_id, run_id, verdict}`。只有一行 `queue.finished` 且不带 run_id 的队列 journal（v03-b04）不够。
run_id 格式：批次运行 `r-YYYYMMDDHHMMSS`、队列运行 `q-YYYYMMDDHHMMSS`，v03-b03 起不再有中间的 `-`；两种前缀都要被 `show` / `audit` 接受。
每个批次结束后仍执行 11.3 的清理与 12.1 的推送；批次之间不共享任何进程，每个批次的 worker / reviewer / 守护进程都是新拉起的。
`collie run <batch>` 单批次模式行为不变，也**不**改 backlog 状态（状态列只在 `--continue` 下由 R2 写，单批次模式仍由 R1 写）。

backlog 状态列的写法：只改状态表里该批次那一行的最后一列，用正则定位 `| <id> |` 开头的行，其余内容一个字节不动；
找不到该行或该行格式不符就不改、记 `batch.status` 的 `to` 为 `unchanged` 并继续。R1 仍是唯一的条目作者（铁律 19 的受保护路径不变，
`docs/backlog.md` 对 worker 仍是只读；R2 的这处改动在 `base_sha..head_sha` 之外，规则 2 不会把它算进 worker 的 diff）。

v03-b03 的真实验证（ROADMAP：连跑 5 个真实批次）：b03 PASS 后，操作员用 `--continue` 从 b04 起连跑，中途不说「跑」；
b04 与后续批次的汇报改成每批一个 `docs/ops/` 文件（见 AGENT_KICKOFF.md「交接走仓库」）。

### 12.3 放行与停表（v03-b04）

`--continue` 在一个批次 PASS 之后、取下一个之前做一次**放行判定**。PASS 的结论、裁定提交、backlog 状态 `passed` 都不变，判定只决定「继续还是停」。

自动放行（全部满足才继续）：
- 仲裁 PASS 且本批次没有 `verdict.downgraded`（规则 9 没降过级、没有被规则 8 救回来的验收失败）；
- `claim_mismatches` 为空；
- `ci.resolved.conclusion === 'success'` 且 `branch_matched`；
- `deps_diff` 为空、`spec_diff_lines === 0`（这两条本来就会 BLOCK / FIX，列在这里是为了让判定自成一体）；
- reviewer 的 `gaps` 为空。

`spec_diff_lines` 统计的就是全部受保护路径的改动行数（`evidence.ts` 的 `PROTECTED_PATHS`）。v03-b04 曾把「受保护路径改动为 0 行」另列为一项、原因码 `protected`，
它和 `spec_diff` 取的是同一个数据，一次受保护改动会报两条原因。v04-b01 删除这一项，判定共六项。

否则记 `queue.paused`（`reasons` 列出没满足的每一条，字段名用上面的英文：`downgraded` / `claim_mismatches` / `ci` / `deps_diff` / `spec_diff` / `gaps`），
`queue.finished` reason `paused`，退出码 **30**。人看一眼后再 `--continue` 就从下一个批次接着跑——停表不是失败，只是「这一批过了但有话要说」。

停表清单（任何裁决下都停）：
- 规则 9 降级（`verdict.downgraded` rule=9）在**连续两个批次**出现 → `queue.paused` reason `rule9_twice`（即使第二个批次最终 PASS）。
- 同一批次第 2 次 BLOCK → 停（现有行为，BLOCK 本来就停）。

规则 1 的特殊处理：reviewer 输出格式错（规则 1）导致的 BLOCK，同批次**第一次**自动重跑一次，记 `batch.retried`（rule 1），**不计入** `fix_max`；
第二次仍是规则 1 → 停，退出码 20。理由：v02-b04-tests、v02-b04-fix4 都是代码良好、reviewer 格式错，重跑一次就过，不值得叫人。

打扰计数：`queue.finished` 带 `paused_count`（本次 `--continue` 里 `queue.paused` 的次数）。ROADMAP 的通过标准
「被打扰次数 ≤ 应打扰次数 + 1」用它和 BLOCK 次数之和来数。单批次模式 `collie run <batch>` 不做放行判定、不发 `queue.paused`。

## 13. v0.4 看见

目标（ROADMAP 第 6 节）：一眼看懂「项目进展到哪了、现在在干什么、那批为什么挂了」。通过标准：不看源码、不翻原始日志，仅凭四个命令能说清每个批次的来龙去脉。
本章只做追加：规则 1~10、放行判定、队列逻辑都不变，四个命令全部只读。原定五个批次：13.1 数据补齐，13.2 投影与 `status`，13.3 `timeline`，13.4 `why`，13.5 `watch`。
第一次队列运行（2026-11-10）之后追加两个修补批次：13.9 环境故障（v04-b06），13.10 队列收尾（v04-b07）；这两个批次改的是 R2，不在「队列逻辑不变」之内。v04-b01 的裁定见 13.11。
第二次队列运行（2026-11-11）之后：`why` 改签为 v04-b09（13.4），追加 13.13 投影取值修补（v04-b08）、13.14 队列里的中断续跑（v04-b10，改 R2）与 13.15 后台 git 读取不抢索引锁（v04-b11，改 R2）；裁定与开局预算见 13.12。

### 13.1 观测数据补齐（v04-b01）

四个命令只读 journal，所以要看的东西必须先在 journal 里。到 v0.3 为止，轮数、花费、token、测试数、裁定走到哪条规则都不在 journal 里，
操作员是从 `stream.ndjson` 和 `progress.md` 里抄出来的。本批次补齐，全部是**可选字段**，不升 `SCHEMA_VERSION`（与 `ci_passed` 的先例一致）；
runner 没给的值不写，不写 0。

- **运行级**：`worker.finished` 追加 `num_turns` / `cost_usd` / `duration_ms` / `usage`
  （`input_tokens` / `output_tokens` / `cache_creation_input_tokens` / `cache_read_input_tokens`）；
  新增 `reviewer.finished`，在 reviewer 运行返回后、解析 verdict 之前记，字段 `exit_code` 加同一组运行级字段
  （规则 1 的路径上没有可用的 `reviewer.verdict`，所以不能挂在它上面）；`worker.started` 与 `reviewer.started` 追加 `model`，取自配置 `[agent.<role>].model`。
  runner 接口：`RunResult` 加 `numTurns?` / `costUsd?` / `durationMs?`，`Usage` 加两个可选的缓存字段；`claude.ts` 的轮数、花费、token 从 SDK 结果消息取值，
  `duration_ms` 是 runner 自己量的墙钟，结果消息的形状沿用 `claude.ts` 里本地收窄的接口（v04-b01 的实现如此，13.11 裁定接受）；fake runner 能脚本化这些值。
- **批次级**：新增 `evidence.collected`，R2 取证完成后记一次，字段 `commits`（提交数）/ `tests_passed` / `tests_failed`（取不到为 null）/
  `acceptance_passed` / `acceptance_total` / `spec_diff_lines` / `deps_diff`（条数）/ `remote_has_head`。
- **裁定依据**：`run.finished` 追加 `rule`（1~10；上报路径没有规则时不写）与 `reason`（截断至 500 字）；
  `reviewer.verdict` 追加 `gaps`（数组，至多 20 条，每条截断至 300 字）。verdict 可解析时总是写，没有缺口写空数组
  （v04-b07；v04-b01 的实现在没有缺口时不写）。
- 顺带清理：12.3 放行判定删去重复的 `protected` 一项；README 的状态行与铁律条数改成现状。

覆盖率不在 v0.4 范围：项目没有测覆盖率，ROADMAP 第 6 节列的「覆盖率变化」等真有覆盖率数据时再加。

### 13.2 投影模块与 `collie status`（v04-b02）

`src/view.ts` 是四个命令唯一的取数入口，分两层：
- **读取** `loadRuns(root)`：扫 `.collie/runs/*/events.ndjson`，逐个运行重放。某个运行的 journal 校验失败时不抛出，
  该运行记为 `unreadable`（带原因），其余照常——历史目录里有 v0.1 / v0.2 的旧格式 run_id 与旧事件，一个坏文件不能让四个命令全部失效。
- **投影** `projectRuns` / `projectBatches` 等纯函数：输入事件数组，输出记录；不读文件、不读时钟（`now` 由参数传入）、
  不 import `run.ts` / `runner/` / `roles/`。13.1 的字段在旧 journal 里没有，投影给 `null`，显示为 `—`。

数据源只有 journal。唯一的例外是「队列剩余」读 `docs/backlog.md`（队列的事实源是 backlog）。四个命令不读 `stream.ndjson`、
`progress.md`、`heartbeat.json` 与信封文件，不写任何文件。

`collie status [--json]`，三段：
- **当前**：进行中的运行（有 `run.started`、没有 `run.finished` 的最新一个）的批次、attempt、阶段（worker / reviewer / 取证）、已运行时长、
  距最后一条事件的秒数；没有进行中的运行则写 `idle`，并给出最近一次结束的运行与结论。
- **队列**：backlog 里 `pending` 的个数、下一个可执行批次、`blocked` 的清单。
- **最近一次队列运行**：`reason`、跑过的批次与结论、`paused_count`。

没有任何 journal 时打印 `no runs recorded`，退出码 0。`--json` 输出同一结构。退出码：0 正常，1 Collie 自身错误。

### 13.3 `collie timeline`（v04-b03）

项目时间轨迹，按时间升序每行一个节点：批次第一次开始、每次运行结束（结论、attempt、用时）、`batch.status` 变化、队列运行的开始 / 停表 / 结束。
回答「某批次是什么时间完成的」。选项：`--since <日期>`、`--batch <前缀>`、`--json`；
`--by version` 按批次号的版本前缀（`v03-`）汇总：首次开始、最后结束、批次数、运行数、FIX 与 BLOCK 次数、总花费（没有数据的运行不计入并注明个数）。

ADR 批准与发布不进时间轨迹：它们是 R1 与人的动作，不经过 R2，journal 里没有对应事件，v0.4 不为此造事件。输出末尾固定一行说明去 `git log` 看。

### 13.4 `collie why <batch_id>`（v04-b09；原 v04-b04 没有产出代码，见 13.12）

按 attempt 摊开一个批次每次运行的证据链，顺序固定：worker 怎么结束的（退出码、`stop_reason`、轮数、花费）→ 取证摘要（`evidence.collected`）→
每条 `acceptance.failed`（命令、退出码、期望）→ `claim.mismatch` → reviewer 结论与 `gaps` → CI（`ci.resolved` / `ci.wait_timeout`）→
`verdict.downgraded` / `escalated` → 中断与恢复（`run.orphaned` / `worker.signaled` / `worker.rescued` / `worker.resumed`）→ `tool.denied` → 推送。
每个 attempt 末尾一行「结论：<verdict>，规则 <n>：<一句话>」，一句话由规则号对应的固定模板加 `reason` 生成，**不调用模型**。
PASS 的批次同样可以问：列出放行依据，以及有没有 `queue.paused`。选项：`--attempt <n>`、`--json`。

退出码：0 有数据；1 批次不在 backlog；2 批次在 backlog 但本机没有它的 journal（沿用 `audit` 的「无数据」语义）。
与 `show` 的分工：`show` 打印信封原文与事件原样；`why` 只读 journal，给出因果。
attempt 的取值按 13.13，与 `status` / `timeline` 用同一个推算函数。放行依据：有 `queue.gate_passed`（13.14）时引用它；
没有时（旧 journal、单批次模式）列出放行判定六项各自对应的事件事实，取不到的写 `—`，不下「已放行」的结论。

### 13.5 `collie watch`（v04-b05）

实时跟随：轮询 journal（`--interval <秒>`，默认 2），每出现一条新事件打印一行，阶段变化时打印一次 `status` 的「当前」段。
距最后一条事件超过配置的 `stall_secs` 时，在该行标出静默秒数。单批次运行在 `run.finished` 后退出，队列运行在 `queue.finished` 后退出，退出码 0。
`--once`：打印当前一帧后立即退出。没有进行中的运行且不带 `--once` 时等待新运行出现；`--timeout <秒>` 到时退出码 0，缺省不超时。

实现放在 `src/watch.ts`，只读：不写 journal、不碰心跳、不发信号。轮询用注入的时钟与 sleep，测试不用真实定时器。

### 13.6 队列运行用固定版本的 R2

`--continue` 连跑多个批次时，R2 不从 worker 正在改的工作树启动：操作员按 11.3「R2 自救」的做法，从开跑前最近一次 PASS 的裁定提交建 worktree，
用它的 `src/cli.ts` 启动，cwd 仍是主仓库根。理由：批次之间 R2 会重新加载代码，从工作树启动等于让上一批刚写、只经过一次审核的代码去裁定下一批。
代价：队列中途改好的 R2 行为要到下一次队列才生效，13.1 的新字段在本次队列的 journal 里也不会出现。验收命令在检出于 `head_sha` 的独立 worktree 里跑，测的是 worker 的新代码，不受 R2 版本影响；
但那个 worktree 里没有历史 journal，四个命令在真实运行目录上的表现要由操作员在队列结束后另跑一次（13.7）。

### 13.7 验证

v04 的批次用一次 `--continue` 连跑，同时是 ROADMAP 第 5 节 v0.3 的收口实验：数 `queue.paused` 与 BLOCK 的次数，逐个判断该不该打扰；零误放行才算过。
第一次（2026-11-10，`--max 5`）只跑了 v04-b01 就因环境故障停下（13.11）。第二次（2026-11-11，`--max 6`）跑了三批：v04-b02、v04-b03 通过，
批次之间放行两次、零误放行，v04-b04 被判空转后停下（13.12）。两次合计打扰 2 次，其中应打扰 1 次；还没有一次连跑满 5 批，收口实验仍未完成。第三次从 v04-b05 起，`--max 7`。
v0.4 自己的验证放在下一次队列运行：操作员不看源码、不翻原始日志，只用四个命令写出队列汇报；写不出来的每一处记为缺口，进下一个修补批次。

### 13.8 明确不做

Web dashboard、指标聚合与告警、任何可观测框架（ROADMAP 第 6 节）；覆盖率；ADR 与发布节点；让四个命令写文件或调用模型。

### 13.9 环境故障不当成 worker 的 FIX（v04-b06）

来源：队列 q-20261110151133。操作员机器上 `ci.token_file` 指向的文件丢失，R2 按 3.1 的旧条文当作未配置、改用匿名查询，而匿名配额是 0；
规则 9 把 PASS 降为 FIX（这一步是对的），队列又把它当成 worker 的 FIX 重跑了两次，最后以 `fix_max` 停下。两次重跑不可能改变结果。
规则 9 本身不变：没有 CI 证据就不能 PASS。变的是下面两件事。

**token 文件读不到就启动失败。** 配了 `ci.token_file`，但文件不存在、读不了或去掉空白后为空：
- `collie run`（两种模式）在签发 task 之前退出，退出码 1，stderr 一行，含 `ci.token_file`、展开后的路径与原因；不签发 task、不拉起 worker。
- `collie smoke` 先做同样的检查，再调用 runner（检查失败不花模型费用）；runner 通过后，用 token 对当前 `HEAD` 查一次 CI（`queryCi`，不等待）：
  请求失败（认证、限流、网络）退出码 1 并打印原因，成功打印一行 `ci ok`；查不到运行不算失败。
- 没配 `token_file` 时行为不变。
- 读 token 的代码收成一处（现在 `evidence.ts` 与 `run.ts` 各有一份）；`.token_file` 仍只在这两个文件里访问（现有不变量）。报错、事件与输出里不得出现 token 内容。

**证据取不到时标出原因，队列不重跑。** 规则 9 触发且下列任一成立时，R2 在 `verdict.downgraded` 上追加 `cause: "evidence_unavailable"` 与 `detail`（错误原文，截断至 300 字）：
- 判断「已推送」时 `git fetch` 失败；
- 查询 CI 的请求本身失败：限流、HTTP 错误、网络错误、响应不是合法 JSON；
- 等待 CI 时最后一次轮询是 `rate_limited`。

下列情况不算，照旧是普通的 FIX：CI 跑了但失败或被取消；CI 没有触发（`no_runs`）；等到 `ci_wait_secs` 仍是 `pending`；fetch 成功但远端没有 `head_sha`（worker 没推送）；分支不符。

带 `cause` 的 FIX，结论与 progress 记录不变（仍是 FIX，退出码 10），单批次模式的总结行多写一句原因。`--continue` 下：
- 不重跑，不计入 `fix_max`；
- backlog 状态不动（仍是 `pending`），不记 `batch.status`；
- 队列 journal 记 `escalated`（reason `evidence_unavailable`，带 batch_id）与 `queue.finished`（reason `evidence_unavailable`），退出码 20，
  标准输出的总结行是 `queue: evidence_unavailable (...)`，stderr 一行写 `detail`。

环境修好后再 `--continue`，该批次仍是队首，按 11.7 的 FIX 重跑语义再跑一次（attempt 递增）。不做「只重新取证、不拉 worker」的模式：为省一次便宜的重跑多一个运行模式，不值。

### 13.10 队列收尾的三处（v04-b07）

同一次队列运行暴露，都在 v03-b04-fix 的代码里。

- **`queue.batch_started` 写错了 journal。** 12.2 把批次运行号这个字段也叫 `run_id`，与事件信封的键同名；`Recorder.record` 先写信封再展开扩展字段，
  队列的 `run_id` 被覆盖，事件落进了批次的 `r-` journal，队列 journal 里一条都没有。修订：字段改名 `batch_run_id`（3.6、12.2 已同步）；
  `Recorder.record` 遇到名为 `ts` / `run_id` / `event` 的扩展字段直接抛错。`queue.finished.batches[]` 里的 `run_id` 是嵌套对象的键，不受影响。
  这是规格的错，不是实现的错：扩展字段的名字今后不得与信封键相同。
- **`fix_max` 升级时的提交没有推送。** 这条路径把 backlog 状态改成 `blocked` 并提交，但没有走 12.1：提交后按 12.1 推送，
  在队列 journal 记 `verdict.pushed` 或 `verdict.push_failed`。
- **FIX 重跑的 task 说不清上一轮为什么 FIX。** 规则 9 的降级既没有 `gaps` 也没有失败的验收，「上一轮判 FIX」一节只剩提交清单，
  worker 靠自己读 progress 才知道原因。修订：这一节加一个小节「降级原因」，写上一轮 `verdict.downgraded` 的规则号与 `reason`，有 `cause` / `detail` 时一并写；
  提交清单只列 worker 的代码提交，按 11.7 的 R2 提交前缀排除，不原样采用 reviewer 自报的 `commits_actual`（v04-b01 的清单里混进了 `docs: issue` 的信封提交）。

**批次历史不得把队列 journal 当成一次运行**（2026-11-11 补，v04-b07 开跑前发现）。11.7 的批次历史把 `.collie/runs/` 下每个含该 `batch_id` 事件的 journal 都当成一次批次运行，
没有 `run.finished` 的算中断。`queue.batch_started` 挪回队列 journal 之后，它会出现在每个批次第一次运行**之前**，于是队列里每个批次的第一次运行都会被标成 attempt 2、task 里写「上一轮中断」。
R1 用一份只含这一条事件的队列 journal 实测过当前代码：`batchHistory` 返回 attempt 2，`interrupted_at` 是 `q-… orphaned queue.batch_started@…`。
队列 journal 里现在就有带 `batch_id` 的事件（`batch.retried`、`batch.status`、`escalated`、`queue.paused`），按同一段代码，规则 1 重跑后的 attempt 会多 1（读代码得出，真实运行里还没出现过规则 1 重跑）。
修订：只有含 `run.started` 的 journal 才算一次批次运行。`hasBatchRetried` 这类本来就要读队列 journal 的扫描不变。

另：`reviewer.verdict` 的 `gaps` 在 verdict 可解析时总是写，没有缺口写空数组（13.1 已同步）。读 journal 的一方靠它区分「没有缺口」与「旧 journal 没有这个字段」。

### 13.11 v04-b01 的裁定（2026-11-11）

v04-b01 在队列 q-20261110151133 里三次都是：验收 10/10 通过、reviewer 判 PASS、规则 9 因 CI 证据取不到降为 FIX，随后 `fix_max` 停下，backlog 状态 `blocked`。
所有者裁定：状态保持 `blocked`，代码提交 `7600a4c` / `89288a6` / `e0dcdcf` 采纳，不重跑；v04-b02 的依赖改为 v03-b04-fix。
不重跑的原因：重跑要先把状态改回 `pending`，而 R1 在同一批次两次运行之间不得改受保护路径（AGENT_KICKOFF「R1 的约束」）。
这次采纳**不是** R2 取到的证据。依据是 R1 的复核（lint 与类型检查通过、826 个测试通过、验收逐条通过、受保护路径零改动），
以及 GitHub Actions 公开页面上 `e0dcdcf` 的 Run 178 成功。

R1 复核发现的出入与处置：
- `gaps` 在没有缺口时不写：v04-b07 改（13.10）。
- `duration_ms` 由 runner 自己计时、结果消息的形状沿用本地收窄的接口：接受，13.1 已按实现修订。
- `test/journal-fields.test.ts` 在 `beforeAll` 里跑完整一轮，而钩子超时是 vitest 默认的 10 秒（测试超时是 30 秒）。有负载的机器上钩子会超时，
  该文件 7 个用例全部跳过、`npm test` 失败：R1 的机器上，默认超时下 9 次全量运行有 3 次如此，把钩子超时放到 30 秒后的 5 次没有再出现。
  v04-b02 把 `hookTimeout` 设成与 `testTimeout` 相同。
- 同一时段 R1 的机器上另有 4 次零散失败（`scenario-a`、`scenario-l` 各 1 次，`cli.test` 2 次，都是期望的退出码变成了 20），与钩子超时无关，
  单独跑这些文件不复现，原因没有查清。操作员机器与 GitHub 的 CI 上至今没有出现过。先观察，不签批次。

### 13.12 第二次队列的裁定与开局预算（2026-11-11）

队列 q-20261111051219（`--max 6`，固定版本 `e042215`）：
- v04-b02 第 1 次 FIX：R2 在没有 journal 的 worktree 里实测到 `status --json` 输出的不是 JSON，worker 在有 journal 的主仓库里自测看不到。队列自动重跑，PASS。
- v04-b03 一次 PASS。放行判定第一次在批次之间做决定，两次都放行，零误放行。
- v04-b04：worker 在 `progress_secs`（900 秒）内没有改出任何文件，被判空转、soft 停止，没有 report，上报 BLOCK，队列停下。

所有者裁定：
- v04-b02、v04-b03 维持 PASS。
- v04-b04 保持 `blocked`，没有代码可采纳，`why` 改签为 v04-b09。不原样重跑：它的条目要求按 attempt 展示，而 attempt 取自哪里规格没有写（13.13），R1 又不能在同一批次两次运行之间改 backlog。
- 开局预算两条（见下）。
- 追加三个批次，排在 v04-b07 之后：v04-b08（13.13）、v04-b09（13.4）、v04-b10（13.14）。R1 起草期间又查出 13.15，另签 v04-b11（修 R2 的缺陷，不改规则，R1 自行决定）。
- 第三次队列仍用固定版本 `e042215`，没有按 13.6 前移到最近一次 PASS 的裁定提交：那之后的 R2 改动（v04-b01 的 journal 字段）是所有者裁定采纳的，还没有被 R2 自己判过 PASS。本次队列结束后再前移。

**worker 的必读清单瘦身**（`AGENT-worker.md` 第 1 节）。v04-b04 的 worker 在写第一个文件之前读了 `SPEC.md`、`docs/progress.md`、`docs/backlog.md`（三份合计约 239KB）和几份代码，上下文到 11.5 万 token；
接着两段长思考共约 10 分钟，第一次写入因匹配不唯一失败，随即在 16.8 万 token 处触发上下文压缩（83 秒），900 秒到点。
`progress.md` 与 `backlog.md` 每跑一批都在变长，以后每个 worker 都要付这笔开销，而本批次的条目与验收已经全在 task 里。
修订：不读 `docs/progress.md` 与 `docs/backlog.md`；`SPEC.md` 只读 task 点名的小节，不通读。
相应地，R1 签批次时**条目正文**必须写明要读的 SPEC 小节号：task 只带条目、验收与额外禁止，不带 backlog 小节开头的说明文字。

**`progress_secs` 900 → 1500。** 空转计时从 worker 启动算起，开局的读与想没有任何宽限，而开局规划的时间随批次大小增长（v04-b04 是那次队列里最大的一批）。
没有采纳「计时从第一次写文件之后才开始」：那样开局阶段只剩 `wallclock_secs` 兜底，一个真空转的 worker 要到 3600 秒才被掐，按 v04-b04 的速度（900 秒 $4.00）约 $16。
同步改三处：`.collie/collie.toml`、`templates/collie.toml`、测试里的镜像。

失败矩阵（ROLES 第 5 节）写的是空转「掐掉，按 FIX 处理」，也就是重跑；队列的实现是上报后直接停。13.14 让队列对这类中断自动续跑一次，补上这个差距。

测试稳定性（接 13.11）：v04-b02 加上 `hookTimeout` 之后，钩子超时没有再出现；本次队列里操作员机器上的全量运行都通过。
13.11 记的另一类零散失败（用例期望的退出码变成 20）在 R1 的机器上仍然出现，原因已经查到，见 13.15。

### 13.13 投影的取值来源（v04-b08）

v04-b03 的 `timeline` 在真实 journal 上退出码 0、不报错，但有三处输出不对，验收与测试都没有测到（操作员在队列结束后实跑发现）：
- `attempt` 永远是 `—`。13.3 与 13.4 要求显示 attempt，却没有写它取自哪里；实现读了 `batch.selected.attempt` 与 `run.finished.attempt`，R2 从来不写这两个字段，
  测试夹具里手写了它们，所以测试全过。这是规格的错。
- 用时只读 13.1 的 `duration_ms`，没有这个字段的 journal 一律 `—`；而每个 journal 都有 `run.started` 与 `run.finished` 的时间戳。
- 按版本汇总时，所有运行都没有花费数据，显示 `$0.00`。

修订：
- **批次运行与 attempt。** 一次批次运行 = 一个含 `run.started` 的 journal（队列的 `q-` journal 不是批次运行，13.10）。
  某次运行的 attempt = 1 + 同一批次里在它之前开始、且结论不是 PASS 的批次运行数（没有 `run.finished` 的也算）。
  这是 R2 自己的口径（11.7 的批次历史：PASS 不递增，FIX 与中断都递增）。投影不得读取 R2 不写的字段。
- **用时。** 运行用时 = `run.finished.ts` − `run.started.ts`，没有 `run.finished` 为 `null`。13.1 的 `duration_ms` 是 worker 那一段的用时，要展示就另列，不得顶替运行用时。
- **花费。** 汇总范围内没有任何一次运行带花费数据时显示 `—`；部分有数据时显示已知之和并注明缺数据的运行数（13.3）。
- **空数据时的 `--json`。** 没有任何 journal 时，`status --json` 输出与有数据时同一结构（`current` / `queue` / `lastQueue`，取不到的为 `null`，`queue` 照常来自 backlog），
  `timeline --json` 输出 `[]`；不输出 `{"message": …}`（v04-b02 第 2 次的做法，当时的验收只查了是不是合法 JSON）。13.2 写的就是「`--json` 输出同一结构」。
- **夹具。** 投影的测试至少有一组数据来自 fake runner 跑出来的真实运行（`test/support/sandbox.ts` 的 `Sandbox`），并断言投影出的 attempt 等于当次 `task.md` frontmatter 里的 `attempt`。
  手写夹具里的事件字段只能用 3.6 与第 11~13 章写明的；现有夹具里 R2 不写的字段要删掉。

不在本批次：timeline 里队列的开始节点。它依赖 `queue.batch_started` 落在队列 journal（v04-b07），而且要等固定版本前移之后产生的 journal 才有。

### 13.14 队列里的中断续跑、验收失败全记、放行留痕（v04-b10）

来源同 13.12。三处都改 R2，要等固定版本前移才生效。

**中断自动续跑一次。** `--continue` 下，一次批次运行同时满足下面三条时，队列不停下，自动重跑同一批次一次：
- 走的是上报路径（没有可解析的 report）；
- worker 是被信号阶梯掐掉的：`run.finished.worker_stop_reason` 是 `idling` / `stalled` / `wallclock` 之一；
- 本次队列里这个批次还没有因中断续跑过。

做法照规则 1 的先例（12.3）：记 `batch.retried`（字段 batch_id / cause: `interrupted` / stop_reason），不计入 `fix_max`，不计入 `--max`，backlog 状态改回 `pending`，
`queue.batch_started.why` 为 `interrupt_retry`。重跑按 11.7 的中断语义走：attempt 递增，task 写「上一轮中断」，是否续接会话照 11.7 判定。第二次仍是这种中断 → 停，退出码 20。
不在此列、照旧直接停：worker 崩溃（`error`）、轮数用完（`turns_exhausted`）、reviewer 失败、R2 自己被杀。
中断续跑的计数只数本次队列（与 `fix_max` 相同）；规则 1 的重跑与它各自独立计一次，判断「规则 1 是否重跑过」时只认带 `rule: 1` 的 `batch.retried`。
理由：v04-b04 的会话是 soft 停的、可以续接，需要人做的决定只是「再跑一次」。上限一次，最坏多花一次运行的钱。

**验收失败不论裁决都记。** R2 实测未满足的每一条验收都记 `acceptance.failed`（字段不变）。此前只在规则 8 把 PASS 降为 FIX 时才记：
reviewer 自己判 FIX 时（v04-b02 第 1 次）journal 里没有任何一条说明是哪条验收失败，`why` 也就说不出来。规则 8 的判定不变。

**放行留痕。** PASS 之后放行判定通过时，在队列 journal 记 `queue.gate_passed`（字段 batch_id / batch_run_id）。此前放行成立时不留任何事件，只能从下一条 `queue.batch_started` 间接推断。

### 13.15 R2 的后台 git 读取不得抢索引锁（v04-b11）

13.11 记的零散失败（用例期望的退出码变成 20）查到了原因（2026-11-11，R1 的机器，当时负载较高）：
- 现象：全量 `npm test` 11 次里 6 次有 1~3 个用例失败，每次失败的用例不同，单独跑这些文件不复现。
- 给测试辅助类临时加诊断输出后抓到其中 4 次，全部是 fake worker 的 `git add` / `git commit` 报 `Unable to create '.git/index.lock': File exists`，worker 崩溃，运行走上报路径 BLOCK。
- 活性检测每 500 毫秒在 worker 的工作区里取一次产出指纹（11.5），执行 `git diff HEAD` 与 `git status`。这两条只读命令会顺手刷新索引，为此短暂占用 `index.lock`；worker 的提交撞上就失败。
- 设环境变量 `GIT_OPTIONAL_LOCKS=0`（让只读命令不占这把锁）后再跑 8 次，这类失败 0 次。「另一个 git 进程就是取指纹的那个」是由这组对照推断的，没有逐进程追踪。

这不只是测试的问题：真实运行里 R2 同样在 worker 的工作区里取指纹，worker 的 git 命令也可能撞上。真实 worker 遇到报错会重试，所以应表现为偶发的命令失败而不是崩溃；
真实运行的事件流里有没有出现过，R1 没有查过，已请操作员在第三次队列里查。
修订：R2 拉起的 git 子进程一律带 `GIT_OPTIONAL_LOCKS=0`，在 `src/git.ts` 的统一入口加。它只影响只读命令的可选索引刷新，`add` / `commit` 这些该占的锁照常占。

另记：场景 G 的两个用例在高负载下各失败过 1 次（断言 `worker.idling` 没有出现），设了上面的环境变量也出现过，与索引锁无关，原因没有查。先观察，不签批次。

