# 批次 v046-b06 汇报

## 做了什么

**条目 1：情形与接口列表允许空行。**
- `src/backlog.ts` 的 `parseScenarios` 函数：在遍历循环中加了 `if (text === '') continue;`，空行被跳过而非终止列表。空行之后如果出现不符合情形格式的无序列表项（bullet），仍然报错并带该行的行号。
- `skipScenarioList` 同步修改：也跳过空行和 bad bullet（因为 `parseScenarios` 已经先执行并抛出了错误，`skipScenarioList` 只在不抛时才被用到，但保持一致）。
- 新增 `parseListWithBlanks` 函数：与 `parseList` 类似但跳过空行。仅用于接口（`接口：`）一节的解析。条目（`条目：`）和额外禁止（`额外禁止：`）两节的列表解析保持不变，仍然使用 `parseList`（遇空行即止）。

**条目 2：测试 agent 提示词两处小修。**
- `src/roles/tester.ts` 的 `buildTesterPrompt`：
  - 小标题从 `需要自行阅读的 SPEC 章节` 改为 `可查阅的文件`。
  - 标题下方新增一句 `情形里点名了小节号的，只读那一节；不要通读`。
  - 输出一节新增一句 `汇报末尾 JSON 块里的 \`batch_id\` 填 \`<batch_id>\`。`，其中 `<batch_id>` 是实际传入的批次号。

**条目 3：测试。**
- `test/backlog.test.ts` 新增 `describe('backlog: blank lines inside scenario and interface lists', …)` 包含 4 个用例：
  1. 三条情形、每两条之间空一行：解析出 3 条，编号、类别、文字都对
  2. 两条情形之后空一行再跟一条 `- 这不是情形`：报错，行号是这一行
  3. 接口一节两条之间空一行：解析出 2 条
  4. 情形之后空一行再是接口标签：两节都解析对
- `test/tester.test.ts` 新增 `describe('tester: prompt wording (v046-b06)', …)` 包含 4 个用例：
  1. 新小标题 `可查阅的文件` 在
  2. `不要通读` 那句话在
  3. 旧小标题 `需要自行阅读的 SPEC 章节` 不在
  4. `batch_id` 那一句里有批次号

## 测试结果

```
npm run lint       → exit 0
npm run typecheck  → exit 0
npm test           → 62 test files, 1281 tests passed, 0 failed
npm test -- test/backlog.test.ts test/backlog-reject.test.ts test/tester.test.ts
                   → 3 test files, 78 tests passed, 0 failed
```

验收命令逐条通过：
- `grep -qF "backlog: blank lines..." && grep -qF "tester: prompt wording..."` → exit 0
- `! grep -vE "^\s*(//|\\*|/\\*)" src/roles/tester.ts | grep -qF "需要自行阅读的 SPEC 章节"` → exit 0

## 偏离或疑问

无

## 下一步建议

v046-b07（配置、事件与受保护路径）和 v046-b08（`src/acceptance.ts` 模块）可以继续推进。

```json
{
  "schema_version": 1,
  "batch_id": "v046-b06",
  "head_sha": "32044c9dac106fc605bd7d1600d31885c681c900",
  "claims": {
    "commits": ["32044c9dac106fc605bd7d1600d31885c681c900"],
    "tests_passed": 1281,
    "tests_failed": 0,
    "pushed": true,
    "new_deps": [],
    "spec_touched": false
  },
  "open_questions": []
}
```
