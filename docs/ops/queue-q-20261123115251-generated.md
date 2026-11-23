# 队列运行 q-20261123115251

开始：2026-11-23T11:52:55.088Z
结束：2026-11-23T12:20:53.838Z
墙钟：27m58s
结束原因：blocked
退出码：20

## 开跑前检查

ok   worktree_clean
ok   remote_in_sync
ok   ci_token
ok   disk_free: 19202 MB free

## 实际经过

| 顺序 | 批次 | 运行 | attempt | 结论 | 规则 | 用时 | worker 花费 | reviewer 花费 | tester 花费 | 合计 | worker 轮数 | head_sha | audit |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | v046-b37 | r-20261123115255 | 1 | BLOCK | — | 27m54s | $4.60 | — | $0.90 | $5.50 | 53/200 | — | — |
| 合计 | | | | | | 27m54s | $4.60 | — | $0.90 | $5.50 | | | |

## 放行与打扰

queue.gate_passed: 0
BLOCK: 1
tool.denied：0
batch.status: v046-b37 pending → blocked
打扰：1

## 每个批次

### v046-b37

```
== attempt 1 (r-20261123115255) ==
worker: exit_code=0 stop_reason=— turns=53/200 cost=$4.60 model=claude-opus-4-6 duration=22m25s tokens=in2002117/out17803
tester: turns=31 cost=$0.90 duration=4m49s invocations=1
evidence: —
reviewer: —
ci.verdict_commit: 3f3a8336f135605ab1be88694405fffb1d921b0c success when=startup run_url=https://github.com/CIPFZ/Collie/actions/runs/45151199467
escalated: acceptance_disputed: test/acceptance/v046-b37/new.test.ts: S4: output_tail with triple backticks renders with 4-backtick fences
verdict.pushed: 2026-11-23T12:20:49.782Z sha=70ccbf8eddfd27bdc0a182d4284684937f14927b remote=origin branch=main
cost: worker=$4.60 reviewer=— tester=$0.90 total=$5.50
结论：BLOCK，上报：acceptance_disputed: test/acceptance/v046-b37/new.test.ts: S4: output_tail with triple backticks renders with 4-backtick fences
```

## 队列 journal

```
2026-11-23T11:52:55.088Z q-20261123115251 queue.preflight ok=true checks=[{"name":"worktree_clean","ok":true},{"name":"remote_in_sync","ok":true},{"name":"ci_token","ok":true},{"name":"disk_free","ok":true,"detail":"19202 MB free"}]
2026-11-23T11:52:55.143Z q-20261123115251 queue.batch_started batch_run_id=r-20261123115255 attempt=1 why=new
2026-11-23T12:20:49.868Z q-20261123115251 r2.commit sha=86775a42baa3a30fd20851dd6ba41ec6ed1a007a subject=progress: v046-b37 cleanup
2026-11-23T12:20:53.832Z q-20261123115251 verdict.pushed sha=86775a42baa3a30fd20851dd6ba41ec6ed1a007a remote=origin branch=main
2026-11-23T12:20:53.836Z q-20261123115251 batch.cleanup reverted=[] removed_acceptance=true commit=86775a42baa3a30fd20851dd6ba41ec6ed1a007a
2026-11-23T12:20:53.838Z q-20261123115251 queue.finished reason=blocked batches=[{"batch_id":"v046-b37","run_id":"r-20261123115255","verdict":"BLOCK"}] paused_count=0
```

## 队列剩余

pending: v046-b38
blocked: v02-b01, v02-b04-tests, v02-b04-fix4, v03-b03, v03-b03-fix, v04-b01, v04-b04, v045-b11, v046-b08, v046-b17, v046-b23, v046-b37
