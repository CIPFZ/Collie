---
schema_version: 1
run_id: r-20261124063235
batch_id: v046-b42
base_sha: 275427165827c6d92c2314116825c2fa04869a9d
created_at: 2026-11-24T06:38:51.600Z
attempt: 1
interrupted_at: null
issued_by: collie
---

# 批次 v046-b42：preflight --smoke 的用时上限：调一次模型超过 60 秒算不过（带情形）

## 你的身份与边界

你的身份、权限边界与工作协议见 `AGENT-worker.md`，全局铁律见 `CONSTRAINTS.md`，
方案来源见 `SPEC.md`。本文件只做本批次提醒。

## 本批次条目（3 个）

1. 读 SPEC 16.28 的第二段（来历在 14.33）。`src/schema/index.ts`：`[limits]` 加可选的 `smoke_max_secs`（整数，必须大于 0，缺省 60；写法照 `api_retry_wait_secs`）。
   `src/preflight.ts` 的 `runner` 一项：运行器的退出码是 0，而用时（就是 `secs=` 那个数）大于 `smoke_max_secs` 时，这一项不过，`detail` 是 `exitCode=0 secs=<N> exceeds smoke_max_secs=<M>`；不大于时与现在相同。退出码非零、运行器抛错两种情况不变。
2. `templates/collie.toml` 的 `[limits]` 里加一行**注释掉的**说明：`# smoke_max_secs = 60   # 可选；preflight --smoke 调一次模型超过这么多秒就算不过（SPEC 16.28）`。
   **不要加成真的键**：验收测试会往沙箱配置里自己加这一项，模板里已有同名的键就重复了。本仓库的 `.collie/collie.toml` 不许动。`collie smoke` 命令不改。
3. 点名允许改写的旧用例（因为解析结果里多了一个带缺省值的字段），在「偏离或疑问」里列出：`test/config.test.ts` 的 `has the limits of SPEC 3.1`（期望对象加 `smoke_max_secs: 60`）；`test/schema.test.ts` 的夹具 `validConfig.limits`（加这一项，只在它因此失败时才加）。
   R1 查过：`test/preflight.test.ts` 现有用例里注入的用时都在 60 秒以内；`test/follow.test.ts` 用假的子进程代替 `preflight`，不受影响。
   别的现有用例因为本批次的新行为而失败时：只许做新行为直接要求的最小改动（往序列里加事件、个数加一这一类），不许删断言、不许把断言改松，在「偏离或疑问」里逐条列出原断言与现断言；拿不准是不是新行为直接要求的，才停下不改，写明是哪一条。

## 本批次情形

- S1 [新] 假运行器返回 `exitCode: 0`，注入的时钟让 `runner` 这一项用了 61 秒，沙箱配置里没有 `smoke_max_secs`，执行 `preflight --smoke --runner fake`：退出码不是 0；输出里有一行以 `FAIL runner: exitCode=0 secs=61` 开头；输出的最后一行是 `preflight: failed (runner)`
- S2 [新] 同 S1，但沙箱的 `.collie/collie.toml` 在 `[limits]` 一节里多了一行 `smoke_max_secs = 120`（已提交）：退出码是 0；输出里有一行以 `ok   runner: exitCode=0 secs=61` 开头
- S3 [新] 同 S1，命令再加 `--json`，把输出按 JSON 解析：`checks` 里 `name` 为 `runner` 的那一项的 `ok` 是 false，顶层的 `ok` 是 false
- K1 [保持] 假运行器返回 `exitCode: 0`，注入的时钟让这一项用了恰好 60 秒，沙箱配置里没有 `smoke_max_secs`：退出码是 0；输出里有一行以 `ok   runner: exitCode=0 secs=60` 开头
- K2 [保持] 假运行器返回 `exitCode: 1`，这一项用了 3 秒：输出里有一行以 `FAIL runner: exitCode=1` 开头，输出的最后一行是 `preflight: failed (runner)`
- K3 [保持] 不带 `--smoke` 执行 `preflight`：退出码是 0；输出里没有以 `ok   runner` 或 `FAIL runner` 开头的行

## 本批次接口

- `test/support/sandbox.ts` 的 `Sandbox`：`await box.cli(argv, runner, extra)`，第三个参数可以传 `{ preflightNow: () => number }`（毫秒）。`runner` 一项的用时是它在这一项前后两次返回值的差，四舍五入到秒；搭法照 `test/preflight.test.ts` 里 `describe('preflight: runner check judges the exit code', …)` 一组
- 假运行器：`new FakeRunner([{ expectRole: 'worker', result: { exitCode: 0 } }])`（来自 `src/runner/fake.ts`）
- 往沙箱配置里加一项：`box.read('.collie/collie.toml')`，在 `[limits]` 那一行后面插入一行，`box.write` 写回并 `box.commitAll`（开跑前检查要求工作区干净）。实现之前这个键不被认得，配置读不出来，所以 S2 现在是红的
- `--json` 的输出是 `{ "ok": boolean, "checks": [{ "name", "ok", "detail" }] }`；输出末尾有一个换行，「最后一行」指去掉它之后的最后一行

## 验收标准（可机器判定）

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过（含验收测试） | `npm test` | exit 0 |
| 本批次的验收测试通过 | `npm test -- test/acceptance/v046-b42` | exit 0 |
| 模板里只有注释掉的说明，本仓库的配置没动 | `grep -qE "^# smoke_max_secs = 60" templates/collie.toml && ! grep -qE "^smoke_max_secs" templates/collie.toml && ! grep -qF "smoke_max_secs" .collie/collie.toml` | exit 0 |

`test/acceptance/v046-b42/` 下是本批次的验收测试，由测试 agent 写好，你不能改（受保护路径）。

## 本批次额外禁止

- 改动任何受保护路径（含 `test/acceptance/`、`AGENT-*.md`、`.collie/collie.toml`、`.github/`、`eslint.config.js`、`vitest.config.ts`）
- 改动 `src/cli.ts`、`src/follow.ts`、`src/run.ts`、`src/runner/`；改动 `preflight` 别的检查项、`collie smoke`、队列开头那次检查
- 把模板里那一行加成真的键；在 `detail` 或输出里写出模型的回复、token 或文件的绝对路径
- 为了让测试过而删除或跳过任何测试；改写条目 3 点名之外的任何已有断言
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；测试里真的等待；新增依赖

## 汇报要求

完成后写 `.collie/batches/v046-b42/report.md`：固定四段（做了什么 / 测试结果 / 偏离或疑问 / 下一步建议）
+ 尾部围栏 JSON 块，格式见 SPEC 3.4。
写完后以 `report(collie): v046-b42` 为提交信息单独提交并推送该文件。
