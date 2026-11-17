---
schema_version: 1
run_id: r-20261117083545
batch_id: v045-b12
base_sha: 0b20c6bfc1450a7653fe2bd57042e81aea3b12e9
created_at: 2026-11-17T08:35:46.690Z
attempt: 1
interrupted_at: null
issued_by: collie
---

# 批次 v045-b12：reviewer 拿不到任何一轮的汇报：工作目录里没有 report.md，取证范围排除信封目录

## 你的身份与边界

你的身份、权限边界与工作协议见 `AGENT-worker.md`，全局铁律见 `CONSTRAINTS.md`，
方案来源见 `SPEC.md`。本文件只做本批次提醒。

## 本批次条目（3 个）

1. `src/run.ts` 准备 `head_sha` 工作目录的地方：reviewer 开始工作时，目录里不存在 `.collie/batches/<本批次>/report.md`，第几次运行都一样。
   别的文件不动（本批次的 `task.md` 要留着），验收命令照旧在这个目录里跑。这件事只放在 `src/run.ts`，`src/roles/reviewer.ts` 的源码里仍然不得出现 `report.md` 字样。
   **同一个批次先 FIX 再 PASS：第 2 次运行的 `head_sha` 的树里有上一轮的 report.md（`git ls-tree` 查得到），而 reviewer 的工作目录里没有**
2. `src/roles/reviewer.ts` 的 `buildReviewerPrompt`：「取证范围」一节给出的两条命令改为带路径排除的写法，
   `git log <base>..<head> -- . ':(exclude).collie/batches'` 与 `git diff <base>..<head> -- . ':(exclude).collie/batches'`，
   并加一句「`.collie/batches/` 下是信封文件，不是 worker 的产出；只读本批次的 `task.md`」。`ReviewerInputSchema` 不加字段。
3. 新文件 `test/reviewer-rerun.test.ts`：用 `FakeRunner` 跑真实的 `run --continue`（照 `test/report.test.ts` 里「FIX then PASS」那一组的做法，不手写 journal），
   在两次 reviewer 场景里各记下 `ctx.cwd` 下那个文件在不在、本批次的 `task.md` 在不在，以及 `ctx.opts` 里的提示词。断言：
   汇报文件两次都不在；第 2 次的 `head_sha` 的树里它在（这是对照，没有它这条测试什么也证明不了）；`task.md` 两次都在；两次的提示词都含 `':(exclude).collie/batches'`。
   再加一条「第 1 次就 PASS」的。
   允许改写的旧用例只有一处：`test/reviewer-isolation.test.ts` 的 `contains the diff pointer, items, parsed commands verbatim and SPEC paths` 里断言取证范围原文的那一条，
   只许因为两条命令多了路径参数而改；改了就在「偏离或疑问」里列出原断言与现断言。同一文件的 `never reads a report or imports the worker role` 不许改。

## 验收标准（可机器判定）

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 重跑隔离的专项测试通过 | `npm test -- test/reviewer-rerun.test.ts` | exit 0 |
| 原有的隔离测试仍然通过 | `npm test -- test/reviewer-isolation.test.ts` | exit 0 |
| 专项测试不少于 3 个 | `grep -cE "^\s+it\(" test/reviewer-rerun.test.ts \| grep -qE "^([3-9]\|[1-9][0-9])$"` | exit 0 |
| 专项测试跑的是真实队列，且带对照 | `grep -qE "FakeRunner" test/reviewer-rerun.test.ts && grep -qE "ls-tree" test/reviewer-rerun.test.ts` | exit 0 |
| 提示词的路径排除有断言 | `grep -qF ":(exclude).collie/batches" test/reviewer-rerun.test.ts` | exit 0 |

## 本批次额外禁止

- 改动任何受保护路径；改动 `.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`
- 改动 `src/arbiter.ts`、`src/gate.ts`、`src/evidence.ts`、`src/follow.ts`、`src/view.ts`；给 `ReviewerInputSchema` 加字段；让 reviewer 以任何方式拿到汇报的内容
- 为了让测试过而删除或跳过任何测试；改写条目 3 点名之外的任何已有断言
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；新增依赖

## 汇报要求

完成后写 `.collie/batches/v045-b12/report.md`：固定四段（做了什么 / 测试结果 / 偏离或疑问 / 下一步建议）
+ 尾部围栏 JSON 块，格式见 SPEC 3.4。
写完后以 `report(collie): v045-b12` 为提交信息单独提交并推送该文件。
