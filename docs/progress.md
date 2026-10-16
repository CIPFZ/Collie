# Collie 开发进度

> 本文件由调度器（R2）维护，依据审核 Agent 的实测证据写入。worker 只读（铁律 3）。
> Collie 自身实现前，由人工占位 R2 填写。

更新时间：2026-10-16
当前版本：v0.1 取证
当前批次：v01-b01（已签发，待实现）
CI 实际状态：未触发（工程骨架尚未建立，CI 配置属 v01-b01 条目 1）

## v0.1 批次（对应 docs/backlog.md）

- [ ] v01-b01 工程骨架与基础设施　← 已签发 task.md
- [ ] v01-b02 批次解析与 worker 角色
- [ ] v01-b03 审核角色与仲裁

## 已验证完成（经审核 Agent 实测取证）

无。当前仅有文档，无代码。

## 进行中

v01-b01。task 信封见 `.collie/batches/v01-b01/task.md`，
kickoff prompt 见 `AGENT_KICKOFF.md`。

## 已知问题

- 仓库 HTTPS 凭据不可用，远端已切换为 SSH（`git@github.com:CIPFZ/Collie.git`）
- 本地默认分支初始为 `master`，已改名 `main` 以与 SPEC 的 CI 配置一致

## 开放问题（需项目所有者决策）

见 SPEC 第 10 章 Q1~Q4，均不阻塞 v01-b01。

## ADR 列表

- ADR-001 TypeScript 选型（已批准，2026-10-16）

## 下次会话从这里继续

从 v01-b01 开始。三个条目：工程骨架、配置与 schema、事件日志。
本轮附带验证目标：我们写的验收标准是否真的可机器判定。
