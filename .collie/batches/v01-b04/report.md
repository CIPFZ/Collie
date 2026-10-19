# 批次 v01-b04 汇报

## 做了什么

本批次没有 R2 签发的 `task.md`，按项目所有者在对话中的指示和 `docs/backlog.md`（`2e61194`）的 v01-b04 小节执行，`base_sha` 取 `2e61194`。

共 6 个代码提交。**每个提交都是推送后确认了它自己的 CI 结论，才开始推下一个**（吸取 b03 的教训）：

| 提交 | scope | 内容 |
|---|---|---|
| `0b32e6c` | schema | 条目 1：`VerdictSchema` 按 SPEC 3.5 新约定放宽 |
| `a7bfbbd` | runner | 条目 1：`RunResult.finalText` |
| `c1ecd43` | arbiter | 条目 1：八条仲裁规则；git 新增祖先判定与 worktree |
| `21836f7` | verify | 条目 1、2：R2 自己采集取证结果（`src/evidence.ts`） |
| `11372e5` | progress | 条目 2：progress 写入；仲裁规则 2、3 记录被否认的声称 |
| `bc35c54` | cli | 条目 2、3：init / run / show、执行闭环、三场景测试 |

**条目 1：仲裁及其前置改动**

- `VerdictSchema`：
  - `ci_conclusion` 限定为 `success | failure | cancelled | unknown`；`ci_branch_matched` 可为 `null`；`ci_run_url` 可为空串；`conditions` 为可选字段。
  - 顶层未知字段仍会被拒绝。
  - 两份历史 verdict 现在只剩一处不符合：`ci_conclusion` 是自由文本。有测试把这一点固定了下来。
- `RunResult.finalText`：reviewer 没有写工具，它的最终回复由 R2 写入 `verdict.md`。
- `src/arbiter.ts` 按 SPEC 4.3 的八条规则依次判定，命中即停：
  - 规则 5～7 一律强制降为 FIX 并记录不符项；如果 reviewer 原判是 BLOCK，不会被改轻成 FIX。
  - 规则 6 额外规定：声称「0 failed」但测试命令退出码非 0，同样算不符。原因是 vitest 在测试文件加载失败时仍可能显示「0 failed」。
  - 规则 7：`ci_branch_matched=null`（未能取证）且 `claims.ci_passed=true` 时降为 FIX，这是本次的裁决内容。
  - 30 个用例，每条规则都有独立用例；另有 6 条用例验证规则顺序（两条规则同时命中时，先命中的生效）。8 处变异全部被测试抓到。
- `src/git.ts` 新增：
  - `fetchBranch`、`isAncestor`、`remoteContains`。「已推送」现在的判定是：先 fetch，再用 `merge-base --is-ancestor head_sha origin/main`。用 report 信封提交压在 `head_sha` 之上的场景测过，判定正确。未知提交会直接报错，而不是返回 false。
  - `addWorktree` / `removeWorktree`、`showFile`。

**条目 2：progress、cli 与执行闭环（`src/run.ts`）**

`collie run <batch>` 按以下顺序执行（SPEC 6）：
1. 解析 backlog，生成 task.md，并以 `docs: issue <id> task envelope` 提交。之后 worker 产出的取证范围就是 `task 提交..head_sha`，task 提交本身不算 worker 产出（SPEC 3.3）。
2. 用 `AbortSignal.timeout(wallclock_secs)` 包住 worker 来运行。超时按 SPEC 3.3 记为 `worker.crashed`（带 `timed_out: true`），并升级为 BLOCK。
3. 读回 report。如果没有 report，或者 report 的 `head_sha` 不是从 task 提交延续下来的，就记 `escalated` 并判 BLOCK（SPEC 6）。
4. **在 `git worktree add <tmp> head_sha` 里运行 reviewer**。因为 report 信封提交在 `head_sha` 之后，这个 worktree 里物理上不存在 report.md（场景 A 有测试证实）。reviewer 的 `finalText` 由 R2 写入 verdict.md。
5. **R2 自己在同一个 worktree 里取证**（`src/evidence.ts`）：实跑全局的 `[verify]` 命令加上本批次的验收命令；统计受保护文件的改动行数；比较 package.json 的依赖变化，并检查 lockfile 里新增包是否有强 copyleft；判断远端是否包含 `head_sha`；按 sha 查询 CI。
   - 如果 CI 查询失败（比如被限流），`ci_branch_matched` 记为 `null`。
   - 依赖未提交到 git，所以会把主工作区的 `node_modules` 符号链接到 worktree 里。
6. arbiter 用 **R2 的实测结果**替换 verdict 里的 evidence 后再裁定（见下一段第 2 条）。
7. 写入 journal 事件：`claim.mismatch`、`verdict.downgraded`、`run.finished`。
8. 写 progress，然后以 `progress: <id> <结论>` 提交 verdict.md 和 progress.md。R2 的提交都发生在 worker 结束之后（铁律 19）。
9. 退出码：0 PASS / 10 FIX / 20 BLOCK / 1 Collie 自身错误。

其他部分：
- `src/progress.ts`：`docs/progress.md` 也有人工维护的内容，所以 Collie 只改写它自己那段由 `<!-- collie:runs:start/end -->` 标记包住的内容，每个批次一条记录，内容只来自实测证据和仲裁结果。标记不成对时直接报错，不去猜。
- `collie init`：从 `templates/collie.toml` 生成配置（有测试保证模板渲染出的配置与 SPEC 3.1 完全一致）。仓库 URL 从 origin 推导，SSH 和 HTTPS 形式都支持，也可以用 `--repo` 指定；`.gitignore` 里的条目去重。
- `collie show <batch>`：打印**解析后的**验收命令（SPEC 3.2 规定的唯一执行形式）、三份信封、以及该批次所有 run 的事件轨迹。
- `src/cli.ts` 的 `main()` 通过参数注入 runner、fetch 和时钟，测试因此不联网、结果确定。v0.1 没有真实的 runner，所以真实入口执行 `collie run` 会报「no agent runner」并以 1 退出。
- 新增运行时依赖 `commander@15.0.0`（MIT，SPEC 2.2 已列出，没有传递依赖）。

**条目 3：三个场景**（`test/support/sandbox.ts`）

每个场景都在一个**真实的 git 仓库**里跑，配一个本地 bare 远端；用一个 POSIX sh 写的测试脚本**真实执行** worker 提交的测试文件；fake CI API 只返回 workflow run。reviewer 一律是被骗过的，原判都是 PASS。**每个场景都有一个「诚实的对照组」：只去掉那一个谎言，结果就是 PASS（exit 0）**。这证明拦截来自「声称与实测不符」，而不是场景本身构造了失败。

| 场景 | worker 声称 | 实测 | 结果 | journal |
|---|---|---|---|---|
| A 假 CI 全绿 | `ci_passed=true`，其余都属实（47 个测试真实通过，已推送） | CI 只在 master 上有运行 | exit 10 | `claim.mismatch` 规则 7，`verdict.downgraded` PASS→FIX |
| B 假测试数 | 47 passed / 0 failed | 真实跑出 44 passed / 3 failed | exit 10 | 规则 6，`actual={passed:44,failed:3,exitCode:1}` |
| C 偷改 SPEC | `spec_touched=false` | SPEC.md 改动 2 行 | exit 20 | 规则 2；reviewer 判 FIX、或 worker 主动承认改了 SPEC，也一样是 BLOCK |

- 三个场景都验证了 `collie show` 能还原出完整链条：声称（report）→ reviewer 原判（verdict）→ 不符项 → 降级 → 最终退出码。
- 变异测试：分别关掉规则 7、6、2，只有对应的那个场景失败；如果让 arbiter 改用 reviewer 自己报的 evidence，三个场景全部失败。
- `test/exit-codes.test.ts` 共 13 个用例，覆盖：0、10（诚实的 FIX、规则 5 未推送）、20（verdict 无法解析、reviewer 没有回复、没有 report、worker 崩溃、超时）、1（未知批次、没有 runner、配置损坏、用法错误），以及完整一次运行的事件顺序。

## 测试结果

以下是在 `/tmp` 下全新 clone 到 `bc35c54`、执行 `npm ci` 之后，**用 Collie 自己的 `verify.ts` 运行 `parseBacklog` 解析出的 v01-b04 验收命令**的结果：

| 命令 | 退出码 | 摘要 |
|---|---|---|
| `npm run lint` | 0 | `All matched files use Prettier code style!` |
| `npm run typecheck` | 0 | — |
| `npm test` | 0 | `451 passed, 0 failed` |
| `npm test -- test/arbiter.test.ts` | 0 | `30 passed, 0 failed` |
| `npm test -- test/scenario-a.test.ts` | 0 | `6 passed, 0 failed` |
| `npm test -- test/scenario-b.test.ts` | 0 | `5 passed, 0 failed` |
| `npm test -- test/scenario-c.test.ts` | 0 | `5 passed, 0 failed` |
| `npm test -- test/exit-codes.test.ts` | 0 | `13 passed, 0 failed` |

`npm run build` 为 0。全量共 23 个测试文件、451 个用例，失败 0。

**CI 实际结论（6 个提交全部为 push / main / success）**：

| sha | 结论 | run |
|---|---|---|
| `0b32e6c` | success | https://github.com/CIPFZ/Collie/actions/runs/39241627810 |
| `a7bfbbd` | success | https://github.com/CIPFZ/Collie/actions/runs/39246501168 |
| `c1ecd43` | success | https://github.com/CIPFZ/Collie/actions/runs/39247025567 |
| `21836f7` | success | https://github.com/CIPFZ/Collie/actions/runs/39250786042 |
| `11372e5` | success | https://github.com/CIPFZ/Collie/actions/runs/39251290906 |
| `bc35c54` | success | https://github.com/CIPFZ/Collie/actions/runs/39251885753 |

- **取证来源需要说明**：`0b32e6c` 和 `a7bfbbd` 是用 `ci.ts` 调 REST API 查到的。之后 API 一直被限流（重置要 50 分钟以上），从 `c1ecd43` 起改为读取 GitHub Actions 的**公开网页**——页面里内嵌了 JSON，包含每次运行的 status、conclusion、分支和 commit sha。为了对照，6 个 sha 全部用网页方式又查了一遍，结果一致，见上表。
- 这个网页方式只是我在本地用的辅助脚本，**没有写进 Collie 的代码**。
- `bc35c54` 是三个场景首次在 CI 的 dash 环境下运行，结果通过。场景里的测试脚本只用 POSIX sh 语法，提交前也在 bash 和 zsh 的 sh 兼容模式下跑过。

**依赖**：
- 新增 `commander@15.0.0`（MIT，在 SPEC 2.2 里）。运行时依赖树为 commander、smol-toml、yaml、zod，没有传递依赖。
- `engines.node` 改为 `>=22.12.0 <23.0.0`，因为 commander 15 要求的最低版本是这个。

**受保护文件**：6 个提交都没有触及 SPEC、CONSTRAINTS、ROADMAP、ROLES、`AGENT-*`、`docs/`、`.collie/`。

**推送**：`origin/main` 等于 `bc35c54ef3fc0d4efc1d02a7d3f9ad7b5f28cd8a`。

## 偏离或疑问

1. **本批次又没有 task.md，也没有经过计划确认，是按你的指示直接做的。** 这已经是连续第二个批次这样做了；v0.1 的流程（SPEC 6）本身要求由 R2 签发 task。

2. **【关键设计取舍，请 R1 确认】arbiter 用的是 R2 自己的实测结果，而不是 reviewer 报上来的 evidence。**
   - SPEC 4.3 的输入写的是 `verdict.evidence`。但如果完全采信 reviewer 的 evidence，那么在三个场景里，被骗过的 reviewer 只要照抄 worker 的说法，arbiter 就会跟着判 PASS。变异测试证实了这一点：三个场景全部会漏过。
   - 所以我的实现是：reviewer 贡献它的 verdict 原值和它自己发现的 `claim_mismatches`（规则 4）；规则 2、3、5、6、7 用的 evidence 一律由 R2 自己测量（`src/evidence.ts`）。reviewer 报的 evidence 仍然原样留在 verdict.md 里备查。
   - 我认为这才符合铁律 4「不采信，只取证」，以及 ROLES「R2 做确定性比对」的原意。但它和 SPEC 4.3 的字面写法不一致，请 R1 定稿。也可以考虑在 progress 里把 reviewer 的 evidence 和 R2 的实测并列展示，供人工对照。

3. **【越界说明】`collie run` 会自己做 git 提交**：开始时提交 task.md，结束时提交 verdict.md 和 progress.md。这是 SPEC 6「R2 提交 .collie/ 与 progress.md」的实现；task 的提交时机是我的取舍——它必须在 worker 开工之前落盘，`base_sha..head_sha` 的取证范围才清晰。它**不会 push**，推送仍由人或以后的版本来做。

4. **规则 3 的扩展**：规则 2、3 判 BLOCK 时，如果背后有被否认的声称（`spec_touched=false`、未申报的 `new_deps`），也会记一条 `claim.mismatch`。SPEC 只要求规则 5～7 记录，我加上这两条，是为了让场景 C 的证据链里能直接看到「worker 声称没改 SPEC」这句谎话。

5. **reviewer 的 worktree 是隔离了，但不是沙箱。**
   - worktree 里确实没有 report.md，场景测试证实了这一点。但 reviewer 有 Bash，仍然可以 `git show <信封提交>:.collie/.../report.md`，因为 worktree 与主仓库共享对象库。
   - 要彻底隔离，需要只读 hook 或容器，这属于 v1.0。
   - 另外，worktree 里的 `node_modules` 是指向主工作区的符号链接，所以 reviewer 能看到主工作区的依赖。

6. **`APPROVED_DEPENDENCIES` 硬编码在 `src/run.ts` 里**，内容是 SPEC 2.2 加 ADR-002 的清单。它不是阈值，但也是「从 SPEC 抄过来的事实」。以后新增 ADR 就得改代码。建议放进 `collie.toml`，或者给 SPEC 2.2 一个机器可读的格式。

7. **`dist/` 里带着 `runner/fake.js`**（`npm pack` 可以看到）。它是测试用的替身，打包时最好排除，但改 tsconfig.build 不在本批次范围内。

8. **历史 verdict 不会被修改**：v01-b01 和 v01-b02 的 verdict 只因 `ci_conclusion` 是自由文本而不符合新 schema。将来如果用 `collie show` 去读它们，只会原样打印，不会被拿来重新仲裁，所以不影响任何结论。

9. **流程方面**：CI 一直被 API 限流，网页方式不受影响。**强烈建议给环境配一个只读的 `GITHUB_TOKEN`**——`ci.ts` 已经支持读取它，配上之后就不再需要网页方式。

## 下一步建议

1. **v0.1 的验证目标已经达成**：三个场景都被拦住了，而且都是在 reviewer 被骗过（判 PASS）的情况下，由 R2 自己取证拦下的；每个场景都有诚实的对照组，证明拦截确实来自「声称与实测不符」。
2. 请 R1 裁定上一段第 2 条（arbiter 用谁的 evidence），这决定了 SPEC 4.3 应该怎么改写。
3. 接下来要真正「用 Collie 开发 Collie」，还差 `runner/claude.ts`。backlog 里说它是「v0.1 收尾单独批次，视 b04 结果决定」。我建议现在就签发，因为本批次已经把接口（`finalText`、`signal`、worktree 作为 cwd）准备好了。
4. R4 核对「读代码核验项」时，可以按下表找到对应位置：

| 核验项 | 位置 |
|---|---|
| 每条规则有独立用例且顺序敏感 | `test/arbiter.test.ts`，每条规则一个 describe 组，外加 `order matters` 组 |
| 场景构造的是声称与实测不符 | 每个场景文件里的 `honest twin` 用例，以及 `test/support/sandbox.ts` 的 `workerScene`：worker 声称的内容固定不变，只改它实际提交了什么 |

```json
{
  "schema_version": 1,
  "batch_id": "v01-b04",
  "head_sha": "bc35c54ef3fc0d4efc1d02a7d3f9ad7b5f28cd8a",
  "claims": {
    "commits": [
      "0b32e6ccc9959a3c210a6552ab7c0c7c4db4d46d",
      "a7bfbbdecd6977d772cf5b2abec4a9765b63b66b",
      "c1ecd431b014ce2bed793caba598fc4df1b4b641",
      "21836f78aa54cb967cff9952bb363be44c152ec3",
      "11372e54efdf60834c0923b8594b734522e59d1c",
      "bc35c54ef3fc0d4efc1d02a7d3f9ad7b5f28cd8a"
    ],
    "tests_passed": 451,
    "tests_failed": 0,
    "pushed": true,
    "ci_passed": true,
    "new_deps": ["commander"],
    "spec_touched": false
  },
  "open_questions": [
    "The arbiter judges claims against R2's own measured evidence, not the reviewer's verdict.evidence; with the reviewer's evidence a fooled reviewer lets all three scenarios through. SPEC 4.3 says verdict.evidence. Please ratify or rule otherwise.",
    "collie run commits the task envelope before the worker and verdict.md + progress.md after; it never pushes. Confirm this R2 commit behaviour.",
    "The reviewer worktree has no report.md, but Bash can still read it from the shared object store (git show). Full isolation needs v1.0 hooks or containers.",
    "APPROVED_DEPENDENCIES is hard-coded in src/run.ts from SPEC 2.2 + ADR-002; move it to collie.toml? Also dist/ ships runner/fake.js."
  ]
}
```
