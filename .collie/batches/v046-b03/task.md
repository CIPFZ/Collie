---
schema_version: 1
run_id: r-20261117125240
batch_id: v046-b03
base_sha: 1e0d70c0498fe90394d5a7f010145bdda98c90f5
created_at: 2026-11-17T12:52:41.110Z
attempt: 1
interrupted_at: null
issued_by: collie
---

# 批次 v046-b03：红检查：验收测试在没有实现时，新行为的全部失败、要保持的全部通过（不接进队列）

## 你的身份与边界

你的身份、权限边界与工作协议见 `AGENT-worker.md`，全局铁律见 `CONSTRAINTS.md`，
方案来源见 `SPEC.md`。本文件只做本批次提醒。

## 本批次条目（3 个）

1. 新文件 `src/redcheck.ts`，导出 `judgeRedCheck(reports)`：输入是 `new.test.ts` 与 `keep.test.ts`（可以没有）各自的 vitest JSON 报告，输出 `{ ok, problems }`；
   `problems` 是原因清单，每条点名是哪个文件、哪条用例、为什么。判据：
   `new`：至少执行了一条用例，且每一条都失败；有通过的、跳过的、todo 的，或者文件加载不了（报告里一条用例都没有），都不过。
   `keep`：可以没有这个文件；有的话至少执行了一条且全部通过。
   它是纯函数：不起子进程、不读写文件。
2. 同一文件导出 `runRedCheck(tree, outDir, opts)`：在目录 `tree` 里对 `<outDir>/new.test.ts` 与（存在时）`<outDir>/keep.test.ts` 各跑一次 vitest，
   JSON 报告用 `--outputFile` 写到 `tree` 之外的系统临时目录（目录名以 `collie-redcheck-` 开头）、读完删掉（不带 `--outputFile` 时 vitest 会在当前目录建 `.vitest/`，SPEC 15.5）；
   `new.test.ts` 不存在算不过；超时算不过并写明是超时。超时的毫秒数与起子进程的函数都由调用方经 `opts` 传入，不在 `src/` 里写死数字。
   返回 `judgeRedCheck` 的结果，外加两个文件各执行了几条用例。
   **在一个临时目录里放真实的测试文件、用真实的 vitest 跑：`new` 里两条都失败 → 过；`new` 里一条失败一条通过 → 不过，原因里点名通过的那一条；**
   **`new` 一导入就报错 → 不过，原因写明文件加载失败；`new` 全失败而 `keep` 里有一条失败 → 不过，原因里点名那一条**
3. 新文件 `test/redcheck.test.ts`：`judgeRedCheck` 的每条判据各一条用例，喂报告样例（含跳过、todo、没有 `keep`、`keep` 一条用例都没有）；
   条目 2 加粗的四种情形各一条，必须用真实的 vitest 跑临时目录里的真实文件（临时目录建在系统临时目录下、名字以 `collie-redcheck-` 开头，把仓库的 `node_modules` 链进去，用完删掉；
   跑完系统临时目录里不留下任何 `collie-redcheck-*`，仓库里不出现 `.vitest/`）；超时一条，用注入的假子进程。
   `test/invariants.test.ts` 加「`src/redcheck.ts` 用了 `--outputFile`」

## 验收标准（可机器判定）

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 红检查的专项测试通过，仓库里没有留下报告 | `npm test -- test/redcheck.test.ts && ! test -e .vitest` | exit 0 |
| 专项测试不少于 12 个 | `grep -cE "^\s+it(\.each)?\(" test/redcheck.test.ts \| grep -qE "^(1[2-9]\|[2-9][0-9])$"` | exit 0 |
| 两个函数都导出了 | `grep -qE "export function judgeRedCheck" src/redcheck.ts && grep -qE "export (async )?function runRedCheck" src/redcheck.ts` | exit 0 |
| 专项测试不在系统临时目录留下东西 | `d=$(mktemp -d) && TMPDIR=$d npm test -- test/redcheck.test.ts && ! ls -d "$d"/collie-redcheck-* >/dev/null 2>&1` | exit 0 |
| 不变量同步 | `grep -qE "redcheck" test/invariants.test.ts` | exit 0 |

## 本批次额外禁止

- 改动任何受保护路径；改动 `.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`
- 改动 `src/run.ts`、`src/roles/`、`src/runner/`、`src/arbiter.ts`、`src/gate.ts`、`src/evidence.ts`、`src/view.ts`、`src/follow.ts`；把红检查接进队列或加命令行子命令
- 为了让测试过而删除或跳过任何测试；改写任何已有断言
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求（本批次的测试可以起真实的 vitest 子进程，别的不行）；新增依赖

## 汇报要求

完成后写 `.collie/batches/v046-b03/report.md`：固定四段（做了什么 / 测试结果 / 偏离或疑问 / 下一步建议）
+ 尾部围栏 JSON 块，格式见 SPEC 3.4。
写完后以 `report(collie): v046-b03` 为提交信息单独提交并推送该文件。
