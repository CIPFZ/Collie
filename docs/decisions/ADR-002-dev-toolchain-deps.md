# ADR-002 开发工具链依赖批准与 SPEC 2.2 勘误

状态：已批准
日期：2026-10-16
决策者：项目所有者（经 R1 起草）
触发：v01-b01 执行计划 Q2
相关：[SPEC.md](../SPEC.md) 第 2.2 节、[CONSTRAINTS.md](../CONSTRAINTS.md) 铁律 13

---

## 背景

铁律 13 规定新增任何第三方依赖须先写 ADR。SPEC 2.2 的依赖清单只列了运行时依赖
与 vitest / tsx，遗漏了 strict TypeScript 工程必需的开发工具链。
实现 Agent 在计划阶段指出此冲突并停下等批准，符合 AGENT-worker.md 4.4。

同时实现 Agent 核实出 SPEC 2.2 的一处错误：`smol-toml` 的实际许可证是 BSD-3-Clause，
而非表中所写的 MIT。

## 决策

### 1. 批准以下开发依赖（devDependencies）

| 依赖 | 用途 | 许可证 |
|---|---|---|
| `typescript` | 编译与类型检查，**锁定 `~6.0.x`** | Apache-2.0 |
| `@types/node` | Node 内置模块类型（strict 下 `node:fs` 等必需） | MIT |
| `eslint` | 代码规范 | MIT |
| `@eslint/js` | ESLint 官方推荐规则集 | MIT |
| `typescript-eslint` | TS 规则，含 `no-explicit-any` / `no-unsafe-*` / `no-magic-numbers` | MIT |
| `prettier` | 格式化 | MIT |
| `eslint-config-prettier` | 关闭与 Prettier 冲突的 ESLint 规则 | MIT |

全部在铁律 13 的许可证白名单内。

### 2. TypeScript 版本锁定理由

`typescript-eslint` 当前 peer 依赖要求 `typescript < 6.1.0`，最新 TS 7.x 不被支持。
锁定 `~6.0.x` 直至 typescript-eslint 跟进。此约束记录于 `package.json` 并在此留档。

### 3. SPEC 2.2 勘误

`smol-toml` 许可证由 MIT 更正为 BSD-3-Clause。仍在白名单内，不影响选型。

### 4. 铁律 11 的执行方式补充

「代码中禁止裸写阈值数字」由 ESLint `@typescript-eslint/no-magic-numbers`
在 `src/**` 上强制执行（放行 0 / 1 / -1），而非依赖 grep。
原因：grep 只能枚举已知数值，lint 规则覆盖全部字面量。
结构不变量（如 `Batch.items` 的 1~3 上限）属 schema 定义而非可调阈值，
以具名常量写在 `src/schema/` 内，不进 `collie.toml`。

## 后果

- SPEC 2.2 新增「开发依赖」小节，与本 ADR 一致
- 后续新增开发依赖仍须走 ADR
- 实现 Agent 无权写 `docs/decisions/`，ADR 由 R1 落盘；
  Agent 在汇报中引用本 ADR 编号即可
