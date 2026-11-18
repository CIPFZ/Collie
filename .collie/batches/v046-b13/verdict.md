All evidence collected. Let me now write the final verdict.

# 批次 v046-b13 审核

## 取证过程

### 1. 提交事实

```
$ git log 715c4893..3252fbf1 --oneline -- . ':(exclude).collie/batches'
3252fbf test: fingerprint index-lock tests; git: disable autoRefreshIndex in computeFingerprint (SPEC 16.14)
```

单一提交，改了 2 个文件：`src/ladder.ts`（+4 −1）、`test/fingerprint-lock.test.ts`（+111，新文件）。

```
$ git rev-parse 3252fbf1a3ff4125febd14a14ce82636bdb73528
3252fbf1a3ff4125febd14a14ce82636bdb73528
```

提交存在。

### 2. 推送验证

```
$ git ls-remote origin refs/heads/main
44c066ad537c0743fb9dc16ebef559387b7441db	refs/heads/main

$ git merge-base --is-ancestor 3252fbf1a3ff4125febd14a14ce82636bdb73528 44c066ad537c0743fb9dc16ebef559387b7441db
(exit 0 — is ancestor)

$ git log --oneline 3252fbf1..44c066ad
44c066a report(collie): v046-b13
```

`head_sha` 是 remote main 的祖先，唯一后续提交是 report 信封。`remote_has_head: true`。

### 3. 受保护路径

```
$ git diff --stat 715c4893..3252fbf1 -- SPEC.md CONSTRAINTS.md ROADMAP.md ROLES.md 'AGENT-*.md' docs/backlog.md docs/decisions docs/progress.md .collie/collie.toml
(empty)
```

零行改动。

### 4. 额外禁止路径

```
$ git diff --stat 715c4893..3252fbf1 -- .github/ eslint.config.js vitest.config.ts package.json
(empty)

$ git diff --stat 715c4893..3252fbf1 -- src/git.ts src/run.ts src/evidence.ts src/acceptance.ts 'src/runner/' 'src/roles/'
(empty)
```

均未触及。

### 5. 依赖变化

```
$ git diff 715c4893..3252fbf1 -- package.json package-lock.json
(empty)
```

无依赖变化。

### 6. 验收命令实跑

| # | 命令 | 退出码 | 输出摘要 |
|---|---|---|---|
| 1 | `npm run lint` | 0 | `All matched files use Prettier code style!` |
| 2 | `npm run typecheck` | 0 | （无错误输出） |
| 3 | `npm test` | 0 | `Test Files 65 passed (65), Tests 1355 passed (1355)` |
| 4 | `npm test -- test/fingerprint-lock.test.ts test/scenario-g.test.ts` | 0 | `Test Files 2 passed (2), Tests 8 passed (8)` |
| 5 | `grep -qF "fingerprint: never rewrites the git index" test/fingerprint-lock.test.ts && grep -qF "Sandbox" test/fingerprint-lock.test.ts` | 0 | （静默通过） |

### 7. 行为要求实跑

```
$ npx vitest run test/fingerprint-lock.test.ts
Test Files  1 passed (1)
Tests  4 passed (4)

$ npx vitest run test/scenario-g.test.ts
Test Files  1 passed (1)
Tests  4 passed (4)
```

## 逐条验收

| 验收项 | 命令 | 实测结果 | 通过 |
|---|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 | ✅ |
| 类型检查零错误 | `npm run typecheck` | exit 0 | ✅ |
| 全部测试通过 | `npm test` | exit 0, 65 files, 1355 tests all passed | ✅ |
| 指纹的两组测试通过 | `npm test -- test/fingerprint-lock.test.ts test/scenario-g.test.ts` | exit 0, 2 files, 8 tests all passed | ✅ |
| 新的一组用例在，且用的是沙箱 | `grep -qF …` | exit 0 | ✅ |

## 条目要求与额外禁止

### 结构要求

| 要求 | 出处 | 证据（文件:行 / 命令输出） | 满足 |
|---|---|---|---|
| 新文件 `test/fingerprint-lock.test.ts` | 条目 1 | 文件存在（diff 新增 111 行） | ✅ |
| `describe('fingerprint: never rewrites the git index', …)` | 条目 1 | `test/fingerprint-lock.test.ts:22` — `describe('fingerprint: never rewrites the git index', () => {` | ✅ |
| 用 `Sandbox` 建仓库 | 条目 1 | `test/fingerprint-lock.test.ts:10` — `import { Sandbox } from './support/sandbox.js';` ；`:15` — `box = await Sandbox.create();` | ✅ |
| 提交一个文件；改 mtime 不改内容 | 条目 1 | `test/fingerprint-lock.test.ts:25-32` — `box.write('hello.txt', 'hello\n')` → `git add` → `git commit` → `utimesSync(…, past, past)` | ✅ |
| 记下 inode 与 mtime | 条目 1 | `test/fingerprint-lock.test.ts:35-36` — `const before = statSync(indexPath);` | ✅ |
| 连调 5 次 `computeFingerprint` | 条目 1 | `test/fingerprint-lock.test.ts:44-47` — `for (let i = 0; i < 5; i++) { await computeFingerprint(box.root); }` | ✅ |
| 断言 inode 与 mtime 没变 | 条目 1 | `test/fingerprint-lock.test.ts:55-57` — `expect(after.ino).toBe(before.ino); expect(after.mtimeMs).toBe(before.mtimeMs);` | ✅ |
| 断言 `index.lock` 未出现 | 条目 1 | `test/fingerprint-lock.test.ts:39-42` — `watch` watcher；`:60` — `expect(lockSeen).toBe(false);` | ✅ |
| `computeFingerprint` 改成不创建 `index.lock` 不改写 index | 条目 2 | `src/ladder.ts:81` — `const diff = await git(root, ['-c', 'diff.autoRefreshIndex=false', 'diff', 'HEAD']);` | ✅ |
| 三条「必须变」的测试 | 条目 3 | `test/fingerprint-lock.test.ts:66`（tracked content）、`:80`（HEAD change）、`:94`（untracked added/changed） | ✅ |
| `scenario-g.test.ts` 的 `computeFingerprint: content-sensitive` 未改 | 条目 3 | `git diff 715c4893..3252fbf1 -- test/scenario-g.test.ts` → 空 | ✅ |
| 不改受保护路径 | 额外禁止 | `git diff --stat` 对全部受保护路径均为空 | ✅ |
| 不改 `.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json` | 额外禁止 | `git diff --stat` 均为空 | ✅ |
| 不改 `src/git.ts`、`src/run.ts`、`src/evidence.ts`、`src/acceptance.ts`、`src/runner/`、`src/roles/` | 额外禁止 | `git diff --stat` 均为空 | ✅ |
| 不改活性检测的阈值、轮询间隔与判定 | 额外禁止 | diff 仅改 `computeFingerprint` 中 `git diff` 的调用方式，未改阈值/间隔/判定逻辑 | ✅ |
| 不删除或跳过任何测试；不改写已有断言 | 额外禁止 | `git diff -- 'test/*.test.ts' ':(exclude)test/fingerprint-lock.test.ts'` → 空，唯一改动是新增文件 | ✅ |
| 测试不拉起真实 runner / 网络请求；不用机器全局 git 配置 | 额外禁止 | 测试使用 `Sandbox`（隔离 git 环境），直接调 `computeFingerprint` | ✅ |
| 不新增依赖 | 额外禁止 | `package.json` / `package-lock.json` diff 为空 | ✅ |

### 行为要求

| 要求 | 出处 | 证据 | 满足 |
|---|---|---|---|
| 指纹对 tracked 内容敏感 | 条目 2 | `npx vitest run test/fingerprint-lock.test.ts` → `Tests 4 passed (4)`，含 `tracked file content change produces different fingerprints` | ✅ |
| HEAD 变了指纹必须变 | 条目 2 | 同上，含 `HEAD change produces different fingerprints` | ✅ |
| 未跟踪文件多了或变了指纹必须变 | 条目 2 | 同上，含 `untracked file added or changed produces different fingerprints` | ✅ |
| computeFingerprint 不创建 index.lock 不改 index | 条目 1/2 | 同上，含 `calling 5 times with stale timestamps leaves .git/index unchanged` | ✅ |
| 已有的 scenario-g content-sensitive 组照常通过 | 条目 3 | `npx vitest run test/scenario-g.test.ts` → `Tests 4 passed (4)` | ✅ |

### 不变量数值变化

`git diff 715c4893..3252fbf1 -- test/invariants.test.ts` → 空。**无。**

### 被改写或删去的断言

`git diff 715c4893..3252fbf1 -- 'test/*.test.ts' ':(exclude)test/fingerprint-lock.test.ts'` → 空。唯一改动是新增文件。**无。**

## 结论与理由

全部 5 条验收命令实跑通过。提交存在且已推送至远端。无受保护文件被修改，无新增依赖。diff 范围严格在 `src/ladder.ts`（1 行改动）与新增 `test/fingerprint-lock.test.ts` 内，完全落在 task 条目之内。

条目的结构要求逐条满足：
- 条目 1：新测试文件结构、describe 名称、Sandbox 使用、mtime 修改、inode/mtime 断言、index.lock watch 均到位
- 条目 2：`diff.autoRefreshIndex=false` 让 `git diff` 不刷新索引，实测 index 不变、lock 不出现
- 条目 3：三条「必须变」测试齐全；scenario-g 未改且通过

行为要求通过实跑 `npx vitest run` 均已确认通过。额外禁止逐条核对均未违反。

```json
{
  "schema_version": 1,
  "batch_id": "v046-b13",
  "verdict": "PASS",
  "evidence": {
    "commits_actual": ["3252fbf1a3ff4125febd14a14ce82636bdb73528"],
    "verify_results": [
      { "cmd": "npm run lint", "exit_code": 0, "summary": "eslint + prettier pass" },
      { "cmd": "npm run typecheck", "exit_code": 0, "summary": "tsc pass" },
      { "cmd": "npm test", "exit_code": 0, "summary": "65 files, 1355 tests passed" },
      { "cmd": "npm test -- test/fingerprint-lock.test.ts test/scenario-g.test.ts", "exit_code": 0, "summary": "2 files, 8 tests passed" },
      { "cmd": "grep -qF \"fingerprint: never rewrites the git index\" test/fingerprint-lock.test.ts && grep -qF \"Sandbox\" test/fingerprint-lock.test.ts", "exit_code": 0, "summary": "both patterns found" }
    ],
    "remote_has_head": true,
    "ci_conclusion": "unknown",
    "ci_run_url": "",
    "ci_branch_matched": null,
    "deps_diff": [],
    "spec_diff_lines": 0
  },
  "gaps": [],
  "reason": "全部验收命令通过；提交已推送；无受保护文件或禁止文件被改；无依赖变化；条目的结构与行为要求逐条核对均满足；CI 以 R2 取证为准。"
}
```
