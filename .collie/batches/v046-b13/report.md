# 批次 v046-b13 汇报

## 做了什么

**条目 1（测试先行）：** 新建 `test/fingerprint-lock.test.ts`，一个 `describe('fingerprint: never rewrites the git index', …)` 组，使用 `Sandbox` 建仓库。核心测试：提交一个文件；用 `utimesSync` 把文件的修改时间改到 2020 年（内容不变），制造索引里的时间戳不匹配；记录 `.git/index` 的 inode 与修改时间；连调 5 次 `computeFingerprint`；用 `fs.watch`（inotify）监控 `.git/` 目录，断言 `.git/index` 的 inode 与修改时间都没变且 `.git/index.lock` 没有出现过。

在未修改代码上运行该测试：**确认失败**。inode 从 2673308 变成了 2673317，证实 R1 的推断成立——`git diff HEAD` 在遇到时间戳不匹配（内容未变）的文件时会刷新索引，即使 `GIT_OPTIONAL_LOCKS=0` 也拦不住。

**条目 2（修复）：** 在 `src/ladder.ts` 的 `computeFingerprint` 中，将 `git(root, ['diff', 'HEAD'])` 改为 `git(root, ['-c', 'diff.autoRefreshIndex=false', 'diff', 'HEAD'])`。

选了什么、为什么：用 git 自带的 `diff.autoRefreshIndex` 配置项（通过 `-c` 单次生效）。这个配置控制的是 porcelain `git diff` 在比较工作区文件前是否自动执行 `update-index --refresh`（需要索引锁）。设为 `false` 后 git 不再自动刷新索引，因此不创建 `.git/index.lock`，也不改写 `.git/index`。`GIT_OPTIONAL_LOCKS=0`（已在 `git.ts` 里全局设置）管住了 `git status` 的索引刷新，两者互补。

关于时间戳变、内容没变时的行为：指纹**不变**。`git diff HEAD` 仍然会读取文件、计算哈希、发现内容与 HEAD 一致，输出为空（与开启 autoRefreshIndex 时相同）。唯一的区别是不把新的 stat 信息写回索引。task 说「指纹变不变都可以」，这里实际是不变。

**条目 3（三条内容敏感性测试）：** 在同一个 describe 组中加了三条测试：
1. 被跟踪的文件内容变了 → 指纹变
2. HEAD 变了（新提交）→ 指纹变
3. 未跟踪的文件新增或修改 → 指纹变

`test/scenario-g.test.ts` 里已有的 `computeFingerprint: content-sensitive` 一组未改动，全部通过。

## 测试结果

```
$ npm run lint
Checking formatting...
All matched files use Prettier code style!

$ npm run typecheck
> tsc -p tsconfig.json
(exit 0)

$ npm test
 Test Files  65 passed (65)
      Tests  1355 passed (1355)
   Duration  21.69s

$ npx vitest run test/fingerprint-lock.test.ts test/scenario-g.test.ts
 Test Files  2 passed (2)
      Tests  8 passed (8)
```

## 偏离或疑问

无。

## 下一步建议

v046-b14（R2 凭提交号认自己的提交）可以继续。活性指纹不再占索引锁后，测试里的偶发 `index.lock` 冲突应当消失；后续队列可以关注是否还有残留的偶发失败。

```json
{
  "schema_version": 1,
  "batch_id": "v046-b13",
  "head_sha": "3252fbf1a3ff4125febd14a14ce82636bdb73528",
  "claims": {
    "commits": ["3252fbf1a3ff4125febd14a14ce82636bdb73528"],
    "tests_passed": 1355,
    "tests_failed": 0,
    "pushed": true,
    "new_deps": [],
    "spec_touched": false
  },
  "open_questions": []
}
```
