# v03-b03-fix 第 1 次运行汇报（r-20261026-161002）

基准提交 `4007ca4` 是 HEAD（`0f38ae2`）的祖先，开跑前检查都通过：
- 工作区干净，没有心跳文件，没有残留进程，和 origin 一致；
- 三个 git 配置文件的哈希没变；
- 基线 `npm test` 743 个全过；
- smoke 退出码 0：`smoke ok: exitCode=0 sessionId=3282b77c-92b7-4d62-abc3-9d4420659cdf usage={"inputTokens":322,"outputTokens":4}`。

**结果：FIX，退出码 10。** reviewer 判 FIX，原因是第 6 条验收 exit 1；R2 实测这一条也是 exit 1。走到规则 10，采用 reviewer 原判。

**`collie audit` 退出码 0**，这是第一次通过：
- 输出 `audit r-20261026-161002: tools match reviewer whitelist`；
- reviewer 初始化消息里的工具清单是 `["Bash","Glob","Grep","Read"]`；
- worker 是 `["Bash","Edit","Glob","Grep","Read","Write"]`。

**`tool.denied` 第一次出现，但拦错了**（见第 4 段第 1 条）。

关键事件（`events.ndjson` 原样）：

```
{"ts":"2026-10-26T16:10:03.029Z","run_id":"r-20261026-161002","batch_id":"v03-b03-fix","event":"ci.verdict_commit","sha":"e6c88ea8d121cbaea57badb4f96458495efbe9e1","conclusion":"success","run_url":"https://github.com/CIPFZ/Collie/actions/runs/40337886664"}
{"ts":"2026-10-26T16:51:25.190Z","run_id":"r-20261026-161002","batch_id":"v03-b03-fix","event":"reviewer.verdict","verdict":"FIX"}
{"ts":"2026-10-26T16:51:58.376Z","run_id":"r-20261026-161002","batch_id":"v03-b03-fix","event":"ci.resolved","head_sha":"2196fc6e2221252d8ee9fa19266009abc5bfd5d8","conclusion":"success","branch_matched":true,"run_url":"https://github.com/CIPFZ/Collie/actions/runs/40360846576","waited_secs":1,"polls":1}
{"ts":"2026-10-26T16:52:02.381Z","run_id":"r-20261026-161002","batch_id":"v03-b03-fix","event":"verdict.pushed","sha":"403916cea0bc5ea69c1fcaa002da0bcd7c5aebdd","remote":"origin","branch":"main"}
{"ts":"2026-10-26T16:52:02.385Z","run_id":"r-20261026-161002","batch_id":"v03-b03-fix","event":"run.finished","verdict":"FIX","exit_code":10,"worker_exit_code":0}
```

`tool.denied`（`reviewer.stream.ndjson` 第 399 行原样；`events.ndjson` 里没有这一行）：

```
{"event":"tool.denied","role":"reviewer","tool":"Bash","command":"git merge-base --is-ancestor 2196fc6e2221252d8ee9fa19266009abc5bfd5d8 b8e0bd540097b40789ac2852b6e96af54736fea5 && echo \"yes, head_sha is ancestor of remote HEAD\" || echo \"no\"","pattern":"^\\s*git\\s+(push|commit|add|reset|checkout|rebase|merge|cherry-pick|tag|branch\\s+-[dDm]|worktree|stash)\\b"}
```

reviewer 那边收到的工具返回是：`PreToolUse:Bash hook error: command matches bash_deny pattern /^\s*git\s+(push|...|merge|...)\b/`。

## 1. worker 做了什么

- 用时 00:10:03 → 00:38:13，共 28 分 10 秒，102 轮，**花费 $7.18**。
  - `cache_creation` 207,664 token，`cache_read` 8,999,445，输出 42,883。
  - 上下文压缩 1 次。
- 在 task 提交 `3f722dc` 之后只有 1 个代码提交 `2196fc6`（`fix: head_sha ancestry, R2 commit filtering, stop_reason tracking, continuation cost`），外加信封提交 `b8e0bd5`，都已推送。
- 改动 7 个文件，+358/−45 行：`src/cli.ts`、`src/evidence.ts`、`src/run.ts`，以及 cli、invariants、scenario-e、scenario-f 的测试。不涉及受保护路径，`package*.json` 没动，没有 token。
- **手册新加的「推送后立刻写 report」这一条第一次生效了。** 16:37:03 推送代码，16:37:15 执行 `rev-parse`，16:37:52 写 report，16:38:02 提交信封。中间没有再跑全量测试。
- claims：commits 是 `2196fc6…`（40 位）；`tests_passed=750`；`pushed=true`；`new_deps=[]`；`spec_touched=false`。
- **条目 1 的场景测试**（`test/scenario-e.test.ts` 新增的 describe）：
  - **构造是真的。** attempt 1 的 fake worker 先提交、`git push` 到沙箱的 bare 远端，再 `stop('kill')`，不写 report；断言退出码 20。attempt 2 的 fake worker 只写 report，`head_sha` 填 attempt 1 的代码提交，然后推送。
  - 断言了：没有被上报、有 `reviewer.started`、两轮 `batch.selected` 的 `base_sha` 相同。
  - **但「`commits_actual` 不含 task、progress 提交」没有断言。** 注释里写了，代码只有 `expect(progress).toContain(attempt1CodeSha.slice(0,7))`，只检查了「包含代码提交」，没检查「不含 R2 的提交」。
- 条目 2 的测试（`test/scenario-f.test.ts:156-190`）：断言的是 `r2.calls[0]?.resumeSessionId).toBeUndefined()`，没有断言 `worker.resumed` 事件的 `session_id: null`。
- 条目 3 的测试：用 fake 的墙钟中断，断言 `stop_reason=wallclock`、带 `sdk_stop_reason`、`interrupted_at` 含 `wallclock`。

## 2. R2 实测了什么

- 验收 9/10 通过：`npm test` 750 个通过，其余结构检查都是 0；**第 6 条 `grep -qE "session_id.*null|sessionId.*undefined" test/scenario-f.test.ts` 返回 exit 1**。
  - 原因是大小写：测试里写的是 `resumeSessionId).toBeUndefined()`，`Undefined` 是大写 U；验收正则区分大小写，匹配 0 次，加上 `-i` 就能匹配 3 次。
  - 功能本身有测试覆盖，并且通过了（reviewer 和 R2 跑的 scenario-f 都是 5 个通过）。
- 受保护文件改动 0 行，依赖无变化，已推送确认为是（reviewer 那边 `remote_has_head=true`）。
- CI：`ci.resolved` 里结论 success，分支一致，1 秒、查 1 次；R2 的裁定提交 `403916c` 的 Run 157 通过。
- 启动时 `ci.verdict_commit` 查的是 `e6c88ea`，结论 success，没有警告；启动阶段没有调用 push。
- reviewer 的工具使用：Bash 34 次、Read 14 次、Grep 8 次。没有 gh，也没有 git 写操作。
- 两份事件流里都没有 token 格式的字符串。心跳已删除，没有残留进程，配置文件没变。

## 3. 仲裁

规则 1~9 都没触发。规则 8 的条件其实满足（有一条验收没过），但它只在 reviewer 判 PASS 时才降级；这次 reviewer 本来就判了 FIX，所以走到规则 10，采用 reviewer 原判：**FIX，退出码 10。**

## 4. Collie 本身的问题

1. **`bash_deny` 误拦了只读命令 `git merge-base`。**
   - 正则 `^\s*git\s+(…|merge|…)\b` 里，`merge` 后面跟的 `-` 也算单词边界，所以 `merge-base` 被当成 `merge` 拦下了。我在本机用同一个正则验证过，确实能匹配。
   - `git merge-base --is-ancestor` 正是 reviewer 用来核实「已推送」的标准做法，这次被拒了，它改用别的方式得到了 `remote_has_head=true`。
   - 同样的问题也会出现在 `branch\s+-[dDm]` 之外的组合上，比如 `git tag` 和 `git tag -l`（只读）一样会被拦；`checkout` 也会拦掉 `git checkout --help`。
   - 建议把每个子命令后面的条件改成 `(?=\s|$)`，而不是 `\b`。
2. **`tool.denied` 只写进了 `reviewer.stream.ndjson`，没进 journal。** SPEC 3.6 把它列为事件类型，但它没有 `ts` 和 `run_id`，`collie show` 也看不到。要知道 reviewer 被拦过几次，只能去翻事件流。
3. **第 6 条验收的正则写得太窄，导致整批判 FIX。** worker 写了正确的测试，但字面上和正则对不上。reviewer 给的建议是「加一行注释让 grep 通过」，也就是为了过验收去凑字符串。
4. **条目 1 的测试缺了一半断言**（见第 1 段）。reviewer 的核对表没提，验收也只 grep `commits_actual`，所以没拦住。
5. **backlog 里 v03-b03-fix 的说明提到「本批次条目 4 的场景测试要把 b03 的队列代码也覆盖进 reviewer 路径」，但条目只有 3 条。** v03-b03 的 `--continue` 队列代码（`c62deb2` / `09f229c`）这次 reviewer 也没审到：它的取证范围是 `3f722dc..2196fc6`。

## 5. 需要所有者决定的事

1. **v03-b03-fix 怎么接着跑。** 我的建议：R1 先把第 6 条验收改成 `grep -qiE`，或者改成匹配 `resumeSessionId).toBeUndefined`，再跑 attempt 2。这样 worker 不用为了过验收去改测试的字面内容；顺带让它补上条目 1 那条缺失的断言（「`commits_actual` 不含 `docs: issue` / `progress:` / `report(collie):` 提交」）。
   - 这一轮 attempt 2 也会是本批次修复的第一次真实检验：用首次 `base_sha` 判断 head_sha 和取证范围、不续接会话、`interrupted_at` 取 `wallclock`。上一轮是 FIX，不算中断，所以 attempt 不会递增；需要 R1 确认 FIX 后重跑是否也沿用首次 `base_sha`（SPEC 11.7 写的是「后续 attempt」）。
2. **`bash_deny` 的正则**：建议把 `\b` 改成 `(?=\s|$)`，在 toml 里改就行，不用动代码；再给 `bash_deny` 补一组正反用例（`merge-base`、`tag -l` 放行；`merge`、`tag v1` 拒绝），并入下一个批次。
3. **`tool.denied` 进 journal**：建议 runner 通过回调把这条记录交给 R2，写进 `events.ndjson`。并入下一个修补批次。
4. **v03-b03 的队列代码要不要单独补一次审核。** 建议在 v03-b04 之前，签一个只含「复核 v03-b03 队列模式 + 场景 J」的小批次。或者接受「操作员补测 9/9 + R1 复核」作为它的审核，由你定。
