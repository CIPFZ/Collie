# 批次 v046-b39 审核

## 取证过程

### 1. 受保护路径检查

```
git diff --stat 81a6625f..8838cd4c -- SPEC.md CONSTRAINTS.md ROADMAP.md ROLES.md 'AGENT-*.md' docs/backlog.md docs/decisions docs/progress.md .collie/collie.toml test/acceptance .github eslint.config.js vitest.config.ts
```
输出：空（无改动）。

### 2. 依赖变化检查

```
git diff 81a6625f..8838cd4c -- package.json package-lock.json
```
输出：空（无改动）。

### 3. src/ 和 scripts/ 检查（本批额外禁止）

```
git diff 81a6625f..8838cd4c -- src/ scripts/
```
输出：空（无改动）。

### 4. 已有测试检查

```
git diff 81a6625f..8838cd4c -- test/ ':(exclude)test/output-tail.test.ts'
```
输出：空（未改任何已有测试文件）。

### 5. test/acceptance/ 检查

```
git log --format='%h %s' 81a6625f..8838cd4c -- test/acceptance
```
输出：空（worker 未动验收测试目录）。

### 6. mutation.ts 检查

```
git diff 81a6625f..8838cd4c -- scripts/mutation.ts
```
输出：空（无改动）。

### 7. invariants.test.ts 检查

```
git diff 81a6625f..8838cd4c -- test/invariants.test.ts
```
输出：空（无改动）。

### 8. diff stat

```
test/output-tail.test.ts | 401 +++++++++++++++++++++++++++++++++++++++++++++++
 1 file changed, 401 insertions(+)
```

仅新增了一个测试文件，完全符合「只改测试」的批次性质。

### 9. 提交检查

```
git rev-parse 8838cd4cda72d42004791ebe1d3cda75220ceddf
# → 8838cd4cda72d42004791ebe1d3cda75220ceddf

git branch -r --contains 8838cd4cda72d42004791ebe1d3cda75220ceddf
# → origin/HEAD -> origin/main
# → origin/main
```

提交存在并已在 `origin/main` 上。

### 10. 验收命令实跑

#### 命令 1：`npm run lint`
退出码：0
输出（尾部）：`All matched files use Prettier code style!`

#### 命令 2：`npm run typecheck`
退出码：0
输出（尾部）：`> tsc -p tsconfig.json`（无错误）

#### 命令 3：`npm test`
退出码：0
输出：`Test Files  80 passed (80) / Tests  1556 passed (1556)`

#### 命令 4：`npm test -- test/output-tail.test.ts test/acceptance/v046-b35`
退出码：0
输出：`Test Files  3 passed (3) / Tests  17 passed (17)`

#### 命令 5：`grep -qF "output_tail: per-stream tail and fence width (SPEC 16.25)" test/output-tail.test.ts`
退出码：0

### 11. 新测试详细结果（verbose）

```
✓ S1: output_tail first line is stdout content, second line is --- stderr ---  680ms
✓ S2: 41 lines; line 1 is o6, line 21 is separator, line 22 is e6  593ms
✓ S3: output_tail is exactly 4 lines; line 1 is separator, line 2 is e1  594ms
✓ S4: output_tail with triple backticks renders with 4-backtick fences, closing matches opening  2ms
✓ K1: exactly 20 lines, first is out 11, last is out 30, no separator  616ms
✓ K2: event has cmd, exit_code, expect; tail contains progress 30, not progress 10  600ms
✓ K3: output_tail has token=***, no tok-secret-12345  589ms
✓ K4: output_tail line A, line B → fenced with exactly 3 backticks  0ms
✓ K5: acceptance.failed event has no output_tail key  588ms

Test Files  1 passed (1)
Tests  9 passed (9)
```

9 个用例全部通过，共 40 个 `expect()` 断言。

## 逐条验收

| 验收项 | 命令 | 实测结果 | 通过 |
|---|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0，零错误 | ✅ |
| 类型检查零错误 | `npm run typecheck` | exit 0，零错误 | ✅ |
| 全部测试通过 | `npm test` | exit 0，80 文件 1556 测试全过 | ✅ |
| 新测试与上一批验收测试通过 | `npm test -- test/output-tail.test.ts test/acceptance/v046-b35` | exit 0，3 文件 17 测试全过 | ✅ |
| 新的一组用例在 | `grep -qF "output_tail: per-stream tail and fence width (SPEC 16.25)" test/output-tail.test.ts` | exit 0 | ✅ |

## 条目要求与额外禁止

### 条目 1：九个情形逐条核对

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| S1：stdout 第一行 `result: 1 survived`，第二行 `--- stderr ---` | task 条目 1 | `test/output-tail.test.ts:91` `expect(lines[0]).toBe('result: 1 survived')` 和 `:92` `expect(lines[1]).toBe('--- stderr ---')` — 实跑 `npx vitest run test/output-tail.test.ts --reporter=verbose` → `✓ S1: output_tail first line is stdout content, second line is --- stderr --- 680ms` | ✅ |
| S2：恰好 41 行，第 1 行 `o6`，第 21 行 `--- stderr ---`，第 22 行 `e6` | task 条目 1 | `test/output-tail.test.ts:133-136` 断言 length=41, lines[0]='o6', lines[20]='--- stderr ---', lines[21]='e6' — 实跑 `✓ S2: 41 lines… 593ms` | ✅ |
| S3：恰好 4 行，第 1 行 `--- stderr ---`，第 2 行 `e1` | task 条目 1 | `test/output-tail.test.ts:169-171` 断言 length=4, lines[0]='--- stderr ---', lines[1]='e1' — 实跑 `✓ S3… 594ms` | ✅ |
| S4：4 反引号围栏开头，收尾与开头完全相同，内容 before / ``` / after | task 条目 1 | `test/output-tail.test.ts:203` `expect(openingFence).toBe('````')`, `:206` `afterCmd.findIndex((l, i) => i > fenceOpenIdx && l === openingFence)` 找收尾（与开头完全相同）, `:210` `expect(afterCmd[fenceCloseIdx]).toBe('````')`, `:214` `expect(blockLines).toEqual(['before', '```', 'after'])` — 实跑 `✓ S4… 2ms` | ✅ |
| K1：恰好 20 行，第 1 行 `out 11`，最后一行 `out 30`，无 `--- stderr ---` | task 条目 1 | `test/output-tail.test.ts:250-254` 断言 length=20, lines[0]='out 11', lines[19]='out 30', not contain separator — 实跑 `✓ K1… 616ms` | ✅ |
| K2：有 `progress 30`，无 `progress 10`，有 cmd/exit_code/expect | task 条目 1 | `test/output-tail.test.ts:288-300` 断言 cmd='sh split.sh', exit_code=1, expect defined, lines contain 'progress 30', not contain 'progress 10' — 实跑 `✓ K2… 600ms` | ✅ |
| K3：GITHUB_TOKEN 设为 `tok-secret-12345` 用完还原，output_tail 有 `token=***` 无 `tok-secret-12345` | task 条目 1 | `test/output-tail.test.ts:316` `process.env.GITHUB_TOKEN = 'tok-secret-12345'`, `:319-321` afterEach 还原, `:331-332` 断言 contains `token=***` / not contain `tok-secret-12345` — 实跑 `✓ K3… 589ms` | ✅ |
| K4：3 反引号围栏开头和收尾完全相同，中间 `line A` / `line B` | task 条目 1 | `test/output-tail.test.ts:362` `expect(openingFence).toBe('```')`, `:366` 收尾用 `l === openingFence` 找, `:369` `expect(afterCmd[fenceCloseIdx]).toBe('```')`, `:373` `expect(blockLines).toEqual(['line A', 'line B'])` — 实跑 `✓ K4… 0ms` | ✅ |
| K5：无输出，acceptance.failed 事件没有 `output_tail` 键 | task 条目 1 | `test/output-tail.test.ts:398` `expect('output_tail' in failed).toBe(false)` — 实跑 `✓ K5… 588ms` | ✅ |
| 用例名以编号开头 | task 条目 1 | verbose 输出确认 9 个用例名均以 S1:/S2:/S3:/S4:/K1:/K2:/K3:/K4:/K5: 开头 | ✅ |
| 每个期望都有断言 | task 条目 1 | 全文 40 个 `expect()` 调用，对应九个情形的所有期望 | ✅ |

### 条目 2：测试搭建方式

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| 沙箱模式，照 v046-b35/new.test.ts 搭法 | task 条目 2 | `test/output-tail.test.ts:7-13` 导入 Sandbox/FakeRunner/honestClaims 等, `:20-29` `addSplitScript` 在沙箱里写 split.sh 并加到全局验收命令, `:32-42` `honestRunner` 用 FakeRunner | ✅ |
| split.sh 往标准错误打印用 `>&2` | task 条目 2 | `:71` `echo "progress $i" >&2`, `:313` `echo "token=tok-secret-12345" >&2`, `:150-152` `echo "e1" >&2` 等 | ✅ |

### 条目 3：不改别的测试

| 要求 | 出处 | 证据 | 满足 |
|---|---|---|---|
| 不改别的测试 | task 条目 3 | `git diff 81a6625f..8838cd4c -- test/ ':(exclude)test/output-tail.test.ts'` 输出为空 | ✅ |
| test/acceptance/ 下现有测试照常通过 | task 条目 3 | `npm test` 全 80 文件 1556 测试通过 | ✅ |

### 额外禁止逐条核对

| 禁止项 | 出处 | 证据 | 满足 |
|---|---|---|---|
| 不改动 `src/` | task 额外禁止 | `git diff … -- src/` 空 | ✅ |
| 不改动 `scripts/` | task 额外禁止 | `git diff … -- scripts/` 空 | ✅ |
| 不改动受保护路径 | task 额外禁止 | 受保护路径 diff 空 | ✅ |
| 不改动 `test/acceptance/` | task 额外禁止 | `git log … -- test/acceptance` 空 | ✅ |
| 不改动 `.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json` | task 额外禁止 | diff stat 只有 test/output-tail.test.ts 一个文件 | ✅ |
| 不用「以三个以上反引号开头」模式找收尾围栏 | task 额外禁止 | `test/output-tail.test.ts:206` 和 `:366` 收尾均用 `l === openingFence`（与开头完全相同的精确匹配），不是 startsWith 或正则 | ✅ |
| 不删除/跳过任何测试，不改写已有断言 | task 额外禁止 | 已有测试无任何改动 | ✅ |
| 不拉起真实 runner 或真实网络请求 | task 额外禁止 | 使用 FakeRunner + Sandbox | ✅ |
| 不用机器 git 全局配置 | task 额外禁止 | Sandbox 自带隔离 | ✅ |
| 不新增依赖 | task 额外禁止 | package.json 无改动 | ✅ |

### 不变量数值变化

无。`test/invariants.test.ts` 未被改动。

### 被改写或删去的断言

无。已有测试文件均未被改动。

## 结论与理由

全部 5 条验收命令实跑通过。全部 9 个情形（S1–S4, K1–K5）各有至少一条用例，每个用例名以编号开头，所有期望均有断言（共 40 条 `expect()`）。唯一改动文件为新增的 `test/output-tail.test.ts`（401 行），未触碰 `src/`、`scripts/`、受保护路径、已有测试、或依赖。围栏收尾查找使用精确匹配（`l === openingFence`），符合额外禁止要求。提交已在 `origin/main` 上。

**PASS**

```json
{
  "schema_version": 1,
  "batch_id": "v046-b39",
  "verdict": "PASS",
  "evidence": {
    "commits_actual": ["8838cd4cda72d42004791ebe1d3cda75220ceddf"],
    "verify_results": [
      { "cmd": "npm run lint", "exit_code": 0, "summary": "eslint + prettier 零错误" },
      { "cmd": "npm run typecheck", "exit_code": 0, "summary": "tsc 零错误" },
      { "cmd": "npm test", "exit_code": 0, "summary": "80 files, 1556 tests passed" },
      { "cmd": "npm test -- test/output-tail.test.ts test/acceptance/v046-b35", "exit_code": 0, "summary": "3 files, 17 tests passed" },
      { "cmd": "grep -qF \"output_tail: per-stream tail and fence width (SPEC 16.25)\" test/output-tail.test.ts", "exit_code": 0, "summary": "describe name found" }
    ],
    "remote_has_head": true,
    "ci_conclusion": "unknown",
    "ci_run_url": "",
    "ci_branch_matched": null,
    "deps_diff": [],
    "spec_diff_lines": 0
  },
  "gaps": [],
  "reason": "全部验收命令通过，9 个情形各有至少一条用例且全部实跑通过（40 条断言），仅新增 test/output-tail.test.ts 一个文件，无受保护路径改动，无依赖变更。CI 以 R2 取证为准。"
}
```
