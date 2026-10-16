# ADR-001 Collie 采用 TypeScript 实现

状态：已批准
日期：2026-10-16
决策者：项目所有者
相关：[SPEC.md](../SPEC.md) 第 2 章技术选型

---

## 背景

Collie 是 Agent 团队编排器，核心职责是：拉起并控制 Claude Code 子进程、
解析其 NDJSON 事件流、在工具调用边界施加约束、管理 session 的复用与新建、
以及跑确定性的仲裁与取证逻辑。

项目所有者的技术栈原则是「按项目性质选择最合适的语言」，
不存在默认语言，语言选择本身就是每个项目要做的技术决策之一。

## 候选方案

**A. TypeScript + Node 22**
Claude Agent SDK 第一方支持 TypeScript，直接提供 hooks、`canUseTool`、
session fork、NDJSON 流解析——这四项正好覆盖 Collie 的全部核心需求。

**B. Python**
Agent SDK 亦有官方 Python 支持，`uv` 工具链成熟，项目所有者在其他项目
（如 Skua）中已有 Python 工程惯例可复用。

**C. Rust**
性能与单二进制分发有优势。

**D. Shell**
最轻量，无需运行时。

## 决策

采用方案 A，TypeScript + Node 22 LTS + ESM。

## 理由

1. **核心能力可直接复用而非重造。** Collie 需要的子进程监管、流解析、
   工具调用拦截、session 控制，SDK 已第一方提供。选其他语言意味着
   自己实现这些机制，而它们恰是最容易出错的部分（尤其信号处理与流解析的边界情况）。
2. **Collie 是 I/O 胶水，不是计算密集型程序。** 它的工作是等子进程、读文件、
   跑 git 命令、比对字段。Rust 的性能优势在此场景无收益，而其编译期开销
   会拖慢迭代——Collie 在 v0.1~v0.5 期间会被频繁修改。
3. **Shell 不可行。** 信号阶梯（SIGINT→SIGTERM→SIGKILL 带宽限）与
   NDJSON 流解析用 bash 写出来无法做单元测试，而这两处正是 v0.2 的核心。
4. **Python 是合格的次优选择**，落选原因仅是 SDK 的 TS 侧与 Claude Code
   的宿主语言一致，行为差异风险更低。

## 后果

接受：
- 需要 Node 22 LTS 运行时，不提供单二进制分发（v1.0 前不考虑打包）
- 依赖 npm 生态，须严格执行许可证白名单（MIT / Apache-2.0 / BSD / ISC）

获得：
- 省掉子进程监管与流解析的自研成本
- 与 Claude Code 宿主语言一致，行为差异风险低

约束：
- `strict: true`，禁用 `any`
- 不引入任何编排框架或可观测框架（见 CONSTRAINTS.md 铁律 13）

## 备注

本 ADR 记录的是语言选型这一技术决策本身，不是「对某个默认语言的例外说明」。
项目所有者无默认语言约定。
