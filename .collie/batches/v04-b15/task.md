---
schema_version: 1
run_id: r-20261113074121
batch_id: v04-b15
base_sha: 6b222063df3391afaa1ca42d1926cd473e796aed
created_at: 2026-11-13T07:41:22.277Z
attempt: 1
interrupted_at: null
issued_by: collie
---

# 批次 v04-b15：collie why 的结论行：规则号从降级事件推，推不出显示「规则 —」

## 你的身份与边界

你的身份、权限边界与工作协议见 `AGENT-worker.md`，全局铁律见 `CONSTRAINTS.md`，
方案来源见 `SPEC.md`。本文件只做本批次提醒。

## 本批次条目（3 个）

1. 取值（SPEC 13.20，读这一节即可；现有实现是 `src/view.ts` 的 `projectWhy` 与 `conclusionLine`）：规则号依次取 `run.finished.rule`、该运行最后一条 `verdict.downgraded.rule`，都没有显示 `规则 —`；
   原因依次取 `run.finished.reason`、同一条 `verdict.downgraded.reason`，都没有就不写；结论行不得以逗号结尾；`--json` 的 `rule` / `reason` 按同样的顺序取值
2. `test/why.test.ts` 加用例：没有 `rule` 但有规则 9 的 `verdict.downgraded` → 结论行含 `规则 9`；两者都没有 → 含 `规则 —` 且不以逗号结尾；带 `rule` 的运行输出不变；`--json` 的取值。
   这里可以手写夹具（要测的就是旧 journal 的形态，fake runner 跑不出来），事件字段只能用 SPEC 3.6 写明的
3. `test/invariants.test.ts` 加「`src/view.ts` 含 `规则 —`」

## 验收标准（可机器判定）

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| why 专项测试通过 | `npm test -- test/why.test.ts` | exit 0 |
| 缺规则号的写法进代码与测试（不看注释行） | `grep -vE "^\s*(//\|\*\|/\*)" src/view.ts \| grep -qE "规则 —" && grep -qE "规则 —" test/why.test.ts` | exit 0 |
| 测试覆盖从降级事件推出规则 9 | `grep -qE "规则 9" test/why.test.ts` | exit 0 |
| 不变量同步 | `grep -qE "规则 —" test/invariants.test.ts` | exit 0 |

## 本批次额外禁止

- 改动任何受保护路径
- 为了让测试过而删除或跳过任何测试
- 为了让验收命令通过而改注释或字面（铁律 26）
- 改动 `run.ts`、`gate.ts`、`arbiter.ts`、规则 1~10；改动 `show`、`status`、`timeline`、`watch` 的输出；让 `why` 写任何文件；新增依赖

## 汇报要求

完成后写 `.collie/batches/v04-b15/report.md`：固定四段（做了什么 / 测试结果 / 偏离或疑问 / 下一步建议）
+ 尾部围栏 JSON 块，格式见 SPEC 3.4。
写完后以 `report(collie): v04-b15` 为提交信息单独提交并推送该文件。
