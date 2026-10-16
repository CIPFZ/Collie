# Collie 角色与权限矩阵

> 本文件是 Collie 的角色契约。**角色即权限**：边界靠工具白名单与路径权限物理隔离，不靠提示词约束。
> 唯一可修改者：R1 方案设计 Agent（须用户批准）。

更新时间：2026-10-16

---

## 1. 四条总纲

1. **单一事实源，单一修改者。** `SPEC.md` 与 `CONSTRAINTS.md` 全局只有一份、永远最新，
   只有 R1 能改且须用户批准。其他角色只读。所有人都能改等于所有人都不认。
2. **代码只有一个写者。** R3 worker 独占代码写权限，其他角色一律不碰代码。
3. **角色即权限。** 每个角色有自己的 AGENT 手册、可读范围、可写范围、输出契约。
4. **优先级一次排定，批次随之固定。** 方案确定阶段排定优先级后批次队列即固定，不做滚动拆解。

## 2. 角色清单

### R1 方案设计 Agent

身份：与用户对话的方案设计者，好模型。
触发：项目启动时；BLOCK 升级后用户批准变更时；`collie plan`（v0.7 起）。

可读：全部。
可写：`SPEC.md`、`CONSTRAINTS.md`、`AGENT-*.md`、`docs/backlog.md`、`docs/decisions/ADR-*.md`、`ROADMAP.md`、`ROLES.md`。
禁写：任何代码、任何 `.collie/` 运行时文件、`docs/progress.md`。

输出契约：批次队列必须带优先级、依赖关系、每批次的**可机器判定**验收命令。
硬门：验收标准无法写成可机器判定的命令时，停下来与用户重新讨论，不得进入执行环节。

### R2 调度 Agent（Collie 本体）

身份：**确定性程序，不是 LLM。** 它做的全是确定性判断——取队首、拉起进程、看事件间隔、
比对 claim 与证据、计数、写轨迹、决定升级。放 LLM 在这个位置只会引入不可复现的行为。

可读：全部。
可写：`.collie/` 下全部、`docs/progress.md`、`docs/reports/`。
禁写：代码、`SPEC.md`、`CONSTRAINTS.md`、`docs/backlog.md`、ADR。

关键职责：
- 注入只有它知道的信息（上一轮中断位置、批次指针、resume 状态）
- claim 与实测证据的强制比对，不符则无视 verdict 值强制降级
- 依据实测证据写 `progress.md`（而非采信 worker 的叙述）
- 自身必须无状态可重启，崩溃恢复 = 重放 `events.ndjson`

### R3 实现 Agent（worker）

身份：唯一的代码写者，每轮全新上下文。

可读：`SPEC.md`、`CONSTRAINTS.md`、`AGENT-worker.md`、本批次 `task.md`、全部代码、`docs/progress.md`。
可写：代码、测试、代码内注释。
禁写：`SPEC.md`、`CONSTRAINTS.md`、ADR、`docs/backlog.md`、`docs/progress.md`、任何 `.collie/` 文件。

为什么 worker 不能写 progress：worker 每轮全新上下文，它写的是「声称」而非事实。
若它把半成品写成已完成，下一轮 worker 会把它当事实读入，错误被固化。

输出契约：`report.md` = Markdown 四段正文（做了什么 / 测试结果 / 偏离或疑问 / 下一步建议）
+ 尾部一个围栏 JSON 块（`head_sha`、`claims`、`open_questions`）。
先自由推理再格式化，避免结构约束损害推理质量。

### R4 审核 Agent

身份：独立审核者，**干净上下文**。

可读：本批次 diff、`SPEC.md` 相关章节、`task.md` 的验收项、自己主动跑的命令输出。
**明确不读**：worker 的对话历史、worker 的推理过程、`report.md` 的正文叙述。
可写：`verdict.md`（经 R2 落盘）。
禁写：一切其他。

工具白名单：仅 `Read` / `Grep` / `Glob` + 受限 `Bash`。它在物理上无法改代码。

干净上下文是硬要求而非风格偏好：写码 Agent 跑几小时后注意力质量随长度下降（context rot），
审核者从零开始只看最终 diff，反而能更深入推理。这是其捕获率的来源。

取证要求（必须跑真命令，不得采信汇报）：
- 实跑 `task.md` 列出的全部验收命令，记录真实输出
- `git ls-remote` 确认推送事实
- 读 CI 实际结论与运行 URL，确认监听分支与实际分支一致
- 依赖清单 diff、`SPEC.md` 的 diff 行数

输出：`PASS` / `FIX` / `BLOCK` 三值 + 证据明细 + 缺口清单。
三值不用约束解码强制，由 R2 解析尾部 JSON 块并校验。

### R5 体检 Agent

身份：架构漂移检查者，每 `audit_interval` 个批次或里程碑结束时触发。

可读：`SPEC.md` 全文、当前代码结构、`docs/progress.md`、历史 verdict。
**明确不读**：单批次 diff（那是 R4 的活）。
可写：`docs/reports/audit-*.md`。
禁写：一切其他。

存在理由（R4 看 diff 看不见的三类问题）：
1. 该写的测试没写 —— diff 里不存在的东西看不见
2. 跨批次架构漂移 —— 每批都合理，十批后整体走形
3. SPEC 本身已不适用

发现 SPEC 需改时只能提出，由 R1 起草 ADR、用户批准。

## 3. 权限矩阵

| 路径 | R1 设计 | R2 调度 | R3 worker | R4 审核 | R5 体检 |
|---|---|---|---|---|---|
| `SPEC.md` | 写 | 读 | 读 | 读 | 读 |
| `CONSTRAINTS.md` | 写 | 读 | 读 | 读 | 读 |
| `AGENT-*.md` | 写 | 读 | 读自己的 | 读自己的 | 读自己的 |
| `ROADMAP.md` / `ROLES.md` | 写 | 读 | 读 | 读 | 读 |
| `docs/backlog.md` | 写 | 读 | 读 | 读 | 读 |
| `docs/decisions/ADR-*.md` | 写 | 读 | 读 | 读 | 读 |
| `docs/progress.md` | — | 写 | 读 | 读 | 读 |
| `docs/reports/` | 读 | 写 | — | — | 写 audit |
| `.collie/batches/*/task.md` | — | 写 | 读 | 读 | — |
| `.collie/batches/*/report.md` | 读 | 读 | 写 | **不读** | — |
| `.collie/batches/*/verdict.md` | 读 | 读 | 读 | 写 | 读 |
| `.collie/runs/` | — | 写 | — | — | 读 |
| 代码与测试 | 读 | 读 | **写** | 读 | 读 |

## 4. 八个环节

每环节四项：触发 / 输入 / 输出 / 失败处置。

**E1 方案确定**（R1 + 用户）
触发：用户提出想法。输入：需求与讨论。输出：SPEC、CONSTRAINTS、带优先级的批次队列、资产。
失败处置：验收标准无法机器判定 → 停下重新讨论，不准进入 E2。

**E2 取批次**（R2）
触发：上一批 PASS，或人裁决后放行。输入：`docs/backlog.md`。输出：选定批次 + `task.md`。
失败处置：队首依赖未满足 → 跳下一个可执行批次并记事件；全部阻塞 → 升级给人。

**E3 拉起 worker**（R2）
输入：`task.md`（Markdown 正文 + YAML frontmatter 放 `run_id` / `batch_id` / `base_sha` / `interrupted_at`）。
输出：worker 进程 + 事件流落盘。
失败处置：拉起失败按崩溃处理。

**E4 worker 执行**（R3）
输入：只读集。输出：代码提交 + `report.md`。
失败处置：见第 5 节失败矩阵。

**E5 审核取证**（R4）
输入：指针 `base_sha..head_sha`。输出：`verdict.md`。
失败处置：claim 与实测不符 → R2 强制降级，不理 verdict 值。

**E6 裁决分流**（R2）
`PASS` → E2；`FIX` → 回 E4 同批次计数 +1，达上限强制 BLOCK；`BLOCK` → 升级给人。
升级时必须携带：缺口清单、实测证据、R4 理由、以及「若要改 SPEC 需要 R1 做什么」的预判。

**E7 体检**（R5）
触发：每 N 批次或里程碑结束。输出：体检报告 + 可能的 ADR 草案（草案只能 R1 起草、人批准）。

**E8 完成判定**（R2）
默认 `consecutive-dry(K)`，在产物里测不在叙述里测。备选三个留接口，用真实数据选。

## 5. 失败场景矩阵

| 场景 | 检测方式 | 处置 |
|---|---|---|
| 进程崩溃 | 非零退出 | resume 上限内重试；超限则新建 + 注入中断标记 |
| 静默卡死 | 事件流间隔超 `stall_secs` | 信号阶梯掐掉，按崩溃处理 |
| 空转 | 有事件但无提交无文件变更超 `progress_secs` | 掐掉，按 FIX 处理 |
| 跑完无产出 | 退出 0 但零提交 | 不是故障，按 FIX 处理 |
| claim 与实测不符 | R4 取证比对 | FIX；涉及 SPEC 被改或依赖被加则直接 BLOCK |
| 返工死循环 | 同批次 FIX 计数达 `fix_max` | 强制 BLOCK 升级给人 |
| 工作区脏 | 退出时检查 | 自动 `wip(collie):` 提交 + 下轮 task 标注中断位置 |

信号阶梯必须 `SIGINT` 先行：直接 `SIGTERM` 会让当前轮次不留结果、session 记录残缺，
导致 `--resume` 恢复不出东西。阶梯为 SIGINT → 宽限 → SIGTERM → 宽限 → SIGKILL，每级记事件。

## 6. 文件布局

```
<project>/
  SPEC.md                      R1 写 · 全员只读 · 唯一事实源
  CONSTRAINTS.md               R1 写 · 全局铁律
  ROADMAP.md                   R1 写 · 版本路线图
  ROLES.md                     R1 写 · 本文件
  AGENT-worker.md              R1 写 · R3 工作手册
  AGENT-reviewer.md            R1 写 · R4 工作手册
  AGENT-auditor.md             R1 写 · R5 工作手册（v0.6）
  docs/backlog.md              R1 写 · 批次队列（优先级已排定）
  docs/decisions/ADR-*.md      R1 写 · 用户批准
  docs/progress.md             R2 写 · 依据实测证据 · 全员只读
  docs/reports/                R2 与 R5 写 · 验收与体检报告
  .collie/
    collie.toml                配置 · 所有阈值在此 · 禁止裸写
    batches/<id>/task.md       R2 写 · R3 读
    batches/<id>/report.md     R3 写 · R2 读 · R4 不读
    batches/<id>/verdict.md    R4 写 · R2 读
    runs/<run>/events.ndjson   R2 写 · 轨迹 · 提交
    runs/<run>/stream.ndjson   R2 写 · 易失遥测 · gitignore
    heartbeat                  R2 写 · gitignore
  <代码与测试>                  R3 写 · 唯一写者
```

提交职责划分：代码提交只由 R3 做；`.collie/batches/` 下信封与 `docs/progress.md` 由 R2 提交
（它们是审计证据）；`runs/` 下流日志与 heartbeat 全部 gitignore。
两者不冲突，因为 R2 只在 worker 进程结束后才写提交。

全部直接提交 main，不开分支、不开 PR。推送后必须确认 CI 实际触发并通过。

## 7. 格式约定

按场景选择，不统一：

| 用途 | 格式 | 理由 |
|---|---|---|
| `task.md`（给模型读的指令） | Markdown + YAML frontmatter | Markdown 是指令类输入最优；frontmatter 放机器字段 |
| `report.md` / `verdict.md` | Markdown 正文 + 尾部围栏 JSON | 先自由推理再格式化，避免结构约束损害推理质量 |
| `events.ndjson` | JSONL | 无模型参与，程序写程序读，生态与工具链优势 |
| `collie.toml` | TOML | 人工编辑的配置，注释友好 |

原则：**只在没有模型参与生成的边界上用纯 JSON；有模型生成的地方，让它先说人话，最后再吐一小块结构。**
