---
schema_version: 1
run_id: r-20261117150143
batch_id: v046-b05
base_sha: a25947e92a6f102ecc029333dad9350579457ed3
created_at: 2026-11-17T15:01:43.880Z
attempt: 1
interrupted_at: null
issued_by: collie
---

# 批次 v046-b05：红检查加静态检查：只多了验收测试的树上 lint 与类型检查必须通过（不接进队列）

## 你的身份与边界

你的身份、权限边界与工作协议见 `AGENT-worker.md`，全局铁律见 `CONSTRAINTS.md`，
方案来源见 `SPEC.md`。本文件只做本批次提醒。

## 本批次条目（3 个）

1. 读 SPEC 16.11 的「红检查加静态检查」一段（判据原文在 16.10）。`src/redcheck.ts`：`RunRedCheckOpts` 加可选的 `staticCommands`（字符串数组，每条是一条 shell 命令）。
   两个测试文件跑完之后，在 `tree` 里逐条执行（经注入的 `spawn`，以 `sh -c <命令>` 的形式，超时用同一个 `timeoutMs`）；退出码不是 0 的记一条问题：
   `file` 是 `'static'`，`testName` 是命令原文，`reason` 含退出码与输出的末 20 行；超时的同样记一条，写明是超时。测试的问题与静态检查的问题一起返回，`ok` 要两边都没有问题才是 true。
   不传 `staticCommands` 时，行为与返回值和现在完全一样。测试文件自己超时的，照旧直接返回，不再跑静态命令。
   **`new.test.ts` 两条都失败，静态命令是一条退出码 3、输出里有 `boom` 的命令 → 不过，问题里有这条命令的原文、`3` 与 `boom`；换成退出码 0 的命令 → 过**
2. 同一文件：`keep.test.ts` 存在而没有拿到它的报告（vitest 没有写出报告文件）时，记一条问题 `file` 为 `'keep'`、`reason` 是 `no report produced`，不再当成没有这个文件而放行。
   `judgeRedCheck` 不改：它的「`keepReport` 为 null 即没有 keep 文件」的约定留着，这一处在 `runRedCheck` 里判断。
3. `test/redcheck.test.ts` 新加一组 `describe('runRedCheck: static commands and missing reports', …)`：
   条目 1 加粗的两种情形（真实的 vitest 跑真实的文件，静态命令真实执行）；两条静态命令、第一条过第二条不过 → 只有第二条的问题；
   测试的问题与静态检查的问题同时存在 → 两类都在返回值里；静态命令超时（注入的假子进程）；不传 `staticCommands` → 一条静态命令都没执行；
   条目 2：`keep.test.ts` 存在、注入的假子进程不写报告 → 不过，原因是 `no report produced`。
   R1 查过现有用例：`passes when keep report is null (no keep file)` 是 `judgeRedCheck` 的用例，本批次不改 `judgeRedCheck`，它不受影响；
   `fails on timeout with injected fake spawn` 测的是测试文件超时，行为不变。已有用例一条都不改；你发现有别的现有用例与本批次冲突，停下，在「偏离或疑问」里写明。
   `test/invariants.test.ts` 加「`src/redcheck.ts` 里有 `staticCommands`」

## 验收标准（可机器判定）

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 红检查的测试通过，仓库里没有留下报告 | `npm test -- test/redcheck.test.ts && ! test -e .vitest` | exit 0 |
| 新的一组用例在 | `grep -qF "runRedCheck: static commands and missing reports" test/redcheck.test.ts` | exit 0 |
| 静态检查与缺报告两处都进了代码与测试 | `grep -qF "staticCommands" src/redcheck.ts && grep -qF "staticCommands" test/redcheck.test.ts && grep -qF "no report produced" src/redcheck.ts && grep -qF "no report produced" test/redcheck.test.ts` | exit 0 |
| 测试不在系统临时目录留下东西 | `d=$(mktemp -d) && TMPDIR=$d npm test -- test/redcheck.test.ts && ! ls -d "$d"/collie-redcheck-* >/dev/null 2>&1` | exit 0 |
| 不变量同步 | `grep -qF "staticCommands" test/invariants.test.ts` | exit 0 |

## 本批次额外禁止

- 改动任何受保护路径；改动 `.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`
- 改动 `judgeRedCheck` 的判据；改动 `src/run.ts`、`src/roles/`、`src/runner/`、`src/backlog.ts`、`src/arbiter.ts`、`src/gate.ts`、`src/evidence.ts`、`src/view.ts`、`src/follow.ts`；把红检查接进队列
- 为了让测试过而删除或跳过任何测试；改写任何已有断言
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求（本批次的测试可以起真实的 vitest 子进程与真实的 `sh`，别的不行）；新增依赖

## 汇报要求

完成后写 `.collie/batches/v046-b05/report.md`：固定四段（做了什么 / 测试结果 / 偏离或疑问 / 下一步建议）
+ 尾部围栏 JSON 块，格式见 SPEC 3.4。
写完后以 `report(collie): v046-b05` 为提交信息单独提交并推送该文件。
