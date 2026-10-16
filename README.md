# Collie

> Agent 团队编排器。人吹哨，狗赶羊群，羊干活。

Collie 把「与好模型讨论方案 → 下发工作 Agent 实现 → 审核 Agent 给出下一步」
这个循环自动化，让人只保留头（需求阐述与方案讨论）与尾（裁决），
不再在多个 Agent 窗口之间搬运上下文。

状态：v0.1 规格已定稿，实现未开始。

## 核心设计

**写入永远单线程。** 代码只有一个写者，其他 Agent 只贡献判断、不贡献动作。

**不采信，只取证。** Agent 的任何自我陈述默认不可信，须经独立审核 Agent
实跑命令核对后才成为事实。

**角色即权限。** 五个角色各有手册、可读范围、可写范围与输出契约，
边界靠工具白名单与路径权限物理隔离，不靠提示词约束。

**审核者用干净上下文。** 审核 Agent 不读实现者的历史与推理，只看最终 diff，
需要什么自己去查。

## 五个角色

| 角色 | 职责 | 唯一特权 |
|---|---|---|
| R1 方案设计 | SPEC / 约束 / ADR / 批次队列 | 唯一可改 SPEC |
| R2 调度（Collie 本体） | 取批次、拉起、看活性、仲裁、写轨迹 | 确定性程序，非 LLM |
| R3 实现（worker） | 一个批次的 1~3 个条目 | 唯一可改代码 |
| R4 审核 | 独立取证，输出 PASS / FIX / BLOCK | 干净上下文 |
| R5 体检 | 跨批次架构漂移检查 | 读 SPEC 全文而非 diff |

## 文档

| 文件 | 内容 |
|---|---|
| [SPEC.md](./SPEC.md) | 唯一方案来源，v0.1 详细规格 |
| [ROADMAP.md](./ROADMAP.md) | 八个版本的功能边界与验证目标 |
| [ROLES.md](./ROLES.md) | 角色职责、权限矩阵、八个环节、失败矩阵 |
| [CONSTRAINTS.md](./CONSTRAINTS.md) | 25 条全局铁律 |
| [AGENT-worker.md](./AGENT-worker.md) | R3 工作手册 |
| [AGENT-reviewer.md](./AGENT-reviewer.md) | R4 工作手册 |
| [docs/backlog.md](./docs/backlog.md) | 批次队列（优先级已排定） |
| [docs/decisions/](./docs/decisions/) | 架构决策记录 |

## 技术栈

TypeScript + Node 22 LTS + ESM。选型理由见 [ADR-001](./docs/decisions/ADR-001-typescript.md)。

依赖只用 Claude Agent SDK、commander、zod、smol-toml、yaml、execa、vitest、tsx。
明确不引入编排框架、可观测框架与 ORM。

## v0.1 的唯一验证目标

审核 Agent 的独立取证能否拦住虚假汇报。三个场景必须全部被拦住：

1. 假 CI 全绿（CI 配置监听分支与实际分支不符）
2. 假测试数（声称全通过但实际有失败）
3. 偷改 SPEC（diff 中包含受保护文件）

## 永不做

并行写入、多项目共享状态、让 Agent 自判是否求助、自建编排框架、
工具级审批交给人、可观测框架。理由见 [ROADMAP.md](./ROADMAP.md) 第 10 节。
