---
schema_version: 1
run_id: r-20261121021057
batch_id: v046-b27
base_sha: 5c7682d46594ae2e1ab82d5c6f3ee265d6edaaa0
created_at: 2026-11-21T02:10:58.172Z
attempt: 1
interrupted_at: null
issued_by: collie
---

# 批次 v046-b27：开跑前检查：运行器退出码非零算不过，写出结束原因与用时

## 你的身份与边界

你的身份、权限边界与工作协议见 `AGENT-worker.md`，全局铁律见 `CONSTRAINTS.md`，
方案来源见 `SPEC.md`。本文件只做本批次提醒。

## 本批次条目（3 个）

1. 读 SPEC 14.33 的「开跑前检查的修补」一段（这条命令的来历在 14.1）。`src/preflight.ts` 的 `runner` 一项：运行器返回的退出码非零 → `ok` 为 false，`detail` 是 `exitCode=<N>`，返回值带 `stopReason` 时再加 ` stopReason=<原因>`；
   通过与不过的 `detail` 末尾都加 ` secs=<用时秒数，取整>`。用时经可注入的时钟算（缺省用真实时钟），测试里不许真的等。运行器抛错时照旧不过，`detail` 是错误信息。
   **假运行器返回 `exitCode: 1`、`stopReason: 'error'`：`preflight --smoke` 输出里有一行以 `FAIL runner: exitCode=1 stopReason=error` 开头，末行是 `preflight: failed (runner)`，命令的退出码非零；`--json` 里这一项的 `ok` 是 false**
   **假运行器返回 `exitCode: 0`：这一行以 `ok   runner: exitCode=0` 开头、带 `secs=`，命令的退出码是 0**
2. `src/cli.ts` 的 `collie smoke`：运行器返回的退出码非零 → 标准错误写 `smoke failed: exitCode=<N>`（有 `stopReason` 时带上），退出码 1，不再去查 CI，标准输出里没有 `smoke ok`。
   **假运行器返回 `exitCode: 1`：`collie smoke` 的退出码是 1，输出里有 `smoke failed: exitCode=1`、没有 `smoke ok`，CI 一次都没有被查询**
3. 测试。`test/preflight.test.ts` 新加一组 `describe('preflight: runner check judges the exit code', …)`（条目 1 的情形；`secs=` 用注入的时钟让它是一个确定的数）；`test/cli.test.ts` 新加一条 `smoke exits 1 when the runner returns a non-zero exit code`（条目 2 的情形）。
   R1 查过现有用例：`test/preflight.test.ts` 的 `--smoke adds runner and ci_query checks` 用的是 `exitCode: 0`，断言 `ok   runner`，仍然成立；`--smoke runner failure shows FAIL runner` 是运行器抛错，仍然成立；
   `test/cli.test.ts` 的 `smoke succeeds with a fake runner that returns a RunResult` 是 `exitCode: 0`，断言含 `smoke ok` 与 `exitCode=0`，仍然成立；`test/scenario-m.test.ts` 两条 `smoke exits 1 …` 的运行器都是成功的，不受影响；
   `test/follow.test.ts` 用假的子进程代替 `preflight`，不受影响。已有断言一条都不改。
   别的现有用例因为本批次的新行为而失败时：只许做新行为直接要求的最小改动（往序列里加事件、个数加一这一类），不许删断言、不许把断言改松，在「偏离或疑问」里逐条列出原断言与现断言；拿不准是不是新行为直接要求的，才停下不改，写明是哪一条。

## 验收标准（可机器判定）

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 两条命令与用到它们的测试通过 | `npm test -- test/preflight.test.ts test/cli.test.ts test/scenario-m.test.ts test/follow.test.ts` | exit 0 |
| 新的一组与新的一条在 | `grep -qF "preflight: runner check judges the exit code" test/preflight.test.ts && grep -qF "smoke exits 1 when the runner returns a non-zero exit code" test/cli.test.ts` | exit 0 |
| 两条命令都有了不过的说法（不看注释行） | `grep -vE "^\s*(//\|\*\|/\*)" src/cli.ts \| grep -qF "smoke failed" && grep -vE "^\s*(//\|\*\|/\*)" src/preflight.ts \| grep -qF "stopReason"` | exit 0 |

## 本批次额外禁止

- 改动任何受保护路径；改动 `.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`、`templates/collie.toml`
- 改动 `src/run.ts`、`src/follow.ts`、`src/runner/`、`src/schema/index.ts`；改动 `preflight` 别的检查项、不带 `--smoke` 时的行为、队列开头那次检查
- 给用时加阈值或新的配置项（这一批只把用时写出来）；在 `detail` 或输出里写出模型的回复全文、token 或文件的绝对路径
- 为了让测试过而删除或跳过任何测试；改写任何已有断言
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；测试里真的等待；新增依赖

## 汇报要求

完成后写 `.collie/batches/v046-b27/report.md`：固定四段（做了什么 / 测试结果 / 偏离或疑问 / 下一步建议）
+ 尾部围栏 JSON 块，格式见 SPEC 3.4。
写完后以 `report(collie): v046-b27` 为提交信息单独提交并推送该文件。
