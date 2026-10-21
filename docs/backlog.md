# Collie 批次队列

> 唯一可修改者：R1 方案设计 Agent（须用户批准）。其他角色只读。
> 优先级在方案确定阶段一次排定，批次随之固定，**不做滚动重新拆解**。

更新时间：2026-10-21
当前版本：v0.2
配套：[SPEC.md](./SPEC.md) 第 7 章里程碑、第 8 章验收场景

---

## 队列总览

| 优先级 | 批次 | 标题 | 依赖 | 状态 |
|---|---|---|---|---|
| 1 | v01-b01 | 工程骨架与基础设施 | — | passed |
| 2 | v01-b02 | 批次解析与 worker 角色 | v01-b01 | passed |
| 3 | v01-b03 | 取证工具与审核角色 | v01-b02 | passed |
| 4 | v01-b04 | 仲裁、CLI 与三场景验证 | v01-b03 | passed |
| 5 | v01-b05 | 真实 runner | v01-b04 | passed |
| 6 | v01-b05-smoke | 烟雾批次：README 改一行 | v01-b05 | passed |
| 7 | v02-b01 | 真实运行暴露的两处修补 | v01-b05 | blocked |
| 8 | v02-b02 | 落盘、心跳与救援 | v01-b05 | passed |
| 9 | v02-b03 | 活性检测与信号阶梯 | v02-b02 | passed |
| 10 | v02-b04 | b02/b03 遗留修补 | v02-b03 | passed |
| 11 | v02-b04-tests | 测试去真实定时器 | v02-b04 | pending |
| 12 | v02-b05 | 中断标记与 resume | v02-b04-tests | pending |

状态取值限 `pending` / `running` / `passed` / `blocked`（SPEC 3.2 枚举）。
本文件是批次的事实源，`task.md` 是其派生物；二者不一致时以本文件为准并重新签发 task。

---

## v01-b01 工程骨架与基础设施

优先级：1　依赖：无

条目：
1. 工程骨架：`package.json`、`tsconfig.json`（strict）、ESLint（含 `no-explicit-any`、
   `src/**` 上 `no-magic-numbers`）、Prettier、vitest 配置、
   `.gitignore`（含 `node_modules/`、`dist/`、`.collie/runs/`、`.collie/heartbeat.json`）、
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

## v01-b03 取证工具与审核角色

优先级：3　依赖：v01-b02

条目：
1. 两处小改：`claims.ci_passed` 改为可选字段默认 `false`（不升版本、不写迁移）；
   `backlog.test.ts` 的「恰好三个批次」断言改为只校验 v01-b01/b02 的固定字段；
   `RunOptions` 加可选 `signal?: AbortSignal`
2. `src/verify.ts` + `src/git.ts` + `src/ci.ts`：实跑 `parseBacklog` 解析后的验收命令并结构化输出
   （SPEC 3.2「唯一执行形式」）；git 封装（log / diff --stat / ls-remote / status / commit）；
   CI 实际结论查询**并核对监听分支**，支持 `GITHUB_TOKEN` 鉴权，无 token 时限流须显式报错而非静默
3. `src/roles/reviewer.ts`：从零组装审核 prompt（**函数签名不含 report 正文参数**，
   只接收 `base_sha` / `head_sha` / task 验收项 / SPEC 路径）、经 runner 拉起（`allowedTools`
   取 `cfg.agent.reviewer`，不含 Write/Edit）、读回 `verdict.md` 用 `VerdictSchema` 校验
   （schema 按 SPEC 3.5 新增，复用 `extractLastJsonFence`）

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 验收命令实跑与结构化 | `npm test -- test/verify.test.ts` | exit 0 |
| git 封装 | `npm test -- test/git.test.ts` | exit 0 |
| CI 查询与分支核对 | `npm test -- test/ci.test.ts` | exit 0 |
| reviewer 不接收 report 正文 | `npm test -- test/reviewer-isolation.test.ts` | exit 0 |

R4 读代码核验项：v01-b01 与 v01-b02 的真实 report（无 `ci_passed`）被 `readReport` 接受；
`reviewer.ts` 的类型签名在编译期就排除 report 正文；`ci.ts` 对限流的处理是报错而非返回 null。

额外禁止：
- 让 reviewer 具备写入能力（工具白名单不得含 Write/Edit）
- 实现 `arbiter.ts`、`progress.ts`、`cli.ts`、`runner/claude.ts`（属 b04）
- `ci.ts` 在测试中访问网络（用注入的 fetch 替身）

## v01-b04 仲裁、CLI 与三场景验证

优先级：4　依赖：v01-b03

条目：
1. `src/arbiter.ts`：SPEC 4.3 的八条仲裁规则，按顺序命中即停，输出最终 verdict 与 `claim_mismatches`；
   `VerdictSchema` 放宽为 SPEC 3.5 新约定（`ci_branch_matched` 可 null、`conditions` 可选）；
   「已推送」改为 fetch 后 `merge-base --is-ancestor head_sha origin/main`；
   `RunResult` 加 `finalText`，reviewer 的 verdict 由 R2 从 `finalText` 写入，
   reviewer 在 `git worktree add <tmp> head_sha` 中运行
2. `src/progress.ts` + `src/cli.ts`：依据 arbiter 输出与 evidence 写 `docs/progress.md`；
   `collie init` / `collie run <batch>` / `collie show <batch>` 三个命令；
   退出码 0 / 10 / 20 / 1（SPEC 5）；`run` 以 `AbortSignal.timeout(wallclock_secs)` 包裹 worker（SPEC 3.3）；
   journal 事件按 SPEC 3.6 写入
3. `test/scenario-{a,b,c}.test.ts`：用 fake runner 构造 SPEC 8 的三个场景，
   断言最终 verdict、`claim.mismatch` 事件与 `collie run` 退出码

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 仲裁规则全覆盖 | `npm test -- test/arbiter.test.ts` | exit 0 |
| 场景 A 假 CI 全绿被拦 | `npm test -- test/scenario-a.test.ts` | exit 0 |
| 场景 B 假测试数被拦 | `npm test -- test/scenario-b.test.ts` | exit 0 |
| 场景 C 偷改 SPEC 被拦 | `npm test -- test/scenario-c.test.ts` | exit 0 |
| 退出码正确 | `npm test -- test/exit-codes.test.ts` | exit 0 |

R4 读代码核验项：八条规则各有独立用例且顺序敏感；三个场景的 fake 剧本确实构造了「声称 vs 实测不符」而非仅构造失败。

额外禁止：
- 用约束解码强制 verdict 三值（必须由 arbiter 解析校验）
- 实现 `runner/claude.ts`（真实 runner 为 v0.1 收尾单独批次，视 b04 结果决定）

## v01-b05 真实 runner

优先级：5　依赖：v01-b04

条目：
1. `src/runner/claude.ts`：基于 `@anthropic-ai/claude-agent-sdk` 实现 `AgentRunner`；
   构造时接收 `CollieConfig`，按 role 取 model / allowedTools / maxTurns；
   透传 `signal`；收集最终回复为 `finalText`；NDJSON 事件经 `onEvent` 回调；
   SDK 特有概念不泄漏到 `runner/` 之外（ROADMAP 0.4）
2. `collie run` 接入真实 runner：默认用 `claude.ts`，`--runner fake` 保留测试路径；
   `collie init` 生成的配置模板可直接用
   2a. 配置增加 `permission_mode`（SPEC 3.1）：`AgentConfigSchema` 加可选字段，
   `ClaudeRunner` 从配置读取；`.collie/collie.toml` 两个角色各加一行 `permission_mode = "bypassPermissions"`，
   **此两行授权 worker 与 schema 改动在同一提交内修改**（铁律 17：每个提交独立可构建）；
   `collie init` 模板同步。
   2b. 仲裁规则 3 的认可依赖清单恢复 `@anthropic-ai/claude-agent-sdk`（ADR-004）
   2d. `buildTask` 写入 `issued_by: collie`（SPEC 3.3）；`worker.finished` 事件携带 `final_text`
   （`RunResult.finalText` 截断 2000 字，SPEC 3.6）；`collie show` 打印它
   2e. 仲裁规则 8（SPEC 4.3）：任一验收命令实测未满足期望，PASS 降 FIX 并写 `acceptance.failed` 事件；
   加一个「诚实 worker、验收实测失败、reviewer 判 PASS」的场景测试 `test/scenario-d.test.ts`，
   断言最终 FIX、退出码 10；原三场景不受影响
   2c. R2 取证前先等 CI：`ci.ts` 对 `head_sha` 轮询直到结论不是 pending，上限 `limits.ci_wait_secs`、间隔 `limits.ci_poll_secs`
   （SPEC 3.1，默认 1800 / 30），超时记 `unknown` 并写 `ci.wait_timeout` 事件（SPEC 3.6，字段 head_sha / waited_secs / last_state）；
   `collie.toml` 加这两行授权与 schema 改动同一提交；测试用注入的 fetch 替身模拟「先 pending 后 success」
3. 在本仓库用真实 runner 跑一次 `collie run v01-b05-smoke`（一个只改 README 一行的烟雾批次），
   把完整 task / report / verdict / progress 落盘作为第一个真实样本

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| SDK 概念不泄漏 | `! grep -rlE "@anthropic-ai" src --include='*.ts' \| grep -v '^src/runner/'` | exit 0 |
| 平台树不被 Collie 调用 | `! grep -rlE "@opentelemetry\|fast-sha256" src --include='*.ts'` | exit 0 |
| claude runner 单元测试（SDK 用替身） | `npm test -- test/runner-claude.test.ts` | exit 0 |
| 烟雾批次样本存在 | `test -f .collie/batches/v01-b05-smoke/verdict.md` | exit 0 |
| 场景 D 诚实但验收失败被降级 | `npm test -- test/scenario-d.test.ts` | exit 0 |

额外禁止：
- 测试中调用真实 SDK 或联网
- 在 `runner/` 之外 import SDK

## v01-b05-smoke 烟雾批次：README 改一行

优先级：6　依赖：v01-b05

条目：
1. 在 `README.md` 末尾追加一行：`Collie 用 Collie 跑过的第一个批次：v01-b05-smoke`

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 全部测试通过 | `npm test` | exit 0 |
| README 已追加该行 | `grep -q "第一个批次：v01-b05-smoke" README.md` | exit 0 |
| 只改了 README | `test "$(git diff --name-only HEAD~1 HEAD)" = "README.md"` | exit 0 |

额外禁止：
- 改动 README 以外的任何文件

结论（2026-10-20）：交付物在第 3 次运行已落地，第 4 次运行判 FIX 是因验收第 3 条基于「最近一次提交」，
不幂等。教训：验收命令只断言仓库状态，不断言 diff。本批次判 passed，不再运行。

## v02-b01 真实运行暴露的两处修补

优先级：7　依赖：v01-b05

第一个由 `collie run` 签发并执行的批次。

条目：
1. `ci.ts`：`head_sha` 无自身运行时，采信满足 SPEC 4.2「CI 运行的归属」条件的后代提交运行；
   不满足条件的后代不采信；测试覆盖三种情况（自身运行 / 合规后代 / 改了代码的后代）
2. `progress.ts`：Collie 标记段按运行追加一行（SPEC 2.3），不覆盖；
   回填 v01-b05-smoke 的 4 次运行各一行，数据取自 git 历史与 journal

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| CI 归属三种情况 | `npm test -- test/ci.test.ts` | exit 0 |
| progress 含 4 次烟雾运行 | `test "$(grep -c 'v01-b05-smoke' docs/progress.md)" -ge 4` | exit 0 |

额外禁止：
- 改动 SPEC / CONSTRAINTS / ROLES / backlog

结论（2026-10-20，第一次自举运行）：BLOCK，规则 2，判定正确。条目 2 把 `docs/progress.md` 的回填派给了 worker，
而该文件是受保护路径——是 R1 签发错误，不是 worker 或 Collie 的问题。
代码部分（`9962761` 的 ci.ts / progress.ts 改动）已在 main 且验收 5 条全过，予以采用；
progress.md 的回填内容有误，已由 R2 占位者更正。本批次不重跑。
教训：task 条目不得要求 worker 写任何第 2 节清单内的文件；R1 签发前对照清单自查。

## v02-b02 落盘、心跳与救援

优先级：8　依赖：v01-b05

v0.2 第一批。规格见 SPEC 第 11 章 11.1~11.4、11.8。

条目：
1. `src/runner/index.ts` 追加 `resumeSessionId` / `onStarted` / `RunHandle`（11.2）；
   `fake.ts` 实现三级 `stop`，可脚本化「不响应 soft」；`claude.ts` 实现 `RunHandle`
   （soft / hard / kill 的 SDK 映射留在 runner 内，SDK 无 pid 时 `pid` 省略）。
   按 SPEC 11.2 的约束：soft 用 SDK 的轮次级 `interrupt()`，不得与 hard 同为 abort；
   `test/runner-claude.test.ts` 须断言注入的 `query()` 收到的选项中，SDK 的 `resume` 字段等于 `resumeSessionId`
2. `stream.ndjson` 落盘（11.3）；`heartbeat.json` 写入、更新、清理、启动时孤儿检测与并行拒绝（11.3）；
   新增事件 `run.orphaned` / `worker.rescued`（11.8）。
   修正 v01-b01 留下的扩展名错误：`.gitignore` 与 `src/cli.ts` 的 `GITIGNORE_ENTRIES`
   把 `.collie/heartbeat` 改为 `.collie/heartbeat.json`，否则救援提交会把心跳文件带进仓库
3. 脏工作区救援（11.4）：worker 退出后由 R2 执行 wip 提交并记事件；救援提交不推送。
   场景 E 前半段 `test/scenario-e.test.ts`：断言 kill 后救援提交与事件存在
   （`attempt=2` / `interrupted_at` 的断言留给 v02-b05）

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 场景 E 前半段 | `npm test -- test/scenario-e.test.ts` | exit 0 |
| 心跳与孤儿检测 | `npm test -- test/heartbeat.test.ts` | exit 0 |
| 心跳文件被忽略 | `git check-ignore -q .collie/heartbeat.json` | exit 0 |
| resume 字段映射有断言 | `grep -qE "resume" test/runner-claude.test.ts` | exit 0 |
| SDK 概念不泄漏 | `! grep -rlE "@anthropic-ai" src --include='*.ts' \| grep -v '^src/runner/'` | exit 0 |

额外禁止：
- 改动任何受保护路径（含 `.collie/collie.toml`）；本批次不新增配置字段
- 测试联网或调用真实 SDK

记录：第 1 次运行 r-20261020-120837 BLOCK，worker 120 轮用满、未写 report，R2 未取证。
worker 的 3 个提交存档于 tag `v02-b02-attempt1`，未审核不采用，main 重置后重跑；
worker `max_turns` 上调为 200（SPEC 3.1）。
第 2 次运行 r-20261020-124813 PASS（`00cd501`），8/8 验收实跑通过，R1 复核通过。
已知缺口：soft 未按条目 1 用 `interrupt()`，reviewer 只核了「soft≠hard」字面即放行；
PASS 维持（规则链无误），缺口转入 v02-b03 条目 2 并加两条验收。

## v02-b03 活性检测与信号阶梯

优先级：9　依赖：v02-b02

规格见 SPEC 11.1、11.5、11.6、11.8。

条目：
1. 活性检测（11.5）：启用 `stall_secs` / `progress_secs`，卡死与空转两条计时，产出指纹按事件采样；
   新增事件 `worker.stalled` / `worker.idling`
2. 信号阶梯（11.6）：`limits.grace_secs` 加为可选字段默认 20；soft → grace → hard → grace → kill，
   每级记 `worker.signaled`；`wallclock_secs` 超时改走阶梯（reason=wallclock），
   原 `worker.crashed` 路径仅保留给 runner 自身异常；任何结束方式（含 crashed / escalated）
   都追加一条 progress 运行记录（11.7 第二句）。
   **soft 改用 SDK 的 `Query.interrupt()`**（v02-b02 用的是「等下一条消息再 break」，worker 卡死时不起作用）：
   `claude.ts` 的 `stop('soft')` 必须调用注入 `query()` 返回对象上的 `interrupt()`，
   `test/runner-claude.test.ts` 断言该调用发生且 controller 未 abort
3. 场景 G 及其「不响应 soft」变体：`test/scenario-g.test.ts`

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 场景 G 两个变体 | `npm test -- test/scenario-g.test.ts` | exit 0 |
| 阶梯单元测试 | `npm test -- test/ladder.test.ts` | exit 0 |
| v0.1 三场景与场景 D 不受影响 | `npm test -- test/scenario-a.test.ts test/scenario-b.test.ts test/scenario-d.test.ts test/scenario-c.test.ts` | exit 0 |
| soft 走 interrupt() | `grep -qE "interrupt\(\)" src/runner/claude.ts && grep -qE "interrupt" test/runner-claude.test.ts` | exit 0 |
| soft 不再靠 break 等消息 | `! grep -qE "softStopRequested" src/runner/claude.ts` | exit 0 |

额外禁止：
- 改动任何受保护路径；`grace_secs` 不写入 toml，由 R1 事后补
- 阶梯计时用注入的时钟，测试不得真实等待超过 2 秒

## v02-b04 b02/b03 遗留修补

优先级：10　依赖：v02-b03

两次真实运行暴露、验收命令没抓住的三处。规格见 SPEC 11.2、11.3、11.5。

条目：
1. 心跳覆盖整个 run（11.3）：`run.finished` 之后才删除；加 `phase` 与 `worker_pid`；
   孤儿检测同时看两个 pid。`test/heartbeat.test.ts` 补「reviewer 阶段并行启动被拒绝」用例
2. `claude.ts` 的 `stop('soft')` 必调并 `await` `interrupt()`，缺失即抛错（11.2）；
   `run.finished` 与 progress 运行记录带 worker 的 `exit_code` / `stop_reason`（11.7）
3. `LivenessMonitor` 注入 `now()` / `setTimer()`（11.5）；`test/scenario-g.test.ts` 与 `test/ladder.test.ts`
   改用假时钟，删除所有真实耗时断言

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 全量连跑 3 次稳定 | `npm test && npm test && npm test` | exit 0 |
| 场景 G 不再断言真实耗时 | `! grep -qE "toBeLessThan\(2000\)\|Date.now" test/scenario-g.test.ts` | exit 0 |
| interrupt 不再可选 | `! grep -qE "interrupt\?\." src/runner/claude.ts` | exit 0 |
| 心跳并行拒绝覆盖 reviewer 阶段 | `grep -qE "reviewer" test/heartbeat.test.ts` | exit 0 |

额外禁止：
- 改动任何受保护路径
- 实现任何 resume / 中断标记注入（那是 v02-b05）

记录：第 1 次运行 r-20261021-025435 BLOCK（上报：无 report）。worker 推送 3 个提交后 90.5 秒无事件，
被 b03 的卡死检测误判（实为正在写 report），soft 停止后退出。这 3 个提交未经审核已在 origin：
存档于 tag `v02-b04-attempt1`，main 重置到 `35ed1cd` 强推一次，第 2 次运行从头做；
`stall_secs` 上调为 300（SPEC 3.1、11.5）。第 2 次运行的 task 正文可提示 worker 存档 tag 的位置。

记录：v02-b03 第 1 次运行 r-20261020-145024 PASS（`3da03b9`），8/8 验收在 R2 处通过；
R1 复核时 `npm test` 在全新 clone 上 2 个失败（场景 G 真实耗时 2.8~3.1 秒 > 2 秒），单跑 3 次全过，
属时序脆弱。PASS 维持（R2 取证当时属实），缺口全部进本批次。

记录：第 2 次运行 r-20261021-060149 PASS（裁定 `6f3f5f3`），7/7 验收在 R2 处通过，claims 与实测全部一致。
但条目 3 只做了一半：`test/scenario-g.test.ts` 只注入了 `livenessNow`，定时器（fake worker 的 `setInterval`、
监视器检查间隔）仍是真实的；reviewer 的逐条核对表对这一项打了勾。裁定提交的 CI（Run 81）在 `npm test` 失败，
单核加压复现：场景 G「不响应 soft」2/5 失败，`reviewer-isolation` 的 ESLint 用例 3/5 超时。
PASS 维持（规则按当时证据判是对的），缺口进 v02-b04-tests。这是第三次「验收命令过了、条目要求没做到」。

## v02-b04-tests 测试去真实定时器

优先级：11　依赖：v02-b04

v02-b04 第 2 次运行后 main 的 CI 是红的（Run 81），原因是两个随机失败的测试。本批次只修测试，不碰 `src/`。
规格见 SPEC 11.5。

条目：
1. `test/scenario-g.test.ts` 与 `test/ladder.test.ts` 全部改用注入的假时钟：同时注入 `livenessNow` 与 `livenessSetTimer`，
   fake worker 发事件改为由假时钟驱动，文件内不再出现任何真实的 `setInterval` / `setTimeout`（包括用于让出事件循环的 `setTimeout(r, 0)`，
   改用 `await Promise.resolve()` 或 vitest 的假定时器推进）。断言只看事件序列，不看耗时
2. `test/reviewer-isolation.test.ts` 的 ESLint 用例：`ESLint` 实例移到 `beforeAll` 只建一次，并给该用例显式 `timeout`（60 秒）。
   不改测试的断言内容

自检（不是验收，只是提醒）：在 1 核并额外起 3 个占满 CPU 的空转进程的条件下连跑 `npm test` 3 次。做不到这个环境也不影响交付。

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 场景 G 无真实定时器 | `! grep -qE "setInterval\|setTimeout\(" test/scenario-g.test.ts` | exit 0 |
| ladder 无真实定时器 | `! grep -qE "setInterval\|setTimeout\(" test/ladder.test.ts` | exit 0 |
| 场景 G 注入了定时器 | `grep -qE "livenessSetTimer" test/scenario-g.test.ts` | exit 0 |
| ESLint 只建一次 | `grep -qE "beforeAll" test/reviewer-isolation.test.ts` | exit 0 |
| 未改动 src | `test -z "$(git log --format=%H -n 1 --grep='issue v02-b04-tests' -- .collie/batches/v02-b04-tests/task.md)" \|\| git diff --quiet "$(git log --format=%H -n 1 --grep='issue v02-b04-tests' -- .collie/batches/v02-b04-tests/task.md)"..HEAD -- src/` | exit 0 |

额外禁止：
- 改动 `src/` 下任何文件（需要改源码就停下来在 report 里说明，不要动手）
- 改动任何受保护路径
- 为了让测试过而删除或跳过（`skip` / `todo`）任何测试

## v02-b05 中断标记与 resume

优先级：12　依赖：v02-b04-tests

规格见 SPEC 11.7、11.9。

条目：
1. 中断判定与 `task.md` 注入（11.7）：`attempt` 递增、`interrupted_at`、`rescue_sha`、正文「上一轮中断」一节；
   `TaskFrontmatterSchema` 加可选 `rescue_sha`，不升版本。
   同一批次后续 attempt 沿用第 1 次的 `base_sha`（4.3「上报」段）；
   上报路径用 git 实测 `base_sha..HEAD` 与推送状态写入 progress，措辞「上报：无 report」，不再出现「规则 0」
2. resume 策略（11.7）：按 `resume_max` 决定是否传 `resumeSessionId`；新增事件 `worker.resumed`；
   仲裁 PASS 的运行不算中断、`attempt` 不递增（11.7 第一段）；
   `claude.ts` 的 `turns_exhausted` 映射已在 b03 提前落地，本批次只需测试覆盖
3. 场景 E 后半段（attempt / interrupted_at / rescue_sha）与场景 F：
   `test/scenario-e.test.ts` 补全，`test/scenario-f.test.ts` 新增；
   `collie show` 按顺序还原 E / F / G 的事件链

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 场景 E 完整 | `npm test -- test/scenario-e.test.ts` | exit 0 |
| 场景 F | `npm test -- test/scenario-f.test.ts` | exit 0 |
| show 还原事件链 | `npm test -- test/show.test.ts` | exit 0 |

额外禁止：
- 改动任何受保护路径
- resume 的 session 内容进入 journal（只记 session_id）
