---
schema_version: 1
run_id: r-20261113064024
batch_id: v04-b13
base_sha: 84cfd9a3f3384900fc2aa1ffdc37824573c86f03
created_at: 2026-11-13T06:40:25.474Z
attempt: 1
interrupted_at: null
issued_by: collie
---

# 批次 v04-b13：上报原因写对、BLOCK 后的重跑说清原因、单批次 run_id 去掉连字符

## 你的身份与边界

你的身份、权限边界与工作协议见 `AGENT-worker.md`，全局铁律见 `CONSTRAINTS.md`，
方案来源见 `SPEC.md`。本文件只做本批次提醒。

## 本批次条目（3 个）

1. sha 校验分三步报（SPEC 13.17 第一段；现有校验在 `src/run.ts` 里报 `is not a descendant of base_sha` 的那一处）：先解析 `head_sha` 与 `claims.commits` 的每一项，
   解析不了报 `does not resolve to a commit`；再分别报「不是 base 的后代」「不是 HEAD 的祖先」；git 命令本身失败不得再被 `.catch(() => false)` 当成「不是祖先」，照旧上报并写 git 的报错原文
2. BLOCK 后的重跑（SPEC 13.17 第二段；`src/run.ts` 的 `batchHistory` 里拼 `interrupted_at` 的地方，`src/roles/worker.ts` 的 `renderInterruptSection`）：
   上一轮是 BLOCK 且不是被信号阶梯掐掉的，结束原因写 `escalated` 或 `blocked`，「上一轮中断」一节加一行「上一轮结论：」并写原因原文，不写「请从 `git log` 核实」那一句；真正的中断写法不变
3. 单批次 run_id（SPEC 13.17 第三段）：`src/cli.ts` 的 `runIdAt` 改为 `r-YYYYMMDDHHMMSS`，函数名与导出不变，现有测试里的字面同步。
   新建 `test/report-sha.test.ts`，用 `test/support/sandbox.ts` 的 `Sandbox` 让 fake runner 跑真实的 `collie run`：report 写一个不存在的 40 位 sha → 退出码 20、`escalated.reason` 含 `does not resolve to a commit`；
   sha 存在但不是 base 的后代；同一批次紧接着再跑一次 → task 的 `interrupted_at` 含 `escalated`、正文含「上一轮结论：」与上一轮的原因原文、不含「请从」；被判空转掐掉的中断写法不变（对照）；`runIdAt` 的格式。
   `test/invariants.test.ts` 加「`src/run.ts` 含 `does not resolve to a commit`」

## 验收标准（可机器判定）

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| sha 校验专项测试通过 | `npm test -- test/report-sha.test.ts` | exit 0 |
| 专项测试不少于 6 个 | `grep -cE "^\s+it\(" test/report-sha.test.ts \| grep -qE "^([6-9]\|[1-9][0-9])$"` | exit 0 |
| 新的上报原因进代码与测试（不看注释行） | `grep -vE "^\s*(//\|\*\|/\*)" src/run.ts \| grep -qE "does not resolve to a commit" && grep -qE "does not resolve to a commit" test/report-sha.test.ts` | exit 0 |
| 祖先判断的报错不再被吞（不看注释行） | `! grep -vE "^\s*(//\|\*\|/\*)" src/run.ts \| grep -qE "isAncestor\(.*\)\.catch\(\(\) => false\)"` | exit 0 |
| 重跑说明进 task 生成与测试 | `grep -rqE "上一轮结论" src && grep -qE "上一轮结论" test/report-sha.test.ts` | exit 0 |
| 单批次 run_id 不带连字符 | `npx tsx -e "import('./src/cli.ts').then((m)=>{const id=m.runIdAt(new Date());process.exit(id.length===16&&!id.slice(2).includes('-')?0:1)})"` | exit 0 |
| 不变量同步 | `grep -qE "does not resolve to a commit" test/invariants.test.ts` | exit 0 |

## 本批次额外禁止

- 改动任何受保护路径
- 为了让测试过而删除或跳过任何测试（把测试里旧格式的 run_id 字面改成新格式不算）
- 为了让验收命令通过而改注释或字面（铁律 26）
- 改动规则 1~10 的判定与上报的结论（sha 校验不过仍是 BLOCK）；改动放行判定、各项阈值；新增依赖

## 汇报要求

完成后写 `.collie/batches/v04-b13/report.md`：固定四段（做了什么 / 测试结果 / 偏离或疑问 / 下一步建议）
+ 尾部围栏 JSON 块，格式见 SPEC 3.4。
写完后以 `report(collie): v04-b13` 为提交信息单独提交并推送该文件。
