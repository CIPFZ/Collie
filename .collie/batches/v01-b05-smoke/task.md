---
schema_version: 1
run_id: r-20261020-060511
batch_id: v01-b05-smoke
base_sha: 54fa8decbee73d1f76ad336d53120fd39c4cf0e4
created_at: 2026-10-20T06:05:11.449Z
attempt: 1
interrupted_at: null
---

# 批次 v01-b05-smoke：烟雾批次：README 改一行

## 你的身份与边界

你的身份、权限边界与工作协议见 `AGENT-worker.md`，全局铁律见 `CONSTRAINTS.md`，
方案来源见 `SPEC.md`。本文件只做本批次提醒。

## 本批次条目（1 个）

1. 在 `README.md` 末尾追加一行：`Collie 用 Collie 跑过的第一个批次：v01-b05-smoke`

## 验收标准（可机器判定）

| 说明 | 命令 | 期望 |
|---|---|---|
| 全部测试通过 | `npm test` | exit 0 |
| README 已追加该行 | `grep -q "第一个批次：v01-b05-smoke" README.md` | exit 0 |
| 只改了 README | `test "$(git diff --name-only HEAD~1 HEAD)" = "README.md"` | exit 0 |

## 本批次额外禁止

- 改动 README 以外的任何文件

## 汇报要求

完成后写 `.collie/batches/v01-b05-smoke/report.md`：固定四段（做了什么 / 测试结果 / 偏离或疑问 / 下一步建议）
+ 尾部围栏 JSON 块，格式见 SPEC 3.4。
写完后以 `report(collie): v01-b05-smoke` 为提交信息单独提交并推送该文件。
