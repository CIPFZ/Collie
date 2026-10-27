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
<!-- collie:runs:end -->
