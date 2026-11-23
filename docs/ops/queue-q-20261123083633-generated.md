# 队列运行 q-20261123083633

开始：2026-11-23T08:36:37.678Z
结束：2026-11-23T09:54:18.843Z
墙钟：77m41s
结束原因：limit
退出码：0

## 开跑前检查

ok   worktree_clean
ok   remote_in_sync
ok   ci_token
ok   disk_free: 30511 MB free

## 实际经过

| 顺序 | 批次 | 运行 | attempt | 结论 | 规则 | 用时 | worker 花费 | reviewer 花费 | tester 花费 | 合计 | worker 轮数 | head_sha | audit |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | v046-b35 | r-20261123083637 | 1 | PASS | 10 | 34m4s | $2.25 | $0.88 | $2.52 | $5.64 | 43/200 | dc2811c68790b834d52b0241c514db234c193f54 | match |
| 2 | v046-b36 | r-20261123091042 | 1 | PASS | 10 | 43m36s | $2.17 | $1.21 | $4.18 | $7.56 | 37/200 | d466d1cc5bd85138ae52e4a56621b86849aa471b | match |
| 合计 | | | | | | 77m40s | $4.42 | $2.08 | $6.70 | $13.21 | | | |

## 放行与打扰

queue.gate_passed: 2
BLOCK: 0
tool.denied：0
batch.status: v046-b35 pending → passed
batch.status: v046-b36 pending → passed
打扰：0

## 每个批次

### v046-b35

```
== attempt 1 (r-20261123083637) ==
worker: exit_code=0 stop_reason=— turns=43/200 cost=$2.25 model=claude-opus-4-6 duration=10m38s tokens=in2920847/out9524
tester: turns=54 cost=$2.52 duration=10m48s invocations=1
evidence: commits=1 tests_passed=1532 tests_failed=0 acceptance_passed=5 acceptance_total=5 spec_diff_lines=0 deps_diff=0 remote_has_head=true
reviewer: PASS model=claude-opus-4-6 turns=42/100 cost=$0.88 duration=5m30s
ci: success branch_matched=true waited 1s polls=1 run_url=https://github.com/CIPFZ/Collie/actions/runs/45142770486
head_sha: dc2811c68790b834d52b0241c514db234c193f54
ci.verdict_commit: d19d890bfb2a4a823b4920161d692d6b58a595cf success when=startup run_url=https://github.com/CIPFZ/Collie/actions/runs/45117835524
verdict.pushed: 2026-11-23T09:10:42.569Z sha=64da7d1db122cdeeeab172afe712981f1ecf3747 remote=origin branch=main
cost: worker=$2.25 reviewer=$0.88 tester=$2.52 total=$5.64
结论：PASS，规则 10：采用 reviewer 原值 — 全部验收命令通过；worker 仅改 src/run.ts，改动完全在条目范围内；已有断言零修改；受保护文件零改动；情形验收测试 8/8 全过。CI 以 R2 取证为准。

放行：queue.gate_passed ×1
```

### v046-b36

```
== attempt 1 (r-20261123091042) ==
worker: exit_code=0 stop_reason=— turns=37/200 cost=$2.17 model=claude-opus-4-6 duration=11m6s tokens=in1939034/out9047
tester: turns=92 cost=$4.18 duration=16m48s invocations=1
evidence: commits=1 tests_passed=1541 tests_failed=0 acceptance_passed=5 acceptance_total=5 spec_diff_lines=0 deps_diff=0 remote_has_head=true
reviewer: PASS model=claude-opus-4-6 turns=44/100 cost=$1.21 duration=7m49s
ci: success branch_matched=true waited 1s polls=1 run_url=https://github.com/CIPFZ/Collie/actions/runs/45148816905
head_sha: d466d1cc5bd85138ae52e4a56621b86849aa471b
ci.verdict_commit: 64da7d1db122cdeeeab172afe712981f1ecf3747 success when=after_evidence run_url=https://github.com/CIPFZ/Collie/actions/runs/45144694673
verdict.pushed: 2026-11-23T09:54:18.821Z sha=3f3a8336f135605ab1be88694405fffb1d921b0c remote=origin branch=main
cost: worker=$2.17 reviewer=$1.21 tester=$4.18 total=$7.56
结论：PASS，规则 10：采用 reviewer 原值 — 全部验收命令通过；schema 正确添加可选 disputed_tests（strict、NonEmptyString）；run.ts 上报路径正确实现（不拉 reviewer、BLOCK exit 20、r2Commit + push、--continue 记 blocked）；复用 escalationDecision 和 emptyEvidence；invariant 上限 8→9 为条目授权；无受保护文件/禁止文件/依赖变动。CI 以 R2 取证为准。

放行：queue.gate_passed ×1
```

## 队列 journal

```
2026-11-23T08:36:37.678Z q-20261123083633 queue.preflight ok=true checks=[{"name":"worktree_clean","ok":true},{"name":"remote_in_sync","ok":true},{"name":"ci_token","ok":true},{"name":"disk_free","ok":true,"detail":"30511 MB free"}]
2026-11-23T08:36:37.736Z q-20261123083633 queue.batch_started batch_run_id=r-20261123083637 attempt=1 why=new
2026-11-23T09:10:42.575Z q-20261123083633 queue.gate_passed batch_run_id=r-20261123083637
2026-11-23T09:10:42.620Z q-20261123083633 queue.batch_started batch_run_id=r-20261123091042 attempt=1 why=new
2026-11-23T09:54:18.829Z q-20261123083633 queue.gate_passed batch_run_id=r-20261123091042
2026-11-23T09:54:18.843Z q-20261123083633 queue.finished reason=limit batches=[{"batch_id":"v046-b35","run_id":"r-20261123083637","verdict":"PASS"},{"batch_id":"v046-b36","run_id":"r-20261123091042","verdict":"PASS"}] paused_count=0
```

## 队列剩余

blocked: v02-b01, v02-b04-tests, v02-b04-fix4, v03-b03, v03-b03-fix, v04-b01, v04-b04, v045-b11, v046-b08, v046-b17, v046-b23
