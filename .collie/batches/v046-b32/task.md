---
schema_version: 1
run_id: r-20261121125105
batch_id: v046-b32
base_sha: 086c58b97b8d790920a80e14f6fcf97492a7fb22
created_at: 2026-11-21T12:51:05.923Z
attempt: 1
interrupted_at: null
issued_by: collie
---

# 批次 v046-b32：批次授权：条目点名的受保护路径由 worker 改，不计入受保护文件改动行数（D9）

## 你的身份与边界

你的身份、权限边界与工作协议见 `AGENT-worker.md`，全局铁律见 `CONSTRAINTS.md`，
方案来源见 `SPEC.md`。本文件只做本批次提醒。

## 本批次条目（3 个）

1. 读 SPEC 16.21 的「v046-b32」一段。`src/backlog.ts`、`src/schema/index.ts`：批次可以多一个可选小节，标签是「可改的受保护路径」加冒号（全角半角都认，写法照 `LABEL_INTERFACES`），下面是 `- <路径>` 的列表（允许空行，照「接口」一节）；
   解析结果多一个可选字段 `allowed_protected`。能点名的只有 `.github`、`.github/` 下的路径、`eslint.config.js`、`vitest.config.ts`；别的一律报错并指出是哪一项。
   `src/roles/worker.ts`：有这一节时，`task.md` 在「本批次条目」之后多一节「本批次可改的受保护路径」，逐条列出，后面一句「只做条目要求的改动，并在『偏离或疑问』里列出改了什么」。
   **批次有这一节、两行是 `- vitest.config.ts` 与 `- .github/workflows/ci.yml`：`allowed_protected` 是这两项，`task.md` 里有「本批次可改的受保护路径」一节两条；**
   **点名 `SPEC.md`、`docs/backlog.md`、`test/acceptance/x.test.ts`、`.collie/collie.toml`、`../x`、`/etc/x`、`.github/*` 当中任何一个：解析报错，错误信息里有那一项；没有这一节的批次：没有 `allowed_protected` 这个键，`task.md` 逐字节不变**
2. `src/evidence.ts`、`src/run.ts`：取证时把本批次 `allowed_protected` 里的路径排除在受保护文件改动行数之外，这部分行数另记在 `evidence.collected` 事件的 `authorized_diff_lines`（批次没有授权时不带这个字段）。别的受保护路径照计。
   **批次授权了 `vitest.config.ts`，worker 的提交只改了它和普通源码：`spec_diff_lines` 是 0，`evidence.collected` 带 `authorized_diff_lines` 且大于 0，reviewer 判 PASS 时批次通过；**
   **同一个批次 worker 还改了 `eslint.config.js`（没有授权）：`spec_diff_lines` 大于 0，按规则 2 拦停；没有授权的批次改了 `vitest.config.ts`：按规则 2 拦停，`evidence.collected` 不带 `authorized_diff_lines`**
3. 测试。`test/backlog.test.ts` 新加一组 `describe('backlog: allowed protected paths', …)`（条目 1 的解析情形）；`test/task-envelope.test.ts` 加条目 1 里任务书的两种情形；
   新文件 `test/batch-authorisation.test.ts`，一组 `describe('batch authorisation: named protected paths do not count', …)`，用 `Sandbox` 与 `FakeRunner` 跑条目 2 的三种情形（沙箱 backlog 的写法照 `test/tester-step.test.ts` 里带「情形」的那种，自己拼小节）。
   `test/invariants.test.ts` 加「`src/backlog.ts` 里有 `可改的受保护路径`」与「`src/run.ts` 里有 `authorized_diff_lines`」。
   R1 查过：`docs/backlog.md` 现有的批次都没有这一节，`test/task-envelope.test.ts` 逐条跑真实批次的那两组不受影响；`evidence.collected` 只在有授权时多一个字段，`test/exit-codes.test.ts` 的事件序列不变；
   `BatchSchema` 加的是可选字段，现有夹具不用改。已有断言一条都不改。
   别的现有用例因为本批次的新行为而失败时：只许做新行为直接要求的最小改动（往序列里加事件、个数加一这一类），不许删断言、不许把断言改松，在「偏离或疑问」里逐条列出原断言与现断言；拿不准是不是新行为直接要求的，才停下不改，写明是哪一条。

## 验收标准（可机器判定）

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 没有 git 全局身份时新测试通过 | `e=$(mktemp) && GIT_CONFIG_GLOBAL=$e GIT_CONFIG_NOSYSTEM=1 npm test -- test/batch-authorisation.test.ts` | exit 0 |
| 解析、任务书、取证的测试通过 | `npm test -- test/backlog.test.ts test/task-envelope.test.ts test/evidence.test.ts test/batch-authorisation.test.ts` | exit 0 |
| 两组新用例在 | `grep -qF "backlog: allowed protected paths" test/backlog.test.ts && grep -qF "batch authorisation: named protected paths do not count" test/batch-authorisation.test.ts` | exit 0 |
| 解析与取证都认得授权（不看注释行） | `grep -vE "^\s*(//\|\*\|/\*)" src/backlog.ts \| grep -qF "可改的受保护路径" && grep -vE "^\s*(//\|\*\|/\*)" src/run.ts \| grep -qF "authorized_diff_lines"` | exit 0 |
| 变异检查仍然全部被发现 | `out=$(npx tsx scripts/mutation.ts 2>&1) && printf '%s\n' "$out" \| tail -n 1 \| grep -qE "^mutation: caught 46 survived 0 invalid 0 timeout 0 stale 0$" && ! test -e .vitest` | exit 0 |
| 不变量同步 | `grep -qF "authorized_diff_lines" test/invariants.test.ts` | exit 0 |

## 本批次额外禁止

- 改动任何受保护路径；改动 `.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`、`templates/collie.toml`、`scripts/mutation.ts`
- 改动 `src/arbiter.ts`、`src/gate.ts`、`src/acceptance.ts`、`src/redcheck.ts`、`src/roles/reviewer.ts`、`src/roles/tester.ts`、`src/runner/`；改动任何一条仲裁规则的判定；从 `PROTECTED_PATHS` 里去掉任何一项
- 让授权能点名那三类之外的路径；让授权来自 backlog 之外的任何地方（task、report、配置、环境变量）；有授权时把别的受保护路径也放过
- 为了让测试过而删除或跳过任何测试；改写任何已有断言
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；用到机器的 git 全局配置；新增依赖

## 汇报要求

完成后写 `.collie/batches/v046-b32/report.md`：固定四段（做了什么 / 测试结果 / 偏离或疑问 / 下一步建议）
+ 尾部围栏 JSON 块，格式见 SPEC 3.4。
写完后以 `report(collie): v046-b32` 为提交信息单独提交并推送该文件。
