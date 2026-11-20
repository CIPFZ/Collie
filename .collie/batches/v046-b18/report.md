# 批次 v046-b18 汇报

## 做了什么

**条目 1：worker 任务书在带情形批次中多出「本批次情形」与「本批次接口」两节**

在 `src/roles/worker.ts` 中：
- 新增 `scenarioKindLabel` 辅助函数，将 `'new'`/`'keep'` 映射为中文 `'新'`/`'保持'`。
- 新增 `renderScenarioSections(batch)` 函数：当 `batch.scenarios` 存在且非空时，渲染「本批次情形」节（每条格式为 `- <id> [新|保持] <text>`，与给测试 agent 的逐字相同）和可选的「本批次接口」节（仅在 `batch.interfaces` 非空时出现）。
- 修改 `renderBody`：在「本批次条目」和「验收标准」之间插入上述 sections；带情形时在验收标准末尾追加一句「`test/acceptance/<批次>/` 下是本批次的验收测试，由测试 agent 写好，你不能改（受保护路径）」。
- 不带情形的批次，`renderBody` 输出与修改前逐字节相同（`renderScenarioSections` 返回空数组，`acceptanceNote` 为空字符串）。
- 新增 `Scenario` 类型的 import。

**条目 2：测试覆盖**

在 `test/task-envelope.test.ts` 的 body 组里新增两个用例：
1. `renders 本批次情形 and 本批次接口 when batch has scenarios (SPEC 16.16)`：构造一个带 2 个情形（S1 新、S2 保持）和 1 个接口的批次，验证：section 顺序包含「本批次情形」和「本批次接口」；情形行格式正确；接口行存在；验收测试保护提示存在。
2. `without scenarios, task body is byte-for-byte identical to the no-scenarios output (SPEC 16.16)`：使用不带情形的 v01-b01 批次，验证不出现情形/接口节和保护提示，headings 与原有的 `has the SPEC 3.3 section order` 用例一致。

现有的 `has the SPEC 3.3 section order` 用例使用不带情形的 v01-b01 批次，断言列表不变，未做任何改动。所有现有断言原封不动。

## 测试结果

```
npm run lint     -> exit 0 (All matched files use Prettier code style!)
npm run typecheck -> exit 0
npm test         -> exit 0 (67 test files, 1402 tests passed)
npm test -- test/task-envelope.test.ts test/worker.test.ts -> exit 0 (200 tests passed)
grep -qE "本批次情形" src/roles/worker.ts && grep -qE "本批次接口" src/roles/worker.ts -> exit 0
```

## 偏离或疑问

无

## 下一步建议

v046-b19 可继续签发（`why` 与 `report` 显示测试 agent 花费）。

```json
{
  "schema_version": 1,
  "batch_id": "v046-b18",
  "head_sha": "d6571e1bcbd945bc680f130d5ed8820d6d3b5785",
  "claims": {
    "commits": ["d6571e1bcbd945bc680f130d5ed8820d6d3b5785"],
    "tests_passed": 1402,
    "tests_failed": 0,
    "pushed": true,
    "new_deps": [],
    "spec_touched": false
  },
  "open_questions": []
}
```
