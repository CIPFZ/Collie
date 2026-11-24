I now have all the evidence needed to write the verdict. Let me compile it.

---

# 批次 v046-b46 审核

## 取证过程

### 1. 提交确认

```
$ git log --oneline 19f3437..fca77e2 -- . ':(exclude).collie/batches'
fca77e2 schema: hand R2 evidence to reviewer, make verdict evidence optional
e259f78 docs: issue v046-b46 task envelope
```

Worker 的代码提交为 `fca77e2`（1 个），`e259f78` 是测试 Agent 的信封提交。

```
$ git rev-parse fca77e2705d3223747853ae859db1a3b8a979c0c
fca77e2705d3223747853ae859db1a3b8a979c0c
```

提交存在。

### 2. 推送确认

```
$ git ls-remote origin
059939cfbc93afa69144d05d422834827dff7d7f	refs/heads/main

$ git merge-base --is-ancestor fca77e2 059939c → YES
```

远端 main 在 `059939c`（`report(collie): v046-b46` 信封提交），`fca77e2` 是其祖先，已推送。

### 3. 验收命令实跑

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
 Test Files  94 passed (94)
      Tests  1624 passed (1624)
   Duration  29.65s
```
退出码：0 ✅

**命令 4：`npm test -- test/acceptance/v046-b46`**
```
 Test Files  2 passed (2)
      Tests  8 passed (8)
   Duration  1.60s
```
退出码：0 ✅

### 4. 受保护路径

```
$ git diff --stat 19f3437..fca77e2 -- SPEC.md CONSTRAINTS.md ROADMAP.md ROLES.md 'AGENT-*.md' docs/backlog.md docs/backlog-archive.md docs/decisions docs/progress.md .collie/collie.toml test/acceptance .github eslint.config.js vitest.config.ts
```
输出中仅有 `test/acceptance/v046-b46/` 下的 3 个文件（MAP.md、keep.test.ts、new.test.ts），这些都来自 `e259f78`（`docs: issue` 信封提交），不是 worker 的改动。

```
$ git log --format='%h %s' 19f3437..fca77e2 -- test/acceptance
e259f78 docs: issue v046-b46 task envelope
```
仅有 `docs: issue` 开头的提交，worker 未触碰 `test/acceptance`。 ✅

### 5. 额外禁止的文件

```
$ git diff --stat 19f3437..fca77e2 -- src/arbiter.ts src/gate.ts src/view.ts 'src/runner/' src/roles/worker.ts src/roles/tester.ts
```
无输出。 ✅

### 6. 依赖变化

```
$ git diff 19f3437..fca77e2 -- package.json package-lock.json
```
无输出，没有依赖变化。 ✅

### 7. 变异检查清单

```
$ git diff 19f3437..fca77e2 -- scripts/mutation.ts
```
无输出，清单未被改动。 ✅

### 8. CI

我没有 GitHub 凭据，无法查到 CI 状态。CI 以 R2 取证为准。

## 逐条验收

| 验收项 | 命令 | 实测结果 | 通过 |
|---|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 | ✅ |
| 类型检查零错误 | `npm run typecheck` | exit 0 | ✅ |
| 全部测试通过 | `npm test` | 94 files, 1624 tests passed, exit 0 | ✅ |
| 本批次验收测试通过 | `npm test -- test/acceptance/v046-b46` | 2 files, 8 tests passed, exit 0 | ✅ |

## 条目要求与额外禁止

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| `EvidenceSchema` 单独导出 | 条目 1 | `src/schema/index.ts:438-450`：`export const EvidenceSchema = z.strictObject({...})` | ✅ |
| `VerdictSchema` 的 `evidence` 改成可选 | 条目 1 | `src/schema/index.ts:460`：`evidence: EvidenceSchema.optional().default({...})` | ✅ |
| R2 自己的 `Evidence` 类型仍必有各字段 | 条目 1 | `src/evidence.ts:26`：`export type Evidence = z.infer<typeof EvidenceSchema>;`——`EvidenceSchema` 的所有字段都是必填的 `z.strictObject` | ✅ |
| `ReviewerInputSchema` 加可选 `evidence` | 条目 1 | `src/roles/reviewer.ts:42`：`evidence: EvidenceSchema.optional(),` | ✅ |
| 有 evidence 时提示词多一节「R2 的取证结果」 | 条目 1 | `src/roles/reviewer.ts:92-106`：`buildEvidenceSection` 生成格式匹配 SPEC 16.30 的代码块；`src/roles/reviewer.ts:145`：条件插入 | ✅ |
| 格式：每条验收命令一行 | 条目 1 / SPEC 16.30 | `src/roles/reviewer.ts:99-101`：`for (const r of evidence.verify_results) { lines.push(\`- \`${r.cmd}\` → exit ${String(r.exit_code)}：${r.summary}\`); }` | ✅ |
| 格式：已推送、CI、受保护文件、依赖各一行 | 条目 1 / SPEC 16.30 | `src/roles/reviewer.ts:102-105`：四行 `lines.push(...)` | ✅ |
| 无 evidence 时提示词逐字节不变 | 条目 1 | `src/roles/reviewer.ts:145`：`...(data.evidence !== undefined ? [...] : [])`，无 evidence 时扩展为空；S4 验收实跑通过 `npx vitest run test/acceptance/v046-b46/keep.test.ts` → K1 验证无此节。测试命令输出：`Tests 4 passed (4)` | ✅ |
| `src/run.ts` 把取证结果传给 reviewer | 条目 2 | `src/run.ts:2272-2273`：`evidence: collected.evidence,` | ✅ |
| 无 evidence 的结论照常解析和仲裁 | 条目 2 | `src/schema/index.ts:460`：`.optional().default({...})` 确保解析后 evidence 总有值；S2、S3 验收测试通过 | ✅ |
| 仲裁、门禁、事件不变 | 条目 2 | `src/arbiter.ts`、`src/gate.ts` 无改动（diff stat 确认） | ✅ |
| 点名的旧测试修改：`reviewer-isolation` 加 `'evidence'` | 条目 3 | `test/reviewer-isolation.test.ts:59`：类型清单加了 `\| 'evidence'` | ✅ |
| 不改任何受保护路径 | 额外禁止 | diff stat 确认无改动 | ✅ |
| 不改 arbiter/gate/view/runner/worker/tester | 额外禁止 | diff stat 确认无改动 | ✅ |
| 不把 worker 的汇报/claims 放进 reviewer | 额外禁止 | `src/roles/reviewer.ts` 顶部注释确认 worker report 不可见；`src/run.ts:2273` 只传 `collected.evidence`，不含 claims | ✅ |
| 不删/跳过测试，不改条目 3 之外的断言 | 额外禁止 | `git diff ... -- 'test/*.test.ts' ':(exclude)test/acceptance'` 仅有 `test/reviewer-isolation.test.ts` 的一行改动（条目 3 点名） | ✅ |
| 不新增依赖 | 额外禁止 | package.json 无改动 | ✅ |

**行为要求实跑**：

| 行为 | 测试文件 | 命令与结果 |
|---|---|---|
| evidence 时提示词包含取证结果 | `test/acceptance/v046-b46/new.test.ts` | `npx vitest run test/acceptance/v046-b46/new.test.ts` → `Tests 4 passed (4)` |
| 无 evidence 时提示词无此节 | `test/acceptance/v046-b46/keep.test.ts` | `npx vitest run test/acceptance/v046-b46/keep.test.ts` → `Tests 4 passed (4)` |
| reviewer-isolation 编译时检查 | `test/reviewer-isolation.test.ts` | `npx vitest run test/reviewer-isolation.test.ts` → `Tests 19 passed (19)` |
| reviewer 提示词内容不变（无 evidence） | `test/reviewer.test.ts` | `npx vitest run test/reviewer.test.ts` → `Tests 24 passed (24)` |

### 不变量数值变化

无。`test/invariants.test.ts` 在此 diff 中无任何改动。

### 被改写或删去的断言

仅有条目 3 点名的一处：
- **文件**：`test/reviewer-isolation.test.ts`，用例 `accepts exactly the SPEC 4.2 allow-list of input fields`
- **原断言**：`'batch_id' | 'base_sha' | 'head_sha' | 'items' | 'acceptance' | 'spec_paths'`
- **现断言**：`'batch_id' | 'base_sha' | 'head_sha' | 'items' | 'acceptance' | 'spec_paths' | 'evidence'`
- 此修改是条目 3 明确点名允许的，新增 `evidence` 字段是本批次的核心需求。SPEC 里此要求仍然有效（ReviewerInput 确实多了 evidence）。

## 情形与验收测试

| 情形 | 对应的用例 | 断言的是不是情形写的结果 | 拿掉这个行为会不会失败 |
|---|---|---|---|
| S1 [新] evidence → 提示词有 `## R2 的取证结果` 和 `Tests 12 passed (12)` | `new.test.ts` S1: 检查提示词有精确的 heading line 和 summary 内容 | 是——断言精确的行 `## R2 的取证结果` 和 `Tests 12 passed (12)` | 是——移除 `buildEvidenceSection` 或条件插入会导致提示词不含这些内容 |
| S2 [新] 无 evidence 的结论解析成功 | `new.test.ts` S2: `safeParse` 成功 | 是——断言 `result.success === true` | 是——移除 `.optional().default(...)` 后 safeParse 会失败 |
| S3 [新] 无 evidence 的 reviewer 结论，退出码 0，verdict PASS | `new.test.ts` S3: 沙箱跑一次，检查 exit 0 和 `run.finished.verdict === 'PASS'` | 是——完整检查了退出码和 verdict 值 | 是——如果不能解析无 evidence 的结论，运行会失败 |
| S4 [新] 沙箱跑一次，reviewer 提示词有 R2 取证 | `new.test.ts` S4: 检查第 2 次调用的 prompt 有 heading 和 `受保护文件改动行数：0` | 是——断言精确行和具体值 | 是——移除 `run.ts` 中 `evidence: collected.evidence` 会导致提示词无此节 |
| K1 [保持] 无 evidence 时无此节 | `keep.test.ts` K1: `not.toContain('## R2 的取证结果')` | 是——反向断言确保无此节 | 是——如果条件逻辑错误（始终显示），此测试会红 |
| K2 [保持] 带 evidence 的结论解析成功，`spec_diff_lines` 保持 | `keep.test.ts` K2: `safeParse` 成功且 `spec_diff_lines === 42` | 是——断言了值的保真 | 是——如果 EvidenceSchema 变形会解析失败 |
| K3 [保持] 沙箱 exit 0，调用顺序 worker → reviewer | `keep.test.ts` K3: 检查 exit 0 和 calls 顺序 | 是 | 是——如果调用顺序变了测试会红 |
| K4 [保持] reviewer 声称 `spec_diff_lines: 99`，`evidence.collected` 仍是 0 | `keep.test.ts` K4: 检查 exit 0 和事件中 `spec_diff_lines === 0` | 是——R2 的证据不受 reviewer 的影响 | 是——如果 R2 读了 reviewer 的 evidence 值，这里会是 99 |

无测试缺口。所有 8 条情形的断言都检查了情形描述的确切结果，且各自的行为如果被移除测试会失败。没有断言只写在 `catch` 里的，没有只断言「不报错」的。

## 结论与理由

**PASS。** 全部 4 条验收命令退出码 0；94 个测试文件 1624 个测试全过；提交已推送到远端；无受保护文件被修改；无依赖变化；diff 范围严格落在 task 条目内（`src/schema/index.ts`、`src/evidence.ts`、`src/roles/reviewer.ts`、`src/run.ts`、`test/reviewer-isolation.test.ts`），仅修改条目 3 点名的一条断言；额外禁止的所有项逐条核对均满足；实现格式与 SPEC 16.30 的代码块精确一致；R2 的 Evidence 类型仍保持全字段必填。

```json
{
  "schema_version": 1,
  "batch_id": "v046-b46",
  "verdict": "PASS",
  "evidence": {
    "commits_actual": ["fca77e2705d3223747853ae859db1a3b8a979c0c"],
    "verify_results": [
      { "cmd": "npm run lint", "exit_code": 0, "summary": "eslint + prettier pass" },
      { "cmd": "npm run typecheck", "exit_code": 0, "summary": "tsc pass" },
      { "cmd": "npm test", "exit_code": 0, "summary": "94 files, 1624 tests passed" },
      { "cmd": "npm test -- test/acceptance/v046-b46", "exit_code": 0, "summary": "2 files, 8 tests passed" }
    ],
    "remote_has_head": true,
    "ci_conclusion": "unknown",
    "ci_run_url": "",
    "ci_branch_matched": null,
    "deps_diff": [],
    "spec_diff_lines": 0
  },
  "gaps": [],
  "reason": "All 4 acceptance commands exit 0; 1624 tests pass across 94 files; commit fca77e2 pushed to remote (ancestor of remote main 059939c); no protected files modified; no dependency changes; implementation matches SPEC 16.30 format exactly; only the allowed test assertion was modified (reviewer-isolation adding 'evidence'); CI 以 R2 取证为准。"
}
```
