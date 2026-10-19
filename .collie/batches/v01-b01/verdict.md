# 批次 v01-b01 审核

审核者：R4（由 R1 所在会话以干净上下文占位执行）
审核对象：`dd6a711..e99fde3`（worker 的 4 个提交）
审核时间：2026-10-16

## 取证过程

全部为实跑命令，未采信汇报。

| 取证项 | 命令 | 真实结果 |
|---|---|---|
| 提交存在于远端 | `git fetch && git log 3aa90dd..origin/main` | 4 个提交 `134ea31` `3f4992d` `e5c7d3f` `e99fde3`，与声称一致 |
| 受保护文件 | `git diff --stat dd6a711..e99fde3 -- SPEC.md CONSTRAINTS.md … .collie/collie.toml` | 空，零触碰 |
| 改动范围 | `git diff --stat dd6a711..e99fde3` | 17 文件，全部为工程配置、`src/`、`test/`，无越界 |
| 依赖安装 | `npm ci` | 138 包，3s |
| 验收 1 lint | `npm run lint` | exit 0 |
| 验收 2 typecheck | `npm run typecheck` | exit 0 |
| 验收 3 全部测试 | `npm test` | exit 0，**111 passed, 0 failed** |
| 验收 4 schema | `npm test -- schema` | exit 0，51 passed |
| 验收 5 journal | `npm test -- journal` | exit 0，28 passed |
| 验收 6 config | `npm test -- config` | exit 0，18 passed |
| 验收 7 CI 分支 | `grep -qE 'branches:\s*\[\s*main\s*\]' .github/workflows/ci.yml` | exit 0 |
| CI 实际结论 | GitHub REST API 按 sha 查询 | **未能取证**：未鉴权配额 0/60，共享出口 IP 已耗尽 |
| lint 变异测试 | 写入 `const stallSecs = 90` 到 `src/` 后 `eslint` | 被 `no-restricted-syntax` 拦下，1 error |
| `eslint-disable` 数量 | `grep -rn eslint-disable src/` | 1 处，`BATCH_ITEMS_MAX = 3`，带 SPEC 3.2 理由注释 |
| journal 无截断写 | `grep writeFileSync\|truncate src/journal.ts` | 无；使用 `openSync('a')` + `fsyncSync` |
| 运行时依赖许可证 | 读 `node_modules/*/package.json` | zod MIT，smol-toml BSD-3-Clause |
| 传递依赖许可证 | 全树扫描 | 仅 `lightningcss` MPL-2.0、`minimatch` BlueOak-1.0.0 在白名单外，均在 dev 树 |

## 逐条验收

| 验收项 | 通过 |
|---|---|
| 7 条命令 | 全部通过 |
| CI 配置监听 main、单行 flow 风格、含 lint/typecheck/test/build 步骤 | 通过（读文件核验） |
| 测试内容覆盖 task 要求 | **超出要求**：journal 覆盖每一种坏行、残行拒写、append-only 前缀断言、O_APPEND 源码检查、v0.2 事件类型拒绝；config 覆盖缺字段/缺节/类型错/嵌套/数组索引/未知字段/版本不符/多错误聚合/TOML 语法行号 |
| 铁律 11 执行 | 通过，且 worker 发现 `no-magic-numbers` 单独不够并补了 `no-restricted-syntax`，变异测试证实 |
| 铁律 19 信封职责 | 通过（worker 未提交 report.md） |

## 声称与实测的差异

无。四个 SHA、111/0 测试数、7 条验收、受保护文件零触碰、许可证事实——全部与实测一致。

## 未取证项

CI 实际结论（4 个提交的 `conclusion` 与 `head_branch`）因 API 限流未能由 R4 独立查询。

**条件已解除（2026-10-16）：** 项目所有者在 GitHub Actions 页面目视确认
`134ea31` `3f4992d` `e5c7d3f` `e99fde3` 四次运行均为 `main / success`。
此确认由人完成，作为本批次 CI 证据的来源记录在案。

## 本轮发现的流程缺口（非 worker 过失）

1. `report.md` 未提交导致 R2/R4 在另一台机器上拿不到它。铁律 19 说信封由 R2 提交，
   但没规定 worker 写完后如何把文件交到 R2 手上——同机假设在分布式场景下不成立。
2. R4 查 CI 依赖未鉴权 API，在共享出口 IP 下不可用。worker 在计划阶段已预警。

## 结论与理由

**PASS**。附加条件已于 2026-10-16 由项目所有者目视确认解除。
全部验收项均由实测证据或人工确认支持，无声称不符，无范围蔓延，测试质量超出要求。

```json
{
  "schema_version": 1,
  "batch_id": "v01-b01",
  "verdict": "PASS",
  "evidence": {
    "commits_actual": ["134ea31", "3f4992d", "e5c7d3f", "e99fde3"],
    "verify_results": [
      { "cmd": "npm run lint", "exit_code": 0, "summary": "clean" },
      { "cmd": "npm run typecheck", "exit_code": 0, "summary": "clean" },
      { "cmd": "npm test", "exit_code": 0, "summary": "111 passed, 0 failed" },
      { "cmd": "npm test -- schema", "exit_code": 0, "summary": "51 passed" },
      { "cmd": "npm test -- journal", "exit_code": 0, "summary": "28 passed" },
      { "cmd": "npm test -- config", "exit_code": 0, "summary": "18 passed" },
      { "cmd": "grep -qE 'branches:\\s*\\[\\s*main\\s*\\]' .github/workflows/ci.yml", "exit_code": 0, "summary": "matched" }
    ],
    "remote_has_head": true,
    "ci_conclusion": "success (owner visual confirmation, 4/4 runs)",
    "ci_run_url": "https://github.com/CIPFZ/Collie/actions",
    "ci_branch_matched": true,
    "deps_diff": ["zod", "smol-toml", "typescript", "@types/node", "eslint", "@eslint/js", "typescript-eslint", "prettier", "eslint-config-prettier", "vitest", "tsx"],
    "spec_diff_lines": 0
  },
  "claim_mismatches": [],
  "gaps": [],
  "conditions": [],
  "reason": "全部可实跑验收项通过且与声称一致；测试覆盖超出要求；受保护文件零触碰；CI 结论由项目所有者目视确认 4/4 为 main/success"
}
```
