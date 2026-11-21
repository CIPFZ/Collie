I have completed all evidence gathering. Let me now compile the verdict.

---

# 批次 v046-b32 审核

## 取证过程

### 1. 提交事实

```
$ git log --format='%H %s' 086c58b..0885886 -- . ':(exclude).collie/batches'
0885886bbf087fa47b75bf7ad5cf5e15e2fc1f87 test: add batch authorisation parsing, task envelope, and evidence tests (SPEC 16.21 v046-b32)
d1f1646d0859d4c12d4f65662cde73395db7fdf0 schema: add allowed_protected to BatchSchema; parse, render, and exclude in evidence (SPEC 16.21 v046-b32)
```

两个提交存在，都在 main 分支上。remote origin/main 指向 `47e899f3`（report commit），head_sha `0885886b` 是其祖先，已推送。

### 2. 受保护路径

```
$ git diff --stat 086c58b..0885886 -- SPEC.md CONSTRAINTS.md ROADMAP.md ROLES.md 'AGENT-*.md' docs/backlog.md docs/decisions docs/progress.md .collie/collie.toml test/acceptance .github eslint.config.js vitest.config.ts
（无输出）
```

受保护文件改动行数 = 0。

### 3. 额外禁止的文件

```
$ git diff --stat 086c58b..0885886 -- scripts/mutation.ts package.json templates/collie.toml .github eslint.config.js vitest.config.ts
（无输出）
$ git diff --stat 086c58b..0885886 -- src/arbiter.ts src/gate.ts src/acceptance.ts src/redcheck.ts src/roles/reviewer.ts src/roles/tester.ts 'src/runner/'
（无输出）
```

无额外禁止文件被改动。

### 4. 依赖变化

```
$ git diff --stat 086c58b..0885886 -- package.json package-lock.json
（无输出）
```

无依赖变化。

### 5. 验收命令实跑

#### 命令 1: `npm run lint`
退出码 0。输出末行 "All matched files use Prettier code style!"

#### 命令 2: `npm run typecheck`
退出码 0。

#### 命令 3: `npm test`
退出码 0。73 passed (73 文件)，1506 passed (1506 测试)。

#### 命令 4: `e=$(mktemp) && GIT_CONFIG_GLOBAL=$e GIT_CONFIG_NOSYSTEM=1 npm test -- test/batch-authorisation.test.ts`
退出码 0。1 文件 passed，3 测试 passed。

#### 命令 5: `npm test -- test/backlog.test.ts test/task-envelope.test.ts test/evidence.test.ts test/batch-authorisation.test.ts`
退出码 0。4 文件 passed，278 测试 passed。

#### 命令 6: `grep -qF "backlog: allowed protected paths" test/backlog.test.ts && grep -qF "batch authorisation: named protected paths do not count" test/batch-authorisation.test.ts`
退出码 0。

#### 命令 7: `grep -vE "^\s*(//|\*|/\*)" src/backlog.ts | grep -qF "可改的受保护路径" && grep -vE "^\s*(//|\*|/\*)" src/run.ts | grep -qF "authorized_diff_lines"`
退出码 0。

#### 命令 8: `out=$(npx tsx scripts/mutation.ts 2>&1) && printf '%s\n' "$out" | tail -n 1 | grep -qE "^mutation: caught 46 survived 0 invalid 0 timeout 0 stale 0$" && ! test -e .vitest`
退出码 0。

#### 命令 9: `grep -qF "authorized_diff_lines" test/invariants.test.ts`
退出码 0。

## 逐条验收

| 验收项 | 命令 | 实测结果 | 通过 |
|---|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 | ✅ |
| 类型检查零错误 | `npm run typecheck` | exit 0 | ✅ |
| 全部测试通过 | `npm test` | exit 0, 1506 passed | ✅ |
| 没有 git 全局身份时新测试通过 | `e=$(mktemp) && GIT_CONFIG_GLOBAL=$e GIT_CONFIG_NOSYSTEM=1 npm test -- test/batch-authorisation.test.ts` | exit 0, 3 passed | ✅ |
| 解析、任务书、取证的测试通过 | `npm test -- test/backlog.test.ts test/task-envelope.test.ts test/evidence.test.ts test/batch-authorisation.test.ts` | exit 0, 278 passed | ✅ |
| 两组新用例在 | `grep -qF …` | exit 0 | ✅ |
| 解析与取证都认得授权 | `grep -vE … \| grep -qF …` | exit 0 | ✅ |
| 变异检查仍然全部被发现 | `out=$(npx tsx scripts/mutation.ts …)` | exit 0, caught 46 survived 0 | ✅ |
| 不变量同步 | `grep -qF "authorized_diff_lines" test/invariants.test.ts` | exit 0 | ✅ |

## 条目要求与额外禁止

### 条目 1：解析「可改的受保护路径」

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| 标签「可改的受保护路径」加冒号，全角半角都认，写法照 LABEL_INTERFACES | 条目 1 | `src/backlog.ts:33` — `const LABEL_ALLOWED_PROTECTED = new RegExp('^可改的受保护路径${COLON}$');` 使用与 LABEL_INTERFACES 相同的 COLON 模式 | ✅ |
| 下面是 `- <路径>` 的列表，允许空行，照「接口」一节 | 条目 1 | `src/backlog.ts:489` — `const list = parseListWithBlanks(body, i + 1, BULLET_ITEM);` 使用与接口一节相同的 parseListWithBlanks | ✅ |
| 解析结果多一个可选字段 `allowed_protected` | 条目 1 | `src/schema/index.ts:246` — `allowed_protected: z.array(NonEmptyString).optional()` | ✅ |
| 能点名的只有 .github、.github/ 下的路径、eslint.config.js、vitest.config.ts | 条目 1 | `src/backlog.ts:391-397` — `isAllowablePath` 只允许这四类 | ✅ |
| 别的一律报错并指出是哪一项 | 条目 1 | `src/backlog.ts:414-418` — throw BacklogError，消息中包含 `"${item}"` | ✅ |
| **粗体情形：两行 vitest.config.ts 和 .github/workflows/ci.yml 解析正确** | 条目 1 | `npx vitest run test/backlog.test.ts` → Tests 37 passed。测试 `test/backlog.test.ts:383` 断言 `expect(batch?.allowed_protected).toEqual(['vitest.config.ts', '.github/workflows/ci.yml'])` | ✅ |
| **粗体情形：7 个非法路径全部报错** | 条目 1 | `test/backlog.test.ts:418-433` — it.each 覆盖 SPEC.md、docs/backlog.md、test/acceptance/x.test.ts、.collie/collie.toml、../x、/etc/x、.github/* 全部报 BacklogError 且消息含该路径 | ✅ |
| **粗体情形：没有这一节的批次无 allowed_protected 键** | 条目 1 | `test/backlog.test.ts:412-415` — `expect('allowed_protected' in (batch ?? {})).toBe(false)` | ✅ |
| task.md 有「本批次可改的受保护路径」一节 | 条目 1 | `src/roles/worker.ts:135-141` — renderAllowedProtectedSection 生成 `## 本批次可改的受保护路径` + 路径列表 + 提示语 | ✅ |
| 没有这一节时 task.md 逐字节不变 | 条目 1 | `src/roles/worker.ts:133` — `if (batch.allowed_protected === undefined \|\| batch.allowed_protected.length === 0) return undefined;` 且 `task-envelope.test.ts:275-278` 断言无此节 | ✅ |

### 条目 2：取证时排除授权路径

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| 授权路径排除在 spec_diff_lines 之外 | 条目 2 | `src/evidence.ts:241-245` — 计算 authStat 后 `specDiffLines += totalLines - authLines` | ✅ |
| 另记 authorized_diff_lines 在 evidence.collected 事件 | 条目 2 | `src/run.ts:2281-2283` — `authorized_diff_lines: collected.authorizedDiffLines` 条件展开 | ✅ |
| 批次没有授权时不带 authorized_diff_lines | 条目 2 | `src/evidence.ts:351` — `...(hasAuthorized ? { authorizedDiffLines } : {})` 仅在有授权时添加 | ✅ |
| **行为验证：授权 vitest，只改它和普通源码 → spec_diff_lines=0** | 条目 2 | `npx vitest run test/batch-authorisation.test.ts` → Tests 3 passed。测试 `batch-authorisation.test.ts:293` 断言 `expect(evidenceEvt?.spec_diff_lines).toBe(0)` 且 `authorized_diff_lines > 0` | ✅ |
| **行为验证：同批次还改了非授权 eslint.config.js → spec_diff_lines>0** | 条目 2 | 同上测试文件第 306 行断言 `expect((evidenceEvt?.spec_diff_lines as number) > 0).toBe(true)` | ✅ |
| **行为验证：无授权批次改 vitest.config.ts → spec_diff_lines>0，无 authorized_diff_lines** | 条目 2 | 同上测试文件第 319-321 行断言 `spec_diff_lines > 0` 且 `authorized_diff_lines` 为 undefined | ✅ |

### 条目 3：测试

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| backlog.test.ts 新加 describe('backlog: allowed protected paths', …) | 条目 3 | `test/backlog.test.ts:351` — `describe('backlog: allowed protected paths', () => {` | ✅ |
| task-envelope.test.ts 加两种情形 | 条目 3 | `test/task-envelope.test.ts:244-283` — 两个 it：有和无 allowed_protected | ✅ |
| 新文件 test/batch-authorisation.test.ts | 条目 3 | 文件存在，358 行 | ✅ |
| describe('batch authorisation: named protected paths do not count', …) | 条目 3 | `test/batch-authorisation.test.ts:280` | ✅ |
| 用 Sandbox 与 FakeRunner | 条目 3 | `test/batch-authorisation.test.ts:12` import FakeRunner，第 92 行 AuthSandbox 类 | ✅ |
| invariants.test.ts 加两条 | 条目 3 | `test/invariants.test.ts:760-767` — 两个新 it 检查 src/backlog.ts 有 '可改的受保护路径' 和 src/run.ts 有 'authorized_diff_lines' | ✅ |
| 已有断言一条都不改 | 条目 3 | diff 中所有测试文件无删除行（git diff 验证无 `^-.*expect` 行） | ✅ |

### 额外禁止

| 禁止项 | 出处 | 证据 | 满足 |
|---|---|---|---|
| 不改动受保护路径 | 额外禁止 | `git diff --stat` 对受保护路径无输出 | ✅ |
| 不改动 .github/、eslint.config.js、vitest.config.ts 等 | 额外禁止 | `git diff --stat` 确认无改动 | ✅ |
| 不改动 arbiter、gate、acceptance、redcheck、reviewer、tester、runner/ | 额外禁止 | `git diff --stat` 确认无改动 | ✅ |
| 不从 PROTECTED_PATHS 去掉任何一项 | 额外禁止 | diff 中 `src/evidence.ts` 无删除 PROTECTED_PATHS 相关行 | ✅ |
| 授权只点名三类路径 | 额外禁止 | `src/backlog.ts:394-396` isAllowablePath 仅认 .github、eslint.config.js、vitest.config.ts | ✅ |
| 授权来源仅 backlog | 额外禁止 | `src/backlog.ts:487-491` 只在 backlog 解析中设置；`src/run.ts:2227-2229` 只从 batch.allowed_protected 传入 | ✅ |
| 有授权时不把别的受保护路径也放过 | 额外禁止 | `src/evidence.ts:238` 先对 PROTECTED_PATHS 全量计算，再减去授权路径部分 | ✅ |
| 不删除或跳过测试 | 额外禁止 | diff 中无 `.skip`、`.only`，无删除 expect 行 | ✅ |
| 不改写任何已有断言 | 额外禁止 | 所有现有测试文件只有纯新增行 | ✅ |
| 不新增依赖 | 额外禁止 | package.json 无变化 | ✅ |

### 不变量数值变化

无。`test/invariants.test.ts` diff 仅新增两个 it，没有修改任何数值上下限。

### 被改写或删去的断言

无。diff 中所有测试文件（backlog.test.ts、task-envelope.test.ts、invariants.test.ts）都只有新增行，没有删除或修改任何 `expect(…)` 断言。test/batch-authorisation.test.ts 是全新文件。

## 结论与理由

全部 9 条验收命令实跑通过。受保护文件零改动。无依赖变化。diff 范围严格限于 task.md 的 3 个条目：backlog 解析（src/backlog.ts, src/schema/index.ts）、取证排除（src/evidence.ts, src/run.ts）、任务书渲染（src/roles/worker.ts）以及配套测试（4 个测试文件）。实现逻辑正确：授权路径验证严格、取证时正确分离授权与非授权的 diff 行数、evidence.collected 事件仅在有授权时带 authorized_diff_lines。已有断言零改动。变异检查 46 caught 0 survived。

```json
{
  "schema_version": 1,
  "batch_id": "v046-b32",
  "verdict": "PASS",
  "evidence": {
    "commits_actual": [
      "d1f1646d0859d4c12d4f65662cde73395db7fdf0",
      "0885886bbf087fa47b75bf7ad5cf5e15e2fc1f87"
    ],
    "verify_results": [
      { "cmd": "npm run lint", "exit_code": 0, "summary": "lint + prettier pass" },
      { "cmd": "npm run typecheck", "exit_code": 0, "summary": "tsc pass" },
      { "cmd": "npm test", "exit_code": 0, "summary": "73 files, 1506 tests passed" },
      { "cmd": "e=$(mktemp) && GIT_CONFIG_GLOBAL=$e GIT_CONFIG_NOSYSTEM=1 npm test -- test/batch-authorisation.test.ts", "exit_code": 0, "summary": "1 file, 3 tests passed" },
      { "cmd": "npm test -- test/backlog.test.ts test/task-envelope.test.ts test/evidence.test.ts test/batch-authorisation.test.ts", "exit_code": 0, "summary": "4 files, 278 tests passed" },
      { "cmd": "grep -qF 'backlog: allowed protected paths' test/backlog.test.ts && grep -qF 'batch authorisation: named protected paths do not count' test/batch-authorisation.test.ts", "exit_code": 0, "summary": "both describe names found" },
      { "cmd": "grep -vE '^\\s*(//|\\*|/\\*)' src/backlog.ts | grep -qF '可改的受保护路径' && grep -vE '^\\s*(//|\\*|/\\*)' src/run.ts | grep -qF 'authorized_diff_lines'", "exit_code": 0, "summary": "non-comment references found" },
      { "cmd": "out=$(npx tsx scripts/mutation.ts 2>&1) && printf '%s\\n' \"$out\" | tail -n 1 | grep -qE '^mutation: caught 46 survived 0 invalid 0 timeout 0 stale 0$' && ! test -e .vitest", "exit_code": 0, "summary": "caught 46 survived 0" },
      { "cmd": "grep -qF 'authorized_diff_lines' test/invariants.test.ts", "exit_code": 0, "summary": "invariant present" }
    ],
    "remote_has_head": true,
    "ci_conclusion": "unknown",
    "ci_run_url": "",
    "ci_branch_matched": null,
    "deps_diff": [],
    "spec_diff_lines": 0
  },
  "gaps": [],
  "reason": "全部 9 条验收命令通过，受保护文件零改动，无新依赖，diff 范围在条目之内，条目要求与额外禁止逐条核对均满足，已有断言零修改。CI 以 R2 取证为准。"
}
```
