---
schema_version: 1
run_id: r-20261118063548
batch_id: v046-b09
base_sha: 818770dc861c634bb106de737c43f9cd1be26859
created_at: 2026-11-18T06:35:49.254Z
attempt: 1
interrupted_at: null
issued_by: collie
---

# 批次 v046-b09：测试只依赖自己带的环境：git 身份、私有临时目录、不绑本仓库配置；沙箱可留 journal

## 你的身份与边界

你的身份、权限边界与工作协议见 `AGENT-worker.md`，全局铁律见 `CONSTRAINTS.md`，
方案来源见 `SPEC.md`。本文件只做本批次提醒。

## 本批次条目（3 个）

1. 读 SPEC 16.13 的第一段与 14.25 开头关于 CI 的那一段。`test/prepare-acceptance.test.ts`：文件里的每一次 `git commit` 都用测试自己设的身份，不用机器的全局配置
   （可以改用 `Sandbox`，也可以让辅助函数设的身份在整个用例期间有效；用完还原环境变量）。
   同一文件与 `test/redcheck.test.ts`：各自建一个私有的临时目录（在系统临时目录下），把 `process.env.TMPDIR` 指过去，结束时还原并删掉；
   「没有 `collie-accept-*` / `collie-redcheck-*` 残留」的断言只看这个私有目录。两个文件里别的断言不改。
   **没有任何 git 全局身份时（`GIT_CONFIG_GLOBAL` 指向一个空文件、`GIT_CONFIG_NOSYSTEM=1`），`test/prepare-acceptance.test.ts` 全部通过；**
   **系统临时目录里事先有别人的 `collie-accept-other` 与 `collie-redcheck-other` 两个目录时，这两个测试文件全部通过，跑完那两个目录还在**
2. `test/config.test.ts`：v046-b07 加的 `.collie/collie.toml loads without tester_max or verify.static` 断言的是本仓库配置里现在没有这两项，
   R1 之后要往本仓库配置里加它们。把这一条改成用内联配置（从 `VALID_TOML` 里去掉这两行）证明「没有这两项的配置能加载，`limits.tester_max` 是 2、`verify` 里没有 `static`」，不读本仓库的配置。
   `test/invariants.test.ts`：v046-b01 那条不变量旁边加一条，数出现的次数：`test/config.test.ts` 里从仓库根加载配置（`loadConfig(repoRoot)` 这一类）的恰好一处。
   允许改写的旧用例只有上面点名的这一条，在「偏离或疑问」里列出原断言与现断言。
   **做完之后的样子：往本仓库的 `.collie/collie.toml` 里加 `tester_max = 3` 与 `static = ["npm run lint"]`，`npm test` 仍然全过。这一条由操作员在仓库副本里验证，你不要改 `.collie/collie.toml`**
3. `test/support/sandbox.ts`：设了环境变量 `COLLIE_TEST_KEEP_RUNS=<目录>` 时，`dispose()` 在删除沙箱之前把沙箱仓库的 `.collie/runs/` 整个复制到 `<目录>/<沙箱目录名>/runs/`，
   并在 `<目录>/<沙箱目录名>/TEST_NAME` 里写下当前用例的全名（取不到就写空）。沙箱里没有 `.collie/runs/` 时只写 `TEST_NAME`。不设这个环境变量时行为与现在完全一样。复制出错不许让用例失败。
   新文件 `test/sandbox-keep.test.ts`，一组 `describe('sandbox: COLLIE_TEST_KEEP_RUNS', …)`：设了 → 用假 runner 跑一次 `run` 之后 `dispose()`，目标目录里有 `events.ndjson` 与 `TEST_NAME`；
   不设 → 什么也不留。用例自己设、自己还原这个环境变量，目标目录用完删掉。
   R1 查过：`test/support/sandbox.ts` 的 `dispose()` 现在只还原两个 git 环境变量并删除目录；没有现有用例断言 `dispose()` 之后沙箱外有什么。

## 验收标准（可机器判定）

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 没有 git 全局身份时全部测试通过 | `e=$(mktemp) && GIT_CONFIG_GLOBAL=$e GIT_CONFIG_NOSYSTEM=1 npm test` | exit 0 |
| 临时目录里有别人的同名前缀目录时，两个文件通过，别人的目录还在 | `d=$(mktemp -d) && mkdir "$d/collie-accept-other" "$d/collie-redcheck-other" && TMPDIR=$d npm test -- test/prepare-acceptance.test.ts test/redcheck.test.ts && test -d "$d/collie-accept-other" && test -d "$d/collie-redcheck-other"` | exit 0 |
| config.test.ts 里从仓库根加载配置的恰好一处 | `grep -cE "loadConfig\((repoRoot\|ROOT\|join\(import\.meta\.dirname)" test/config.test.ts \| grep -qx 1` | exit 0 |
| 留 journal 的开关管用 | `d=$(mktemp -d) && COLLIE_TEST_KEEP_RUNS=$d npm test -- test/queue-limit.test.ts && find "$d" -name events.ndjson \| grep -q . && find "$d" -name TEST_NAME \| grep -q .` | exit 0 |
| 开关的用例组在 | `grep -qF "sandbox: COLLIE_TEST_KEEP_RUNS" test/sandbox-keep.test.ts` | exit 0 |

## 本批次额外禁止

- 改动任何受保护路径（含 `.collie/collie.toml`）；改动 `.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`；改动 `src/`、`scripts/`、`templates/` 下任何文件
- 为了让测试过而删除或跳过任何测试；改写条目 2 点名之外的任何已有断言（条目 1 里两处「没有残留」的断言只许改它看的目录）
- 在测试里改机器的 git 全局配置，或往仓库自己的 `.git/config` 里写身份
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；新增依赖

## 汇报要求

完成后写 `.collie/batches/v046-b09/report.md`：固定四段（做了什么 / 测试结果 / 偏离或疑问 / 下一步建议）
+ 尾部围栏 JSON 块，格式见 SPEC 3.4。
写完后以 `report(collie): v046-b09` 为提交信息单独提交并推送该文件。
