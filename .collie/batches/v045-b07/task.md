---
schema_version: 1
run_id: r-20261116112632
batch_id: v045-b07
base_sha: d1644af4880713e19afe095217ad60b6377dc861
created_at: 2026-11-16T11:26:32.724Z
attempt: 1
interrupted_at: null
issued_by: collie
---

# 批次 v045-b07：变异检查：删掉规则、放行条件或受保护路径里的任意一处，测试必须变红

## 你的身份与边界

你的身份、权限边界与工作协议见 `AGENT-worker.md`，全局铁律见 `CONSTRAINTS.md`，
方案来源见 `SPEC.md`。本文件只做本批次提醒。

## 本批次条目（3 个）

1. 补测试（SPEC 15.2）：`test/evidence.test.ts` 让 `PROTECTED_PATHS` 的 9 项每一项都有一条行为用例（worker 的提交改了该路径下的文件 → `spec_diff_lines` 大于 0）；
   `test/arbiter.test.ts` 加规则 6 的两条单边用例（只有通过数不符、只有失败数不符）和规则 9「只有 CI 结论不是 success」的用例。只加测试，不改 `src/arbiter.ts`、`src/gate.ts`、`src/evidence.ts`
2. 变异检查（SPEC 15.1）：新建 `scripts/mutation.ts`，`package.json` 加脚本 `test:mutation`（不并进 `test`，不改 `.github/`）。清单按 15.1 的 44 个名字写全；在系统临时目录的副本里改，不动工作区，结束后删掉副本；
   结果只有 `caught` / `survived` / `invalid` / `timeout` / `stale` 五种，超时与编译不过都不算被发现；支持 `--list` 与 `--only`
3. 测试基础设施（SPEC 15.3）与专项测试：`vitest.config.ts` 的 `testTimeout` 与 `hookTimeout` 改为 `120_000`；`test/invariants.test.ts` 里「只有 `run.ts` 与 `evidence.ts` 访问 `.token_file`」改成只看非注释行。
   新建 `test/mutation.test.ts`：只测判定函数与清单的形状（名字不重复、不少于 44 项、每项的原文在当前文件里恰好出现一次；测试进程全过 → `survived`，编译不过 → `invalid`，超时 → `timeout`，有断言失败 → `caught`），**不在里面跑变异**。
   `test/invariants.test.ts` 加「`package.json` 有 `test:mutation`」

## 验收标准（可机器判定）

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 变异检查全部被发现 | `npm run test:mutation` | exit 0 |
| 清单不少于 44 项 | `npx tsx scripts/mutation.ts --list \| grep -c . \| grep -qE "^(4[4-9]\|[5-9][0-9]\|[1-9][0-9][0-9])$"` | exit 0 |
| 受保护清单每一项都在变异清单里 | `npx tsx scripts/mutation.ts --list \| grep -cE "^protected:" \| grep -qE "^(9\|[1-9][0-9])$"` | exit 0 |
| 原先漏过的三处规则条件现在被发现 | `npx tsx scripts/mutation.ts --only rule6-failed-count-half,rule6-passed-count-half,rule9-ci-third` | exit 0 |
| 判定函数的专项测试通过 | `npm test -- test/mutation.test.ts` | exit 0 |
| 超时放宽到 120 秒 | `grep -cE "(test\|hook)Timeout: 120_000" vitest.config.ts \| grep -qE "^2$"` | exit 0 |
| 不变量同步 | `grep -qE "test:mutation" test/invariants.test.ts` | exit 0 |

## 本批次额外禁止

- 改动任何受保护路径；改动 `.github/` 下任何文件
- 改动 `src/arbiter.ts`、`src/gate.ts`、`src/evidence.ts`（本批次只加测试与检查脚本）
- 为了让测试过而删除或跳过任何测试；为了让变异检查通过而从清单里去掉某一项、或把超时与编译不过算成被发现
- 为了让验收命令通过而改注释或字面（铁律 26）
- 把变异检查并进 `npm test`；让它改动工作区里的文件；新增依赖

## 汇报要求

完成后写 `.collie/batches/v045-b07/report.md`：固定四段（做了什么 / 测试结果 / 偏离或疑问 / 下一步建议）
+ 尾部围栏 JSON 块，格式见 SPEC 3.4。
写完后以 `report(collie): v045-b07` 为提交信息单独提交并推送该文件。
