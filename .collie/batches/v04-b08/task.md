---
schema_version: 1
run_id: r-20261111104513
batch_id: v04-b08
base_sha: a26954825e30ee70bf2685b63db7d3c6958a602c
created_at: 2026-11-11T10:45:13.916Z
attempt: 1
interrupted_at: null
issued_by: collie
---

# 批次 v04-b08：投影取值修补：attempt 按 R2 口径推算、运行用时、花费缺数据、空数据的 --json

## 你的身份与边界

你的身份、权限边界与工作协议见 `AGENT-worker.md`，全局铁律见 `CONSTRAINTS.md`，
方案来源见 `SPEC.md`。本文件只做本批次提醒。

## 本批次条目（3 个）

1. 取值（SPEC 13.13，读这一节即可；事件字段表在 3.6）：`src/view.ts` 加一个推算 attempt 的函数，`status` 的「当前」段与 `timeline` 的 `run_end` 都用它，
   删掉对 `batch.selected.attempt`、`run.finished.attempt` 的读取（R2 不写这两个字段）；运行用时改为 `run.finished.ts` − `run.started.ts`；
   按版本汇总在范围内没有任何花费数据时显示 `—`
2. 空数据的 `--json`（SPEC 13.13）：没有 journal 时 `status --json` 输出与有数据时同一结构、`timeline --json` 输出 `[]`，不再输出 `{"message": …}`。
   R2 的验收在 `head_sha` 的干净 worktree 里跑，那里没有 `.collie/runs/`；主仓库里有 journal，在主仓库自测看不到这条失败（v04-b02 第 1 次因此 FIX）
3. 新建 `test/view-real.test.ts`：用 `test/support/sandbox.ts` 的 `Sandbox` 让 fake runner 跑真实的 `collie run`（单批次模式，同一批次先 FIX 再 PASS 两次运行），
   断言投影出的 attempt 依次是 1、2 且等于当次 `task.md` frontmatter 的 `attempt`，运行用时不为 null，没有花费数据时汇总显示 `—`；
   `test/timeline.test.ts` 与 `test/view.test.ts` 的手写夹具删掉 R2 不写的字段。
   `test/invariants.test.ts` 加「`src/view.ts` 不含 `batchSelected.attempt`」「`test/view-real.test.ts` 含 `Sandbox.create`」

## 验收标准（可机器判定）

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 真实运行夹具的专项测试通过 | `npm test -- test/view-real.test.ts` | exit 0 |
| 专项测试用 Sandbox 跑真实一轮 | `grep -qE "Sandbox\.create" test/view-real.test.ts` | exit 0 |
| 专项测试不少于 4 个 | `grep -cE "^\s+it\(" test/view-real.test.ts \| grep -qE "^([4-9]\|[1-9][0-9])$"` | exit 0 |
| 投影不再读 R2 不写的字段（不看注释行） | `! grep -vE "^\s*(//\|\*\|/\*)" src/view.ts \| grep -qE "batchSelected\.attempt"` | exit 0 |
| 空数据时 status --json 结构不变 | `npx tsx src/cli.ts status --json \| node -e "const j=JSON.parse(require('fs').readFileSync(0,'utf8'));process.exit('current' in j&&'queue' in j&&'lastQueue' in j?0:1)"` | exit 0 |
| 空数据时 timeline --json 是数组 | `npx tsx src/cli.ts timeline --json \| node -e "process.exit(Array.isArray(JSON.parse(require('fs').readFileSync(0,'utf8')))?0:1)"` | exit 0 |
| 不变量同步 | `grep -qE "view-real" test/invariants.test.ts` | exit 0 |

## 本批次额外禁止

- 改动任何受保护路径
- 为了让测试过而删除或跳过任何测试（从手写夹具里删掉 R2 不写的字段不算）
- 为了让验收命令通过而改注释或字面（铁律 26）
- 改动 `run.ts`、`gate.ts`、`arbiter.ts`、规则 1~10；让 `status` / `timeline` 写任何文件；绕过 `src/view.ts` 直接读 journal；新增依赖

## 汇报要求

完成后写 `.collie/batches/v04-b08/report.md`：固定四段（做了什么 / 测试结果 / 偏离或疑问 / 下一步建议）
+ 尾部围栏 JSON 块，格式见 SPEC 3.4。
写完后以 `report(collie): v04-b08` 为提交信息单独提交并推送该文件。
