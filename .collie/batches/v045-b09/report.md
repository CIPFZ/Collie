# 批次 v045-b09 汇报

## 做了什么

**条目 1：基线与判定（SPEC 15.5）**

- `runBaseline` 重写为两步：先跑整项目类型检查（`tsc --noEmit`，120 秒限），再用 vitest JSON reporter（`--reporter=json --outputFile=<临时路径>`）跑相关测试。任何一步不过或无测试执行，返回失败原因字符串；CLI 在末行输出 `mutation: baseline failed (<原因>)`，退出码 1。
- `judgeExecResult` 由旧的"看退出码"改为纯函数，输入 `VitestJsonReport | null`（含 `numTotalTests` / `numFailedTests`）和退出码。逻辑：`numTotalTests === 0` → `invalid`；`numFailedTests > 0` → `caught`；exit 0 → `survived`；非零退出但无失败 → `invalid`。
- 新增 `judgeTypecheckResult` 纯函数：killed → `timeout`，非零退出 → `invalid`，null → `ok`。
- 新增 `judgeBaseline` 纯函数，整合基线的类型检查结果、测试结果与 JSON 报告，返回失败原因或 null。
- JSON 报告用 `--outputFile` 写到系统临时目录，读完用 `rmSync` 删掉，避免在工作区留下 `.vitest/`。

**条目 2：超时与末行（SPEC 15.5）**

- 类型检查超时 120 秒（`TYPECHECK_TIMEOUT_MS`），测试进程超时 180 秒（`TEST_TIMEOUT_MS`），取代旧的统一 60 秒。
- 类型检查超时返回 `timeout`（不是 `invalid`），通过 `judgeTypecheckResult` 判定。
- CLI 末行改为固定格式 `mutation: caught <n> survived <n> invalid <n> timeout <n> stale <n>`，全部 `caught` 退出码 0，否则 1。
- 清单 44 项不动。

**条目 3：测试补齐**

- `test/mutation.test.ts` 重写为 22 个用例（≥ 18），覆盖：
  - `judgeExecResult`：6 条（numFailedTests > 0 → caught，全过 → survived，非零退出 0 失败 → invalid，0 总测试 → invalid，null 报告 → invalid，exit 0 但有失败 → caught）
  - `judgeTypecheckResult`：3 条（ok / timeout / invalid）
  - `judgeBaseline`：5 条（typecheck / tests failed / no tests executed / typecheck timeout / 全过 null）
  - `checkUnique`：3 条（原有）
  - mutation list shape：4 条（原有）
  - 末行格式：1 条
- `test/invariants.test.ts` 加一条 `scripts/mutation.ts` 含 `numFailedTests`。
- `test/preflight.test.ts`「本地落后远端」用例：用 `try/finally` + `rmSync` 在用完后删掉 `collie-clone-*` 目录。

## 测试结果

```
$ npm run lint
eslint . && prettier --check .
Checking formatting...
All matched files use Prettier code style!

$ npm run typecheck
tsc -p tsconfig.json
(no errors)

$ npm test
 Test Files  57 passed (57)
      Tests  1135 passed (1135)

$ npm test -- test/mutation.test.ts
 Test Files  1 passed (1)
      Tests  22 passed (22)
```

验收逐条确认：
- `grep -cE "^\s+it\(" test/mutation.test.ts` → 22（≥ 18）✓
- `numFailedTests` 在非注释代码行和测试文件中均存在 ✓
- `npx tsx scripts/mutation.ts --only rule2-protected` 末行为 `mutation: caught 1 survived 0 invalid 0 timeout 0 stale 0` ✓
- `! test -e .vitest` → 无 `.vitest` 目录 ✓
- preflight 测试用 `TMPDIR=$d` 跑完后 `$d` 下无 `collie-clone-*` ✓
- 清单 44 项 ✓
- invariants 含 `numFailedTests` ✓

## 偏离或疑问

- `judgeExecResult` 旧的四条测试（看退出码/killed）全部替换为新的六条（看 JSON 报告）。原因：函数签名从 `(error) → Result` 改为 `(report, exitCode) → Result`，旧断言不再适用。旧断言守的"退出码非零 → caught"语义已被 SPEC 15.5 明确否定（"测试进程非零退出却没有用例失败算 invalid"），新测试覆盖了全部新语义。

## 下一步建议

- 可以在下次审队列时跑全量 `npm run test:mutation`（约 44 项）确认全部 `caught`，验证 JSON reporter 在 CI 环境下正常工作。
- `judgeBaseline` 目前还有一个 `test timeout` 分支只在纯函数测试中覆盖；若需更高信心可在集成层加一个带 fake 超时的用例，但当前代码路径简单、纯函数测试已覆盖逻辑。

```json
{
  "schema_version": 1,
  "batch_id": "v045-b09",
  "head_sha": "fa89a597d0b619f65daba0726449cddf72262cb1",
  "claims": {
    "commits": ["fa89a597d0b619f65daba0726449cddf72262cb1"],
    "tests_passed": 1135,
    "tests_failed": 0,
    "pushed": true,
    "new_deps": [],
    "spec_touched": false
  },
  "open_questions": []
}
```
