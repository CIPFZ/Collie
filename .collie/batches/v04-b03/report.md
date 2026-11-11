# 批次 v04-b03 汇报

## 做了什么

**条目 1：`src/view.ts` 加 `projectTimeline`**

在 `src/view.ts` 中新增了 `projectTimeline` 函数，它从所有运行的事件中提取时间节点并按时间升序排列。支持六种节点类型：
- `batch_start`：每个批次首次出现 `run.started` 时记录一次（去重）
- `run_end`：每次 `run.finished` 事件，携带 verdict、attempt、duration 和 cost
- `batch_status`：批次状态变更事件
- `queue_start`：队列运行开始
- `queue_paused`：队列暂停
- `queue_end`：队列结束

同时新增了 `projectVersionSummary` 函数用于 `--by version` 模式，按版本前缀（如 `v03`）汇总首次开始时间、最后结束时间、批次数、运行数、FIX/BLOCK 次数、总花费，以及没有花费数据的运行数。

新增了 `formatTimeline` 和 `formatVersionSummary` 格式化函数，输出末尾固定一行 `ADR approvals and releases are in \`git log\`.`。

**条目 2：CLI 命令 `collie timeline`**

在 `src/cli.ts` 中接入 `timeline` 命令，支持：
- `--since <日期>`：过滤只显示该日期之后的节点
- `--batch <前缀>`：过滤 batchId 以指定前缀开头的节点
- `--by version`：按版本前缀汇总输出
- `--json`：输出合法 JSON

无 journal 时输出 `no runs recorded`（`--json` 下输出 `{"message":"no runs recorded"}`），退出码 0。

**条目 3：测试**

在 `test/timeline.test.ts` 中编写了 11 个测试用例，覆盖：
- 空目录返回空数组
- 节点按时间升序排列
- `--since` 日期过滤
- `--batch` 前缀过滤
- 按版本汇总（多版本、多批次、多运行）
- 缺花费数据标注
- 队列事件节点（batch_status、queue_start/paused/end）
- batch_start 去重
- formatTimeline 固定尾行
- formatVersionSummary 固定尾行
- run_end 节点携带 cost 和 duration

在 `test/invariants.test.ts` 中加入 `src/cli.ts` 包含 `timeline` 命令的不变量测试。

## 测试结果

```
npm run lint → exit 0（All matched files use Prettier code style!）
npm run typecheck → exit 0
npm test → 42 files, 858 passed, 0 failed
npm test -- test/timeline.test.ts → 1 file, 11 passed, 0 failed
```

全部 9 项验收标准均已逐一确认通过。

## 偏离或疑问

无。

## 下一步建议

条目全部完成，可进入审核。下一个批次是 v04-b04（`collie why`）。

```json
{
  "schema_version": 1,
  "batch_id": "v04-b03",
  "head_sha": "89e557c79448e5bd87e980b1d17955456897a626",
  "claims": {
    "commits": ["89e557c79448e5bd87e980b1d17955456897a626"],
    "tests_passed": 858,
    "tests_failed": 0,
    "pushed": true,
    "new_deps": [],
    "spec_touched": false
  },
  "open_questions": []
}
```
