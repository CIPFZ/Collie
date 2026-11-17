---
schema_version: 1
run_id: r-20261117105351
batch_id: v046-b01
base_sha: c5827c7a5bd3ecab1b3b2174045b29b44d6f4745
created_at: 2026-11-17T10:53:52.295Z
attempt: 1
interrupted_at: null
issued_by: collie
---

# 批次 v046-b01：配置解耦：测试不再盯着本仓库 .collie/collie.toml 里的数值

## 你的身份与边界

你的身份、权限边界与工作协议见 `AGENT-worker.md`，全局铁律见 `CONSTRAINTS.md`，
方案来源见 `SPEC.md`。本文件只做本批次提醒。

## 本批次条目（3 个）

1. 新文件 `test/support/template-config.ts`，导出 `templateConfig()`：读 `templates/collie.toml`，把 `{{name}}`、`{{repo}}` 换成固定值后解析，返回配置对象。
   下面 7 个测试文件里从仓库自己的 `.collie/collie.toml` 取配置的地方（`loadConfig(repoRoot)` 与 `loadConfig(join(import.meta.dirname, '..'))`）都改用它：
   `test/cli.test.ts`、`test/config.test.ts`、`test/evidence.test.ts`、`test/reviewer-isolation.test.ts`、`test/reviewer.test.ts`、`test/runner-claude.test.ts`、`test/worker.test.ts`。
   `test/config.test.ts` 只留一条读本仓库配置的用例：它能加载、能通过校验，不断言任何数值。
   **做完之后的样子：把 `.collie/collie.toml` 里 reviewer 的 `max_turns` 改成 61、`wallclock_secs` 改成 3601，`npm test` 仍然全过。**
   **这一条由操作员在队列结束后在仓库副本里验证。你不要改 `.collie/collie.toml`，临时改也不行：它是受保护路径，留在工作区里会被拦停**
2. `scripts/mutation.ts`：临时副本不再复制 `.collie/`，改为复制 `templates/`（`test/evidence.test.ts` 改读模板之后不再需要本仓库的配置）。清单的 42 项不动。
3. 允许改写的旧用例只有下面几处，每一处都在「偏离或疑问」里列出用例名、原断言、现断言：
   `test/config.test.ts` 的 `config: the repository .collie/collie.toml` 一组（6 条）：断言的数值原样保留，一条不删、不放宽，只把对象从本仓库配置换成模板配置，组名相应改掉；`project` 那一条按 `templateConfig()` 填的固定值断言。
   `test/cli.test.ts` 的 `renders to exactly the SPEC 3.1 config the repository uses (no drift)`：改成「模板填上名字和仓库地址后能通过校验」，不再和本仓库配置比；`init derives the repo from an SSH origin…` 里的 `config.limits` 改成和模板配置的 `limits` 比。
   `test/reviewer.test.ts` 的 `launches role reviewer in root with the configured turns`：`maxTurns: 60` 改成取所用配置对象里的值。
   `test/invariants.test.ts` 加「`test/` 下的测试文件里，从仓库根加载配置的只有 `test/config.test.ts` 里的一处」。

## 验收标准（可机器判定）

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 改过的 7 个测试文件通过 | `npm test -- test/cli.test.ts test/config.test.ts test/evidence.test.ts test/reviewer-isolation.test.ts test/reviewer.test.ts test/runner-claude.test.ts test/worker.test.ts` | exit 0 |
| 取模板配置的函数存在，7 个文件都用上了 | `grep -qE "export function templateConfig" test/support/template-config.ts && grep -lE "templateConfig\(" test/*.test.ts \| grep -c . \| grep -qE "^([7-9]\|[1-9][0-9])$"` | exit 0 |
| 从仓库根加载配置的只剩 config.test.ts 里的一处 | `grep -nE "loadConfig\((repoRoot\|ROOT\|join\(import\.meta\.dirname)" test/*.test.ts \| grep -v "^test/invariants.test.ts:" \| grep -c . \| grep -qx 1 && grep -qE "loadConfig\((repoRoot\|ROOT\|join\(import\.meta\.dirname)" test/config.test.ts` | exit 0 |
| 变异副本复制模板，不再复制 .collie（不看注释行） | `! grep -vE "^\s*(//\|\*\|/\*)" scripts/mutation.ts \| grep -qF "'.collie'" && grep -qF "'templates'" scripts/mutation.ts` | exit 0 |
| 变异检查全部被发现，工作区里没有留下报告 | `out=$(npx tsx scripts/mutation.ts 2>&1) && printf '%s\n' "$out" \| tail -n 1 \| grep -qE "^mutation: caught 42 survived 0 invalid 0 timeout 0 stale 0$" && ! test -e .vitest` | exit 0 |
| 不变量同步 | `grep -qE "templateConfig\|template-config" test/invariants.test.ts` | exit 0 |

## 本批次额外禁止

- 改动任何受保护路径（含 `.collie/collie.toml`，临时改也不行）；改动 `templates/collie.toml`、`.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`
- 改动 `src/` 下任何文件；改动 `test/support/sandbox.ts`
- 删除或跳过任何测试；改写条目 3 点名之外的任何已有断言；把点名用例里断言的数值删掉或放宽；从变异清单里去掉任何一项
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；新增依赖

## 汇报要求

完成后写 `.collie/batches/v046-b01/report.md`：固定四段（做了什么 / 测试结果 / 偏离或疑问 / 下一步建议）
+ 尾部围栏 JSON 块，格式见 SPEC 3.4。
写完后以 `report(collie): v046-b01` 为提交信息单独提交并推送该文件。
