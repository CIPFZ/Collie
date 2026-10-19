# ADR-003 许可证白名单的作用范围

状态：**已批准（方案 A）**
日期：2026-10-16（起草）/ 2026-10-16（批准）
决策者：项目所有者
触发：v01-b01 汇报裁决项 1
相关：[CONSTRAINTS.md](../CONSTRAINTS.md) 铁律 13、[SPEC.md](../SPEC.md) 2.2

---

## 背景

铁律 13 规定许可证仅接受 MIT / Apache-2.0 / BSD / ISC，但未说明作用范围。
v01-b01 实测：运行时依赖（`zod` MIT、`smol-toml` BSD-3-Clause）干净；
开发依赖的传递层出现两个白名单外许可证：

| 包 | 许可证 | 引入路径 | 性质 |
|---|---|---|---|
| `lightningcss`（含 12 个平台包） | MPL-2.0 | vitest → vite | 文件级弱 copyleft，仅修改其源文件时需开源该文件 |
| `minimatch` | BlueOak-1.0.0 | eslint | 宽松许可证，OSI 认可，等价于 MIT 级别 |

两者均不进入 Collie 的分发产物（`dist/`），只在开发机与 CI 上运行。

## 候选方案

**A. 白名单只管运行时依赖树。** 开发依赖及其传递层不受铁律 13 约束，
但须排除强 copyleft（GPL / AGPL）以防工具链污染。

**B. 白名单管全树，列明例外。** 开发依赖传递层出现白名单外许可证时，
逐个审查并以 ADR 记录例外。本次例外：MPL-2.0、BlueOak-1.0.0。

**C. 白名单管全树，无例外。** 换掉引入这两个包的工具（vitest → node:test，eslint → 其他）。

## R1 建议

方案 A。理由：

1. 许可证风险的实质是「分发什么」。开发工具不进分发产物，其许可证对 Collie 的用户无影响。
2. 方案 B 的例外清单会随工具链升级持续增长（vite 生态的传递依赖变动频繁），
   每次升级都触发 ADR，成本高且无实质收益。
3. 方案 C 的代价是放弃主流工具链，与「胶水要薄」的定位相悖。

方案 A 的边界补充：开发依赖树中出现 GPL / AGPL / SSPL 等强 copyleft 时仍须 BLOCK，
因为它们可能通过构建脚本或插件机制影响产物。

## 若采纳方案 A，铁律 13 修订为

> 新增任何第三方依赖必须先写 ADR。**运行时依赖**（进入 `dist/` 或被其 `import` 的）
> 许可证仅接受 MIT / Apache-2.0 / BSD / ISC / 0BSD。**开发依赖**及其传递层不受白名单约束，
> 但禁止 GPL / AGPL / SSPL 等强 copyleft。R4 每批次扫描全树并在 evidence 中列出白名单外项。

## 决策

采纳方案 A。铁律 13 与 SPEC 2.2 已按上文修订。

## 后果

- `lightningcss`（MPL-2.0）与 `minimatch`（BlueOak-1.0.0）作为开发依赖传递层，不构成违规
- R4 每批次全树扫描，在 evidence 的 `deps_diff` 中列出白名单外项，
  仅当出现 GPL / AGPL / SSPL 等强 copyleft 或运行时树出现白名单外项时 BLOCK
- 运行时依赖的判定标准：被 `src/**` 直接或间接 `import`，或进入 `dist/`
