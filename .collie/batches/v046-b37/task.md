---
schema_version: 1
run_id: r-20261123115255
batch_id: v046-b37
base_sha: 591443d51c342a77032bc9bc3f3093c2eecb96d9
created_at: 2026-11-23T11:58:16.258Z
attempt: 1
interrupted_at: null
issued_by: collie
---

# 批次 v046-b37：输出末尾按两个输出流各取，变异检查没过时看得到是哪一项（带情形）

## 你的身份与边界

你的身份、权限边界与工作协议见 `AGENT-worker.md`，全局铁律见 `CONSTRAINTS.md`，
方案来源见 `SPEC.md`。本文件只做本批次提醒。

## 本批次条目（2 个）

1. 读 SPEC 16.25 的「`output_tail` 的取法」一段与 14.38「判 PASS 之后查出来的」第 1、3 条。`src/run.ts` 的 `buildOutputTail`：标准输出与标准错误分开取（各去掉末尾空行、各取最后 `OUTPUT_TAIL_MAX_LINES` 行、每行照旧截断、各自脱敏），
   标准错误有内容时在两段之间加一行 `--- stderr ---`；两边都没有内容时照旧返回 `undefined`。
   `renderFixSection`：围栏用的反引号个数，比内容里行首最长的一串反引号多一个，最少三个。
2. 不许变的：只往标准输出打印的命令，`output_tail` 与现在逐字节相同；`acceptance.failed` 的其余字段；`docs/progress.md` 的摘要；`why` 与 `report` 的输出。
   `test/acceptance/v046-b35/` 下的测试（上一批的验收测试，现在是回归测试）必须照常通过，你不能改它们。R1 查过：它们的脚本都只往标准输出打印，新取法不影响它们。已有断言一条都不改。
   别的现有用例因为本批次的新行为而失败时：只许做新行为直接要求的最小改动（往序列里加事件、个数加一这一类），不许删断言、不许把断言改松，在「偏离或疑问」里逐条列出原断言与现断言；拿不准是不是新行为直接要求的，才停下不改，写明是哪一条。

## 本批次情形

- S1 [新] 沙箱的全局验收命令里多一条 `sh split.sh`，它向标准输出打印一行 `result: 1 survived`，再向标准错误依次打印 `progress 1` 到 `progress 30`，以 1 退出；假 worker 如实提交、假 reviewer 判 PASS，跑一次：`cmd` 为 `sh split.sh` 的 `acceptance.failed` 事件的 `output_tail` 按行拆开，第一行是 `result: 1 survived`，第二行是 `--- stderr ---`
- S2 [新] 同样的沙箱，`split.sh` 改成向标准输出依次打印 `o1` 到 `o25`、向标准错误依次打印 `e1` 到 `e25`，以 1 退出：`output_tail` 恰好 41 行，第一行是 `o6`，第 21 行是 `--- stderr ---`，第 22 行是 `e6`
- S3 [新] 同样的沙箱，`split.sh` 只向标准错误依次打印 `e1`、`e2`、`e3`，以 1 退出：`output_tail` 恰好 4 行，第一行是 `--- stderr ---`，第二行是 `e1`
- S4 [新] `renderFixSection` 拿到的 `failedAcceptance` 里那一项的 `output_tail` 是三行：`before`、恰好三个反引号的一行、`after`：返回的文字里，这条命令下面的代码块以恰好四个反引号的一行开头、以恰好四个反引号的一行结尾，这两行之间依次是 `before`、三个反引号、`after`
- K1 [保持] 同样的沙箱，`split.sh` 只向标准输出依次打印 `out 1` 到 `out 30`，以 1 退出：`output_tail` 恰好 20 行，第一行是 `out 11`，最后一行是 `out 30`，其中没有 `--- stderr ---` 这一行
- K2 [保持] S1 那一次运行：`output_tail` 里有单独成行的 `progress 30`，没有单独成行的 `progress 10`；这条 `acceptance.failed` 事件的 `cmd`、`exit_code`、`expect` 三个字段都在
- K3 [保持] 同样的沙箱，测试里把环境变量 `GITHUB_TOKEN` 设成 `tok-secret-12345`（用完还原），`split.sh` 向标准错误打印一行 `token=tok-secret-12345` 后以 1 退出：`output_tail` 里有 `token=***`，没有 `tok-secret-12345`
- K4 [保持] `renderFixSection` 拿到的那一项的 `output_tail` 是两行 `line A`、`line B`：代码块以恰好三个反引号的一行开头、以恰好三个反引号的一行结尾，这两行之间依次是 `line A`、`line B`
- K5 [保持] 同样的沙箱，`split.sh` 什么都不打印、以 1 退出：`cmd` 为 `sh split.sh` 的 `acceptance.failed` 事件没有 `output_tail` 这个键

## 本批次接口

- `src/run.ts` 已有的导出，签名都不变：`renderFixSection(info: FixInfo): string`、类型 `FixInfo`（`failedAcceptance` 每一项是 `{ cmd, exit_code, output_tail? }`）
- `acceptance.failed` 事件的 `output_tail` 是一个多行字符串，用换行分隔；读事件用 `Sandbox` 的 `events()`
- 沙箱怎么搭、怎样往全局验收命令里加一条、假 worker 与假 reviewer 怎么写，照上一批的验收测试 `test/acceptance/v046-b35/new.test.ts` 与 `keep.test.ts`（那里的脚本叫 `noisy.sh`）；脚本里往标准错误打印用 `>&2`

## 验收标准（可机器判定）

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过（含验收测试） | `npm test` | exit 0 |
| 本批次与上一批的验收测试通过 | `npm test -- test/acceptance/v046-b37 test/acceptance/v046-b35` | exit 0 |

`test/acceptance/v046-b37/` 下是本批次的验收测试，由测试 agent 写好，你不能改（受保护路径）。

## 本批次额外禁止

- 改动任何受保护路径（含 `test/acceptance/`、`AGENT-*.md`、`.collie/collie.toml`、`.github/`、`eslint.config.js`、`vitest.config.ts`）
- 改动 `src/run.ts` 之外的 `src/` 文件；改动 `scripts/mutation.ts`（不靠改变异脚本的输出来解决）；改任何一条规则的判定
- 把整段输出不截断、不脱敏地写进 journal 或 task
- 为了让测试过而删除或跳过任何测试；改写任何已有断言
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；用到机器的 git 全局配置；新增依赖

## 汇报要求

完成后写 `.collie/batches/v046-b37/report.md`：固定四段（做了什么 / 测试结果 / 偏离或疑问 / 下一步建议）
+ 尾部围栏 JSON 块，格式见 SPEC 3.4。
写完后以 `report(collie): v046-b37` 为提交信息单独提交并推送该文件。
