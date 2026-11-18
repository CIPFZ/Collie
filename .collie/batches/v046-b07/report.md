# 批次 v046-b07 汇报

## 做了什么

### 条目 1：配置加 tester_max 与 verify.static

- `src/schema/index.ts`：新增 `DEFAULT_TESTER_MAX = 2` 常量；`LimitsSchema` 加 `tester_max`（正整数，可选，缺省 2，写法与 `grace_secs` 一致：`.optional().default(DEFAULT_TESTER_MAX)`）；`verify` 的 strictObject 加 `static`（`z.array(NonEmptyString).optional()`，不写时键不存在）。
- `templates/collie.toml`：`[limits]` 加 `tester_max = 2` 并带注释，`[verify]` 加 `static = ["npm run lint", "npm run typecheck"]` 并带注释。
- `.collie/collie.toml` 未改动：没有这两项也能正常加载，`limits.tester_max` 返回缺省值 2，`verify.static` 为 `undefined`。
- `tester_max = 0` 被 `z.number().int().positive()` 拒绝，zod 错误路径为 `limits.tester_max`。

### 条目 2：三个事件类型

- `src/schema/index.ts` 的 `EVENT_TYPES` 数组末尾加了 `tester.started`、`tester.finished`、`redcheck.result`，共 40 个事件类型。
- 未在任何地方记录这些事件（符合任务要求「只加类型」）。

### 条目 3：受保护路径与变异清单

- `src/evidence.ts`：`PROTECTED_PATHS` 末尾加 `'test/acceptance'`，共 10 项。
- `scripts/mutation.ts`：`MUTATIONS` 末尾加 `protected:test/acceptance`（写法照已有的 9 项），共 43 项。注释更新为 43 items，protected paths 注释更新为 10。
- `test/evidence.test.ts`：新增 `counts test/acceptance as protected (SPEC 16.12)` 用例——在沙箱仓库的 `test/acceptance/v99/new.test.ts` 写文件并提交，验证 `spec_diff_lines` 为 1。
- `test/invariants.test.ts`：新增 `src/evidence.ts has test/acceptance in PROTECTED_PATHS (v046-b07)` 不变量。
- `test/config.test.ts`：新增 `describe('config: tester_max and verify.static', …)` 组，含 7 条用例覆盖：缺省值、拒绝 0、接受正整数、模板值、static 缺省行为、仓库配置无此二项仍可加载。
- `test/schema.test.ts`：事件数 37→40，加三条 `toContain`。
- `test/mutation.test.ts`：受保护路径计数 9→10。

## 测试结果

```
npm run lint      → exit 0（零错误）
npm run typecheck → exit 0（零错误）
npm test          → 62 test files passed, 1293 tests passed, 0 failed

npm test -- test/config.test.ts test/schema.test.ts test/evidence.test.ts test/mutation.test.ts
  → 4 test files passed, 159 tests passed

npx tsx scripts/mutation.ts
  → mutation: caught 43 survived 0 invalid 0 timeout 0 stale 0
```

## 偏离或疑问

以下四处已有断言被修改（均为 task 点名允许的）：

1. **`test/config.test.ts` / `has the limits of SPEC 3.1`**：期望对象中新增 `tester_max: 2`。原断言不含此字段；新断言加了它。原因：LimitsSchema 新增了 `tester_max` 且有缺省值，round-trip 后对象多了此键。
2. **`test/config.test.ts` / `equals the inline SPEC 3.1 fixture…`**：`VALID_TOML` 内联字符串的 `[limits]` 加了 `tester_max = 2`，`[verify]` 加了 `static = ["npm run lint", "npm run typecheck"]`。断言本身（`toEqual(config)`）不变。原因：模板新增了这两项，VALID_TOML 需要同步才能与 `templateConfig()` 相等。
3. **`test/schema.test.ts` / `defines the v0.1 event types plus v0.2 and v0.3 types added so far`**：`toHaveLength(37)` → `toHaveLength(40)`，新增三条 `toContain`。原断言计数为 37；新断言 40，对应新增的 3 个事件类型。
4. **`test/mutation.test.ts` / `every protected path is in the mutation list`**：`toBe(9)` → `toBe(10)`。原断言计数为 9；新断言 10，对应新增的 `test/acceptance` 受保护路径。

此外，`test/schema.test.ts` 的 `validConfig.limits` 对象也加了 `tester_max: 2`，以便 round-trip 测试通过（否则 `toEqual` 因 zod 缺省值补齐而失败）。

## 下一步建议

- v046-b08：实现 `src/acceptance.ts` 模块（`prepareAcceptance`），利用本批次加好的配置、事件和受保护路径。
- 接线批次：将 `prepareAcceptance` 接入 `src/run.ts`，完成测试 agent 的端到端串联。

```json
{
  "schema_version": 1,
  "batch_id": "v046-b07",
  "head_sha": "97d79b03da298fc5e68ff114682b426fee185eb5",
  "claims": {
    "commits": ["97d79b03da298fc5e68ff114682b426fee185eb5"],
    "tests_passed": 1293,
    "tests_failed": 0,
    "pushed": true,
    "new_deps": [],
    "spec_touched": false
  },
  "open_questions": []
}
```
