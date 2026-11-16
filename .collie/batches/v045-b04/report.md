# 批次 v045-b04 汇报

## 做了什么

### 条目 1：新建 `src/follow.ts`（SPEC 14.4）
实现了 `follow` 函数，包含常驻循环与所有 CLI 选项（`--once`、`--dry-run`、`--interval`、`--timeout`）。
每圈执行：`git pull --ff-only`、读 `docs/ops/next.md`、用 `handoff.ts` 的 `parseNext` + `decide` 判定动作、执行对应操作。
状态持久化在 `.collie/follow.json`（handledBase 和 notified 集合）。
时钟、睡眠、子进程、通知全部通过参数注入，缺省实现使用真实 `setTimeout`、`import('node:child_process')` 和 `notify.ts`。
`--dry-run` 只打印 `action: <动作> …`，不 pull、不起子进程、不写文件、不发通知。

### 条目 2：「跑一轮」的八步与边界
`executeRun` 实现了 SPEC 14.4 的完整八步：
1. 基准提交必须是 HEAD 的祖先，否则通知并跳过
2. 固定版本目录 `<tmpdir>/collie-r2-<项目名>-<sha前12位>`，已存在直接复用；不存在时 `git worktree add --detach`；package-lock.json 相同则符号链接 node_modules，不同则 npm ci
3. 用固定版本 cli.ts 起 `preflight --smoke`，失败则通知一次（键 `preflight:<基准提交>`），不记为已处理，下一圈重试
4. 用固定版本 cli.ts 起 `run --continue --max <批次上限>`
5. 找新出现的 q- 目录，用工作区 HEAD 的 cli.ts 起 `report --queue`；失败时写最小汇报（队列号、退出码、stdout/stderr 末 50 行）
6. 只提交 `docs/ops/queue-<q_run_id>.md`，提交信息 `ops: report queue <q_run_id>`；推送失败则通知一次，下一圈先重试
7. 通知 `[Collie] 队列 <q_run_id> 结束：<reason>，退出码 <n>。到对话里说「看」`
8. 把基准提交记为 handledBase

CLI 接线：`collie follow [--once] [--dry-run] [--interval <secs>] [--timeout <secs>]` 已加入 `cli.ts`。
`.collie/follow.json` 加入了 `.gitignore` 和 `collie init` 的 `GITIGNORE_ENTRIES`。

### 条目 3：测试与不变量
`test/follow.test.ts` 共 10 个测试用例，全部使用 `Sandbox.create`：
1. 开跑 → 依次起 preflight、run、report，仓库里出现汇报文件与 ops: 提交且已推送、发了通知、handledBase 已记
2. 同一个基准提交第二圈不再跑
3. preflight 没过 → 只通知一次、下一圈重试
4. 等所有者裁定只通知一次
5. 收工通知后退出
6. 格式错只通知一次
7. 基准提交不是 HEAD 的祖先不跑
8. --dry-run 什么副作用都没有
9. report 失败时有最小汇报
10. CLI --help 显示 dry-run

子进程用 `createArgSpawn`（基于参数关键词匹配的假函数）注入；时钟和睡眠用假实现（`createFakeClock`），无真实定时器。
`test/invariants.test.ts` 加了「`src/follow.ts` 存在且用了 `handoff.ts`」。

## 测试结果

```
npm run lint   → exit 0（ESLint + Prettier 零问题）
npm run typecheck → exit 0
npm test       → 56 test files, 1059 tests passed, 0 failed
npm test -- test/follow.test.ts → 10 tests passed
```

全部验收命令均通过（见上方自检）。

## 偏离或疑问

无。

## 下一步建议

1. SPEC 14.6 验证阶段：用固定版本 `60e9017` 由操作员手工跑本批次四个条目的队列，然后实际试运行 `collie follow` 接管一次队列。
2. 并发保护（SPEC 14.7 明确不做）：如果有两个 `collie follow` 同时运行，状态文件可能冲突。当前阶段暂不处理。

```json
{
  "schema_version": 1,
  "batch_id": "v045-b04",
  "head_sha": "b46efc808a63c46ade62d0b80826e846cf17772c",
  "claims": {
    "commits": ["b46efc808a63c46ade62d0b80826e846cf17772c"],
    "tests_passed": 1059,
    "tests_failed": 0,
    "pushed": true,
    "new_deps": [],
    "spec_touched": false
  },
  "open_questions": []
}
```
