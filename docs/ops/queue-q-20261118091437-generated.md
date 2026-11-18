# 队列运行 q-20261118091437

开始：2026-11-18T09:14:41.574Z
结束：2026-11-18T10:06:16.313Z
墙钟：51m34s
结束原因：blocked
退出码：20

## 开跑前检查

ok   worktree_clean
ok   remote_in_sync
ok   ci_token
ok   disk_free: 3446 MB free

## 实际经过

| 顺序 | 批次 | 运行 | attempt | 结论 | 规则 | 用时 | worker 花费 | reviewer 花费 | 合计 | worker 轮数 | head_sha | audit |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | v046-b12 | r-20261118091441 | 1 | BLOCK | — | 51m34s | $12.05 | — | $12.05 | 134/200 | — | — |
| 合计 | | | | | | 51m34s | $12.05 | — | $12.05 | | | |

## 放行与打扰

queue.gate_passed: 0
BLOCK: 1
tool.denied：0
batch.status: v046-b12 pending → blocked
打扰：1

## 每个批次

### v046-b12

```
== attempt 1 (r-20261118091441) ==
worker: exit_code=1 stop_reason=error turns=134/200 cost=$12.05 model=claude-opus-4-6 duration=51m26s tokens=in13238993/out37945
evidence: —
reviewer: —
ci.verdict_commit: 8e95868891bdccba4aa785b711c893a4e28ded4e success when=startup run_url=https://github.com/CIPFZ/Collie/actions/runs/44260091503
escalated: no valid report: /data/workspace/Collie/.collie/batches/v046-b12/report.md: cannot read report: ENOENT: no such file or directory, open '/data/workspace/Collie/.collie/batches/v046-b12/report.md'
verdict.pushed: 2026-11-18T10:06:16.286Z sha=388ff061af7ad4ae9cd21eccee0f9fd2514af481 remote=origin branch=main
cost: worker=$12.05 reviewer=— total=$12.05
结论：BLOCK，上报：no valid report: /data/workspace/Collie/.collie/batches/v046-b12/report.md: cannot read report: ENOENT: no such file or directory, open '/data/workspace/Collie/.collie/batches/v046-b12/report.md'
```

## 队列 journal

```
2026-11-18T09:14:41.574Z q-20261118091437 queue.preflight ok=true checks=[{"name":"worktree_clean","ok":true},{"name":"remote_in_sync","ok":true},{"name":"ci_token","ok":true},{"name":"disk_free","ok":true,"detail":"3446 MB free"}]
2026-11-18T09:14:41.614Z q-20261118091437 queue.batch_started batch_run_id=r-20261118091441 attempt=1 why=new
2026-11-18T10:06:16.313Z q-20261118091437 queue.finished reason=blocked batches=[{"batch_id":"v046-b12","run_id":"r-20261118091441","verdict":"BLOCK"}] paused_count=0
```

## 队列剩余

pending: v046-b13, v046-b14, v046-b15
blocked: v02-b01, v02-b04-tests, v02-b04-fix4, v03-b03, v03-b03-fix, v04-b01, v04-b04, v045-b11, v046-b08, v046-b12
