# 批次 v01-b02 汇报

## 做了什么

按 task.md 顺序完成三个条目，共 4 个代码提交，每个提交单独推送。

| 提交 | scope | 内容 |
|---|---|---|
| `0ff9ef5` | backlog | 条目 1 |
| `8e7dbd4` | runner | 条目 2，以及 ESLint 导入隔离 |
| `4785816` | schema | 条目 3 的信封 schema 与 envelope 工具，新装 `yaml` |
| `e30c4ee` | roles | 条目 3 的 worker 角色 |

**条目 1：`src/backlog.ts`**

- 对外接口：`parseBacklog(text, source?)` 和 `loadBacklog(root)`。
- 逐行扫描，不引入 Markdown 解析库。错误统一抛 `BacklogError`，带 `line`（从 1 开始）、`batchId`，消息为 `<文件>:<行>: [<batch id>] <原因>`。
- 表格单元格按 GFM 规则切分：只按未转义的 `|` 切分，`\|` 还原为 `|`。列数不对就报错，提示要转义管道符。
- 总览表：
  - 表头必须恰好是 `优先级 | 批次 | 标题 | 依赖 | 状态`；缺列会点名，顺序错也报错。
  - 优先级必须是整数，batch id 不得重复。
  - 依赖写 `—`、`-`、`无` 或留空时为 `[]`，多个依赖可用 `,`、`，`、`、` 分隔。
  - status 用 `BatchStatusSchema` 校验，`已签发` 会被拒绝并给出行号。
- 批次小节 `## <id> <title>`：
  - `优先级：N　依赖：…` 这一行与总览表交叉核对，标题也必须和总览一致（计划 Q3 已采纳）。
  - `条目：` 是编号列表，缩进的续行合进同一条目，用 `\n` 连接。
  - `验收标准：` 的表头必须是 `说明 | 命令 | 期望`。
  - `额外禁止：` 是 `-` 列表，缺省为 `[]`。
  - 小节里的其他段落当作说明文字忽略。
- 可判定性校验：
  - `命令` 列必须是一个完整的代码 span（Q3 收紧），`cmd` 取反引号内的内容，不能为空。
  - `期望` 列只接受 `exit 0`，映射为 `'exit_zero'`。
  - 不满足时，报错消息包含 batch id、该条验收的「说明」和原文。
- 结构校验：总览里有、但没有小节的批次，或反过来；`depends_on` 引用不存在的 id；批次依赖自己——都报错。
- 最后每个批次再过一遍 `BatchSchema`。任何一个批次不合格，整个解析就失败，不会只返回其余批次。
- 对当前 `docs/backlog.md` 的解析结果：3 个批次，验收条数依次为 7 / 8 / 7。v01-b02 那条 grep 里的 `\|` 被正确还原。

**条目 2：runner**

- `src/runner/index.ts`：按 SPEC 4.1 定义 `AgentRole`、`Usage = { inputTokens, outputTokens }`、`RunOptions`（不含 `model`）、`RunResult`、`AgentRunner`。这些都只是进程内的 TS 类型，不会序列化，所以不放 `src/schema/`。
- `src/runner/fake.ts` 的 `FakeRunner(scenes)`，每次 `run` 消耗一幕剧本。每一幕可以设置：

| 字段 | 作用 |
|---|---|
| `expectRole` | 被调用时的 role 不符就抛错 |
| `files` | 写到 cwd 下，自动建目录；绝对路径或带 `..` 的路径在构造时就被拒绝 |
| `events` | 依次回调 `onEvent` |
| `effect` | 在写完文件之后执行，供 b03 做 git 提交等操作 |
| `result` 或 `error` | 二选一，由判别联合类型保证 |

- 其他行为：`calls` 记录每次调用的完整参数（数组做拷贝），失败的调用也记录；剧本用完后再调用就抛 `FakeRunnerError`；返回的结果是拷贝，调用方改不到剧本。
- 对 b03 三个场景的承载方式：
  - 场景 A（声称 CI 全绿）和场景 B（声称测试全过）：用 `files` 写出带相应 claims 的 report.md；场景 B 再用 `files` 写入会失败的测试。
  - 场景 C（diff 含 SPEC 改动）：用 `files` 改 `SPEC.md`，再在 `effect` 里 `git commit`。
  - reviewer 写 verdict.md 也用同样的机制。
- ESLint 导入隔离（计划提案，已采纳）：
  - 在 `src/runner/` 以外的整个 `src/` 里，禁止 import `@anthropic-ai/*`。
  - 在 `src/roles/**` 里，额外用正则 `(^|/)(runner/)?fake(\.js)?$` 禁止导入 fake。
  - `test/skeleton.test.ts` 对 `src/roles/worker.ts` 实测了 5 种写法都被拦下：带 `.js` 的 import、不带扩展名的 import、`export … from`、`import type`、SDK；接口 `runner/index.js` 则放行。

**条目 3：worker 角色与信封**

- `src/schema/index.ts` 新增：
  - `SHA_PATTERN`、`ShaSchema`、`BatchIdSchema`（路径安全）。
  - `TaskFrontmatterSchema`：strict，接受可选的 `issued_by`、`revised_at`；`interrupted_at` 必须存在且为 `null`。
  - `ClaimsSchema`（含 `ci_passed`）和 `ReportSchema`，都是 strict。
  - 这些都是新增的 schema，没有改已有字段，所以没有 bump `SCHEMA_VERSION`。`BatchSchema.id` 也刻意没有改成路径安全正则，同样是为了不构成字段变更。
- `src/schema/envelope.ts`（对应 SPEC 4 里的 envelope.ts）：
  - `renderFrontmatter` 先校验再输出 YAML。
  - `splitFrontmatter` / `parseTaskFrontmatter`：读回 frontmatter 并校验。
  - `fencedBlocks` / `lastJsonBlock`：按 CommonMark 规则扫描围栏——只认最外层，关闭围栏必须同种字符、长度不小于开启围栏、且不带 info string；缩进 4 格的不算围栏。遇到未闭合的围栏就报错。
- `src/roles/worker.ts`：
  - `buildTask(batch, ctx)`：frontmatter 字段按 SPEC 3.3 的顺序输出。正文依次是标题、身份与边界、条目、验收表、额外禁止、汇报要求，汇报要求里写明 `report(collie): <id>` 的单独提交。
    - 写进验收表的命令会把 `|` 转义成 `\|`；命令里本身有反引号时，用更长的反引号串包住。
    - 时间由调用方通过 `ctx` 传入，函数内部不读时钟。
  - `writeTask`：写到 `.collie/batches/<id>/task.md`。如果 envelope 和 batch 的 id 不一致，就拒绝写入。
  - `runWorker`：
    - systemPrompt 读 `<root>/AGENT-worker.md`。
    - allowedTools 取 `cfg.agent.worker.allowed_tools` 的拷贝，maxTurns 取 `cfg.agent.worker.max_turns`，cwd 为 root。
    - prompt 只给出 task.md 的路径。
    - 原样返回 `RunResult`。
  - `readReport`：以下情况都抛 `ReportError`：文件不存在、没有 json 块、最后一块没有闭合、JSON 解析失败（附块所在行）、schema 校验失败（附字段路径）、`batch_id` 与期望不符。有多个 json 块时取最后一个。

**额外自检：变异测试**

对 13 处关键守卫逐个做变异，每一处都至少有 1 个测试失败。所有变异都用文件拷贝还原，并用 `cmp` 确认与原文件一致。

| 模块 | 变异 |
|---|---|
| backlog | 接受任意 expect、跳过未知依赖检查、跳过 status 检查、不还原 `\|`、不要求代码 span |
| envelope | 取第一块而不是最后一块、关闭围栏长度任意、关闭围栏可带 info string、容忍未闭合围栏 |
| worker | 跳过 batch_id 检查、单元格不转义 `\|`、systemPrompt 置空、frontmatter 多出一个字段 |

## 测试结果

以下均在 `e30c4ee` 上实跑，本地工作区与之一致。

| 命令 | 退出码 | 输出摘要 |
|---|---|---|
| `npm run lint` | 0 | `All matched files use Prettier code style!`，ESLint 无输出 |
| `npm run typecheck` | 0 | 无输出 |
| `npm test` | 0 | `Test Files  10 passed (10)` / `Tests  236 passed (236)` |
| `npm test -- test/backlog.test.ts` | 0 | `Tests  10 passed (10)` |
| `npm test -- test/backlog-reject.test.ts` | 0 | `Tests  23 passed (23)` |
| `npm test -- test/worker.test.ts` | 0 | `Tests  14 passed (14)` |
| `npm test -- test/task-envelope.test.ts` | 0 | `Tests  17 passed (17)` |
| `test -d src/roles && ! grep -rE "from ['\"](@anthropic-ai\|\.\./runner/fake\|\./fake)" src/roles/`（`\|` 已按 GFM 还原后执行） | 0 | 无匹配 |
| `npm run build` | 0 | — |

上表的 8 条验收命令，是在 `/tmp` 下全新 clone 并执行 `npm ci` 之后，**用本批次实现的 `loadBacklog` 从 `docs/backlog.md` 解析出来、再逐条执行的**，结果与本地一致。也就是说，Collie 自己读出并跑通了自己这个批次的验收标准。

各测试文件的用例数如下，合计 236，失败 0：

| 文件 | 用例数 |
|---|---|
| backlog-reject | 23 |
| backlog | 10 |
| config | 18 |
| envelope | 37 |
| journal | 28 |
| runner-fake | 15 |
| schema | 51 |
| skeleton | 23 |
| task-envelope | 17 |
| worker | 14 |

**CI 实际结论**：4 个提交全部为 `push / main / success`，明细与 run URL 见本文末尾「CI 实际结论」表。

**推送事实**：`git fetch origin` 后，`origin/main` 等于 `e30c4eea56a2908b1dd7309fc34354fa42eaccba`。

**许可证（ADR-003）**：
- 运行时依赖树只有 3 个包：`zod@4.6.7`（MIT）、`smol-toml@1.9.1`（BSD-3-Clause）、`yaml@2.9.1`（ISC），都没有传递依赖，全部在白名单内。
- 开发依赖全树共 187 个包，没有 GPL / AGPL / SSPL，也没有许可证未知的包。白名单外的只有 MPL-2.0（12 个）和 BlueOak-1.0.0（1 个），与 b01 相同，按 ADR-003 方案 A 不构成违规。

**受保护文件**：我的 4 个提交都没有触及 SPEC、CONSTRAINTS、ROADMAP、ROLES、`AGENT-*`、`docs/`、`.collie/`。`4a690f5..e30c4ee` 范围内的 `docs/progress.md` 与 task.md 改动，来自 R1 的重签提交 `b68d23b`，按 SPEC 3.3 不属于 worker 产出。

## 偏离或疑问

1. **【重要，验收命令仍可能空跑】`\|` 的语义取决于谁来读这条命令。**
   - GFM 要求在表格里把管道符写成 `\|`。但如果把 task.md 或 backlog.md 的**源码原样**粘进 shell，grep 会把 `\|` 当成字面量。
   - 我实测过：即使 `src/roles/` 里确实存在 `import … from '../runner/fake.js'`，原样执行这条命令也返回 exit 0，检查完全失效。只有按 GFM 规则把 `\|` 还原成 `|` 之后，它才会正确返回 1。
   - 程序侧不受影响：`parseBacklog` 会做这一步还原，所以 b03 的 verify.ts 只要使用解析后的 `cmd` 就没有问题。
   - 风险在于 R4 或人从源码复制命令。建议二选一：在 SPEC 3.2 里明确「验收命令以 `parseBacklog` 的输出为准」，或者让 R4 用 Collie 解析出的命令清单来执行。
2. **测试与可变文档的耦合（自行决策）。**
   - task 要求测试断言当前 backlog 的 status。但 status 会随批次推进而改变，而 R1 无权改代码；照字面做，R1 下一次把 b02 改成 `passed` 时，CI 就会变红。
   - 我的处理：status 的逐值比对放在冻结的快照 `test/fixtures/backlog.md` 上（取自 `4a690f5`）；对实时文件，逐一比对按 ROLES「批次随之固定」不会再变的字段，status 只断言在枚举内。
   - 同理，`test/envelope.test.ts` 会读 `.collie/batches/v01-b01/report.md`（历史信封，不会再变）和 `v01-b02/task.md`（只断言 batch_id 与 `interrupted_at`）。如果 R2 以后会改动或删除 `.collie/batches/` 下的历史文件，请告知，我会改为使用快照。
3. **【需裁定】`claims.ci_passed` 的加入没有 bump `SCHEMA_VERSION`。**
   - 铁律 14 规定字段变更必须 bump 版本并写迁移。现在 v01-b01 的 report.md 和新 schema 都标着 `schema_version: 1`，但这份 report 缺少 `ci_passed`，会被新的 `ReportSchema` 拒绝。`test/envelope.test.ts` 有一个用例专门记录了这个事实。
   - 可选方案：bump 到 2 并为 v1 report 写迁移（例如缺省为 `ci_passed=false`），或者裁定 v0.1 内部版本仍为 1，b01 的 report 视为历史快照不再读取。
4. **AGENT-worker.md §5 的示例在 GitHub 上渲染错误。**
   - 它用三个反引号的 ```` ```markdown ```` 包裹了一个 ```` ```json ````。按 CommonMark，带 info string 的那一行不能当关闭围栏，第 124 行的 ```` ``` ```` 关闭的是外层块，第 125 行反而开启了一个永远不闭合的块，我的 `fencedBlocks` 也会对它报错。
   - 建议 R1 把外层改成四个反引号。另外，我在执行计划里说「它用的是 ```` ```` ```` 嵌套」，那是我说错了，在此更正。
5. **YAML 会把部分 sha 读成数字。**
   - 未加引号的 `1234567e10`（合法的十六进制 sha）会被 YAML 解析成数字 `12345670000000000`；全数字的 sha 同理。
   - 对生成侧，`yaml.stringify` 会自动加引号，已有测试锁住。人工签发的 task.md 如果不加引号就有风险，好在 schema 收到数字会报错，不会悄悄出错。建议人工签发时给 `base_sha` 加引号。当前 v01-b02 的 task.md 不受影响。
6. **`readReport` 只取「最后一个」json 块，不要求它确实位于文末。** 这是按 task 原文实现的。SPEC 3.4 写的是「尾部 JSON 块」，如果要求块之后不能再有正文，需要 R1 确认后我再收紧。
7. **给 b03 的待定问题。**
   - **`wallclock_secs` 无处执行**：SPEC 3.1 中它没有标注「v0.2 生效」，意味着 v0.1 就要生效，但 `RunOptions` 没有超时或 `AbortSignal`。b03 需要决定由 runner 还是 R2 来执行这个上限。
   - **模型名的传递**：`claude.ts` 需要在构造时接收配置，按 role 自己查模型名，接口签名保持干净。
8. **小事项。**
   - `no-restricted-imports` 和那条 grep 都覆盖不到动态 `import()` 与 `require`。如果需要覆盖，b03 可以加一条 `no-restricted-syntax`。
   - `src/runner/fake.ts` 位于 `src/` 下，所以会进入 `dist/`。它只依赖 `node:fs`，没有许可证问题，但等于把测试替身发布了出去。要排除的话，可以在 `tsconfig.build.json` 里 exclude 它。
9. **b01 写 report 时觉得别扭、但还没解决的地方**（前三条已在计划阶段采纳）：
   - `tests_passed` / `tests_failed` 的口径没有定义。我默认取 `npm test` 的总数，但 skipped / todo 的测试无处表达，多个测试命令时也不知道该填哪一个的。
   - `new_deps` 的格式没有定义：是只写包名还是写 `name@range`？要不要包含开发依赖？我本次只写包名。

## 下一步建议

1. 先裁定上一段第 1 条（命令的来源）和第 3 条（schema 版本），这两条都会直接影响 b03 的 verify 与 arbiter。
2. R4 核对「测试内容要求」时，可以按下表找到对应用例：

| 要求 | 文件与用例 |
|---|---|
| 当前 backlog 的 3 个批次逐字段相等 | `backlog.test.ts`：`parses into exactly the three v0.1 batches…`；status 在 `frozen fixture` 组 |
| v01-b01 的 7 条 cmd 原样还原 | `backlog.test.ts`：`restores the 7 acceptance commands…` |
| exit 1 / 人工确认 / 质量良好 / 依赖不存在 / 已签发 | `backlog-reject.test.ts`：首个 `it.each`，以及 `overview table` 组 |
| 全链路闭环、systemPrompt、allowedTools、claims 类型 | `worker.test.ts`：`fake runner closed loop` 组 |
| frontmatter 可解析、字段齐全、`interrupted_at: null`、表格行数 | `task-envelope.test.ts` |
| readReport 边界（无块 / 两块取后者 / 校验失败） | `worker.test.ts`：`readReport boundaries` 组 |

3. 给 b03 的接口提示：
   - verify.ts 请直接使用 `Batch.acceptance[].cmd`（`\|` 已还原）。
   - reviewer 读 verdict.md 可以复用 `lastJsonBlock`。
   - 场景 C 用 `FakeScene.effect` 做 git 提交。

**CI 实际结论（GitHub REST API，按 sha 查询）**：

于 2026-10-19 07:04 UTC 查得（此前被共享出口 IP 的限流挡了约 30 分钟，出口 IP 在 43.128.91.x / 43.128.123.x 之间轮换）：

| sha | event | head_branch | conclusion | run |
|---|---|---|---|---|
| `0ff9ef5` | push | main | success | https://github.com/CIPFZ/Collie/actions/runs/39209314924 |
| `8e7dbd4` | push | main | success | https://github.com/CIPFZ/Collie/actions/runs/39209681403 |
| `4785816` | push | main | success | https://github.com/CIPFZ/Collie/actions/runs/39210038344 |
| `e30c4ee` | push | main | success | https://github.com/CIPFZ/Collie/actions/runs/39210459754 |

```json
{
  "schema_version": 1,
  "batch_id": "v01-b02",
  "head_sha": "e30c4eea56a2908b1dd7309fc34354fa42eaccba",
  "claims": {
    "commits": [
      "0ff9ef56411893b923095d277fa77fd1e78443c0",
      "8e7dbd46b8847dd46e6e699195cbbca4cbd89e77",
      "4785816932a8712f777a432b144c992824f38f25",
      "e30c4eea56a2908b1dd7309fc34354fa42eaccba"
    ],
    "tests_passed": 236,
    "tests_failed": 0,
    "pushed": true,
    "ci_passed": true,
    "new_deps": ["yaml"],
    "spec_touched": false
  },
  "open_questions": [
    "GFM-escaped \\| in acceptance commands is a literal pipe to grep when the Markdown source is pasted into a shell; the v01-b02 grep then passes even with a violation present. Should acceptance commands be defined as parseBacklog output?",
    "claims.ci_passed was added without bumping SCHEMA_VERSION; the v01-b01 report (schema_version 1) now fails ReportSchema. Bump to 2 with a migration, or keep 1 and treat v01-b01 as history?",
    "AGENT-worker.md §5 nests ```json inside a three-backtick ```markdown fence, which is malformed CommonMark; the outer fence should be four backticks.",
    "wallclock_secs is effective in v0.1 but RunOptions has no timeout or AbortSignal; should the runner or R2 enforce it in b03?"
  ]
}
```
