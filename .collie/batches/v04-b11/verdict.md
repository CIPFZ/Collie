All evidence collected. Let me compile the final verdict.

# 批次 v04-b11 审核

## 取证过程

### 1. 提交事实

```
git log --format="%H %s" 9f6d593..049854d
```

输出：
```
049854da9e872dce3ef52d5239fe5b87be5dd5d6 git: pass GIT_OPTIONAL_LOCKS=0 to all git subprocesses (SPEC 13.15)
351a99694185636312e6fcc0be9cccdafbb1f453 docs: issue v04-b11 task envelope
```

两个提交，均可用 `git rev-parse` 解析。

### 2. 远端推送

```
git branch -r --contains 049854da9e872dce3ef52d5239fe5b87be5dd5d6
```

输出：
```
  origin/HEAD -> origin/main
  origin/main
```

head_sha 已在 origin/main 上。

### 3. 受保护路径

```
git diff --stat 9f6d593..049854d -- SPEC.md CONSTRAINTS.md ROADMAP.md ROLES.md 'AGENT-*.md' docs/backlog.md docs/decisions docs/progress.md .collie/collie.toml
```

输出为空。**零行变更。**

### 4. 依赖变化

```
git diff 9f6d593..049854d -- package.json package-lock.json
```

输出为空。**无依赖变更。**

### 5. Diff 范围

变更文件（`git diff --stat`）：
```
 .collie/batches/v04-b11/task.md | 48 +++
 src/git.ts                      |  6 +-
 test/git.test.ts                | 18 +++
 test/invariants.test.ts         | 21 +++
```

全部落在 task.md 的三个条目范围内：`src/git.ts`（条目 1）、`test/git.test.ts`（条目 2）、`test/invariants.test.ts`（条目 3）。task.md 是任务信封，属于正常产出。无范围蔓延。

### 6. 验收命令实跑

**命令 1：`npm run lint`**
```
> collie@0.1.0 lint
> eslint . && prettier --check .
Checking formatting...
All matched files use Prettier code style!
```
退出码：0 ✅

**命令 2：`npm run typecheck`**
```
> collie@0.1.0 typecheck
> tsc -p tsconfig.json
```
退出码：0 ✅

**命令 3：`npm test`**
```
 Test Files  48 passed (48)
      Tests  926 passed (926)
   Duration  14.41s
```
退出码：0 ✅

**命令 4：`grep -vE "^\s*(//|\*|/\*)" src/git.ts | grep -qE "GIT_OPTIONAL_LOCKS"`**
退出码：0 ✅

**命令 5：`grep -qE "GIT_OPTIONAL_LOCKS" test/git.test.ts && npm test -- test/git.test.ts`**
```
 Test Files  1 passed (1)
      Tests  21 passed (21)
   Duration  1.24s
```
退出码：0 ✅

**命令 6：`grep -qE "GIT_OPTIONAL_LOCKS" test/invariants.test.ts`**
退出码：0 ✅

### 7. 测试实跑（行为验证）

**`npx vitest run test/git.test.ts`**
```
 Test Files  1 passed (1)
      Tests  21 passed (21)
```
退出码：0 — 包括新增的 2 个 GIT_OPTIONAL_LOCKS 测试。

**`npx vitest run test/invariants.test.ts`**
```
 Test Files  1 passed (1)
      Tests  49 passed (49)
```
退出码：0 — 包括新增的 2 个不变量测试。

## 逐条验收

| 验收项 | 命令 | 实测结果 | 通过 |
|---|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0, 无错误 | ✅ |
| 类型检查零错误 | `npm run typecheck` | exit 0, 无错误 | ✅ |
| 全部测试通过 | `npm test` | exit 0, 48 files / 926 tests passed | ✅ |
| 环境变量进代码（不看注释行） | `grep -vE …` | exit 0 | ✅ |
| 有测试断言子进程拿到它 | `grep … && npm test -- test/git.test.ts` | exit 0, 21 tests passed | ✅ |
| 不变量同步 | `grep -qE "GIT_OPTIONAL_LOCKS" test/invariants.test.ts` | exit 0 | ✅ |

## 条目要求与额外禁止

### 条目要求

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| `git()` 拉起子进程时环境带 `GIT_OPTIONAL_LOCKS=0` | 条目 1 | `src/git.ts:31` — `env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' }` | ✅ |
| 其余环境变量照常继承 | 条目 1 | `src/git.ts:31` — `...process.env` 展开后添加新键；`npx vitest run test/git.test.ts` → `Tests 21 passed`（其中 `preserves existing env vars` 用例通过） | ✅ |
| 不改任何调用方 | 条目 1 | diff 只改 `src/git.ts`（+5/-1），无其他 `src/` 文件变更 | ✅ |
| 不改取指纹的算法 | 条目 1 | diff 仅在 spawn 选项中添加 `env`，无指纹逻辑改动；grep `spawn('git'` 在 `src/` 下只匹配 `src/git.ts:28` | ✅ |
| 测试：通过 git 别名打印 env var，断言输出 `0` | 条目 2 | `test/git.test.ts:270` — `-c alias.optlocks=!printenv GIT_OPTIONAL_LOCKS`；`:271` — `expect(out.trim()).toBe('0')`；`npx vitest run test/git.test.ts` → `Tests 21 passed` | ✅ |
| 测试：已有变量（如 `GIT_CONFIG_GLOBAL`）在子进程仍可见 | 条目 2 | `test/git.test.ts:278` — `alias.cfgglob=!printenv GIT_CONFIG_GLOBAL`；`:279` — `expect(out.trim()).toBe(process.env.GIT_CONFIG_GLOBAL)`；`npx vitest run test/git.test.ts` → `Tests 21 passed` | ✅ |
| 不变量：`src/git.ts` 含 `GIT_OPTIONAL_LOCKS` | 条目 3 | `test/invariants.test.ts:352-355`；`npx vitest run test/invariants.test.ts` → `Tests 49 passed` | ✅ |
| 不变量：`src/` 下除 `src/git.ts` 外无直接 `spawn('git'` | 条目 3 | `test/invariants.test.ts:357-371`；`npx vitest run test/invariants.test.ts` → `Tests 49 passed` | ✅ |

### 额外禁止

| 禁止项 | 出处 | 证据 | 满足 |
|---|---|---|---|
| 改动任何受保护路径 | task.md 额外禁止 | `git diff --stat … -- <protected>` 输出为空，0 行变更 | ✅ |
| 为了让测试过而删除或跳过任何测试 | task.md 额外禁止 | diff 中无 `skip`/`todo`/删除测试行；926 tests 全部 passed | ✅ |
| 为了让验收命令通过而改注释或字面 | task.md 额外禁止 | diff 只在 `src/git.ts` 的 spawn 选项块添加 `env` 行，无注释变更 | ✅ |
| 改动活性检测的判定、阈值与取指纹的算法 | task.md 额外禁止 | diff 不涉及活性/指纹代码，仅在 spawn 加 env | ✅ |
| 改动规则 1~10 | task.md 额外禁止 | diff 不涉及 `arbiter.ts`、`gate.ts`、`run.ts` | ✅ |
| 新增依赖 | task.md 额外禁止 | `package.json` 与 lock 文件 diff 为空 | ✅ |

## 声称与实测的差异

无。

## 结论与理由

所有 6 条验收命令实跑通过。3 个条目的所有具体要求（结构与行为）均已满足，并有测试实跑证据。无受保护文件变更，无依赖变更，diff 范围完全落在条目之内，无范围蔓延。额外禁止逐条核对均满足。提交存在且已推送至 origin/main。

结论：**PASS**。

```json
{
  "schema_version": 1,
  "batch_id": "v04-b11",
  "verdict": "PASS",
  "evidence": {
    "commits_actual": [
      "351a99694185636312e6fcc0be9cccdafbb1f453",
      "049854da9e872dce3ef52d5239fe5b87be5dd5d6"
    ],
    "verify_results": [
      { "cmd": "npm run lint", "exit_code": 0, "summary": "eslint + prettier pass, no errors" },
      { "cmd": "npm run typecheck", "exit_code": 0, "summary": "tsc pass, no errors" },
      { "cmd": "npm test", "exit_code": 0, "summary": "48 files, 926 tests passed" },
      { "cmd": "grep -vE \"^\\s*(//|\\*|/\\*)\" src/git.ts | grep -qE \"GIT_OPTIONAL_LOCKS\"", "exit_code": 0, "summary": "GIT_OPTIONAL_LOCKS found in non-comment code" },
      { "cmd": "grep -qE \"GIT_OPTIONAL_LOCKS\" test/git.test.ts && npm test -- test/git.test.ts", "exit_code": 0, "summary": "grep match + 21 tests passed" },
      { "cmd": "grep -qE \"GIT_OPTIONAL_LOCKS\" test/invariants.test.ts", "exit_code": 0, "summary": "GIT_OPTIONAL_LOCKS found in invariants" }
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
  "reason": "All 6 acceptance commands pass. Implementation adds GIT_OPTIONAL_LOCKS=0 to git subprocess env in the single spawn point (src/git.ts:31), inheriting all other env vars via ...process.env. Two new test cases verify the env var reaches subprocesses and existing vars are preserved. Two new invariant tests enforce GIT_OPTIONAL_LOCKS presence and spawn('git' exclusivity. No protected files modified, no dependencies added, no scope creep. CI 以 R2 取证为准。"
}
```
