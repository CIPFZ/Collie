---
schema_version: 1
run_id: r-20261113062615
batch_id: v04-b12
base_sha: 8bcdc0ad48a83687a0d827caca9d97a9482d8974
created_at: 2026-11-13T06:26:16.123Z
attempt: 1
interrupted_at: null
issued_by: collie
---

# 批次 v04-b12：活性场景测试的假时钟：冻结前不走，加慢开局用例（只改测试）

## 你的身份与边界

你的身份、权限边界与工作协议见 `AGENT-worker.md`，全局铁律见 `CONSTRAINTS.md`，
方案来源见 `SPEC.md`。本文件只做本批次提醒。

## 本批次条目（3 个）

1. 假时钟（SPEC 13.19，读这一节即可）：`test/scenario-g.test.ts` 与 `test/scenario-n.test.ts` 的假时钟改为「指纹冻结之前 `now()` 的返回值不变；冻结之后由注入的 `setTimer` 每次按传入的间隔推进」，
   删掉每调用一次 `now()` 就自增的写法。两个文件共用的辅助函数可以抽到 `test/support/` 下
2. 场景 G 加一个慢开局的用例：fake worker 在冻结指纹之前用 `setImmediate` 让出事件循环 40 万次，断言 journal 里有 `worker.idling`、没有 `worker.stalled`。
   R1 实测：这个用例在旧时钟下必然失败（假时钟走到 300012 毫秒），在新时钟下恰好在 1000 毫秒判空转
3. `test/invariants.test.ts` 加「`test/scenario-g.test.ts` 与 `test/scenario-n.test.ts` 不含 `+= stepMs`」

## 验收标准（可机器判定）

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 两个场景连跑三遍都通过 | `for i in 1 2 3; do npm test -- test/scenario-g.test.ts test/scenario-n.test.ts \|\| exit 1; done` | exit 0 |
| 自增时钟已删掉 | `! grep -qE "\+= stepMs" test/scenario-g.test.ts test/scenario-n.test.ts` | exit 0 |
| 慢开局用例断言没有判成卡死 | `grep -qE "worker\.stalled" test/scenario-g.test.ts` | exit 0 |
| 不变量同步 | `grep -qE "stepMs" test/invariants.test.ts` | exit 0 |

## 本批次额外禁止

- 改动任何受保护路径
- 改动 `src/` 下任何文件（活性检测本身没有问题）
- 为了让测试过而删除或跳过任何测试
- 为了让验收命令通过而改注释或字面（铁律 26）；新增依赖

## 汇报要求

完成后写 `.collie/batches/v04-b12/report.md`：固定四段（做了什么 / 测试结果 / 偏离或疑问 / 下一步建议）
+ 尾部围栏 JSON 块，格式见 SPEC 3.4。
写完后以 `report(collie): v04-b12` 为提交信息单独提交并推送该文件。
