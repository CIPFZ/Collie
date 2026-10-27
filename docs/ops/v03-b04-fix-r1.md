# v03-b04-fix 第 1 次运行汇报（r-20261027090540，队列 q-20261027090540）

基准提交 `59a9579` 是 HEAD（`57bb7bf`）的祖先，开跑前检查都通过：
- 工作区干净，没有心跳文件，没有残留进程，和 origin 一致；
- 三个 git 配置文件的哈希没变；
- 基线 `npm test` 794 个全过；
- smoke 退出码 0：`smoke ok: exitCode=0 sessionId=7eda0cec-6607-4cff-aa8f-9e1be7f2b4f9 usage={"inputTokens":322,"outputTokens":4}`。

命令是 `npx tsx src/cli.ts run --continue --max 1`，选中了 **v03-b04-fix**：**第 1 次就 PASS，没有 FIX 重跑，没有 `queue.paused`，退出码 0。**
- 标准输出：`queue: limit (batches: v03-b04-fix)`；
- `collie audit r-20261027090540` 退出码 0：`tools match reviewer whitelist`。

**但我在读放行判定的代码时，发现第 6 项从来没生效过**（见第 4 段第 1 条）。

关键事件（批次 `events.ndjson` 原样）：

```
{"ts":"2026-10-27T09:05:40.971Z","run_id":"r-20261027090540","batch_id":"v03-b04-fix","event":"ci.verdict_commit","sha":"2bbda1b48176d31a5d5c8056f97e777d9a456fb9","conclusion":"success","run_url":"https://github.com/CIPFZ/Collie/actions/runs/40459071052"}
{"ts":"2026-10-27T09:05:40.987Z","run_id":"r-20261027090540","batch_id":"v03-b04-fix","event":"batch.selected","base_sha":"57bb7bf294e683271e8eba33155d19239bd64124"}
{"ts":"2026-10-27T09:49:19.913Z","run_id":"r-20261027090540","batch_id":"v03-b04-fix","event":"reviewer.verdict","verdict":"PASS"}
{"ts":"2026-10-27T09:49:56.502Z","run_id":"r-20261027090540","batch_id":"v03-b04-fix","event":"ci.resolved","head_sha":"ebc4154895d6c9152efc3c07379338c3a05eee15","conclusion":"success","branch_matched":true,"run_url":"https://github.com/CIPFZ/Collie/actions/runs/40482985905","waited_secs":1,"polls":1}
{"ts":"2026-10-27T09:49:56.523Z","run_id":"r-20261027090540","batch_id":"v03-b04-fix","event":"batch.status","from":"pending","to":"passed"}
{"ts":"2026-10-27T09:50:00.358Z","run_id":"r-20261027090540","batch_id":"v03-b04-fix","event":"verdict.pushed","sha":"e0422155522aa5d1ee6e587c08e913add6077d76","remote":"origin","branch":"main"}
{"ts":"2026-10-27T09:50:00.362Z","run_id":"r-20261027090540","batch_id":"v03-b04-fix","event":"run.finished","verdict":"PASS","exit_code":0,"worker_exit_code":0}
```

## 1. worker 做了什么

- 用时 17:05:41 → 17:45:20，共 39 分 39 秒，113 轮，花费 $9.28。
  - `cache_creation` 564,678 token，`cache_read` 8,018,853，输出 61,676；上下文压缩 1 次。
- 在 task 提交 `b170eb0` 之后只有 1 个代码提交 `ebc4154`（`roles: FIX rerun task semantics, fix_max per-queue counting, queue journal`），外加信封提交 `a2ec47d`，都已推送。
- 改动 8 个文件，+501/−53 行：`src/cli.ts`、`src/roles/worker.ts`、`src/run.ts`、`src/schema/index.ts`，以及 cli、invariants、scenario-j、schema 的测试。
- 不涉及受保护路径，`package*.json` 没动，没有 token，配置文件哈希不变。
- 推送到信封的间隔：17:43:40 推送代码，17:44:37 写 report（57 秒后），17:45:04 推送信封。
- claims：commits 是 `ebc4154…`（40 位）；`tests_passed=801`；`pushed=true`；没有 open_questions。
- 铁律 26：这一轮没有出现「验收匹配到注释」的情况。新增的注释我扫了一遍，没有提到 acceptance、grep 之类为了过验收而写的字眼。

## 2. R2 实测了什么

- 验收 8/8 全部通过，`npm test` 801 个通过。受保护文件改动 0 行，依赖无变化，已推送确认为是。
- reviewer 判 PASS，`gaps` 为空，没有附加条件。
- CI：`ci.resolved` 里结论 success，分支一致，1 秒、查 1 次；R2 的裁定提交 `e042215` 的 Run 175 通过。
- 启动时 `ci.verdict_commit` 查的是 `2bbda1b`，结论 success，没有警告。
- **audit 退出码 0**，reviewer 的工具清单是 `["Bash","Glob","Grep","Read"]`，worker 是白名单 6 个。`tool.denied`：0 条。
- **backlog 状态列：** `batch.status` 原样是 `{"from":"pending","to":"passed"}`。我用「把开跑前的副本里 v03-b04-fix 那一格从 `pending` 换成 `passed`，再和现在的文件逐字节比对」的方法核对过，**其余字节完全相同**，文件从 92762 字节变成 92761 字节。这处改动并进了裁定提交 `e042215`（`docs/backlog.md | 2 +-`）。
- **放行判定第一次在 R2 上生效（b04 的代码）：** PASS 之后调用了 `gateDecision`。没有 `queue.paused`，`queue.finished` 带了 `paused_count: 0`。这一轮 7 项输入都满足：没有降级、没有声称不符、CI 是 success 且分支一致、依赖无变化、受保护文件 0 行、`gaps` 为空，所以本来也不会触发。
- 心跳已删除，没有残留进程，三份事件流里都没有 token。

## 3. 仲裁

规则 1~9 都没触发，走到规则 10：**PASS，退出码 0**。放行判定通过，然后因为达到 `--max 1`，以 `limit` 结束。

## 4. Collie 本身的问题

1. **放行判定第 6 项「受保护路径改动为 0 行」从 b04 起就没在检查。**
   - `src/run.ts:1907`（本轮 R2 跑的 `57bb7bf` 里是 `:1808`）写的是 `protectedDiffLines: outcome.evidence?.spec_diff_lines ?? 0`，用的是第 5 项的数据。
   - 再看 `src/evidence.ts:30-31` 的注释：`PROTECTED_PATHS`「Counted into spec_diff_lines for arbiter rule 2」。也就是说，这个仓库里**「受保护路径改动行数」本来就等于 `spec_diff_lines`**，两者不是独立的数据。
   - 所以 SPEC 12.3 列的 7 项里，`spec_diff` 和 `protected` 其实是同一个判断；任何一次受保护改动，都会同时报出这两条原因。这不会漏判，因为两项实际上是同一个检查；但会重复报。
   - 而且这两项本来就会被规则 2 判 BLOCK，到不了放行判定这一步，在判定里属于「不可能触发」的分支。
   - `test/gate.test.ts` 的「七项各自单独不满足」用例，是直接构造 `protectedDiffLines > 0` 的输入，没经过 run.ts 的取值，所以测不出这一点。reviewer 也没核到。
2. **这一轮队列 journal 仍然只有一行。** R2 跑的是 b04 的代码，`queue.batch_started` 和带 run_id 的 `batches` 都是本批次才加的，属于预期。
3. **FIX 重跑的新语义（task 里写「上一轮判 FIX」、`interrupted_at` 为 null）这一轮没触发**，因为第一次就 PASS 了。要等到下一次真实的 FIX 才能在 R2 上验证。

## 5. 需要所有者决定的事

1. **放行判定第 6 项怎么处理。** 二选一：
   - (a) 从 SPEC 12.3 里删掉 `protected` 这一项，只保留 `spec_diff`，并注明这两者等价；
   - (b) `evidence` 新加一个独立的 `protected_diff_lines` 字段，把 `PROTECTED_PATHS` 里 SPEC.md 之外的路径单独统计。
   - 我倾向于 (a)：现在的数据就是这样，(b) 只是在拆一个没有实际需要的区分。不管选哪个，`run.ts:1907` 那一行都要改成不再假装是一项独立的数据。
2. **下一步。** 按 SPEC 12.3 放行判定的设计，v03 的功能批次已经做完了。如果 backlog 里还有下一个 pending 批次，我建议下一轮就试一次 `--max 2`，让放行判定在两个批次之间真正决定一次「继续还是停」。到目前为止，它只在 `--max 1` 的最后一步跑过，从来没在批次之间放行过。
