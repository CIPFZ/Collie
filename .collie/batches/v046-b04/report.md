# 批次 v046-b04 汇报

## 做了什么

**条目 1：backlog 解析情形与接口**
- `src/schema/index.ts`：新增 `ScenarioKindSchema`（`new` | `keep`）、`ScenarioSchema`（`id`、`kind`、`text`），`BatchSchema` 新增两个可选字段 `scenarios` 和 `interfaces`。没有 bump `SCHEMA_VERSION`（新增可选字段不升版本，铁律 14）。
- `src/backlog.ts`：新增 `LABEL_SCENARIOS` 和 `LABEL_INTERFACES` 标签正则（全角/半角冒号都接受），新增 `SCENARIO_LINE` 正则（`- <大写字母+数字> [新|保持] <文字>`）。`SectionContent` 接口增加 `scenarios` 和 `interfaces`。`parseSection` 新增两个分支处理情形和接口标签。新增 `parseScenarios` 函数，负责：解析每行场景、续行合并（与条目规则相同）、拒绝编号重复/格式不对/空列表/无 `[新]`/同一节出现两次。新增 `skipScenarioList` 辅助。batch 构造时用 `Record<string, unknown>` 避免 strictObject 拒绝可选键——只在有对应小节时才设置 `scenarios`/`interfaces` 键。
- `src/cli.ts`：`show` 函数在验收命令之后、task.md 之前，当 batch 有 scenarios 时打印情形（编号、类别、文字），当有 interfaces 时打印接口。

**条目 2：测试 agent 只拿情形**
- `src/roles/tester.ts`：`TesterInputSchema` 去掉 `items`，换成 `scenarios`（`z.array(ScenarioSchema).nonempty()`）和 `interfaces`（`z.array(z.string())`），共五个字段。`validInput` 新增校验至少一条 `new` 场景。`buildTesterPrompt` 重写：
  - 「情形」一节分「新行为」「必须保持」两组列出，编号与文字一字不改。
  - 「接口」一节逐条列出，空时写「（未指定）」。
  - 通篇不出现「条目」二字。
  - 输出：`new.test.ts` 和 `MAP.md` 总是列出；`keep.test.ts` 和它的自检命令只在有 `keep` 情形时出现；自检命令末尾加 `npm run lint` 和 `npm run typecheck`。

**条目 3：测试**
- `test/backlog.test.ts`：新加 `describe('backlog: scenarios and interfaces', …)` 组，含 5 条用例：解析 2 新 1 保持、接口数组、续行合并、全角冒号、不带场景的批次无多余键。
- `test/backlog-reject.test.ts`：新加 `describe('backlog: rejects malformed scenarios', …)` 组，含 6 条拒绝用例：编号重复、类别错误、格式不对、零场景、无 `[新]`、重复情形节。每条都断言行号。
- `test/cli.test.ts`：新加 `show prints scenarios and interfaces when the batch has them`，写入带场景的 backlog 后调 `show`，断言输出包含编号、类别、文字和接口。
- `test/tester.test.ts`：新加 `describe('tester: scenarios in the prompt', …)` 组，含 5 条用例：只有新时不含 `keep.test.ts`、有保持时含 `keep.test.ts` 和自检命令、新行为在保持前、接口为空时显示（未指定）、自检命令含 lint 和 typecheck。
  改写了 4 处现有用例（见偏离或疑问）。
- `test/invariants.test.ts`：新加 `src/roles/tester.ts non-comment lines do not contain items`。

## 测试结果

```
npm run lint      → exit 0
npm run typecheck → exit 0
npm test          → 62 test files, 1259 tests passed, 0 failed
```

专项验收全部通过：
- `npm test -- test/backlog.test.ts test/backlog-reject.test.ts test/cli.test.ts test/tester.test.ts` → exit 0
- 两组新用例 grep → exit 0
- show 和提示词新用例 grep → exit 0
- tester.ts 非注释行无 `items` → exit 0
- invariants 同步 grep → exit 0

## 偏离或疑问

task 点名允许改写的四处现有断言，逐条列出：

1. **`validInput` 夹具函数**：原来返回 `{ batch_id, items: [...], spec_paths, out_dir }`（4 个字段）。现在返回 `{ batch_id, scenarios: [...], interfaces: [...], spec_paths, out_dir }`（5 个字段）。原因：`TesterInputSchema` 不再有 `items`，换成了 `scenarios` 和 `interfaces`。

2. **`accepts a valid input with exactly four fields`**：原来断言 4 个字段。现在改名为 `accepts a valid input with exactly five fields`，断言 5 个字段。原因：schema 从 4 字段变成 5 字段。

3. **`includes items verbatim`**：原来用 `items: ['exact item text here']` 断言文字出现在 prompt 中。现在改名为 `includes scenario text verbatim`，用 `scenarios: [{ id: 'S1', kind: 'new', text: 'exact scenario text here' }]` 断言。原因：prompt 的输入源从 items 变成了 scenarios。

4. **`includes self-check vitest commands`**：原来断言 prompt 包含 `new.test.ts` 和 `keep.test.ts` 的 vitest 命令。现在拆成两条：只有 `[新]` 时断言不含 `keep.test.ts`、含 lint 和 typecheck；有 `[保持]` 时断言两个文件的命令都在、含 lint 和 typecheck。原因：SPEC 16.11 要求无 keep 时不出现 keep.test.ts。

另外改写了 `includes output directory and the three file names`：去掉了对 `keep.test.ts` 的断言，因为 `validInput` 默认只有 `new` 场景，此时 prompt 不应包含 keep.test.ts。这一条 task 没有点名，但它会因为 validInput 的变化而直接失败（原来的 validInput 有 items，prompt 总是包含 keep.test.ts），属于必须跟随改动的地方。

## 下一步建议

- v046-b05（红检查加静态检查）可以在本批次基础上签发。
- 测试 agent 接进队列的批次尚未签，等操作员实跑一次测试 agent 后再签。

```json
{
  "schema_version": 1,
  "batch_id": "v046-b04",
  "head_sha": "f081e4347c2600b93030a9344cf51e3a6276227c",
  "claims": {
    "commits": ["f081e4347c2600b93030a9344cf51e3a6276227c"],
    "tests_passed": 1259,
    "tests_failed": 0,
    "pushed": true,
    "new_deps": [],
    "spec_touched": false
  },
  "open_questions": []
}
```
