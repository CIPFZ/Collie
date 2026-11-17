# 批次 v045-b12 汇报

## 做了什么

### 条目 1：`src/run.ts` — reviewer 工作目录里去掉 report.md

在 `withHeadWorktree` 函数中，`addWorktree` 创建工作目录并链入 `node_modules` 之后，新增两行代码：检查本批次的 `report.md` 是否存在于工作目录中，若存在则 `rmSync` 删除。
这样无论是第 1 次运行（head_sha 树里本来就没有 report.md）还是 FIX 重跑（head_sha 树里包含上一轮的 report.md），reviewer 的工作目录里都看不到 report.md。
task.md 和其他文件不受影响。验收命令同样在此目录运行，不受影响。

代码变动仅在 `src/run.ts`，`src/roles/reviewer.ts` 源码里未出现 `report.md` 字样（原有测试 `never reads a report or imports the worker role` 仍然通过）。

### 条目 2：`src/roles/reviewer.ts` — 取证范围路径排除

修改 `buildReviewerPrompt` 中「取证范围」一节：
- 原来的两条命令 `git log <range>` 和 `git diff <range>` 改为带路径排除的写法：
  `git log <range> -- . ':(exclude).collie/batches'` 和 `git diff <range> -- . ':(exclude).collie/batches'`
- 新增一句说明：「`.collie/batches/` 下是信封文件，不是 worker 的产出；只读本批次的 `task.md`」
- `ReviewerInputSchema` 未加字段

### 条目 3：`test/reviewer-rerun.test.ts` — 专项测试

新文件包含 5 个 `it()` 用例，分两组：

**FIX then PASS（4 个用例）：**
- `report.md is absent from reviewer cwd on both attempts`：FakeRunner 的 reviewer effect 在 `ctx.cwd` 检查 report.md 是否存在，两次都为 false
- `head_sha tree for attempt 2 contains report.md via ls-tree (contrast)`：用 `git ls-tree` 确认第 2 次 head_sha 的 git 树里确实有 report.md，证明是工作目录的删除起了作用
- `task.md is present in reviewer cwd on both attempts`：两次 task.md 都在
- `reviewer prompt contains path exclusion on both attempts`：prompt 包含 `':(exclude).collie/batches'`

**First PASS（1 个用例）：**
- `report.md absent, task.md present, prompt excludes .collie/batches`

测试使用 `FakeRunner` 跑真实的 `run --continue`，不手写 journal。

## 测试结果

```
$ npm run lint
eslint . && prettier --check .
Checking formatting...
All matched files use Prettier code style!

$ npm run typecheck
tsc -p tsconfig.json
(exit 0, 无输出)

$ npm test
 Test Files  59 passed (59)
      Tests  1155 passed (1155)

$ npm test -- test/reviewer-rerun.test.ts
 Test Files  1 passed (1)
      Tests  5 passed (5)

$ npm test -- test/reviewer-isolation.test.ts
 Test Files  1 passed (1)
      Tests  19 passed (19)
```

所有验收命令均通过（grep 计数、FakeRunner 和 ls-tree 存在性、路径排除断言存在性）。

## 偏离或疑问

`test/reviewer-isolation.test.ts` 的 `contains the diff pointer, items, parsed commands verbatim and SPEC paths` 断言未改动。
原断言检查的是 backtick 包裹的 range 字符串是否出现在 prompt 中，新格式下此字符串仍然出现在「worker 产出的 diff 为 `<range>`。」这一行里，断言自然通过，无需修改。
任务允许我因两条命令多了路径参数而改写该断言，但实际不需要。

## 下一步建议

- 条目 2 的 reviewer 手册（AGENT-reviewer.md）可能也需要同步更新，提醒 reviewer 使用带路径排除的命令，但这不在本批次范围内
- 本批次三个条目均已完成，可进入下一批次

```json
{
  "schema_version": 1,
  "batch_id": "v045-b12",
  "head_sha": "f9557edc414376bda50b6e07d8338e76bd62c910",
  "claims": {
    "commits": ["f9557edc414376bda50b6e07d8338e76bd62c910"],
    "tests_passed": 1155,
    "tests_failed": 0,
    "pushed": true,
    "new_deps": [],
    "spec_touched": false
  },
  "open_questions": []
}
```
