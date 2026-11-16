# 批次 v045-b02 汇报

## 做了什么

逐条对应 task.md 的三个条目：

1. **`src/view.ts` 加 `projectReport` 与 `formatReport`**：新增约 300 行代码。`projectReport` 是纯函数，接受 `allRunData`（所有运行数据）、`queueEvents`（队列事件）和 `queueRunId`，返回 `ReportProjection` 结构体，包含七个章节所需的全部数据。取值口径复用 `computeAttempt`（attempt）、`asNumber`/`asString`（各字段提取）、cost 计算与 `why`/`timeline` 一致（SPEC 13.13、13.23）。`formatReport` 接受投影数据及三块外部文本（why 文本、show-queue 文本、队列剩余文本），输出完整 Markdown。preflight 为 null 时（旧 journal）§2 写 `—`。退出码映射来自 SPEC 14.2 的对照表。

2. **`collie report [--queue <q_run_id>] [--json]`**：在 `cli.ts` 加了 `report` 函数和 Commander 命令。缺省取最近的 `q-` 开头运行；找不到队列运行时 stderr 输出提示、exit 2。`--json` 直接输出 `projectReport` 的 JSON 结构。Markdown 模式下，§5 复用 `projectWhy`/`formatWhy`，§6 复用 `describeEvent`（与 `show --queue` 一致），§7 复用 backlog 解析读 pending/blocked 批次号。不写任何文件。新增 `REPORT_EXIT` 常量（0/2）。

3. **`test/report.test.ts` + 不变量**：15 个 `it()` 测试，分三组：
   - 两个批次连续 PASS（6 个测试）：七标题顺序、表行数与 attempt/verdict、打扰数、preflight 有检查项、每个批次有 why、总花费对
   - 先 FIX 后 PASS 同一队列运行（5 个测试）：fix_retry 后 PASS，表两行（FIX attempt 1 + PASS attempt 2）、打扰 0、per-batch 含两个 attempt、各行花费对
   - 边缘情况（4 个测试）：无队列 exit 2、指定不存在 exit 2、--json 合法 JSON、旧 journal（无 queue.preflight）§2 写 `—`

   `test/invariants.test.ts` 加了 `projectReport` 存在性检查。

## 测试结果

```
npm run lint → exit 0
npm run typecheck → exit 0
npm test → 53 passed, 1018 tests, 0 failed
npm test -- test/report.test.ts → 1 passed, 15 tests, 0 failed
```

全部 10 条验收命令本地验证通过。

## 偏离或疑问

无

## 下一步建议

- v045-b03（通知与交接协议）和 v045-b04（`collie follow`）可继续执行。
- 待 `collie follow` 完成后，可在第七次队列中测试 `report` 生成的汇报是否足够 R1 做裁定。

```json
{
  "schema_version": 1,
  "batch_id": "v045-b02",
  "head_sha": "5146e815d7cd34881dcc968f2c73edc3f6b673af",
  "claims": {
    "commits": [
      "1b2eb9b093b614f97eddf90228ccf95124e7420a",
      "5146e815d7cd34881dcc968f2c73edc3f6b673af"
    ],
    "tests_passed": 1018,
    "tests_failed": 0,
    "pushed": true,
    "new_deps": [],
    "spec_touched": false
  },
  "open_questions": []
}
```
