---
schema_version: 1
run_id: r-20261121123134
batch_id: v046-b31
base_sha: 90123bf764d30451e727f76226de170d9e76e91e
created_at: 2026-11-21T12:31:35.674Z
attempt: 1
interrupted_at: null
issued_by: collie
---

# 批次 v046-b31：CI、lint、测试配置列为受保护路径，变异清单加三项（第 16 章第 2 步）

## 你的身份与边界

你的身份、权限边界与工作协议见 `AGENT-worker.md`，全局铁律见 `CONSTRAINTS.md`，
方案来源见 `SPEC.md`。本文件只做本批次提醒。

## 本批次条目（3 个）

1. 读 SPEC 16.21 的「v046-b31」一段。`src/evidence.ts` 的 `PROTECTED_PATHS` 加三项：`.github`、`eslint.config.js`、`vitest.config.ts`（写法照现有各项，每项一行）。
   **worker 的提交改了 `.github/workflows/ci.yml`、`eslint.config.js`、`vitest.config.ts` 当中任何一个：`spec_diff_lines` 大于 0（于是按规则 2 拦停）**
2. `scripts/mutation.ts` 的清单加三项 `protected:.github`、`protected:eslint.config.js`、`protected:vitest.config.ts`（写法照已有的 10 项），共 46 项；清单上方注释里的项数相应改掉。
3. 测试。`test/evidence.test.ts` 加一组 `it.each`，用例名 `counts %s as protected (SPEC 16.21)`，三个路径是 `.github/workflows/ci.yml`、`eslint.config.js`、`vitest.config.ts`；
   `test/mutation.test.ts` 的 `every protected path is in the mutation list`：10 改成 13（点名允许的改写，在「偏离或疑问」里列出）；
   `test/invariants.test.ts` 加一条，用例名 `src/evidence.ts has .github, eslint.config.js and vitest.config.ts in PROTECTED_PATHS (v046-b31)`。
   R1 查过：`test/mutation.test.ts` 的 `has at least 42 items` 用的是「不少于」，不用改；`test/prepare-acceptance.test.ts`、`test/redcheck.test.ts` 往自己的临时仓库里写 `vitest.config.ts`，不经过 R2 的取证，不受影响；
   没有现有测试让假 worker 的提交带上这三类文件再去取证。
   别的现有用例因为本批次的新行为而失败时：只许做新行为直接要求的最小改动（往序列里加事件、个数加一这一类），不许删断言、不许把断言改松，在「偏离或疑问」里逐条列出原断言与现断言；拿不准是不是新行为直接要求的，才停下不改，写明是哪一条。

## 验收标准（可机器判定）

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 取证与变异清单的测试通过 | `npm test -- test/evidence.test.ts test/mutation.test.ts` | exit 0 |
| 三个路径进了清单，新用例在 | `grep -qF "'.github'," src/evidence.ts && grep -qF "'eslint.config.js'," src/evidence.ts && grep -qF "'vitest.config.ts'," src/evidence.ts && grep -qF "as protected (SPEC 16.21)" test/evidence.test.ts` | exit 0 |
| 变异检查全部被发现，工作区里没有留下报告 | `out=$(npx tsx scripts/mutation.ts 2>&1) && printf '%s\n' "$out" \| tail -n 1 \| grep -qE "^mutation: caught 46 survived 0 invalid 0 timeout 0 stale 0$" && ! test -e .vitest` | exit 0 |
| 不变量同步 | `grep -qF "in PROTECTED_PATHS (v046-b31)" test/invariants.test.ts` | exit 0 |

## 本批次额外禁止

- 改动任何受保护路径；改动 `.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`、`templates/collie.toml`
- 改动 `src/` 下 `src/evidence.ts` 以外的文件；改动任何一条仲裁规则的判定；从 `PROTECTED_PATHS` 里去掉或改写已有的项
- 为了让测试过而删除或跳过任何测试；改写条目 3 点名之外的任何已有断言
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；用到机器的 git 全局配置；新增依赖

## 汇报要求

完成后写 `.collie/batches/v046-b31/report.md`：固定四段（做了什么 / 测试结果 / 偏离或疑问 / 下一步建议）
+ 尾部围栏 JSON 块，格式见 SPEC 3.4。
写完后以 `report(collie): v046-b31` 为提交信息单独提交并推送该文件。
