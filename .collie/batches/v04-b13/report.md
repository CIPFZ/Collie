# 批次 v04-b13 汇报

## 做了什么

### 条目 1：sha 校验分三步报

将 `src/run.ts` 中 report head_sha 的校验逻辑从单一的「不是后代或不是祖先」改为三步：

1. **解析阶段**：先用 `revParse` 验证 `head_sha` 和每一个 `claims.commits[i]`，解析不了立即上报 `does not resolve to a commit`。
2. **后代检查**：解析通过后检查是否是 `base_sha` 的后代，不是则报 `is not a descendant of base_sha`。
3. **祖先检查**：是后代但不是当前 HEAD 的祖先，则报 `is not an ancestor of HEAD`。

关键变更：移除了 `isAncestor(...).catch(() => false)` 模式。`isAncestor` 函数本身已经正确处理退出码 0/1（祖先/非祖先），非 0/1 退出码会 throw。原来的 `.catch(() => false)` 把 git 命令本身的错误（如 `Not a valid commit name`）也当成了「不是祖先」。现在 catch 块正确传递 git 的报错原文（截断至 300 字）。

### 条目 2：BLOCK 后的重跑说清原因

在 `batchHistory` 中新增逻辑，区分「信号阶梯掐掉的 BLOCK」和「其他原因的 BLOCK」：

- 当上一轮 `run.finished.verdict === 'BLOCK'` 且 `worker_stop_reason` 不在 `{idling, stalled, wallclock}` 时：
  - `interrupted_at` 的结束原因改为 `escalated`（有 escalated 事件时）或 `blocked`
  - 新增 `blockConclusion` 字段，传递到 `TaskContext` 和 `renderInterruptSection`
  - 任务正文的「上一轮中断」一节加上「上一轮结论：」行写原因原文
  - 不写「请从 `git log` 核实」，改写「上一轮的提交仍在审核范围内，按上面的结论只补缺口」

信号阶梯掐掉的中断写法不变（保留救援提交/git log 回退）。

涉及文件：`src/run.ts`（`BatchHistory` 接口 + `batchHistory` 函数 + `buildTask` 调用）、`src/roles/worker.ts`（`TaskContext` 接口 + `renderInterruptSection`）。

### 条目 3：单批次 run_id 去掉连字符

`src/cli.ts` 的 `runIdAt` 从 `r-YYYYMMDD-HHMMSS` 改为 `r-YYYYMMDDHHMMSS`（与队列模式的 `makeRunId` 一致）。更新了 `test/cli.test.ts` 中的 3 处字面量。

### 测试

新建 `test/report-sha.test.ts`（7 个用例）：
- 不存在的 40 位 head_sha → exit 20 + `does not resolve to a commit`
- 不存在的 commits[i] → exit 20 + `commits[` + `does not resolve`
- head_sha 存在但不是 base 的后代 → `is not a descendant`
- BLOCK 重跑 → task 含 `上一轮结论：` 和原因原文，不含 `请从`
- BLOCK 重跑 → `interrupted_at` 含 `escalated`
- 信号阶梯掐掉 → 不含 `上一轮结论`（对照组）
- `runIdAt` 格式检查

`test/invariants.test.ts` 新增 `does not resolve to a commit` 不变量。

更新 `test/scenario-e.test.ts` 两处断言以匹配 SPEC 13.17 新行为（BLOCK 重跑不再显示救援提交/git log 提示，改为显示结论）。

## 测试结果

```
npm run lint    → exit 0
npm run typecheck → exit 0
npm test        → 49 passed, 946 tests passed, 0 failed
npm test -- test/report-sha.test.ts → 1 passed, 7 tests passed

所有 10 条验收命令均通过。
```

## 偏离或疑问

无

## 下一步建议

- v04-b14（裁定提交的 CI 补查）和 v04-b15（`why` 的结论行）可继续推进
- v04-b16（sha 解析不了改判 FIX）依赖本批次的三步校验逻辑，现在基础已就位

```json
{
  "schema_version": 1,
  "batch_id": "v04-b13",
  "head_sha": "28916e4564a2e985faaea1c3ced4f73deb9ce472",
  "claims": {
    "commits": [
      "2e5ab8947245ab7a9b9586d61b42a49794fbcab3",
      "28916e4564a2e985faaea1c3ced4f73deb9ce472"
    ],
    "tests_passed": 946,
    "tests_failed": 0,
    "pushed": true,
    "new_deps": [],
    "spec_touched": false
  },
  "open_questions": []
}
```
