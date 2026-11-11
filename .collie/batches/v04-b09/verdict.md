This correctly implements SPEC 13.4's last paragraph:
- Has `queue.gate_passed` → reference it
- No `queue.gate_passed` → list facts, don't conclude "已放行"
- Shows `queue.paused` if any

All checks pass. Let me compile my verdict.

---

# 批次 v04-b09 审核

## 取证过程

### 1. 提交确认

```
git log --oneline d33d4d87a2a1777f00d0eba439daf7a01db6aeac..ab8bdf0
```
输出：
```
ab8bdf0 test: cover collie why evidence chain and exit codes (SPEC 13.4)
2299370 cli: add collie why command and projectWhy projection (SPEC 13.4)
950f7db docs: issue v04-b09 task envelope
```

完整 SHA：
- `ab8bdf0faa573c50e8a5c22ee6bf5d248aeb0bd1`
- `2299370719bd0e3b3b89718b127d164fe0366a20`
- `950f7db11fd5071f301fd41b482b9fc84c33a5b5`

### 2. 已推送确认

```
git merge-base --is-ancestor ab8bdf0 78ba2cdd63d72b67c73fabbad05e5f895f5d734b
```
→ 退出码 0。`ab8bdf0` 是远端 HEAD（`78ba2cd` = report 提交）的祖先，已推送。

### 3. 受保护文件

```
git diff --stat d33d4d87a2a1777f00d0eba439daf7a01db6aeac..ab8bdf0 -- SPEC.md CONSTRAINTS.md ROADMAP.md ROLES.md 'AGENT-*.md' docs/backlog.md docs/decisions docs/progress.md .collie/collie.toml
```
→ 无输出，0 行变动。

### 4. 依赖变化

```
git diff d33d4d87a2a1777f00d0eba439daf7a01db6aeac..ab8bdf0 -- package.json package-lock.json
```
→ 无输出。

### 5. 文件变动范围

```
git diff --name-only d33d4d87a2a1777f00d0eba439daf7a01db6aeac..ab8bdf0
```
```
.collie/batches/v04-b09/task.md
src/cli.ts
src/view.ts
test/invariants.test.ts
test/why.test.ts
```
全部在条目范围内。无范围蔓延。

### 6. 额外禁止检查

```
git diff --stat d33d4d87a2a1777f00d0eba439daf7a01db6aeac..ab8bdf0 -- src/run.ts src/gate.ts src/arbiter.ts
```
→ 无输出。未改动 `run.ts`、`gate.ts`、`arbiter.ts`。

`cli.ts` diff 只有四个 hunk：两个 import 添加、`WHY_EXIT` 常量、`why()` 函数、commander 接线。`show`、`status`、`timeline` 的输出函数未被修改。

`view.ts` diff 只有一个 hunk（行 808 之后），全部是新增的 why 相关代码。已有函数零改动。

`why` 函数不写任何文件（`view.ts` 中无 `writeFileSync`/`appendFileSync`）。

`why` 函数不绕过 `view.ts` 直接读 journal —— 调用路径是 `loadRuns()` → `projectWhy()` → `formatWhy()`，全从 `view.ts` 导入。

无新增依赖。

## 逐条验收

| 验收项 | 命令 | 实测结果 | 通过 |
|---|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0, "All matched files use Prettier code style!" | ✅ |
| 类型检查零错误 | `npm run typecheck` | exit 0, `tsc -p tsconfig.json` 无输出 | ✅ |
| 全部测试通过 | `npm test` | exit 0, 47 files, 913 tests passed | ✅ |
| why 专项测试通过 | `npm test -- test/why.test.ts` | exit 0, 1 file, 14 tests passed | ✅ |
| 专项测试不少于 8 个 | `grep -cE "^\s+it\(" test/why.test.ts \| grep -qE "^([8-9]\|[1-9][0-9])$"` | exit 0（14 个 it 块） | ✅ |
| 专项测试含真实运行的夹具 | `grep -qE "Sandbox\.create" test/why.test.ts` | exit 0 | ✅ |
| why 已接线 | `npx tsx src/cli.ts why v03-b04-fix; test $? -ne 1 && ! npx tsx src/cli.ts why no-such-batch` | exit 0，已知批次得到退出码 2（在 backlog 无 journal），未知批次退出码 1 | ✅ |
| 不变量同步 | `grep -qE "why" test/invariants.test.ts` | exit 0 | ✅ |

## 条目要求与额外禁止

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| `projectWhy` 在 `src/view.ts` | task.md 条目 1 | `src/view.ts:1061` — `export function projectWhy(` | ✅ |
| attempt 按 13.13，用 v04-b08 的 `computeAttempt` | task.md 条目 1 | `src/view.ts:1084` — `const attempt = computeAttempt(runDataList, br.runId, batchId);` 该函数在 base_sha 已存在（行 170） | ✅ |
| 证据链顺序按 SPEC 13.4 | task.md 条目 1 | `src/view.ts:925-1028` — 编号 1-10 依序：worker→evidence→acceptance.failed→claim.mismatch→reviewer→CI→downgraded/escalated→interrupts→tool.denied→push | ✅ |
| 字段缺失时显示 `—` | task.md 条目 1 | `src/view.ts:688-691` — `dash()` 函数 null/undefined → `'—'`；formatWhy 全程使用 dash | ✅ |
| 放行依据：有 gate_passed 引用，没有则列事实不下结论 | task.md 条目 1 | `src/view.ts:1278-1286` — gatePassedCount > 0 引用；否则列 gateFacts，标题 `放行判定（无 queue.gate_passed）` | ✅ |
| `collie why <batch_id> [--attempt <n>] [--json]` | task.md 条目 2 | `src/cli.ts:841-849` — commander 注册 `why` 命令，带 `--attempt`、`--json` | ✅ |
| 结论行由固定模板+reason，不调用模型 | task.md 条目 2 | `src/view.ts:1136-1162` — `RULE_TEMPLATES` 映射 + `conclusionLine` 纯字符串拼接；无模型调用 | ✅ |
| 不读信封文件 | task.md 条目 2 | `src/cli.ts:641-670` — `why()` 只调 `loadRuns`/`projectWhy`/`formatWhy`，不调 `readEnvelope` | ✅ |
| 退出码 0/1/2 | task.md 条目 2 | `src/cli.ts:485` — `WHY_EXIT = { HAS_DATA: 0, NOT_IN_BACKLOG: 1, NO_JOURNAL: 2 }` | ✅ |
| cli.ts 只做接线 | task.md 条目 2 | `src/cli.ts:641-670` — 函数体仅含 backlog 检查、调 view.ts、输出、返回退出码 | ✅ |
| Sandbox 测 PASS 和 FIX→PASS | task.md 条目 3 | `test/why.test.ts:82-134` — `Sandbox.create()` 后 `box.run(passRunner)`；`test/why.test.ts:136-180` — FIX→PASS 两次 `box.run` | ✅ |
| 行为验证：PASS real sandbox 测试通过 | task.md 条目 3 | `npx vitest run test/why.test.ts` → 14 tests passed (Tests 14 passed) | ✅ |
| 行为验证：FIX→PASS real sandbox 测试通过 | task.md 条目 3 | 同上，14 tests passed 包含 describe "FIX then PASS" 的 2 个 it | ✅ |
| 手写夹具覆盖 rule 8 FIX | task.md 条目 3 | `test/why.test.ts:199-275` — `acceptance.failed` 事件 + `verdict.downgraded` rule 8 | ✅ |
| 手写夹具覆盖 rule 2 BLOCK | task.md 条目 3 | `test/why.test.ts:277-331` — `spec_diff_lines: 3` + rule 2 | ✅ |
| 手写夹具覆盖 rule 1 格式错 | task.md 条目 3 | `test/why.test.ts:333-374` — `reviewer.verdict` 含 error + rule 1 | ✅ |
| 手写夹具覆盖无 report 上报 | task.md 条目 3 | `test/why.test.ts:376-414` — `escalated` 事件 reason `no parseable report.md` | ✅ |
| 手写夹具覆盖中断后恢复 | task.md 条目 3 | `test/why.test.ts:416-554` — 两个 run，worker.signaled + worker.rescued → worker.resumed | ✅ |
| 事件字段只用 SPEC 3.6 / 11-13 章 | task.md 条目 3 | `grep -oE "event: '[^']+'" test/why.test.ts` → 12 种事件类型全为 SPEC 定义 | ✅ |
| 三个退出码测试 | task.md 条目 3 | `test/why.test.ts:576-630` — exit 0/1/2 三个 it 块 | ✅ |
| invariants.test.ts 加 why | task.md 条目 3 | `test/invariants.test.ts:337-340` — `it('src/cli.ts contains the why command (v04-b09)')` | ✅ |
| 不改 run.ts / gate.ts / arbiter.ts / 规则 1-10 | 额外禁止 | `git diff --stat ...` → 无输出 | ✅ |
| 不改 show / status / timeline 输出 | 额外禁止 | cli.ts diff 仅四个 hunk 均为新增；view.ts diff 仅一个 hunk 在尾部追加 | ✅ |
| why 不写文件 | 额外禁止 | `grep writeFileSync src/view.ts` → 无匹配；cli.ts why 函数无写文件调用 | ✅ |
| 不绕过 view.ts 直接读 journal | 额外禁止 | cli.ts why 函数调用链：loadRuns → projectWhy → formatWhy | ✅ |
| 无新增依赖 | 额外禁止 | package.json 无 diff | ✅ |
| 不为了让测试过而删除或跳过测试 | 额外禁止 | diff 无删除测试行为 | ✅ |

## 声称与实测的差异

无。

## 结论与理由

全部 8 条验收命令实跑通过。三个条目的具体实现要求与所有额外禁止逐条核对均满足。受保护文件未被修改。无新增依赖。提交已推送到远端。diff 范围完全在条目之内。代码实现忠实遵循 SPEC 13.4：证据链顺序正确、退出码正确、结论行用固定模板而非模型、放行依据的两种路径均已实现、attempt 使用共享的推算函数。测试覆盖全面（14 个测试），包含真实 Sandbox 运行和手写夹具两类。

结论：**PASS**。

```json
{
  "schema_version": 1,
  "batch_id": "v04-b09",
  "verdict": "PASS",
  "evidence": {
    "commits_actual": [
      "950f7db11fd5071f301fd41b482b9fc84c33a5b5",
      "2299370719bd0e3b3b89718b127d164fe0366a20",
      "ab8bdf0faa573c50e8a5c22ee6bf5d248aeb0bd1"
    ],
    "verify_results": [
      { "cmd": "npm run lint", "exit_code": 0, "summary": "eslint + prettier pass" },
      { "cmd": "npm run typecheck", "exit_code": 0, "summary": "tsc zero errors" },
      { "cmd": "npm test", "exit_code": 0, "summary": "47 files, 913 tests passed" },
      { "cmd": "npm test -- test/why.test.ts", "exit_code": 0, "summary": "1 file, 14 tests passed" },
      { "cmd": "grep -cE \"^\\s+it\\(\" test/why.test.ts | grep -qE \"^([8-9]|[1-9][0-9])$\"", "exit_code": 0, "summary": "14 it() blocks >= 8" },
      { "cmd": "grep -qE \"Sandbox\\.create\" test/why.test.ts", "exit_code": 0, "summary": "Sandbox.create found" },
      { "cmd": "npx tsx src/cli.ts why v03-b04-fix; test $? -ne 1 && ! npx tsx src/cli.ts why no-such-batch", "exit_code": 0, "summary": "known batch exit 2, unknown batch exit 1" },
      { "cmd": "grep -qE \"why\" test/invariants.test.ts", "exit_code": 0, "summary": "why found in invariants" }
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
  "reason": "全部 8 条验收命令通过，三个条目的要求与额外禁止逐条核对满足，受保护文件未改，无新增依赖，提交已推送。CI 以 R2 取证为准。"
}
```
