# v046-b43 情形 → 用例对照表

| 情形 | 类别 | 用例 |
|------|------|------|
| S1 | 新 | `S1: runner called once as worker, reviewer.skipped rule 8, no reviewer.started` |
| S2 | 新 | `S2: verdict.downgraded has assumed true` |
| S3 | 新 | `S3: runner called once, reviewer.skipped rule 2` |
| S4 | 新 | `S4: evidence.collected index is less than reviewer.started index` |
| K1 | 保持 | `K1: exit 10, verdict.downgraded PASS to FIX rule 8, acceptance.failed sh fail.sh, run.finished FIX` |
| K2 | 保持 | `K2: exit 20, evidence.collected spec_diff_lines > 0, run.finished BLOCK rule 2` |
| K3 | 保持 | `K3: exit 0, runner calls worker then reviewer, no reviewer.skipped, no verdict.downgraded` |
| K4 | 保持 | `K4: exit 10, run.finished rule 10` |

## 假定的名字

- `reviewer.skipped` 事件类型：由实现者加入 `EVENT_TYPES`，字段 `rule`（number）和 `reason`（string）
- `verdict.downgraded` 事件新增字段 `assumed`（boolean）：在 reviewer 未启动的运行里为 `true`

## 写不成测试的情形

无
