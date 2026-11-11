---
schema_version: 1
run_id: r-20261111055746
batch_id: v04-b04
base_sha: 3b8511df86dd16e5818bf82cde02d4a866d03edb
created_at: 2026-11-11T05:57:47.041Z
attempt: 1
interrupted_at: null
issued_by: collie
---

# 批次 v04-b04：collie why：按 attempt 摊开证据链

## 你的身份与边界

你的身份、权限边界与工作协议见 `AGENT-worker.md`，全局铁律见 `CONSTRAINTS.md`，
方案来源见 `SPEC.md`。本文件只做本批次提醒。

## 本批次条目（3 个）

1. `src/view.ts` 加 `projectWhy`：按 attempt 汇集一个批次每次运行的证据链，顺序按 13.4；13.1 的字段缺失时该行显示 `—`，不报错
2. `collie why <batch_id> [--attempt <n>] [--json]`：每个 attempt 末尾一行结论，由规则号对应的固定模板加 `reason` 生成，不调用模型、不读信封文件；
   退出码 0 有数据 / 1 批次不在 backlog / 2 批次在 backlog 但本机没有 journal
3. `test/why.test.ts`：覆盖 PASS、规则 8 的 FIX、规则 2 的 BLOCK、规则 1 的格式错、无 report 的上报、被中断后恢复、三个退出码；
   `test/invariants.test.ts` 加「`src/cli.ts` 含 `why` 命令」

## 验收标准（可机器判定）

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| why 专项测试通过 | `npm test -- test/why.test.ts` | exit 0 |
| 专项测试不少于 8 个 | `grep -cE "^\s+it\(" test/why.test.ts \| grep -qE "^([8-9]\|[1-9][0-9])$"` | exit 0 |
| why 已接线，已知批次不报错、未知批次报错 | `npx tsx src/cli.ts why v03-b04-fix; test $? -ne 1 && ! npx tsx src/cli.ts why no-such-batch` | exit 0 |
| 不变量同步 | `grep -qE "why" test/invariants.test.ts` | exit 0 |

## 本批次额外禁止

- 改动任何受保护路径
- 为了让测试过而删除或跳过任何测试
- 为了让验收命令通过而改注释或字面（铁律 26）
- 改动 `run.ts`、`gate.ts`、`arbiter.ts`、规则 1~10；改动 `show` 的输出；让 `why` 写任何文件；新增依赖

## 汇报要求

完成后写 `.collie/batches/v04-b04/report.md`：固定四段（做了什么 / 测试结果 / 偏离或疑问 / 下一步建议）
+ 尾部围栏 JSON 块，格式见 SPEC 3.4。
写完后以 `report(collie): v04-b04` 为提交信息单独提交并推送该文件。
