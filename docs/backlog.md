# Collie 批次队列

> 唯一可修改者：R1 方案设计 Agent（须用户批准）。其他角色只读。
> 优先级在方案确定阶段一次排定，批次随之固定，**不做滚动重新拆解**。

更新时间：2026-10-16
当前版本：v0.1
配套：[SPEC.md](./SPEC.md) 第 7 章里程碑、第 8 章验收场景

---

## 队列总览

| 优先级 | 批次 | 标题 | 依赖 | 状态 |
|---|---|---|---|---|
| 1 | v01-b01 | 工程骨架与基础设施 | — | passed |
| 2 | v01-b02 | 批次解析与 worker 角色 | v01-b01 | passed |
| 3 | v01-b03 | 审核角色与仲裁 | v01-b02 | running |

状态取值限 `pending` / `running` / `passed` / `blocked`（SPEC 3.2 枚举）。
本文件是批次的事实源，`task.md` 是其派生物；二者不一致时以本文件为准并重新签发 task。

---

## v01-b01 工程骨架与基础设施

优先级：1　依赖：无

条目：
1. 工程骨架：`package.json`、`tsconfig.json`（strict）、ESLint（含 `no-explicit-any`、
   `src/**` 上 `no-magic-numbers`）、Prettier、vitest 配置、
   `.gitignore`（含 `node_modules/`、`dist/`、`.collie/runs/`、`.collie/heartbeat`）、
   GitHub Actions CI（**监听 main**）。依赖见 SPEC 2.2 与 ADR-002
2. `src/config.ts` + `src/schema/index.ts`：解析并校验 `.collie/collie.toml`（由 R1 放置，只读），
   `SCHEMA_VERSION = 1`，全部 zod schema（strict）与导出类型
3. `src/journal.ts`：`events.ndjson` 的 append-only 追加与校验重放，
   支持 SPEC 3.6 的 v0.1 事件类型；坏行报错并指出行号，不静默跳过

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| schema 测试存在且通过 | `npm test -- schema` | exit 0 |
| journal 测试存在且通过 | `npm test -- journal` | exit 0 |
| config 测试存在且通过 | `npm test -- config` | exit 0 |
| CI 配置监听 main（结构检查） | `grep -qE 'branches:\s*\[\s*main\s*\]' .github/workflows/ci.yml` | exit 0 |

R4 读代码核验项（非命令判定）：测试内容是否覆盖 task.md 「测试内容要求」；
CI 是否实际触发且监听分支正确（GitHub API）。

额外禁止：
- 引入 SPEC 2.2 与 ADR-002 清单之外的依赖
- 在代码中裸写阈值数字
- 创建或修改 `.collie/collie.toml`

## v01-b02 批次解析与 worker 角色

优先级：2　依赖：v01-b01

条目：
1. `src/backlog.ts`：解析本文件为 `Batch[]`，校验验收标准均为可执行命令
   （不可机器判定则报错并拒绝执行）
2. `src/runner/index.ts` + `src/runner/fake.ts`：Agent 调用的统一接口与测试实现
3. `src/roles/worker.ts`：组装 `task.md`（frontmatter + 正文）、经 runner 拉起、
   读回 `report.md` 并用 zod 校验尾部 JSON 块

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| backlog 解析正确 | `npm test -- test/backlog.test.ts` | exit 0 |
| 拒绝不可判定验收 | `npm test -- test/backlog-reject.test.ts` | exit 0 |
| fake runner 闭环 | `npm test -- test/worker.test.ts` | exit 0 |
| task.md 格式正确 | `npm test -- test/task-envelope.test.ts` | exit 0 |
| roles 不直接依赖 SDK 或 fake | `test -d src/roles && ! grep -rE "from ['\"](@anthropic-ai\|\.\./runner/fake\|\./fake)" src/roles/` | exit 0 |

R4 读代码核验项（非命令判定）：测试内容是否覆盖 task.md「测试内容要求」；
`src/roles/` 是否经 ESLint `no-restricted-imports` 物理隔离 SDK 与 fake。

额外禁止：
- 在 `roles/` 中直接调用 Agent SDK（必须经 runner 接口）
- 实现任何 v0.2 及以后的失败恢复逻辑

## v01-b03 审核角色与仲裁

优先级：3　依赖：v01-b02

条目：
1. `src/verify.ts` + `src/git.ts` + `src/ci.ts`：实跑验收命令并结构化输出；
   git 封装（log/diff/ls-remote/status/commit）；CI 实际结论查询**并核对监听分支**
2. `src/roles/reviewer.ts`：从零组装审核 prompt（**代码保证不接收 report 正文参数**）、
   拉起、读回 `verdict.md` 并校验
3. `src/arbiter.ts` + `src/progress.ts` + `src/cli.ts`：
   SPEC 4.3 的八条仲裁规则；依据实测证据写 progress；
   `collie init` / `collie run` / `collie show` 三个命令与退出码

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范与类型 | `npm run lint && npm run typecheck` | exit 0 |
| 仲裁规则全覆盖 | `npm test -- test/arbiter.test.ts` | exit 0 |
| reviewer 不接收 report 正文 | `npm test -- test/reviewer-isolation.test.ts` | exit 0 |
| 场景 A 假 CI 全绿被拦 | `npm test -- test/scenario-a.test.ts` | exit 0 |
| 场景 B 假测试数被拦 | `npm test -- test/scenario-b.test.ts` | exit 0 |
| 场景 C 偷改 SPEC 被拦 | `npm test -- test/scenario-c.test.ts` | exit 0 |
| 退出码正确 | `npm test -- test/exit-codes.test.ts` | exit 0 |

额外禁止：
- 用约束解码强制 verdict 三值（必须由 arbiter 解析校验）
- 让 reviewer 具备写入能力（工具白名单不得含 Write/Edit）
