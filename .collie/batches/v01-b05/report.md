# 批次 v01-b05 汇报（第二版，2026-10-20，含第三次烟雾运行）

## 做了什么

本批次没有 R2 签发的 `task.md`，按 `docs/backlog.md` 的 v01-b05 小节和项目所有者在对话中的逐项裁决执行，`base_sha` 取 `545ceb1`。

共 7 个代码提交，每个都在推送后确认了自己的 CI，才推下一个：

| 提交 | scope | 条目 | 内容 |
|---|---|---|---|
| `e4555c8` | runner | 1 | `src/runner/claude.ts` |
| `4719412` | cli | 2 | 默认真实 runner，`--runner fake` |
| `da7cf65` | config | 2a | `permission_mode` |
| `1459299` | arbiter | 2b | 认可依赖清单加回 SDK |
| `0af10f5` | ci | 2c | 取证前等 CI |
| `54fa8de` | runner | — | 安装 SDK 0.3.303 |
| `0fe1d6e` | r2 | 2d | 本版新增：`issued_by: collie`、`final_text` |

**条目 1、2、2a、2b、2c**：与第一版一致，这里不再重复。要点如下：
- `ClaudeRunner` 的配置一律取自角色设置；调用方只能把轮数调低、把工具收窄。
- signal 透传给 SDK；只有成功的运行才产出 `finalText`。
- 22 个单元测试全部用替身，不加载 SDK。
- `waitForCi` 只在 `head_sha` 已推送时才等，超时记录 `ci.wait_timeout`。

**条目 2d（`0fe1d6e`，本版新增）**：
- `buildTask` 写入 `issued_by: collie`（SPEC 3.3），配合已修订的 `AGENT-worker.md` §6：无人值守时直接执行，不等计划确认。
- `worker.finished` 事件携带 `final_text`，即 worker 最终回复，按字形簇截断到 2000 字并附截断说明（SPEC 3.6）。用的是 Node 内置的 `Intl.Segmenter`，没有新增依赖；中文和组合 emoji 不会被截成两半。
- `collie show` 把 `final_text` 作为缩进块单独打印，不挤在事件行里。
- 3 处变异（去掉 `issued_by`、去掉 `final_text`、从不截断）都会让测试失败。全量 500 个测试通过。

**条目 3：烟雾批次。共三次运行，第三次是正式样本**

| 运行 | 结果 | 原因 |
|---|---|---|
| ① `r-20261020-051154` | 中断 | 我的会话结束时把进程一起杀掉了（见第一版） |
| ② `r-20261020-060511` | BLOCK（20） | worker 遵守旧手册 §6，出完计划就退出，没写 report |
| ③ `r-20261020-063533` | **PASS（0）** | 按 2d 修订后的运行，**只跑了一次，没有重跑** |

第 ③ 次运行的完整 journal（UTC）：

| 时间 | 事件 | 内容 |
|---|---|---|
| 06:35:33 | `run.started` → `batch.selected` → `batch.task_written` | base `0fe1d6e`，task 提交 `02e79d7` |
| 06:35:33 | `worker.started` | |
| 06:45:45 | `worker.finished` | exit 0；`final_text` 已记录（摘要见下） |
| 06:45:45 | `reviewer.started` | head_sha `b75aa31`，在 worktree 中运行 |
| 06:55:17 | `reviewer.verdict` | PASS |
| 07:26:46 | `ci.wait_timeout` | waited_secs=1800，polls=3，last_state=**rate_limited** |
| 07:26:46 | `run.finished` | verdict=PASS，exit_code=0 |

- **worker**：用时约 10 分钟。提交了 `b75aa31`（只改 README 两行：一个空行，加上指定的那一行），写了 report 并以 `report(collie): v01-b05-smoke`（`943c67b`）提交，然后**自己推送**到 GitHub。它的 `final_text` 如实写着「`npm test` exit 1：66 个测试失败，但这是 pre-existing 的」。
- **reviewer**：判 PASS，理由是「失败在 base_sha 就已存在，CI 上同一命令通过」。
- **R2**：
  - 实测 `npm test` → exit 1，434 passed、66 failed、7 个测试文件失败；其余 4 条命令都是 exit 0。
  - 已推送：是。
  - 受保护文件改动 0 行，依赖无变化。
  - CI：等满 1800 秒，三次查询都被限流，所以记为 `unknown` / `null`，并写了 `ci.wait_timeout` 事件。
- **arbiter**：规则 1～7 都没有命中，规则 8 采用了 reviewer 的 PASS。
- **落盘情况**：
  - 已推送（由 worker 推送）：`02e79d7` task、`b75aa31` README、`943c67b` report。CI：`b75aa31` 和 `943c67b` 都是 main / success；`02e79d7` 是和它们一起推上去的，没有自己的 CI 运行。
  - **当时只在本地、未推送**（后经裁定以 `8db55f7` 入库，见第四段第 4 条）：R2 的 `2279a85 progress: v01-b05-smoke PASS`，包含 verdict.md（202 行）和 progress.md 里的一条实测记录。`collie run` 本身不推送（SPEC 6）。按你「原样落盘」的要求，我没有改动它，也没有推送它，见第四段。

## 测试结果

v01-b05 的验收命令，在本地 `2279a85` 上用 Collie 的 `verify.ts` 运行（命令来自 `parseBacklog`）：

| 命令 | 退出码 |
|---|---|
| `npm run lint` | 0 |
| `npm run typecheck` | 0 |
| `npm test` | 0（`500 passed, 0 failed`） |
| SDK 包名不出现在 `src/runner/` 之外 | 0 |
| `@opentelemetry` / `fast-sha256` 不出现在 `src/` | 0 |
| `npm test -- test/runner-claude.test.ts` | 0（`22 passed, 0 failed`） |
| `test -f .collie/batches/v01-b05-smoke/verdict.md` | 0（**仅在本地成立**：verdict.md 在未推送的 `2279a85` 里） |

**CI**：
- 7 个代码提交全部为 push / main / success；`0fe1d6e` 是 https://github.com/CIPFZ/Collie/actions/runs/39381065027 ，其余 6 个见第一版。
- worker 推送的 `b75aa31`（https://github.com/CIPFZ/Collie/actions/runs/39381664783 ）和 `943c67b`（https://github.com/CIPFZ/Collie/actions/runs/39382264642 ）都是 success。

**受保护文件**：我的 7 个代码提交都没有触及受保护路径。`.collie/collie.toml` 只在 `da7cf65` 和 `0af10f5` 里修改，都有你的授权。

## 偏离或疑问

1. **【最重要：这次 PASS 是错的，需要你知道】验收命令 `npm test` 实际退出码为 1，仲裁仍然给了 PASS。**
   - **事实链**：
     - worker 如实声称 434 passed / 66 failed；R2 实测正好也是 434 / 66。
     - 所以规则 6（声称与实测不符）没有命中，因为这件事上 worker 没有说谎。
     - 规则 8 随后采用了 reviewer 的 PASS，而 reviewer 用「这些失败早就存在」把一条明确要求 `exit 0` 的验收说服了过去。
   - **漏洞在规则本身**：SPEC 4.3 的八条规则里，没有一条规定「R2 实测有验收命令不满足 expect 时，不得 PASS」。规则 5～7 只检查声称与实测不符，对「诚实地失败」无能为力，最后就由 reviewer 的判断兜底。这违背了 v01-b04 定下的原则：事实由 R2 测，reviewer 只贡献判断。
   - **建议 R1 增加一条规则**，例如插在规则 4 之后：R2 实测的任一验收命令不满足 expect 时，若 verdict 为 PASS，则降为 FIX。三场景测试没能发现这个漏洞，是因为每个场景里都有一个谎言；这一次 worker 是诚实的。

2. **【根因：66 个失败是我造成的，不是代码问题】**
   - 为了让 worker 能通过 SSH 推送，我在启动 `collie run` 时导出了 git 环境变量 `GIT_CONFIG_COUNT` / `remote.origin.pushurl`（指向真实的 GitHub）。
   - 这类变量对**所有** git 进程都生效，包括测试里临时创建、使用本地 bare 远端的仓库，于是它们的推送被改去推真实的 GitHub，结果失败。
   - **已复现**：在 `b75aa31` 的 worktree 里，不带这些变量是 500 个全部通过，带上这些变量正好是 66 failed / 7 个测试文件失败（evidence、cli、exit-codes、scenario-a/b/c 等）。
   - 因此 worker 的说法「pre-existing」和 reviewer 的「失败在 base 就存在」都只说对了一半：在那个环境下，base 上确实也会失败；但在干净的环境里根本不存在这些失败。两个 agent 都没能找到真正原因，倒是 R2 的实测忠实记录了它们。
   - **修正建议**：推送凭据只给 worker 进程，不进入 R2 的验收环境。最简单的做法是把 `origin` 的推送地址配进仓库的 `.git/config`（本机配置，不入库），而不是靠全局环境变量。这属于运行环境配置，不需要改代码。

3. **CI 证据的结论是「未能取证」，而不是「失败」。**
   - 整整 30 分钟 API 都处于限流状态，三次查询都被拒绝。`ci.ts` 按 2c 的设计，没有把它误判为成功或失败，而是记为 `unknown` / `null`。
   - worker 在这次运行里声称 `ci_passed=false`，所以规则 7 也没有命中。它在 report 正文里写了 CI 通过，但结构化的 claims 填的是 false，不过两者没有矛盾。
   - 这再次说明需要给环境配一个只读的 `GITHUB_TOKEN`。

4. **R2 的裁定提交（已裁定：原样入库）。** 推送前我把它 rebase 到了 R1 的 `ebc7742` 之上，以保持 main 是一条直线。改动内容与原提交逐字节相同（已用 `cmp` 核对 patch），作者和提交信息也不变，只有 sha 从 `2279a85` 变成了 `8db55f7`。以下是裁定前的原文：

   **未推送的 `2279a85` 需要你定。** 它是 R2 对这次运行的裁定记录（verdict 和 progress）。因为它记录的 PASS 是错的（见第 1 条），我没有替你决定要不要推送。可选方案：
   - 原样推送，作为「第一个真实样本」入库，再由 R1 在 progress 的人工部分注明「此 PASS 因规则缺口不成立」；
   - 只在本地保留，等规则修订后再处理。

5. **worker 手册的修订确实生效了。** 第 ② 次运行 47 秒就零产出退出；第 ③ 次运行 10 分钟里读文件、改 README、跑测试、写 report、提交、推送都做了，对 66 个失败也如实汇报。`final_text` 也已发挥作用：这次的全部原委都能从 journal 里直接读到。

6. **其他观察**：
   - 规则 6 只取第一条带测试计数的命令来比对，这次就是 `npm test`，没有问题。
   - worker 的 commit message 用的是 `docs:` scope，在铁律 20 的允许范围内。
   - reviewer 的 evidence 和 R2 的实测都一字不差地留在 verdict.md 和 progress 里，便于人工对照。

## 下一步建议

1. **先补规则缺口（第 1 条）**，再谈 b05 是否 PASS。按现在的规则，这次运行在形式上满足了验收（verdict.md 存在），但 PASS 本身不成立。
2. 在仓库的 `.git/config` 配好推送地址，替代全局环境变量（第 2 条）；同时配一个只读的 `GITHUB_TOKEN`（第 3 条）。
3. 在你决定 `2279a85` 怎么处理之后，如果要再跑一次烟雾批次验证修正结果，需要你明确同意。我不会自行重跑。

```json
{
  "schema_version": 1,
  "batch_id": "v01-b05",
  "head_sha": "0fe1d6ed002499fc8ff7016cdf605cb840a64799",
  "claims": {
    "commits": [
      "e4555c8a20343bcb6fa2730a298ef865407aab74",
      "4719412c7ad3090761fbb24c13533a099f643770",
      "da7cf652f06f544086cca4773835070e47b7c968",
      "14592992469e91d9cfd614be94d3d761f1a0295a",
      "0af10f5d06e91595613cc320b31ee5131df2d449",
      "54fa8decbee73d1f76ad336d53120fd39c4cf0e4",
      "0fe1d6ed002499fc8ff7016cdf605cb840a64799"
    ],
    "tests_passed": 500,
    "tests_failed": 0,
    "pushed": true,
    "ci_passed": true,
    "new_deps": ["@anthropic-ai/claude-agent-sdk"],
    "spec_touched": false
  },
  "open_questions": [
    "Smoke run 3 ended PASS although R2 measured npm test exit 1 (434 passed / 66 failed): the worker reported the failures honestly, so no claim rule fired, and rule 8 adopted the reviewer's PASS. SPEC 4.3 has no rule that a failing acceptance command blocks a PASS. Add one?",
    "The 66 failures were caused by my run harness: GIT_CONFIG_COUNT pushurl override (for the worker's SSH push) leaked into the tests' throwaway repos. Reproduced 66/66 with the env, 500/500 without. Configure the push URL in .git/config instead.",
    "CI evidence was unknown: GitHub API rate-limited for the whole 1800s wait; ci.wait_timeout recorded. A read-only GITHUB_TOKEN is needed.",
    "R2's commit 2279a85 (verdict.md + progress entry recording this PASS) is local and unpushed; push as-is or hold until the rule gap is fixed?"
  ]
}
```
