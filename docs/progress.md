# Collie 开发进度

> 本文件由调度器（R2）维护，依据审核 Agent 的实测证据写入。worker 只读（铁律 3）。
> Collie 自身实现前，由人工占位 R2 填写。

更新时间：2026-10-16
当前版本：v0.1 取证
当前批次：v01-b02（已签发，待实现）
CI 实际状态：绿。v01-b01 四次运行由项目所有者目视确认均为 `main / success`

## v0.1 批次（对应 docs/backlog.md）

- [x] v01-b01 工程骨架与基础设施　← PASS，verdict 见 `.collie/batches/v01-b01/verdict.md`
- [ ] v01-b02 批次解析与 worker 角色　← 已签发 task.md（base_sha 4a690f5）
- [ ] v01-b03 审核角色与仲裁

## 已验证完成（经审核 Agent 实测取证）

v01-b01，提交 `134ea31` `3f4992d` `e5c7d3f` `e99fde3`（HEAD `e99fde3`）：
- 7 条验收命令全部 exit 0；`npm test` 111 passed / 0 failed；在干净 clone 上 `npm ci` 复现一致
- 受保护文件零触碰；改动范围 17 文件全在工程配置 / `src/` / `test/`
- 测试覆盖超出 task 要求（journal 每种坏行独立用例；config 多错误聚合与 TOML 行号）
- 铁律 11 由 `no-magic-numbers` + `no-restricted-syntax` 双规则执行，变异测试证实
- 运行时依赖许可证干净；声称与实测零差异

## 进行中

v01-b02。task 信封见 `.collie/batches/v01-b02/task.md`。

## 已知问题

- R4 用未鉴权 GitHub API 查 CI 在共享出口 IP 下不可用（配额 0/60）。需配只读 token 或改为目视确认
- 远端访问协议因环境而异：R1/R2 环境 SSH 可用、HTTPS 不可用；worker 环境相反
- Agent 的写文件工具曾把 U+2028/U+2029 原样写入源码，已自查清除。R4 后续批次应扫描此项

## 开放问题（需项目所有者决策）

无。

## 本轮裁决记录（v01-b01 汇报，2026-10-16）

- 裁决 2 追认：`no-restricted-syntax` 补位成立，ADR-002 §4 已改正其错误前提
- 裁决 3 裁定：`events.ndjson` 不提交，ROLES 第 6 节自相矛盾已消除；
  新增信封交接机制——worker 以 `report(collie): <batch_id>` 单独提交 report.md，
  R4 同理提交 verdict.md（铁律 19 唯一例外）
- 采纳验收命令反馈：测试过滤改为完整路径；grep 限 POSIX ERE；写入 SPEC 3.2
- 流程缺口：同机假设在 worker 与 R2 分离时不成立，已通过信封交接解决

## ADR 列表

- ADR-001 TypeScript 选型（已批准）
- ADR-002 开发工具链依赖批准与 SPEC 2.2 勘误（已批准，§4 于本轮修订）
- ADR-003 许可证白名单作用范围（已批准，方案 A：白名单只管运行时树）

## 下次会话从这里继续

v01-b02 已签发。worker 开工前先 `git pull` 到 task 提交之后，并先推送其本地的 v01-b01 report.md。
