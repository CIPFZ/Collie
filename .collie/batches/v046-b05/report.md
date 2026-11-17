# 批次 v046-b05 汇报

## 做了什么

**条目 1：静态命令支持。** `RunRedCheckOpts` 新增可选 `staticCommands?: string[]`。两个测试文件跑完之后（如果没有因超时提前返回），逐条以 `sh -c <cmd>` 执行，使用同一个注入的 `spawn` 和相同的 `timeoutMs`。退出码非 0 的记一条问题（`file: 'static'`，`testName` 是命令原文，`reason` 含退出码与输出末 20 行）；超时的同样记一条（reason 是 `'timeout'`）。不传 `staticCommands` 时行为完全不变——不会执行任何静态命令。

实现要点：新增内部函数 `runStaticCommand`，与 `runOneFile` 类似的结构但调用 `sh` 而非 `npx`。末 20 行的常量 `STATIC_OUTPUT_TAIL_LINES = 20` 用 eslint-disable 标注（SPEC 16.11 固定的输出格式，不是可调阈值）。

`RedCheckProblem.file` 类型从 `'new' | 'keep'` 扩展为 `'new' | 'keep' | 'static'`。

**条目 2：keep.test.ts 存在但没有报告的检测。** 在 `runRedCheck` 中，`keepExists` 为 true 且 `keepResult.report` 为 null 时，记一条 `file: 'keep'`、`reason: 'no report produced'` 的问题。`judgeRedCheck` 不改——它的 `keepReport` 为 null 即没有 keep 文件的约定不受影响。

**条目 3：测试。** 新增 `describe('runRedCheck: static commands and missing reports', …)` 包含 7 个用例：
1. 静态命令 exit 0 + 两条 failing new tests → ok
2. 静态命令 exit 3 + 输出 boom → 不过，问题里有命令原文、`3` 和 `boom`
3. 两条静态命令，第一条过第二条不过 → 只有第二条的问题
4. 测试问题（new 有 pass）和静态问题同时存在 → 两类都在返回值
5. 静态命令超时（注入假 spawn，vitest 用真实的）→ timeout 问题
6. 不传 staticCommands → 只有 1 次 spawn 调用（vitest），没有静态命令
7. keep.test.ts 存在但注入的假 spawn 不写报告 → 不过，原因是 `no report produced`

`test/invariants.test.ts` 新增一条 `src/redcheck.ts has staticCommands (v046-b05)`。

已有用例全部不改，16 条原样通过。

## 测试结果

```
npm run lint    → exit 0
npm run typecheck → exit 0
npm test        → 62 files, 1267 tests passed, 0 failed
npm test -- test/redcheck.test.ts → 23 tests passed (16 existing + 7 new)
TMPDIR 清理测试 → no collie-redcheck-* leftovers
```

## 偏离或疑问

无

## 下一步建议

静态命令功能已就绪，可以在红检查的调用方（将来接入队列的批次）传入 `['npm run lint', 'npm run typecheck']` 来使用。

```json
{
  "schema_version": 1,
  "batch_id": "v046-b05",
  "head_sha": "eb0a34be73d170cb246f96a8e3025eaf0625194c",
  "claims": {
    "commits": ["eb0a34be73d170cb246f96a8e3025eaf0625194c"],
    "tests_passed": 1267,
    "tests_failed": 0,
    "pushed": true,
    "new_deps": [],
    "spec_touched": false
  },
  "open_questions": []
}
```
