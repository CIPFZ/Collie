---
schema_version: 1
run_id: r-20261118042552
batch_id: v046-b08
base_sha: c475eaa11ad0caf9eaced1edda535b2316304274
created_at: 2026-11-18T04:25:53.035Z
attempt: 2
interrupted_at: null
issued_by: collie
---

# 批次 v046-b08：测试 agent 这一步的模块：拉起、红检查、重写、只取走点名的文件（不接进队列）

## 你的身份与边界

你的身份、权限边界与工作协议见 `AGENT-worker.md`，全局铁律见 `CONSTRAINTS.md`，
方案来源见 `SPEC.md`。本文件只做本批次提醒。

## 本批次条目（3 个）

1. 读 SPEC 16.12 的「测试 agent 这一步怎么走」前五条与「v046-b08」一段（红检查的接口在 `src/redcheck.ts`）。新文件 `src/acceptance.ts`，导出 `prepareAcceptance(opts)`：
   `opts` 有 `root`、`headSha`、`batch`、`config`、`runner`、`testerMax`、`redCheckOpts`，以及可选的 `record(事件名, 字段)` 与可选的 `redCheck`（缺省是 `runRedCheck`）。
   它在系统临时目录下建一个检出于 `headSha` 的 git worktree（目录名以 `collie-accept-` 开头；主仓库有 `node_modules` 就链进去），在里面最多拉起测试 agent `testerMax` 次：
   每次拉起之后做红检查；过了就结束；不过就把问题清单交给下一次。测试 agent 以非零退出的那一次不做红检查，直接算没过，原因写明退出码。
   过了之后只取走 `test/acceptance/<批次>/` 下的 `new.test.ts`、`MAP.md`，以及批次有 `[保持]` 情形时的 `keep.test.ts`；
   批次有 `[保持]` 情形而没有 `keep.test.ts`、或没有 `MAP.md`，算这一次没过。
   返回 `{ ok: true, attempts, files }`（每个文件有相对仓库根的 `path` 与 `content`）或 `{ ok: false, attempts, problems }`（字符串数组，最后一次的原因）。
   它不往 `root` 写任何东西、不提交；不论成败、是否抛错，结束时那个 worktree 都要拿掉。给了 `record` 时，每次拉起记 `tester.started` 与 `tester.finished`，每次红检查记 `redcheck.result`，字段见 SPEC 16.12「事件」一条。
   **第 1 次红检查不过、第 2 次过：测试 agent 一共被拉起 2 次，第 2 次的提示词里有第 1 次每一条问题的原文，返回 `ok` 为 true、`attempts` 为 2；**
   **`testerMax` 是 2 而两次都不过：测试 agent 恰好被拉起 2 次，返回 `ok` 为 false、`attempts` 为 2，`problems` 是第 2 次的原因；**
   **测试 agent 另外写了 `src/sneaky.ts` 和输出目录里的 `extra.ts`：返回的 `files` 里没有它们，主仓库 `git status --porcelain` 为空，`git worktree list` 只剩 1 行，系统临时目录里没有留下 `collie-accept-*`**
2. `src/roles/tester.ts`：`TesterInputSchema` 加可选的 `previous_problems`（非空字符串的数组）；非空时提示词在「情形」之前多一节「上一次没过的原因」，逐条原样列出，并写一句「只改有问题的地方，改完重新自检」。
   不给或为空数组时，提示词与现在逐字相同。
3. 新文件 `test/prepare-acceptance.test.ts`，三组：
   `describe('prepareAcceptance: retry loop', …)`：条目 1 前两处加粗的情形；测试 agent 非零退出的一次；`record` 收到的事件名与先后（两次都拉起时是 started、finished、result 各两条）。红检查用注入的假函数按次给结果。
   `describe('prepareAcceptance: what is taken from the tree', …)`：条目 1 第三处加粗的情形；有 `[保持]` 情形而没有 `keep.test.ts` → 没过；没有 `[保持]` 情形而测试 agent 写了 `keep.test.ts` → `files` 里没有它；没有 `MAP.md` → 没过；注入的红检查抛错 → 错误照常抛出，worktree 仍被拿掉。
   `describe('prepareAcceptance: real red check', …)`：一条，不注入 `redCheck`：`FakeRunner` 往工作目录里写一个真实的、两条用例都会失败的 `new.test.ts` 与一份 `MAP.md`，用真实的 `runRedCheck`（真实的 vitest，不带静态命令）→ `ok` 为 true。
   没有这一条，前两组什么也证明不了：它们的红检查是假的。
   做法：用 `Sandbox` 建仓库，自己往里提交一份 `AGENT-tester.md`；配置用 `templateConfig()`；测试 agent 用 `FakeRunner`（`files` 写进它拿到的工作目录）。不改 `test/support/sandbox.ts`。
   `test/tester.test.ts` 新加一组 `describe('tester: previous problems in the prompt', …)`：给了两条 → 两条原文都在、位置在「情形」之前；不给与给空数组 → 提示词与不带这个字段时逐字相同。
   R1 查过现有用例：`test/tester.test.ts` 的 `accepts a valid input with exactly five fields` 只断言能通过校验，多一个可选字段不影响它；`rejects an extra field (strict object)` 用的键是 `extra`，仍然应当被拒绝。
   已有用例一条都不改；你发现有别的现有用例与本批次冲突，停下，在「偏离或疑问」里写明是哪一条，不要自己改。
   `test/invariants.test.ts` 加「`src/acceptance.ts` 里有 `removeWorktree`」与「`src/run.ts` 的非注释行里没有 `acceptance.js`（还没有导入这个模块）」（后一条到接线那一批由那一批改掉）

## 验收标准（可机器判定）

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 模块与提示词的测试通过，仓库里没有留下报告 | `npm test -- test/prepare-acceptance.test.ts test/tester.test.ts && ! test -e .vitest` | exit 0 |
| 模块的三组用例在 | `grep -qF "prepareAcceptance: retry loop" test/prepare-acceptance.test.ts && grep -qF "prepareAcceptance: what is taken from the tree" test/prepare-acceptance.test.ts && grep -qF "prepareAcceptance: real red check" test/prepare-acceptance.test.ts` | exit 0 |
| 提示词的新用例组在 | `grep -qF "tester: previous problems in the prompt" test/tester.test.ts` | exit 0 |
| 函数导出了，队列还没有用它（不看注释行） | `grep -qE "export (async )?function prepareAcceptance" src/acceptance.ts && ! grep -vE "^\s*(//\|\*\|/\*)" src/run.ts \| grep -qE "acceptance\.js"` | exit 0 |
| 测试不在系统临时目录留下工作目录 | `d=$(mktemp -d) && TMPDIR=$d npm test -- test/prepare-acceptance.test.ts && ! ls -d "$d"/collie-accept-* >/dev/null 2>&1` | exit 0 |
| 不变量同步 | `grep -qF "removeWorktree" test/invariants.test.ts && grep -qF "src/acceptance.ts" test/invariants.test.ts` | exit 0 |

## 本批次额外禁止

- 改动任何受保护路径（含 `AGENT-tester.md`、`.collie/collie.toml`）；改动 `templates/collie.toml`、`.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`
- 改动 `src/run.ts`、`src/redcheck.ts`、`src/backlog.ts`、`src/schema/index.ts`、`src/evidence.ts`、`src/roles/worker.ts`、`src/roles/reviewer.ts`、`src/runner/`、`src/arbiter.ts`、`src/gate.ts`、`test/support/sandbox.ts`；把这个模块接进队列或加命令行子命令
- 让 `prepareAcceptance` 往主仓库的工作区写文件、提交或推送；让它取走点名之外的任何文件
- 为了让测试过而删除或跳过任何测试；改写任何已有断言
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求（「real red check」那一条可以起真实的 vitest 子进程，别的不行）；新增依赖

## 汇报要求

完成后写 `.collie/batches/v046-b08/report.md`：固定四段（做了什么 / 测试结果 / 偏离或疑问 / 下一步建议）
+ 尾部围栏 JSON 块，格式见 SPEC 3.4。
写完后以 `report(collie): v046-b08` 为提交信息单独提交并推送该文件。

## 上一轮判 FIX

### 降级原因

- 规则 9：ci_conclusion=failure

### 上一轮代码提交

- `eacde6dc99b158ffd3b2ed3663b459636681ef19`
- `777ce2a6316797555c64728e39b15900df953ab5`

这些提交已在审核范围内，只补缺口，不要重做。
