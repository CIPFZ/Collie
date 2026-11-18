---
schema_version: 1
run_id: r-20261118123213
batch_id: v046-b13
base_sha: 715c4893e46d9c935dcd952007dbbf25f488525a
created_at: 2026-11-18T12:32:14.526Z
attempt: 1
interrupted_at: null
issued_by: collie
---

# 批次 v046-b13：活性指纹不占索引锁：R2 在 worker 工作期间不改写 .git/index

## 你的身份与边界

你的身份、权限边界与工作协议见 `AGENT-worker.md`，全局铁律见 `CONSTRAINTS.md`，
方案来源见 `SPEC.md`。本文件只做本批次提醒。

## 本批次条目（3 个）

1. 读 SPEC 14.26 里「偶发失败查到了直接原因」一段与 16.14 的「活性指纹不占索引锁」。**先写测试，再改代码**：新文件 `test/fingerprint-lock.test.ts`，一组 `describe('fingerprint: never rewrites the git index', …)`，用 `Sandbox` 建仓库：
   提交一个文件；把它的修改时间改到别的时刻、内容不变（让索引里的时间戳对不上）；记下 `.git/index` 的 inode 与修改时间；连调 5 次 `computeFingerprint`；断言 `.git/index` 的 inode 与修改时间都没变，过程中 `.git/index.lock` 没有出现过。
   **这条测试在现有代码上应该失败。它要是通过了，说明 R1 的推断不成立：停下，不要改 `src/ladder.ts`，在「偏离或疑问」里写明你看到的（包括你另外查到的、谁会占这把锁）**
2. `src/ladder.ts` 的 `computeFingerprint`：改成不创建 `.git/index.lock`、不改写 `.git/index` 的写法（比如给 `git diff` 关掉自动刷新索引，或者换成不刷新索引的底层命令；用哪种你定，在汇报里写明选了什么、为什么）。
   指纹仍然对内容敏感：被跟踪的文件内容变了，指纹必须变；HEAD 变了，指纹必须变；未跟踪的文件多了或变了，指纹必须变。只有时间戳变、内容没变时，指纹变不变都可以，在汇报里写明实际是哪一种。
3. 同一个测试文件再加三条，守条目 2 的三种「必须变」；`test/scenario-g.test.ts` 里已有的 `computeFingerprint: content-sensitive` 一组不许改，必须照常通过。
   R1 查过：现有测试里直接调 `computeFingerprint` 的只有 `test/scenario-g.test.ts` 那一组；别的测试经由 `LivenessMonitor` 间接用到它，或者注入了假的指纹函数。
   你发现有别的现有用例与本批次冲突，停下，在「偏离或疑问」里写明是哪一条，不要自己改。

## 验收标准（可机器判定）

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 指纹的两组测试通过 | `npm test -- test/fingerprint-lock.test.ts test/scenario-g.test.ts` | exit 0 |
| 新的一组用例在，且用的是沙箱 | `grep -qF "fingerprint: never rewrites the git index" test/fingerprint-lock.test.ts && grep -qF "Sandbox" test/fingerprint-lock.test.ts` | exit 0 |

## 本批次额外禁止

- 改动任何受保护路径；改动 `.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`
- 改动 `src/git.ts`、`src/run.ts`、`src/evidence.ts`、`src/acceptance.ts`、`src/runner/`、`src/roles/`；改动活性检测的阈值、轮询间隔与判定（只改指纹怎么算）
- 为了让测试过而删除或跳过任何测试；改写任何已有断言
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；用到机器的 git 全局配置；新增依赖

## 汇报要求

完成后写 `.collie/batches/v046-b13/report.md`：固定四段（做了什么 / 测试结果 / 偏离或疑问 / 下一步建议）
+ 尾部围栏 JSON 块，格式见 SPEC 3.4。
写完后以 `report(collie): v046-b13` 为提交信息单独提交并推送该文件。
