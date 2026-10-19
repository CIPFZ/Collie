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

- 远端访问协议因环境而异：R1/R2 所在环境 SSH 可用、HTTPS 不可用；
  实现 Agent 环境相反。两者均指向 `CIPFZ/Collie`，不影响工作
- 本地默认分支初始为 `master`，已改名 `main` 以与 SPEC 的 CI 配置一致
- 环境未安装 `gh`，CI 结论改用 GitHub 公开 REST API 查询（未鉴权限速 60 次/小时）

## 本轮决策记录（v01-b01 执行计划答复，2026-10-16）

- Q1：`.collie/collie.toml` 由 R1 放置，worker 只读。ROLES / AGENT-worker / SPEC 2.3 已同步
- Q2：开发依赖经 ADR-002 批准；`smol-toml` 许可证勘误为 BSD-3-Clause；TS 锁 `~6.0.x`
- Q3 全部采纳：批次条目上限为 schema 内具名常量；`replay` 遇不存在文件返回 `[]`；
  骨架提交 scope 用 `ci`
- 验收标准修订：删除恒通过的「无裸写阈值」grep，改由 lint `no-magic-numbers` 覆盖；
  `npm test -- xxx` 与 CI grep 的能力边界已如实写入 task 与 SPEC 3.2
- `Event` 扩展字段收紧为 JSON 值（SPEC 3.6）；`run_id` 加路径安全正则
- backlog.md 与 task.md 对齐，状态改用枚举值 `running`
- `base_sha` 签发约定写入 SPEC 3.3

## 开放问题（需项目所有者决策）

见 SPEC 第 10 章 Q1~Q4，均不阻塞 v01-b01。

## ADR 列表

- ADR-001 TypeScript 选型（已批准，2026-10-16）

## 下次会话从这里继续

从 v01-b01 开始。三个条目：工程骨架、配置与 schema、事件日志。
本轮附带验证目标：我们写的验收标准是否真的可机器判定。
