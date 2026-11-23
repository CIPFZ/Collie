---
schema_version: 1
run_id: r-20261123141659
batch_id: v046-b39
base_sha: 81a6625f1a5c5229c9b6e7e79bb9864310e278af
created_at: 2026-11-23T14:17:00.449Z
attempt: 1
interrupted_at: null
issued_by: collie
---

# 批次 v046-b39：给 v046-b37 已在主分支上的输出末尾取法补测试（只改测试）

## 你的身份与边界

你的身份、权限边界与工作协议见 `AGENT-worker.md`，全局铁律见 `CONSTRAINTS.md`，
方案来源见 `SPEC.md`。本文件只做本批次提醒。

## 本批次条目（3 个）

1. 读 SPEC 16.25 的「`output_tail` 的取法」一段与 14.39。新文件 `test/output-tail.test.ts`，一组 `describe('output_tail: per-stream tail and fence width (SPEC 16.25)', …)`，把下面九种情形各写成至少一条用例（用例名以编号开头），每个期望都要有断言：
   - S1：沙箱的全局验收命令里多一条 `sh split.sh`，向标准输出打印 `result: 1 survived`，再向标准错误打印 `progress 1` 到 `progress 30`，以 1 退出；假 worker 如实、假 reviewer 判 PASS：`cmd` 为 `sh split.sh` 的 `acceptance.failed` 的 `output_tail` 第一行是 `result: 1 survived`，第二行是 `--- stderr ---`
   - S2：`split.sh` 向标准输出打印 `o1` 到 `o25`、向标准错误打印 `e1` 到 `e25`：`output_tail` 恰好 41 行，第 1 行 `o6`，第 21 行 `--- stderr ---`，第 22 行 `e6`
   - S3：只向标准错误打印 `e1`、`e2`、`e3`：`output_tail` 恰好 4 行，第 1 行 `--- stderr ---`，第 2 行 `e1`
   - S4：`renderFixSection` 拿到的那一项的 `output_tail` 是 `before`、一行恰好三个反引号、`after`：那条命令下面的代码块以恰好四个反引号的一行开头，**收尾找与开头那一行完全相同的下一行**，它也是恰好四个反引号；两行之间依次是 `before`、三个反引号、`after`
   - K1：只向标准输出打印 `out 1` 到 `out 30`：恰好 20 行，第 1 行 `out 11`，最后一行 `out 30`，没有 `--- stderr ---`
   - K2：S1 那一次：`output_tail` 里有单独成行的 `progress 30`、没有单独成行的 `progress 10`；这条事件的 `cmd`、`exit_code`、`expect` 都在
   - K3：环境变量 `GITHUB_TOKEN` 设成 `tok-secret-12345`（用完还原），`split.sh` 向标准错误打印 `token=tok-secret-12345`：`output_tail` 里有 `token=***`，没有 `tok-secret-12345`
   - K4：`output_tail` 是 `line A`、`line B` 两行：代码块以恰好三个反引号的一行开头、以同样的一行结尾，中间依次是 `line A`、`line B`
   - K5：`split.sh` 什么都不打印、以 1 退出：那条 `acceptance.failed` 事件没有 `output_tail` 这个键
2. 沙箱、往全局验收命令里加一条、假 worker 与假 reviewer 的搭法，照 `test/acceptance/v046-b35/new.test.ts`（那里的脚本叫 `noisy.sh`，往标准错误打印用 `>&2`）。被拿掉的那份 v046-b37 验收测试在提交 `b86382a` 里，可以 `git show b86382a:test/acceptance/v046-b37/new.test.ts` 参考，**但它的 S4 找法是错的，不要照抄**。
   把 `src/run.ts` 里下面四处各撤一次（只在你自己的工作区里试，不提交），各自都必须有这个文件里的用例失败；在汇报的「测试结果」里逐条写明撤了哪里、哪几条红：
   两个输出流分开取（改回合起来取）；`--- stderr ---` 那一行；标准错误那一段的 20 行上限；围栏按内容加长（改回永远三个）。
3. 不改别的测试。`test/acceptance/` 下现有的测试必须照常通过。
   别的现有用例因为本批次的新行为而失败时：只许做新行为直接要求的最小改动（往序列里加事件、个数加一这一类），不许删断言、不许把断言改松，在「偏离或疑问」里逐条列出原断言与现断言；拿不准是不是新行为直接要求的，才停下不改，写明是哪一条。

## 验收标准（可机器判定）

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 新测试与上一批的验收测试通过 | `npm test -- test/output-tail.test.ts test/acceptance/v046-b35` | exit 0 |
| 新的一组用例在 | `grep -qF "output_tail: per-stream tail and fence width (SPEC 16.25)" test/output-tail.test.ts` | exit 0 |

## 本批次额外禁止

- 改动 `src/`、`scripts/`、任何受保护路径（含 `test/acceptance/`）、`.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`
- 用「以三个以上反引号开头」这类会被内容匹配到的模式找收尾围栏
- 为了让测试过而删除或跳过任何测试；改写任何已有断言
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；用到机器的 git 全局配置；新增依赖

## 汇报要求

完成后写 `.collie/batches/v046-b39/report.md`：固定四段（做了什么 / 测试结果 / 偏离或疑问 / 下一步建议）
+ 尾部围栏 JSON 块，格式见 SPEC 3.4。
写完后以 `report(collie): v046-b39` 为提交信息单独提交并推送该文件。
