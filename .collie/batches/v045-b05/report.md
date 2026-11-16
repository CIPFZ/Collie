# 批次 v045-b05 汇报

## 做了什么

### 条目 1：「已处理」与推送（SPEC 14.9 第 1 条）

- 汇报提交信息改为 `ops: report queue <q_run_id> (base <基准提交前 12 位>)`，代码在 `executeRun` 的 step 6 拼接。
- 「已处理」判定逻辑：除了 `follow.json` 的 `handledBase`，新增 `isHandledInGitLog()` 函数，从 `git log <baseSha>..HEAD` 里查找含 `(base <12位>)` 标记的提交。
- 起了 `run --continue` 之后，`executeRun` 无论后续步骤是否失败都返回 `handled: true`，确保 handledBase 一定被记录。
- 本地领先远端时，进入 run 动作前先调 `pushIfAhead()`，失败按 `push:<baseSha>` 键通知一次。

### 条目 2：失败只通知一次并退避（SPEC 14.9 第 2~4 条）

- 通知键去重：所有通知键在 `follow.json.notified` 中持久化；`executeRun` 在发通知前先查 `notifiedSet`。
  - preflight 键格式 `preflight:<baseSha>:<失败项按字母序>`
  - 固定版本键 `pinned:<sha>`
  - 祖先键 `ancestor:<baseSha>`
  - 推送键 `push:<baseSha>`
  - pull 键 `pull`
- 退避：preflight 或固定版本目录失败后，在 `follow.json.retry` 记录 `{ failures, notBefore }`。下一次尝试前检查 `nowFn() < notBefore` 则跳过。初始 5 分钟，每失败翻倍，最长 60 分钟。成功一次清零。
- 祖先不匹配：通知一次后只等（不起子进程）。
- git pull 连续失败 3 圈通知一次（键 `pull`），成功后清零。
- preflight 改用 `--smoke --json`，只从 JSON 提取失败项 name，不带 detail（避免路径泄漏）。
- 队列结束原因：通过 `report --queue <id> --json` 获取 `queue.finished.reason`，取不到才用 `exit <code>`。
- 子进程函数收完整命令行：Collie 命令由 follow 自己拼 `['npx', 'tsx', pinnedCli, ...]`，`npm ci` 就是 `['npm', 'ci']`。
- 默认 `defaultSpawn` 改为 `child_process.spawn`（流式），边跑边输出到 stdout，内存只留末 200 行，无缓冲上限。不再使用 `execFileSync`。

### 条目 3：汇报附录、目录注入与测试（SPEC 14.9 第 5~7 条）

- 汇报末尾追加 `## 运行环境（follow 记录）`，含基准提交、固定版本、run 命令行与退出码、preflight 末行、stdout/stderr 各末 20 行。
- `preparePinnedR2` 新增 `parentDir` 参数（默认 `os.tmpdir()`），`FollowOpts` 新增 `pinnedParentDir`。
- `test/support/sandbox.ts` 新增 `.replace(/^webhook_file = .*$/m, ...)` 去除真实通知地址。
- `test/follow.test.ts` 全面改写并扩充到 20 个 `it()` 块，涵盖：
  - 推送失败连续 3 圈：断言 `run --continue` 只起 1 次、仓库只有 1 份汇报
  - preflight 连续失败 3 圈：断言 preflight 只起 1 次、通知 1 条；5 分钟后第 2 次 preflight 通知仍 1 条
  - 祖先不匹配连续 3 圈：断言只通知 1 条、子进程 0 次
  - follow.json 删掉后同一基准不再跑（git log 标记检测）
  - preflight 通知不含 `/`
  - 队列原因来自 journal（`limit` 不写成 `exhausted`）
  - 锁文件不同时子进程命令首词为 `npm`
  - 汇报含附录
  - 注入的父目录之外无新建固定版本目录
  - git pull 连续失败 3 圈后通知 1 次
- `test/invariants.test.ts` 新增「`src/follow.ts` 不含 `execFileSync`」不变量。

## 测试结果

```
npm run lint     → exit 0, 0 errors 0 warnings
npm run typecheck → exit 0
npm test         → 56 files, 1076 tests passed, 0 failed
npm test -- test/follow.test.ts → 20 passed, 0 failed
```

验收命令逐条检查：
- `grep -cE "^\s+it\(" test/follow.test.ts` → 20（≥16 ✓）
- `TMPDIR=$(mktemp -d) npm test -- test/follow.test.ts && ! ls -d "$d"/collie-r2-*` → exit 0 ✓
- `notBefore` 在代码和测试中均存在 ✓
- `(base ` 和 `follow 记录` 在非注释代码行中存在 ✓
- `execFileSync` 不在非注释代码行中 ✓
- `webhook_file` 在 sandbox.ts 中存在 ✓
- `execFileSync` 在 invariants.test.ts 中存在 ✓

## 偏离或疑问

无。

## 下一步建议

- v045-b06（SPEC 14.10）：`collie report` 与 `why` 的多处数据补齐。
- v045-b07（SPEC 15）：变异检查脚本。
- 第八次队列可将固定版本前移，首次真实使用 `collie follow`。

```json
{
  "schema_version": 1,
  "batch_id": "v045-b05",
  "head_sha": "68038df889fa72b66aa7197aa341cd5c5ec1b9fe",
  "claims": {
    "commits": ["68038df889fa72b66aa7197aa341cd5c5ec1b9fe"],
    "tests_passed": 1076,
    "tests_failed": 0,
    "pushed": true,
    "new_deps": [],
    "spec_touched": false
  },
  "open_questions": []
}
```
