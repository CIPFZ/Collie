# Collie 开发进度

> 本文件由调度器（R2）维护，依据审核 Agent 的实测证据写入。worker 只读（铁律 3）。
> Collie 自身实现前，由人工占位 R2 填写。

更新时间：2026-10-16
当前版本：v0.1 取证
当前批次：v01-b02 已 PASS（附条件：4 个代码提交 CI 待目视确认）；v01-b03 待签发
CI 实际状态：绿。v01-b01 四次运行由项目所有者目视确认均为 `main / success`

## v0.1 批次（对应 docs/backlog.md）

- [x] v01-b01 工程骨架与基础设施　← PASS，verdict 见 `.collie/batches/v01-b01/verdict.md`
- [x] v01-b02 批次解析与 worker 角色　← PASS（附条件），verdict 见 `.collie/batches/v01-b02/verdict.md`
- [ ] v01-b03 审核角色与仲裁

## 已验证完成（经审核 Agent 实测取证）

v01-b02，提交 `0ff9ef5` `8e7dbd4` `4785816` `e30c4ee`（HEAD `e30c4ee`）：
- 8 条验收全部 exit 0；`npm test` 236 passed / 0 failed
- 受保护文件零触碰；新增依赖仅 `yaml`（ISC）
- `no-restricted-imports` 隔离经两处变异测试证实物理生效
- backlog-reject 20 用例、readReport 8 边界，覆盖超出要求

v01-b01，提交 `134ea31` `3f4992d` `e5c7d3f` `e99fde3`（HEAD `e99fde3`）：
- 7 条验收命令全部 exit 0；`npm test` 111 passed / 0 failed；在干净 clone 上 `npm ci` 复现一致
- 受保护文件零触碰；改动范围 17 文件全在工程配置 / `src/` / `test/`
- 测试覆盖超出 task 要求（journal 每种坏行独立用例；config 多错误聚合与 TOML 行号）
- 铁律 11 由 `no-magic-numbers` + `no-restricted-syntax` 双规则执行，变异测试证实
- 运行时依赖许可证干净；声称与实测零差异

## 进行中

无。等待 CI 目视确认后签发 v01-b03。

## 已知问题

- R4 用未鉴权 GitHub API 查 CI 在共享出口 IP 下不可用（配额 0/60）。需配只读 token 或改为目视确认
- 远端访问协议因环境而异：R1/R2 环境 SSH 可用、HTTPS 不可用；worker 环境相反
- Agent 的写文件工具曾把 U+2028/U+2029 原样写入源码，已自查清除。R4 后续批次应扫描此项

## 开放问题（需项目所有者决策）

无。

## 本轮裁决记录（v01-b02 汇报，2026-10-16）

- 裁决 1：验收命令唯一执行形式为 `parseBacklog` 输出，禁止从 .md 源码原样复制（SPEC 3.2、AGENT-reviewer 第 2 节）
- 裁决 2：R1 过失——加 `ci_passed` 未 bump 版本。已升 `SCHEMA_VERSION = 2`，SPEC 3 写入版本历史与 v1→v2 迁移规则，b03 实现 `migrate.ts`；`collie.toml` 同步为 2
- 裁决 3：AGENT-worker 与 AGENT-reviewer 第 5 节外层围栏改为四反引号
- 采纳：status 断言用冻结快照；sha 加引号写入 SPEC 3.3
- `wallclock_secs` 执行点裁定为 R2，`RunOptions` 加可选 `signal`（SPEC 3.3）

## 上轮裁决记录（v01-b01 汇报，2026-10-16）

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

项目所有者目视确认 v01-b02 四个代码提交 CI 后，R1 签发 v01-b03。

## 调度器实测记录（collie run 自动写入）

<!-- collie:runs:start -->
### v01-b05-smoke · r-20261020-051154 · (中断)

- 时间：2026-10-20T05:11:54.158Z
- 裁定：worker 启动后中断，日志无后续事件
- 提交：无
- 验收命令：未执行
- 已推送：否
- CI：未查询
- 受保护文件改动行数：0
- 依赖变化：无
- 本段原由 v02-b01 的 worker 补写，内容有误，R2 占位者于 2026-10-20 依 journal 与 git 历史更正

### v01-b05-smoke · r-20261020-060511 · BLOCK

- 时间：2026-10-20T06:05:58.477Z
- 裁定：escalated，no valid report（worker exit 0 但未生成 report.md）
- 提交：无
- 验收命令：未执行
- 已推送：否
- CI：未查询
- 受保护文件改动行数：0
- 依赖变化：无

### v01-b05-smoke · r-20261020-063533 · PASS（事后判定不成立）

- 时间：2026-10-20T07:26:46.799Z
- 裁定：reviewer PASS，规则 9 采用。R2 实测 `npm test` 退出码 1（434 过 / 66 失败，环境变量污染所致），
  当时的规则链无「验收实测失败不得 PASS」一条，故误判；此事催生规则 8
- 提交：`b75aa31`
- 验收命令：由 R2 实测（reviewer 不执行验收，SPEC 4.3）
- 已推送：是
- CI：unknown，监听分支未能取证（rate limited，ci_wait_secs 超时）
- 受保护文件改动行数：0
- 依赖变化：无

### v01-b05-smoke · r-20261020-081526 · FIX

- 时间：2026-10-20T08:55:33.836Z
- 裁定：规则 9，Diff range is empty — worker produced no commits this attempt. Acceptance command 3 explicitly fails. Commands 1 and 2 pass only due to pre-existing state from a prior attempt (b75aa31), not from this batch's worker output.
- 提交：无
- 验收命令：4/5 通过
  - `npm run lint` → exit 0，All matched files use Prettier code style!
  - `npm run typecheck` → exit 0，> tsc -p tsconfig.json
  - `npm test` → exit 0，512 passed, 0 failed
  - `grep -q "第一个批次：v01-b05-smoke" README.md` → exit 0，exit 0
  - `test "$(git diff --name-only HEAD~1 HEAD)" = "README.md"` → exit 1，exit 1
- 已推送：是
- CI：unknown，监听分支未能取证
- 受保护文件改动行数：0
- 依赖变化：无

### v02-b01 · r-20261020-092112 · BLOCK（reviewer 原判 PASS，规则 2 降级）

- 时间：2026-10-20T10:17:00.915Z
- 裁定：规则 2，protected files changed by 33 lines
- 提交：`9962761`
- 验收命令：5/5 通过
  - `npm run lint` → exit 0，All matched files use Prettier code style!
  - `npm run typecheck` → exit 0，> tsc -p tsconfig.json
  - `npm test` → exit 0，525 passed, 0 failed
  - `npm test -- test/ci.test.ts` → exit 0，48 passed, 0 failed
  - `test "$(grep -c 'v01-b05-smoke' docs/progress.md)" -ge 4` → exit 0，exit 0
- 已推送：是
- CI：unknown，监听分支未能取证
- 受保护文件改动行数：33
- 依赖变化：无
- 声称与实测不符：spec_touched

### v02-b02 · r-20261020-124813 · PASS

- 时间：2026-10-20T13:53:46.672Z
- 裁定：规则 9，全部 8 条验收命令实跑通过；3 个提交已推送至 origin/main；受保护文件与依赖零变化；diff 范围落在条目之内；关键实现 soft≠hard、resume 映射、sessionId 保全、heartbeat 生命周期、rescue 逻辑经代码审读确认正确。CI 因环境无 gh 认证未取证（ci_branch_matched=null），交由 arbiter 规则 7 裁定。
- 提交：`f800f19` `42b7722` `1299f3a`
- 验收命令：8/8 通过
  - `npm run lint` → exit 0，All matched files use Prettier code style!
  - `npm run typecheck` → exit 0，> tsc -p tsconfig.json
  - `npm test` → exit 0，554 passed, 0 failed
  - `npm test -- test/scenario-e.test.ts` → exit 0，5 passed, 0 failed
  - `npm test -- test/heartbeat.test.ts` → exit 0，10 passed, 0 failed
  - `git check-ignore -q .collie/heartbeat.json` → exit 0，exit 0
  - `grep -qE "resume" test/runner-claude.test.ts` → exit 0，exit 0
  - `! grep -rlE "@anthropic-ai" src --include='*.ts' | grep -v '^src/runner/'` → exit 0，exit 0
- 已推送：是
- CI：unknown，监听分支未能取证
- 受保护文件改动行数：0
- 依赖变化：无

### v02-b03 · r-20261020-145024 · PASS

- 时间：2026-10-20T16:10:14.277Z
- 裁定：规则 9，全部 8 项验收命令实跑通过（exit 0）；4 个提交在 origin/main 上；无受保护文件修改或依赖变化；interrupt() 正确实现并测试；v0.1 场景不受影响。CI 实际结论因无 GH_TOKEN 未能取证（ci_branch_matched=null），配置正确监听 main。
- 提交：`ba283de` `25fc988` `90857ec` `5b910cb`
- 验收命令：8/8 通过
  - `npm run lint` → exit 0，All matched files use Prettier code style!
  - `npm run typecheck` → exit 0，> tsc -p tsconfig.json
  - `npm test` → exit 0，561 passed, 0 failed
  - `npm test -- test/scenario-g.test.ts` → exit 0，2 passed, 0 failed
  - `npm test -- test/ladder.test.ts` → exit 0，5 passed, 0 failed
  - `npm test -- test/scenario-a.test.ts test/scenario-b.test.ts test/scenario-d.test.ts test/scenario-c.test.ts` → exit 0，20 passed, 0 failed
  - `grep -qE "interrupt\(\)" src/runner/claude.ts && grep -qE "interrupt" test/runner-claude.test.ts` → exit 0，exit 0
  - `! grep -qE "softStopRequested" src/runner/claude.ts` → exit 0，exit 0
- 已推送：是
- CI：unknown，监听分支未能取证
- 受保护文件改动行数：0
- 依赖变化：无

### v02-b04 · r-20261021-025435 · BLOCK

- 时间：2026-10-21T03:16:20.501Z
- 裁定：规则 0，no valid report: /data/workspace/Collie/.collie/batches/v02-b04/report.md: cannot read report: ENOENT: no such file or directory, open '/data/workspace/Collie/.collie/batches/v02-b04/report.md'
- 提交：无
- 验收命令：0/0 通过
- 已推送：否
- CI：unknown，监听分支未能取证
- 受保护文件改动行数：0
- 依赖变化：无

### v02-b04 · r-20261021-060149 · PASS

- 时间：2026-10-21T07:04:20.440Z
- 裁定：规则 9，七条验收命令全部实跑通过，三次连跑稳定；三个条目逐条代码审查确认；无受保护文件、无依赖变化、无范围蔓延、无越界实现。CI 无法查询（无 GH_TOKEN）。
- 提交：`ff0f057`
- 验收命令：7/7 通过
  - `npm run lint` → exit 0，All matched files use Prettier code style!
  - `npm run typecheck` → exit 0，> tsc -p tsconfig.json
  - `npm test` → exit 0，572 passed, 0 failed
  - `npm test && npm test && npm test` → exit 0，572 passed, 0 failed
  - `! grep -qE "toBeLessThan\(2000\)|Date.now" test/scenario-g.test.ts` → exit 0，exit 0
  - `! grep -qE "interrupt\?\." src/runner/claude.ts` → exit 0，exit 0
  - `grep -qE "reviewer" test/heartbeat.test.ts` → exit 0，exit 0
- 已推送：是
- CI：unknown，监听分支未能取证
- 受保护文件改动行数：0
- 依赖变化：无

### v02-b04-tests · r-20261021-112601 · BLOCK

- 时间：2026-10-21T12:18:08.904Z
- 裁定：规则 1，verdict unparseable: /data/workspace/Collie/.collie/batches/v02-b04-tests/verdict.md: json block at line 163 fails the verdict schema: evidence.ci_conclusion: Invalid option: expected one of "success"|"failure"|"cancelled"|"unknown"
- 提交：`2661d0e`
- 验收命令：8/8 通过
  - `npm run lint` → exit 0，All matched files use Prettier code style!
  - `npm run typecheck` → exit 0，> tsc -p tsconfig.json
  - `npm test` → exit 0，574 passed, 0 failed
  - `! grep -qE "setInterval|setTimeout\(" test/scenario-g.test.ts` → exit 0，exit 0
  - `! grep -qE "setInterval|setTimeout\(" test/ladder.test.ts` → exit 0，exit 0
  - `grep -qE "livenessSetTimer" test/scenario-g.test.ts` → exit 0，exit 0
  - `grep -qE "beforeAll" test/reviewer-isolation.test.ts` → exit 0，exit 0
  - `test -z "$(git log --format=%H -n 1 --grep='issue v02-b04-tests' -- .collie/batches/v02-b04-tests/task.md)" || git diff --quiet "$(git log --format=%H -n 1 --grep='issue v02-b04-tests' -- .collie/batches/v02-b04-tests/task.md)"..HEAD -- src/` → exit 0，exit 0
- 已推送：是
- CI：unknown，监听分支未能取证
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：0

### v02-b04-fix · r-20261022-044520 · FIX

- 时间：2026-10-22T06:02:07.521Z
- 裁定：规则 9，All 9 acceptance commands pass, commits pushed, no protected file changes, no dependency changes. FIX because scenario-g.test.ts does not inject fake fingerprint — an explicit item requirement (task description item 3 + SPEC 11.5) that is the core fix target of this batch.
- 提交：`ad7ad75` `857e378` `dbe276b`
- 验收命令：9/9 通过
  - `npm run lint` → exit 0，All matched files use Prettier code style!
  - `npm run typecheck` → exit 0，> tsc -p tsconfig.json
  - `npm test` → exit 0，583 passed, 0 failed
  - `for i in 1 2 3 4 5; do npx vitest run test/scenario-g.test.ts || exit 1; done` → exit 0，3 passed, 0 failed
  - `! grep -qE "= *(resolvedIterable|queryIterable)\??\.interrupt;" src/runner/claude.ts` → exit 0，exit 0
  - `grep -qE "binds this" test/runner-claude.test.ts` → exit 0，exit 0
  - `grep -qE "unhandledRejection" src/run.ts src/cli.ts` → exit 0，exit 0
  - `grep -qE "fingerprint\?:" src/ladder.ts && grep -qE "diff" src/ladder.ts` → exit 0，exit 0
  - `! grep -rlE "@anthropic-ai" src --include='*.ts' | grep -v '^src/runner/'` → exit 0，exit 0
- 已推送：是
- CI：unknown，监听分支未能取证
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：0

### v02-b04-fix · r-20261022-062718 · PASS

- 时间：2026-10-22T07:41:51.655Z
- 裁定：规则 9，全部 10 条验收命令实跑通过，三个条目的具体实现要求逐条核对均有代码证据，head_sha 已在 origin/main，无受保护文件改动，无依赖变化，diff 范围在条目 3 之内
- 提交：`6fe4d74`
- 验收命令：10/10 通过
  - `npm run lint` → exit 0，All matched files use Prettier code style!
  - `npm run typecheck` → exit 0，> tsc -p tsconfig.json
  - `npm test` → exit 0，583 passed, 0 failed
  - `for i in 1 2 3 4 5; do npx vitest run test/scenario-g.test.ts || exit 1; done` → exit 0，3 passed, 0 failed
  - `! grep -qE "= *(resolvedIterable|queryIterable)\??\.interrupt;" src/runner/claude.ts` → exit 0，exit 0
  - `grep -qE "binds this" test/runner-claude.test.ts` → exit 0，exit 0
  - `grep -qE "unhandledRejection" src/run.ts src/cli.ts` → exit 0，exit 0
  - `grep -qE "fingerprint\?:" src/ladder.ts && grep -qE "diff" src/ladder.ts` → exit 0，exit 0
  - `test "$(grep -cE "livenessFingerprint" test/scenario-g.test.ts)" -ge 2` → exit 0，exit 0
  - `! grep -rlE "@anthropic-ai" src --include='*.ts' | grep -v '^src/runner/'` → exit 0，exit 0
- 已推送：是
- CI：unknown，监听分支未能取证
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：0

### v02-b04-fix2 · r-20261022-082259 · PASS

- 时间：2026-10-22T09:23:29.439Z
- 裁定：规则 9，十条验收命令全部实跑 exit 0；三个提交已推送至 origin/main；无受保护文件变更；无依赖变更；条目要求逐条核对满足；额外禁止全部遵守。CI 无法查询（环境无 GH_TOKEN），记为 unknown。
- 提交：`145f139` `95c8acb` `43ed35c`
- 验收命令：10/10 通过
  - `npm run lint` → exit 0，All matched files use Prettier code style!
  - `npm run typecheck` → exit 0，> tsc -p tsconfig.json
  - `npm test` → exit 0，601 passed, 0 failed
  - `test "$(grep -cE "^\s*it\(" test/invariants.test.ts)" -ge 6` → exit 0，exit 0
  - `! grep -qE "setInterval|setTimeout\(" test/scenario-g.test.ts` → exit 0，exit 0
  - `grep -qE "token_file" src/schema/index.ts && grep -qE "token_file" src/evidence.ts` → exit 0，exit 0
  - `grep -qE "GITHUB_TOKEN" test/runner-claude.test.ts && grep -qE "GH_TOKEN" src/runner/claude.ts` → exit 0，exit 0
  - `grep -qE "github-token" .gitignore && grep -qE "github-token" src/cli.ts` → exit 0，exit 0
  - `grep -qE "unauthenticated.*rate.?limit.*(no wait|without waiting|immediately)" test/ci.test.ts` → exit 0，exit 0
  - `! grep -rlE "@anthropic-ai" src --include='*.ts' | grep -v '^src/runner/'` → exit 0，exit 0
- 已推送：是
- CI：unknown，监听分支未能取证
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：0

### v02-b04-fix3 · r-20261022-102856 · PASS

- 时间：2026-10-22T10:57:15.423Z
- 裁定：规则 9，All 8 acceptance commands pass. Three items verified at code level: spawnClaudeCodeProcess hook captures pid, lazy interrupt throws when SDK has no interrupt, heartbeat uses atomic writes. No protected files changed, no dependency changes, no tests removed. CI not verifiable (no GH_TOKEN).
- 提交：`ab4752b`
- 验收命令：8/8 通过
  - `npm run lint` → exit 0，All matched files use Prettier code style!
  - `npm run typecheck` → exit 0，> tsc -p tsconfig.json
  - `npm test` → exit 0，610 passed, 0 failed
  - `grep -qE "renameSync" src/heartbeat.ts && ! grep -qE "writeFileSync\(path," src/heartbeat.ts` → exit 0，exit 0
  - `grep -ciE "no interrupt|without interrupt|missing interrupt" test/runner-claude.test.ts | grep -qvE "^0$"` → exit 0，exit 0
  - `grep -qE "spawnClaudeCodeProcess" src/runner/claude.ts && grep -qE "spawnClaudeCodeProcess" test/runner-claude.test.ts` → exit 0，exit 0
  - `grep -qE "renameSync|spawnClaudeCodeProcess" test/invariants.test.ts` → exit 0，exit 0
  - `! grep -rlE "@anthropic-ai|spawnClaudeCodeProcess" src --include='*.ts' | grep -v '^src/runner/'` → exit 0，exit 0
- 已推送：是
- CI：success，监听分支一致，https://github.com/CIPFZ/Collie/actions/runs/39765258578
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：0

### v02-b05 · r-20261022-111044 · BLOCK

- 时间：2026-10-22T11:10:45.137Z
- 裁定：规则 0，worker crashed: Cannot read properties of undefined (reading 'env')
- 提交：无
- 验收命令：0/0 通过
- 已推送：否
- CI：unknown，监听分支未能取证
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：1（error）

### v02-b04-fix4 · r-20261022-114309 · BLOCK

- 时间：2026-10-22T12:35:36.726Z
- 裁定：规则 1，verdict unparseable: /data/workspace/Collie/.collie/batches/v02-b04-fix4/verdict.md: json block at line 218 fails the verdict schema: evidence.commits_actual.0: invalid git sha; evidence.commits_actual.1: invalid git sha
- 提交：`8170a3d` `1bd1ac5`
- 验收命令：9/9 通过
  - `npm run lint` → exit 0，All matched files use Prettier code style!
  - `npm run typecheck` → exit 0，> tsc -p tsconfig.json
  - `npm test` → exit 0，616 passed, 0 failed
  - `! grep -qE "spawnClaudeCodeProcess\?: \($" src/runner/claude.ts && ! grep -qE "command: string,$" src/runner/claude.ts` → exit 0，exit 0
  - `grep -qE "import type .* from '@anthropic-ai/claude-agent-sdk'" src/runner/claude.ts && ! grep -qE "interface SpawnHook" src/runner/claude.ts` → exit 0，exit 0
  - `grep -qE "claude-agent-sdk" test/invariants.test.ts` → exit 0，exit 0
  - `grep -qE "spawnClaudeCodeProcess\(\{" test/runner-claude.test.ts || grep -qE "spawnClaudeCodeProcess\?\.\(\{" test/runner-claude.test.ts` → exit 0，exit 0
  - `grep -qE "'smoke'" src/cli.ts && grep -qE "smoke" test/cli.test.ts` → exit 0，exit 0
  - `! grep -rlE "@anthropic-ai|spawnClaudeCodeProcess" src --include='*.ts' | grep -v '^src/runner/'` → exit 0，exit 0
- 已推送：是
- CI：success，监听分支一致，https://github.com/CIPFZ/Collie/actions/runs/39774870884
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：0

### v02-b05 · r-20261022-161827 · PASS

- 时间：2026-10-22T16:56:26.047Z
- 裁定：规则 9，全部 10 条验收命令退出码 0；635 测试全绿；三条目实现完整并有测试覆盖；受保护路径零改动；无新增依赖。CI 以 R2 取证为准。
- 提交：`d6c824a` `527f880`
- 验收命令：10/10 通过
  - `npm run lint` → exit 0，All matched files use Prettier code style!
  - `npm run typecheck` → exit 0，> tsc -p tsconfig.json
  - `npm test` → exit 0，635 passed, 0 failed
  - `npm test -- test/scenario-e.test.ts` → exit 0，8 passed, 0 failed
  - `npm test -- test/scenario-f.test.ts` → exit 0，4 passed, 0 failed
  - `npm test -- test/show.test.ts` → exit 0，5 passed, 0 failed
  - `grep -qE "ci\.resolved" src/schema/index.ts && grep -qE "ci\.resolved" src/run.ts && grep -qE "ci\.resolved" test/invariants.test.ts` → exit 0，exit 0
  - `grep -qE "resume_max" test/scenario-f.test.ts` → exit 0，exit 0
  - `grep -qE "base_sha" test/scenario-e.test.ts` → exit 0，exit 0
  - `grep -qE "rev-parse|revParse" src/evidence.ts && grep -qE "no_runs" test/ci.test.ts && grep -qiE "short sha|expands" test/ci.test.ts test/evidence.test.ts` → exit 0，exit 0
- 已推送：否
- CI：unknown，监听分支不一致
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：0

### v02-b05-fix · r-20261023-060802 · PASS

- 时间：2026-10-23T06:28:08.644Z
- 裁定：规则 9，三个条目全部满足，全部验收命令通过，无受保护文件修改，无依赖变化。CI 以 R2 取证为准。
- 提交：`34134d0`
- 验收命令：8/8 通过
  - `npm run lint` → exit 0，All matched files use Prettier code style!
  - `npm run typecheck` → exit 0，> tsc -p tsconfig.json
  - `npm test` → exit 0，647 passed, 0 failed
  - `grep -qE "RULE_DEFAULT = 10" src/arbiter.ts && grep -qE "remote_has_head: false" test/arbiter.test.ts` → exit 0，exit 0
  - `grep -qE "onPid" src/runner/index.ts && grep -qE "onPid" src/runner/claude.ts && grep -qE "onPid" src/run.ts` → exit 0，exit 0
  - `grep -qE "onPid" test/runner-claude.test.ts` → exit 0，exit 0
  - `grep -qE "remote_has_head" test/evidence.test.ts && grep -qE "toBeNull" test/evidence.test.ts` → exit 0，exit 0
  - `grep -qE "RULE_DEFAULT" test/invariants.test.ts` → exit 0，exit 0
- 已推送：是
- CI：success，监听分支一致，https://github.com/CIPFZ/Collie/actions/runs/39910961845
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：0

### v02-e-drill · r-20261023-083500 · PASS

- 时间：2026-10-23T08:46:44.609Z
- 裁定：规则 10，7/7 验收实跑通过，654 测试全过，提交已推送，无受保护文件变动，无依赖变化。CI 以 R2 取证为准（无 GitHub 凭据）。三条条目实现逐行核对正确，额外禁止三条均满足。场景 E 演练批次：attempt 1 完成条目 1-2 后被中断，attempt 2 完成条目 3，最终状态完整。
- 提交：`6317361`
- 验收命令：7/7 通过
  - `npm run lint` → exit 0，All matched files use Prettier code style!
  - `npm run typecheck` → exit 0，> tsc -p tsconfig.json
  - `npm test` → exit 0，654 passed, 0 failed
  - `grep -qE "redact" src/runner/index.ts && grep -qE "redact" src/runner/claude.ts && grep -qE "redact" src/run.ts` → exit 0，exit 0
  - `grep -qE "redact" test/runner-claude.test.ts && grep -qE "\*\*\*" test/runner-claude.test.ts` → exit 0，exit 0
  - `grep -qE "redact" test/invariants.test.ts` → exit 0，exit 0
  - `grep -qE "maxRetries" test/support/sandbox.ts && grep -qE "auto = 0" test/support/sandbox.ts` → exit 0，exit 0
- 已推送：是
- CI：success，监听分支一致，https://github.com/CIPFZ/Collie/actions/runs/39926111572
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：0

### v02-e-fix · r-20261025-083535 · PASS

- 时间：2026-10-25T09:13:10.873Z
- 裁定：规则 10，All 8 acceptance commands pass (exit code 0). All three items fully implemented with tests. Commits pushed to origin/main. No protected files modified, no dependency changes. CI unavailable (no GH credentials) — ci_conclusion: unknown, CI 以 R2 取证为准.
- 提交：`e67a2f6` `6d777f6`
- 验收命令：8/8 通过
  - `npm run lint` → exit 0，All matched files use Prettier code style!
  - `npm run typecheck` → exit 0，> tsc -p tsconfig.json
  - `npm test` → exit 0，670 passed, 0 failed
  - `npm test -- test/scenario-e.test.ts` → exit 0，13 passed, 0 failed
  - `grep -qE "detached: true" src/runner/claude.ts && grep -qE "guard_pid" src/heartbeat.ts && grep -qiE "parent.*(killed|dies|SIGKILL)" test/runner-claude.test.ts test/guard.test.ts` → exit 0，exit 0
  - `! grep -qE "baseSha: taskSha" src/run.ts && grep -qE "commits_actual" test/scenario-e.test.ts` → exit 0，exit 0
  - `grep -qE "orphaned" test/scenario-e.test.ts && grep -qE "stream\.ndjson|appendStream|readStream" src/run.ts` → exit 0，exit 0
  - `grep -qE "detached: true|baseSha: taskSha" test/invariants.test.ts` → exit 0，exit 0
- 已推送：是
- CI：success，监听分支一致，https://github.com/CIPFZ/Collie/actions/runs/40179384604
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：0

### v02-e-drill2 · r-20261026-025925 · PASS

- 时间：2026-10-26T03:12:54.654Z
- 裁定：规则 10，五项验收全部实跑通过，三条目逐条核对有据，受保护文件零改动，无依赖变化，无范围蔓延。CI 以 R2 取证为准。
- 提交：`be95a2e` `6158611` `69f6922` `fa469de` `b076c7b`
- 验收命令：5/5 通过
  - `npm run lint` → exit 0，All matched files use Prettier code style!
  - `npm run typecheck` → exit 0，> tsc -p tsconfig.json
  - `npm test` → exit 0，672 passed, 0 failed
  - `grep -qE "中断链" src/cli.ts && grep -qE "中断链" test/show.test.ts` → exit 0，exit 0
  - `grep -qE "^## .*中断与恢复" README.md` → exit 0，exit 0
- 已推送：是
- CI：success，监听分支一致，https://github.com/CIPFZ/Collie/actions/runs/40262228514
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：0

### v02-e-fix2 · r-20261026-035021 · PASS

- 时间：2026-10-26T04:17:41.750Z
- 裁定：规则 10，7/7 acceptance commands pass, 677 tests pass, no protected file changes, no dependency changes, all three task items implemented correctly with proper test coverage. CI unavailable — CI 以 R2 取证为准。
- 提交：`1687021` `43e22ec`
- 验收命令：7/7 通过
  - `npm run lint` → exit 0，All matched files use Prettier code style!
  - `npm run typecheck` → exit 0，> tsc -p tsconfig.json
  - `npm test` → exit 0，677 passed, 0 failed
  - `npm test -- test/scenario-e.test.ts` → exit 0，15 passed, 0 failed
  - `grep -qE "rescue_sha" test/scenario-e.test.ts && grep -qE "请先核实" test/scenario-e.test.ts` → exit 0，exit 0
  - `grep -qE "interrupted_at" test/scenario-e.test.ts && grep -qE "toBeTruthy|toHaveLength|toMatch" test/scenario-e.test.ts && grep -qE "tool_use" src/run.ts` → exit 0，exit 0
  - `grep -qE "请先核实|rescue_sha" test/invariants.test.ts` → exit 0，exit 0
- 已推送：是
- CI：success，监听分支一致，https://github.com/CIPFZ/Collie/actions/runs/40267746580
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：0

### v03-b01 · r-20261026-045805 · PASS

- 时间：2026-10-26T05:26:46.675Z
- 裁定：规则 10，全部 9 项验收命令 exit 0。35 test files / 695 tests 全通过。三个条目（R2 推送裁定提交与启动核查、reviewer 事件流落盘、场景 H）的结构要求与行为要求逐条核对均满足。受保护路径零变动，无新增依赖，四条额外禁止均满足。提交已推送远端（head_sha 是 remote main 的祖先）。CI 以 R2 取证为准。
- 提交：`e930a18` `5101f67` `49a3181` `7f876e8`
- 验收命令：9/9 通过
  - `npm run lint` → exit 0，All matched files use Prettier code style!
  - `npm run typecheck` → exit 0，> tsc -p tsconfig.json
  - `npm test` → exit 0，695 passed, 0 failed
  - `npm test -- test/scenario-h.test.ts` → exit 0，4 passed, 0 failed
  - `grep -qE "verdict\.pushed" src/schema/index.ts && grep -qE "verdict\.push_failed" src/schema/index.ts && grep -qE "ci\.verdict_commit" src/schema/index.ts` → exit 0，exit 0
  - `grep -qE "export async function push\(" src/git.ts && grep -qE "verdict\.push_failed" src/run.ts` → exit 0，exit 0
  - `grep -qE "previous verdict commit" src/run.ts && grep -qE "previous verdict commit" test/*.test.ts` → exit 0，exit 0
  - `grep -qE "reviewer\.stream\.ndjson" src/run.ts && grep -qE "reviewer\.stream\.ndjson" test/*.test.ts` → exit 0，exit 0
  - `grep -qE "scenario-h" test/invariants.test.ts` → exit 0，exit 0
- 已推送：是
- CI：success，监听分支一致，https://github.com/CIPFZ/Collie/actions/runs/40273523628
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：0

### v03-b01-fix · r-20261026-082249 · PASS

- 时间：2026-10-26T08:50:36.483Z
- 裁定：规则 10，全部 7 条验收命令实跑通过；3 个条目的代码实现与测试覆盖逐条核对满足；受保护文件与依赖无变化；额外禁止逐条满足。CI 以 R2 取证为准。
- 提交：`6a96607` `1832377` `9faa3d0` `13a5cee`
- 验收命令：7/7 通过
  - `npm run lint` → exit 0，All matched files use Prettier code style!
  - `npm run typecheck` → exit 0，> tsc -p tsconfig.json
  - `npm test` → exit 0，702 passed, 0 failed
  - `for i in 1 2 3; do npx vitest run test/scenario-f.test.ts || exit 1; done` → exit 0，4 passed, 0 failed
  - `grep -qE "push_skipped" src/run.ts && grep -qE "push_skipped" src/schema/index.ts && grep -cE "await push\(" src/run.ts | grep -qE "^[1-3]$"` → exit 0，exit 0
  - `grep -qE "worker\.rescued" test/scenario-*.test.ts && grep -qE "push_skipped" test/scenario-*.test.ts` → exit 0，exit 0
  - `grep -qE "push_skipped|await push" test/invariants.test.ts` → exit 0，exit 0
- 已推送：是
- CI：success，监听分支一致，https://github.com/CIPFZ/Collie/actions/runs/40294162377
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：0

### v03-b02 · r-20261026-091509 · PASS

- 时间：2026-10-26T10:05:39.440Z
- 裁定：规则 10，All 10 acceptance commands pass. 724 tests pass across 36 files. 4 commits exist and are pushed (ancestor of remote main). No protected files modified, no dependency changes. All 3 task items verified structurally and behaviorally. All 4 extra prohibitions confirmed intact. CI evidence deferred to R2 (no GitHub credentials).
- 提交：`075d516` `f010b23` `8f36e86` `f26a67b`
- 验收命令：10/10 通过
  - `npm run lint` → exit 0，All matched files use Prettier code style!
  - `npm run typecheck` → exit 0，> tsc -p tsconfig.json
  - `npm test` → exit 0，724 passed, 0 failed
  - `grep -qE "^\s+tools: \[" src/runner/claude.ts && grep -qE "disallowedTools" src/runner/claude.ts` → exit 0，exit 0
  - `grep -qE "options\.tools|\.tools\)" test/runner-claude.test.ts && grep -qE "disallowedTools" test/runner-claude.test.ts` → exit 0，exit 0
  - `grep -qE "bash_deny" src/schema/index.ts && grep -qE "PreToolUse" src/runner/claude.ts && grep -qE "tool\.denied" src/runner/claude.ts` → exit 0，exit 0
  - `grep -qE "PreToolUse" test/runner-claude.test.ts && grep -qE "git push" test/runner-claude.test.ts` → exit 0，exit 0
  - `grep -qE "'audit'" src/cli.ts && grep -qE "audit" test/cli.test.ts` → exit 0，exit 0
  - `grep -qE "disallowedTools" test/invariants.test.ts` → exit 0，exit 0
  - `! grep -rlE "@anthropic-ai|PreToolUse" src --include='*.ts' | grep -v '^src/runner/'` → exit 0，exit 0
- 已推送：是
- CI：success，监听分支一致，https://github.com/CIPFZ/Collie/actions/runs/40303620657
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：0

### v03-b03 · r-20261026-114631 · BLOCK

- 时间：2026-10-26T12:31:36.082Z
- 裁定：上报：无 report — no valid report: /data/workspace/Collie/.collie/batches/v03-b03/report.md: cannot read report: ENOENT: no such file or directory, open '/data/workspace/Collie/.collie/batches/v03-b03/report.md'
- 提交：`8a3bd3a` `c62deb2` `09f229c`
- 验收命令：0/0 通过
- 已推送：是
- CI：unknown，监听分支未能取证
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：1（error）

### v03-b03 · r-20261026-141212 · BLOCK

- 时间：2026-10-26T14:14:58.476Z
- 裁定：上报：无 report — report head_sha 09f229ce508b6083d0fd96888f01ad09c59861bd does not descend from the task commit 67d74f63a1110319daccc07e10d9bf715e93382a
- 提交：`8a3bd3a` `c62deb2` `09f229c` `2ae7c51` `1864207` `357e110` `d5fef6e` `67d74f6` `d5d3b06`
- 验收命令：0/0 通过
- 已推送：是
- CI：unknown，监听分支未能取证
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：0

### v03-b03-fix · r-20261026-161002 · FIX

- 时间：2026-10-26T16:51:58.396Z
- 裁定：规则 10，9/10 验收命令通过，#6 因 grep 模式与实际测试代码的标识符大小写不匹配而失败。功能实现正确（5/5 scenario-f tests passed），仅需微调测试文本以满足 grep 验收。CI 以 R2 取证为准。
- 提交：`3f722dc` `2196fc6`
- 验收命令：9/10 通过
  - `npm run lint` → exit 0，All matched files use Prettier code style!
  - `npm run typecheck` → exit 0，> tsc -p tsconfig.json
  - `npm test` → exit 0，750 passed, 0 failed
  - `! grep -qE "does not descend from the task commit" src/run.ts && grep -qE "commits_actual" test/scenario-*.test.ts` → exit 0，exit 0
  - `grep -qE "report\(collie\)" src/evidence.ts && grep -qE "progress: " src/evidence.ts` → exit 0，exit 0
  - `grep -qE "session_id.*null|sessionId.*undefined" test/scenario-f.test.ts` → exit 1，exit 1
  - `grep -qE "sdk_stop_reason" src/run.ts && grep -qE "wallclock" test/scenario-*.test.ts` → exit 0，exit 0
  - `! grep -qE "rule 0" src/cli.ts && grep -qE "rule 0" test/cli.test.ts` → exit 0，exit 0
  - `grep -qE "nothing to audit" src/cli.ts && grep -qE "nothing to audit" test/cli.test.ts` → exit 0，exit 0
  - `grep -qE "rule 0|sdk_stop_reason" test/invariants.test.ts && grep -qE "report\(collie\)" test/invariants.test.ts` → exit 0，exit 0
- 已推送：是
- CI：success，监听分支一致，https://github.com/CIPFZ/Collie/actions/runs/40360846576
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：0

### v03-b03-fix2 · r-20261027-033610 · PASS

- 时间：2026-10-27T03:53:26.842Z
- 裁定：规则 10，全部 10 条验收命令实跑通过，三轮稳定性测试 765×3 全绿，三个条目的代码实现与测试逐条核对均满足，commits 已推送至远端，无受保护文件改动，无依赖变化。CI 以 R2 取证为准。
- 提交：`1e00841`
- 验收命令：10/10 通过
  - `npm run lint` → exit 0，All matched files use Prettier code style!
  - `npm run typecheck` → exit 0，> tsc -p tsconfig.json
  - `npm test` → exit 0，765 passed, 0 failed
  - `for i in 1 2 3; do npm test || exit 1; done` → exit 0，765 passed, 0 failed
  - `grep -cE "not\.toContain" test/scenario-e.test.ts | grep -qE "^([5-9]|[1-9][0-9])$"` → exit 0，exit 0
  - `grep -qiE "session_id.{0,40}null" test/scenario-f.test.ts` → exit 0，exit 0
  - `grep -qE "merge-base" test/runner-claude.test.ts && grep -qE "branch -D" test/runner-claude.test.ts` → exit 0，exit 0
  - `grep -qE "tool\.denied" src/run.ts && grep -qE "tool\.denied" test/*.test.ts` → exit 0，exit 0
  - `grep -qE "testTimeout: 30_?000" vitest.config.ts` → exit 0，exit 0
  - `grep -qE "tool\.denied|testTimeout" test/invariants.test.ts` → exit 0，exit 0
- 已推送：是
- CI：success，监听分支一致，https://github.com/CIPFZ/Collie/actions/runs/40446051606
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：0

### v03-b04 · r-20261027051508 · FIX

- 时间：2026-10-27T05:55:49.464Z
- 裁定：规则 10，验收命令 #6 实跑失败（exit 1）。src/gate.ts 确为纯函数（零 import），但行 3 注释含 'runner' 触发 grep。全部测试和其余 10 条验收命令均通过。CI 以 R2 取证为准。
- 提交：`8beae0d`
- 验收命令：10/11 通过
  - `npm run lint` → exit 0，All matched files use Prettier code style!
  - `npm run typecheck` → exit 0，> tsc -p tsconfig.json
  - `npm test` → exit 0，792 passed, 0 failed
  - `npm test -- test/scenario-l.test.ts` → exit 0，10 passed, 0 failed
  - `grep -qE "queue\.paused" src/schema/index.ts && grep -qE "batch\.retried" src/schema/index.ts` → exit 0，exit 0
  - `grep -qE "export function gateDecision" src/gate.ts && ! grep -qE "runner|run\.js" src/gate.ts` → exit 1，exit 1
  - `grep -qE "\b30\b" src/cli.ts && grep -qE "\b30\b" test/scenario-l.test.ts` → exit 0，exit 0
  - `grep -qE "batch\.retried" src/run.ts && grep -qE "fix_max" test/scenario-l.test.ts` → exit 0，exit 0
  - `grep -qE "rule9_twice" src/run.ts && grep -qE "rule9_twice" test/scenario-l.test.ts` → exit 0，exit 0
  - `grep -cE "^\s+it\(" test/gate.test.ts | grep -qE "^([7-9]|[1-9][0-9])$"` → exit 0，exit 0
  - `grep -qE "gate\.ts|scenario-l" test/invariants.test.ts` → exit 0，exit 0
- 已推送：是
- CI：success，监听分支一致，https://github.com/CIPFZ/Collie/actions/runs/40457254848
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：0

### v03-b04 · r-20261027055553 · PASS

- 时间：2026-10-27T06:05:46.956Z
- 裁定：规则 10，全部 11 条验收命令实跑通过，三个条目结构和行为要求均满足，额外禁止无违反，提交已推送。CI 以 R2 取证为准。
- 提交：`8beae0d` `d416710`
- 验收命令：11/11 通过
  - `npm run lint` → exit 0，All matched files use Prettier code style!
  - `npm run typecheck` → exit 0，> tsc -p tsconfig.json
  - `npm test` → exit 0，792 passed, 0 failed
  - `npm test -- test/scenario-l.test.ts` → exit 0，10 passed, 0 failed
  - `grep -qE "queue\.paused" src/schema/index.ts && grep -qE "batch\.retried" src/schema/index.ts` → exit 0，exit 0
  - `grep -qE "export function gateDecision" src/gate.ts && ! grep -qE "runner|run\.js" src/gate.ts` → exit 0，exit 0
  - `grep -qE "\b30\b" src/cli.ts && grep -qE "\b30\b" test/scenario-l.test.ts` → exit 0，exit 0
  - `grep -qE "batch\.retried" src/run.ts && grep -qE "fix_max" test/scenario-l.test.ts` → exit 0，exit 0
  - `grep -qE "rule9_twice" src/run.ts && grep -qE "rule9_twice" test/scenario-l.test.ts` → exit 0，exit 0
  - `grep -cE "^\s+it\(" test/gate.test.ts | grep -qE "^([7-9]|[1-9][0-9])$"` → exit 0，exit 0
  - `grep -qE "gate\.ts|scenario-l" test/invariants.test.ts` → exit 0，exit 0
- 已推送：是
- CI：success，监听分支一致，https://github.com/CIPFZ/Collie/actions/runs/40458356938
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：0

### v03-b04-fix · r-20261027090540 · PASS

- 时间：2026-10-27T09:49:56.521Z
- 裁定：规则 10，All 8 acceptance commands pass (exit 0). Scenario-j groups 4 & 5 verify FIX rerun task semantics and per-queue fix_max counting behaviorally. No protected files changed, no dependency changes, no scope creep. CI 以 R2 取证为准。
- 提交：`ebc4154`
- 验收命令：8/8 通过
  - `npm run lint` → exit 0，All matched files use Prettier code style!
  - `npm run typecheck` → exit 0，> tsc -p tsconfig.json
  - `npm test` → exit 0，801 passed, 0 failed
  - `grep -qE "上一轮判 FIX" src/run.ts && grep -qE "上一轮判 FIX" test/scenario-*.test.ts` → exit 0，exit 0
  - `! grep -v '^\s*//' src/run.ts | grep -qE "countBatchFinished" && grep -qE "escalated" test/scenario-*.test.ts` → exit 0，exit 0
  - `grep -qE "queue\.batch_started" src/schema/index.ts && grep -qE "fix_retry" src/run.ts` → exit 0，exit 0
  - `grep -qE "\-\-queue" src/cli.ts && grep -qE "\-\-queue" test/cli.test.ts` → exit 0，grep: warning: stray \ before -
  - `grep -qE "queue\.batch_started" test/invariants.test.ts` → exit 0，exit 0
- 已推送：是
- CI：success，监听分支一致，https://github.com/CIPFZ/Collie/actions/runs/40482985905
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：0

### v04-b01 · r-20261110151133 · FIX（reviewer 原判 PASS，规则 9 降级）

- 时间：2026-11-10T15:36:33.554Z
- 裁定：规则 9，ci_conclusion=unknown, ci_branch_matched=null
- 提交：`7600a4c` `89288a6` `e0dcdcf`
- 验收命令：10/10 通过
  - `npm run lint` → exit 0，All matched files use Prettier code style!
  - `npm run typecheck` → exit 0，> tsc -p tsconfig.json
  - `npm test` → exit 0，826 passed, 0 failed
  - `! cat src/gate.ts src/run.ts test/gate.test.ts | grep -vE "^\s*(//|\*|/\*)" | grep -qE "protectedDiffLines"` → exit 0，exit 0
  - `! grep -qE "实现未开始|25 条" README.md && grep -qE "26 条" README.md` → exit 0，exit 0
  - `npm test -- test/journal-fields.test.ts` → exit 0，9 passed, 0 failed
  - `grep -cE "^\s+it\(" test/journal-fields.test.ts | grep -qE "^([6-9]|[1-9][0-9])$"` → exit 0，exit 0
  - `grep -qE "reviewer\.finished" src/schema/index.ts && grep -qE "evidence\.collected" src/schema/index.ts` → exit 0，exit 0
  - `grep -qE "total_cost_usd" src/runner/claude.ts && grep -qE "total_cost_usd" test/runner-claude.test.ts` → exit 0，exit 0
  - `grep -qE "evidence\.collected" test/invariants.test.ts` → exit 0，exit 0
- 已推送：是
- CI：unknown，监听分支未能取证
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：0

### v04-b01 · r-20261110153637 · FIX（reviewer 原判 PASS，规则 9 降级）

- 时间：2026-11-10T15:45:57.536Z
- 裁定：规则 9，ci_conclusion=unknown, ci_branch_matched=null
- 提交：`7600a4c` `89288a6` `e0dcdcf`
- 验收命令：10/10 通过
  - `npm run lint` → exit 0，All matched files use Prettier code style!
  - `npm run typecheck` → exit 0，> tsc -p tsconfig.json
  - `npm test` → exit 0，826 passed, 0 failed
  - `! cat src/gate.ts src/run.ts test/gate.test.ts | grep -vE "^\s*(//|\*|/\*)" | grep -qE "protectedDiffLines"` → exit 0，exit 0
  - `! grep -qE "实现未开始|25 条" README.md && grep -qE "26 条" README.md` → exit 0，exit 0
  - `npm test -- test/journal-fields.test.ts` → exit 0，9 passed, 0 failed
  - `grep -cE "^\s+it\(" test/journal-fields.test.ts | grep -qE "^([6-9]|[1-9][0-9])$"` → exit 0，exit 0
  - `grep -qE "reviewer\.finished" src/schema/index.ts && grep -qE "evidence\.collected" src/schema/index.ts` → exit 0，exit 0
  - `grep -qE "total_cost_usd" src/runner/claude.ts && grep -qE "total_cost_usd" test/runner-claude.test.ts` → exit 0，exit 0
  - `grep -qE "evidence\.collected" test/invariants.test.ts` → exit 0，exit 0
- 已推送：是
- CI：unknown，监听分支未能取证
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：0

### v04-b01 · r-20261110154601 · FIX（reviewer 原判 PASS，规则 9 降级）

- 时间：2026-11-10T15:54:35.908Z
- 裁定：规则 9，ci_conclusion=unknown, ci_branch_matched=null
- 提交：`7600a4c` `89288a6` `e0dcdcf`
- 验收命令：10/10 通过
  - `npm run lint` → exit 0，All matched files use Prettier code style!
  - `npm run typecheck` → exit 0，> tsc -p tsconfig.json
  - `npm test` → exit 0，826 passed, 0 failed
  - `! cat src/gate.ts src/run.ts test/gate.test.ts | grep -vE "^\s*(//|\*|/\*)" | grep -qE "protectedDiffLines"` → exit 0，exit 0
  - `! grep -qE "实现未开始|25 条" README.md && grep -qE "26 条" README.md` → exit 0，exit 0
  - `npm test -- test/journal-fields.test.ts` → exit 0，9 passed, 0 failed
  - `grep -cE "^\s+it\(" test/journal-fields.test.ts | grep -qE "^([6-9]|[1-9][0-9])$"` → exit 0，exit 0
  - `grep -qE "reviewer\.finished" src/schema/index.ts && grep -qE "evidence\.collected" src/schema/index.ts` → exit 0，exit 0
  - `grep -qE "total_cost_usd" src/runner/claude.ts && grep -qE "total_cost_usd" test/runner-claude.test.ts` → exit 0，exit 0
  - `grep -qE "evidence\.collected" test/invariants.test.ts` → exit 0，exit 0
- 已推送：是
- CI：unknown，监听分支未能取证
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：0

### v04-b02 · r-20261111051219 · FIX

- 时间：2026-11-11T05:33:31.442Z
- 裁定：规则 10，11 条验收命令中第 9 条（status --json 输出合法 JSON）失败：无 journal 时 --json 仍输出纯文本。其余 10 条全部通过。CI 以 R2 取证为准。
- 提交：`23da11e`
- 验收命令：10/11 通过
  - `npm run lint` → exit 0，All matched files use Prettier code style!
  - `npm run typecheck` → exit 0，> tsc -p tsconfig.json
  - `npm test` → exit 0，846 passed, 0 failed
  - `npm test -- test/view.test.ts` → exit 0，15 passed, 0 failed
  - `grep -cE "^\s+it\(" test/view.test.ts | grep -qE "^([8-9]|[1-9][0-9])$"` → exit 0，exit 0
  - `test -f src/view.ts && ! grep -qE "from '\./(run|runner|roles)[./]" src/view.ts` → exit 0，exit 0
  - `grep -qE "unreadable" src/view.ts && grep -qE "unreadable" test/view.test.ts` → exit 0，exit 0
  - `npx tsx src/cli.ts status` → exit 0，no runs recorded
  - `npx tsx src/cli.ts status --json | node -e "JSON.parse(require('fs').readFileSync(0,'utf8'))"` → exit 1，Node.js v22.23.2
  - `grep -qE "view\.ts" test/invariants.test.ts` → exit 0，exit 0
  - `grep -vE "^\s*(//|\*|/\*)" vitest.config.ts | grep -qE "hookTimeout"` → exit 0，exit 0
- 已推送：是
- CI：success，监听分支一致，https://github.com/CIPFZ/Collie/actions/runs/42965833013
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：0

### v04-b02 · r-20261111053335 · PASS

- 时间：2026-11-11T05:42:26.622Z
- 裁定：规则 10，11/11 验收命令通过，三条目功能与结构要求全部满足，额外禁止无违反，worker 提交已推送。CI 以 R2 取证为准。
- 提交：`23da11e` `4278c4b`
- 验收命令：11/11 通过
  - `npm run lint` → exit 0，All matched files use Prettier code style!
  - `npm run typecheck` → exit 0，> tsc -p tsconfig.json
  - `npm test` → exit 0，846 passed, 0 failed
  - `npm test -- test/view.test.ts` → exit 0，15 passed, 0 failed
  - `grep -cE "^\s+it\(" test/view.test.ts | grep -qE "^([8-9]|[1-9][0-9])$"` → exit 0，exit 0
  - `test -f src/view.ts && ! grep -qE "from '\./(run|runner|roles)[./]" src/view.ts` → exit 0，exit 0
  - `grep -qE "unreadable" src/view.ts && grep -qE "unreadable" test/view.test.ts` → exit 0，exit 0
  - `npx tsx src/cli.ts status` → exit 0，no runs recorded
  - `npx tsx src/cli.ts status --json | node -e "JSON.parse(require('fs').readFileSync(0,'utf8'))"` → exit 0，exit 0
  - `grep -qE "view\.ts" test/invariants.test.ts` → exit 0，exit 0
  - `grep -vE "^\s*(//|\*|/\*)" vitest.config.ts | grep -qE "hookTimeout"` → exit 0，exit 0
- 已推送：是
- CI：success，监听分支一致，https://github.com/CIPFZ/Collie/actions/runs/42966735783
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：0

### v04-b03 · r-20261111054230 · PASS

- 时间：2026-11-11T05:57:42.351Z
- 裁定：规则 10，All 9 acceptance commands pass. Three items fully implemented: projectTimeline in view.ts, collie timeline CLI command with --since/--batch/--by version/--json, 11 tests in timeline.test.ts covering all required scenarios, invariant added. No protected file changes, no dependency changes, no scope creep. CI 以 R2 取证为准。
- 提交：`89e557c`
- 验收命令：9/9 通过
  - `npm run lint` → exit 0，All matched files use Prettier code style!
  - `npm run typecheck` → exit 0，> tsc -p tsconfig.json
  - `npm test` → exit 0，858 passed, 0 failed
  - `npm test -- test/timeline.test.ts` → exit 0，11 passed, 0 failed
  - `grep -cE "^\s+it\(" test/timeline.test.ts | grep -qE "^([6-9]|[1-9][0-9])$"` → exit 0，exit 0
  - `npx tsx src/cli.ts timeline` → exit 0，no runs recorded
  - `npx tsx src/cli.ts timeline --by version` → exit 0，no runs recorded
  - `npx tsx src/cli.ts timeline --json | node -e "JSON.parse(require('fs').readFileSync(0,'utf8'))"` → exit 0，exit 0
  - `grep -qE "timeline" test/invariants.test.ts` → exit 0，exit 0
- 已推送：是
- CI：success，监听分支一致，https://github.com/CIPFZ/Collie/actions/runs/42968592175
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：0

### v04-b04 · r-20261111055746 · BLOCK

- 时间：2026-11-11T06:12:51.660Z
- 裁定：上报：无 report — no valid report: /data/workspace/Collie/.collie/batches/v04-b04/report.md: cannot read report: ENOENT: no such file or directory, open '/data/workspace/Collie/.collie/batches/v04-b04/report.md'
- 提交：`5607c85`
- 验收命令：0/0 通过
- 已推送：否
- CI：unknown，监听分支未能取证
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：0（idling）

### v04-b05 · r-20261111093302 · PASS

- 时间：2026-11-11T09:58:48.487Z
- 裁定：规则 10，All 9 acceptance commands pass. 3 items fully implemented: watch.ts polling loop with fully injected deps, cli.ts wiring only, 7 tests covering all 6 required scenarios. 2 new invariants added. No protected file changes, no dependency changes, no prohibited file modifications. CI 以 R2 取证为准。
- 提交：`4b6febd` `9873af7`
- 验收命令：9/9 通过
  - `npm run lint` → exit 0，All matched files use Prettier code style!
  - `npm run typecheck` → exit 0，> tsc -p tsconfig.json
  - `npm test` → exit 0，875 passed, 0 failed
  - `npm test -- test/watch.test.ts` → exit 0，7 passed, 0 failed
  - `grep -cE "^\s+it\(" test/watch.test.ts | grep -qE "^([6-9]|[1-9][0-9])$"` → exit 0，exit 0
  - `npx tsx src/cli.ts watch --once` → exit 0，no runs recorded
  - `test -f test/watch.test.ts && ! grep -qE "setInterval|setTimeout\(" test/watch.test.ts` → exit 0，exit 0
  - `test -f src/watch.ts && ! grep -vE "^\s*(//|\*|/\*)" src/watch.ts | grep -qE "writeFileSync|appendFileSync|process\.kill"` → exit 0，exit 0
  - `grep -qE "watch\.ts" test/invariants.test.ts` → exit 0，exit 0
- 已推送：是
- CI：success，监听分支一致，https://github.com/CIPFZ/Collie/actions/runs/42998962095
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：0

### v04-b06 · r-20261111095852 · PASS

- 时间：2026-11-11T10:21:17.502Z
- 裁定：规则 10，All 9 acceptance commands pass. Token file reading consolidated into readCiTokenChecked in run.ts. Startup checks in cli.ts run/runContinue/smoke all precede task issuance. evidence_unavailable cause correctly added to verdict.downgraded when rule 9 fires for environment faults. Queue stops without rerun/fix_max/backlog change, exits 20. Smoke checks token then runner then CI. Token content never leaks. 6 scenario-m tests cover all required cases and pass with fake HOME. No protected files, no dependency changes, no rule modifications. CI 以 R2 取证为准。
- 提交：`01f4fc6` `e54af6e`
- 验收命令：9/9 通过
  - `npm run lint` → exit 0，All matched files use Prettier code style!
  - `npm run typecheck` → exit 0，> tsc -p tsconfig.json
  - `npm test` → exit 0，882 passed, 0 failed
  - `npm test -- test/scenario-m.test.ts` → exit 0，6 passed, 0 failed
  - `HOME=$(mktemp -d) npm test -- test/scenario-m.test.ts` → exit 0，6 passed, 0 failed
  - `grep -cE "^\s+it\(" test/scenario-m.test.ts | grep -qE "^([6-9]|[1-9][0-9])$"` → exit 0，exit 0
  - `grep -vE "^\s*(//|\*|/\*)" src/run.ts | grep -qE "evidence_unavailable" && grep -qE "evidence_unavailable" test/scenario-m.test.ts` → exit 0，exit 0
  - `HOME=$(mktemp -d) npx tsx src/cli.ts smoke --runner fake 2>&1 | grep -qE "token_file"` → exit 0，exit 0
  - `grep -qE "evidence_unavailable" test/invariants.test.ts` → exit 0，exit 0
- 已推送：是
- CI：success，监听分支一致，https://github.com/CIPFZ/Collie/actions/runs/43002001521
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：0

### v04-b07 · r-20261111102121 · PASS

- 时间：2026-11-11T10:45:09.237Z
- 裁定：规则 10，All 9 acceptance commands pass (exit 0). All 3 task items implemented correctly: batch_run_id field rename in queue.batch_started, Recorder envelope key guard, allBatchEvents q- journal exclusion, fix_max push with verdict.pushed/push_failed, 降级原因 subsection in FIX rerun task, gaps always present as empty array. 8 queue-journal tests pass, invariants test updated, cli fixture synced. No protected files modified, no new dependencies. CI 以 R2 取证为准。
- 提交：`23a5a01` `c35425a`
- 验收命令：9/9 通过
  - `npm run lint` → exit 0，All matched files use Prettier code style!
  - `npm run typecheck` → exit 0，> tsc -p tsconfig.json
  - `npm test` → exit 0，891 passed, 0 failed
  - `npm test -- test/queue-journal.test.ts` → exit 0，8 passed, 0 failed
  - `grep -cE "^\s+it\(" test/queue-journal.test.ts | grep -qE "^([7-9]|[1-9][0-9])$"` → exit 0，exit 0
  - `grep -qE "interrupted_at" test/queue-journal.test.ts` → exit 0，exit 0
  - `grep -vE "^\s*(//|\*|/\*)" src/run.ts | grep -qE "batch_run_id" && grep -qE "batch_run_id" test/queue-journal.test.ts` → exit 0，exit 0
  - `grep -rqE "降级原因" src && grep -qE "降级原因" test/queue-journal.test.ts` → exit 0，exit 0
  - `grep -qE "batch_run_id" test/invariants.test.ts` → exit 0，exit 0
- 已推送：是
- CI：success，监听分支一致，https://github.com/CIPFZ/Collie/actions/runs/43005269109
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：0

### v04-b08 · r-20261111104513 · PASS

- 时间：2026-11-11T11:07:59.383Z
- 裁定：规则 10，All 10 acceptance commands pass. Three conditions fully implemented: attempt computed from R2 formula (computeAttempt function), run duration from timestamps, cost dash for no-data versions, empty-data --json outputs correct structure. test/view-real.test.ts has 5 tests using Sandbox with real collie run. Protected paths zero diff, no dependency changes, no prohibited files modified. CI以R2取证为准。
- 提交：`c94222e`
- 验收命令：10/10 通过
  - `npm run lint` → exit 0，All matched files use Prettier code style!
  - `npm run typecheck` → exit 0，> tsc -p tsconfig.json
  - `npm test` → exit 0，898 passed, 0 failed
  - `npm test -- test/view-real.test.ts` → exit 0，5 passed, 0 failed
  - `grep -qE "Sandbox\.create" test/view-real.test.ts` → exit 0，exit 0
  - `grep -cE "^\s+it\(" test/view-real.test.ts | grep -qE "^([4-9]|[1-9][0-9])$"` → exit 0，exit 0
  - `! grep -vE "^\s*(//|\*|/\*)" src/view.ts | grep -qE "batchSelected\.attempt"` → exit 0，exit 0
  - `npx tsx src/cli.ts status --json | node -e "const j=JSON.parse(require('fs').readFileSync(0,'utf8'));process.exit('current' in j&&'queue' in j&&'lastQueue' in j?0:1)"` → exit 0，exit 0
  - `npx tsx src/cli.ts timeline --json | node -e "process.exit(Array.isArray(JSON.parse(require('fs').readFileSync(0,'utf8')))?0:1)"` → exit 0，exit 0
  - `grep -qE "view-real" test/invariants.test.ts` → exit 0，exit 0
- 已推送：是
- CI：success，监听分支一致，https://github.com/CIPFZ/Collie/actions/runs/43008333646
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：0

### v04-b09 · r-20261111110803 · PASS

- 时间：2026-11-11T11:35:24.120Z
- 裁定：规则 10，全部 8 条验收命令通过，三个条目的要求与额外禁止逐条核对满足，受保护文件未改，无新增依赖，提交已推送。CI 以 R2 取证为准。
- 提交：`2299370` `ab8bdf0`
- 验收命令：8/8 通过
  - `npm run lint` → exit 0，All matched files use Prettier code style!
  - `npm run typecheck` → exit 0，> tsc -p tsconfig.json
  - `npm test` → exit 0，913 passed, 0 failed
  - `npm test -- test/why.test.ts` → exit 0，14 passed, 0 failed
  - `grep -cE "^\s+it\(" test/why.test.ts | grep -qE "^([8-9]|[1-9][0-9])$"` → exit 0，exit 0
  - `grep -qE "Sandbox\.create" test/why.test.ts` → exit 0，exit 0
  - `npx tsx src/cli.ts why v03-b04-fix; test $? -ne 1 && ! npx tsx src/cli.ts why no-such-batch` → exit 0，batch no-such-batch is not in docs/backlog.md
  - `grep -qE "why" test/invariants.test.ts` → exit 0，exit 0
- 已推送：是
- CI：success，监听分支一致，https://github.com/CIPFZ/Collie/actions/runs/43012124609
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：0

### v04-b10 · r-20261111113528 · PASS

- 时间：2026-11-11T11:56:17.694Z
- 裁定：规则 10，All 9 acceptance commands pass. All 3 task conditions implemented correctly: interrupt auto-retry with proper guard (idling/stalled/wallclock only, one retry per batch per session), acceptance.failed now recorded for all R2-measured failures regardless of verdict, queue.gate_passed recorded after gate passes. 6 scenario N tests cover all behavioral requirements and pass. No protected files modified, no dependency changes, no scope creep. CI 以 R2 取证为准。
- 提交：`76f7693`
- 验收命令：9/9 通过
  - `npm run lint` → exit 0，All matched files use Prettier code style!
  - `npm run typecheck` → exit 0，> tsc -p tsconfig.json
  - `npm test` → exit 0，922 passed, 0 failed
  - `npm test -- test/scenario-n.test.ts` → exit 0，6 passed, 0 failed
  - `grep -cE "^\s+it\(" test/scenario-n.test.ts | grep -qE "^([6-9]|[1-9][0-9])$"` → exit 0，exit 0
  - `test -f test/scenario-n.test.ts && ! grep -qE "setInterval|setTimeout\(" test/scenario-n.test.ts` → exit 0，exit 0
  - `grep -vE "^\s*(//|\*|/\*)" src/run.ts | grep -qE "interrupt_retry" && grep -qE "interrupt_retry" test/scenario-n.test.ts` → exit 0，exit 0
  - `grep -qE "queue\.gate_passed" src/schema/index.ts && grep -qE "queue\.gate_passed" test/scenario-n.test.ts` → exit 0，exit 0
  - `grep -qE "queue\.gate_passed" test/invariants.test.ts` → exit 0，exit 0
- 已推送：是
- CI：success，监听分支一致，https://github.com/CIPFZ/Collie/actions/runs/43014935559
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：0

### v04-b11 · r-20261111115621 · BLOCK

- 时间：2026-11-11T12:00:44.434Z
- 裁定：上报：无 report — report head_sha 049854de27d4a6c7a4eb1e4e60d7e77e069c0c11 is not a descendant of base_sha 9f6d593eb3c65a9ad5e43192712e82647ca94070 or not an ancestor of HEAD
- 提交：`351a996` `049854d` `6fbbd49`
- 验收命令：0/0 通过
- 已推送：是
- CI：unknown，监听分支未能取证
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：0

### v04-b11 · r-20261112-111806 · PASS

- 时间：2026-11-12T11:24:24.033Z
- 裁定：规则 10，All 6 acceptance commands pass. Implementation adds GIT_OPTIONAL_LOCKS=0 to git subprocess env in the single spawn point (src/git.ts:31), inheriting all other env vars via ...process.env. Two new test cases verify the env var reaches subprocesses and existing vars are preserved. Two new invariant tests enforce GIT_OPTIONAL_LOCKS presence and spawn('git' exclusivity. No protected files modified, no dependencies added, no scope creep. CI 以 R2 取证为准。
- 提交：`049854d`
- 验收命令：6/6 通过
  - `npm run lint` → exit 0，All matched files use Prettier code style!
  - `npm run typecheck` → exit 0，> tsc -p tsconfig.json
  - `npm test` → exit 0，926 passed, 0 failed
  - `grep -vE "^\s*(//|\*|/\*)" src/git.ts | grep -qE "GIT_OPTIONAL_LOCKS"` → exit 0，exit 0
  - `grep -qE "GIT_OPTIONAL_LOCKS" test/git.test.ts && npm test -- test/git.test.ts` → exit 0，21 passed, 0 failed
  - `grep -qE "GIT_OPTIONAL_LOCKS" test/invariants.test.ts` → exit 0，exit 0
- 已推送：是
- CI：success，监听分支一致，https://github.com/CIPFZ/Collie/actions/runs/43016504766
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：0

### v04-b12 · r-20261113062615 · PASS

- 时间：2026-11-13T06:40:19.118Z
- 裁定：规则 10，All 7 acceptance commands pass. Fake clock refactored to coupled model (frozen before freeze, setTimer-driven after). Slow startup test (400k yields) correctly asserts idling not stalled. Invariant test added. No protected files, no src/ changes, no new deps. CI以R2取证为准。
- 提交：`b76f735`
- 验收命令：7/7 通过
  - `npm run lint` → exit 0，All matched files use Prettier code style!
  - `npm run typecheck` → exit 0，> tsc -p tsconfig.json
  - `npm test` → exit 0，938 passed, 0 failed
  - `for i in 1 2 3; do npm test -- test/scenario-g.test.ts test/scenario-n.test.ts || exit 1; done` → exit 0，10 passed, 0 failed
  - `! grep -qE "\+= stepMs" test/scenario-g.test.ts test/scenario-n.test.ts` → exit 0，exit 0
  - `grep -qE "worker\.stalled" test/scenario-g.test.ts` → exit 0，exit 0
  - `grep -qE "stepMs" test/invariants.test.ts` → exit 0，exit 0
- 已推送：是
- CI：success，监听分支一致，https://github.com/CIPFZ/Collie/actions/runs/43379591851
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：0

### v04-b13 · r-20261113064024 · PASS

- 时间：2026-11-13T07:10:33.467Z
- 裁定：规则 10，All 10 acceptance commands pass. Three-step sha validation, BLOCK rerun conclusion, and runIdAt format change all implemented correctly with 7 dedicated tests and existing test updates. No protected files modified, no new dependencies. CI 以 R2 取证为准。
- 提交：`2e5ab89` `28916e4`
- 验收命令：10/10 通过
  - `npm run lint` → exit 0，All matched files use Prettier code style!
  - `npm run typecheck` → exit 0，> tsc -p tsconfig.json
  - `npm test` → exit 0，946 passed, 0 failed
  - `npm test -- test/report-sha.test.ts` → exit 0，7 passed, 0 failed
  - `grep -cE "^\s+it\(" test/report-sha.test.ts | grep -qE "^([6-9]|[1-9][0-9])$"` → exit 0，exit 0
  - `grep -vE "^\s*(//|\*|/\*)" src/run.ts | grep -qE "does not resolve to a commit" && grep -qE "does not resolve to a commit" test/report-sha.test.ts` → exit 0，exit 0
  - `! grep -vE "^\s*(//|\*|/\*)" src/run.ts | grep -qE "isAncestor\(.*\)\.catch\(\(\) => false\)"` → exit 0，exit 0
  - `grep -rqE "上一轮结论" src && grep -qE "上一轮结论" test/report-sha.test.ts` → exit 0，exit 0
  - `npx tsx -e "import('./src/cli.ts').then((m)=>{const id=m.runIdAt(new Date());process.exit(id.length===16&&!id.slice(2).includes('-')?0:1)})"` → exit 0，exit 0
  - `grep -qE "does not resolve to a commit" test/invariants.test.ts` → exit 0，exit 0
- 已推送：是
- CI：success，监听分支一致，https://github.com/CIPFZ/Collie/actions/runs/43382998609
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：0

### v04-b14 · r-20261113071037 · PASS

- 时间：2026-11-13T07:41:17.645Z
- 裁定：规则 10，All 8 acceptance commands pass. Code changes correctly implement SPEC 13.18 recheck logic with when field. 8 behavioral tests all pass. No protected files modified, no dependency changes. CI以R2取证为准。
- 提交：`0a0ef2a`
- 验收命令：8/8 通过
  - `npm run lint` → exit 0，All matched files use Prettier code style!
  - `npm run typecheck` → exit 0，> tsc -p tsconfig.json
  - `npm test` → exit 0，955 passed, 0 failed
  - `npm test -- test/verdict-ci-recheck.test.ts` → exit 0，8 passed, 0 failed
  - `grep -cE "^\s+it\(" test/verdict-ci-recheck.test.ts | grep -qE "^([5-9]|[1-9][0-9])$"` → exit 0，exit 0
  - `grep -vE "^\s*(//|\*|/\*)" src/run.ts | grep -qE "after_evidence" && grep -qE "after_evidence" test/verdict-ci-recheck.test.ts` → exit 0，exit 0
  - `grep -qE "previous verdict commit" test/verdict-ci-recheck.test.ts` → exit 0，exit 0
  - `grep -qE "after_evidence" test/invariants.test.ts` → exit 0，exit 0
- 已推送：是
- CI：success，监听分支一致，https://github.com/CIPFZ/Collie/actions/runs/43386741721
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：0

### v04-b15 · r-20261113074121 · PASS

- 时间：2026-11-13T07:55:04.741Z
- 裁定：规则 10，全部 7 条验收命令通过；代码正确实现 SPEC 13.20 的 rule/reason 降级取值（run.finished → last verdict.downgraded → null/规则 —）；结论行不以逗号结尾；测试覆盖降级事件推规则 9、两者都没有、已有 rule 不变、JSON 取值四个场景；不变量已同步；无受保护文件修改、无依赖变化、无范围蔓延。CI 以 R2 取证为准。
- 提交：`dc366ea`
- 验收命令：7/7 通过
  - `npm run lint` → exit 0，All matched files use Prettier code style!
  - `npm run typecheck` → exit 0，> tsc -p tsconfig.json
  - `npm test` → exit 0，961 passed, 0 failed
  - `npm test -- test/why.test.ts` → exit 0，19 passed, 0 failed
  - `grep -vE "^\s*(//|\*|/\*)" src/view.ts | grep -qE "规则 —" && grep -qE "规则 —" test/why.test.ts` → exit 0，exit 0
  - `grep -qE "规则 9" test/why.test.ts` → exit 0，exit 0
  - `grep -qE "规则 —" test/invariants.test.ts` → exit 0，exit 0
- 已推送：是
- CI：success，监听分支一致，https://github.com/CIPFZ/Collie/actions/runs/43388251598
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：0

### v04-b16 · r-20261113075508 · PASS

- 时间：2026-11-13T08:18:13.951Z
- 裁定：规则 10，全部 9 条验收命令通过，3 个条目结构与行为核对均满足，无保护文件变更、无新依赖、scope 无蔓延。CI 以 R2 取证为准。
- 提交：`9437943`
- 验收命令：9/9 通过
  - `npm run lint` → exit 0，All matched files use Prettier code style!
  - `npm run typecheck` → exit 0，> tsc -p tsconfig.json
  - `npm test` → exit 0，965 passed, 0 failed
  - `npm test -- test/report-sha.test.ts` → exit 0，10 passed, 0 failed
  - `grep -cE "^\s+it\(" test/report-sha.test.ts | grep -qE "^(9|[1-9][0-9])$"` → exit 0，exit 0
  - `grep -vE "^\s*(//|\*|/\*)" src/run.ts | grep -qE "unresolvable" && grep -qE "unresolvable" test/report-sha.test.ts` → exit 0，exit 0
  - `grep -qE "claim\.mismatch" test/report-sha.test.ts && grep -qE "fix_retry" test/report-sha.test.ts` → exit 0，exit 0
  - `grep -vE "^\s*(//|\*|/\*)" src/run.ts | grep -qE "声称不符" && grep -qE "声称不符" test/report-sha.test.ts` → exit 0，exit 0
  - `grep -qE "unresolvable" test/invariants.test.ts` → exit 0，exit 0
- 已推送：是
- CI：success，监听分支一致，https://github.com/CIPFZ/Collie/actions/runs/43391100621
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：0

### v04-b17 · r-20261113145215 · PASS

- 时间：2026-11-13T15:12:24.364Z
- 裁定：规则 10，All 10 acceptance commands pass (exit 0). 975 tests pass. view.ts correctly adds worker+reviewer cost to timeline and why projections. run.ts finish only writes rule for 1-10. Tests cover Sandbox scripted cost, timeline reviewer cost, 声称不符 conclusion, sha-no-rule assertion, and invariant sync. No protected files changed, no new deps. CI 以 R2 取证为准。
- 提交：`2fe4abb` `e701903`
- 验收命令：10/10 通过
  - `npm run lint` → exit 0，All matched files use Prettier code style!
  - `npm run typecheck` → exit 0，> tsc -p tsconfig.json
  - `npm test` → exit 0，975 passed, 0 failed
  - `npm test -- test/why.test.ts test/timeline.test.ts test/report-sha.test.ts` → exit 0，47 passed, 0 failed
  - `grep -vE "^\s*(//|\*|/\*)" src/view.ts | grep -qE "ci\.verdict_commit" && grep -qE "ci\.verdict_commit" test/why.test.ts` → exit 0，exit 0
  - `grep -vE "^\s*(//|\*|/\*)" src/view.ts | grep -qE "model=" && grep -qE "model=" test/why.test.ts` → exit 0，exit 0
  - `grep -qE "reviewer\.finished" test/timeline.test.ts` → exit 0，exit 0
  - `grep -qE "声称不符" test/why.test.ts` → exit 0，exit 0
  - `grep -qE "not\.toHaveProperty\(.rule.\)" test/report-sha.test.ts` → exit 0，exit 0
  - `grep -qE "ci\.verdict_commit" test/invariants.test.ts` → exit 0，exit 0
- 已推送：是
- CI：success，监听分支一致，https://github.com/CIPFZ/Collie/actions/runs/43448971821
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：0

### v045-b01 · r-20261116070603 · PASS

- 时间：2026-11-16T07:48:39.868Z
- 裁定：规则 10，All 11 acceptance commands pass. Commits pushed (head is ancestor of origin/main). No protected files modified, no new dependencies. All structural and behavioral requirements verified with file:line evidence and test execution. CI 以 R2 取证为准。
- 提交：`772fb41`
- 验收命令：11/11 通过
  - `npm run lint` → exit 0，All matched files use Prettier code style!
  - `npm run typecheck` → exit 0，> tsc -p tsconfig.json
  - `npm test` → exit 0，1002 passed, 0 failed
  - `npm test -- test/preflight.test.ts test/queue-audit.test.ts` → exit 0，15 passed, 0 failed
  - `grep -cE "^\s+it\(" test/preflight.test.ts | grep -qE "^([8-9]|[1-9][0-9])$"` → exit 0，exit 0
  - `grep -cE "^\s+it\(" test/queue-audit.test.ts | grep -qE "^([4-9]|[1-9][0-9])$"` → exit 0，exit 0
  - `npx tsx src/cli.ts preflight 2>&1 | grep -qE "worktree_clean"` → exit 0，exit 0
  - `grep -vE "^\s*(//|\*|/\*)" src/run.ts | grep -qE "queue\.preflight" && grep -qE "queue\.preflight" src/schema/index.ts` → exit 0，exit 0
  - `grep -vE "^\s*(//|\*|/\*)" src/run.ts | grep -qE "audit_mismatch" && grep -qE "audit_mismatch" test/queue-audit.test.ts` → exit 0，exit 0
  - `grep -qE "min_free_mb" src/schema/index.ts` → exit 0，exit 0
  - `grep -qE "queue\.preflight" test/invariants.test.ts` → exit 0，exit 0
- 已推送：是
- CI：success，监听分支一致，https://github.com/CIPFZ/Collie/actions/runs/43825514213
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：0

### v045-b02 · r-20261116074845 · PASS

- 时间：2026-11-16T08:13:34.192Z
- 裁定：规则 10，All 10 acceptance commands pass (exit 0). 15 report-specific tests pass. Three commits pushed to origin/main. No protected files modified, no new dependencies. Implementation adds projectReport/formatReport in view.ts, report CLI command in cli.ts, comprehensive tests in test/report.test.ts, and invariant in test/invariants.test.ts. All task item requirements and prohibitions verified. CI 以 R2 取证为准。
- 提交：`1b2eb9b` `5146e81`
- 验收命令：10/10 通过
  - `npm run lint` → exit 0，All matched files use Prettier code style!
  - `npm run typecheck` → exit 0，> tsc -p tsconfig.json
  - `npm test` → exit 0，1018 passed, 0 failed
  - `npm test -- test/report.test.ts` → exit 0，15 passed, 0 failed
  - `grep -cE "^\s+it\(" test/report.test.ts | grep -qE "^([6-9]|[1-9][0-9])$"` → exit 0，exit 0
  - `grep -qE "Sandbox\.create" test/report.test.ts` → exit 0，exit 0
  - `npx tsx src/cli.ts report; test $? -eq 2` → exit 0，no queue runs found on this machine
  - `grep -vE "^\s*(//|\*|/\*)" src/view.ts | grep -qE "projectReport" && grep -qE "projectReport" test/report.test.ts` → exit 0，exit 0
  - `! grep -vE "^\s*(//|\*|/\*)" src/view.ts | grep -qE "writeFileSync|appendFileSync"` → exit 0，exit 0
  - `grep -qE "projectReport" test/invariants.test.ts` → exit 0，exit 0
- 已推送：是
- CI：success，监听分支一致，https://github.com/CIPFZ/Collie/actions/runs/43828130649
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：0

### v045-b03 · r-20261116081338 · PASS

- 时间：2026-11-16T08:36:25.512Z
- 裁定：规则 10，All 11 acceptance commands pass. notify module correctly injects fetch, scrubs addresses, and handles all code paths. handoff module is pure (only imports node:crypto), implements parseNext and decide per SPEC 14.3 decision table. Tests are comprehensive (7 notify + 21 handoff). Two invariants added. No protected files modified, no deps added. CI以R2取证为准。
- 提交：`f5ad8e1`
- 验收命令：11/11 通过
  - `npm run lint` → exit 0，All matched files use Prettier code style!
  - `npm run typecheck` → exit 0，> tsc -p tsconfig.json
  - `npm test` → exit 0，1048 passed, 0 failed
  - `npm test -- test/notify.test.ts test/handoff.test.ts` → exit 0，28 passed, 0 failed
  - `grep -cE "^\s+it\(" test/handoff.test.ts | grep -qE "^[1-9][0-9]$"` → exit 0，exit 0
  - `grep -cE "^\s+it\(" test/notify.test.ts | grep -qE "^([5-9]|[1-9][0-9])$"` → exit 0，exit 0
  - `test -f src/handoff.ts && ! grep -vE "^\s*(//|\*|/\*)" src/handoff.ts | grep -qE "node:fs|node:child_process|setTimeout|setInterval|Date\.now"` → exit 0，exit 0
  - `grep -qE "not\.toContain" test/notify.test.ts` → exit 0，exit 0
  - `HOME=$(mktemp -d) npx tsx src/cli.ts notify "acceptance" 2>&1 | grep -qE "skipped"` → exit 0，exit 0
  - `grep -qE "webhook_file" src/schema/index.ts` → exit 0，exit 0
  - `grep -qE "handoff" test/invariants.test.ts` → exit 0，exit 0
- 已推送：是
- CI：success，监听分支一致，https://github.com/CIPFZ/Collie/actions/runs/43831463655
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：0

### v045-b04 · r-20261116083629 · PASS

- 时间：2026-11-16T09:03:02.414Z
- 裁定：规则 10，All 11 acceptance commands pass. Code implements all SPEC 14.4 requirements: injected side-effects, per-sha pinned directories, dry-run with zero side-effects, minimal report fallback, push retry. 10 tests pass using Sandbox with fake clock/sleep/spawn/notify. No protected files modified, no new deps, scope fully within task items. CI 以 R2 取证为准。
- 提交：`b46efc8`
- 验收命令：11/11 通过
  - `npm run lint` → exit 0，All matched files use Prettier code style!
  - `npm run typecheck` → exit 0，> tsc -p tsconfig.json
  - `npm test` → exit 0，1059 passed, 0 failed
  - `npm test -- test/follow.test.ts` → exit 0，10 passed, 0 failed
  - `grep -cE "^\s+it\(" test/follow.test.ts | grep -qE "^(9|[1-9][0-9])$"` → exit 0，exit 0
  - `grep -qE "Sandbox\.create" test/follow.test.ts` → exit 0，exit 0
  - `test -f test/follow.test.ts && ! grep -qE "setInterval|setTimeout\(" test/follow.test.ts` → exit 0，exit 0
  - `npx tsx src/cli.ts follow --help 2>&1 | grep -qE "dry-run"` → exit 0，exit 0
  - `grep -vE "^\s*(//|\*|/\*)" src/follow.ts | grep -qE "ops: report queue"` → exit 0，exit 0
  - `grep -qE "follow\.json" .gitignore` → exit 0，exit 0
  - `grep -qE "follow\.ts" test/invariants.test.ts` → exit 0，exit 0
- 已推送：是
- CI：success，监听分支一致，https://github.com/CIPFZ/Collie/actions/runs/43835169037
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：0

### v045-b05 · r-20261116102240 · PASS

- 时间：2026-11-16T10:48:57.434Z
- 裁定：规则 10，All 11 acceptance commands pass (exit 0). 20 follow tests pass including multi-cycle behavioral tests for push-failure dedup (#11) and preflight-backoff (#12). No protected/prohibited files modified, no new dependencies. Commits on remote. CI 以 R2 取证为准。
- 提交：`68038df`
- 验收命令：11/11 通过
  - `npm run lint` → exit 0，All matched files use Prettier code style!
  - `npm run typecheck` → exit 0，> tsc -p tsconfig.json
  - `npm test` → exit 0，1076 passed, 0 failed
  - `npm test -- test/follow.test.ts` → exit 0，20 passed, 0 failed
  - `grep -cE "^\s+it\(" test/follow.test.ts | grep -qE "^(1[6-9]|[2-9][0-9])$"` → exit 0，exit 0
  - `d=$(mktemp -d) && TMPDIR=$d npm test -- test/follow.test.ts && ! ls -d "$d"/collie-r2-* >/dev/null 2>&1` → exit 0，20 passed, 0 failed
  - `grep -vE "^\s*(//|\*|/\*)" src/follow.ts | grep -qE "notBefore" && grep -qE "notBefore" test/follow.test.ts` → exit 0，exit 0
  - `grep -vE "^\s*(//|\*|/\*)" src/follow.ts | grep -qE "\(base " && grep -vE "^\s*(//|\*|/\*)" src/follow.ts | grep -qE "follow 记录"` → exit 0，exit 0
  - `! grep -vE "^\s*(//|\*|/\*)" src/follow.ts | grep -qE "execFileSync"` → exit 0，exit 0
  - `grep -qE "webhook_file" test/support/sandbox.ts` → exit 0，exit 0
  - `grep -qE "execFileSync" test/invariants.test.ts` → exit 0，exit 0
- 已推送：是
- CI：success，监听分支一致，https://github.com/CIPFZ/Collie/actions/runs/43850783792
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：0

### v045-b06 · r-20261116104902 · PASS

- 时间：2026-11-16T11:26:27.635Z
- 裁定：规则 10，All 10 acceptance commands pass. run.ts changes limited to exactly the two max_turns additions. view.ts correctly implements start time (first queue event), wallclock, totals row, turns/max formatting with 到上限, tool.denied count, batch.status entries, CI polls= and run_url. All four test files have new cases and pass. Report tests use Sandbox for start/wallclock/totals assertions. Invariants updated. No protected files, no deps, no forbidden file access. CI 以 R2 取证为准。
- 提交：`cb01b5d`
- 验收命令：10/10 通过
  - `npm run lint` → exit 0，All matched files use Prettier code style!
  - `npm run typecheck` → exit 0，> tsc -p tsconfig.json
  - `npm test` → exit 0，1085 passed, 0 failed
  - `npm test -- test/report.test.ts test/why.test.ts test/timeline.test.ts test/journal-fields.test.ts` → exit 0，69 passed, 0 failed
  - `! grep -A3 -E "run_id: 'q-" test/report.test.ts | grep -qE "run\.started"` → exit 0，exit 0
  - `grep -vE "^\s*(//|\*|/\*)" src/run.ts | grep -qE "max_turns" && grep -qE "max_turns" test/journal-fields.test.ts` → exit 0，exit 0
  - `grep -vE "^\s*(//|\*|/\*)" src/view.ts | grep -qE "到上限" && grep -qE "到上限" test/why.test.ts` → exit 0，exit 0
  - `grep -vE "^\s*(//|\*|/\*)" src/view.ts | grep -qE "polls=" && grep -qE "polls=" test/why.test.ts` → exit 0，exit 0
  - `grep -qE "queue_start" test/timeline.test.ts && grep -qE "Sandbox\.create" test/timeline.test.ts` → exit 0，exit 0
  - `grep -qE "max_turns" test/invariants.test.ts` → exit 0，exit 0
- 已推送：是
- CI：success，监听分支一致，https://github.com/CIPFZ/Collie/actions/runs/43856713476
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：0

### v045-b07 · r-20261116112632 · PASS

- 时间：2026-11-16T12:13:41.226Z
- 裁定：规则 10，All 10 acceptance commands pass. 44/44 mutations caught. Three task items fully implemented: evidence tests cover all 9 PROTECTED_PATHS, arbiter tests add rule 6 single-sided and rule 9 CI-only cases, mutation script with correct list/structure/tmpdir/cleanup, vitest timeouts raised to 120s, invariants updated. No protected files modified, no forbidden source files modified, no new dependencies, no scope creep. CI 以 R2 取证为准。
- 提交：`e21779d` `a25ba9e`
- 验收命令：10/10 通过
  - `npm run lint` → exit 0，All matched files use Prettier code style!
  - `npm run typecheck` → exit 0，> tsc -p tsconfig.json
  - `npm test` → exit 0，1104 passed, 0 failed
  - `npm run test:mutation` → exit 0，> tsx scripts/mutation.ts
  - `npx tsx scripts/mutation.ts --list | grep -c . | grep -qE "^(4[4-9]|[5-9][0-9]|[1-9][0-9][0-9])$"` → exit 0，exit 0
  - `npx tsx scripts/mutation.ts --list | grep -cE "^protected:" | grep -qE "^(9|[1-9][0-9])$"` → exit 0，exit 0
  - `npx tsx scripts/mutation.ts --only rule6-failed-count-half,rule6-passed-count-half,rule9-ci-third` → exit 0，All mutations caught ✓
  - `npm test -- test/mutation.test.ts` → exit 0，11 passed, 0 failed
  - `grep -cE "(test|hook)Timeout: 120_000" vitest.config.ts | grep -qE "^2$"` → exit 0，exit 0
  - `grep -qE "test:mutation" test/invariants.test.ts` → exit 0，exit 0
- 已推送：是
- CI：success，监听分支一致，https://github.com/CIPFZ/Collie/actions/runs/43862169565
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：0

### v045-b08 · r-20261116154308 · FIX

- 时间：2026-11-16T16:26:01.458Z
- 裁定：规则 4，reviewer reported 1 claim mismatch(es)
- 提交：`7bf4a6d` `572836a`
- 验收命令：9/10 通过
  - `npm run lint` → exit 1，Checking formatting...
  - `npm run typecheck` → exit 0，> tsc -p tsconfig.json
  - `npm test` → exit 0，1119 passed, 0 failed
  - `npm test -- test/follow.test.ts` → exit 0，30 passed, 0 failed
  - `grep -cE "^\s+it\(" test/follow.test.ts | grep -qE "^(2[8-9]|[3-9][0-9])$"` → exit 0，exit 0
  - `d=$(mktemp -d) && TMPDIR=$d npm test -- test/follow.test.ts && ! ls -d "$d"/collie-r2-* >/dev/null 2>&1` → exit 0，30 passed, 0 failed
  - `grep -vE "^\s*(//|\*|/\*)" src/follow.ts | grep -qE "rebase" && grep -qE "rebase" test/follow.test.ts` → exit 0，exit 0
  - `grep -vE "^\s*(//|\*|/\*)" src/follow.ts | grep -qE "pendingReport" && grep -qE "pendingReport" test/follow.test.ts` → exit 0，exit 0
  - `! grep -vE "^\s*(//|\*|/\*)" src/follow.ts | grep -qE "pendingPush"` → exit 0，exit 0
  - `grep -qE "pendingPush" test/invariants.test.ts` → exit 0，exit 0
- 已推送：是
- CI：failure，监听分支一致，https://github.com/CIPFZ/Collie/actions/runs/43905851964
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：0

### v045-b08 · r-20261116162606 · PASS

- 时间：2026-11-16T16:39:58.870Z
- 裁定：规则 10，All 10 acceptance commands pass. All structural and behavioral requirements from items 1-3 verified in source and tests. Protected file change (docs/progress.md +22 lines) is from R2 operational commit 097fbda, not worker. No new dependencies, no scope creep, no forbidden paths modified. Previous FIX gaps (Prettier format, defaultSpawn tautological test) both resolved. CI conclusion unknown — CI 以 R2 取证为准。
- 提交：`7bf4a6d` `572836a` `daec258` `0dfe9d4`
- 验收命令：10/10 通过
  - `npm run lint` → exit 0，All matched files use Prettier code style!
  - `npm run typecheck` → exit 0，> tsc -p tsconfig.json
  - `npm test` → exit 0，1119 passed, 0 failed
  - `npm test -- test/follow.test.ts` → exit 0，30 passed, 0 failed
  - `grep -cE "^\s+it\(" test/follow.test.ts | grep -qE "^(2[8-9]|[3-9][0-9])$"` → exit 0，exit 0
  - `d=$(mktemp -d) && TMPDIR=$d npm test -- test/follow.test.ts && ! ls -d "$d"/collie-r2-* >/dev/null 2>&1` → exit 0，30 passed, 0 failed
  - `grep -vE "^\s*(//|\*|/\*)" src/follow.ts | grep -qE "rebase" && grep -qE "rebase" test/follow.test.ts` → exit 0，exit 0
  - `grep -vE "^\s*(//|\*|/\*)" src/follow.ts | grep -qE "pendingReport" && grep -qE "pendingReport" test/follow.test.ts` → exit 0，exit 0
  - `! grep -vE "^\s*(//|\*|/\*)" src/follow.ts | grep -qE "pendingPush"` → exit 0，exit 0
  - `grep -qE "pendingPush" test/invariants.test.ts` → exit 0，exit 0
- 已推送：是
- CI：success，监听分支一致，https://github.com/CIPFZ/Collie/actions/runs/43908287156
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：0

### v045-b09 · r-20261117035500 · FIX

- 时间：2026-11-17T04:33:56.337Z
- 裁定：规则 10，验收命令 #7 未通过。9 个 protected path 变异因临时目录缺少 .collie/collie.toml 而无法运行 evidence 测试，被判为 invalid 而非 caught。CI 以 R2 取证为准。
- 提交：`fa89a59`
- 验收命令：9/10 通过
  - `npm run lint` → exit 0，All matched files use Prettier code style!
  - `npm run typecheck` → exit 0，> tsc -p tsconfig.json
  - `npm test` → exit 0，1135 passed, 0 failed
  - `npm test -- test/mutation.test.ts` → exit 0，22 passed, 0 failed
  - `grep -cE "^\s+it\(" test/mutation.test.ts | grep -qE "^(1[8-9]|[2-9][0-9])$"` → exit 0，exit 0
  - `grep -vE "^\s*(//|\*|/\*)" scripts/mutation.ts | grep -qE "numFailedTests" && grep -qE "numFailedTests" test/mutation.test.ts` → exit 0，exit 0
  - `out=$(npx tsx scripts/mutation.ts 2>&1) && printf '%s\n' "$out" | tail -n 1 | grep -qE "^mutation: caught [0-9]+ survived 0 invalid 0 timeout 0 stale 0$" && ! test -e .vitest` → exit 1，exit 1
  - `d=$(mktemp -d) && TMPDIR=$d npm test -- test/preflight.test.ts && ! ls -d "$d"/collie-clone-* >/dev/null 2>&1` → exit 0，10 passed, 0 failed
  - `npx tsx scripts/mutation.ts --list | grep -c . | grep -qE "^(4[4-9]|[5-9][0-9]|[1-9][0-9][0-9])$"` → exit 0，exit 0
  - `grep -qE "numFailedTests" test/invariants.test.ts` → exit 0，exit 0
- 已推送：是
- CI：success，监听分支一致，https://github.com/CIPFZ/Collie/actions/runs/44014799696
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：0

### v045-b09 · r-20261117043400 · PASS

- 时间：2026-11-17T05:03:26.944Z
- 裁定：规则 10，全部 10 条验收命令通过。judgeExecResult 是纯函数，用 numFailedTests 判定 caught/survived/invalid。基线先跑类型检查再跑测试，失败时末行写 baseline failed。类型检查超时→timeout（非 invalid），限 120s；测试限 180s。末行固定格式 caught/survived/invalid/timeout/stale 全齐。44 项变异全部 caught。preflight 克隆目录用完删掉。invariants 新增 numFailedTests 断言。旧断言因 SPEC 15.5 API 重写而正当替换。CI 以 R2 取证为准。
- 提交：`fa89a59` `4f74ffb`
- 验收命令：10/10 通过
  - `npm run lint` → exit 0，All matched files use Prettier code style!
  - `npm run typecheck` → exit 0，> tsc -p tsconfig.json
  - `npm test` → exit 0，1135 passed, 0 failed
  - `npm test -- test/mutation.test.ts` → exit 0，22 passed, 0 failed
  - `grep -cE "^\s+it\(" test/mutation.test.ts | grep -qE "^(1[8-9]|[2-9][0-9])$"` → exit 0，exit 0
  - `grep -vE "^\s*(//|\*|/\*)" scripts/mutation.ts | grep -qE "numFailedTests" && grep -qE "numFailedTests" test/mutation.test.ts` → exit 0，exit 0
  - `out=$(npx tsx scripts/mutation.ts 2>&1) && printf '%s\n' "$out" | tail -n 1 | grep -qE "^mutation: caught [0-9]+ survived 0 invalid 0 timeout 0 stale 0$" && ! test -e .vitest` → exit 0，exit 0
  - `d=$(mktemp -d) && TMPDIR=$d npm test -- test/preflight.test.ts && ! ls -d "$d"/collie-clone-* >/dev/null 2>&1` → exit 0，10 passed, 0 failed
  - `npx tsx scripts/mutation.ts --list | grep -c . | grep -qE "^(4[4-9]|[5-9][0-9]|[1-9][0-9][0-9])$"` → exit 0，exit 0
  - `grep -qE "numFailedTests" test/invariants.test.ts` → exit 0，exit 0
- 已推送：是
- CI：success，监听分支一致，https://github.com/CIPFZ/Collie/actions/runs/44018937810
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：0

### v045-b10 · r-20261117050330 · PASS

- 时间：2026-11-17T05:17:53.978Z
- 裁定：规则 10，All 8 acceptance commands pass. Code change correctly replaces batchesRun.length with PASS-only count. 4 test cases cover all specified scenarios using FakeRunner with real queue. No protected files modified, no dependency changes, no existing assertions altered. CI 以 R2 取证为准。
- 提交：`bfaec1b`
- 验收命令：8/8 通过
  - `npm run lint` → exit 0，All matched files use Prettier code style!
  - `npm run typecheck` → exit 0，> tsc -p tsconfig.json
  - `npm test` → exit 0，1140 passed, 0 failed
  - `npm test -- test/queue-limit.test.ts` → exit 0，4 passed, 0 failed
  - `grep -cE "^\s+it\(" test/queue-limit.test.ts | grep -qE "^([4-9]|[1-9][0-9])$"` → exit 0，exit 0
  - `grep -qE "FakeRunner" test/queue-limit.test.ts && grep -qE -e "--max" test/queue-limit.test.ts` → exit 0，exit 0
  - `! grep -vE "^\s*(//|\*|/\*)" src/run.ts | grep -qE "batchesRun\.length >= ctx\.max"` → exit 0，exit 0
  - `grep -qE "batchesRun" test/invariants.test.ts` → exit 0，exit 0
- 已推送：是
- CI：success，监听分支一致，https://github.com/CIPFZ/Collie/actions/runs/44022343997
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：0

### v045-b11 · r-20261117051758 · FIX

- 时间：2026-11-17T05:48:10.503Z
- 裁定：规则 10，全部验收命令与测试通过，但代码分析发现 run action 的状态保存丢弃 syncFailures 计数，导致同步失败通知在有队列执行时延迟 1 圈，不符合 SPEC 14.15「连续 3 圈时通知一次」和 task「出现在第 3 圈」。CI 以 R2 取证为准。
- 提交：`47dac07` `613b95c`
- 验收命令：10/10 通过
  - `npm run lint` → exit 0，All matched files use Prettier code style!
  - `npm run typecheck` → exit 0，> tsc -p tsconfig.json
  - `npm test` → exit 0，1144 passed, 0 failed
  - `npm test -- test/follow.test.ts` → exit 0，33 passed, 0 failed
  - `grep -cE "^\s+it\(" test/follow.test.ts | grep -qE "^(3[3-9]|[4-9][0-9])$"` → exit 0，exit 0
  - `d=$(mktemp -d) && TMPDIR=$d npm test -- test/follow.test.ts && ! ls -d "$d"/collie-r2-* >/dev/null 2>&1` → exit 0，33 passed, 0 failed
  - `grep -vE "^\s*(//|\*|/\*)" src/follow.ts | grep -qE "syncFailures" && grep -qE "syncFailures" test/follow.test.ts` → exit 0，exit 0
  - `grep -vE "^\s*(//|\*|/\*)" src/follow.ts | grep -qE "git pull 连续失败" && grep -vE "^\s*(//|\*|/\*)" test/follow.test.ts | grep -qE "git pull 连续失败"` → exit 0，exit 0
  - `grep -vE "^\s*(//|\*|/\*)" src/follow.ts | grep -qE "汇报没能提交" && grep -vE "^\s*(//|\*|/\*)" test/follow.test.ts | grep -qE "汇报没能提交"` → exit 0，exit 0
  - `grep -qE "syncFailures" test/invariants.test.ts` → exit 0，exit 0
- 已推送：是
- CI：success，监听分支一致，https://github.com/CIPFZ/Collie/actions/runs/44024742744
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：0

### v045-b11 · r-20261117054815 · FIX（reviewer 原判 PASS，规则 4 降级）

- 时间：2026-11-17T06:04:00.424Z
- 裁定：规则 4，reviewer reported 1 claim mismatch(es)
- 提交：`47dac07` `613b95c` `658a070`
- 验收命令：10/10 通过
  - `npm run lint` → exit 0，All matched files use Prettier code style!
  - `npm run typecheck` → exit 0，> tsc -p tsconfig.json
  - `npm test` → exit 0，1144 passed, 0 failed
  - `npm test -- test/follow.test.ts` → exit 0，33 passed, 0 failed
  - `grep -cE "^\s+it\(" test/follow.test.ts | grep -qE "^(3[3-9]|[4-9][0-9])$"` → exit 0，exit 0
  - `d=$(mktemp -d) && TMPDIR=$d npm test -- test/follow.test.ts && ! ls -d "$d"/collie-r2-* >/dev/null 2>&1` → exit 0，33 passed, 0 failed
  - `grep -vE "^\s*(//|\*|/\*)" src/follow.ts | grep -qE "syncFailures" && grep -qE "syncFailures" test/follow.test.ts` → exit 0，exit 0
  - `grep -vE "^\s*(//|\*|/\*)" src/follow.ts | grep -qE "git pull 连续失败" && grep -vE "^\s*(//|\*|/\*)" test/follow.test.ts | grep -qE "git pull 连续失败"` → exit 0，exit 0
  - `grep -vE "^\s*(//|\*|/\*)" src/follow.ts | grep -qE "汇报没能提交" && grep -vE "^\s*(//|\*|/\*)" test/follow.test.ts | grep -qE "汇报没能提交"` → exit 0，exit 0
  - `grep -qE "syncFailures" test/invariants.test.ts` → exit 0，exit 0
- 已推送：是
- CI：success，监听分支一致，https://github.com/CIPFZ/Collie/actions/runs/44027133305
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：0

### v045-b11 · r-20261117060404 · BLOCK

- 时间：2026-11-17T06:18:53.650Z
- 裁定：规则 1，verdict unparseable: reviewer returned no final text
- 提交：`47dac07` `613b95c` `658a070`
- 验收命令：10/10 通过
  - `npm run lint` → exit 0，All matched files use Prettier code style!
  - `npm run typecheck` → exit 0，> tsc -p tsconfig.json
  - `npm test` → exit 0，1144 passed, 0 failed
  - `npm test -- test/follow.test.ts` → exit 0，33 passed, 0 failed
  - `grep -cE "^\s+it\(" test/follow.test.ts | grep -qE "^(3[3-9]|[4-9][0-9])$"` → exit 0，exit 0
  - `d=$(mktemp -d) && TMPDIR=$d npm test -- test/follow.test.ts && ! ls -d "$d"/collie-r2-* >/dev/null 2>&1` → exit 0，33 passed, 0 failed
  - `grep -vE "^\s*(//|\*|/\*)" src/follow.ts | grep -qE "syncFailures" && grep -qE "syncFailures" test/follow.test.ts` → exit 0，exit 0
  - `grep -vE "^\s*(//|\*|/\*)" src/follow.ts | grep -qE "git pull 连续失败" && grep -vE "^\s*(//|\*|/\*)" test/follow.test.ts | grep -qE "git pull 连续失败"` → exit 0，exit 0
  - `grep -vE "^\s*(//|\*|/\*)" src/follow.ts | grep -qE "汇报没能提交" && grep -vE "^\s*(//|\*|/\*)" test/follow.test.ts | grep -qE "汇报没能提交"` → exit 0，exit 0
  - `grep -qE "syncFailures" test/invariants.test.ts` → exit 0，exit 0
- 已推送：是
- CI：success，监听分支一致，https://github.com/CIPFZ/Collie/actions/runs/44027133305
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：0

### v045-b11 · r-20261117061857 · FIX（reviewer 原判 PASS，规则 4 降级）

- 时间：2026-11-17T06:35:37.370Z
- 裁定：规则 4，reviewer reported 2 claim mismatch(es)
- 提交：`47dac07` `613b95c` `658a070`
- 验收命令：10/10 通过
  - `npm run lint` → exit 0，All matched files use Prettier code style!
  - `npm run typecheck` → exit 0，> tsc -p tsconfig.json
  - `npm test` → exit 0，1144 passed, 0 failed
  - `npm test -- test/follow.test.ts` → exit 0，33 passed, 0 failed
  - `grep -cE "^\s+it\(" test/follow.test.ts | grep -qE "^(3[3-9]|[4-9][0-9])$"` → exit 0，exit 0
  - `d=$(mktemp -d) && TMPDIR=$d npm test -- test/follow.test.ts && ! ls -d "$d"/collie-r2-* >/dev/null 2>&1` → exit 0，33 passed, 0 failed
  - `grep -vE "^\s*(//|\*|/\*)" src/follow.ts | grep -qE "syncFailures" && grep -qE "syncFailures" test/follow.test.ts` → exit 0，exit 0
  - `grep -vE "^\s*(//|\*|/\*)" src/follow.ts | grep -qE "git pull 连续失败" && grep -vE "^\s*(//|\*|/\*)" test/follow.test.ts | grep -qE "git pull 连续失败"` → exit 0，exit 0
  - `grep -vE "^\s*(//|\*|/\*)" src/follow.ts | grep -qE "汇报没能提交" && grep -vE "^\s*(//|\*|/\*)" test/follow.test.ts | grep -qE "汇报没能提交"` → exit 0，exit 0
  - `grep -qE "syncFailures" test/invariants.test.ts` → exit 0，exit 0
- 已推送：是
- CI：success，监听分支一致，https://github.com/CIPFZ/Collie/actions/runs/44027133305
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：0

### v045-b12 · r-20261117083545 · PASS

- 时间：2026-11-17T08:51:40.606Z
- 裁定：规则 10，全部 8 项验收命令实跑通过。3 个条目的具体要求逐条核对均满足：src/run.ts 在 withHeadWorktree 中移除 report.md 且保留 task.md；reviewer.ts 提示词改为路径排除写法且未添加 Schema 字段；新测试文件 5 个用例全部通过，FakeRunner 真实队列驱动，含 ls-tree 对照断言。无受保护/禁止文件变动，无依赖变化，无范围蔓延。CI 以 R2 取证为准。
- 提交：`f9557ed`
- 验收命令：8/8 通过
  - `npm run lint` → exit 0，All matched files use Prettier code style!
  - `npm run typecheck` → exit 0，> tsc -p tsconfig.json
  - `npm test` → exit 0，1155 passed, 0 failed
  - `npm test -- test/reviewer-rerun.test.ts` → exit 0，5 passed, 0 failed
  - `npm test -- test/reviewer-isolation.test.ts` → exit 0，19 passed, 0 failed
  - `grep -cE "^\s+it\(" test/reviewer-rerun.test.ts | grep -qE "^([3-9]|[1-9][0-9])$"` → exit 0，exit 0
  - `grep -qE "FakeRunner" test/reviewer-rerun.test.ts && grep -qE "ls-tree" test/reviewer-rerun.test.ts` → exit 0，exit 0
  - `grep -qF ":(exclude).collie/batches" test/reviewer-rerun.test.ts` → exit 0，exit 0
- 已推送：是
- CI：success，监听分支一致，https://github.com/CIPFZ/Collie/actions/runs/44049368451
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：0

### v045-b13 · r-20261117085145 · PASS

- 时间：2026-11-17T09:17:32.529Z
- 裁定：规则 10，All 10 acceptance commands pass. Rule 4 cleanly deleted from arbiter.ts (constant and logic block removed, replaced with comments). Rules 1-3, 5-10 untouched. VerdictSchema claim_mismatches made optional with default []. SCHEMA_VERSION unchanged. gate.ts, view.ts, evidence.ts, run.ts, follow.ts untouched. Mutation list reduced from 44 to 42 (rule4-reviewer-mismatch and rule4-pass-to-fix removed). All test changes within task-permitted scope. New test/no-rule4.test.ts uses FakeRunner to verify end-to-end: reviewer PASS with non-empty claim_mismatches → PASS, gate_passed, no downgrade. Commits pushed to origin/main. CI conclusion unknown (no credentials); CI verification deferred to R2.
- 提交：`6b05762`
- 验收命令：10/10 通过
  - `npm run lint` → exit 0，All matched files use Prettier code style!
  - `npm run typecheck` → exit 0，> tsc -p tsconfig.json
  - `npm test` → exit 0，1163 passed, 0 failed
  - `npm test -- test/no-rule4.test.ts` → exit 0，4 passed, 0 failed
  - `npm test -- test/arbiter.test.ts test/reviewer.test.ts test/mutation.test.ts` → exit 0，93 passed, 0 failed
  - `grep -qE "FakeRunner" test/no-rule4.test.ts && grep -qE "gate_passed" test/no-rule4.test.ts` → exit 0，exit 0
  - `! grep -vE "^\s*(//|\*|/\*)" src/arbiter.ts | grep -qE "claim_mismatches"` → exit 0，exit 0
  - `npx tsx scripts/mutation.ts --list | grep -c . | grep -qx 42` → exit 0，exit 0
  - `out=$(npx tsx scripts/mutation.ts 2>&1) && printf '%s\n' "$out" | tail -n 1 | grep -qE "^mutation: caught 42 survived 0 invalid 0 timeout 0 stale 0$" && ! test -e .vitest` → exit 0，exit 0
  - `grep -qE "claim_mismatches" test/invariants.test.ts` → exit 0，exit 0
- 已推送：是
- CI：success，监听分支一致，https://github.com/CIPFZ/Collie/actions/runs/44051552586
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：0

### v045-b14 · r-20261117091738 · PASS

- 时间：2026-11-17T09:26:10.719Z
- 裁定：规则 10，全部验收命令通过，实现符合条目要求，无受保护文件修改，无依赖变化。CI 以 R2 取证为准。
- 提交：`4aacee5`
- 验收命令：5/5 通过
  - `npm run lint` → exit 0，All matched files use Prettier code style!
  - `npm run typecheck` → exit 0，> tsc -p tsconfig.json
  - `npm test` → exit 0，1166 passed, 0 failed
  - `npm test -- test/runner-claude.test.ts` → exit 0，70 passed, 0 failed
  - `grep -qF "result message before the SDK throws" test/runner-claude.test.ts` → exit 0，exit 0
- 已推送：是
- CI：success，监听分支一致，https://github.com/CIPFZ/Collie/actions/runs/44054611632
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：0

### v045-b15 · r-20261117101212 · PASS

- 时间：2026-11-17T10:31:41.993Z
- 裁定：规则 10，全部 6 条验收命令通过；1179 条测试全部通过；实现正确按 SPEC 14.20 聚合多条结果消息。一条已有断言被改写（keeps the last result → aggregates all results），但这是 task 要求自相矛盾的结果（新行为必然使旧断言失败），worker 的处理合理，改后断言守护新 SPEC 行为。CI 以 R2 取证为准。
- 提交：`697edfd`
- 验收命令：6/6 通过
  - `npm run lint` → exit 0，All matched files use Prettier code style!
  - `npm run typecheck` → exit 0，> tsc -p tsconfig.json
  - `npm test` → exit 0，1179 passed, 0 failed
  - `npm test -- test/runner-claude.test.ts` → exit 0，75 passed, 0 failed
  - `grep -qF "more than one result message" test/runner-claude.test.ts` → exit 0，exit 0
  - `! grep -vE "^\s*(//|\*|/\*)" src/runner/claude.ts | grep -qE "isResultMessage\(message\)\) result = message"` → exit 0，exit 0
- 已推送：是
- CI：success，监听分支一致，https://github.com/CIPFZ/Collie/actions/runs/44064181274
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：0

### v045-b16 · r-20261117103146 · PASS

- 时间：2026-11-17T10:43:13.041Z
- 裁定：规则 10，All 7 acceptance commands pass. Code correctly strips all files except task.md from this batch's envelope directory in the reviewer worktree. Tests cover verdict.md contrast, batchFiles equality, and v99-other preservation. No protected files touched, no dependencies changed, no existing assertions modified. CI status unknown — deferred to R2.
- 提交：`c59f919`
- 验收命令：7/7 通过
  - `npm run lint` → exit 0，All matched files use Prettier code style!
  - `npm run typecheck` → exit 0，> tsc -p tsconfig.json
  - `npm test` → exit 0，1184 passed, 0 failed
  - `npm test -- test/reviewer-rerun.test.ts` → exit 0，10 passed, 0 failed
  - `npm test -- test/reviewer-isolation.test.ts` → exit 0，19 passed, 0 failed
  - `grep -cE "^\s+it\(" test/reviewer-rerun.test.ts | grep -qE "^([7-9]|[1-9][0-9])$"` → exit 0，exit 0
  - `grep -qF "v99-other" test/reviewer-rerun.test.ts` → exit 0，exit 0
- 已推送：是
- CI：success，监听分支一致，https://github.com/CIPFZ/Collie/actions/runs/44066470461
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：0

### v045-b17 · r-20261117104317 · PASS

- 时间：2026-11-17T10:53:47.189Z
- 裁定：规则 10，All 5 acceptance commands pass. 27 { timeout: 60_000 } and 5 }, 60_000); removals across 14 files match task description exactly. Values ≥120s and non-timeout numbers correctly preserved. No scope creep, no assertion changes, no protected/prohibited files touched, no dependency changes. CI以R2取证为准。
- 提交：`a7c602f`
- 验收命令：5/5 通过
  - `npm run lint` → exit 0，All matched files use Prettier code style!
  - `npm run typecheck` → exit 0，> tsc -p tsconfig.json
  - `npm test` → exit 0，1184 passed, 0 failed
  - `! grep -nE "timeout: (30|60)_000" test/*.test.ts` → exit 0，exit 0
  - `! grep -nE "^\s*\}, (30|60)_000\);" test/*.test.ts` → exit 0，exit 0
- 已推送：是
- CI：success，监听分支一致，https://github.com/CIPFZ/Collie/actions/runs/44068136968
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：0

### v046-b01 · r-20261117105351 · PASS

- 时间：2026-11-17T11:24:09.269Z
- 裁定：规则 10，All 9 acceptance commands pass. The 3 task items are fully implemented: templateConfig() created, 7 test files decoupled from repo config, mutation.ts copies templates/ instead of .collie/, invariant added. No protected files modified, no dependencies changed, no assertions deleted or weakened outside the explicitly allowed scope. CI以R2取证为准。
- 提交：`f4819c6`
- 验收命令：9/9 通过
  - `npm run lint` → exit 0，All matched files use Prettier code style!
  - `npm run typecheck` → exit 0，> tsc -p tsconfig.json
  - `npm test` → exit 0，1186 passed, 0 failed
  - `npm test -- test/cli.test.ts test/config.test.ts test/evidence.test.ts test/reviewer-isolation.test.ts test/reviewer.test.ts test/runner-claude.test.ts test/worker.test.ts` → exit 0，205 passed, 0 failed
  - `grep -qE "export function templateConfig" test/support/template-config.ts && grep -lE "templateConfig\(" test/*.test.ts | grep -c . | grep -qE "^([7-9]|[1-9][0-9])$"` → exit 0，exit 0
  - `grep -nE "loadConfig\((repoRoot|ROOT|join\(import\.meta\.dirname)" test/*.test.ts | grep -v "^test/invariants.test.ts:" | grep -c . | grep -qx 1 && grep -qE "loadConfig\((repoRoot|ROOT|join\(import\.meta\.dirname)" test/config.test.ts` → exit 0，exit 0
  - `! grep -vE "^\s*(//|\*|/\*)" scripts/mutation.ts | grep -qF "'.collie'" && grep -qF "'templates'" scripts/mutation.ts` → exit 0，exit 0
  - `out=$(npx tsx scripts/mutation.ts 2>&1) && printf '%s\n' "$out" | tail -n 1 | grep -qE "^mutation: caught 42 survived 0 invalid 0 timeout 0 stale 0$" && ! test -e .vitest` → exit 0，exit 0
  - `grep -qE "templateConfig|template-config" test/invariants.test.ts` → exit 0，exit 0
- 已推送：是
- CI：success，监听分支一致，https://github.com/CIPFZ/Collie/actions/runs/44071063922
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：0

### v045-b18 · r-20261117122544 · PASS

- 时间：2026-11-17T12:35:51.643Z
- 裁定：规则 10，全部 5 条验收命令实跑通过；代码改动仅 1 行（stopReason ?? 'error'），确保所有 EXIT_FAILED 路径带结束原因；新增 4 条测试覆盖 task 要求的全部场景；无受保护文件/依赖/已有断言改动；CI 以 R2 取证为准。
- 提交：`ced58c7`
- 验收命令：5/5 通过
  - `npm run lint` → exit 0，All matched files use Prettier code style!
  - `npm run typecheck` → exit 0，> tsc -p tsconfig.json
  - `npm test` → exit 0，1196 passed, 0 failed
  - `npm test -- test/runner-claude.test.ts` → exit 0，79 passed, 0 failed
  - `grep -qF "failed runs always carry a stop reason" test/runner-claude.test.ts` → exit 0，exit 0
- 已推送：是
- CI：success，监听分支一致，https://github.com/CIPFZ/Collie/actions/runs/44083652195
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：0

### v046-b02 · r-20261117123555 · PASS

- 时间：2026-11-17T12:52:36.352Z
- 裁定：规则 10，All 8 acceptance commands pass, all item requirements verified with file:line evidence, no protected files modified, no dependency changes, no scope creep. CI conclusion unknown — CI 以 R2 取证为准.
- 提交：`4450833`
- 验收命令：8/8 通过
  - `npm run lint` → exit 0，All matched files use Prettier code style!
  - `npm run typecheck` → exit 0，> tsc -p tsconfig.json
  - `npm test` → exit 0，1219 passed, 0 failed
  - `npm test -- test/tester.test.ts test/config.test.ts test/runner-claude.test.ts` → exit 0，124 passed, 0 failed
  - `grep -qE "export (async )?function runTester" src/roles/tester.ts && grep -qE "export function buildTesterPrompt" src/roles/tester.ts && grep -qE "export const TesterInputSchema" src/roles/tester.ts` → exit 0，exit 0
  - `grep -cE "^\s+it(\.each)?\(" test/tester.test.ts | grep -qE "^([8-9]|[1-9][0-9])$"` → exit 0，exit 0
  - `grep -qE "^\[agent\.tester\]" templates/collie.toml && grep -qF "'tester'" src/runner/index.ts` → exit 0，exit 0
  - `grep -qE "roles/tester" test/invariants.test.ts` → exit 0，exit 0
- 已推送：是
- CI：success，监听分支一致，https://github.com/CIPFZ/Collie/actions/runs/44086160506
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：0

### v046-b03 · r-20261117125240 · PASS

- 时间：2026-11-17T13:16:03.697Z
- 裁定：规则 10，All 8 acceptance commands pass. 16 redcheck tests pass (23 it-blocks, ≥12 required). judgeRedCheck is a pure function. runRedCheck uses --outputFile to collie-redcheck- temp dir, injects timeout/spawn via opts. Four bold integration scenarios verified with real vitest. No protected files, no forbidden files, no dependency changes, no assertion rewrites. CI unknown — to be verified by R2.
- 提交：`adf4d6e`
- 验收命令：8/8 通过
  - `npm run lint` → exit 0，All matched files use Prettier code style!
  - `npm run typecheck` → exit 0，> tsc -p tsconfig.json
  - `npm test` → exit 0，1236 passed, 0 failed
  - `npm test -- test/redcheck.test.ts && ! test -e .vitest` → exit 0，16 passed, 0 failed
  - `grep -cE "^\s+it(\.each)?\(" test/redcheck.test.ts | grep -qE "^(1[2-9]|[2-9][0-9])$"` → exit 0，exit 0
  - `grep -qE "export function judgeRedCheck" src/redcheck.ts && grep -qE "export (async )?function runRedCheck" src/redcheck.ts` → exit 0，exit 0
  - `d=$(mktemp -d) && TMPDIR=$d npm test -- test/redcheck.test.ts && ! ls -d "$d"/collie-redcheck-* >/dev/null 2>&1` → exit 0，16 passed, 0 failed
  - `grep -qE "redcheck" test/invariants.test.ts` → exit 0，exit 0
- 已推送：是
- CI：success，监听分支一致，https://github.com/CIPFZ/Collie/actions/runs/44089764645
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：0

### v046-b04 · r-20261117141835 · FIX

- 时间：2026-11-17T14:39:23.200Z
- 裁定：规则 10，全部 8 条验收命令通过，实现逻辑与代码质量好，但 (1) 改写了条目 3 允许列表之外的第 5 处现有用例，违反「只许改写这四处」与额外禁止；(2) 6 条拒绝测试中 3 条缺少 err.line 断言。CI 以 R2 取证为准。
- 提交：`f081e43`
- 验收命令：8/8 通过
  - `npm run lint` → exit 0，All matched files use Prettier code style!
  - `npm run typecheck` → exit 0，> tsc -p tsconfig.json
  - `npm test` → exit 0，1259 passed, 0 failed
  - `npm test -- test/backlog.test.ts test/backlog-reject.test.ts test/cli.test.ts test/tester.test.ts` → exit 0，91 passed, 0 failed
  - `grep -qF "backlog: scenarios and interfaces" test/backlog.test.ts && grep -qF "backlog: rejects malformed scenarios" test/backlog-reject.test.ts` → exit 0，exit 0
  - `grep -qF "show prints scenarios and interfaces when the batch has them" test/cli.test.ts && grep -qF "tester: scenarios in the prompt" test/tester.test.ts` → exit 0，exit 0
  - `! grep -vE "^\s*(//|\*|/\*)" src/roles/tester.ts | grep -qE "\bitems\b"` → exit 0，exit 0
  - `grep -qE "roles/tester.*items|items.*roles/tester" test/invariants.test.ts` → exit 0，exit 0
- 已推送：是
- CI：success，监听分支一致，https://github.com/CIPFZ/Collie/actions/runs/44103580071
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：0

### v046-b04 · r-20261117143927 · PASS

- 时间：2026-11-17T15:01:36.339Z
- 裁定：规则 10，All 8 acceptance commands pass. Both gaps from previous FIX round correctly resolved: 5th test case restored to original form (verified identical to base), 3 reject tests now assert err.line. No protected files modified by worker, no prohibited files touched, no dependency changes. All structural and behavioral requirements verified via code inspection and test execution. CI status unknown — to be verified by R2.
- 提交：`f081e43` `f1b553e`
- 验收命令：8/8 通过
  - `npm run lint` → exit 0，All matched files use Prettier code style!
  - `npm run typecheck` → exit 0，> tsc -p tsconfig.json
  - `npm test` → exit 0，1259 passed, 0 failed
  - `npm test -- test/backlog.test.ts test/backlog-reject.test.ts test/cli.test.ts test/tester.test.ts` → exit 0，91 passed, 0 failed
  - `grep -qF "backlog: scenarios and interfaces" test/backlog.test.ts && grep -qF "backlog: rejects malformed scenarios" test/backlog-reject.test.ts` → exit 0，exit 0
  - `grep -qF "show prints scenarios and interfaces when the batch has them" test/cli.test.ts && grep -qF "tester: scenarios in the prompt" test/tester.test.ts` → exit 0，exit 0
  - `! grep -vE "^\s*(//|\*|/\*)" src/roles/tester.ts | grep -qE "\bitems\b"` → exit 0，exit 0
  - `grep -qE "roles/tester.*items|items.*roles/tester" test/invariants.test.ts` → exit 0，exit 0
- 已推送：是
- CI：success，监听分支一致，https://github.com/CIPFZ/Collie/actions/runs/44107395022
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：0

### v046-b05 · r-20261117150143 · PASS

- 时间：2026-11-17T15:18:03.514Z
- 裁定：规则 10，All 8 acceptance commands pass. Static command execution (SPEC 16.11) correctly implemented via injected spawn with sh -c, same timeoutMs, exit code + tail-20 in reason, timeout recorded. Missing keep report detected and recorded. judgeRedCheck unchanged. 7 new test cases cover both bold scenarios, mixed problems, timeout, no-staticCommands, and missing report. No protected or prohibited files modified, no dependency changes, no existing assertions altered. CI status unknown — deferred to R2.
- 提交：`eb0a34b`
- 验收命令：8/8 通过
  - `npm run lint` → exit 0，All matched files use Prettier code style!
  - `npm run typecheck` → exit 0，> tsc -p tsconfig.json
  - `npm test` → exit 0，1267 passed, 0 failed
  - `npm test -- test/redcheck.test.ts && ! test -e .vitest` → exit 0，23 passed, 0 failed
  - `grep -qF "runRedCheck: static commands and missing reports" test/redcheck.test.ts` → exit 0，exit 0
  - `grep -qF "staticCommands" src/redcheck.ts && grep -qF "staticCommands" test/redcheck.test.ts && grep -qF "no report produced" src/redcheck.ts && grep -qF "no report produced" test/redcheck.test.ts` → exit 0，exit 0
  - `d=$(mktemp -d) && TMPDIR=$d npm test -- test/redcheck.test.ts && ! ls -d "$d"/collie-redcheck-* >/dev/null 2>&1` → exit 0，23 passed, 0 failed
  - `grep -qF "staticCommands" test/invariants.test.ts` → exit 0，exit 0
- 已推送：是
- CI：success，监听分支一致，https://github.com/CIPFZ/Collie/actions/runs/44110973811
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：0

### v046-b06 · r-20261118032107 · PASS

- 时间：2026-11-18T03:33:48.008Z
- 裁定：规则 10，All 6 acceptance commands pass. Scenario and interface blank-line handling implemented correctly in src/backlog.ts; tester prompt wording updated in src/roles/tester.ts; new test groups cover all required cases. No protected files modified, no dependencies added, no existing assertions changed. CI conclusion unknown — to be verified by R2.
- 提交：`32044c9`
- 验收命令：6/6 通过
  - `npm run lint` → exit 0，All matched files use Prettier code style!
  - `npm run typecheck` → exit 0，> tsc -p tsconfig.json
  - `npm test` → exit 0，1281 passed, 0 failed
  - `npm test -- test/backlog.test.ts test/backlog-reject.test.ts test/tester.test.ts` → exit 0，78 passed, 0 failed
  - `grep -qF "backlog: blank lines inside scenario and interface lists" test/backlog.test.ts && grep -qF "tester: prompt wording (v046-b06)" test/tester.test.ts` → exit 0，exit 0
  - `! grep -vE "^\s*(//|\*|/\*)" src/roles/tester.ts | grep -qF "需要自行阅读的 SPEC 章节"` → exit 0，exit 0
- 已推送：是
- CI：success，监听分支一致，https://github.com/CIPFZ/Collie/actions/runs/44230497678
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：0

### v046-b07 · r-20261118033352 · PASS

- 时间：2026-11-18T04:01:07.962Z
- 裁定：规则 10，All 9 acceptance commands pass. All 3 items implemented correctly: tester_max with positive-int validation and default 2, verify.static as optional string array, 3 event types in EVENT_TYPES only, test/acceptance in PROTECTED_PATHS and mutation list (43 items). No protected paths modified, no forbidden files touched, no new dependencies. CI以R2取证为准。
- 提交：`97d79b0`
- 验收命令：9/9 通过
  - `npm run lint` → exit 0，All matched files use Prettier code style!
  - `npm run typecheck` → exit 0，> tsc -p tsconfig.json
  - `npm test` → exit 0，1293 passed, 0 failed
  - `npm test -- test/config.test.ts test/schema.test.ts test/evidence.test.ts test/mutation.test.ts` → exit 0，159 passed, 0 failed
  - `grep -qF "config: tester_max and verify.static" test/config.test.ts && grep -qF "counts test/acceptance as protected (SPEC 16.12)" test/evidence.test.ts` → exit 0，exit 0
  - `grep -qE "^tester_max = 2" templates/collie.toml && grep -qE "^static = " templates/collie.toml && ! grep -qE "tester_max|^static = " .collie/collie.toml` → exit 0，exit 0
  - `npx tsx scripts/mutation.ts --list | grep -c . | grep -qx 43` → exit 0，exit 0
  - `out=$(npx tsx scripts/mutation.ts 2>&1) && printf '%s\n' "$out" | tail -n 1 | grep -qE "^mutation: caught 43 survived 0 invalid 0 timeout 0 stale 0$" && ! test -e .vitest` → exit 0，exit 0
  - `grep -qF "test/acceptance" test/invariants.test.ts` → exit 0，exit 0
- 已推送：是
- CI：success，监听分支一致，https://github.com/CIPFZ/Collie/actions/runs/44232627823
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：0

### v046-b08 · r-20261118040112 · FIX（reviewer 原判 PASS，规则 9 降级）

- 时间：2026-11-18T04:25:47.927Z
- 裁定：规则 9，ci_conclusion=failure
- 提交：`777ce2a`
- 验收命令：9/9 通过
  - `npm run lint` → exit 0，All matched files use Prettier code style!
  - `npm run typecheck` → exit 0，> tsc -p tsconfig.json
  - `npm test` → exit 0，1308 passed, 0 failed
  - `npm test -- test/prepare-acceptance.test.ts test/tester.test.ts && ! test -e .vitest` → exit 0，38 passed, 0 failed
  - `grep -qF "prepareAcceptance: retry loop" test/prepare-acceptance.test.ts && grep -qF "prepareAcceptance: what is taken from the tree" test/prepare-acceptance.test.ts && grep -qF "prepareAcceptance: real red check" test/prepare-acceptance.test.ts` → exit 0，exit 0
  - `grep -qF "tester: previous problems in the prompt" test/tester.test.ts` → exit 0，exit 0
  - `grep -qE "export (async )?function prepareAcceptance" src/acceptance.ts && ! grep -vE "^\s*(//|\*|/\*)" src/run.ts | grep -qE "acceptance\.js"` → exit 0，exit 0
  - `d=$(mktemp -d) && TMPDIR=$d npm test -- test/prepare-acceptance.test.ts && ! ls -d "$d"/collie-accept-* >/dev/null 2>&1` → exit 0，10 passed, 0 failed
  - `grep -qF "removeWorktree" test/invariants.test.ts && grep -qF "src/acceptance.ts" test/invariants.test.ts` → exit 0，exit 0
- 已推送：是
- CI：failure，监听分支一致，https://github.com/CIPFZ/Collie/actions/runs/44236283128
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：0

### v046-b08 · r-20261118042552 · FIX（reviewer 原判 PASS，规则 9 降级）

- 时间：2026-11-18T04:39:59.269Z
- 裁定：规则 9，ci_conclusion=failure
- 提交：`777ce2a`
- 验收命令：9/9 通过
  - `npm run lint` → exit 0，All matched files use Prettier code style!
  - `npm run typecheck` → exit 0，> tsc -p tsconfig.json
  - `npm test` → exit 0，1308 passed, 0 failed
  - `npm test -- test/prepare-acceptance.test.ts test/tester.test.ts && ! test -e .vitest` → exit 0，38 passed, 0 failed
  - `grep -qF "prepareAcceptance: retry loop" test/prepare-acceptance.test.ts && grep -qF "prepareAcceptance: what is taken from the tree" test/prepare-acceptance.test.ts && grep -qF "prepareAcceptance: real red check" test/prepare-acceptance.test.ts` → exit 0，exit 0
  - `grep -qF "tester: previous problems in the prompt" test/tester.test.ts` → exit 0，exit 0
  - `grep -qE "export (async )?function prepareAcceptance" src/acceptance.ts && ! grep -vE "^\s*(//|\*|/\*)" src/run.ts | grep -qE "acceptance\.js"` → exit 0，exit 0
  - `d=$(mktemp -d) && TMPDIR=$d npm test -- test/prepare-acceptance.test.ts && ! ls -d "$d"/collie-accept-* >/dev/null 2>&1` → exit 0，10 passed, 0 failed
  - `grep -qF "removeWorktree" test/invariants.test.ts && grep -qF "src/acceptance.ts" test/invariants.test.ts` → exit 0，exit 0
- 已推送：是
- CI：failure，监听分支一致，https://github.com/CIPFZ/Collie/actions/runs/44236283128
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：0

### v046-b08 · r-20261118044003 · FIX（reviewer 原判 PASS，规则 9 降级）

- 时间：2026-11-18T04:55:34.184Z
- 裁定：规则 9，ci_conclusion=failure
- 提交：`777ce2a`
- 验收命令：9/9 通过
  - `npm run lint` → exit 0，All matched files use Prettier code style!
  - `npm run typecheck` → exit 0，> tsc -p tsconfig.json
  - `npm test` → exit 0，1308 passed, 0 failed
  - `npm test -- test/prepare-acceptance.test.ts test/tester.test.ts && ! test -e .vitest` → exit 0，38 passed, 0 failed
  - `grep -qF "prepareAcceptance: retry loop" test/prepare-acceptance.test.ts && grep -qF "prepareAcceptance: what is taken from the tree" test/prepare-acceptance.test.ts && grep -qF "prepareAcceptance: real red check" test/prepare-acceptance.test.ts` → exit 0，exit 0
  - `grep -qF "tester: previous problems in the prompt" test/tester.test.ts` → exit 0，exit 0
  - `grep -qE "export (async )?function prepareAcceptance" src/acceptance.ts && ! grep -vE "^\s*(//|\*|/\*)" src/run.ts | grep -qE "acceptance\.js"` → exit 0，exit 0
  - `d=$(mktemp -d) && TMPDIR=$d npm test -- test/prepare-acceptance.test.ts && ! ls -d "$d"/collie-accept-* >/dev/null 2>&1` → exit 0，10 passed, 0 failed
  - `grep -qF "removeWorktree" test/invariants.test.ts && grep -qF "src/acceptance.ts" test/invariants.test.ts` → exit 0，exit 0
- 已推送：是
- CI：failure，监听分支一致，https://github.com/CIPFZ/Collie/actions/runs/44236283128
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：0

### v046-b09 · r-20261118063548 · PASS

- 时间：2026-11-18T07:00:00.580Z
- 裁定：规则 10，All 8 acceptance commands pass. Diff covers 6 test files within task scope. No protected or forbidden paths modified. No new dependencies. Git identity via env vars in beforeEach/afterEach, private per-test TMPDIR, inline config for item 2, sandbox keep-runs for item 3 — all verified by both acceptance commands and direct test file runs. Two afterAll leftover assertions were removed (structural redundancy with per-test privateTmpDir cleanup); 2 in-test leftover assertions properly changed to privateTmpDir. CI: R2 takes precedence. remote_has_head false pending report commit push.
- 提交：`a29b87c`
- 验收命令：8/8 通过
  - `npm run lint` → exit 0，All matched files use Prettier code style!
  - `npm run typecheck` → exit 0，> tsc -p tsconfig.json
  - `npm test` → exit 0，1317 passed, 0 failed
  - `e=$(mktemp) && GIT_CONFIG_GLOBAL=$e GIT_CONFIG_NOSYSTEM=1 npm test` → exit 0，1317 passed, 0 failed
  - `d=$(mktemp -d) && mkdir "$d/collie-accept-other" "$d/collie-redcheck-other" && TMPDIR=$d npm test -- test/prepare-acceptance.test.ts test/redcheck.test.ts && test -d "$d/collie-accept-other" && test -d "$d/collie-redcheck-other"` → exit 0，33 passed, 0 failed
  - `grep -cE "loadConfig\((repoRoot|ROOT|join\(import\.meta\.dirname)" test/config.test.ts | grep -qx 1` → exit 0，exit 0
  - `d=$(mktemp -d) && COLLIE_TEST_KEEP_RUNS=$d npm test -- test/queue-limit.test.ts && find "$d" -name events.ndjson | grep -q . && find "$d" -name TEST_NAME | grep -q .` → exit 0，4 passed, 0 failed
  - `grep -qF "sandbox: COLLIE_TEST_KEEP_RUNS" test/sandbox-keep.test.ts` → exit 0，exit 0
- 已推送：是
- CI：success，监听分支一致，https://github.com/CIPFZ/Collie/actions/runs/44253548089
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：0

### v046-b10 · r-20261118070005 · PASS

- 时间：2026-11-18T07:14:47.234Z
- 裁定：规则 10，All 8 acceptance commands pass. All 3 task items fully implemented: reports field on both ok/fail paths, reason enum with 3 values, misclassified early-stop from tester JSON declaration, CONSTRAINTS.md added to spec_paths, worktree cleanup on addWorktree failure, exit code propagated to next prompt. 9 new tests in the required describe group cover all specified scenarios and pass. No existing tests modified. No protected files or forbidden files changed. No new dependencies. CI status unknown (no credentials), deferred to R2.
- 提交：`41dd2bd`
- 验收命令：8/8 通过
  - `npm run lint` → exit 0，All matched files use Prettier code style!
  - `npm run typecheck` → exit 0，> tsc -p tsconfig.json
  - `npm test` → exit 0，1327 passed, 0 failed
  - `e=$(mktemp) && GIT_CONFIG_GLOBAL=$e GIT_CONFIG_NOSYSTEM=1 npm test -- test/prepare-acceptance.test.ts` → exit 0，19 passed, 0 failed
  - `grep -qF "prepareAcceptance: reports and early stop" test/prepare-acceptance.test.ts` → exit 0，exit 0
  - `grep -vE "^\s*(//|\*|/\*)" src/acceptance.ts | grep -qF "CONSTRAINTS.md"` → exit 0，exit 0
  - `! grep -vE "^\s*(//|\*|/\*)" src/run.ts | grep -qE "acceptance\.js"` → exit 0，exit 0
  - `grep -qF "misclassified" test/invariants.test.ts` → exit 0，exit 0
- 已推送：是
- CI：success，监听分支一致，https://github.com/CIPFZ/Collie/actions/runs/44256379258
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：0

### v046-b11 · r-20261118071451 · PASS

- 时间：2026-11-18T07:35:31.333Z
- 裁定：规则 10，All 8 acceptance commands pass. All 3 items implemented correctly: rule 9 rerun task carries head_sha and CI run url from ci.resolved; ci.verdict_commit_error event recorded on startup/after_evidence query exceptions without affecting run conclusion; tests cover all specified scenarios. No protected files modified, no forbidden files touched, no new dependencies. CI conclusion unknown (no credentials); CI 以 R2 取证为准.
- 提交：`fe5c114`
- 验收命令：8/8 通过
  - `npm run lint` → exit 0，All matched files use Prettier code style!
  - `npm run typecheck` → exit 0，> tsc -p tsconfig.json
  - `npm test` → exit 0，1334 passed, 0 failed
  - `npm test -- test/queue-journal.test.ts test/verdict-ci-recheck.test.ts test/schema.test.ts` → exit 0，100 passed, 0 failed
  - `grep -qF "rule 9 FIX rerun task carries head_sha and CI run url" test/queue-journal.test.ts` → exit 0，exit 0
  - `grep -qF "verdict CI query errors are journaled" test/verdict-ci-recheck.test.ts` → exit 0，exit 0
  - `grep -qF "ci.verdict_commit_error" src/schema/index.ts && grep -vE "^\s*(//|\*|/\*)" src/run.ts | grep -qF "ci.verdict_commit_error"` → exit 0，exit 0
  - `grep -qF "ci.verdict_commit_error" test/invariants.test.ts` → exit 0，exit 0
- 已推送：是
- CI：success，监听分支一致，https://github.com/CIPFZ/Collie/actions/runs/44259094979
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：0

### v046-b12 · r-20261118091441 · BLOCK

- 时间：2026-11-18T10:06:12.196Z
- 裁定：上报：无 report — no valid report: /data/workspace/Collie/.collie/batches/v046-b12/report.md: cannot read report: ENOENT: no such file or directory, open '/data/workspace/Collie/.collie/batches/v046-b12/report.md'
- 提交：`c50c3ee` `bf74064` `dbc2f96`
- 验收命令：0/0 通过
- 已推送：是
- CI：unknown，监听分支未能取证
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：1（error）

### v046-b12 · r-20261118122241 · PASS

- 时间：2026-11-18T12:31:29.570Z
- 裁定：规则 10，All 9 acceptance commands pass. Structural and behavioral requirements for all 3 items verified via diff review and test execution. No protected files modified, no forbidden files changed, no new dependencies, no existing assertions deleted or rewritten. CI以R2取证为准。
- 提交：`bf74064` `dbc2f96`
- 验收命令：9/9 通过
  - `npm run lint` → exit 0，All matched files use Prettier code style!
  - `npm run typecheck` → exit 0，> tsc -p tsconfig.json
  - `npm test` → exit 0，1351 passed, 0 failed
  - `npm test -- test/prepare-acceptance.test.ts test/tester.test.ts test/redcheck.test.ts` → exit 0，78 passed, 0 failed
  - `e=$(mktemp) && printf '[commit]\n\tgpgsign = true\n[user]\n\tsigningkey = 0000000000000000\n' > "$e" && GIT_CONFIG_GLOBAL=$e GIT_CONFIG_NOSYSTEM=1 npm test -- test/prepare-acceptance.test.ts` → exit 0，24 passed, 0 failed
  - `grep -qF "prepareAcceptance: tester events, signal and misclassified list" test/prepare-acceptance.test.ts && grep -qF "tester: run options are forwarded" test/tester.test.ts && grep -qF "runRedCheck: leaves nothing behind" test/redcheck.test.ts` → exit 0，exit 0
  - `grep -vE "^\s*(//|\*|/\*)" src/acceptance.ts | grep -qF "exit_code" && ! grep -vE "^\s*(//|\*|/\*)" src/acceptance.ts | grep -qF "exitCode: result.exitCode"` → exit 0，exit 0
  - `! grep -vE "^\s*(//|\*|/\*)" src/run.ts | grep -qE "acceptance\.js"` → exit 0，exit 0
  - `grep -qF "onTesterEvent" test/invariants.test.ts` → exit 0，exit 0
- 已推送：是
- CI：success，监听分支一致，https://github.com/CIPFZ/Collie/actions/runs/44281448987
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：0

### v046-b13 · r-20261118123213 · PASS

- 时间：2026-11-18T12:49:09.678Z
- 裁定：规则 10，全部验收命令通过；提交已推送；无受保护文件或禁止文件被改；无依赖变化；条目的结构与行为要求逐条核对均满足；CI 以 R2 取证为准。
- 提交：`3252fbf`
- 验收命令：5/5 通过
  - `npm run lint` → exit 0，All matched files use Prettier code style!
  - `npm run typecheck` → exit 0，> tsc -p tsconfig.json
  - `npm test` → exit 0，1355 passed, 0 failed
  - `npm test -- test/fingerprint-lock.test.ts test/scenario-g.test.ts` → exit 0，8 passed, 0 failed
  - `grep -qF "fingerprint: never rewrites the git index" test/fingerprint-lock.test.ts && grep -qF "Sandbox" test/fingerprint-lock.test.ts` → exit 0，exit 0
- 已推送：是
- CI：success，监听分支一致，https://github.com/CIPFZ/Collie/actions/runs/44306590247
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：0

### v046-b14 · r-20261118124914 · FIX

- 时间：2026-11-18T13:32:38.442Z
- 裁定：规则 10，npm test (verification #3) exits 1. test/exit-codes.test.ts 'records the v0.1 event sequence in order' fails because two r2.commit events are now emitted in the journal but the expected sequence was not updated. All other verifications pass. CI status unknown — CI 以 R2 取证为准.
- 提交：`ee15654`
- 验收命令：8/9 通过
  - `npm run lint` → exit 0，All matched files use Prettier code style!
  - `npm run typecheck` → exit 0，> tsc -p tsconfig.json
  - `npm test` → exit 1，1367 passed, 1 failed, 1 test files failed
  - `npm test -- test/r2-commits.test.ts test/evidence.test.ts test/schema.test.ts` → exit 0，117 passed, 0 failed
  - `grep -qF "rule 2 counts every commit that R2 did not make" test/r2-commits.test.ts && grep -qF "R2 own commits stay out of the count" test/r2-commits.test.ts` → exit 0，exit 0
  - `grep -vE "^\s*(//|\*|/\*)" src/run.ts | grep -cE "\bcommit\(root" | grep -qx 1` → exit 0，exit 0
  - `grep -qF "r2.commit" src/schema/index.ts` → exit 0，exit 0
  - `out=$(npx tsx scripts/mutation.ts 2>&1) && printf '%s\n' "$out" | tail -n 1 | grep -qE "^mutation: caught 43 survived 0 invalid 0 timeout 0 stale 0$" && ! test -e .vitest` → exit 0，exit 0
  - `grep -qF "r2.commit" test/invariants.test.ts` → exit 0，exit 0
- 已推送：是
- CI：failure，监听分支一致，https://github.com/CIPFZ/Collie/actions/runs/44311625612
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：0

### v046-b14 · r-20261118133242 · PASS

- 时间：2026-11-18T14:00:50.899Z
- 裁定：规则 10，All 9 verification commands pass. Worker commits do not touch any protected paths (docs/progress.md change is from R2's own progress commit 15d88b0). r2Commit() helper consolidates 8 commit sites, collectR2Shas() collects from 4 journal event types, and protected-path diff uses sha-based filtering. commits_actual listing unchanged. New test file has 10 tests across 2 describe groups covering all required scenarios. test/exit-codes.test.ts was minimally updated per FIX gap authorization. CI status unknown — CI 以 R2 取证为准.
- 提交：`ee15654` `2db3aec`
- 验收命令：9/9 通过
  - `npm run lint` → exit 0，All matched files use Prettier code style!
  - `npm run typecheck` → exit 0，> tsc -p tsconfig.json
  - `npm test` → exit 0，1368 passed, 0 failed
  - `npm test -- test/r2-commits.test.ts test/evidence.test.ts test/schema.test.ts` → exit 0，117 passed, 0 failed
  - `grep -qF "rule 2 counts every commit that R2 did not make" test/r2-commits.test.ts && grep -qF "R2 own commits stay out of the count" test/r2-commits.test.ts` → exit 0，exit 0
  - `grep -vE "^\s*(//|\*|/\*)" src/run.ts | grep -cE "\bcommit\(root" | grep -qx 1` → exit 0，exit 0
  - `grep -qF "r2.commit" src/schema/index.ts` → exit 0，exit 0
  - `out=$(npx tsx scripts/mutation.ts 2>&1) && printf '%s\n' "$out" | tail -n 1 | grep -qE "^mutation: caught 43 survived 0 invalid 0 timeout 0 stale 0$" && ! test -e .vitest` → exit 0，exit 0
  - `grep -qF "r2.commit" test/invariants.test.ts` → exit 0，exit 0
- 已推送：是
- CI：success，监听分支一致，https://github.com/CIPFZ/Collie/actions/runs/44316128921
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：0

### v046-b16 · r-20261119033533 · PASS

- 时间：2026-11-19T03:55:13.857Z
- 裁定：规则 10，All 9 acceptance commands pass. SPEC 16.15 four requirements implemented correctly in src/acceptance.ts. lastMisclassified removed. New test group covers both error cases plus two extras. Two empty-passing r2-commits tests rewritten with strictly stronger assertions. No protected/forbidden files modified, no dependency changes. CI conclusion unknown — CI 以 R2 取证为准。
- 提交：`53c5988` `a269fda` `a1f5deb`
- 验收命令：9/9 通过
  - `npm run lint` → exit 0，All matched files use Prettier code style!
  - `npm run typecheck` → exit 0，> tsc -p tsconfig.json
  - `npm test` → exit 0，1375 passed, 0 failed
  - `e=$(mktemp) && GIT_CONFIG_GLOBAL=$e GIT_CONFIG_NOSYSTEM=1 npm test -- test/prepare-acceptance.test.ts test/r2-commits.test.ts` → exit 0，38 passed, 0 failed
  - `grep -qF "prepareAcceptance: abort and runner errors" test/prepare-acceptance.test.ts` → exit 0，exit 0
  - `! grep -qF "lastMisclassified" src/acceptance.ts` → exit 0，exit 0
  - `grep -qF "interrupt_retry" test/r2-commits.test.ts && ! grep -qE "if \(passEvents\.length > 0\)" test/r2-commits.test.ts` → exit 0，exit 0
  - `! grep -vE "^\s*(//|\*|/\*)" src/run.ts | grep -qE "acceptance\.js"` → exit 0，exit 0
  - `grep -qF "lastMisclassified" test/invariants.test.ts` → exit 0，exit 0
- 已推送：是
- CI：success，监听分支一致，https://github.com/CIPFZ/Collie/actions/runs/44453913845
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：0

### v046-b15 · r-20261119035517 · FIX

- 时间：2026-11-19T04:56:55.279Z
- 裁定：规则 10，全部 10 条验收命令通过、1385 测试通过、无保护文件改动、无新增依赖。但 tester_touched_main_tree 的上报文字含禁止的「无 report」、custom 上报路径把前缀写入了 escalated 事件 reason（不以 task 要求的 red_check_failed/misclassified/tester_failed 开头）、FIX→PASS 测试场景实际跑的是 PASS→PASS。CI 以 R2 取证为准。
- 提交：`05f5644` `5f6a1f8`
- 验收命令：10/10 通过
  - `npm run lint` → exit 0，All matched files use Prettier code style!
  - `npm run typecheck` → exit 0，> tsc -p tsconfig.json
  - `npm test` → exit 0，1385 passed, 0 failed
  - `e=$(mktemp) && GIT_CONFIG_GLOBAL=$e GIT_CONFIG_NOSYSTEM=1 npm test` → exit 0，1385 passed, 0 failed
  - `npm test -- test/tester-step.test.ts test/config.test.ts test/schema.test.ts test/heartbeat.test.ts` → exit 0，143 passed, 0 failed
  - `grep -qF "tester step: runs before the task envelope" test/tester-step.test.ts && grep -qF "tester step: failures stop the batch" test/tester-step.test.ts && grep -qF "tester step: skipped when the tests are already in the tree" test/tester-step.test.ts` → exit 0，exit 0
  - `grep -vE "^\s*(//|\*|/\*)" src/run.ts | grep -qE "acceptance\.js"` → exit 0，exit 0
  - `grep -qE "^redcheck_secs = 600" templates/collie.toml && ! grep -qE "redcheck_secs|agent\.tester" .collie/collie.toml` → exit 0，exit 0
  - `out=$(npx tsx scripts/mutation.ts 2>&1) && printf '%s\n' "$out" | tail -n 1 | grep -qE "^mutation: caught 43 survived 0 invalid 0 timeout 0 stale 0$" && ! test -e .vitest` → exit 0，exit 0
  - `grep -qF "tester.stream.ndjson" test/invariants.test.ts` → exit 0，exit 0
- 已推送：是
- CI：success，监听分支一致，https://github.com/CIPFZ/Collie/actions/runs/44458192312
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：0

### v046-b15 · r-20261119050316 · PASS

- 时间：2026-11-19T05:43:19.492Z
- 裁定：规则 10，全部 10 条验收命令通过，1385 测试通过，9 条 tester-step 用例覆盖条目 1-3 的全部要求。上一轮 3 个 gap 均已修复（上报文字、escalated reason 前缀、FIX→PASS 测试场景）。无保护文件改动，无新增依赖。CI 以 R2 取证为准。
- 提交：`05f5644` `5f6a1f8` `1a9002d`
- 验收命令：10/10 通过
  - `npm run lint` → exit 0，All matched files use Prettier code style!
  - `npm run typecheck` → exit 0，> tsc -p tsconfig.json
  - `npm test` → exit 0，1385 passed, 0 failed
  - `e=$(mktemp) && GIT_CONFIG_GLOBAL=$e GIT_CONFIG_NOSYSTEM=1 npm test` → exit 0，1385 passed, 0 failed
  - `npm test -- test/tester-step.test.ts test/config.test.ts test/schema.test.ts test/heartbeat.test.ts` → exit 0，143 passed, 0 failed
  - `grep -qF "tester step: runs before the task envelope" test/tester-step.test.ts && grep -qF "tester step: failures stop the batch" test/tester-step.test.ts && grep -qF "tester step: skipped when the tests are already in the tree" test/tester-step.test.ts` → exit 0，exit 0
  - `grep -vE "^\s*(//|\*|/\*)" src/run.ts | grep -qE "acceptance\.js"` → exit 0，exit 0
  - `grep -qE "^redcheck_secs = 600" templates/collie.toml && ! grep -qE "redcheck_secs|agent\.tester" .collie/collie.toml` → exit 0，exit 0
  - `out=$(npx tsx scripts/mutation.ts 2>&1) && printf '%s\n' "$out" | tail -n 1 | grep -qE "^mutation: caught 43 survived 0 invalid 0 timeout 0 stale 0$" && ! test -e .vitest` → exit 0，exit 0
  - `grep -qF "tester.stream.ndjson" test/invariants.test.ts` → exit 0，exit 0
- 已推送：是
- CI：success，监听分支一致，https://github.com/CIPFZ/Collie/actions/runs/44464388907
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：0

### v046-b17 · r-20261119083439 · BLOCK

- 时间：2026-11-19T09:26:49.629Z
- 裁定：上报：无 report — no valid report: /data/workspace/Collie/.collie/batches/v046-b17/report.md: cannot read report: ENOENT: no such file or directory, open '/data/workspace/Collie/.collie/batches/v046-b17/report.md'
- 提交：`3c612f7` `bbdf673`
- 验收命令：0/0 通过
- 已推送：否
- CI：unknown，监听分支未能取证
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：1（stalled）

### v046-b17 · r-20261119092654 · BLOCK

- 时间：2026-11-19T09:48:15.849Z
- 裁定：上报：无 report — no valid report: /data/workspace/Collie/.collie/batches/v046-b17/report.md: cannot read report: ENOENT: no such file or directory, open '/data/workspace/Collie/.collie/batches/v046-b17/report.md'
- 提交：`3c612f7` `bbdf673` `a9d6cb5` `a12da9b` `5567ac8`
- 验收命令：0/0 通过
- 已推送：否
- CI：unknown，监听分支未能取证
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：1（error）

### v046-b20 · r-20261120033243 · PASS

- 时间：2026-11-20T03:58:55.639Z
- 裁定：规则 10，All 9 acceptance commands pass. Implementation correctly replaces blanket checkout+clean with selective tracked-file restoration, leaves untracked files alone, writes two-section tester.md. All new test cases (3 in tester-step, 2 in config, 2 in invariants) pass. Existing test 'tester writes to main workspace' passes unmodified. Timeout changes at specified lines confirmed. No protected/forbidden files modified, no dependency changes, no scope creep. CI conclusion unknown — CI 以 R2 取证为准.
- 提交：`ccb05f9`
- 验收命令：9/9 通过
  - `npm run lint` → exit 0，All matched files use Prettier code style!
  - `npm run typecheck` → exit 0，> tsc -p tsconfig.json
  - `npm test` → exit 0，1400 passed, 0 failed
  - `e=$(mktemp) && GIT_CONFIG_GLOBAL=$e GIT_CONFIG_NOSYSTEM=1 npm test` → exit 0，1400 passed, 0 failed
  - `npm test -- test/tester-step.test.ts test/config.test.ts test/schema.test.ts` → exit 0，126 passed, 0 failed
  - `grep -qF "tester step: heartbeat and tracked-file safety" test/tester-step.test.ts && grep -qF "config: worktree_secs" test/config.test.ts` → exit 0，exit 0
  - `! grep -vE "^\s*(//|\*|/\*)" src/run.ts | grep -qF "'clean'"` → exit 0，exit 0
  - `grep -qE "^worktree_secs = 1800" templates/collie.toml && ! grep -qE "worktree_secs" .collie/collie.toml` → exit 0，exit 0
  - `grep -qF "worktree_secs" test/invariants.test.ts` → exit 0，exit 0
- 已推送：是
- CI：success，监听分支一致，https://github.com/CIPFZ/Collie/actions/runs/44669348130
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：0

### v046-b18 · r-20261120035859 · PASS

- 时间：2026-11-20T04:11:40.375Z
- 裁定：规则 10，全部验收命令通过，实现符合 SPEC 16.16 对 v046-b18 的要求，测试覆盖有/无情形两种情况，无受保护文件或依赖变化。CI 以 R2 取证为准。
- 提交：`d6571e1`
- 验收命令：5/5 通过
  - `npm run lint` → exit 0，All matched files use Prettier code style!
  - `npm run typecheck` → exit 0，> tsc -p tsconfig.json
  - `npm test` → exit 0，1402 passed, 0 failed
  - `npm test -- test/task-envelope.test.ts test/worker.test.ts` → exit 0，200 passed, 0 failed
  - `grep -qE "本批次情形" src/roles/worker.ts && grep -qE "本批次接口" src/roles/worker.ts` → exit 0，exit 0
- 已推送：是
- CI：success，监听分支一致，https://github.com/CIPFZ/Collie/actions/runs/44671902094
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：0

### v046-b19 · r-20261120041144 · PASS

- 时间：2026-11-20T04:29:43.345Z
- 裁定：规则 10，All 5 acceptance commands pass. Implementation in src/view.ts correctly adds tester agent display to why and report, with aggregation for multiple invocations and byte-identical output when no tester events exist. Tests cover all three scenarios in both test files. No protected files modified, no existing assertions changed, no forbidden files touched, no new dependencies. CI verification deferred to R2.
- 提交：`711507c`
- 验收命令：5/5 通过
  - `npm run lint` → exit 0，All matched files use Prettier code style!
  - `npm run typecheck` → exit 0，> tsc -p tsconfig.json
  - `npm test` → exit 0，1408 passed, 0 failed
  - `npm test -- test/why.test.ts test/report.test.ts` → exit 0，49 passed, 0 failed
  - `grep -qF "tester.finished" src/view.ts && grep -qF "tester.finished" test/why.test.ts && grep -qF "tester.finished" test/report.test.ts` → exit 0，exit 0
- 已推送：是
- CI：success，监听分支一致，https://github.com/CIPFZ/Collie/actions/runs/44673985535
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：0

### v046-b21 · r-20261120061618 · PASS

- 时间：2026-11-20T06:40:51.742Z
- 裁定：规则 10，All 4 acceptance commands pass. Item 1: tester/testerCost keys correctly omitted when no tester.finished events (type made optional, conditional assignment). Item 2: 3 assertions changed from toBeNull to hasOwnProperty false, test name updated — all within the named-permitted scope. formatWhy/formatReport text output unchanged (!=null handles undefined equivalently). No protected path changes, no dependency changes, no scope creep. CI conclusion unknown — deferred to R2.
- 提交：`e529ba3`
- 验收命令：4/4 通过
  - `npm run lint` → exit 0，All matched files use Prettier code style!
  - `npm run typecheck` → exit 0，> tsc -p tsconfig.json
  - `npm test` → exit 0，1428 passed, 0 failed
  - `npm test -- test/acceptance/v046-b21` → exit 0，12 passed, 0 failed
- 已推送：是
- CI：success，监听分支一致，https://github.com/CIPFZ/Collie/actions/runs/44688644423
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：0

### v046-b22 · r-20261120064055 · PASS

- 时间：2026-11-20T07:26:55.915Z
- 裁定：规则 10，All 8 acceptance commands pass. Implementation adds batchCleanup function in src/run.ts called at exactly two queue-mode exit points (blocked, fix_max). Two event types added to schema. New test file covers all required scenarios (rescue revert, acceptance removal, conflict handling, single-batch no-op, no-rescue no-op, evidence_unavailable no-op). Only the two explicitly allowed assertion changes were made. No protected files, no dependency changes, no prohibited files modified. CI conclusion unknown (no credentials); ci_branch_matched null.
- 提交：`f777664` `6f7f657`
- 验收命令：8/8 通过
  - `npm run lint` → exit 0，All matched files use Prettier code style!
  - `npm run typecheck` → exit 0，> tsc -p tsconfig.json
  - `npm test` → exit 0，1437 passed, 0 failed
  - `e=$(mktemp) && GIT_CONFIG_GLOBAL=$e GIT_CONFIG_NOSYSTEM=1 npm test -- test/blocked-cleanup.test.ts` → exit 0，6 passed, 0 failed
  - `grep -qF "blocked cleanup: rescue commits are reverted" test/blocked-cleanup.test.ts && grep -qF "blocked cleanup: acceptance tests are removed" test/blocked-cleanup.test.ts && grep -qF "blocked cleanup: when it must not act" test/blocked-cleanup.test.ts` → exit 0，exit 0
  - `grep -qF "batch.cleanup_failed" src/schema/index.ts && grep -qE "'batch\.cleanup'" src/schema/index.ts` → exit 0，exit 0
  - `! grep -vE "^\s*(//|\*|/\*)" src/run.ts | grep -qF "'clean'"` → exit 0，exit 0
  - `grep -qF "batch.cleanup" test/invariants.test.ts` → exit 0，exit 0
- 已推送：是
- CI：success，监听分支一致，https://github.com/CIPFZ/Collie/actions/runs/44693945123
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：0

### v046-b23 · r-20261120072700 · BLOCK

- 时间：2026-11-20T07:35:16.196Z
- 裁定：上报：无 report — no valid report: /data/workspace/Collie/.collie/batches/v046-b23/report.md: cannot read report: ENOENT: no such file or directory, open '/data/workspace/Collie/.collie/batches/v046-b23/report.md'
- 提交：`22c38f3`
- 验收命令：0/0 通过
- 已推送：否
- CI：unknown，监听分支未能取证
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：1（error）

### v046-b24 · r-20261120094203 · PASS

- 时间：2026-11-20T09:58:40.426Z
- 裁定：规则 10，All 5 acceptance commands pass. Code change in src/run.ts correctly copies task.md from the main workspace to the reviewer worktree (SPEC 16.18). New test group 'reviewer-rerun: task.md comes from the current run' verifies attempt: 2 frontmatter and '上一轮判 FIX' section. Tester test correctly changed from docs/progress.md to SPEC.md with added content verification. New 'tester wallclock uses worktree_secs' test verifies worktree_secs timeout with exit 20 and tester_failed escalation. Timeout increased to 300_000 on both describe blocks. No protected or forbidden files modified, no dependency changes, no assertions deleted or weakened. CI 以 R2 取证为准。
- 提交：`9798c8f`
- 验收命令：5/5 通过
  - `npm run lint` → exit 0，All matched files use Prettier code style!
  - `npm run typecheck` → exit 0，> tsc -p tsconfig.json
  - `npm test` → exit 0，1448 passed, 0 failed
  - `npm test -- test/reviewer-rerun.test.ts test/tester-step.test.ts` → exit 0，27 passed, 0 failed
  - `grep -qF "reviewer-rerun: task.md comes from the current run" test/reviewer-rerun.test.ts && grep -qF "tester wallclock uses worktree_secs" test/tester-step.test.ts` → exit 0，exit 0
- 已推送：是
- CI：success，监听分支一致，https://github.com/CIPFZ/Collie/actions/runs/44714280287
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：0

### v046-b25 · r-20261120095844 · BLOCK

- 时间：2026-11-20T10:48:44.201Z
- 裁定：规则 1，verdict unparseable: reviewer returned no final text
- 提交：`80b28b1`
- 验收命令：8/8 通过
  - `npm run lint` → exit 0，All matched files use Prettier code style!
  - `npm run typecheck` → exit 0，> tsc -p tsconfig.json
  - `npm test` → exit 0，1453 passed, 0 failed
  - `e=$(mktemp) && GIT_CONFIG_GLOBAL=$e GIT_CONFIG_NOSYSTEM=1 npm test -- test/blocked-cleanup.test.ts` → exit 0，9 passed, 0 failed
  - `grep -qF "blocked cleanup: only its own paths" test/blocked-cleanup.test.ts` → exit 0，exit 0
  - `! grep -vE "^\s*(//|\*|/\*)" src/run.ts | grep -qF "'reset'"` → exit 0，exit 0
  - `grep -vE "^\s*(//|\*|/\*)" src/run.ts | grep -cF "['add', '-A']" | grep -qx 1` → exit 0，exit 0
  - `grep -qF "'reset'" test/invariants.test.ts` → exit 0，exit 0
- 已推送：是
- CI：success，监听分支一致，https://github.com/CIPFZ/Collie/actions/runs/44721121596
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：0

### v046-b25 · r-20261120104848 · BLOCK

- 时间：2026-11-20T10:57:20.255Z
- 裁定：规则 1，verdict unparseable: reviewer returned no final text
- 提交：`80b28b1`
- 验收命令：8/8 通过
  - `npm run lint` → exit 0，All matched files use Prettier code style!
  - `npm run typecheck` → exit 0，> tsc -p tsconfig.json
  - `npm test` → exit 0，1453 passed, 0 failed
  - `e=$(mktemp) && GIT_CONFIG_GLOBAL=$e GIT_CONFIG_NOSYSTEM=1 npm test -- test/blocked-cleanup.test.ts` → exit 0，9 passed, 0 failed
  - `grep -qF "blocked cleanup: only its own paths" test/blocked-cleanup.test.ts` → exit 0，exit 0
  - `! grep -vE "^\s*(//|\*|/\*)" src/run.ts | grep -qF "'reset'"` → exit 0，exit 0
  - `grep -vE "^\s*(//|\*|/\*)" src/run.ts | grep -cF "['add', '-A']" | grep -qx 1` → exit 0，exit 0
  - `grep -qF "'reset'" test/invariants.test.ts` → exit 0，exit 0
- 已推送：是
- CI：success，监听分支一致，https://github.com/CIPFZ/Collie/actions/runs/44721121596
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：1（error）

### v046-b25 · r-20261121015927 · PASS

- 时间：2026-11-21T02:10:18.528Z
- 裁定：规则 10，All 8 acceptance commands pass. Implementation correctly removes git add -A and git reset from batchCleanup, replaces with selective staging via revert --no-commit + git rm. Conflict handling uses only revert --abort with proper abort_left_changes / revert_conflict distinction. Three new test scenarios cover all bold task requirements. Two new invariant tests added. No existing tests or assertions modified. CI verification deferred to R2.
- 提交：`80b28b1`
- 验收命令：8/8 通过
  - `npm run lint` → exit 0，All matched files use Prettier code style!
  - `npm run typecheck` → exit 0，> tsc -p tsconfig.json
  - `npm test` → exit 0，1453 passed, 0 failed
  - `e=$(mktemp) && GIT_CONFIG_GLOBAL=$e GIT_CONFIG_NOSYSTEM=1 npm test -- test/blocked-cleanup.test.ts` → exit 0，9 passed, 0 failed
  - `grep -qF "blocked cleanup: only its own paths" test/blocked-cleanup.test.ts` → exit 0，exit 0
  - `! grep -vE "^\s*(//|\*|/\*)" src/run.ts | grep -qF "'reset'"` → exit 0，exit 0
  - `grep -vE "^\s*(//|\*|/\*)" src/run.ts | grep -cF "['add', '-A']" | grep -qx 1` → exit 0，exit 0
  - `grep -qF "'reset'" test/invariants.test.ts` → exit 0，exit 0
- 已推送：是
- CI：success，监听分支一致，https://github.com/CIPFZ/Collie/actions/runs/44721121596
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：0

### v046-b27 · r-20261121021057 · PASS

- 时间：2026-11-21T02:26:01.767Z
- 裁定：规则 10，All 6 acceptance commands pass. Implementation correctly adds exit-code judgement and secs= timing to preflight runner check, and smoke-failed early-exit to cli smoke. Tests use injected clocks, no real waiting, no existing assertions modified. No protected files or forbidden paths touched. CI status unknown — deferred to R2.
- 提交：`00e6cec`
- 验收命令：6/6 通过
  - `npm run lint` → exit 0，All matched files use Prettier code style!
  - `npm run typecheck` → exit 0，> tsc -p tsconfig.json
  - `npm test` → exit 0，1459 passed, 0 failed
  - `npm test -- test/preflight.test.ts test/cli.test.ts test/scenario-m.test.ts test/follow.test.ts` → exit 0，76 passed, 0 failed
  - `grep -qF "preflight: runner check judges the exit code" test/preflight.test.ts && grep -qF "smoke exits 1 when the runner returns a non-zero exit code" test/cli.test.ts` → exit 0，exit 0
  - `grep -vE "^\s*(//|\*|/\*)" src/cli.ts | grep -qF "smoke failed" && grep -vE "^\s*(//|\*|/\*)" src/preflight.ts | grep -qF "stopReason"` → exit 0，exit 0
- 已推送：是
- CI：success，监听分支一致，https://github.com/CIPFZ/Collie/actions/runs/44855177518
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：0

### v046-b26 · r-20261121060449 · PASS

- 时间：2026-11-21T06:29:11.281Z
- 裁定：规则 10，All 8 acceptance commands pass. Three runner scenarios (api_error, interrupted+api_error, error without terminal_reason) tested and passing. Three queue scenarios (api_error→wait→retry→PASS, double api_error→blocked, idling→no wait) tested and passing. Schema, template, CLI forwarding, and invariant all correct. No protected files modified, no forbidden files touched, no new dependencies, no existing assertions deleted or loosened.
- 提交：`4d17147`
- 验收命令：8/8 通过
  - `npm run lint` → exit 0，All matched files use Prettier code style!
  - `npm run typecheck` → exit 0，> tsc -p tsconfig.json
  - `npm test` → exit 0，1470 passed, 0 failed
  - `npm test -- test/runner-claude.test.ts test/api-error-retry.test.ts test/scenario-n.test.ts test/config.test.ts test/schema.test.ts` → exit 0，212 passed, 0 failed
  - `grep -qF "runner: api_error stop reason" test/runner-claude.test.ts && grep -qF "queue: api_error counts as a resumable interruption" test/api-error-retry.test.ts` → exit 0，exit 0
  - `grep -qE "^api_retry_wait_secs = 300" templates/collie.toml && ! grep -qF "api_retry_wait_secs" .collie/collie.toml` → exit 0，exit 0
  - `grep -vE "^\s*(//|\*|/\*)" src/runner/claude.ts | grep -qF "api_error" && grep -vE "^\s*(//|\*|/\*)" src/run.ts | grep -qF "api_error"` → exit 0，exit 0
  - `grep -qF "api_error" test/invariants.test.ts` → exit 0，exit 0
- 已推送：是
- CI：success，监听分支一致，https://github.com/CIPFZ/Collie/actions/runs/44875103627
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：0

### v046-b28 · r-20261121062915 · PASS

- 时间：2026-11-21T06:55:22.170Z
- 裁定：规则 10，全部验收命令通过；三个条目的结构与行为要求逐项核实均满足；无受保护文件被修改；无依赖变化；无断言删除或改松。CI 以 R2 取证为准。
- 提交：`b380fc1`
- 验收命令：5/5 通过
  - `npm run lint` → exit 0，All matched files use Prettier code style!
  - `npm run typecheck` → exit 0，> tsc -p tsconfig.json
  - `npm test` → exit 0，1470 passed, 0 failed
  - `npm test -- test/reviewer-rerun.test.ts test/blocked-cleanup.test.ts` → exit 0，23 passed, 0 failed
  - `! grep -qE "gitignore.*note\.txt|note\.txt.*gitignore" test/blocked-cleanup.test.ts` → exit 0，exit 0
- 已推送：是
- CI：success，监听分支一致，https://github.com/CIPFZ/Collie/actions/runs/44877134934
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：0

### v046-b29 · r-20261121065526 · PASS

- 时间：2026-11-21T07:30:06.105Z
- 裁定：规则 10，All 7 acceptance commands pass. Implementation correctly adds rule9_same_head detection in runQueue after evidence_unavailable and before fix_max. Three test scenarios cover same-sha escalation, different-sha fallthrough, and PASS-after-rule9. No forbidden files modified, no new dependencies, no protected path changes. CI status unknown (no GitHub credentials); CI verification deferred to R2.
- 提交：`25e142f` `a11f950`
- 验收命令：7/7 通过
  - `npm run lint` → exit 0，All matched files use Prettier code style!
  - `npm run typecheck` → exit 0，> tsc -p tsconfig.json
  - `npm test` → exit 0，1474 passed, 0 failed
  - `e=$(mktemp) && GIT_CONFIG_GLOBAL=$e GIT_CONFIG_NOSYSTEM=1 npm test -- test/rule9-same-head.test.ts` → exit 0，3 passed, 0 failed
  - `grep -qF "queue: rule 9 twice on the same head_sha escalates" test/rule9-same-head.test.ts` → exit 0，exit 0
  - `grep -vE "^\s*(//|\*|/\*)" src/run.ts | grep -qF "rule9_same_head"` → exit 0，exit 0
  - `grep -qF "rule9_same_head" test/invariants.test.ts` → exit 0，exit 0
- 已推送：是
- CI：success，监听分支一致，https://github.com/CIPFZ/Collie/actions/runs/44879942539
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：0

### v046-b30 · r-20261121120444 · PASS

- 时间：2026-11-21T12:31:29.812Z
- 裁定：规则 10，All 5 acceptance commands pass. Code changes are scoped precisely to the 3 task items: rule9_same_head now compares only this run's ci.resolved head_sha against prior rule9 runs (excluding current), api_error retry always records waited_secs (including 0), and two new correctly-named test cases verify the behavior. No protected files modified, no dependency changes, no existing assertions altered. CI verification deferred to R2.
- 提交：`c6a7e2b`
- 验收命令：5/5 通过
  - `npm run lint` → exit 0，All matched files use Prettier code style!
  - `npm run typecheck` → exit 0，> tsc -p tsconfig.json
  - `npm test` → exit 0，1482 passed, 0 failed
  - `e=$(mktemp) && GIT_CONFIG_GLOBAL=$e GIT_CONFIG_NOSYSTEM=1 npm test -- test/rule9-same-head.test.ts test/api-error-retry.test.ts` → exit 0，8 passed, 0 failed
  - `grep -qF "second queue with a new head_sha is retried, then escalates on its own repeat" test/rule9-same-head.test.ts && grep -qF "api_error with api_retry_wait_secs = 0 still records waited_secs: 0" test/api-error-retry.test.ts` → exit 0，exit 0
- 已推送：是
- CI：success，监听分支一致，https://github.com/CIPFZ/Collie/actions/runs/44903835275
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：0

### v046-b31 · r-20261121123134 · PASS

- 时间：2026-11-21T12:50:59.644Z
- 裁定：规则 10，All 7 acceptance commands pass. Three protected paths added to PROTECTED_PATHS, three mutation items added (total 46), three test files updated as specified. No protected files modified, no dependency changes, no scope creep. CI conclusion unknown — CI verification deferred to R2.
- 提交：`3eab3fe`
- 验收命令：7/7 通过
  - `npm run lint` → exit 0，All matched files use Prettier code style!
  - `npm run typecheck` → exit 0，> tsc -p tsconfig.json
  - `npm test` → exit 0，1486 passed, 0 failed
  - `npm test -- test/evidence.test.ts test/mutation.test.ts` → exit 0，52 passed, 0 failed
  - `grep -qF "'.github'," src/evidence.ts && grep -qF "'eslint.config.js'," src/evidence.ts && grep -qF "'vitest.config.ts'," src/evidence.ts && grep -qF "as protected (SPEC 16.21)" test/evidence.test.ts` → exit 0，exit 0
  - `out=$(npx tsx scripts/mutation.ts 2>&1) && printf '%s\n' "$out" | tail -n 1 | grep -qE "^mutation: caught 46 survived 0 invalid 0 timeout 0 stale 0$" && ! test -e .vitest` → exit 0，exit 0
  - `grep -qF "in PROTECTED_PATHS (v046-b31)" test/invariants.test.ts` → exit 0，exit 0
- 已推送：是
- CI：success，监听分支一致，https://github.com/CIPFZ/Collie/actions/runs/44904663150
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：0

### v046-b32 · r-20261121125105 · PASS

- 时间：2026-11-21T13:45:28.625Z
- 裁定：规则 10，全部 9 条验收命令通过，受保护文件零改动，无新依赖，diff 范围在条目之内，条目要求与额外禁止逐条核对均满足，已有断言零修改。CI 以 R2 取证为准。
- 提交：`d1f1646` `0885886`
- 验收命令：9/9 通过
  - `npm run lint` → exit 0，All matched files use Prettier code style!
  - `npm run typecheck` → exit 0，> tsc -p tsconfig.json
  - `npm test` → exit 0，1506 passed, 0 failed
  - `e=$(mktemp) && GIT_CONFIG_GLOBAL=$e GIT_CONFIG_NOSYSTEM=1 npm test -- test/batch-authorisation.test.ts` → exit 0，3 passed, 0 failed
  - `npm test -- test/backlog.test.ts test/task-envelope.test.ts test/evidence.test.ts test/batch-authorisation.test.ts` → exit 0，278 passed, 0 failed
  - `grep -qF "backlog: allowed protected paths" test/backlog.test.ts && grep -qF "batch authorisation: named protected paths do not count" test/batch-authorisation.test.ts` → exit 0，exit 0
  - `grep -vE "^\s*(//|\*|/\*)" src/backlog.ts | grep -qF "可改的受保护路径" && grep -vE "^\s*(//|\*|/\*)" src/run.ts | grep -qF "authorized_diff_lines"` → exit 0，exit 0
  - `out=$(npx tsx scripts/mutation.ts 2>&1) && printf '%s\n' "$out" | tail -n 1 | grep -qE "^mutation: caught 46 survived 0 invalid 0 timeout 0 stale 0$" && ! test -e .vitest` → exit 0，exit 0
  - `grep -qF "authorized_diff_lines" test/invariants.test.ts` → exit 0，exit 0
- 已推送：是
- CI：success，监听分支一致，https://github.com/CIPFZ/Collie/actions/runs/44907675133
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：0

### v046-b33 · r-20261123044708 · PASS

- 时间：2026-11-23T05:04:59.206Z
- 裁定：规则 10，All 4 acceptance commands pass. Single commit changes only the two timeout values and one comment in vitest.config.ts (authorized protected path), exactly matching SPEC 16.22 and task requirements. No forbidden paths touched, no dependency changes, no scope creep. CI status unknown — to be verified by R2.
- 提交：`80e845a`
- 验收命令：5/5 通过
  - `npm run lint` → exit 0，All matched files use Prettier code style!
  - `npm run typecheck` → exit 0，> tsc -p tsconfig.json
  - `npm test` → exit 0，1510 passed, 0 failed
  - `npm run test:mutation` → exit 0，mutation: caught 46 survived 0 invalid 0 timeout 0 stale 0
  - `grep -qE "testTimeout: 300_000" vitest.config.ts && grep -qE "hookTimeout: 300_000" vitest.config.ts` → exit 0，exit 0
- 已推送：是
- CI：success，监听分支一致，https://github.com/CIPFZ/Collie/actions/runs/45114575673
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：0

### v046-b34 · r-20261123050505 · PASS

- 时间：2026-11-23T05:26:52.885Z
- 裁定：规则 10，All 4 acceptance commands pass. Two minimal, precisely scoped changes: error message wording updated in src/backlog.ts:418, traditional-to-simplified Chinese fix in src/evidence.ts:103. No protected files modified, no dependency changes, no existing test assertions altered, no scope creep. CI status unknown — to be verified by R2.
- 提交：`43cc794`
- 验收命令：5/5 通过
  - `npm run lint` → exit 0，All matched files use Prettier code style!
  - `npm run typecheck` → exit 0，> tsc -p tsconfig.json
  - `npm test` → exit 0，1520 passed, 0 failed
  - `npm run test:mutation` → exit 0，mutation: caught 46 survived 0 invalid 0 timeout 0 stale 0
  - `npm test -- test/acceptance/v046-b34` → exit 0，10 passed, 0 failed
- 已推送：是
- CI：success，监听分支一致，https://github.com/CIPFZ/Collie/actions/runs/45116711869
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：0

### v046-b35 · r-20261123083637 · PASS

- 时间：2026-11-23T09:10:37.792Z
- 裁定：规则 10，全部验收命令通过；worker 仅改 src/run.ts，改动完全在条目范围内；已有断言零修改；受保护文件零改动；情形验收测试 8/8 全过。CI 以 R2 取证为准。
- 提交：`dc2811c`
- 验收命令：5/5 通过
  - `npm run lint` → exit 0，All matched files use Prettier code style!
  - `npm run typecheck` → exit 0，> tsc -p tsconfig.json
  - `npm test` → exit 0，1532 passed, 0 failed
  - `npm run test:mutation` → exit 0，mutation: caught 46 survived 0 invalid 0 timeout 0 stale 0
  - `npm test -- test/acceptance/v046-b35` → exit 0，8 passed, 0 failed
- 已推送：是
- CI：success，监听分支一致，https://github.com/CIPFZ/Collie/actions/runs/45142770486
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：0

### v046-b36 · r-20261123091042 · PASS

- 时间：2026-11-23T09:54:12.880Z
- 裁定：规则 10，全部验收命令通过；schema 正确添加可选 disputed_tests（strict、NonEmptyString）；run.ts 上报路径正确实现（不拉 reviewer、BLOCK exit 20、r2Commit + push、--continue 记 blocked）；复用 escalationDecision 和 emptyEvidence；invariant 上限 8→9 为条目授权；无受保护文件/禁止文件/依赖变动。CI 以 R2 取证为准。
- 提交：`d466d1c`
- 验收命令：5/5 通过
  - `npm run lint` → exit 0，All matched files use Prettier code style!
  - `npm run typecheck` → exit 0，> tsc -p tsconfig.json
  - `npm test` → exit 0，1541 passed, 0 failed
  - `npm run test:mutation` → exit 0，mutation: caught 46 survived 0 invalid 0 timeout 0 stale 0
  - `npm test -- test/acceptance/v046-b36` → exit 0，9 passed, 0 failed
- 已推送：是
- CI：success，监听分支一致，https://github.com/CIPFZ/Collie/actions/runs/45148816905
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：0

### v046-b37 · r-20261123115255 · BLOCK

- 时间：2026-11-23T12:20:45.720Z
- 裁定：上报：worker 认为验收测试有错 — acceptance_disputed: test/acceptance/v046-b37/new.test.ts: S4: output_tail with triple backticks renders with 4-backtick fences
- 提交：`b86382a` `3bcbb9c` `23a87db`
- 验收命令：0/0 通过
- 已推送：是
- CI：unknown，监听分支未能取证
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：0

### v046-b39 · r-20261123141659 · PASS

- 时间：2026-11-23T14:41:38.252Z
- 裁定：规则 10，全部验收命令通过，9 个情形各有至少一条用例且全部实跑通过（40 条断言），仅新增 test/output-tail.test.ts 一个文件，无受保护路径改动，无依赖变更。CI 以 R2 取证为准。
- 提交：`8838cd4`
- 验收命令：6/6 通过
  - `npm run lint` → exit 0，All matched files use Prettier code style!
  - `npm run typecheck` → exit 0，> tsc -p tsconfig.json
  - `npm test` → exit 0，1556 passed, 0 failed
  - `npm run test:mutation` → exit 0，mutation: caught 46 survived 0 invalid 0 timeout 0 stale 0
  - `npm test -- test/output-tail.test.ts test/acceptance/v046-b35` → exit 0，17 passed, 0 failed
  - `grep -qF "output_tail: per-stream tail and fence width (SPEC 16.25)" test/output-tail.test.ts` → exit 0，exit 0
- 已推送：是
- CI：success，监听分支一致，https://github.com/CIPFZ/Collie/actions/runs/45194696530
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：0

### v046-b38 · r-20261123144144 · PASS

- 时间：2026-11-23T15:07:36.842Z
- 裁定：规则 10，CI 以 R2 取证为准。全部验收命令通过，重构正确保持了三条 escalation 路径的行为不变。不变量上限 9→7 是条目 2 明确要求的改严。
- 提交：`57866f6`
- 验收命令：7/7 通过
  - `npm run lint` → exit 0，All matched files use Prettier code style!
  - `npm run typecheck` → exit 0，> tsc -p tsconfig.json
  - `npm test` → exit 0，1556 passed, 0 failed
  - `npm run test:mutation` → exit 0，mutation: caught 46 survived 0 invalid 0 timeout 0 stale 0
  - `npm test -- test/exit-codes.test.ts test/scenario-e.test.ts test/tester-step.test.ts test/blocked-cleanup.test.ts test/acceptance/v046-b36` → exit 0，77 passed, 0 failed
  - `grep -vE "^\s*(//|\*|/\*)" src/run.ts | grep -cF "await push(" | grep -qx 7` → exit 0，exit 0
  - `grep -qF "toBeLessThanOrEqual(7)" test/invariants.test.ts` → exit 0，exit 0
- 已推送：是
- CI：success，监听分支一致，https://github.com/CIPFZ/Collie/actions/runs/45199295505
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：0

### v046-b40 · r-20261124040209 · PASS

- 时间：2026-11-24T04:43:41.091Z
- 裁定：规则 10，All 5 acceptance commands pass. All 3 items implemented correctly: BACKLOG_ARCHIVE_RELATIVE_PATH exported, loadBacklog merges archive when present, duplicate batch / invalid status errors with correct messages, PROTECTED_PATHS and mutation list updated, tests added per spec. No protected files modified, no new dependencies, no forbidden files touched. 测试缺口：验收测试未覆盖 blocked 作为归档文件的合法状态（MAP.md 假定只允许 passed），转 R1。CI 以 R2 取证为准。
- 提交：`85bdf6c`
- 验收命令：6/6 通过
  - `npm run lint` → exit 0，All matched files use Prettier code style!
  - `npm run typecheck` → exit 0，> tsc -p tsconfig.json
  - `npm test` → exit 0，1569 passed, 0 failed
  - `npm run test:mutation` → exit 0，mutation: caught 47 survived 0 invalid 0 timeout 0 stale 0
  - `npm test -- test/acceptance/v046-b40` → exit 0，9 passed, 0 failed
  - `grep -qF "protected:docs/backlog-archive.md" scripts/mutation.ts` → exit 0，exit 0
- 已推送：是
- CI：success，监听分支一致，https://github.com/CIPFZ/Collie/actions/runs/45326902806
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：0

### v046-b41 · r-20261124060256 · PASS

- 时间：2026-11-24T06:32:28.984Z
- 裁定：规则 10，All 5 acceptance commands pass. Worker changes are strictly scoped to src/cli.ts (shared tryLoadBacklog function used by status/why/report) and scripts/mutation.ts (comment number 11→14). No protected paths modified by worker, no dependency changes, no existing assertions altered. All 8 scenarios (S1-S4 new, K1-K4 keep) verified via acceptance tests. CI status unknown — deferred to R2.
- 提交：`052d680`
- 验收命令：6/6 通过
  - `npm run lint` → exit 0，All matched files use Prettier code style!
  - `npm run typecheck` → exit 0，> tsc -p tsconfig.json
  - `npm test` → exit 0，1581 passed, 0 failed
  - `npm run test:mutation` → exit 0，mutation: caught 47 survived 0 invalid 0 timeout 0 stale 0
  - `npm test -- test/acceptance/v046-b41` → exit 0，8 passed, 0 failed
  - `grep -qF "Protected paths (14)" scripts/mutation.ts` → exit 0，exit 0
- 已推送：是
- CI：success，监听分支一致，https://github.com/CIPFZ/Collie/actions/runs/45339522069
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：0

### v046-b42 · r-20261124063235 · PASS

- 时间：2026-11-24T07:03:29.540Z
- 裁定：规则 10，CI 以 R2 取证为准。全部验收命令通过，实现符合条目要求，无受保护文件改动，无依赖变化，无范围蔓延。
- 提交：`aaf78da`
- 验收命令：6/6 通过
  - `npm run lint` → exit 0，All matched files use Prettier code style!
  - `npm run typecheck` → exit 0，> tsc -p tsconfig.json
  - `npm test` → exit 0，1587 passed, 0 failed
  - `npm run test:mutation` → exit 0，mutation: caught 47 survived 0 invalid 0 timeout 0 stale 0
  - `npm test -- test/acceptance/v046-b42` → exit 0，6 passed, 0 failed
  - `grep -qE "^# smoke_max_secs = 60" templates/collie.toml && ! grep -qE "^smoke_max_secs" templates/collie.toml && ! grep -qF "smoke_max_secs" .collie/collie.toml` → exit 0，exit 0
- 已推送：是
- CI：success，监听分支一致，https://github.com/CIPFZ/Collie/actions/runs/45343420346
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：0

### v046-b43 · r-20261124080901 · BLOCK

- 时间：2026-11-24T09:19:06.522Z
- 裁定：上报：无 report — no valid report: /data/workspace/Collie/.collie/batches/v046-b43/report.md: cannot read report: ENOENT: no such file or directory, open '/data/workspace/Collie/.collie/batches/v046-b43/report.md'
- 提交：`ed433b8` `9381223`
- 验收命令：0/0 通过
- 已推送：否
- CI：unknown，监听分支未能取证
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：1（wallclock）

### v046-b43 · r-20261124091911 · FIX

- 时间：2026-11-24T10:09:59.014Z
- 裁定：规则 6，claimed test counts differ from "npm test" as run by the reviewer
- 提交：`9381223` `90e25a6`
- 验收命令：6/7 通过
  - `npm run lint` → exit 0，All matched files use Prettier code style!
  - `npm run typecheck` → exit 0，> tsc -p tsconfig.json
  - `npm test` → exit 1，1598 passed, 1 failed, 1 test files failed
  - `npm run test:mutation` → exit 0，mutation: caught 47 survived 0 invalid 0 timeout 0 stale 0
  - `npm test -- test/acceptance/v046-b43` → exit 0，8 passed, 0 failed
  - `grep -vE "^\s*(//|\*|/\*)" src/run.ts | grep -qF "reviewer.skipped" && grep -qF "reviewer.skipped" src/schema/index.ts` → exit 0，exit 0
  - `grep -qF "records reviewer.skipped (v046-b43)" test/invariants.test.ts` → exit 0，exit 0
- 已推送：是
- CI：failure，监听分支一致，https://github.com/CIPFZ/Collie/actions/runs/45366177169
- 受保护文件改动行数：0
- 依赖变化：无
- 声称与实测不符：tests
- worker 退出码：0

### v046-b43 · r-20261124101003 · PASS

- 时间：2026-11-24T10:46:49.700Z
- 裁定：规则 10，All 6 acceptance commands pass. Implementation matches SPEC 16.29: evidence collection moved before reviewer, pre-arbitration with synthetic PASS verdict, reviewer.skipped event recorded when non-PASS, assumed:true on verdict.downgraded. src/arbiter.ts unchanged. All test changes within allowed categories (a)(b)(c). Guard tests (rule9-same-head, scenario-l, queue-limit) pass. Mutation check: 47 caught, 0 stale. No protected files modified, no new dependencies. CI 以 R2 取证为准。
- 提交：`9381223` `90e25a6` `ffada9a`
- 验收命令：7/7 通过
  - `npm run lint` → exit 0，All matched files use Prettier code style!
  - `npm run typecheck` → exit 0，> tsc -p tsconfig.json
  - `npm test` → exit 0，1599 passed, 0 failed
  - `npm run test:mutation` → exit 0，mutation: caught 47 survived 0 invalid 0 timeout 0 stale 0
  - `npm test -- test/acceptance/v046-b43` → exit 0，8 passed, 0 failed
  - `grep -vE "^\s*(//|\*|/\*)" src/run.ts | grep -qF "reviewer.skipped" && grep -qF "reviewer.skipped" src/schema/index.ts` → exit 0，exit 0
  - `grep -qF "records reviewer.skipped (v046-b43)" test/invariants.test.ts` → exit 0，exit 0
- 已推送：是
- CI：success，监听分支一致，https://github.com/CIPFZ/Collie/actions/runs/45374395888
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：0

### v046-b44 · r-20261124125102 · PASS

- 时间：2026-11-24T13:28:27.219Z
- 裁定：规则 10，CI 以 R2 取证为准。全部验收命令通过，条目要求与额外禁止逐项核对均满足，同步逻辑正确抽取为函数复用，无受保护文件改动，无依赖变化，无测试修改。
- 提交：`acfaf3a`
- 验收命令：5/5 通过
  - `npm run lint` → exit 0，All matched files use Prettier code style!
  - `npm run typecheck` → exit 0，> tsc -p tsconfig.json
  - `npm test` → exit 0，1610 passed, 0 failed
  - `npm run test:mutation` → exit 0，mutation: caught 47 survived 0 invalid 0 timeout 0 stale 0
  - `npm test -- test/acceptance/v046-b44` → exit 0，5 passed, 0 failed
- 已推送：是
- CI：success，监听分支一致，https://github.com/CIPFZ/Collie/actions/runs/45401227373
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：0

### v046-b45 · r-20261124132831 · PASS

- 时间：2026-11-24T14:02:45.283Z
- 裁定：规则 10，CI 以 R2 取证为准。全部验收命令通过，条目要求与额外禁止逐条核对均满足，6 条情形的验收测试全部通过且对照情形描述覆盖正确，无已有测试改动，无受保护路径改动，无依赖变化。
- 提交：`4e1cf80`
- 验收命令：5/5 通过
  - `npm run lint` → exit 0，All matched files use Prettier code style!
  - `npm run typecheck` → exit 0，> tsc -p tsconfig.json
  - `npm test` → exit 0，1616 passed, 0 failed
  - `npm run test:mutation` → exit 0，mutation: caught 47 survived 0 invalid 0 timeout 0 stale 0
  - `npm test -- test/acceptance/v046-b45` → exit 0，6 passed, 0 failed
- 已推送：是
- CI：success，监听分支一致，https://github.com/CIPFZ/Collie/actions/runs/45407042763
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：0

### v046-b46 · r-20261124140249 · PASS

- 时间：2026-11-24T14:38:34.965Z
- 裁定：规则 10，All 4 acceptance commands exit 0; 1624 tests pass across 94 files; commit fca77e2 pushed to remote (ancestor of remote main 059939c); no protected files modified; no dependency changes; implementation matches SPEC 16.30 format exactly; only the allowed test assertion was modified (reviewer-isolation adding 'evidence'); CI 以 R2 取证为准。
- 提交：`fca77e2`
- 验收命令：5/5 通过
  - `npm run lint` → exit 0，All matched files use Prettier code style!
  - `npm run typecheck` → exit 0，> tsc -p tsconfig.json
  - `npm test` → exit 0，1624 passed, 0 failed
  - `npm run test:mutation` → exit 0，mutation: caught 47 survived 0 invalid 0 timeout 0 stale 0
  - `npm test -- test/acceptance/v046-b46` → exit 0，8 passed, 0 failed
- 已推送：是
- CI：success，监听分支一致，https://github.com/CIPFZ/Collie/actions/runs/45413531357
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：0

### v046-b47 · r-20261125042926 · PASS

- 时间：2026-11-25T04:57:20.498Z
- 裁定：规则 10，CI 以 R2 取证为准。全部验收命令通过，代码改动精确匹配 SPEC 16.31 要求，无 evidence 时提示词不变，6 条情形验收测试全部通过且守得住。
- 提交：`0dd48b1`
- 验收命令：5/5 通过
  - `npm run lint` → exit 0，All matched files use Prettier code style!
  - `npm run typecheck` → exit 0，> tsc -p tsconfig.json
  - `npm test` → exit 0，1634 passed, 0 failed
  - `npm run test:mutation` → exit 0，mutation: caught 47 survived 0 invalid 0 timeout 0 stale 0
  - `npm test -- test/acceptance/v046-b47` → exit 0，6 passed, 0 failed
- 已推送：是
- CI：success，监听分支一致，https://github.com/CIPFZ/Collie/actions/runs/45548648687
- 受保护文件改动行数：0
- 依赖变化：无
- worker 退出码：0
<!-- collie:runs:end -->
