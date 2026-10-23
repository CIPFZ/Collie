Here is the complete verdict:

---

# 批次 v02-b05-fix 审核

## 取证过程

### 1. 提交事实

```
$ git log --oneline b83347faea35..34134d0d3b1c
34134d0 arbiter: rule 9 evidence-missing, onPid callback, CI wording fix (v02-b05-fix)
```

单个提交，SHA：`34134d0d3b1c5b17e96ab1f47b5779533c38aac1`

```
$ git rev-parse 34134d0d3b1c5b17e96ab1f47b5779533c38aac1
34134d0d3b1c5b17e96ab1f47b5779533c38aac1
```

提交存在。

### 2. 远端推送

```
$ git branch -r --contains 34134d0d3b1c5b17e96ab1f47b5779533c38aac1
  origin/HEAD -> origin/main
  origin/main
```

Head SHA 已在 `origin/main` 上（作为 report 提交 `d91e876` 的祖先）。`remote_has_head = true`。

### 3. CI 验证

```
$ gh auth status
You are not logged into any GitHub hosts.
```

无 GitHub 凭据，无法查询 CI。依规则：`ci_conclusion = unknown`，`ci_branch_matched = null`，`ci_run_url = ""`。CI 以 R2 取证为准。

### 4. 受保护文件

```
$ git diff --stat b83347f..34134d0 -- SPEC.md CONSTRAINTS.md ROADMAP.md ROLES.md 'AGENT-*.md' docs/backlog.md docs/decisions docs/progress.md .collie/collie.toml
（空输出）
```

零行改动。`spec_diff_lines = 0`。

### 5. 依赖变化

```
$ git diff b83347f..34134d0 -- package.json package-lock.json
（空输出）
```

无依赖变化。`deps_diff = []`。

### 6. 验收命令实跑

#### 6.1 npm run lint

```
$ npm run lint
> eslint . && prettier --check .
Checking formatting...
All matched files use Prettier code style!
```

退出码 0 ✅

#### 6.2 npm run typecheck

```
$ npm run typecheck
> tsc -p tsconfig.json
```

退出码 0 ✅

#### 6.3 npm test

```
$ npm test
> vitest run

 Test Files  33 passed (33)
      Tests  647 passed (647)
   Duration  9.58s
```

退出码 0 ✅

#### 6.4 规则 9 进 arbiter 与测试

```
$ grep -qE "RULE_DEFAULT = 10" src/arbiter.ts && grep -qE "remote_has_head: false" test/arbiter.test.ts
```

退出码 0 ✅

#### 6.5 onPid 接口存在且 R2 使用

```
$ grep -qE "onPid" src/runner/index.ts && grep -qE "onPid" src/runner/claude.ts && grep -qE "onPid" src/run.ts
```

退出码 0 ✅

#### 6.6 真实顺序有测试

```
$ grep -qE "onPid" test/runner-claude.test.ts
```

退出码 0 ✅

#### 6.7 未推送时 branch_matched 为 null 有测试

```
$ grep -qE "remote_has_head" test/evidence.test.ts && grep -qE "toBeNull" test/evidence.test.ts
```

退出码 0 ✅

#### 6.8 不变量同步

```
$ grep -qE "RULE_DEFAULT" test/invariants.test.ts
```

退出码 0 ✅

## 逐条验收

| 验收项 | 命令 | 实测结果 | 通过 |
|---|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0, eslint + prettier 均通过 | ✅ |
| 类型检查零错误 | `npm run typecheck` | exit 0, tsc 无输出 | ✅ |
| 全部测试通过 | `npm test` | exit 0, 33 文件 647 测试全过 | ✅ |
| 规则 9 进 arbiter 与测试 | `grep -qE "RULE_DEFAULT = 10" src/arbiter.ts && grep -qE "remote_has_head: false" test/arbiter.test.ts` | exit 0 | ✅ |
| onPid 接口存在且 R2 使用 | `grep -qE "onPid" src/runner/index.ts && grep -qE "onPid" src/runner/claude.ts && grep -qE "onPid" src/run.ts` | exit 0 | ✅ |
| 真实顺序有测试 | `grep -qE "onPid" test/runner-claude.test.ts` | exit 0 | ✅ |
| 未推送时 branch_matched 为 null 有测试 | `grep -qE "remote_has_head" test/evidence.test.ts && grep -qE "toBeNull" test/evidence.test.ts` | exit 0 | ✅ |
| 不变量同步 | `grep -qE "RULE_DEFAULT" test/invariants.test.ts` | exit 0 | ✅ |

## 条目要求与额外禁止

### 条目 1：arbiter 规则 9

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| `RULE_EVIDENCE_MISSING = 9` 常量 | 条目 1 | `src/arbiter.ts:65` — `const RULE_EVIDENCE_MISSING = 9;` | ✅ |
| `RULE_DEFAULT = 10` | 条目 1 | `src/arbiter.ts:66` — `const RULE_DEFAULT = 10;` | ✅ |
| PASS 降为 FIX 当 remote_has_head=false 或 ci_conclusion≠success 或 ci_branch_matched≠true | 条目 1 | `src/arbiter.ts:261-272` — 条件检查 `original === 'PASS'` 加三个证据条件，返回 `decide(original, 'FIX', RULE_EVIDENCE_MISSING, ...)` | ✅ |
| 记 verdict.downgraded（rule=9, reason） | 条目 1 | `src/arbiter.ts:111-127` — `decide` 函数设 `downgraded: original !== null && original !== final`，PASS→FIX 时 downgraded=true，rule=9 | ✅ |
| FIX 原判不被改动 | 条目 1 | `src/arbiter.ts:262` — `original === 'PASS'` 条件保证 FIX 不受影响；`test/arbiter.test.ts:373-387` — 测试 FIX 到达 rule 10 | ✅ |
| BLOCK 不被改动 | 条目 1 | `src/arbiter.ts:262` — 同上；`test/arbiter.test.ts:389-402` — 测试 BLOCK 到达 rule 10 | ✅ |
| 三个测试用例（未推送/unknown/branch 不一致） | 条目 1 | `test/arbiter.test.ts:316-370` — 三个 it() 分别断言 rule=9, downgraded=true, final='FIX' | ✅ |
| progress 与 collie show 规则编号文字同步 | 条目 1 | `src/progress.ts:53` — `规则 ${String(decision.rule)}`（动态）；`src/cli.ts:167` — `rule ${String(outcome.decision.rule)}`（动态）。无硬编码编号 | ✅ |
| 不变量测试 | 条目 1 | `test/invariants.test.ts:93-95` — `expect(content).toMatch(/RULE_DEFAULT = 10/)` | ✅ |

### 条目 2：worker_pid 时序

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| runner 选项加 `onPid?: (pid: number) => void` | 条目 2 | `src/runner/index.ts:48-52` — `onPid?: (pid: number) => void;` 带 JSDoc | ✅ |
| spawn 钩子拿到 child.pid 时立刻回调 | 条目 2 | `src/runner/claude.ts:237-240` — `if (child.pid !== undefined) opts.onPid?.(child.pid);` 在 spawn hook 内 | ✅ |
| R2 在回调里 updateHeartbeat({ worker_pid }) | 条目 2 | `src/run.ts:630-633` — `const onPid = (pid: number): void => { updateHeartbeat(root, { worker_pid: pid, ... }); };` | ✅ |
| 不再依赖 onStarted 时读 handle.pid | 条目 2 | `src/run.ts:622-626` — onStarted 不再调用 updateHeartbeat，注释说明 "worker_pid is set by the onPid callback below" | ✅ |
| worker.ts 透传 onPid | 条目 2 | `src/roles/worker.ts:201,216` — 选项定义和透传 | ✅ |
| 真实顺序测试：onStarted 先、onPid 后，断言心跳含 worker_pid | 条目 2 | `test/runner-claude.test.ts:527-568` — `expect(order).toEqual(['onStarted', 'onPid'])`；pid > 0；handle.pid === pidFromCallback | ✅ |

### 条目 3：CI 未取证措辞

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| remote_has_head=false 时 ci_branch_matched 为 null | 条目 3 | `src/evidence.ts:263` — `ci_branch_matched: !remoteHasHead \|\| 'error' in ci ? null : ci.branchMatched` | ✅ |
| remote_has_head=false 时 ci_run_url 为空 | 条目 3 | `src/evidence.ts:262` — `ci_run_url: !remoteHasHead \|\| 'error' in ci ? '' : (ci.runUrl ?? '')` | ✅ |
| progress.ts 对 null 渲染「未能取证」 | 条目 3 | `src/progress.ts:60` — `evidence.ci_branch_matched === null ? '未能取证' : evidence.ci_branch_matched ? '一致' : '不一致'`（pre-existing, 正确） | ✅ |
| progress.ts 对 false 渲染「监听分支不一致」 | 条目 3 | `src/progress.ts:60` — 同上，三元表达式末尾 `'不一致'` | ✅ |
| 测试：未推送 → branch_matched 为 null | 条目 3 | `test/evidence.test.ts:118-126` — 不 push，断言 `ci_branch_matched` toBeNull()，`ci_run_url` toBe('') | ✅ |
| 现有 CI 测试更新为先 push | 条目 3 | `test/evidence.test.ts:196-214` — 新 `pushedHead()` helper；CI branch matching 测试使用它 | ✅ |

## 声称与实测的差异

无。

## 结论与理由

三个条目全部满足：
1. arbiter 规则 9 正确实现——PASS 在 remote_has_head=false / ci_conclusion≠success / ci_branch_matched≠true 时降为 FIX，FIX 和 BLOCK 不受影响，RULE_DEFAULT 升为 10，三个测试用例加不变量测试齐备。
2. onPid 回调机制正确——spawn hook 中立即回调 onPid，R2 在回调中写 heartbeat，不再依赖 onStarted 的 handle.pid，测试验证了 onStarted→onPid 的真实时序。
3. CI 未取证措辞修正——evidence.ts 在未推送时将 ci_branch_matched 置 null、ci_run_url 置空，progress.ts 已有正确的三态渲染逻辑，测试覆盖到位。

无受保护文件修改，无依赖变化，全部 647 测试通过，lint/typecheck 零错误。Diff 范围严格落在三个条目之内，无范围蔓延。

结论：**PASS**。

```json
{
  "schema_version": 1,
  "batch_id": "v02-b05-fix",
  "verdict": "PASS",
  "evidence": {
    "commits_actual": ["34134d0d3b1c5b17e96ab1f47b5779533c38aac1"],
    "verify_results": [
      { "cmd": "npm run lint", "exit_code": 0, "summary": "eslint + prettier 零错误" },
      { "cmd": "npm run typecheck", "exit_code": 0, "summary": "tsc 零错误" },
      { "cmd": "npm test", "exit_code": 0, "summary": "33 文件 647 测试全过" },
      { "cmd": "grep -qE \"RULE_DEFAULT = 10\" src/arbiter.ts && grep -qE \"remote_has_head: false\" test/arbiter.test.ts", "exit_code": 0, "summary": "RULE_DEFAULT=10 和 remote_has_head 测试均存在" },
      { "cmd": "grep -qE \"onPid\" src/runner/index.ts && grep -qE \"onPid\" src/runner/claude.ts && grep -qE \"onPid\" src/run.ts", "exit_code": 0, "summary": "onPid 接口在三个文件中均存在" },
      { "cmd": "grep -qE \"onPid\" test/runner-claude.test.ts", "exit_code": 0, "summary": "onPid 顺序测试存在" },
      { "cmd": "grep -qE \"remote_has_head\" test/evidence.test.ts && grep -qE \"toBeNull\" test/evidence.test.ts", "exit_code": 0, "summary": "未推送时 branch_matched 为 null 的测试存在" },
      { "cmd": "grep -qE \"RULE_DEFAULT\" test/invariants.test.ts", "exit_code": 0, "summary": "不变量测试包含 RULE_DEFAULT" }
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
  "reason": "三个条目全部满足，全部验收命令通过，无受保护文件修改，无依赖变化。CI 以 R2 取证为准。"
}
```
