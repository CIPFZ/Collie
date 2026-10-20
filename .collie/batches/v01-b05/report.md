# 批次 v01-b05 汇报（第三版，2026-10-20，含第四次烟雾运行与规则 8）

## 做了什么

本批次没有 R2 签发的 `task.md`，按 `docs/backlog.md` 的 v01-b05 小节和项目所有者在对话中的逐项裁决执行，`base_sha` 取 `545ceb1`。

共 8 个代码提交，每个都在推送后确认了自己的 CI，才推下一个：

| 提交 | scope | 条目 | 内容 |
|---|---|---|---|
| `e4555c8` | runner | 1 | `src/runner/claude.ts` |
| `4719412` | cli | 2 | 默认真实 runner，`--runner fake` |
| `da7cf65` | config | 2a | `permission_mode` |
| `1459299` | arbiter | 2b | 认可依赖清单加回 SDK |
| `0af10f5` | ci | 2c | 取证前等 CI |
| `54fa8de` | runner | — | 安装 SDK 0.3.303 |
| `0fe1d6e` | r2 | 2d | `issued_by: collie`、`final_text` |
| `32eff85` | arbiter | 2e | 第三版新增：仲裁规则 8 与场景 D |

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

**条目 2e（`32eff85`，第三版新增）**：
- 实现 SPEC 4.3 新增的规则 8：只要 R2 实测有任一验收命令不满足 expect（退出码或 stdout），reviewer 的 PASS 就降为 FIX，并逐条记 `acceptance.failed` 事件（SPEC 3.6，字段 cmd / exit_code / expect）；reviewer 原判 FIX 或 BLOCK 时保持不变。
- 原规则 8 改为规则 9，1～7 的编号和顺序都不变。所以有谎言时，仍然先被规则 5～7 当作声称不符记录下来。
- R2 传给 arbiter 的是 `verify.ts` 自己的判定结果（基于完整 stdout），而不是 evidence 里的摘要。
- `test/scenario-d.test.ts`：worker 诚实地报了 3 个真实失败，reviewer 判 PASS，Collie 最终判 FIX，退出码 10；对照组（同一个诚实 worker，测试全绿）判 PASS。
- **关掉规则 8 后只有场景 D 失败（4 个用例里 3 个），场景 A、B、C 全部不受影响。** arbiter 测试新增了规则 8 的独立用例，以及顺序用例（规则 2、7 都先于规则 8）。全量 512 个测试通过。

**推送配置（按裁定第 3 条）**：推送地址和 SSH 密钥现在写在本仓库的 `.git/config` 里（`remote.origin.pushurl`、`core.sshCommand`；本机配置，不入库），启动脚本不再导出任何 `GIT_CONFIG_*` 变量。已验证：直接 `git push --dry-run` 可用；在 R2 那种 worktree 里跑全量测试是 512/512，测试临时建的仓库不再受影响。

**条目 3：烟雾批次。共四次运行**

| 运行 | 结果 | 原因 |
|---|---|---|
| ① `r-20261020-051154` | 中断 | 我的会话结束时把进程一起杀掉了（见第一版） |
| ② `r-20261020-060511` | BLOCK（20） | worker 遵守旧手册 §6，出完计划就退出，没写 report |
| ③ `r-20261020-063533` | PASS（0），**不成立** | 2d 修订后的运行；规则缺口加上我的环境变量问题（见下） |
| ④ `r-20261020-081526` | **FIX（10），裁定正确** | 规则 8 和推送配置修好后的运行（第三版新增，只跑了一次） |

**第 ④ 次运行**（第三版新增）的完整 journal（UTC）：

| 时间 | 事件 | 内容 |
|---|---|---|
| 08:15:26 | `run.started` → `batch.selected` → `batch.task_written` | base `32eff85`，task 提交 `ebf8c94` |
| 08:15:26 | `worker.started` | |
| 08:22:10 | `worker.finished` | exit 0；`final_text`：「README 标记行已由前一轮（`b75aa31`）写入，本轮无实际代码变更可做……验收第 3 条无法达成」 |
| 08:22:11 | `reviewer.started` | head_sha `ebf8c94`（就是 task 提交本身） |
| 08:25:15 | `reviewer.verdict` | FIX |
| 08:55:33 | `ci.wait_timeout` | waited_secs=1800，polls=2，last_state=rate_limited |
| 08:55:33 | `run.finished` | verdict=FIX，exit_code=10 |

- **worker**（约 7 分钟）：判断正确，README 那一行在第 ③ 次运行时已经写进去了，本轮无事可做，所以**没有做任何代码提交**，只写了 report（`fe8cf23`，worker 自己推送，CI 为 success）。claims 如实填写：`commits: []`、512 passed / 0 failed、`pushed: false`、`ci_passed: false`。
- **reviewer**：判 FIX，理由是取证范围为空、验收第 3 条失败、前两条通过只是因为前一轮留下的状态。
- **R2 实测**：
  - `npm test` → 512 passed，exit 0（环境问题已消除）；
  - 验收第 3 条 `test "$(git diff --name-only HEAD~1 HEAD)" = "README.md"` → **exit 1**；
  - 其余命令都是 exit 0；受保护文件改动 0 行，依赖无变化；
  - CI 又被限流，等满 1800 秒后记为 `ci.wait_timeout`。
- **arbiter**：规则 1～7 都没有命中。规则 8 没有生效，因为 reviewer 本来就判了 FIX——规则 8 只把 PASS 降为 FIX，FIX 原样保留。最后由规则 9 给出 FIX。如果 reviewer 判了 PASS，规则 8 就会以同一条失败命令把它降为 FIX，场景 D 证实的正是这条路径。
- **落盘情况**：
  - task 信封 `ebf8c94` 和 report `fe8cf23` 已推送（由 worker 一起推送）；
  - R2 的 `ef753b8 progress: v01-b05-smoke FIX`（verdict.md 和 progress 记录）**随本 report 一起推送**，见第四段第 7 条。

第 ③ 次运行的完整 journal（UTC，保留第二版原文）：

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

**第三版**：在 `/tmp` 下全新 clone 到 `ef753b8`、执行 `npm ci` 之后，用 Collie 的 `verify.ts` 运行 v01-b05 的验收命令（来自 `parseBacklog`），**8 条全部 exit 0**：

| 命令 | 退出码 |
|---|---|
| `npm run lint` | 0 |
| `npm run typecheck` | 0 |
| `npm test` | 0（`512 passed, 0 failed`） |
| SDK 包名不出现在 `src/runner/` 之外 | 0 |
| `@opentelemetry` / `fast-sha256` 不出现在 `src/` | 0 |
| `npm test -- test/runner-claude.test.ts` | 0（`22 passed, 0 failed`） |
| `test -f .collie/batches/v01-b05-smoke/verdict.md` | 0（第 ④ 次运行的 verdict，随本 report 推送入库） |
| `npm test -- test/scenario-d.test.ts` | 0（`4 passed, 0 failed`） |

CI：`32eff85` https://github.com/CIPFZ/Collie/actions/runs/39391757229 ，success；worker 推送的 `fe8cf23` https://github.com/CIPFZ/Collie/actions/runs/39392867373 ，success。

第二版原文（在本地 `2279a85` 上，用 Collie 的 `verify.ts` 运行）：

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

7. **【第三版】R2 的裁定提交 `ef753b8` 随本 report 推送。** 它记录的 FIX 裁定是正确的。你对上一个样本的裁定是「原样入库」，我照同样的口径处理；如果你不同意，可以 revert。

8. **【第三版，新发现】progress 记录和 verdict.md 是按批次覆盖的，不是按运行累积。**
   - 第 ④ 次运行把同一批次在 progress 块里的记录（第 ③ 次运行那条 PASS）替换掉了，`verdict.md` 也被覆盖了。
   - 第一个真实样本仍然完整保存在 git 历史里（`8db55f7`：verdict.md 和 progress 记录都在），但 progress.md 里已经看不到它。
   - 这是 v01-b04 的设计（「每个批次一条记录」）。如果你希望每次运行都保留在 progress 里，需要把记录改为按 run_id 累积，属于 SPEC 层面的改动。

9. **【第三版，新发现，影响 2c】head_sha 可能永远没有自己的 CI 运行。**
   - 本次 worker 把 `ebf8c94` 和 `fe8cf23` 一次推送上去，GitHub 只为推送的最新提交（`fe8cf23`）跑了 CI；`ebf8c94` 在 Actions 里查不到任何运行。
   - `waitForCi` 把「这个 sha 还没有运行」当作「还没有结论」，所以即使 API 没有限流，它也会白白等满 1800 秒，最后记为 unknown。
   - 第 ③ 次运行没出这个问题，是因为 `b75aa31` 恰好被单独推送过。
   - 修正方向需要 R1 选：
     - 承认 head_sha 在期望分支上的后代提交（比如 report 信封提交）的 CI 结论，但要说清楚这个结论覆盖的是哪个提交；
     - 或者要求 worker 先单独推送代码提交，再推送信封。

10. **【第三版】烟雾批次无法重复执行。** README 那一行在第 ③ 次运行时已经写入，之后再跑必然是「无事可做」，验收第 3 条（`HEAD~1..HEAD` 只改了 README）也必然失败，所以第 ④ 次运行的 FIX 是结构性结果。验收第 3 条还隐含假设 head_sha 的父提交就是 task 提交。批次一旦做成，就不能再拿来当烟雾测试。

## 下一步建议

1. **【第三版】规则缺口已经补上，b05 的 8 条验收在全新 clone 上全部通过。** 剩下要处理的是第 8 条（progress 按批次覆盖）和第 9 条（head_sha 没有自己的 CI 运行时白等 30 分钟），两条都需要 R1 先定方向。
2. 推送配置已经改为写在 `.git/config` 里（第 2 条已解决）。**只读的 `GITHUB_TOKEN` 仍然缺**：第 ③、④ 次运行都因为限流各白等了 30 分钟。
3. 如果还需要一个能重复执行的烟雾批次，建议 R1 另设一个每次都有事可做的批次（比如把一个计数文件加 1），而不是再跑 v01-b05-smoke。

```json
{
  "schema_version": 1,
  "batch_id": "v01-b05",
  "head_sha": "32eff85b782df01f78e3146386bbec277f2711a7",
  "claims": {
    "commits": [
      "e4555c8a20343bcb6fa2730a298ef865407aab74",
      "4719412c7ad3090761fbb24c13533a099f643770",
      "da7cf652f06f544086cca4773835070e47b7c968",
      "14592992469e91d9cfd614be94d3d761f1a0295a",
      "0af10f5d06e91595613cc320b31ee5131df2d449",
      "54fa8decbee73d1f76ad336d53120fd39c4cf0e4",
      "0fe1d6ed002499fc8ff7016cdf605cb840a64799",
      "32eff85b782df01f78e3146386bbec277f2711a7"
    ],
    "tests_passed": 512,
    "tests_failed": 0,
    "pushed": true,
    "ci_passed": true,
    "new_deps": ["@anthropic-ai/claude-agent-sdk"],
    "spec_touched": false
  },
  "open_questions": [
    "Smoke run 4 (r-20261020-081526) ended FIX, exit 10, correctly: the README line already existed from run 3, the worker made no code commit and said so, acceptance 3 failed (exit 1); the reviewer said FIX, so rule 8 did not need to fire.",
    "progress.md and verdict.md are per batch, so run 4 replaced run 3's PASS entry; the first real sample survives only in git history (8db55f7). Keep entries per run instead?",
    "waitForCi waits the full ci_wait_secs when head_sha never gets its own CI run (pushed together with the report commit, only the tip is built). Accept a descendant's run on the expected branch, or require the code commit to be pushed first?",
    "GitHub API was rate-limited for the whole wait in runs 3 and 4 (30 min each). A read-only GITHUB_TOKEN is still missing.",
    "R2's commit ef753b8 (verdict + progress for run 4) is pushed with this report, following the owner's ruling for the previous sample."
  ]
}
```
