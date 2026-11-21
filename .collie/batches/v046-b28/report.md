# 批次 v046-b28 汇报

## 做了什么

逐条对应 task.md 的三个条目：

1. **reviewer-rerun 第二个 worker 改成只重写 report**：在 `test/reviewer-rerun.test.ts` 新增 `reportOnlyWorkerScene` 函数，它不创建任何代码提交，只写 `.collie/batches/<批次>/report.md`（`head_sha` 指向第一个 worker 的代码提交），以 `report(collie):` 提交并推送。第三组 describe 的 `beforeEach` 把第二个 worker 场景从 `workerScene(box, workerCaptures, true)` 换成 `reportOnlyWorkerScene(box, workerCaptures)`。现有 4 条断言全过。
   - 验证变异效果：若撤掉 `src/run.ts` 里 `copyFileSync(mainTaskPath, join(batchDir, 'task.md'))` 那几行，reviewer 拿到的 task.md 来自 head_sha 对应的 git 树（那里是 attempt: 1），`attempt 2 reviewer sees task.md with attempt: 2 frontmatter` 会失败。旧写法第二个 worker 有新的代码提交，task.md 已经在树里更新了，撤掉那几行照样全过。

2. **blocked-cleanup note.txt**：去掉 `.gitignore` 的做法。测试改为：一个空闲 worker（只写 feature.txt）→ 救援提交 → 中断重试 → 两轮 worker+reviewer FIX（`fix_max=1`）→ 超出限制 → 收尾。最后一个 reviewer 场景往主工作区写真正的未跟踪 `note.txt`。worker 场景写 `other.txt` 而非 `feature.txt`，避免与救援提交 revert 时冲突。所有原断言保持不变。

3. **blocked-cleanup content conflict**：基准里先 `box.write('feature.txt', 'original line 1\nline 2\n')`（两行）。空闲 worker 写 `'rescue changed line 1\nline 2\n'`（改第 1 行），后续 worker 写 `'worker changed line 1 N\nline 2\n'`（再改同一行）。revert 救援提交时产生真正的内容冲突（三方合并标记），`git revert --abort` 后工作区干净、无 `<<<<<<<`。原有断言全部保持。

条目 3 的「不改 `src/`；不改 `test/invariants.test.ts`」已遵守，只改了两个测试文件。

## 测试结果

```
$ npm run lint
eslint . && prettier --check .
Checking formatting...
All matched files use Prettier code style!

$ npm run typecheck
tsc -p tsconfig.json
（无输出，exit 0）

$ npm test
 Test Files  71 passed (71)
      Tests  1470 passed (1470)
   Duration  24.03s

$ npm test -- test/reviewer-rerun.test.ts test/blocked-cleanup.test.ts
 Test Files  2 passed (2)
      Tests  23 passed (23)

$ ! grep -qE "gitignore.*note\.txt|note\.txt.*gitignore" test/blocked-cleanup.test.ts
（exit 0，无匹配）
```

## 偏离或疑问

以下是本批次点名允许的改写，逐条列出：

**note.txt 用例**（`idle workers with note.txt → cleanup only commits rescue paths; note.txt stays`）：
- 原来断言什么：同上（rescue 事件、cleanup 事件、cleanup 提交只含 feature.txt 不含 note.txt、note.txt 在工作区、note.txt 不在任何提交、feature.txt 被 revert）。
- 现在断言什么：完全相同的断言，一条不删、不改。
- 改了什么：整个测试体从「两个空闲 worker + `.gitignore` 隐藏 note.txt」改成「一个空闲 worker + 两轮 worker+reviewer FIX + 最后一个 reviewer 场景往主工作区写 note.txt」。设置新增 `fix_max = 1`。worker 场景写 `other.txt` 避免与 feature.txt 的 rescue revert 冲突。
- 为什么原来的做法与本批次新行为冲突：原来用 `.gitignore` 只是绕开了 `git add -A`，并未测试真正未跟踪文件在收尾时不被提交；14.34 要求造出真正的情形。

**content conflict 用例**（`content conflict → revert_conflict; no merge markers; workspace clean`）：
- 原来断言什么：`batch.cleanup_failed` 有 `revert_conflict` 原因、所有 tracked 文件无 `<<<<<<<`、tracked 变更为空、queue.finished 原因是 `fix_max`。
- 现在断言什么：完全相同。
- 改了什么：基准里新增 `feature.txt`（两行）；空闲 worker 改第 1 行而非创建新文件；worker 也改第 1 行而非完全覆盖。
- 为什么原来的做法不够：原来是 rescue 添加文件、worker 覆盖文件→改/删冲突，不会产生 `<<<<<<<` 标记；改后是同一行的三方冲突，会产生合并标记（被 `git revert --abort` 清掉）。

## 下一步建议

- 三处测试改实完成后，可考虑在变异检查清单里加一项验证 `run.ts` 里 reviewer task.md 注入那几行的覆盖。
- v046-b29（D10：同一个 head_sha 被规则 9 降级两次就上报）可在下一批签发。

```json
{
  "schema_version": 1,
  "batch_id": "v046-b28",
  "head_sha": "b380fc176f162d9f5df9973bea47e8b7604b15f6",
  "claims": {
    "commits": ["b380fc176f162d9f5df9973bea47e8b7604b15f6"],
    "tests_passed": 1470,
    "tests_failed": 0,
    "pushed": true,
    "new_deps": [],
    "spec_touched": false
  },
  "open_questions": []
}
```
