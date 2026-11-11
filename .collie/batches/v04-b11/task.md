---
schema_version: 1
run_id: r-20261111115621
batch_id: v04-b11
base_sha: 9f6d593eb3c65a9ad5e43192712e82647ca94070
created_at: 2026-11-11T11:56:22.459Z
attempt: 1
interrupted_at: null
issued_by: collie
---

# 批次 v04-b11：R2 的后台 git 读取不抢索引锁

## 你的身份与边界

你的身份、权限边界与工作协议见 `AGENT-worker.md`，全局铁律见 `CONSTRAINTS.md`，
方案来源见 `SPEC.md`。本文件只做本批次提醒。

## 本批次条目（3 个）

1. `src/git.ts` 的 `git()`（SPEC 13.15，读这一节即可）：拉起 git 子进程时环境带 `GIT_OPTIONAL_LOCKS=0`，其余环境变量照常继承；不改任何调用方，不改取指纹的算法
2. `test/git.test.ts` 加用例：通过 `git()` 执行一个打印该环境变量的别名（`-c alias.optlocks='!printenv GIT_OPTIONAL_LOCKS' optlocks`），断言输出是 `0`；
   再断言进程环境里已有的变量（例如测试夹具设的 `GIT_CONFIG_GLOBAL`）在子进程里仍然可见
3. `test/invariants.test.ts` 加「`src/git.ts` 含 `GIT_OPTIONAL_LOCKS`」「`src/` 下除 `src/git.ts` 外没有第二处直接 `spawn('git'`」

## 验收标准（可机器判定）

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 环境变量进代码（不看注释行） | `grep -vE "^\s*(//\|\*\|/\*)" src/git.ts \| grep -qE "GIT_OPTIONAL_LOCKS"` | exit 0 |
| 有测试断言子进程拿到它 | `grep -qE "GIT_OPTIONAL_LOCKS" test/git.test.ts && npm test -- test/git.test.ts` | exit 0 |
| 不变量同步 | `grep -qE "GIT_OPTIONAL_LOCKS" test/invariants.test.ts` | exit 0 |

## 本批次额外禁止

- 改动任何受保护路径
- 为了让测试过而删除或跳过任何测试
- 为了让验收命令通过而改注释或字面（铁律 26）
- 改动活性检测的判定、阈值与取指纹的算法；改动规则 1~10；新增依赖

## 汇报要求

完成后写 `.collie/batches/v04-b11/report.md`：固定四段（做了什么 / 测试结果 / 偏离或疑问 / 下一步建议）
+ 尾部围栏 JSON 块，格式见 SPEC 3.4。
写完后以 `report(collie): v04-b11` 为提交信息单独提交并推送该文件。
