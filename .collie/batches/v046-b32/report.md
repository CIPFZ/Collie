# 批次 v046-b32 汇报

## 做了什么

逐条对应 task.md 的三个条目：

1. **批次解析与任务书生成**：
   - `src/schema/index.ts`：在 `BatchSchema` 中新增可选字段 `allowed_protected`（`z.array(NonEmptyString).optional()`）。新增可选字段不 bump SCHEMA_VERSION。
   - `src/backlog.ts`：新增标签 `LABEL_ALLOWED_PROTECTED`（全角半角冒号都认，写法同 `LABEL_INTERFACES`），新增 `parseListWithBlanks` 解析（允许空行），新增 `isAllowablePath` 验证函数——只接受 `.github`、`.github/` 下路径、`eslint.config.js`、`vitest.config.ts`；包含 `..`、绝对路径、通配符 `*?` 的一律拒绝并在错误信息中指出哪一项。解析结果放入 `SectionContent.allowedProtected`，只在存在时设置到 candidate 上。
   - `src/roles/worker.ts`：新增 `renderAllowedProtectedSection(batch)`，有 `allowed_protected` 时在「本批次条目」和「验收标准」之间插入「## 本批次可改的受保护路径」一节，逐条列出路径，末尾一句「只做条目要求的改动，并在「偏离或疑问」里列出改了什么」。没有时什么都不加。

2. **取证排除授权路径**：
   - `src/evidence.ts`：`EvidenceInput` 新增可选 `allowedProtected` 字段。`collectEvidence` 在计算 `specDiffLines` 时，若有授权路径且总行数 > 0，对每个 worker commit 额外调 `diffStat` 计算授权路径的行数，从 `specDiffLines` 中减去，累加到 `authorizedDiffLines`。`CollectedEvidence` 新增可选 `authorizedDiffLines`。
   - `src/run.ts`：在 `collectEvidence` 调用时传入 `batch.allowed_protected`；在 `evidence.collected` 事件中，有授权时多写 `authorized_diff_lines` 字段。

3. **测试**：
   - `test/backlog.test.ts`：新增 `describe('backlog: allowed protected paths', …)`，13 个用例覆盖两项授权路径解析、`.github` 整目录、`eslint.config.js`、全角冒号、空行、无此节无键、拒绝 SPEC.md / docs/backlog.md / test/acceptance/ / .collie/collie.toml / ../ / /etc/x / .github/* 共 7 种非法路径。
   - `test/task-envelope.test.ts`：新增 `describe('task-envelope: allowed protected paths …')`，2 个用例验证有授权时 task.md 包含「本批次可改的受保护路径」节且位于条目和验收之间，无授权时不包含。
   - `test/batch-authorisation.test.ts`（新文件）：`describe('batch authorisation: named protected paths do not count', …)`，3 个用例用 AuthSandbox + FakeRunner 端到端运行 `collie run`：
     - 授权 vitest.config.ts + worker 只改它：`spec_diff_lines=0`, `authorized_diff_lines>0`, PASS
     - 授权 vitest.config.ts + worker 还改了 eslint.config.js（未授权）：`spec_diff_lines>0`, 被降级
     - 无授权 + worker 改 vitest.config.ts：`spec_diff_lines>0`, 无 `authorized_diff_lines`
   - `test/invariants.test.ts`：新增「`src/backlog.ts` 里有 `可改的受保护路径`」和「`src/run.ts` 里有 `authorized_diff_lines`」两条。

## 测试结果

```
npm run lint    → exit 0
npm run typecheck → exit 0
npm test        → 73 passed, 1506 tests passed, 0 failed

GIT_CONFIG_GLOBAL=$(mktemp) GIT_CONFIG_NOSYSTEM=1 npm test -- test/batch-authorisation.test.ts → 1 passed, 3 tests

mutation check  → caught 46 survived 0 invalid 0 timeout 0 stale 0
```

## 偏离或疑问

无

## 下一步建议

本批次完成了批次授权机制的解析、任务书生成、取证排除的全部代码和测试。下一步（SPEC 16.21 末尾所述）可以签发第一个真正使用授权的批次，把 `vitest.config.ts` 的 `testTimeout` / `hookTimeout` 提到 300 秒。

```json
{
  "schema_version": 1,
  "batch_id": "v046-b32",
  "head_sha": "0885886bbf087fa47b75bf7ad5cf5e15e2fc1f87",
  "claims": {
    "commits": [
      "d1f1646d0859d4c12d4f65662cde73395db7fdf0",
      "0885886bbf087fa47b75bf7ad5cf5e15e2fc1f87"
    ],
    "tests_passed": 1506,
    "tests_failed": 0,
    "pushed": true,
    "new_deps": [],
    "spec_touched": false
  },
  "open_questions": []
}
```
