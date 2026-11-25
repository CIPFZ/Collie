# 批次 v046-b47 汇报

## 做了什么

**条目 1：** 修改 `src/roles/reviewer.ts` 的 `buildReviewerPrompt`，当输入带 `evidence` 时：

- 「验收命令」一节标题下面的两行说明从原来的「逐条原样实跑，记录真实退出码与输出」换成 SPEC 16.31 规定的两行：「以下命令 R2 已经实跑过，结果在下面「R2 的取证结果」一节，不用重跑。」和「要看某条命令的完整输出、或者做别的核对时可以再跑：命令取这里的形式，不要从任何 `.md` 源码复制。」
- 「输出」一节末尾多了一行：``JSON 块里不要写 `evidence`：证据以 R2 的取证结果为准。``

输入不带 `evidence` 时，提示词走原来的分支，逐字节不变。命令清单与其他小节不受影响。

**条目 2：** 没有改动 `src/roles/reviewer.ts` 以外的任何文件。没有改写或删除已有断言。

## 测试结果

```
$ npm run lint
eslint . && prettier --check .
All matched files use Prettier code style!

$ npm run typecheck
tsc -p tsconfig.json
(exit 0, 无输出)

$ npm test
 Test Files  96 passed (96)
      Tests  1634 passed (1634)

$ npm test -- test/acceptance/v046-b47
 Test Files  2 passed (2)
      Tests  6 passed (6)

$ npm run test:mutation
mutation: caught 47 survived 0 invalid 0 timeout 0 stale 0
```

## 偏离或疑问

无

## 下一步建议

v046-b48 可以接着做：reviewer 结论多一个 `test_gaps` 字段，放行判定多一项，变异检查清单加一项。

```json
{
  "schema_version": 1,
  "batch_id": "v046-b47",
  "head_sha": "0dd48b11ad95ca972cffe9a8284e23cc88581917",
  "claims": {
    "commits": ["0dd48b11ad95ca972cffe9a8284e23cc88581917"],
    "tests_passed": 1634,
    "tests_failed": 0,
    "pushed": true,
    "new_deps": [],
    "spec_touched": false
  },
  "open_questions": []
}
```
