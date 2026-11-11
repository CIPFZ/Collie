---
schema_version: 1
run_id: r-20261111054230
batch_id: v04-b03
base_sha: 3adc5be87bba0dfff2575f928667130bc24dbf65
created_at: 2026-11-11T05:42:31.222Z
attempt: 1
interrupted_at: null
issued_by: collie
---

# 批次 v04-b03：collie timeline：时间轨迹与按版本汇总

## 你的身份与边界

你的身份、权限边界与工作协议见 `AGENT-worker.md`，全局铁律见 `CONSTRAINTS.md`，
方案来源见 `SPEC.md`。本文件只做本批次提醒。

## 本批次条目（3 个）

1. `src/view.ts` 加 `projectTimeline`：按时间升序输出节点（批次首次开始、每次运行结束、`batch.status` 变化、队列开始 / 停表 / 结束）
2. `collie timeline [--since <日期>] [--batch <前缀>] [--by version] [--json]`；`--by version` 按版本前缀汇总，没有花费数据的运行不计入并注明个数；
   输出末尾固定一行说明 ADR 与发布去 `git log` 看
3. `test/timeline.test.ts`：覆盖节点顺序、`--since` 与 `--batch` 过滤、按版本汇总、缺花费数据、空目录；`test/invariants.test.ts` 加「`src/cli.ts` 含 `timeline` 命令」

## 验收标准（可机器判定）

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| timeline 专项测试通过 | `npm test -- test/timeline.test.ts` | exit 0 |
| 专项测试不少于 6 个 | `grep -cE "^\s+it\(" test/timeline.test.ts \| grep -qE "^([6-9]\|[1-9][0-9])$"` | exit 0 |
| timeline 命令已接线 | `npx tsx src/cli.ts timeline` | exit 0 |
| 按版本汇总可用 | `npx tsx src/cli.ts timeline --by version` | exit 0 |
| timeline --json 输出合法 JSON | `npx tsx src/cli.ts timeline --json \| node -e "JSON.parse(require('fs').readFileSync(0,'utf8'))"` | exit 0 |
| 不变量同步 | `grep -qE "timeline" test/invariants.test.ts` | exit 0 |

## 本批次额外禁止

- 改动任何受保护路径
- 为了让测试过而删除或跳过任何测试
- 为了让验收命令通过而改注释或字面（铁律 26）
- 改动 `run.ts`、`gate.ts`、`arbiter.ts`、规则 1~10；绕过 `src/view.ts` 直接读 journal；让 `timeline` 写任何文件；新增依赖

## 汇报要求

完成后写 `.collie/batches/v04-b03/report.md`：固定四段（做了什么 / 测试结果 / 偏离或疑问 / 下一步建议）
+ 尾部围栏 JSON 块，格式见 SPEC 3.4。
写完后以 `report(collie): v04-b03` 为提交信息单独提交并推送该文件。
