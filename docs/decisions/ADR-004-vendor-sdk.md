# ADR-004 模型供应商官方 SDK 的许可证豁免

状态：**已批准（方案 A）**
日期：2026-10-19
决策者：项目所有者
触发：v01-b05 汇报裁决项 1
相关：[CONSTRAINTS.md](../CONSTRAINTS.md) 铁律 13、[SPEC.md](../SPEC.md) 2.2、ROADMAP 0.4

---

## 背景

`@anthropic-ai/claude-agent-sdk` 的 LICENSE.md 只有「© Anthropic PBC. All rights reserved」，
不属于铁律 13 的白名单（MIT / Apache-2.0 / BSD / ISC / 0BSD）。
而 SPEC 2.2 把它列为依赖，许可证栏写「官方」。两者冲突，worker 正确地停下未安装。

## 候选方案

**A. 平台依赖豁免。** 模型供应商的官方 SDK 视为「平台」而非「第三方库」，豁免白名单，
条件：只能在 `src/runner/` 内 import（验收 grep 已保证）、逐个以 ADR 列明、
不得被任何第三方替代实现替换而不经 ADR。

**B. 不引入 SDK，直接调 HTTP API。** 自己实现 agent loop、工具调用与会话管理。

**C. 以 `claude` CLI 子进程方式拉起。** 不 import SDK，通过 stdio 交互。

## 裁定

方案 A。理由：

1. Collie 的目标就是编排该供应商的 agent，SDK 是运行平台本身，与「挑一个第三方库」性质不同；
   白名单的本意是防分发产物被传染性许可证污染，SDK 的条款不是 copyleft，不改变 Collie 自身的许可证。
2. 方案 B 相当于重写 SDK，v0.1 不做。方案 C 的 stdio 协议不稳定，事件流难以结构化（SPEC 3.4）。
3. 隔离在 `runner/` 内，供应商条款若变化只需替换一个目录（ROADMAP 0.4 的初衷）。

## 对文件的影响

- 铁律 13 追加「平台依赖例外」一句。
- 仲裁规则 3 的认可依赖清单恢复 `@anthropic-ai/claude-agent-sdk`。
