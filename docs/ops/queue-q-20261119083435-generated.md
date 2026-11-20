# 队列运行 q-20261119083435

开始：2026-11-19T08:34:39.650Z
结束：2026-11-19T09:48:20.144Z
墙钟：73m40s
结束原因：blocked
退出码：20

## 开跑前检查

ok   worktree_clean
ok   remote_in_sync
ok   ci_token
ok   disk_free: 2942 MB free

## 实际经过

| 顺序 | 批次 | 运行 | attempt | 结论 | 规则 | 用时 | worker 花费 | reviewer 花费 | 合计 | worker 轮数 | head_sha | audit |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | v046-b17 | r-20261119083439 | 1 | BLOCK | — | 52m14s | $12.07 | — | $12.07 | 39/200 | — | — |
| 2 | v046-b17 | r-20261119092654 | 2 | BLOCK | — | 21m25s | $18.87 | — | $18.87 | 18/200 | — | — |
| 合计 | | | | | | 73m40s | $30.94 | — | $30.94 | | | |

## 放行与打扰

queue.gate_passed: 0
BLOCK: 2
batch.retried: v046-b17 cause=interrupted
tool.denied：0
batch.status: v046-b17 pending → blocked
batch.status: v046-b17 pending → blocked
batch.status: v046-b17 blocked → pending
打扰：2

## 每个批次

### v046-b17

```
== attempt 1 (r-20261119083439) ==
worker: exit_code=1 stop_reason=stalled turns=39/200 cost=$12.07 model=claude-opus-4-6 duration=52m5s tokens=in2013181/out7349
evidence: —
reviewer: —
ci.verdict_commit: 86b3cad3d3e8bdd69f7b19d02a7ba0e3475c34de success when=startup run_url=https://github.com/CIPFZ/Collie/actions/runs/44467106656
escalated: no valid report: /data/workspace/Collie/.collie/batches/v046-b17/report.md: cannot read report: ENOENT: no such file or directory, open '/data/workspace/Collie/.collie/batches/v046-b17/report.md'
worker.signaled: 2026-11-19T09:26:46.386Z level=soft reason=stalled
worker.rescued: 2026-11-19T09:26:46.481Z sha=bbdf6730cb1f10d58abc0f36a4c39c464422cdf6 files=src/run.ts,src/schema/index.ts,templates/collie.toml,test/config.test.ts,test/schema.test.ts
verdict.pushed: 2026-11-19T09:26:54.587Z sha=a9d6cb59d720e7703ae4b1d61541d9b7b4f8812d remote=origin branch=main
cost: worker=$12.07 reviewer=— total=$12.07
结论：BLOCK，上报：no valid report: /data/workspace/Collie/.collie/batches/v046-b17/report.md: cannot read report: ENOENT: no such file or directory, open '/data/workspace/Collie/.collie/batches/v046-b17/report.md'

== attempt 2 (r-20261119092654) ==
worker: exit_code=1 stop_reason=error turns=18/200 cost=$18.87 model=claude-opus-4-6 duration=21m16s tokens=in1397810/out2376
evidence: —
reviewer: —
escalated: no valid report: /data/workspace/Collie/.collie/batches/v046-b17/report.md: cannot read report: ENOENT: no such file or directory, open '/data/workspace/Collie/.collie/batches/v046-b17/report.md'
worker.resumed: 2026-11-19T09:26:55.438Z session_id=bb5db0d9-60c1-4c39-881c-df1e8b409353 attempt=2
verdict.pushed: 2026-11-19T09:48:20.139Z sha=077b55eddc67a21652e9be4a2a8fae35a17e691f remote=origin branch=main
cost: worker=$18.87 reviewer=— total=$18.87
结论：BLOCK，上报：no valid report: /data/workspace/Collie/.collie/batches/v046-b17/report.md: cannot read report: ENOENT: no such file or directory, open '/data/workspace/Collie/.collie/batches/v046-b17/report.md'
```

## 队列 journal

```
2026-11-19T08:34:39.650Z q-20261119083435 queue.preflight ok=true checks=[{"name":"worktree_clean","ok":true},{"name":"remote_in_sync","ok":true},{"name":"ci_token","ok":true},{"name":"disk_free","ok":true,"detail":"2942 MB free"}]
2026-11-19T08:34:39.699Z q-20261119083435 queue.batch_started batch_run_id=r-20261119083439 attempt=1 why=new
2026-11-19T09:26:54.606Z q-20261119083435 batch.retried cause=interrupted stop_reason=stalled
2026-11-19T09:26:54.612Z q-20261119083435 batch.status from=blocked to=pending
2026-11-19T09:26:54.651Z q-20261119083435 r2.commit sha=a12da9b56323bd7c50e173509767d7816dfe00a7 subject=progress: v046-b17 interrupt_retry
2026-11-19T09:26:54.677Z q-20261119083435 queue.batch_started batch_run_id=r-20261119092654 attempt=2 why=interrupt_retry
2026-11-19T09:48:20.144Z q-20261119083435 queue.finished reason=blocked batches=[{"batch_id":"v046-b17","run_id":"r-20261119092654","verdict":"BLOCK"}] paused_count=0
```

## 队列剩余

pending: v046-b18, v046-b19
blocked: v02-b01, v02-b04-tests, v02-b04-fix4, v03-b03, v03-b03-fix, v04-b01, v04-b04, v045-b11, v046-b08, v046-b17
