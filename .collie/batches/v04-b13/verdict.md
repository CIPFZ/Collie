Good. The `buildTask` function passes `ctx` to `renderInterruptSection`, and `renderInterruptSection` checks `ctx.blockConclusion` first. The `blockConclusion` is properly propagated from `batchHistory` → `runBatch` → `buildTask` → `renderInterruptSection`.

Now I have all the evidence I need. Let me compile the verdict.

# 批次 v04-b13 审核

## 取证过程

### 1. 提交确认

```
git log --format='%H' 84cfd9a3..28916e45
```
实测输出：
```
28916e4564a2e985faaea1c3ced4f73deb9ce472
2e5ab8947245ab7a9b9586d61b42a49794fbcab3
2fa50b66225c6e2a63529b7663d4efb44bb1013a
```
共 3 个提交。

### 2. 远端确认

```
git branch -r --contains 28916e4564a2e985faaea1c3ced4f73deb9ce472
```
实测输出：`origin/main` — 已推送。

### 3. 受保护文件检查

```
git diff --stat 84cfd9a3..28916e45 -- SPEC.md CONSTRAINTS.md ROADMAP.md ROLES.md 'AGENT-*.md' docs/backlog.md docs/decisions docs/progress.md .collie/collie.toml
```
实测输出：（空），无受保护文件被修改。`spec_diff_lines = 0`。

### 4. 依赖变化检查

```
git diff 84cfd9a3..28916e45 -- package.json package-lock.json
```
实测输出：（空），无依赖变化。

### 5. 验收命令实跑

逐条记录如下。

### 6. 行为测试实跑

- `npx vitest run test/report-sha.test.ts` → Tests 7 passed
- `npx vitest run test/scenario-e.test.ts` → Tests 17 passed
- `npx vitest run test/cli.test.ts` → Tests 20 passed
- `npx vitest run test/invariants.test.ts` → Tests 51 passed

## 逐条验收

| 验收项 | 命令 | 实测结果 | 通过 |
|---|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0，无错误输出 | ✅ |
| 类型检查零错误 | `npm run typecheck` | exit 0，无错误输出 | ✅ |
| 全部测试通过 | `npm test` | exit 0，49 文件 946 测试全部通过 | ✅ |
| sha 校验专项测试通过 | `npm test -- test/report-sha.test.ts` | exit 0，7 测试通过 | ✅ |
| 专项测试不少于 6 个 | `grep -cE "^\s+it\(" test/report-sha.test.ts \| grep -qE "^([6-9]\|[1-9][0-9])$"` | exit 0（计数为 7） | ✅ |
| 新的上报原因进代码与测试 | `grep -vE ... src/run.ts \| grep -qE "does not resolve to a commit" && grep -qE "does not resolve to a commit" test/report-sha.test.ts` | exit 0 | ✅ |
| 祖先判断报错不再被吞 | `! grep -vE ... src/run.ts \| grep -qE "isAncestor\(.*\)\.catch\(\(\) => false\)"` | exit 0（无匹配） | ✅ |
| 重跑说明进 task 生成与测试 | `grep -rqE "上一轮结论" src && grep -qE "上一轮结论" test/report-sha.test.ts` | exit 0 | ✅ |
| 单批次 run_id 不带连字符 | `npx tsx -e "import('./src/cli.ts')..."` | exit 0 | ✅ |
| 不变量同步 | `grep -qE "does not resolve to a commit" test/invariants.test.ts` | exit 0 | ✅ |

## 条目要求与额外禁止

### 条目 1：sha 校验分三步报

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| 先解析 head_sha，解析不了报 "does not resolve to a commit" | task.md 条目 1 | `src/run.ts:1530-1538`：Step 1 用 `revParse` 解析 head_sha，catch 后 escalate `does not resolve to a commit` | ✅ |
| 再解析 claims.commits 每一项 | task.md 条目 1 | `src/run.ts:1539-1550`：循环 `report.claims.commits`，逐个 `revParse`，失败报 `commits[i] ... does not resolve to a commit` | ✅ |
| 再分别报「不是 base 的后代」 | task.md 条目 1 | `src/run.ts:1552-1567`：Step 2 用 `isAncestor(root, baseSha, report.head_sha)`，失败报 `is not a descendant of base_sha` | ✅ |
| 再分别报「不是 HEAD 的祖先」 | task.md 条目 1 | `src/run.ts:1569-1586`：Step 3 用 `isAncestor(root, report.head_sha, currentHead)`，失败报 `is not an ancestor of HEAD` | ✅ |
| git 命令失败不得被 `.catch(() => false)` 吞掉 | task.md 条目 1 | `src/run.ts` 全文无 `isAncestor(...).catch(() => false)` (grep 验证为空); Step 2 和 Step 3 都用 try/catch 并 escalate `git error checking ancestry: <原文>` (`src/run.ts:1556-1560`, `src/run.ts:1576-1580`) | ✅ |
| 行为验证：不存在 sha → exit 20 + 原因含 "does not resolve" | task.md 条目 3 测试要求 | `npx vitest run test/report-sha.test.ts` → Tests 7 passed（含 "non-existent 40-char head_sha" 和 "non-existent commits[i] sha" 两个测试） | ✅ |
| 行为验证：sha 存在但不是 base 后代 → escalation | task.md 条目 3 测试要求 | `npx vitest run test/report-sha.test.ts` → Tests 7 passed（含 "head_sha exists but is not a descendant of base_sha" 测试） | ✅ |

### 条目 2：BLOCK 后的重跑

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| 上一轮是 BLOCK 且不是信号阶梯，结束原因写 `escalated` 或 `blocked` | task.md 条目 2 | `src/run.ts:805-807`：`finished?.verdict === 'BLOCK' && !isSignalLadderStop` 时 `effectiveStopReason = escalatedEvt !== undefined ? 'escalated' : 'blocked'` | ✅ |
| 「上一轮中断」一节加一行「上一轮结论：」并写原因原文 | task.md 条目 2 | `src/roles/worker.ts:140-144`：`if (ctx.blockConclusion !== undefined)` 分支写 `上一轮结论：${ctx.blockConclusion}` | ✅ |
| 不写「请从 `git log` 核实」那一句 | task.md 条目 2 | `src/roles/worker.ts:140-144`：BLOCK 分支不含 "请从"；"请从" 只在 else 分支 (line 152) 用于真正的中断 | ✅ |
| 真正的中断写法不变 | task.md 条目 2 | `src/roles/worker.ts:145-153`：`else if (ctx.rescue_sha)` 和 `else` 分支保持不变 | ✅ |
| 行为验证：BLOCK rerun task 含 "上一轮结论" 和原因文本、不含 "请从" | task.md 条目 3 测试要求 | `npx vitest run test/report-sha.test.ts` → Tests 7 passed（含 "BLOCK rerun task contains '上一轮结论：'" 和 "BLOCK rerun task interrupted_at contains 'escalated'" 测试） | ✅ |
| 行为验证：信号阶梯中断保持旧写法（对照） | task.md 条目 3 测试要求 | `npx vitest run test/report-sha.test.ts` → Tests 7 passed（含 "signal-ladder-killed run keeps the old interrupt section (control)" 测试） | ✅ |

### 条目 3：单批次 run_id

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| `runIdAt` 改为 `r-YYYYMMDDHHMMSS` | task.md 条目 3 | `src/cli.ts:88`：模板为 `` `r-${t.y}${t.mo}${t.d}${t.h}${t.mi}${t.s}` ``，去掉了日期与时间之间的 `-` | ✅ |
| 函数名与导出不变 | task.md 条目 3 | `src/cli.ts:84`：仍是 `export function runIdAt(date: Date): string` | ✅ |
| 现有测试里的字面同步 | task.md 条目 3 | `test/cli.test.ts:31`：改为 `'r-20261019114606'`；`test/cli.test.ts:110`：改为 `r-20261019120000`；`test/cli.test.ts:175`：改为 `r-20261019120000` | ✅ |
| 行为验证：runIdAt 格式正确 | task.md 条目 3 测试要求 | `npx vitest run test/report-sha.test.ts` → Tests 7 passed（含 "runIdAt produces r-YYYYMMDDHHMMSS without dash between date and time" 测试） | ✅ |
| `test/invariants.test.ts` 加 `src/run.ts` 含 `does not resolve to a commit` | task.md 条目 3 | `test/invariants.test.ts:382-384`：新增测试 `'src/run.ts contains "does not resolve to a commit" (v04-b13)'` | ✅ |

### 额外禁止

| 要求 | 出处 | 证据 | 满足 |
|---|---|---|---|
| 不改动任何受保护路径 | 额外禁止 | `git diff --stat` 对受保护路径输出为空 | ✅ |
| 不为了让测试过而删除或跳过测试 | 额外禁止 | diff 中 `test/cli.test.ts` 和 `test/scenario-e.test.ts` 的变更仅为字面格式同步和 SPEC 13.17 语义调整，无删除或 skip | ✅ |
| 不为了让验收命令通过而改注释或字面 | 额外禁止（铁律 26） | 变更均为功能性代码改动，非注释修改 | ✅ |
| 不改动规则 1~10 判定与上报结论 | 额外禁止 | sha 校验失败仍调用 `escalate()` → BLOCK；判定逻辑与阈值未动 | ✅ |
| 无新增依赖 | 额外禁止 | `package.json` 和 `package-lock.json` diff 为空 | ✅ |

## 声称与实测的差异

无。

## 结论与理由

全部 10 条验收命令实跑通过（exit 0）。三个条目的所有结构要求和行为要求均已验证：

1. sha 校验的三步分拆（resolve → descendant → ancestor）实现正确，`isAncestor().catch(() => false)` 已消除，git 错误正确传播。
2. BLOCK 后的重跑正确区分信号阶梯中断与 BLOCK 结论，task 正文写入"上一轮结论："和原因原文，不含"请从"；信号阶梯中断的写法未变（对照测试通过）。
3. `runIdAt` 输出格式为 `r-YYYYMMDDHHMMSS`（16 字符，无内部连字符），现有测试字面已同步。

受保护文件未被改动，无新增依赖，diff 范围在条目之内，提交已推送至远端。

```json
{
  "schema_version": 1,
  "batch_id": "v04-b13",
  "verdict": "PASS",
  "evidence": {
    "commits_actual": [
      "2fa50b66225c6e2a63529b7663d4efb44bb1013a",
      "2e5ab8947245ab7a9b9586d61b42a49794fbcab3",
      "28916e4564a2e985faaea1c3ced4f73deb9ce472"
    ],
    "verify_results": [
      { "cmd": "npm run lint", "exit_code": 0, "summary": "eslint + prettier pass" },
      { "cmd": "npm run typecheck", "exit_code": 0, "summary": "tsc pass" },
      { "cmd": "npm test", "exit_code": 0, "summary": "49 files, 946 tests passed" },
      { "cmd": "npm test -- test/report-sha.test.ts", "exit_code": 0, "summary": "7 tests passed" },
      { "cmd": "grep -cE \"^\\s+it\\(\" test/report-sha.test.ts | grep -qE \"^([6-9]|[1-9][0-9])$\"", "exit_code": 0, "summary": "7 it() blocks found" },
      { "cmd": "grep -vE ... src/run.ts | grep -qE \"does not resolve to a commit\" && grep -qE \"does not resolve to a commit\" test/report-sha.test.ts", "exit_code": 0, "summary": "string found in both files" },
      { "cmd": "! grep -vE ... src/run.ts | grep -qE \"isAncestor\\(.*\\)\\.catch\\(\\(\\) => false\\)\"", "exit_code": 0, "summary": "no .catch(() => false) on isAncestor" },
      { "cmd": "grep -rqE \"上一轮结论\" src && grep -qE \"上一轮结论\" test/report-sha.test.ts", "exit_code": 0, "summary": "string found in src and test" },
      { "cmd": "npx tsx -e \"import('./src/cli.ts')...\"", "exit_code": 0, "summary": "runIdAt 16 chars, no dash after prefix" },
      { "cmd": "grep -qE \"does not resolve to a commit\" test/invariants.test.ts", "exit_code": 0, "summary": "invariant test present" }
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
  "reason": "All 10 acceptance commands pass. Three-step sha validation, BLOCK rerun conclusion, and runIdAt format change all implemented correctly with 7 dedicated tests and existing test updates. No protected files modified, no new dependencies. CI 以 R2 取证为准。"
}
```
