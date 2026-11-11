# 批次 v04-b11 汇报

## 做了什么

完成了 3 个条目：

1. **修改 `src/git.ts` 的 `git()` 函数**：在 `spawn('git', ...)` 时传入 `env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' }`，让所有 git 子进程都带这个环境变量。这样 R2 后台取指纹时的只读命令（`git diff HEAD`、`git status`）不会短暂占用 `index.lock`，避免与 worker 的 `git add` / `git commit` 冲突（SPEC 13.15 记录的现象：活性检测每 500 毫秒执行只读命令刷新索引，worker 的提交撞上时因 `.git/index.lock` 文件存在而失败）。

   `GIT_OPTIONAL_LOCKS=0` 只影响只读命令的可选索引刷新，`add` / `commit` 这些该占的锁照常占。环境变量用展开运算符继承 `process.env` 的所有已有变量，再覆盖单个字段，不影响其他环境变量。

2. **在 `test/git.test.ts` 加两个用例**：
   - 第一个通过 `git -c alias.optlocks='!printenv GIT_OPTIONAL_LOCKS' optlocks` 执行打印环境变量的别名，断言输出是 `'0'`，验证环境变量确实传到了子进程
   - 第二个同样打印 `GIT_CONFIG_GLOBAL`（这个变量由测试夹具的 `beforeAll` 设置），验证继承了的其他环境变量也在子进程里可见

3. **在 `test/invariants.test.ts` 加两个不变量**：
   - 第一个检查 `src/git.ts` 包含 `GIT_OPTIONAL_LOCKS` 字符串
   - 第二个用 `grep -rlE "spawn\('git'"` 搜 `src/` 下所有 `spawn('git'` 的调用点，断言只有 `src/git.ts` 一处（这保证所有 git 调用都走统一入口、都会带上这个环境变量）

## 测试结果

全部命令在本地实跑的输出：

```
$ npm run lint
> collie@0.1.0 lint
> eslint . && prettier --check .

Checking formatting...
All matched files use Prettier code style!
# exit 0

$ npm run typecheck
> collie@0.1.0 typecheck
> tsc -p tsconfig.json
# exit 0

$ npm test
> collie@0.1.0 test
> vitest run

 Test Files  48 passed (48)
      Tests  926 passed (926)
   Duration  15.19s
# exit 0
```

验收命令的直接输出：

```
$ grep -vE "^\s*(//|\*|/\*)" src/git.ts | grep -qE "GIT_OPTIONAL_LOCKS"
# exit 0 (在代码非注释行找到了)

$ grep -qE "GIT_OPTIONAL_LOCKS" test/git.test.ts
# exit 0 (test/git.test.ts 里有断言)

$ grep -qE "GIT_OPTIONAL_LOCKS" test/invariants.test.ts
# exit 0 (invariants.test.ts 里有检查)
```

所有 926 个测试通过，包括：
- 新增的 2 个 `test/git.test.ts` 用例（GIT_OPTIONAL_LOCKS 传递到子进程、已有环境变量保留）
- 新增的 2 个 `test/invariants.test.ts` 不变量（src/git.ts 包含此变量、只有 git.ts 直接 spawn git）
- 全部原有测试（包括并发跑的场景测试）

## 偏离或疑问

无。所有条目按 task 的清单完成，没有改动任何受保护路径，没有修改活性检测算法、阈值或规则，没有新增依赖。

验收命令的 grep 写法（用 `grep -vE "^\s*(//|\*|/\*)"` 排除注释）在任务信封里写的是 `"^\s*(//\|\*\|/\*)"` 但这是 Markdown 表格的转义，实际跑的命令已经用竖线转回正确的正则选择符 `|`。

## 下一步建议

本批次的三个条目全部完成并推送。建议：

- 审核通过后，v0.4「看见」阶段全部 11 个批次收尾（v04-b01 到 v04-b11）
- 可观察第三次队列的事件流，搜 `index.lock` 相关错误，验证 `GIT_OPTIONAL_LOCKS=0` 是否消除了索引锁冲突

```json
{
  "schema_version": 1,
  "batch_id": "v04-b11",
  "head_sha": "049854de27d4a6c7a4eb1e4e60d7e77e069c0c11",
  "claims": {
    "commits": ["049854de27d4a6c7a4eb1e4e60d7e77e069c0c11"],
    "tests_passed": 926,
    "tests_failed": 0,
    "pushed": true,
    "new_deps": [],
    "spec_touched": false
  },
  "open_questions": []
}
```
