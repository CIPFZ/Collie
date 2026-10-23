# 批次 v02-e-drill 汇报

## 做了什么

本批次上一轮（attempt 1）在 `worker.started` 处中断，但已产出两个有效提交（`7ccbf4b`、`9acc692`），完成了条目 1 和条目 2。本轮核实了这两个提交的完整性——代码语义正确、测试通过——然后继续完成条目 3。

**条目 1（已由 attempt 1 完成）：`src/runner/claude.ts` 落盘前密钥屏蔽**
- `redactEvent()` 函数：对每个非空且长度 ≥ 8 的密钥值，在 JSON 序列化后的事件中全部替换为 `***`，再反序列化回对象。空列表或全部过短时返回原对象。
- `REDACT_MIN_LENGTH = 8` 作为安全下限（非 SPEC 阈值，故加 eslint-disable 注释说明）。
- 在 `run()` 方法中，`opts.redact ?? []` 取得密钥列表，`redactEvent(message, secrets)` 在 `onEvent?.()` 调用前执行，确保落盘数据已屏蔽。
- `RunOptions.redact` 在 `src/runner/index.ts` 声明为 `readonly string[]`。
- `src/run.ts` 负责从 `config.ci.token_file` 文件内容和 `GITHUB_TOKEN`/`GH_TOKEN` 环境变量构造 `redact` 数组，runner 本身不读配置也不读环境变量。

**条目 2（已由 attempt 1 完成）：`test/runner-claude.test.ts` 屏蔽测试**
- 5 个测试用例覆盖：含密钥事件被屏蔽（assistant 文本和 system data 均验证）、空 redact 原样通过、省略 redact 原样通过、短于 8 字符不屏蔽、多密钥同时屏蔽。

**条目 3（本轮完成）：`test/invariants.test.ts` + `test/support/sandbox.ts`**
- 新增不变量 1：`src/runner/claude.ts` 包含 `redact`，防止屏蔽逻辑被移除。
- 新增不变量 2：只有 `src/run.ts` 和 `src/evidence.ts` 以属性访问方式 (`.token_file`) 使用 `token_file`，防止其他模块直接读取令牌文件。用 `grep -rlE "\.token_file"` 匹配属性访问，过滤出允许的文件集。
- 沙箱 ENOTEMPTY 修复：`Sandbox.create()` 的全局 gitconfig 新增 `[gc]\n\tauto = 0` 禁用自动 gc（gc 的 lock 文件是 ENOTEMPTY 的根因）；`dispose()` 的 `rmSync` 新增 `maxRetries: 5, retryDelay: 100` 提供重试容错。

## 测试结果

```
$ npm run lint
> eslint . && prettier --check .
All matched files use Prettier code style!  (exit 0)

$ npm run typecheck
> tsc -p tsconfig.json  (exit 0)

$ npm test
 Test Files  33 passed (33)
      Tests  654 passed (654)
   Duration  9.62s
```

所有验收命令均 exit 0：
- `grep -qE "redact" src/runner/index.ts && grep -qE "redact" src/runner/claude.ts && grep -qE "redact" src/run.ts` → exit 0
- `grep -qE "redact" test/runner-claude.test.ts && grep -qE "\*\*\*" test/runner-claude.test.ts` → exit 0
- `grep -qE "redact" test/invariants.test.ts` → exit 0
- `grep -qE "maxRetries" test/support/sandbox.ts && grep -qE "auto = 0" test/support/sandbox.ts` → exit 0

## 偏离或疑问

无。

## 下一步建议

三个条目全部完成，可进入审核。沙箱 ENOTEMPTY 修复应在后续批次的场景测试中体现稳定性提升。

```json
{
  "schema_version": 1,
  "batch_id": "v02-e-drill",
  "head_sha": "6317361",
  "claims": {
    "commits": ["7ccbf4b", "9acc692", "6317361"],
    "tests_passed": 654,
    "tests_failed": 0,
    "pushed": true,
    "new_deps": [],
    "spec_touched": false
  },
  "open_questions": []
}
```
