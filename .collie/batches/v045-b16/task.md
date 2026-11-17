---
schema_version: 1
run_id: r-20261117103146
batch_id: v045-b16
base_sha: a8cb50dc026854259ad236a1aa2e88662b2b13a1
created_at: 2026-11-17T10:31:46.848Z
attempt: 1
interrupted_at: null
issued_by: collie
---

# 批次 v045-b16：reviewer 的工作目录里，本批次的信封只留 task.md

## 你的身份与边界

你的身份、权限边界与工作协议见 `AGENT-worker.md`，全局铁律见 `CONSTRAINTS.md`，
方案来源见 `SPEC.md`。本文件只做本批次提醒。

## 本批次条目（2 个）

1. `src/run.ts` 准备 `head_sha` 工作目录的地方（v045-b12 加的那两行）：改为把 `.collie/batches/<本批次>/` 下除 `task.md` 之外的文件都拿掉。
   别的批次的目录不动（有测试要读早期批次的信封）。验收命令照旧在这个目录里跑。旁边注释里的小节号 14.17 改成 14.18 与 14.20。
   **同一个批次先 FIX 再 PASS：第 2 次运行的 `head_sha` 的树里有上一轮的 `verdict.md` 与 `report.md`（`git ls-tree` 查得到），而 reviewer 的工作目录里那个目录下只有 `task.md`**
2. `test/reviewer-rerun.test.ts`：两次 reviewer 场景里再记下 `.collie/batches/<本批次>/` 的文件清单。加断言：
   第 2 次的树里有 `verdict.md`（对照，没有它这条测试什么也证明不了）；两次 reviewer 的工作目录里该目录的文件清单都恰好是 `['task.md']`；
   另一个批次目录里的文件没被拿掉（在沙箱里先提交一个 `.collie/batches/v99-other/report.md`，断言 reviewer 的工作目录里它还在）。已有的断言不改。

## 验收标准（可机器判定）

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 重跑隔离的专项测试通过 | `npm test -- test/reviewer-rerun.test.ts` | exit 0 |
| 原有的隔离测试仍然通过 | `npm test -- test/reviewer-isolation.test.ts` | exit 0 |
| 专项测试不少于 7 个 | `grep -cE "^\s+it\(" test/reviewer-rerun.test.ts \| grep -qE "^([7-9]\|[1-9][0-9])$"` | exit 0 |
| 别的批次目录不动，有断言 | `grep -qF "v99-other" test/reviewer-rerun.test.ts` | exit 0 |

## 本批次额外禁止

- 改动任何受保护路径；改动 `.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`
- 改动 `src/roles/reviewer.ts`、`src/arbiter.ts`、`src/gate.ts`、`src/evidence.ts`、`src/view.ts`、`src/follow.ts`；动别的批次的信封目录；让 reviewer 以任何方式拿到汇报或上一轮裁定的内容
- 为了让测试过而删除或跳过任何测试；改写任何已有断言
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；新增依赖

## 汇报要求

完成后写 `.collie/batches/v045-b16/report.md`：固定四段（做了什么 / 测试结果 / 偏离或疑问 / 下一步建议）
+ 尾部围栏 JSON 块，格式见 SPEC 3.4。
写完后以 `report(collie): v045-b16` 为提交信息单独提交并推送该文件。
