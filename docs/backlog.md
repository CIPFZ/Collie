# Collie 批次队列

> 唯一可修改者：R1 方案设计 Agent（须用户批准）。其他角色只读。
> 优先级在方案确定阶段一次排定，批次随之固定，**不做滚动重新拆解**。
> R1 签发自查（v02-b04-fix 后）：条目里每一条「测试要注入 X / 用 Y 替代 Z」的要求，验收必须同时 grep 源文件和对应测试文件，
> 只 grep `src/` 的验收抓不住「接口做了、测试没用上」（b04：只注入 now；b04-fix：指纹可注入但场景 G 没注入）。
> 凡验收表含 grep 类结构检查的批次，条目正文必须写「同步加进 `test/invariants.test.ts`」，验收加一条 grep 该文件（SPEC 3.2 结构不变量）。

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
| 11 | v02-b04-tests | 测试去真实定时器 | v02-b04 | blocked |
| 12 | v02-b04-fix | R2 不再崩：interrupt this、异常兜底、内容指纹 | v02-b04 | passed |
| 13 | v02-b04-fix2 | CI 证据与结构回归 | v02-b04-fix | passed |
| 14 | v02-b04-fix3 | worker_pid、包装层 interrupt、原子心跳 | v02-b04-fix2 | passed |
| 15 | v02-b04-fix4 | spawn 钩子按 SDK 签名、类型来自 SDK、collie smoke | v02-b04-fix3 | blocked |
| 16 | v02-b05 | 中断标记与 resume | v02-b04-fix4 | passed |
| 17 | v02-b05-fix | 规则 9、worker_pid 时序、CI 未取证措辞 | v02-b05 | passed |
| 18 | v02-e-drill | stream.ndjson 密钥屏蔽（场景 E 真实 kill 演练） | v02-b05-fix | passed |
| 19 | v02-e-fix | worker 随 R2 死、取证沿用首次 base_sha、interrupted_at | v02-e-drill | passed |
| 20 | v02-e-drill2 | 场景 E 第 2 次演练（脏工作区 + 不补杀） | v02-e-fix | passed |
| 21 | v02-e-fix2 | rescue_sha 跨轮查找、interrupted_at 时间 | v02-e-drill2 | passed |
| 22 | v03-b01 | 收回人工动作：R2 推送裁定提交、启动核查其 CI、reviewer 流落盘、场景 H | v02-e-fix2 | passed |
| 23 | v03-b01-fix | 启动补推只认失败的裁定提交，且先于救援 | v03-b01 | pending |

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

记录：第 1 次运行 r-20261021-112601 BLOCK，规则 1：reviewer 在 verdict JSON 里把 `ci_conclusion` 写成
`cannot_verify_no_gh_auth`（schema 外的值），并在没查到 CI 的情况下写了 `ci_branch_matched: true`。
这是 reviewer 的输出错误，不是 worker 的问题；规则 1 维持原样（reviewer 产不出合法输出就该上报）。
worker 的 `2661d0e` 只改两个测试文件，R2 验收 8/8 通过、R1 复核 574 全过、CI 绿，予以采纳；
`reviewer-isolation` 的随机超时已修好。场景 G 在单核加压下仍 3 次挂 2 次：测试里已无真实定时器，
剩余不确定性在 `src/ladder.ts` 每次采样都起真实 `git` 子进程取指纹，本批次禁止改 `src/`，修不到。
判 blocked，不重跑；缺口进 v02-b04-fix。

## v02-b04-fix R2 不再崩：interrupt this、异常兜底、内容指纹

优先级：12　依赖：v02-b04

第 1 次运行（r-20261022-025901）R2 自己崩了，见下方记录。本批次只做让 R2 在真实运行里不再崩的三处。
规格见 SPEC 11.2、11.3、11.5、11.6。运行本批次期间 `progress_secs` / `wallclock_secs` 已临时调大（SPEC 3.1），
让空转与墙钟实际不触发；修好后 R1 恢复。

条目：
1. `claude.ts` 的 `interrupt()` 调用保持 `this`（11.2）：两处（惰性包装与 `stop('soft')`）都改为直接在对象上调用并 `await`，
   不再 `void`。`test/runner-claude.test.ts` 加回归测试：替身的 `interrupt` 读 `this` 上的字段、`this` 为 undefined 时抛错，
   测试名含 `binds this`
2. R2 异常兜底（11.3）与阶梯容错（11.6）：`run.ts` 最外层 try / finally，任何异常都先记 `run.finished(result=error)`、
   救援、追加 progress、删心跳，再以退出码 1 退出；注册 `unhandledRejection`；
   阶梯里某级 `stop()` 抛出时记 `worker.signaled` 带 `error` 字段并进入下一级。
   `test/ladder.test.ts` 加「soft 抛错 → 记 error → 升级 hard」用例；`test/run.test.ts`（或现有 run 测试文件）加
   「worker 阶段抛出 → run.finished(error) 存在、心跳已删、进程未直接退出」用例
3. 产出指纹（11.5）：改为 `HEAD` + `git diff HEAD` 哈希 + 未跟踪文件 (路径, 大小, mtime) 哈希，
   并做成可注入（`LivenessConfig.fingerprint?`）。`test/scenario-g.test.ts` 注入假指纹，fake worker 发事件、推进假时钟、
   改变假指纹三者全部由测试代码顺序控制；另加一条单测：同一文件内容改两次，两次指纹不同

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 场景 G 连跑 5 次 | `for i in 1 2 3 4 5; do npx vitest run test/scenario-g.test.ts \|\| exit 1; done` | exit 0 |
| interrupt 不再拆出调用 | `! grep -qE "= *(resolvedIterable\|queryIterable)\??\.interrupt;" src/runner/claude.ts` | exit 0 |
| this 绑定有回归测试 | `grep -qE "binds this" test/runner-claude.test.ts` | exit 0 |
| 未处理拒绝有兜底 | `grep -qE "unhandledRejection" src/run.ts src/cli.ts` | exit 0 |
| 指纹已注入且看内容 | `grep -qE "fingerprint\?:" src/ladder.ts && grep -qE "diff" src/ladder.ts` | exit 0 |
| 场景 G 两个用例都注入了假指纹 | `test "$(grep -cE "livenessFingerprint" test/scenario-g.test.ts)" -ge 2` | exit 0 |
| SDK 概念不泄漏 | `! grep -rlE "@anthropic-ai" src --include='*.ts' \| grep -v '^src/runner/'` | exit 0 |

额外禁止：
- 改动任何受保护路径
- 为了让测试过而删除或跳过任何测试
- 实现限流不等待或 worker_pid（那是 v02-b04-fix2）

记录：第 1 次运行 r-20261022-025901 退出码 1，R2 进程崩溃。worker 在同一组 4 个文件上连续编辑 15 分钟，
指纹（porcelain）不变被判空转；R2 发 soft，`claude.ts` 把 `interrupt` 拆出来调用丢了 `this`，TypeError 以未处理拒绝
形式让 Node 直接退出。没有 run.finished、救援、progress、裁定；心跳文件遗留。worker 未提交的 4 文件改动（+90/−19，
条目 1 做了一部分，条目 2、3 未动）存档于 tag `v02-b04-fix-attempt1`，不采纳；操作员 reset 到 `origin/main` 并删除心跳。
原条目中的限流不等待与 worker_pid 移至 v02-b04-fix2。

记录：第 2 次运行 r-20261022-044520 FIX（裁定 `6d4d0c6`），R2 未崩。条目 1、2 完成；条目 3 做了一半：
指纹改为看内容、接口可注入、单测通过，但场景 G 两个用例没传 `livenessFingerprint`，仍用真实 git。
验收只 grep 了 `src/ladder.ts` 没抓到，由 reviewer 按手册逐条核对拦下——这是改过的手册第一次真正起作用，
也是第一次由 reviewer 自己把结论拉成非 PASS。R1 复核 9/9 验收通过、583 全过。按 FIX 常规重跑第 3 次，
已补一条验收 grep 测试文件；阈值在第 3 次通过前继续保持调大。

记录：第 3 次运行 r-20261022-062718 PASS（裁定 `eb98dd0`），10/10 验收通过，583 全过，单核加压 3 次全过、场景 G 10 次全过。
worker 读了 progress 里上一次 FIX 的理由，只补做了场景 G 注入（1 个提交，只改测试）。
遗留：假指纹函数里用了真实 `setTimeout(0)` 限制检查频率，b04-tests 的结构检查对 main 已不通过，本批次验收没沿用那条，
reviewer 打了勾。PASS 维持；缺口与「结构检查不回归」问题进 fix2。
claims `pushed=false` 而实际已推送，第二次出现（b03 亦然），无害，不开条目。

## v02-b04-fix2 CI 证据与结构回归

优先级：13　依赖：v02-b04-fix

所有者已生成只读 PAT，等本批次落地后才放进环境；本批次让 R2 能用它、worker 看不见它。规格见 SPEC 3.1、3.2、11.5。

条目：
1. `ci.token_file`（3.1）：`ConfigSchema` 的 `[ci]` 加可选 `token_file`（字符串，`~` 展开为 home）；
   `evidence.ts` 构造 `ciQuery` 时读取文件内容（trim）作为 `token`，文件不存在等同未配置；
   runner 拉起子进程时从 env 删除 `GITHUB_TOKEN` 与 `GH_TOKEN`（fake 与 claude 两个 runner 都要，claude 走 SDK 的 `env` 选项）；
   `.gitignore` 与 `src/cli.ts` 的 `GITIGNORE_ENTRIES` 加 `.collie/github-token`。
   测试：config 解析 `token_file`、`~` 展开；evidence 从临时文件读到 token 并传给注入的 fetch（断言 `Authorization` 头）；
   runner 测试断言传给 `query()` 的 `options.env` 不含这两个键
2. 限流不等待（3.1）：无 token 且首次轮询即 `rate_limited` 时立即返回 unknown、记 `ci.wait_timeout`
   （`waited_secs: 0`、`last_state: rate_limited`），不再等 `ci_wait_secs`；有 token 时行为不变。注入 fetch 替身覆盖两种情况，
   无 token 那条用例的测试名须含 `unauthenticated` 与 `rate limit` 与 `immediately` 三个词
3. 结构回归（3.2）：新建 `test/invariants.test.ts`，把已通过批次的 grep 类结构检查改写为测试，至少包括：
   `.collie/heartbeat.json` 被 gitignore（b02）；`test/scenario-g.test.ts` 与 `test/ladder.test.ts` 无 `setInterval` / `setTimeout(`（b04-tests）；
   `src/runner/claude.ts` 无 `softStopRequested`、无拆出调用的 `interrupt`（b03、b04-fix）；`src/` 除 `src/runner/` 外无 `@anthropic-ai`（b02）；
   `src/ladder.ts` 有 `fingerprint?:`（b04-fix）。
   同时把场景 G 假指纹的 `setTimeout(0)` 去掉：改为同步返回或 `await Promise.resolve()`，检查频率由注入的 `livenessSetTimer` 控制，
   让 b04-tests 那条不变量对 main 重新成立

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 不变量文件存在且含 5 类检查 | `test "$(grep -cE "^\s*it\(" test/invariants.test.ts)" -ge 6` | exit 0 |
| 场景 G 无真实定时器（恢复 b04-tests） | `! grep -qE "setInterval\|setTimeout\(" test/scenario-g.test.ts` | exit 0 |
| token_file 进 schema 与 evidence | `grep -qE "token_file" src/schema/index.ts && grep -qE "token_file" src/evidence.ts` | exit 0 |
| 子进程 env 去密钥有测试 | `grep -qE "GITHUB_TOKEN" test/runner-claude.test.ts && grep -qE "GH_TOKEN" src/runner/claude.ts` | exit 0 |
| token 文件被忽略 | `grep -qE "github-token" .gitignore && grep -qE "github-token" src/cli.ts` | exit 0 |
| 限流不等待有测试 | `grep -qE "unauthenticated.*rate.?limit.*(no wait\|without waiting\|immediately)" test/ci.test.ts` | exit 0 |
| SDK 概念不泄漏 | `! grep -rlE "@anthropic-ai" src --include='*.ts' \| grep -v '^src/runner/'` | exit 0 |

额外禁止：
- 改动任何受保护路径（`.gitignore` 不在清单内，本批次允许改）
- 把任何 token 值写进代码、测试或 fixture；测试里用 `fake-token` 字样
- 为了让测试过而删除或跳过任何测试

记录：第 1 次运行 r-20261022-082259 PASS（裁定 `b3f828e`），10/10 验收通过，601 全过，历史中无 token 字样。
`invariants.test.ts` 8 条。R1 随后把 `token_file` 写进 toml（SPEC 3.1 约定由 R1 事后补）。
遗留：`token_file` 相对路径按进程 cwd 解析，规格定为相对仓库根，fix3 条目 3 对齐。

## v02-b04-fix3 worker_pid、包装层 interrupt、原子心跳

优先级：14　依赖：v02-b04-fix2

规格见 SPEC 11.2、11.3。

条目：
1. `ClaudeRunner` 提供 `worker_pid`（11.2）：通过 SDK 的 `spawnClaudeCodeProcess` 钩子用 `node:child_process.spawn`
   自行拉起并记下 `pid`，`RunHandle.pid` 返回它；`kill` 级对该 pid 发 `SIGKILL`。
   `test/runner-claude.test.ts` 断言注入 `query()` 收到的选项含该钩子，且钩子返回对象的 `pid` 流到 `RunHandle`。
   fix2 的 env 去密钥在这条路径上同样生效（spawn 时的 env 也要删）
2. `claude.ts` 惰性包装层的 `interrupt()`：SDK 对象已就绪但没有 `interrupt` 时必须抛错，不得静默返回；
   SDK 尚未就绪时的调用仍可忽略但要记一条 stderr 日志。`test/runner-claude.test.ts` 加「就绪但无 interrupt → 抛错」用例
3. `heartbeat.ts` 三处 `writeFileSync` 改为写临时文件再 `renameSync`（原子）；
   `test/heartbeat.test.ts` 加「文件为空 / 半截 JSON」两个用例，断言按 SPEC 11.3 处理且不抛出。
   顺带：`evidence.ts` 的 `token_file` 相对路径改为相对仓库根（SPEC 3.1），加一条测试。
   以上三条的结构检查同步加进 `test/invariants.test.ts`

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 心跳原子写 | `grep -qE "renameSync" src/heartbeat.ts && ! grep -qE "writeFileSync\(path," src/heartbeat.ts` | exit 0 |
| 包装层 interrupt 缺失抛错有测试 | `grep -ciE "no interrupt\|without interrupt\|missing interrupt" test/runner-claude.test.ts \| grep -qvE "^0$"` | exit 0 |
| pid 经钩子流到 RunHandle | `grep -qE "spawnClaudeCodeProcess" src/runner/claude.ts && grep -qE "spawnClaudeCodeProcess" test/runner-claude.test.ts` | exit 0 |
| 不变量已扩充 | `grep -qE "renameSync\|spawnClaudeCodeProcess" test/invariants.test.ts` | exit 0 |
| SDK 概念不泄漏 | `! grep -rlE "@anthropic-ai\|spawnClaudeCodeProcess" src --include='*.ts' \| grep -v '^src/runner/'` | exit 0 |

额外禁止：
- 改动任何受保护路径
- 为了让测试过而删除或跳过任何测试
- 条目 1 不得改变 soft / hard 的现有实现（`interrupt()` / abort）

记录：第 1 次运行 r-20261022-102856 PASS（裁定 `f821742`），8/8 验收通过，610 全过。
fix2 的两项第一次真实生效：R2 用 token 取到 head_sha 自己的 CI（success、监听分支一致），未等待；
子进程环境无密钥（/proc 实读）、stream.ndjson 无 token 字样。阈值恢复 900 / 2700。
遗留：CI 取证成功时 journal 无事件（只有超时才写），进 b05 条目 2。

## v02-b04-fix4 spawn 钩子按 SDK 签名、类型来自 SDK、collie smoke

优先级：15　依赖：v02-b04-fix3

v02-b05 第 1 次运行 worker 0.16 秒崩溃：fix3 的 `spawnClaudeCodeProcess` 按 Node `spawn` 写成三参数，SDK 实际只传一个
`SpawnOptions` 对象。R2 自身用这段代码，无法正常签发批次；本批次由操作员按 SPEC 11.3「R2 自救」从 `b6a141a`（fix2 代码，
fix3 那轮实跑验证过）的 worktree 运行 R2。规格见 SPEC 11.2、11.3。

条目：
1. `claude.ts` 钩子改为 `(options) => spawn(options.command, options.args, { cwd: options.cwd, env: 去密钥后的 options.env, signal: options.signal })`，
   返回值满足 SDK 的 `SpawnedProcess`；`test/runner-claude.test.ts` 里所有调用钩子的地方改为传单个对象，
   并加一条断言：钩子收到 `{ command, args, env: { GITHUB_TOKEN: 'fake-token', PATH: '/x' } }` 时，`spawn` 替身收到的 `env` 无 `GITHUB_TOKEN`、有 `PATH`
2. `ClaudeQueryOptions` 及钩子、`SpawnOptions`、`SpawnedProcess` 相关类型全部 `import type` 自 `@anthropic-ai/claude-agent-sdk` 并用
   `Pick` / 索引类型派生，删除手写的 `SpawnHookOptions` / `SpawnHookResult`；`test/invariants.test.ts` 加一条：
   `src/runner/claude.ts` 含 `import type .* from '@anthropic-ai/claude-agent-sdk'`，且不含 `interface SpawnHook`
3. `collie smoke` 子命令：用配置的真实 runner、`maxTurns: 1`、`allowedTools: []`、prompt「Reply with the single word ok.」拉起 worker 角色，
   收到 `RunResult` 即退出码 0 并打印 `exitCode / sessionId / usage`；拉不起来或 runner 抛出则退出码 1 并打印错误。
   不写 journal、不碰 `.collie/batches`。`test/cli.test.ts` 用 fake runner 覆盖成功与失败两条路径；
   `AGENT_KICKOFF.md` 由 R1 事后把「跑批次前先 `collie smoke`」写进操作员流程

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 钩子不再是三参数 | `! grep -qE "spawnClaudeCodeProcess\?: \($" src/runner/claude.ts && ! grep -qE "command: string,$" src/runner/claude.ts` | exit 0 |
| 类型来自 SDK | `grep -qE "import type .* from '@anthropic-ai/claude-agent-sdk'" src/runner/claude.ts && ! grep -qE "interface SpawnHook" src/runner/claude.ts` | exit 0 |
| 不变量已加 | `grep -qE "claude-agent-sdk" test/invariants.test.ts` | exit 0 |
| 测试按单对象调用钩子 | `grep -qE "spawnClaudeCodeProcess\(\{" test/runner-claude.test.ts \|\| grep -qE "spawnClaudeCodeProcess\?\.\(\{" test/runner-claude.test.ts` | exit 0 |
| smoke 子命令存在且有测试 | `grep -qE "'smoke'" src/cli.ts && grep -qE "smoke" test/cli.test.ts` | exit 0 |
| SDK 概念不泄漏 | `! grep -rlE "@anthropic-ai\|spawnClaudeCodeProcess" src --include='*.ts' \| grep -v '^src/runner/'` | exit 0 |

额外禁止：
- 改动任何受保护路径
- 为了让测试过而删除或跳过任何测试
- 改变 soft / hard 的现有实现

记录：第 1 次运行 r-20261022-114309 BLOCK（裁定 `2999228`），规则 1：reviewer 把 `commits_actual` 写成 `git log --oneline` 整行，
不是纯 sha。reviewer 自判 PASS；R2 验收 9/9 通过、CI success；R1 复核 9/9、616 全过。
参照 v02-b04-tests 先例：标 blocked，`8170a3d`、`1bd1ac5` 采纳，不重跑。R2 自救流程（从 `b6a141a` worktree 运行）首次使用，通畅。
遗留：report 写了 7 位 `head_sha`，R2 原样查 Actions API 得 0 条，有 token 也等满 30 分钟才退回后代归属。进 b05 条目 3。

## v02-b05 中断标记与 resume

优先级：16　依赖：v02-b04-fix4

规格见 SPEC 11.7、11.9。

条目：
1. 中断判定与 `task.md` 注入（11.7）：`attempt` 递增、`interrupted_at`、`rescue_sha`、正文「上一轮中断」一节；
   `TaskFrontmatterSchema` 加可选 `rescue_sha`，不升版本。
   同一批次后续 attempt 沿用第 1 次的 `base_sha`（4.3「上报」段）；
   上报路径用 git 实测 `base_sha..HEAD` 与推送状态写入 progress，措辞「上报：无 report」，不再出现「规则 0」
2. resume 策略（11.7）：按 `resume_max` 决定是否传 `resumeSessionId`；新增事件 `worker.resumed`；
   仲裁 PASS 的运行不算中断、`attempt` 不递增（11.7 第一段）；
   `claude.ts` 的 `turns_exhausted` 映射已在 b03 提前落地，本批次只需测试覆盖。
   顺带两处 R2 取证侧（3.5、3.6）：CI 取证成功时记 `ci.resolved` 事件，`collie show` 能据此还原 R2 等了多久；
   取证前用 `git rev-parse` 把 report 的 `head_sha` 与 `commits[]` 展开为 40 位再查 CI、再校验，
   等待逻辑连续 3 次 `no_runs` 即转后代归属。`test/ci.test.ts` 覆盖「短 sha 展开」与「3 次 no_runs 转后代」
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
| ci.resolved 进 schema 与 R2 | `grep -qE "ci\.resolved" src/schema/index.ts && grep -qE "ci\.resolved" src/run.ts && grep -qE "ci\.resolved" test/invariants.test.ts` | exit 0 |
| 场景 F 覆盖 resume 上限 | `grep -qE "resume_max" test/scenario-f.test.ts` | exit 0 |
| 后续 attempt 沿用首次 base_sha 有测试 | `grep -qE "base_sha" test/scenario-e.test.ts` | exit 0 |
| 短 sha 展开与 no_runs 转后代有测试 | `grep -qE "rev-parse\|revParse" src/evidence.ts && grep -qE "no_runs" test/ci.test.ts && grep -qiE "short sha\|expands" test/ci.test.ts test/evidence.test.ts` | exit 0 |

额外禁止：
- 改动任何受保护路径
- resume 的 session 内容进入 journal（只记 session_id）
- 为了让测试过而删除或跳过任何测试

记录：第 1 次运行 r-20261022-111044 BLOCK（上报：无 report，裁定 `fbc7410`）。worker 启动 163 毫秒崩溃，
fix3 的 spawn 钩子签名与 SDK 不符（三参数 vs 单对象），claude 子进程没起来。R2 自身（fix3 代码）用 b04-fix 的兜底正常收尾，
run.finished / progress / 心跳删除都执行了，无残留现场。修复批次 v02-b04-fix4 插在前面，本批次依赖改为它。
这是第三次「手写 SDK 类型与真实 SDK 不一致、typecheck 与替身测试都过、真实运行才炸」，规则进 SPEC 11.2。
第 2 次运行 r-20261022-161827 PASS（裁定 `3b56179`），10/10 验收通过，635 全过，R1 复核一致。
但 worker 全程没有 `git push`（claims 如实 `pushed=false`，`remote_has_head=false`，CI 未取证），规则链无一命中，
reviewer 原判 PASS 被采用。代码本身正确，PASS 维持；规格缺口（PASS 不要求已推送、不要求 CI success）由 v02-b05-fix 规则 9 补。
smoke 首次真实运行通过（fix4 钩子能拉起子进程）。worker_pid 仍未进心跳：`onStarted` 先于 spawn 钩子触发。
本批次新功能（中断标记、resume、ci.resolved、短 sha 展开、no_runs 转后代）要下一轮 R2 才真实生效。


## v02-b05-fix 规则 9、worker_pid 时序、CI 未取证措辞

优先级：17　依赖：v02-b05

规格见 SPEC 4.3（规则 9 与来源）、11.3、3.5。

条目：
1. arbiter 规则 9：`remote_has_head=false` 或 `ci_conclusion≠success` 或 `ci_branch_matched≠true` 时，PASS 降为 FIX，
   记 `verdict.downgraded`（字段 rule=9 / reason）；原「采用 verdict 原值」改为规则 10。`src/arbiter.ts` 的常量、
   progress 与 `collie show` 的规则编号文字同步；`test/arbiter.test.ts` 加三个用例（未推送 / unknown / branch 不一致），
   并断言 FIX 原判不被改动、BLOCK 不被改动
2. worker_pid 时序：runner 选项加 `onPid?: (pid: number) => void`，spawn 钩子拿到 `child.pid` 时立刻回调；
   R2 在回调里 `updateHeartbeat({ worker_pid })`，不再依赖 `onStarted` 时读 `handle.pid`。
   `test/runner-claude.test.ts` 的真实顺序用例：`onStarted` 先触发、钩子后触发，断言心跳最终含 `worker_pid`
3. CI 未取证措辞：`evidence.ts` 在 `remote_has_head=false` 或根本没查 CI 时 `ci_branch_matched` 为 `null`、`ci_run_url` 为空；
   `progress.ts` 对 `null` 渲染「未能取证」，`false` 才渲染「监听分支不一致」。`test/evidence.test.ts` 加「未推送 → branch_matched 为 null」

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 规则 9 进 arbiter 与测试 | `grep -qE "RULE_DEFAULT = 10" src/arbiter.ts && grep -qE "remote_has_head: false" test/arbiter.test.ts` | exit 0 |
| onPid 接口存在且 R2 使用 | `grep -qE "onPid" src/runner/index.ts && grep -qE "onPid" src/runner/claude.ts && grep -qE "onPid" src/run.ts` | exit 0 |
| 真实顺序有测试 | `grep -qE "onPid" test/runner-claude.test.ts` | exit 0 |
| 未推送时 branch_matched 为 null 有测试 | `grep -qE "remote_has_head" test/evidence.test.ts && grep -qE "toBeNull" test/evidence.test.ts` | exit 0 |
| 不变量同步 | `grep -qE "RULE_DEFAULT" test/invariants.test.ts` | exit 0 |

额外禁止：
- 改动任何受保护路径
- 为了让测试过而删除或跳过任何测试
- 放宽规则 1~8 的任何一条

记录：第 1 次运行 r-20261023-060802 PASS（裁定 `371815f`），8/8 验收通过，647 全过，R1 复核一致。
b05 代码首次真实生效：`attempt` 从 1 起算正确；`ci.resolved` 首次出现且字段齐全（waited 1 秒、1 次轮询）；worker 推送了。
裁定提交自己的 CI（Run 113）红：场景 C 两个用例清理沙箱时 ENOTEMPTY（`.git/objects/pack` 还有 git 子进程在写），
代码提交的 Run 111 / 112 绿，本地与加压均复现不出。PASS 维持；沙箱清理并入 v02-e-drill 条目 3。
短 sha 展开路径仍未被真实触发（worker 写了 40 位）。

## v02-e-drill stream.ndjson 密钥屏蔽（场景 E 真实 kill 演练）

优先级：18　依赖：v02-b05-fix

规格见 SPEC 第 10 章 Q5、11.2。这是 v0.2 的收口演练：批次本身是小而真实的工作，**操作员会在 worker 阶段对 R2 发 SIGKILL**，
验证场景 E 在真实运行里成立（孤儿检测、救援提交、attempt 递增、`task.md` 的「上一轮中断」一节、resume）。
worker 不知道也不需要知道这件事；中断后第 2 次 attempt 的 worker 照手册 4.4 续做。

条目：
1. `src/runner/claude.ts` 落盘 `stream.ndjson` 前，把屏蔽集合中的每个值（非空且长度 ≥ 8）替换为 `***`；
   屏蔽集合由 R2 用 `token_file` 文件内容与 `GITHUB_TOKEN` / `GH_TOKEN` 环境变量的值构造，
   以 runner 选项 `redact: readonly string[]` 传入，runner 不读配置也不读环境变量
2. `test/runner-claude.test.ts`：注入 fake query 产出含密钥字样的事件，断言落盘文件无原文、有 `***`；`redact` 为空时原样落盘
3. `test/invariants.test.ts` 加一条：`src/runner/claude.ts` 含 `redact`，且 `src/run.ts`、`src/evidence.ts` 之外无任何文件读取 `token_file`。
   顺带修场景 C 的随机 ENOTEMPTY（v02-b05-fix 裁定提交 Run 113）：`test/support/sandbox.ts` 的全局 gitconfig 加
   `[gc]\n\tauto = 0`，`dispose()` 的 `rmSync` 加 `maxRetries: 5, retryDelay: 100`；不改任何场景测试的断言

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| redact 选项存在 | `grep -qE "redact" src/runner/index.ts && grep -qE "redact" src/runner/claude.ts && grep -qE "redact" src/run.ts` | exit 0 |
| 屏蔽有测试 | `grep -qE "redact" test/runner-claude.test.ts && grep -qE "\*\*\*" test/runner-claude.test.ts` | exit 0 |
| 不变量同步 | `grep -qE "redact" test/invariants.test.ts` | exit 0 |
| 沙箱清理不再裸删 | `grep -qE "maxRetries" test/support/sandbox.ts && grep -qE "auto = 0" test/support/sandbox.ts` | exit 0 |

额外禁止：
- 改动任何受保护路径
- 为了让测试过而删除或跳过任何测试
- runner 读取配置文件或环境变量来决定屏蔽什么（屏蔽集合只能来自 `redact` 选项）

记录：两次运行。第 1 次 r-20261023-082524 在 worker 阶段被操作员 `kill -9`（授权演练）；第 2 次 r-20261023-083500 PASS（裁定 `50a2c55`），
7/7 验收通过，654 全过，整批 `83faebb..6317361` 受保护路径零改动，R1 复核一致。短 sha 展开首次真实生效（1 秒 1 次查中）。
演练成立：`worker_pid` 进心跳（onPid）、`run.orphaned`、`attempt: 2`、「上一轮中断」一节、frontmatter 沿用首次 `base_sha`、下一轮接续完成。
演练不成立 / 未验证：R2 死后 worker 独活 78 秒并提交了 `9acc692`（操作员补杀）；救援提交未触发；`interrupted_at` 写成 `unknown worker.started`；
R2 取证与 reviewer 范围从 attempt 2 的 task 提交算起，attempt 1 的两个提交漏审（R1 事后补查无害）。
PASS 维持（三条目完成，缺口与条目无关）；v0.2 收口条件见 SPEC 第 11 章开头，缺口进 v02-e-fix，修完 v02-e-drill2 再演练。

## v02-e-fix worker 随 R2 死、取证沿用首次 base_sha、interrupted_at

优先级：19　依赖：v02-e-drill

v02-e-drill 演练暴露的三处，见 SPEC 第 11 章开头「v0.2 收口条件」第 1、3、4 条。规格见 SPEC 11.3、11.7。

条目：
1. worker 随 R2 死（11.3）：runner spawn 时 `detached: true`；R2 注册 `exit` / `SIGTERM` / `SIGINT` 对 `-worker_pid` 发 `SIGTERM`；
   R2 另起守护进程（`node -e`，脱离 R2 进程组）持有 R2 pid 与 worker_pid，每 2 秒探测，R2 消失即 `SIGKILL` worker_pid 后自退；
   `guard_pid` 写进心跳，孤儿检测三个 pid 任一存活即拒绝启动；reviewer 阶段开始时清掉心跳的 `worker_pid`。
   测试：fake 子进程（`node -e 'setInterval(()=>{},1000)'`）+ 真实守护进程，`SIGKILL` 父进程替身后断言子进程 5 秒内消失；
   `test/heartbeat.test.ts` 加 `guard_pid` 存活拒绝启动用例
2. 取证范围（11.7）：`run.ts` 的 evidence 与 reviewer 输入用 frontmatter 沿用的首次 `base_sha`，不再用 `taskSha`；
   `test/scenario-e.test.ts` 加断言：attempt 2 的 `commits_actual` 含 attempt 1 的提交，且 attempt 1 偷改 SPEC 时 attempt 2 被规则 2 BLOCK
3. `interrupted_at`（11.7）：结束原因按 `worker_stop_reason → result → orphaned → unknown` 取；journal 无 `run.finished` 时最后事件取
   `stream.ndjson` 末行；「上一轮中断」一节无 `rescue_sha` 时也要写「上一轮未留下救援提交，请从 `git log` 核实已完成到哪一步」。
   `test/scenario-e.test.ts` 断言 `interrupted_at` 含 `orphaned` 且事件类型不是 `worker.started`

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 场景 E 完整 | `npm test -- test/scenario-e.test.ts` | exit 0 |
| 子进程随父死有测试 | `grep -qE "detached: true" src/runner/claude.ts && grep -qE "guard_pid" src/heartbeat.ts && grep -qiE "parent.*(killed\|dies\|SIGKILL)" test/runner-claude.test.ts test/guard.test.ts` | exit 0 |
| 取证不再用 taskSha 做 base | `! grep -qE "baseSha: taskSha" src/run.ts && grep -qE "commits_actual" test/scenario-e.test.ts` | exit 0 |
| interrupted_at 取 orphaned | `grep -qE "orphaned" test/scenario-e.test.ts && grep -qE "stream\.ndjson\|appendStream\|readStream" src/run.ts` | exit 0 |
| 不变量同步 | `grep -qE "detached: true\|baseSha: taskSha" test/invariants.test.ts` | exit 0 |

额外禁止：
- 改动任何受保护路径
- 为了让测试过而删除或跳过任何测试
- 守护进程读取配置或仓库；它只认两个 pid

记录：第 1 次运行 r-20261025-083535 PASS（裁定 `2d09cc4`），8/8 验收通过，670 全过，R1 复核一致、`guard.test.ts` 连跑 3 次稳定。
守护进程为独立 `node -e`（detached、unref），只认两个 pid；取证 base 已改为沿用的首次 `base_sha`；`interrupted_at` 能取 `orphaned` 并回退到 `stream.ndjson`。
操作员在 vitest 外做了一次真实进程实验：SIGKILL 替身 R2 后 2.5 秒 worker 与守护进程都消失。
reviewer 对条目 1 的行为要求只给了代码位置没实跑，手册已补「行为要求必须实跑」。worker 用了 193 轮（上限 200）。
规则 9 至今未在真实运行里触发（每轮 worker 都推送且 CI 绿）。本批次代码下一轮（v02-e-drill2）才在 R2 上生效。

## v02-e-drill2 场景 E 第 2 次演练（脏工作区 + 不补杀）

优先级：20　依赖：v02-e-fix

v0.2 收口演练第 2 次。批次工作本身很小；操作员按 AGENT_KICKOFF.md「场景 E 真实演练（第 2 次）」操作：
在 worker 写了文件但尚未提交时 `kill -9` R2，**不补杀 worker**，观察守护进程是否在 5 秒内杀掉它；
然后立即启动下一轮，期望先被拒绝（若 worker 或守护进程仍存活）、确认都退出后再启动，期望 `worker.rescued` + `rescue_sha`。

条目：
1. `collie show <batch>`（`src/cli.ts`）输出末尾加一段「中断链」：按 attempt 列出 `run.orphaned` / `worker.rescued` / `worker.resumed` 与 `rescue_sha`，
   无中断时省略
2. `test/show.test.ts` 覆盖有中断链与无中断链两种输出
3. `README.md` 加一节「中断与恢复」，三句话说明 kill 后会发生什么、下一轮怎么接、人该看哪里

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| show 有中断链 | `grep -qE "中断链" src/cli.ts && grep -qE "中断链" test/show.test.ts` | exit 0 |
| README 有章节 | `grep -qE "^## .*中断与恢复" README.md` | exit 0 |

额外禁止：
- 改动任何受保护路径
- 为了让测试过而删除或跳过任何测试

记录：两次运行。第 1 次 r-20261026-025529 在工作区脏、尚无提交时被操作员 `kill -9` R2（授权演练，不补杀）：
守护进程 1 秒内杀掉 worker 并自退。第 2 次 r-20261026-025925 PASS（裁定 `f40284c`）：`run.orphaned` → `worker.rescued`（`6158611`）
→ `attempt: 2` → 接续完成三条目，5/5 验收通过，672 全过，取证范围 `7f93939..b076c7b` 含救援提交，R1 复核一致。
不成立：`task.md` 无 `rescue_sha`，正文写成「上一轮未留下救援提交」（孤儿救援记在本轮 journal，生成 task 只查上一轮）；
`interrupted_at` 最后事件为 `user@`、时间空。未验证：守护进程存活时拒绝启动（守护太快）。
PASS 维持；缺口进 v02-e-fix2，e-fix2 PASS 即 v0.2 收口，不做第 3 次演练。attempt 2 用 47 轮，`max_turns` 200 不变。

## v02-e-fix2 rescue_sha 跨轮查找、interrupted_at 时间

优先级：21　依赖：v02-e-drill2

v0.2 的最后一批。规格见 SPEC 11.7（`rescue_sha` 来源、`interrupted_at` 事件与时间）。

条目：
1. `run.ts` 生成 task 时，`worker.rescued` 同时在上一轮 journal 与本轮 journal（`run.orphaned` 之后）查找，取最后一条；
   有 `rescue_sha` 时 frontmatter 写入且正文含「请先核实」句，没有时正文含「上一轮未留下救援提交」句
2. `readStreamLastEvent`：事件类型按 SPEC 11.7 细化（`type/subtype` 或 `tool_use` 的 `name`），时间取消息 `timestamp`，
   缺失则向前找最近一条有 `timestamp` 的行，再缺失用心跳 `updated_at`；返回的时间不得为空串
3. `test/scenario-e.test.ts` 用 fake runner 覆盖孤儿救援路径：第 1 轮写脏文件后模拟 R2 被 kill（心跳遗留、无 `run.finished`、
   `stream.ndjson` 末行是无 `timestamp` 的 `user` 消息），第 2 轮启动后断言 `task.md` 的 `rescue_sha` 等于 `worker.rescued.sha`、
   正文含「请先核实」、`interrupted_at` 含 `orphaned` 且时间非空且事件类型不是裸的 `user`

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 场景 E 完整 | `npm test -- test/scenario-e.test.ts` | exit 0 |
| 孤儿路径 rescue_sha 有断言 | `grep -qE "rescue_sha" test/scenario-e.test.ts && grep -qE "请先核实" test/scenario-e.test.ts` | exit 0 |
| interrupted_at 时间非空有断言 | `grep -qE "interrupted_at" test/scenario-e.test.ts && grep -qE "toBeTruthy\|toHaveLength\|toMatch" test/scenario-e.test.ts && grep -qE "tool_use" src/run.ts` | exit 0 |
| 不变量同步 | `grep -qE "请先核实\|rescue_sha" test/invariants.test.ts` | exit 0 |

额外禁止：
- 改动任何受保护路径
- 为了让测试过而删除或跳过任何测试
- 改动守护进程、取证范围、规则链的任何实现

记录：第 1 次运行 r-20261026-035021 PASS（裁定 `cfee4dc`），7/7 验收通过，677 全过，场景 E 15 个，R1 复核一致。
reviewer 阶段心跳 `worker_pid` 已清（142 次采样无数字 pid），`guard_pid` 保留到 ci 阶段结束。
reviewer 按新手册对行为要求贴了实跑输出，但其事件流不落盘，操作员无法独立确认（进 v03-b01）。**v0.2 收口。**

## v03-b01 收回人工动作：R2 推送裁定提交、启动核查其 CI、reviewer 流落盘、场景 H

优先级：22　依赖：v02-e-fix2

v0.3 第一批。规格见 SPEC 12.1、3.6（三个新事件）。

条目：
1. R2 推送裁定提交与启动核查（12.1）：`git.ts` 加 `push(cwd, remote, branch)`；`run.ts` 在 progress 提交之后推送，记 `verdict.pushed`，
   失败记 `verdict.push_failed` 且不改变结论、不抛出；启动阶段若本地领先远端先推送一次；启动阶段取最近一条 `verdict.pushed.sha`
   用 `queryCi` 查一次（不等待），`failure` / `cancelled` 打印 `warning: previous verdict commit ...` 并记 `ci.verdict_commit`，
   `success` 只记事件，其余不记。`schema` 加三个事件。测试：fake 场景里断言推送后远端含裁定提交；注入 fetch 替身返回 failure 时 stderr 有 warning
2. reviewer 事件流落盘（12.1）：`reviewer.stream.ndjson`，复用 worker 的写入与 `redact`；`test/reviewer-isolation.test.ts` 或新测试断言文件存在、
   含 reviewer 的事件、密钥已屏蔽
3. 场景 H（12.1）：`test/scenario-h.test.ts`，fake worker `pushed=false` 且远端无 head、reviewer PASS → arbiter FIX、`verdict.downgraded` rule=9；
   `test/invariants.test.ts` 加「`src/git.ts` 有 `push`」「`scenario-h.test.ts` 存在」两条

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 场景 H | `npm test -- test/scenario-h.test.ts` | exit 0 |
| 三个事件进 schema | `grep -qE "verdict\.pushed" src/schema/index.ts && grep -qE "verdict\.push_failed" src/schema/index.ts && grep -qE "ci\.verdict_commit" src/schema/index.ts` | exit 0 |
| R2 推送且失败不抛 | `grep -qE "export async function push\(" src/git.ts && grep -qE "verdict\.push_failed" src/run.ts` | exit 0 |
| 启动核查有警告 | `grep -qE "previous verdict commit" src/run.ts && grep -qE "previous verdict commit" test/*.test.ts` | exit 0 |
| reviewer 流落盘 | `grep -qE "reviewer\.stream\.ndjson" src/run.ts && grep -qE "reviewer\.stream\.ndjson" test/*.test.ts` | exit 0 |
| 不变量同步 | `grep -qE "scenario-h" test/invariants.test.ts` | exit 0 |

额外禁止：
- 改动任何受保护路径
- 为了让测试过而删除或跳过任何测试
- 推送失败时重试、抛出或改变本轮退出码
- 改动规则 1~10 的实现（场景 H 只是测试）

记录：第 1 次运行 r-20261026-045805 PASS（裁定 `79b40de`，操作员代推最后一次），9/9 验收通过，695 全过（R1 复核 3 次 1 次 `scenario-f` 10 秒超时）。
push 只用 `.git/config` 现成 remote，凭据与全局配置哈希不变；场景 H 用真实 bare 远端且 fake worker 不 push，`verdict.downgraded` rule=9 成立。
**越界**：`run.ts:721-727` 启动时无条件 `push`，且位于孤儿救援之后——下一次真实救援会把 `wip(collie)` 提交推上 main，违反 11.4。
规格 12.1 原文「若本地领先远端先推送」写得不严，R1 已收紧；reviewer 未拦。PASS 维持，`v03-b01-fix` 在任何下一轮之前先跑。

## v03-b01-fix 启动补推只认失败的裁定提交，且先于救援

优先级：23　依赖：v03-b01

规格见 SPEC 12.1（补推的唯一条件）、11.4、3.6（`verdict.push_skipped`）。**在跑任何其他批次之前先跑它**：
现在的代码在下一次孤儿救援时会把未审核的 wip 提交推上 main。

条目：
1. `run.ts` 启动阶段：补推移到孤儿检测与救援**之前**；只有 journal 最近一条 `verdict.push_failed.sha` 等于 `HEAD` 且远端不含它时才 `push`
   并记 `verdict.pushed`；条件不满足记 `verdict.push_skipped`（字段 head / reason，reason 取 `no_failed_push` / `head_is_not_verdict` / `already_on_remote`）；
   没有 `push_failed` 事件时不调用 `push`、不记事件。`schema` 加 `verdict.push_skipped`
2. 场景测试（加进 `test/scenario-e.test.ts` 或新建 `test/scenario-i.test.ts`）：
   a. 第 1 轮 worker 写脏文件后模拟 R2 被 kill；第 2 轮启动后断言远端**不含** `worker.rescued.sha`，journal 无 `verdict.pushed`；
   b. 第 1 轮以注入的 push 替身让裁定推送失败（`verdict.push_failed`）；第 2 轮启动后断言远端含该裁定 sha、journal 有 `verdict.pushed`；
   c. 在 b 的基础上，第 2 轮启动前在 HEAD 上再加一个提交，断言不推送、记 `verdict.push_skipped` reason=`head_is_not_verdict`
3. `test/invariants.test.ts` 加一条：`src/run.ts` 里 `push(` 的调用处每一处前 5 行内都有 `push_failed` 或 `verdict`
   字样（粗略保证没有裸的启动 push）；顺带把 `scenario-f` 的 vitest 超时从默认 10 秒提到 30 秒（只改该文件的 `describe` 选项，不改断言）

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 场景 F 连跑 3 次 | `for i in 1 2 3; do npx vitest run test/scenario-f.test.ts \|\| exit 1; done` | exit 0 |
| 补推有条件 | `grep -qE "push_skipped" src/run.ts && grep -qE "push_skipped" src/schema/index.ts && grep -cE "await push\(" src/run.ts \| grep -qE "^[1-3]$"` | exit 0 |
| 救援提交不被推送有测试 | `grep -qE "worker\.rescued" test/scenario-*.test.ts && grep -qE "push_skipped" test/scenario-*.test.ts` | exit 0 |
| 不变量同步 | `grep -qE "push_skipped\|await push" test/invariants.test.ts` | exit 0 |

额外禁止：
- 改动任何受保护路径
- 为了让测试过而删除或跳过任何测试
- 改动裁定提交在运行末尾的正常推送路径（12.1 第一条）

