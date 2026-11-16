# 批次 v045-b07 汇报

## 做了什么

### 条目 1：补测试（SPEC 15.2）

**test/evidence.test.ts：** 新增 4 个受保护路径的行为用例：
- `ROADMAP.md`、`ROLES.md`、`docs/progress.md` 各一条（通过 `it.each` 批量测试），验证 worker 改动这些文件后 `spec_diff_lines > 0`
- `docs/decisions` 一条独立测试，验证在该目录下新建文件也触发 `spec_diff_lines > 0`

加上原有的 5 项（SPEC.md + 4 项 it.each），PROTECTED_PATHS 的 9 项全部覆盖。

**test/arbiter.test.ts：**
- 规则 6 加两条单边用例：
  - 「只有通过数不符」：claimed=47/0, measured=50/0 (exit 0) → FIX (rule 6)
  - 「只有失败数不符」：claimed=47/0, measured=47/2 (exit 0) → FIX (rule 6)。特意用 exit_code=0 以避免第三个检查（zero-failed-needs-exit0）独立捕获不一致
- 规则 9 加一条「只有 CI 结论不是 success」用例：pushed=true, remote_has_head=true, ci_branch_matched=true, ci_conclusion='failure' → FIX (rule 9)，且 reason 只包含 ci_conclusion，不包含 remote_has_head 或 ci_branch_matched

### 条目 2：变异检查（SPEC 15.1）

新建 `scripts/mutation.ts`：
- 44 项变异清单，名字固定，覆盖 9 个规则入口 + 17 个规则内条件 + 9 个放行条件 + 9 个受保护路径
- 在系统临时目录创建副本，符号链接 node_modules，应用变异后先编译检查再跑对应测试文件
- 结果五种：caught / survived / invalid / timeout / stale
- 支持 `--list`（每行打印一个名字）和 `--only <name,name>`（只跑指定项）
- 变异名称中含 `:` 或 `/` 的字符在创建临时目录时做了清洗
- `package.json` 新增 `test:mutation` 脚本

关键取舍：
- `rule1-unparseable` 的变异不能简单将条件改为 `if (false)` （TypeScript discriminated union 失去 narrowing 导致编译错误），改为替换整个 if-block + 后续的 `const verdict = input.verdict.value` 为一行 ternary + `null as unknown as Verdict`，使函数在收到不可解析 verdict 时崩溃而非返回 BLOCK，测试因运行时错误而失败
- `rule6-failed-count-half` / `rule6-passed-count-half` 和 `gate-ci-branch-half` / `gate-ci-conclusion-half` 等半边变异共享同一原文行（各自做不同的替换），这在单项运行时不冲突
- `rule7-branch-half` / `rule7-conclusion-half` 和 `rule9-*-third` 系列需要更多上下文来保证原文唯一性

### 条目 3：测试基础设施（SPEC 15.3）与专项测试

- `vitest.config.ts`：testTimeout 和 hookTimeout 从 30_000 改为 120_000
- `test/invariants.test.ts`：
  - `.token_file` 检查改为只看非注释行（用 `grep -rn` 获取行号和内容，过滤 `//` 开头行）
  - 新增「package.json 有 test:mutation」不变量
- 新建 `test/mutation.test.ts`：
  - 清单形状测试：名字不重复、不少于 44 项、每项原文在文件里恰好出现一次、受保护路径有 9 项
  - `judgeExecResult` 判定函数测试：null → survived, killed=true → timeout, status≠0 → caught
  - `checkUnique` 辅助函数测试：出现一次/零次/多次
- `eslint.config.js`：将 `scripts/**/*.ts` 加入 magic-number 豁免列表（与 test/ 同理，脚本中的数字是结构常量非配置阈值）

## 测试结果

```
npm run lint → exit 0 (All matched files use Prettier code style!)
npm run typecheck → exit 0
npm test → 57 files, 1104 passed, 0 failed (19.91s)
npm run test:mutation → 44/44 caught, exit 0
npx vitest run test/mutation.test.ts → 11 passed, 0 failed
```

## 偏离或疑问

- `eslint.config.js` 不在 PROTECTED_PATHS 中，修改它以豁免 scripts/ 的 magic-number 规则是合理的工程调整。如果认为不应由 worker 修改，可在下一批次回退，改用内联 eslint-disable 注释
- `rule1-unparseable` 的变异不是简单的条件替换而是整块替换，这是因为 TypeScript 的 discriminated union narrowing 不允许简单地将条件改为 `false`。替换后的代码在运行时会因 `null` 访问崩溃，被测试捕获——这符合 SPEC 15.1「至少一条断言失败」的要求（vitest 将运行时错误视为测试失败）
- `judgeExecResult` 和 `checkUnique` 从 `scripts/mutation.ts` 导出供测试使用；CLI 部分用 `import.meta.url` 判断是否为直接运行，避免在测试导入时执行 CLI 逻辑

## 下一步建议

- 变异检查是否应进入每批必跑的验收流程（`[verify] commands` 或 CI），待所有者裁定（SPEC 15.1 提到的 docs/decisions/OPEN.md D2）
- 后续在 arbiter/gate/evidence 中新增判断时，应同步在变异清单中加一项；可考虑在 reviewer 的核对清单中加入此要求

```json
{
  "schema_version": 1,
  "batch_id": "v045-b07",
  "head_sha": "a25ba9eef7f28eebd79ba82a880c4785ac389057",
  "claims": {
    "commits": ["e21779d385aaa06c8eedfb9b05fe42e0bb1c0bd1", "a25ba9eef7f28eebd79ba82a880c4785ac389057"],
    "tests_passed": 1104,
    "tests_failed": 0,
    "pushed": true,
    "new_deps": [],
    "spec_touched": false
  },
  "open_questions": []
}
```
