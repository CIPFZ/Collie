# 批次 v01-b05 汇报

## 做了什么

本批次没有 R2 签发的 `task.md`，按 `docs/backlog.md` 的 v01-b05 小节和项目所有者在对话中的逐项裁决执行，`base_sha` 取 `545ceb1`。

共 6 个代码提交，每个都在推送后确认了自己的 CI，才推下一个：

| 提交 | scope | 条目 | 内容 |
|---|---|---|---|
| `e4555c8` | runner | 1 | `src/runner/claude.ts` |
| `4719412` | cli | 2 | 默认真实 runner，`--runner fake` |
| `da7cf65` | config | 2a | `permission_mode` |
| `1459299` | arbiter | 2b | 认可依赖清单加回 SDK |
| `0af10f5` | ci | 2c | 取证前等 CI |
| `54fa8de` | runner | — | 安装 SDK 0.3.303 |

另有一个 R2 提交 `9e377e8`（烟雾批次的 task 信封，由 `collie run` 生成，已推送）。

**条目 1：`ClaudeRunner`**
- 用 SDK 的 `query()` 实现 `AgentRunner`：
  - model、工具白名单、轮数上限取自 `collie.toml` 里对应角色的配置。调用方只能把 `maxTurns` 调低、把工具收窄；越出白名单直接拒绝。
  - `settingSources: []`：不加载本机的 CLAUDE.md、settings、hooks。
  - 调用方的 signal 会中止 SDK 的 `abortController`；已经被取消的运行根本不会发起。
  - 每条消息都经 `onEvent` 转出；只有成功的 result 才产出 `finalText`。
- `query()` 是注入的，22 个单元测试全部用脚本替身，不加载 SDK、不联网。4 处变异都会让测试失败。
- SDK 包名只在 `claude.ts` 里写一次（`CLAUDE_SDK_PACKAGE`），由它懒加载；`run.ts` 引用这个常量（已获批准）。

**条目 2 / 2a / 2b / 2c**
- **CLI**：`collie run` 默认用真实 runner；`--runner claude|fake` 可覆盖，未知名字报错；测试注入的 runner 不受这个开关影响。
- **2a**：`AgentConfigSchema.permission_mode` 为可选，取值 default / acceptEdits / bypassPermissions。`ClaudeRunner` 从配置读取，只有 bypass 才附带 SDK 要求的 `allowDangerouslySkipPermissions`。`collie.toml` 的两行和 init 模板与 schema 在同一个提交里修改（按授权）。
- **2b**：仲裁规则 3 的认可依赖清单加回了 SDK。
- **2c**：`waitForCi`：
  - 轮询的结束条件是期望分支上不再有进行中的运行、并且 GitHub 已经为这个 sha 建了运行。只在其他分支上有运行的情况视为已经有结论，不再等——等下去也改变不了分支不对这件事。
  - 上限是 `limits.ci_wait_secs`，间隔是 `limits.ci_poll_secs`（这一项按你的选择新增，R1 已补进 SPEC 3.1）；遇到限流会在截止时间内等到重置。
  - R2 只在 `head_sha` 确实已推送时才等；没推送的提交永远不会有 CI，查一次就结束。
  - 超时后 CI 记为 `unknown` / `null`，并写入新增事件 `ci.wait_timeout`，字段为 head_sha、waited_secs、polls、last_state（SPEC 3.6 已由 R1 补上；`polls` 是我额外加的）。
  - 测试用假时钟和 fetch 替身覆盖了：先 pending 后 success、超时、限流、只在其他分支有运行、未推送不等待。3 处变异都会让测试失败。
- **安装 SDK**：0.3.303。运行时依赖从 5 个增加到 109 个（不算可选的平台二进制包）。白名单外只有 `@opentelemetry/api` 和 `fast-sha256`，已由 ADR-004 补充条款豁免，Collie 的代码不 import 它们（新增的那条验收 grep 为 exit 0）。

**条目 3：烟雾批次。这是两次运行，都如实记录在下面**

运行前我做了两项准备，都没有往仓库写任何东西：
- 用 reviewer 角色、空目录、单轮跑了一次 SDK 预检：4.3 秒，模型 `claude-opus-4-6` 可用，在嵌套环境里能正常拉起，`finalText="OK"`。
- `origin` 是 HTTPS 地址，本机没有 GitHub 的 HTTPS 凭据，worker 一推送就会卡住。我用 git 的环境变量配置（`GIT_CONFIG_COUNT` 设置 pushurl，加上 `GIT_SSH_COMMAND`）为这次运行提供 SSH 推送，`.git/config` 没有改动。推送的 dry-run 已验证可行。

**第 1 次运行 `r-20261020-051154`：被中断，不是 Collie 给出的结果**
- 我在会话里用后台任务启动它，上一个会话结束时，进程随会话一起被杀掉了。这是我的操作失误。
- journal 只到 `worker.started`（05:11:54），没有任何终止事件，因为 Collie 自己也被杀掉了。
- 当时 worker 已经在 README 末尾追加了要求的那一行，但没有提交，也没写 report。task 提交 `b76d935` 只在本地。
- 经你同意后，我把现场归档到 `/tmp/smoke-interrupted/`（journal、task.md、README 的 diff、git 状态），然后还原了 README，丢弃了从未推送的 `b76d935`。这次运行的 journal 仍保留在 `.collie/runs/`（不入库），`collie show` 也会显示它。

**第 2 次运行 `r-20261020-060511`：结果为 BLOCK（退出码 20）。这就是第一个真实样本，没有重跑**
- 这次用 `setsid nohup` 启动，脱离了会话。
- 完整 journal：

| 时间（UTC） | 事件 | 内容 |
|---|---|---|
| 06:05:11 | `run.started` | |
| 06:05:11 | `batch.selected` | base_sha=`54fa8de` |
| 06:05:11 | `batch.task_written` | commit=`9e377e8` |
| 06:05:11 | `worker.started` | |
| 06:05:58 | `worker.finished` | exit_code=0 |
| 06:05:58 | `escalated` | no valid report：report.md 不存在（ENOENT） |
| 06:05:58 | `run.finished` | verdict=BLOCK，exit_code=20 |

- worker 只跑了 47 秒，退出码是 0，**没有改动任何文件、没有提交、没有写 report**（运行后 `git status` 是干净的）。
- 按 SPEC 6，没有 report 就记 `escalated` 并以 20 退出，reviewer 没有被拉起，所以**没有 verdict.md**；这条路径也不写 progress。
- 落盘的只有：task 信封（`9e377e8`，已推送，CI 为 success）和 journal（`.collie/runs/` 不入库，完整内容见上表）。

## 测试结果

在 `/tmp` 下全新 clone 到 `9e377e8`、执行 `npm ci` 之后，**用 Collie 的 `verify.ts` 运行 `parseBacklog` 解析出的 v01-b05 验收命令**：

| 命令 | 退出码 | 摘要 |
|---|---|---|
| `npm run lint` | 0 | `All matched files use Prettier code style!` |
| `npm run typecheck` | 0 | — |
| `npm test` | 0 | `493 passed, 0 failed` |
| `! grep -rlE "@anthropic-ai" src --include='*.ts' \| grep -v '^src/runner/'` | 0 | — |
| `! grep -rlE "@opentelemetry\|fast-sha256" src --include='*.ts'` | 0 | — |
| `npm test -- test/runner-claude.test.ts` | 0 | `22 passed, 0 failed` |
| `test -f .collie/batches/v01-b05-smoke/verdict.md` | **1** | **验收不通过：烟雾批次在 reviewer 之前就升级了，没有产生 verdict** |

全量共 24 个测试文件、493 个用例，失败 0。

**CI**：6 个代码提交全部为 push / main / success。

| sha | run |
|---|---|
| `e4555c8` | https://github.com/CIPFZ/Collie/actions/runs/39269722603 |
| `4719412` | https://github.com/CIPFZ/Collie/actions/runs/39270001140 |
| `da7cf65` | https://github.com/CIPFZ/Collie/actions/runs/39278669170 |
| `1459299` | https://github.com/CIPFZ/Collie/actions/runs/39280540113 |
| `0af10f5` | https://github.com/CIPFZ/Collie/actions/runs/39373039296 |
| `54fa8de` | https://github.com/CIPFZ/Collie/actions/runs/39373328110 |

- R2 的提交 `9e377e8`：https://github.com/CIPFZ/Collie/actions/runs/39378956406 ，success。
- `54fa8de` 是用 `ci.ts` 调 REST API 查到的；其余因为 API 被限流，读的是 GitHub Actions 公开网页内嵌的 JSON（只是我本地的辅助脚本，不是 Collie 的代码）。

**受保护文件**：6 个代码提交都没有触及 SPEC、CONSTRAINTS、ROADMAP、ROLES、`AGENT-*`、README、`docs/`、`.collie/batches/`。`.collie/collie.toml` 只在 `da7cf65`（2a）和 `0af10f5`（2c）里修改，两处都有你的授权。

**推送**：`origin/main` 等于 `9e377e8`。

## 偏离或疑问

1. **【最重要：这个样本说明的问题】worker 手册与无人值守运行冲突。**
   - `AGENT-worker.md` 是 worker 的 system prompt，它的 §6 要求「输出执行计划……计划确认前不要写任何代码，也不要创建任何文件」。
   - 在 headless 运行里没有人来确认，worker 遵守这一条，输出计划后正常结束（退出码 0）。这和观察到的现象完全吻合：47 秒、零改动、没有 report。第 1 次运行的 worker 改了 README，说明模型有时会无视这一条，所以行为并不稳定。
   - **这是推断**：worker 的最终回复没有被记录（见第 2 条），SDK 在隔离模式下也没有留会话记录，我没法直接证实。
   - 建议 R1 二选一：在 `AGENT-worker.md` 里区分「交互模式」和「collie run 模式」；或者让 `buildTask` 的正文写明「本次由 collie run 无人值守签发，计划无需确认，直接执行」。不过信封里的话能不能覆盖 system prompt 的要求，并不确定。

2. **【R2 的盲区】worker 的最终回复没有落盘。**
   - `run.ts` 只记录了 worker 的 `exit_code`，没有 `finalText`，也没有消息流（`stream.ndjson` 属于 v0.2）。
   - 结果是这次 BLOCK 的原因在 journal 里只剩「没有 report」，worker 实际说了什么完全找不到。
   - 建议至少把 worker 的 `finalText`（截断后）写进 `worker.finished` 事件；按 SPEC 3.6，事件的扩展字段可以承载它。

3. **【验收】`test -f verdict.md` 未通过，b05 不能判 PASS。** 只要 worker 不产出 report，SPEC 6 就会在 reviewer 之前升级，烟雾批次就不会有 verdict。这条验收要在第 1 条解决之后才可能通过。按你「不要重跑」的要求，我没有为了让它通过而再跑。

4. **运行留下的状态**：
   - `9e377e8` 已推送；它只包含 task 信封，CI 通过。
   - `.collie/runs/` 下有两次运行的 journal（不入库）；中断那次的现场另外归档在 `/tmp/smoke-interrupted/`。
   - backlog 里 v01-b05-smoke 的状态仍是 `pending`。R2 写 backlog 状态的功能还没有实现，这个文件也是 R1 的。

5. **过程中的失误**：第 1 次运行被我自己的会话结束中断了（见上）。之后真实运行一律用 `setsid nohup` 脱离会话启动。

6. **提醒**：中断的那次运行，正好是 v0.2「不丢」要处理的场景：没有终止事件、工作区有半成品、task 提交只在本地。可以拿它作为 v0.2 的第一个测试素材。

## 下一步建议

1. 先解决第 1、2 条，它们决定了 Collie 能不能真正无人值守地干活：
   - 改 worker 手册或 task 正文，使 `collie run` 模式下无需等待计划确认；
   - 让 R2 记录 worker 的 `finalText`。
   - 这两件事做完后，再跑一次烟雾批次，b05 才有可能 PASS。
2. 是否把 `stream.ndjson` 落盘（v0.2）提前一部分，请 R1 判断。这次只要有它，原因就能当场确认。
3. 在 v0.2 由 Collie 自己签发第一个任务之前，上面第 1 条必须先解决，否则 worker 会每次都停在出计划这一步。

```json
{
  "schema_version": 1,
  "batch_id": "v01-b05",
  "head_sha": "54fa8decbee73d1f76ad336d53120fd39c4cf0e4",
  "claims": {
    "commits": [
      "e4555c8a20343bcb6fa2730a298ef865407aab74",
      "4719412c7ad3090761fbb24c13533a099f643770",
      "da7cf652f06f544086cca4773835070e47b7c968",
      "14592992469e91d9cfd614be94d3d761f1a0295a",
      "0af10f5d06e91595613cc320b31ee5131df2d449",
      "54fa8decbee73d1f76ad336d53120fd39c4cf0e4"
    ],
    "tests_passed": 493,
    "tests_failed": 0,
    "pushed": true,
    "ci_passed": true,
    "new_deps": ["@anthropic-ai/claude-agent-sdk"],
    "spec_touched": false
  },
  "open_questions": [
    "The real smoke run BLOCKed in 47s: the worker exited 0 with no changes and no report. AGENT-worker.md section 6 (its system prompt) says to output a plan and write nothing until it is confirmed, which can never happen headless. Inferred, not proven: the worker's final text is not recorded.",
    "R2 records only the worker's exit code; record its finalText (truncated) in worker.finished so a BLOCK like this is explainable from the journal?",
    "Acceptance 'test -f .collie/batches/v01-b05-smoke/verdict.md' fails: without a report, SPEC 6 escalates before the reviewer. Not re-run, per instruction.",
    "The first run (r-20261020-051154) was killed with my session; its state is archived in /tmp/smoke-interrupted and its unpushed task commit was discarded with the owner's consent."
  ]
}
```
