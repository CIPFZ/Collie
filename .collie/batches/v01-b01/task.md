---
schema_version: 1
run_id: r-0001
batch_id: v01-b01
base_sha: f78b55a2c3e46efba91ecc344d8284a7aee130ad
created_at: 2026-10-16T18:00:00Z
attempt: 1
interrupted_at: null
issued_by: human-placeholder-r2
---

# 批次 v01-b01：工程骨架与基础设施

> 本批次由人工占位调度器（R2）签发。Collie 自身尚不存在，这是 bootstrap 的第一轮。
> 你的身份与边界见 `AGENT-worker.md`，全局铁律见 `CONSTRAINTS.md`，方案来源见 `SPEC.md`。

## 本批次范围

三个条目，严格按顺序做。做完全部三条后汇报并停下。

### 条目 1：工程骨架

建立可运行、可测试、可 CI 的 TypeScript 工程。

- `package.json`：包名 `collie`，`"type": "module"`，Node 22 LTS 引擎约束，
  脚本至少含 `lint` / `typecheck` / `test` / `build`
- `tsconfig.json`：`strict: true`，ESM，输出到 `dist/`
- ESLint + Prettier 配置，规则须能拦住 `any`
- vitest 配置
- `.gitignore`：必须含 `node_modules/`、`dist/`、`.collie/runs/`、`.collie/heartbeat`
- `.github/workflows/ci.yml`：**必须监听 `main` 分支**，跑 lint、typecheck、test

依赖只允许安装 SPEC 2.2 清单内的项。本批次实际需要的是：
`zod`、`smol-toml`、`vitest`、`tsx`、`typescript`、ESLint/Prettier 相关。
`commander`、`execa`、`yaml`、Agent SDK 在后续批次再装。

关于 CI 监听分支：本项目仓库的默认分支是 `main`。
此条有真实教训——某仓库 CI 配置监听 `main` 而实际使用 `master`，
导致连续六个里程碑的「CI 全绿」从未真正触发过。请确认二者一致。

### 条目 2：配置与 schema

- `src/schema/index.ts`：导出 `SCHEMA_VERSION = 1` 与全部 zod schema。
  本批次需要定义的 schema：`CollieConfig`（对应 SPEC 3.1 的 TOML 结构）、
  `Batch` 与 `Acceptance`（SPEC 3.2）、`Event`（SPEC 3.6）。
  每个 schema 导出推导类型（`z.infer`）。
- `src/config.ts`：读取并解析 `.collie/collie.toml`，用 zod 校验，
  返回类型化配置对象。校验失败必须抛出带字段路径的清晰错误。
- `.collie/collie.toml`：按 SPEC 3.1 创建，字段与默认值须与 SPEC 完全一致，
  每个阈值注明对应的 SPEC 章节号

`Acceptance.expect` 是联合类型 `'exit_zero' | { stdout_matches: string }`，
用 `z.union` 表达。

禁止在代码中裸写任何阈值数字（铁律 11）。

### 条目 3：事件日志

- `src/journal.ts`：`events.ndjson` 的追加与重放
  - `append(event)`：追加一行 JSON，必须保证单行、无换行污染
  - `replay(runId)`：读回全部事件并按 zod 校验，返回 `Event[]`
  - 文件路径为 `.collie/runs/<run_id>/events.ndjson`，目录不存在时自动创建
  - 必须是 append-only，禁止重写整个文件
- 支持 SPEC 3.6 中 v0.1 的事件类型。v0.2 的事件类型（`worker.stalled` 等）
  **本批次不实现**

设计约束：journal 是 R2 的唯一状态源，R2 必须能靠重放它恢复。
因此 `replay` 必须对损坏行有明确行为——遇到无法解析的行时报错并指出行号，
不得静默跳过。

## 验收标准

全部可机器判定。reviewer 会逐条实跑。

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| schema round-trip | `npm test -- schema` | exit 0 |
| journal 重放一致 | `npm test -- journal` | exit 0 |
| config 解析正确 | `npm test -- config` | exit 0 |
| CI 监听分支正确 | `grep -q 'branches:.*main' .github/workflows/ci.yml` | exit 0 |
| 无裸写阈值 | `grep -rnE '\b(90\|900\|2700)\b' src/ --include='*.ts' \| grep -v schema` | exit 1（无匹配） |

测试内容要求：
- schema round-trip：每个 schema 构造合法对象 → 序列化 → 解析 → 断言相等；
  并构造非法对象断言校验失败
- journal：追加多条事件后重放，断言顺序与内容一致；
  追加含换行的字段值，断言不破坏 NDJSON 格式；
  构造损坏行，断言报错并含行号
- config：解析 `.collie/collie.toml` 断言字段值；
  构造缺字段与类型错误的 TOML，断言报错含字段路径

## 本批次额外禁止

- 引入 SPEC 2.2 清单之外的任何依赖
- 实现任何 v0.2 及以后的内容（失败恢复、信号阶梯、resume、活性检测）
- 实现 `src/runner/`、`src/roles/`、`src/arbiter.ts`、`src/cli.ts`（属后续批次）
- 在代码中裸写阈值数字
- 修改 `SPEC.md`、`CONSTRAINTS.md`、`ROADMAP.md`、`ROLES.md`、
  `AGENT-*.md`、`docs/backlog.md`、`docs/progress.md`

## 汇报要求

完成后写 `.collie/batches/v01-b01/report.md`：
中文四段正文（做了什么 / 测试结果 / 偏离或疑问 / 下一步建议）
+ 尾部围栏 JSON 块，格式见 `AGENT-worker.md` 第 5 节。

尾部 JSON 的 `claims` 会被独立审核 Agent 逐项取证核对，请如实填写。
`tests_passed` / `tests_failed` 必须是 `npm test` 的真实输出数字，不要估计。

## 给本轮的特别说明

这是 bootstrap 第一轮，你实现的工程将被用来开发 Collie 自身。
本轮同时在验证一件事：我们写的验收标准是否真的可机器判定。
若你发现某条验收标准无法用命令客观判定，请在「偏离或疑问」段明确指出——
这个反馈比完成条目本身更有价值。
