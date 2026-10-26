# 批次 v02-e-drill2 汇报

## 做了什么

**条目 1：`collie show <batch>` 输出末尾加中断链。**
上一轮（attempt 1）已在 `src/cli.ts` 中添加了 `interruptChain()` 函数（rescue 提交 `6158611`），
但未将其接入 `show()` 函数。本轮在 `show()` 的 decision trail 输出之后添加了调用：
筛选 `run.orphaned` / `worker.rescued` / `worker.resumed` 三类事件，按 `run_id` 分组，
有 `worker.resumed` 时标注 attempt 编号。无中断事件时整段省略。

**条目 2：`test/show.test.ts` 覆盖有中断链与无中断链两种输出。**
新增 describe 块 `collie show: 中断链 (interrupt chain section)` 包含两个测试用例：
- 有中断链：worker 被 kill 后 `collie show` 输出包含 `== 中断链 ==` 和 `worker.rescued`
- 无中断链：正常 PASS 场景 `collie show` 输出不含 `中断链`

**条目 3：`README.md` 加「中断与恢复」节。**
在「永不做」之后新增 `## 中断与恢复` 段，三句话覆盖：
kill 后自动 rescue 提交保存脏工作区、下一轮 resume 会话上下文、`collie show` 查看中断链。

## 测试结果

```
npm run lint  → exit 0，All matched files use Prettier code style!
npm run typecheck → exit 0
npm test → exit 0，672 passed, 0 failed（34 test files）
grep -qE "中断链" src/cli.ts && grep -qE "中断链" test/show.test.ts → exit 0
grep -qE "^## .*中断与恢复" README.md → exit 0
```

## 偏离或疑问

无。

上一轮（attempt 1，`r-20261026-025529`）rescue 提交 `6158611` 仅包含 `interruptChain()` 函数定义，
未接入 `show()` 也未添加测试或 README 段。本轮从此处继续，没有重复工作。

## 下一步建议

本批次是场景 E 第二次演练（脏工作区 + 不补杀），三条条目全部完成。
若验收通过，v0.2 的场景 E 演练系列可以结束，继续推进后续批次。

````json
{
  "schema_version": 1,
  "batch_id": "v02-e-drill2",
  "head_sha": "b076c7b",
  "claims": {
    "commits": ["fa469de", "b076c7b"],
    "tests_passed": 672,
    "tests_failed": 0,
    "pushed": true,
    "new_deps": [],
    "spec_touched": false
  },
  "open_questions": []
}
````
