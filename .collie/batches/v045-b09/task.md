---
schema_version: 1
run_id: r-20261117035500
batch_id: v045-b09
base_sha: 998319a9a1aa778e9d7141b2ab30fcd9eeb6b846
created_at: 2026-11-17T03:55:01.738Z
attempt: 1
interrupted_at: null
issued_by: collie
---

# 批次 v045-b09：变异检查判定收紧：基线含类型检查、caught 看测试结果不看退出码、超时不算 invalid

## 你的身份与边界

你的身份、权限边界与工作协议见 `AGENT-worker.md`，全局铁律见 `CONSTRAINTS.md`，
方案来源见 `SPEC.md`。本文件只做本批次提醒。

## 本批次条目（3 个）

1. 基线与判定（SPEC 15.5 前两条；`scripts/mutation.ts` 的 `runBaseline`、`runMutation`、`judgeExecResult`）：基线先跑整项目类型检查再跑相关测试，任何一步不过、或一个测试都没执行，立刻退出码 1 并在末行写 `mutation: baseline failed (<原因>)`；
   每一项用 vitest 的 JSON 报告判定：执行了测试且至少一个用例失败才是 `caught`，测试进程非零退出却没有用例失败算 `invalid`。判定写成不起子进程的纯函数，输入是 JSON 报告与退出信息。
   JSON 报告用 `--outputFile` 写到系统临时目录、读完删掉；不带它时 vitest 会在当前目录建 `.vitest/`，基线是在工作区里跑的，不能把工作区弄脏
2. 超时与末行（SPEC 15.5 后两条）：类型检查超时记 `timeout`；类型检查限 120 秒、测试进程限 180 秒；末行固定为 `mutation: caught <n> survived <n> invalid <n> timeout <n> stale <n>`，全部 `caught` 才退出码 0。
   清单的 44 项不动
3. `test/mutation.test.ts` 补齐（仍然**不在测试里跑变异**，只喂 JSON 报告样例）：有用例失败 → `caught`；全过 → `survived`；非零退出但失败用例数为 0 → `invalid`；执行的用例数为 0 → `invalid`；
   类型检查超时 → `timeout`；基线三种不过各一条；末行格式。`test/invariants.test.ts` 加「`scripts/mutation.ts` 含 `numFailedTests`」。
   顺带：`test/preflight.test.ts` 里「本地落后远端」那条用例建的 `collie-clone-*` 目录，用完删掉

## 验收标准（可机器判定）

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 判定函数的专项测试通过 | `npm test -- test/mutation.test.ts` | exit 0 |
| 专项测试不少于 18 个 | `grep -cE "^\s+it\(" test/mutation.test.ts \| grep -qE "^(1[8-9]\|[2-9][0-9])$"` | exit 0 |
| 判定看测试结果（不看注释行） | `grep -vE "^\s*(//\|\*\|/\*)" scripts/mutation.ts \| grep -qE "numFailedTests" && grep -qE "numFailedTests" test/mutation.test.ts` | exit 0 |
| 变异检查全部被发现、末行是固定格式、工作区里没有留下报告 | `out=$(npx tsx scripts/mutation.ts 2>&1) && printf '%s\n' "$out" \| tail -n 1 \| grep -qE "^mutation: caught [0-9]+ survived 0 invalid 0 timeout 0 stale 0$" && ! test -e .vitest` | exit 0 |
| preflight 的测试不在系统临时目录留下克隆目录 | `d=$(mktemp -d) && TMPDIR=$d npm test -- test/preflight.test.ts && ! ls -d "$d"/collie-clone-* >/dev/null 2>&1` | exit 0 |
| 清单仍不少于 44 项 | `npx tsx scripts/mutation.ts --list \| grep -c . \| grep -qE "^(4[4-9]\|[5-9][0-9]\|[1-9][0-9][0-9])$"` | exit 0 |
| 不变量同步 | `grep -qE "numFailedTests" test/invariants.test.ts` | exit 0 |

## 本批次额外禁止

- 改动任何受保护路径；改动 `.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`
- 改动 `src/` 下任何文件
- 为了让测试过而删除或跳过任何测试；为了让变异检查通过而从清单里去掉某一项、或把超时与编译不过算成被发现
- 为了让验收命令通过而改注释或字面（铁律 26）
- 把变异检查并进 `npm test`；让它改动工作区里的文件；新增依赖

## 汇报要求

完成后写 `.collie/batches/v045-b09/report.md`：固定四段（做了什么 / 测试结果 / 偏离或疑问 / 下一步建议）
+ 尾部围栏 JSON 块，格式见 SPEC 3.4。
写完后以 `report(collie): v045-b09` 为提交信息单独提交并推送该文件。
