Good, `e54af6e` is an ancestor of `origin/main`, so it has been pushed.

Now I have all evidence. Let me compile the final verdict.

# 批次 v04-b06 审核

## 取证过程

### 1. 提交事实
```
git log --oneline 737296dbe13f8da651876db03960767f179a1257..e54af6e
e54af6e test: scenario M — token file startup, evidence_unavailable, smoke CI check (SPEC 13.9)
01f4fc6 cli: token file startup check, smoke CI query, evidence_unavailable cause (SPEC 13.9)
86d48eb docs: issue v04-b06 task envelope
```

3 个提交，完整 SHA：
- `e54af6ec2c31b968b5ca096d600636feb1d66c20`
- `01f4fc6e7fde8be1d4e2bd3576bb002b88e93e87`
- `86d48eb2f999e5006702e984e60a2a3d0bc55816`

`e54af6e` 是 `origin/main`（`3dbd3955ea4...`）的祖先，已推送。

### 2. 受保护文件
```
git diff --stat 737296d..e54af6e -- SPEC.md CONSTRAINTS.md ROADMAP.md ROLES.md 'AGENT-*.md' docs/backlog.md docs/decisions docs/progress.md .collie/collie.toml
```
输出为空——无受保护文件被修改。`spec_diff_lines = 0`。

### 3. 依赖变化
```
git diff 737296d..e54af6e -- package.json package-lock.json
```
输出为空——无依赖变更。

### 4. 验收命令逐条实跑

| # | 说明 | 命令 | 退出码 | 输出摘要 |
|---|---|---|---|---|
| 1 | 代码规范零错误 | `npm run lint` | 0 | All matched files use Prettier code style! |
| 2 | 类型检查零错误 | `npm run typecheck` | 0 | tsc 无输出 |
| 3 | 全部测试通过 | `npm test` | 0 | 44 passed (44), 882 passed (882) |
| 4 | 场景 M 通过 | `npm test -- test/scenario-m.test.ts` | 0 | 1 passed (1), 6 passed (6) |
| 5 | 场景 M 不依赖真实 home | `HOME=$(mktemp -d) npm test -- test/scenario-m.test.ts` | 0 | 1 passed (1), 6 passed (6) |
| 6 | 场景 M 不少于 6 个用例 | `grep -cE "^\s+it\(" test/scenario-m.test.ts \| grep -qE "^([6-9]\|[1-9][0-9])$"` | 0 | 计数为 6 |
| 7 | 原因码进代码与测试 | `grep -vE "^\s*(//\|\*\|/\*)" src/run.ts \| grep -qE "evidence_unavailable" && grep -qE "evidence_unavailable" test/scenario-m.test.ts` | 0 | 两处均匹配 |
| 8 | token 文件缺失时 smoke 报错 | `HOME=$(mktemp -d) npx tsx src/cli.ts smoke --runner fake 2>&1 \| grep -qE "token_file"` | 0 | 匹配 |
| 9 | 不变量同步 | `grep -qE "evidence_unavailable" test/invariants.test.ts` | 0 | 匹配 |

全部 9 条验收命令退出码均为 0，**全部通过**。

## 逐条验收

| 验收项 | 命令 | 实测结果 | 通过 |
|---|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 | ✅ |
| 类型检查零错误 | `npm run typecheck` | exit 0 | ✅ |
| 全部测试通过 | `npm test` | exit 0, 44 files 882 tests | ✅ |
| 场景 M 通过 | `npm test -- test/scenario-m.test.ts` | exit 0, 6 tests passed | ✅ |
| 场景 M 不依赖真实 home | `HOME=$(mktemp -d) npm test -- test/scenario-m.test.ts` | exit 0, 6 tests passed | ✅ |
| 场景 M ≥ 6 用例 | `grep -cE` | 计数=6, exit 0 | ✅ |
| 原因码进代码与测试 | `grep` 两处 | exit 0 | ✅ |
| smoke 报错含 token_file | `npx tsx src/cli.ts smoke` | exit 0 (grep 匹配) | ✅ |
| 不变量同步 | `grep` invariants | exit 0 | ✅ |

## 条目要求与额外禁止

### 条目 1: token 文件（SPEC 13.9）

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| 读 token 的代码收成一处 | task 条目 1 | `src/run.ts:801` 导出 `readCiTokenChecked`；`src/run.ts:825` 的 `readCiToken` 委托给它；`src/evidence.ts` 不再含 `readFileSync`/`homedir` 导入（删除了三行导入，Grep 确认无匹配） | ✅ |
| 配了 token_file 但不存在/读不了/为空时，run 退出码 1 | task 条目 1 | `src/cli.ts:164`（单批次）和 `src/cli.ts:224`（--continue）在签发 task 之前调用 `readCiTokenChecked`，catch 后 return `EXIT_CODES.ERROR`（=1） | ✅ |
| stderr 含 `ci.token_file`、展开路径与原因 | task 条目 1 | `src/run.ts:812` throw message `ci.token_file ${tokenPath}: ${reason}`；`src/run.ts:816` 空文件 throw `ci.token_file ${tokenPath}: file is empty` | ✅ |
| 在签发 task 之前退出 | task 条目 1 | `src/cli.ts:163-168`（run）在 `runBatch` 调用之前；`src/cli.ts:223-228`（runContinue）在 `runQueue` 之前 | ✅ |
| 测试不依赖真实 home | task 条目 1 | `test/support/sandbox.ts:118-120` 移除 `token_file`；`HOME=$(mktemp -d) npm test -- test/scenario-m.test.ts` exit 0 | ✅ |
| token 文件缺失时 run exits 1, no task issued | task 条目 1（行为要求） | `npx vitest run test/scenario-m.test.ts` → Tests 6 passed；场景 M test 1 (line 169-182) 验证 code=1 且 `box.events()` 长度为 0 | ✅ |

### 条目 2: `collie smoke`（SPEC 13.9）

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| 先查 token 文件再调 runner | task 条目 2 | `src/cli.ts:419-434`：先 `loadConfig` 再 `readCiTokenChecked`，然后才进入 `runner.run()` try 块 | ✅ |
| runner 通过后用 token 查 CI | task 条目 2 | `src/cli.ts:451-472`：runner 成功后 `queryCi({...token: ciToken}, deps.fetch)` | ✅ |
| 请求失败退出码 1 并打印原因 | task 条目 2 | `src/cli.ts:465-470`：catch → `deps.err(...)` + `return EXIT_CODES.ERROR` | ✅ |
| 成功打印 `ci ok` | task 条目 2 | `src/cli.ts:464`：`deps.out('ci ok\n')` | ✅ |
| 报错/事件/输出不含 token 内容 | task 条目 2 | `src/cli.ts:467-468` 只打印 error.message；测试 `test/scenario-m.test.ts:387` 验证 `ghp_test123` 不出现 | ✅ |
| smoke CI 查询失败（行为要求） | task 条目 2 | `npx vitest run test/scenario-m.test.ts` → Tests 6 passed；test 6 (line 364-388) 验证 runner 成功后 CI 查询失败 exit 1、输出含 `smoke ci check failed`、不含 token | ✅ |

### 条目 3: 证据取不到（SPEC 13.9）

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| 规则 9 触发且属于三种情况时，verdict.downgraded 加 cause + detail | task 条目 3 | `src/run.ts:1640-1676`：检查 `remoteError`、`ci.error`、`ciWait.lastState === 'rate_limited'`，若 details 非空则加 `cause: 'evidence_unavailable'` 和 `detail` | ✅ |
| --continue 不重跑、不计 fix_max、不改 backlog 状态 | task 条目 3 | `src/run.ts:2146-2166`：`evidenceUnavailableCause !== undefined` 时直接 return，不调 `updateBacklogToDisk`，不 increment `fixCounts` | ✅ |
| 记 escalated 与 queue.finished（reason 都是 evidence_unavailable） | task 条目 3 | `src/run.ts:2149-2158`：两个 `queueRec.record` 调用，reason 均为 `'evidence_unavailable'` | ✅ |
| 退出码 20 | task 条目 3 | `src/run.ts:2161`：`exitCode: EXIT_CODES.BLOCK`；`EXIT_CODES.BLOCK = 20` | ✅ |
| scenario-m.test.ts：token 缺失启动失败无 task | task 条目 3 | test 1 (line 169-182)：`code=1`、`events().length=0`；`npx vitest run test/scenario-m.test.ts` → 6 passed | ✅ |
| scenario-m.test.ts：限流时单批次 FIX 带 cause | task 条目 3 | test 2 (line 200-214)：`code=10`、output 含 `evidence_unavailable`、downgraded event 有 `cause`；6 tests passed | ✅ |
| scenario-m.test.ts：--continue 只跑一次就停、backlog pending、exit 20 | task 条目 3 | test 3 (line 235-265)：`code=20`、backlog 无 `blocked`、escalated/queue.finished 有 `evidence_unavailable`；6 tests passed | ✅ |
| scenario-m.test.ts：对照组 CI failure 按普通 FIX 重跑 | task 条目 3 | test 4 (line 284-318)：`code=20`（fix_max）、downgraded 无 cause、queue.finished reason=`fix_max`；6 tests passed | ✅ |
| scenario-m.test.ts：smoke 两种失败 | task 条目 3 | test 5 (line 336-347) token 缺失 exit 1；test 6 (line 364-388) CI 查询失败 exit 1；6 tests passed | ✅ |
| invariants.test.ts 加 evidence_unavailable | task 条目 3 | `test/invariants.test.ts:303-307`：新增测试断言 `src/run.ts` 含 `evidence_unavailable` | ✅ |

### 额外禁止

| 禁止项 | 出处 | 证据 | 满足 |
|---|---|---|---|
| 不改受保护路径 | task | `git diff --stat` 输出空 | ✅ |
| 不删除/跳过测试 | task | 全量测试 882 passed，无 `.skip` 或 `.only` 添加 | ✅ |
| 不改注释/字面凑通过 | task（铁律 26） | 验收命令全部验证的是代码/测试中的真实逻辑内容 | ✅ |
| 不改规则 1-10 判定 | task | `src/arbiter.ts:272` 规则 9 仍输出 FIX，arbiter 无 diff | ✅ |
| 不让报错/事件/输出含 token 内容 | task | `src/cli.ts:467` 只打印 error.message；`src/run.ts:1335` redact 包含 token；test line 387 验证不泄露 | ✅ |
| 不新增依赖 | task | package.json 无 diff | ✅ |

## 声称与实测的差异

无。

## 结论与理由

全部 9 条验收命令实跑通过（退出码均为 0）。三个条目的结构要求和行为要求均已核对，附具体文件:行号和测试实跑结果。无受保护文件变更，无依赖变更，无规则判定被修改。token 读取已收成一处，startup 检查在 task 签发前执行，smoke 先查 token 再调 runner、再查 CI，evidence_unavailable 的 cause/detail 在 queue 中正确处理（不重跑、不计 fix_max、不改 backlog），测试不依赖真实 home 目录。范围落在 task.md 条目之内，无蔓延。

结论：**PASS**。

```json
{
  "schema_version": 1,
  "batch_id": "v04-b06",
  "verdict": "PASS",
  "evidence": {
    "commits_actual": [
      "e54af6ec2c31b968b5ca096d600636feb1d66c20",
      "01f4fc6e7fde8be1d4e2bd3576bb002b88e93e87",
      "86d48eb2f999e5006702e984e60a2a3d0bc55816"
    ],
    "verify_results": [
      { "cmd": "npm run lint", "exit_code": 0, "summary": "eslint + prettier pass" },
      { "cmd": "npm run typecheck", "exit_code": 0, "summary": "tsc pass" },
      { "cmd": "npm test", "exit_code": 0, "summary": "44 files, 882 tests passed" },
      { "cmd": "npm test -- test/scenario-m.test.ts", "exit_code": 0, "summary": "1 file, 6 tests passed" },
      { "cmd": "HOME=$(mktemp -d) npm test -- test/scenario-m.test.ts", "exit_code": 0, "summary": "1 file, 6 tests passed with fake HOME" },
      { "cmd": "grep -cE scenario-m it count", "exit_code": 0, "summary": "6 test cases found" },
      { "cmd": "grep evidence_unavailable in src/run.ts and test/scenario-m.test.ts", "exit_code": 0, "summary": "both files contain evidence_unavailable" },
      { "cmd": "HOME=$(mktemp -d) npx tsx src/cli.ts smoke --runner fake", "exit_code": 0, "summary": "stderr contains token_file" },
      { "cmd": "grep evidence_unavailable in test/invariants.test.ts", "exit_code": 0, "summary": "invariants test contains evidence_unavailable" }
    ],
    "remote_has_head": true,
    "ci_conclusion": "unknown",
    "ci_run_url": "",
    "ci_branch_matched": null,
    "deps_diff": [],
    "spec_diff_lines": 0
  },
  "claim_mismatches": [],
  "gaps": [],
  "reason": "All 9 acceptance commands pass. Token file reading consolidated into readCiTokenChecked in run.ts. Startup checks in cli.ts run/runContinue/smoke all precede task issuance. evidence_unavailable cause correctly added to verdict.downgraded when rule 9 fires for environment faults. Queue stops without rerun/fix_max/backlog change, exits 20. Smoke checks token then runner then CI. Token content never leaks. 6 scenario-m tests cover all required cases and pass with fake HOME. No protected files, no dependency changes, no rule modifications. CI 以 R2 取证为准。"
}
```
