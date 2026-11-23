# Collie 批次队列

> 唯一可修改者：R1 方案设计 Agent（须用户批准）。其他角色只读。
> 优先级在方案确定阶段一次排定，批次随之固定，**不做滚动重新拆解**。
> R1 签发自查（v02-b04-fix 后）：条目里每一条「测试要注入 X / 用 Y 替代 Z」的要求，验收必须同时 grep 源文件和对应测试文件，
> 只 grep `src/` 的验收抓不住「接口做了、测试没用上」（b04：只注入 now；b04-fix：指纹可注入但场景 G 没注入）。
> 凡验收表含 grep 类结构检查的批次，条目正文必须写「同步加进 `test/invariants.test.ts`」，验收加一条 grep 该文件（SPEC 3.2 结构不变量）。
> R1 签发自查（v04-b04 后，SPEC 13.12、13.13）：条目正文必须写明要读的 SPEC 小节号（worker 不再通读 SPEC，task 也不带小节开头的说明文字）；
> 条目要求展示某个值时，写明它取自哪个事件的哪个字段，并核对 R2 确实写了它；只读命令的测试至少有一组夹具来自 fake runner 跑出的真实运行。
> R1 签发自查（v045-b04 后，SPEC 14.8）：条目里有「只做一次」「重试」「退避」这类跨多圈才看得出的行为，写明「连续 N 圈之后是什么样」并要求测试真的走 N 圈；
> 要求「数据来自真实运行」时点名是哪几条断言；一个批次不要既改 R2 又加新命令（v045-b01 因此用满了 200 轮）。
> R1 签发自查（v045-b05 / b06 后，SPEC 14.11）：多圈行为的情形要一直写到「恢复之后」为止（失败几圈、恢复、再走几圈之后是什么样）；
> 改 R2 的条目单独成批，不和投影、多个测试文件的改动放在一起（v045-b06 用了 168 轮）。
> R1 签发自查（v045-b08 后，SPEC 14.13）：改已有模块的条目，写明哪些已有行为必须原样留下，并给容易被顺手删掉的那几条各配一条验收；
> 允许改写的旧用例要点名，不写「与新行为冲突的可以改」这种交给 worker 判断的豁免；队列参数（如 `--max`）碰到没跑过的情形之前，先用假 runner 试一遍。
> R1 复核自查（v045-b09 后，SPEC 14.16）：检查工具报「全部被发现」「全部通过」时先做一次对照——不做任何改动走一遍它的判定路径，结果应该是「没被发现」；
> 对照没做过的结论不写进规格（「变异检查 44 项全部被发现」里有 9 项是测试文件加载失败）。
> R1 签发自查（v045-b15 / v046-b03 后，SPEC 14.21、14.23）：签批次前先查现有测试里谁守着要改的行为，在条目里写「R1 查过」哪几条；
> 要读的 SPEC 小节号写在条目或情形里，不写在开头的说明里（说明文字不进任何任务书）；验收不数用例个数（夹具里的 `it(` 也会被数进去），改成点名用例组的标题。
> R1 签发自查（v046-b07 / b08 后，SPEC 14.25）：条目里举例时不拿本仓库的现状当例子（「本仓库的配置就没有这两项」被写成了断言）；
> 新测试文件要建 git 仓库、用临时目录的，验收里加一条「没有 git 全局身份、系统临时目录里有别人的同名前缀目录」时也通过的命令：CI 的机器和开发的机器不一样，worker 看不到 CI。
> R1 签发自查（v046-b09 后，SPEC 14.26）：条目里允许「改某条断言看的对象」时，同时写明「不许删这条断言」，并在指令里请操作员把被守的那一处撤掉、看测试变不变红（两条残留检查被删，reviewer 判为合理）。
> R1 签发自查（v046-b14 后，SPEC 14.27、16.15）：签发前还要查钉死完整清单的用例（事件序列、事件类型个数、整段配置对象、变异清单项数）；
> 条目里不写「发现别的现有用例失败一律停下」，写「只许做新行为直接要求的最小改动并逐条列出，拿不准才停下」（b14 照「停下」把代码推了上去，主分支红了 26 分钟）。
> R1 签发自查（v046-b17 后，SPEC 14.30）：每批最多 3 个条目，签完先 `show` 一遍；条目之间互相对一遍，尤其是「要做的清理」和「要保留的现有断言」会不会打架；
> 点名的文件先 `grep` 确认（超时写成了 `scenario-n`，实际在 `follow`）；手册是 R1 的文档，R1 自己改，不放进批次；在主仓库里执行 `git clean` 这类会删别人文件的命令不签。
> R1 签发自查（v046-b19、b20 后，SPEC 14.31）：写「输出不变」时写明是哪些输出（文字、JSON 都算），验收里各比一次；让测试删或改的文件，不能是 R2 自己本来就会重写的那个；
> 把一段留待以后的事拆成批次时，对着原来的清单逐项点一遍（16.14 留下四项，拆的时候漏了两项）。
> R1 签发自查（v046-b22 后，SPEC 14.32）：动 git 工作区的批次，加粗情形里要有「工作区里另有未跟踪文件时」；额外禁止里列了的命令（如 `reset`），验收里加一条 grep 守住；冲突类用例写明要内容冲突。
> R1 签发自查（v046-b24、b25 后，SPEC 14.34）：加粗情形里写了「X 的时候」，就写明测试怎样造出 X，并在验收里放一条「把修复撤掉，这条测试必须失败」由操作员核对；不许用 `.gitignore` 之类的办法绕开要造的情形。
> R1 签发自查（v046-b24 的时限后，SPEC 14.35）：条目里写到工具的行为（如「钩子跟着用例的时限走」）先查证再写，那一句是错的：vitest 的钩子时限是配置里的 `hookTimeout`。
> v046-b32 之后：「可改的受保护路径」加冒号独占一行就是小节标签，说明文字里提到它时不要让它独占一行。
> R1 签发自查（v046-b30 后，SPEC 14.36、16.22）：加粗情形里写到的操作步骤（如「把状态格改回 pending 再跑」），先核对这条路在 R2 里走不走得通；走不通的不写。
> 有可测行为的批次按「情形」写，验收只留 lint、类型检查、全量测试与本批次的验收测试；变异检查已在全局命令里，验收表里不再单独写。
> R1 签发自查（v046-b34 后，SPEC 14.37）：情形里每一个期望都单独想一遍在现有代码上成不成立：测试 agent 会把一条情形拆成几条用例，[新] 里混着现在就成立的期望，会被红检查判成「本该失败却通过」；现在就成立的归到 [保持]。
> 情形要用到现有类型上还没有的字段时，在「接口」里写明；「接口」里点出可以照着搭的现有测试文件。

更新时间：2026-11-17
当前版本：v0.4 已于 2026-11-16 记为收口（SPEC 13.24）；在做 SPEC 第 14 章「收掉操作员」与第 15 章，v045-b01 到 b10 已通过，v045-b11 是 `blocked`（代码已在 main 上，被拦的原因是 R2 的缺陷，见 SPEC 14.16）；所有者 2026-11-17 已裁定（SPEC 14.17）；v045-b12 到 b18 与 v046-b01 到 b16 已通过（SPEC 14.19~14.28）；v046-b08 是 `blocked`（代码已在 main 上，随 v046-b09 取证，见 SPEC 14.26）；v046-b17 是 `blocked`（两次因模型接口中断，改签为 v046-b20，见 SPEC 14.30）；v046-b18 到 b22、b24、b25、b27 已通过（SPEC 14.31~14.34；v046-b21 是第一个带情形的批次，v046-b25 是单批次重跑通过、状态格由 R1 改）；v046-b23 是 `blocked`（改签为 v046-b26）；v046-b26、b28、b29 已通过（SPEC 14.35）；v046-b30、b31、b32 已通过（SPEC 14.36）；v046-b33、b34 已通过（SPEC 14.37）；队列从 v046-b35 起，固定版本 `d19d890`；本项目配置的全局命令里有变异检查，每次取证都跑
配套：[SPEC.md](./SPEC.md) 第 7 章里程碑、第 8 章验收场景

---

## 队列总览

| 优先级 | 批次 | 标题 | 依赖 | 状态 |
|---|---|---|---|---|
| 1 | v01-b01 | 工程骨架与基础设施 | — | passed |
| 2 | v01-b02 | 批次解析与 worker 角色 | v01-b01 | passed |
| 3 | v01-b03 | 取证工具与审核角色 | v01-b02 | passed |
| 4 | v01-b04 | 仲裁、CLI 与三场景验证 | v01-b03 | passed |
| 5 | v01-b05 | 真实 runner | v01-b04 | passed |
| 6 | v01-b05-smoke | 烟雾批次：README 改一行 | v01-b05 | passed |
| 7 | v02-b01 | 真实运行暴露的两处修补 | v01-b05 | blocked |
| 8 | v02-b02 | 落盘、心跳与救援 | v01-b05 | passed |
| 9 | v02-b03 | 活性检测与信号阶梯 | v02-b02 | passed |
| 10 | v02-b04 | b02/b03 遗留修补 | v02-b03 | passed |
| 11 | v02-b04-tests | 测试去真实定时器 | v02-b04 | blocked |
| 12 | v02-b04-fix | R2 不再崩：interrupt this、异常兜底、内容指纹 | v02-b04 | passed |
| 13 | v02-b04-fix2 | CI 证据与结构回归 | v02-b04-fix | passed |
| 14 | v02-b04-fix3 | worker_pid、包装层 interrupt、原子心跳 | v02-b04-fix2 | passed |
| 15 | v02-b04-fix4 | spawn 钩子按 SDK 签名、类型来自 SDK、collie smoke | v02-b04-fix3 | blocked |
| 16 | v02-b05 | 中断标记与 resume | v02-b04-fix4 | passed |
| 17 | v02-b05-fix | 规则 9、worker_pid 时序、CI 未取证措辞 | v02-b05 | passed |
| 18 | v02-e-drill | stream.ndjson 密钥屏蔽（场景 E 真实 kill 演练） | v02-b05-fix | passed |
| 19 | v02-e-fix | worker 随 R2 死、取证沿用首次 base_sha、interrupted_at | v02-e-drill | passed |
| 20 | v02-e-drill2 | 场景 E 第 2 次演练（脏工作区 + 不补杀） | v02-e-fix | passed |
| 21 | v02-e-fix2 | rescue_sha 跨轮查找、interrupted_at 时间 | v02-e-drill2 | passed |
| 22 | v03-b01 | 收回人工动作：R2 推送裁定提交、启动核查其 CI、reviewer 流落盘、场景 H | v02-e-fix2 | passed |
| 23 | v03-b01-fix | 启动补推只认失败的裁定提交，且先于救援 | v03-b01 | passed |
| 24 | v03-b02 | 工具白名单真正生效：tools 选项、reviewer Bash 黑名单 | v03-b01-fix | passed |
| 25 | v03-b03 | 队列消费与分流：--continue、fix_max 返工闸、backlog 状态列 | v03-b02 | blocked |
| 26 | v03-b03-fix | head_sha 按首次 base_sha、取证排除 R2 提交、续接成本判断、中断原因、CLI 总结行、audit | v03-b03 | blocked |
| 27 | v03-b03-fix2 | 补两条断言、bash_deny 正反用例、tool.denied 进 journal、测试超时 | v03-b03-fix | passed |
| 28 | v03-b04 | 放行判定与停表：queue.paused、规则 1 自动重跑、规则 9 连续两次 | v03-b03-fix2 | passed |
| 29 | v03-b04-fix | FIX 重跑的 task 语义、fix_max 只计本次队列、队列 journal 可还原 | v03-b04 | passed |
| 30 | v04-b01 | 观测数据补齐：运行级字段、evidence.collected、裁定依据，判定第 6 项与 README 清理 | v03-b04-fix | blocked |
| 31 | v04-b02 | 投影模块 view.ts 与 collie status | v03-b04-fix | passed |
| 32 | v04-b03 | collie timeline：时间轨迹与按版本汇总 | v04-b02 | passed |
| 33 | v04-b04 | collie why：按 attempt 摊开证据链 | v04-b02 | blocked |
| 34 | v04-b05 | collie watch：实时跟随 | v04-b02 | passed |
| 35 | v04-b06 | 环境故障不当成 worker 的 FIX：token 读不到就启动失败、证据取不到时队列不重跑 | v03-b04-fix | passed |
| 36 | v04-b07 | 队列收尾：queue.batch_started 归位、fix_max 提交推送、FIX 重跑写明降级原因 | v04-b06 | passed |
| 37 | v04-b08 | 投影取值修补：attempt 按 R2 口径推算、运行用时、花费缺数据、空数据的 --json | v04-b03 | passed |
| 38 | v04-b09 | collie why：按 attempt 摊开证据链（重签 v04-b04） | v04-b08 | passed |
| 39 | v04-b10 | 队列里的中断自动续跑一次、验收失败全记、放行留痕 | v04-b07 | passed |
| 40 | v04-b11 | R2 的后台 git 读取不抢索引锁 | v04-b10 | passed |
| 41 | v04-b12 | 活性场景测试的假时钟：冻结前不走，加慢开局用例（只改测试） | v04-b10 | passed |
| 42 | v04-b13 | 上报原因写对、BLOCK 后的重跑说清原因、单批次 run_id 去掉连字符 | v04-b11 | passed |
| 43 | v04-b14 | 裁定提交的 CI 在取证后补查一次 | v04-b13 | passed |
| 44 | v04-b15 | collie why 的结论行：规则号从降级事件推，推不出显示「规则 —」 | v04-b09 | passed |
| 45 | v04-b16 | report 里的 sha 解析不了改判为声称不符：FIX 并自动重跑 | v04-b13 | passed |
| 46 | v04-b17 | why / timeline 补齐 journal 里已有的数据：reviewer 花费、模型、用时、token、head_sha、裁定提交 CI | v04-b16 | passed |
| 47 | v045-b01 | 开跑前检查与 audit 并进队列：collie preflight、queue.preflight、audit 不符停表 | v04-b17 | passed |
| 48 | v045-b02 | collie report：把一次队列运行写成 Markdown 汇报 | v045-b01 | passed |
| 49 | v045-b03 | 通知与交接协议：notify 模块、next.md 的键值行、下一步动作的判定 | v045-b02 | passed |
| 50 | v045-b04 | collie follow：常驻循环，按 next.md 开跑、交汇报、发通知 | v045-b03 | passed |
| 51 | v045-b05 | collie follow 加固：已处理落在仓库里、失败只通知一次并退避、通知不带路径、子进程与汇报附录 | v045-b04 | passed |
| 52 | v045-b06 | collie report 与 why 补齐：开始与墙钟、合计、轮数上限、tool.denied、批次状态、CI 链接 | v045-b02 | passed |
| 53 | v045-b07 | 变异检查：删掉规则、放行条件或受保护路径里的任意一处，测试必须变红 | v04-b17 | passed |
| 54 | v045-b08 | collie follow 的推送与收尾：每圈先同步、分叉时 rebase、汇报上了远端才通知、完整输出、npm ci 失败清目录 | v045-b05 | passed |
| 55 | v045-b09 | 变异检查判定收紧：基线含类型检查、caught 看测试结果不看退出码、超时不算 invalid | v045-b07 | passed |
| 56 | v045-b10 | --max 只数通过的批次：FIX 重跑不占名额 | v045-b01 | passed |
| 57 | v045-b11 | collie follow 的同步失败与汇报没提交成：补回连续失败通知、没提交成不说「看」 | v045-b08 | blocked |
| 58 | v045-b12 | reviewer 拿不到任何一轮的汇报：工作目录里没有 report.md，取证范围排除信封目录 | v045-b10 | passed |
| 59 | v045-b13 | 删除仲裁规则 4：reviewer 报的「声称不符」不再改裁定 | v045-b10 | passed |
| 60 | v045-b14 | 运行器：SDK 抛错之前已收到结果消息时，花费与轮数照常带回 | v04-b17 | passed |
| 61 | v045-b15 | 运行器：一个会话给出多条结果消息时，轮数与 token 合计，成败不被后一条盖掉 | v045-b14 | passed |
| 62 | v045-b16 | reviewer 的工作目录里，本批次的信封只留 task.md | v045-b12 | passed |
| 63 | v045-b17 | 测试：去掉低于全局值的局部超时 | v045-b07 | passed |
| 64 | v046-b01 | 配置解耦：测试不再盯着本仓库 .collie/collie.toml 里的数值 | v045-b13 | passed |
| 65 | v045-b18 | 运行器：失败的返回值一定带结束原因 | v045-b15 | passed |
| 66 | v046-b02 | 测试 agent 的角色模块：角色、配置段、提示词（不接进队列） | v046-b01 | passed |
| 67 | v046-b03 | 红检查：验收测试在没有实现时，新行为的全部失败、要保持的全部通过（不接进队列） | v046-b01 | passed |
| 68 | v046-b04 | 条目的「情形」写法：backlog 解析情形与接口，测试 agent 只拿情形（不接进队列） | v046-b02 | passed |
| 69 | v046-b05 | 红检查加静态检查：只多了验收测试的树上 lint 与类型检查必须通过（不接进队列） | v046-b03 | passed |
| 70 | v046-b06 | 情形与接口的列表允许空行；测试 agent 提示词两处小修（不接进队列） | v046-b04 | passed |
| 71 | v046-b07 | 配置加 tester_max 与静态检查命令、三个事件类型、test/acceptance 受保护（不接进队列） | v046-b05 | passed |
| 72 | v046-b08 | 测试 agent 这一步的模块：拉起、红检查、重写、只取走点名的文件（不接进队列） | v046-b06, v046-b07 | blocked |
| 73 | v046-b09 | 测试只依赖自己带的环境：git 身份、私有临时目录、不绑本仓库配置；沙箱可留 journal | v046-b06, v046-b07 | passed |
| 74 | v046-b10 | prepareAcceptance 收尾：带回测试 agent 的回复、类别标错不再重拉（不接进队列） | v046-b09 | passed |
| 75 | v046-b11 | R2 诊断信息：规则 9 重跑的 task 带 CI 链接；查裁定提交 CI 出异常时记事件 | v046-b09 | passed |
| 76 | v046-b12 | 接线前的铺垫补齐：测试 agent 的事件与中止、类别标错清单；三处测试小修（不接进队列） | v046-b10 | passed |
| 77 | v046-b13 | 活性指纹不占索引锁：R2 在 worker 工作期间不改写 .git/index | v046-b09 | passed |
| 78 | v046-b14 | R2 凭提交号认自己的提交：规则 2 不再按提交说明的开头跳过 | v046-b11 | passed |
| 79 | v046-b15 | 接线第一块：带情形的批次在写 task 信封之前先拉起测试 agent | v046-b12, v046-b14, v046-b16 | passed |
| 80 | v046-b16 | prepareAcceptance 里运行器抛错的两种情形；两条空过的测试改实（不接进队列） | v046-b12 | passed |
| 81 | v046-b17 | 接线收尾一：被跟踪文件不进提交、heartbeat 阶段改回、测试 agent 单独墙钟、放宽超时 | v046-b15 | blocked |
| 82 | v046-b18 | 接线收尾二：带情形的 worker 任务书多出情形与接口两节、写明验收测试不能改 | v046-b15, v046-b20 | passed |
| 83 | v046-b19 | 接线收尾三：why 与 report 显示测试 agent 的花费 | v046-b18 | passed |
| 84 | v046-b20 | v046-b17 改签：测试 agent 动过的被跟踪文件恢复原样、heartbeat 与墙钟补测试、放宽超时，把主分支修绿 | v046-b15 | passed |
| 85 | v046-b21 | 没有测试 agent 的运行，why 与 report 的 JSON 里不出现测试 agent 的键（第一个带情形的批次） | v046-b19 | passed |
| 86 | v046-b22 | 批次在队列里最终被拦时的收尾：撤销救援提交的改动、拿掉本批次的验收测试 | v046-b20 | passed |
| 87 | v046-b23 | 模型接口出错的 worker 会话算可续跑的中断：先等一段时间，自动续跑一次 | v046-b22 | blocked |
| 88 | v046-b24 | 小修：reviewer 读这一次运行的信封；两处守不住的测试改实 | v046-b20 | passed |
| 89 | v046-b25 | 收尾只提交自己改的路径：不提交未跟踪文件、冲突时只用 revert --abort | v046-b22 | passed |
| 90 | v046-b26 | （v046-b23 改签）模型接口出错的 worker 会话算可续跑的中断：先等一段时间，自动续跑一次 | v046-b25 | passed |
| 91 | v046-b27 | 开跑前检查：运行器退出码非零算不过，写出结束原因与用时 | v046-b20 | passed |
| 92 | v046-b28 | 测试改实：reviewer 信封、收尾的未跟踪文件与内容冲突三处造出真正的情形 | v046-b25 | passed |
| 93 | v046-b29 | 同一个 head_sha 第二次被规则 9 降级就上报，不再自动重跑（D10） | v046-b26 | passed |
| 94 | v046-b30 | 小修：rule9_same_head 只看这一次的 head_sha；api_error 续跑总带 waited_secs | v046-b29 | passed |
| 95 | v046-b31 | CI、lint、测试配置列为受保护路径，变异清单加三项（第 16 章第 2 步） | v046-b29 | passed |
| 96 | v046-b32 | 批次授权：条目点名的受保护路径由 worker 改，不计入受保护文件改动行数（D9） | v046-b31 | passed |
| 97 | v046-b33 | 测试时限提到 300 秒（第一个用批次授权的批次） | v046-b32 | passed |
| 98 | v046-b34 | 授权路径的两处补全：报错信息的说法、带 .. 的写法有测试守着（带情形） | v046-b32 | passed |
| 99 | v046-b35 | 没过的验收命令留下输出的末尾：进运行日志与重跑的任务书（带情形） | v046-b34 | pending |
| 100 | v046-b36 | worker 认为验收测试写错了：汇报里声明，R2 不拉审核、不计返工、上报停下（带情形） | v046-b34 | pending |

状态取值限 `pending` / `running` / `passed` / `blocked`（SPEC 3.2 枚举）。
本文件是批次的事实源，`task.md` 是其派生物；二者不一致时以本文件为准并重新签发 task。

---

## v01-b01 工程骨架与基础设施

优先级：1　依赖：无

条目：
1. 工程骨架：`package.json`、`tsconfig.json`（strict）、ESLint（含 `no-explicit-any`、
   `src/**` 上 `no-magic-numbers`）、Prettier、vitest 配置、
   `.gitignore`（含 `node_modules/`、`dist/`、`.collie/runs/`、`.collie/heartbeat.json`）、
   GitHub Actions CI（**监听 main**）。依赖见 SPEC 2.2 与 ADR-002
2. `src/config.ts` + `src/schema/index.ts`：解析并校验 `.collie/collie.toml`（由 R1 放置，只读），
   `SCHEMA_VERSION = 1`，全部 zod schema（strict）与导出类型
3. `src/journal.ts`：`events.ndjson` 的 append-only 追加与校验重放，
   支持 SPEC 3.6 的 v0.1 事件类型；坏行报错并指出行号，不静默跳过

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| schema 测试存在且通过 | `npm test -- schema` | exit 0 |
| journal 测试存在且通过 | `npm test -- journal` | exit 0 |
| config 测试存在且通过 | `npm test -- config` | exit 0 |
| CI 配置监听 main（结构检查） | `grep -qE 'branches:\s*\[\s*main\s*\]' .github/workflows/ci.yml` | exit 0 |

R4 读代码核验项（非命令判定）：测试内容是否覆盖 task.md 「测试内容要求」；
CI 是否实际触发且监听分支正确（GitHub API）。

额外禁止：
- 引入 SPEC 2.2 与 ADR-002 清单之外的依赖
- 在代码中裸写阈值数字
- 创建或修改 `.collie/collie.toml`

## v01-b02 批次解析与 worker 角色

优先级：2　依赖：v01-b01

条目：
1. `src/backlog.ts`：解析本文件为 `Batch[]`，校验验收标准均为可执行命令
   （不可机器判定则报错并拒绝执行）
2. `src/runner/index.ts` + `src/runner/fake.ts`：Agent 调用的统一接口与测试实现
3. `src/roles/worker.ts`：组装 `task.md`（frontmatter + 正文）、经 runner 拉起、
   读回 `report.md` 并用 zod 校验尾部 JSON 块

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| backlog 解析正确 | `npm test -- test/backlog.test.ts` | exit 0 |
| 拒绝不可判定验收 | `npm test -- test/backlog-reject.test.ts` | exit 0 |
| fake runner 闭环 | `npm test -- test/worker.test.ts` | exit 0 |
| task.md 格式正确 | `npm test -- test/task-envelope.test.ts` | exit 0 |
| roles 不直接依赖 SDK 或 fake | `test -d src/roles && ! grep -rE "from ['\"](@anthropic-ai\|\.\./runner/fake\|\./fake)" src/roles/` | exit 0 |

R4 读代码核验项（非命令判定）：测试内容是否覆盖 task.md「测试内容要求」；
`src/roles/` 是否经 ESLint `no-restricted-imports` 物理隔离 SDK 与 fake。

额外禁止：
- 在 `roles/` 中直接调用 Agent SDK（必须经 runner 接口）
- 实现任何 v0.2 及以后的失败恢复逻辑

## v01-b03 取证工具与审核角色

优先级：3　依赖：v01-b02

条目：
1. 两处小改：`claims.ci_passed` 改为可选字段默认 `false`（不升版本、不写迁移）；
   `backlog.test.ts` 的「恰好三个批次」断言改为只校验 v01-b01/b02 的固定字段；
   `RunOptions` 加可选 `signal?: AbortSignal`
2. `src/verify.ts` + `src/git.ts` + `src/ci.ts`：实跑 `parseBacklog` 解析后的验收命令并结构化输出
   （SPEC 3.2「唯一执行形式」）；git 封装（log / diff --stat / ls-remote / status / commit）；
   CI 实际结论查询**并核对监听分支**，支持 `GITHUB_TOKEN` 鉴权，无 token 时限流须显式报错而非静默
3. `src/roles/reviewer.ts`：从零组装审核 prompt（**函数签名不含 report 正文参数**，
   只接收 `base_sha` / `head_sha` / task 验收项 / SPEC 路径）、经 runner 拉起（`allowedTools`
   取 `cfg.agent.reviewer`，不含 Write/Edit）、读回 `verdict.md` 用 `VerdictSchema` 校验
   （schema 按 SPEC 3.5 新增，复用 `extractLastJsonFence`）

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 验收命令实跑与结构化 | `npm test -- test/verify.test.ts` | exit 0 |
| git 封装 | `npm test -- test/git.test.ts` | exit 0 |
| CI 查询与分支核对 | `npm test -- test/ci.test.ts` | exit 0 |
| reviewer 不接收 report 正文 | `npm test -- test/reviewer-isolation.test.ts` | exit 0 |

R4 读代码核验项：v01-b01 与 v01-b02 的真实 report（无 `ci_passed`）被 `readReport` 接受；
`reviewer.ts` 的类型签名在编译期就排除 report 正文；`ci.ts` 对限流的处理是报错而非返回 null。

额外禁止：
- 让 reviewer 具备写入能力（工具白名单不得含 Write/Edit）
- 实现 `arbiter.ts`、`progress.ts`、`cli.ts`、`runner/claude.ts`（属 b04）
- `ci.ts` 在测试中访问网络（用注入的 fetch 替身）

## v01-b04 仲裁、CLI 与三场景验证

优先级：4　依赖：v01-b03

条目：
1. `src/arbiter.ts`：SPEC 4.3 的八条仲裁规则，按顺序命中即停，输出最终 verdict 与 `claim_mismatches`；
   `VerdictSchema` 放宽为 SPEC 3.5 新约定（`ci_branch_matched` 可 null、`conditions` 可选）；
   「已推送」改为 fetch 后 `merge-base --is-ancestor head_sha origin/main`；
   `RunResult` 加 `finalText`，reviewer 的 verdict 由 R2 从 `finalText` 写入，
   reviewer 在 `git worktree add <tmp> head_sha` 中运行
2. `src/progress.ts` + `src/cli.ts`：依据 arbiter 输出与 evidence 写 `docs/progress.md`；
   `collie init` / `collie run <batch>` / `collie show <batch>` 三个命令；
   退出码 0 / 10 / 20 / 1（SPEC 5）；`run` 以 `AbortSignal.timeout(wallclock_secs)` 包裹 worker（SPEC 3.3）；
   journal 事件按 SPEC 3.6 写入
3. `test/scenario-{a,b,c}.test.ts`：用 fake runner 构造 SPEC 8 的三个场景，
   断言最终 verdict、`claim.mismatch` 事件与 `collie run` 退出码

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 仲裁规则全覆盖 | `npm test -- test/arbiter.test.ts` | exit 0 |
| 场景 A 假 CI 全绿被拦 | `npm test -- test/scenario-a.test.ts` | exit 0 |
| 场景 B 假测试数被拦 | `npm test -- test/scenario-b.test.ts` | exit 0 |
| 场景 C 偷改 SPEC 被拦 | `npm test -- test/scenario-c.test.ts` | exit 0 |
| 退出码正确 | `npm test -- test/exit-codes.test.ts` | exit 0 |

R4 读代码核验项：八条规则各有独立用例且顺序敏感；三个场景的 fake 剧本确实构造了「声称 vs 实测不符」而非仅构造失败。

额外禁止：
- 用约束解码强制 verdict 三值（必须由 arbiter 解析校验）
- 实现 `runner/claude.ts`（真实 runner 为 v0.1 收尾单独批次，视 b04 结果决定）

## v01-b05 真实 runner

优先级：5　依赖：v01-b04

条目：
1. `src/runner/claude.ts`：基于 `@anthropic-ai/claude-agent-sdk` 实现 `AgentRunner`；
   构造时接收 `CollieConfig`，按 role 取 model / allowedTools / maxTurns；
   透传 `signal`；收集最终回复为 `finalText`；NDJSON 事件经 `onEvent` 回调；
   SDK 特有概念不泄漏到 `runner/` 之外（ROADMAP 0.4）
2. `collie run` 接入真实 runner：默认用 `claude.ts`，`--runner fake` 保留测试路径；
   `collie init` 生成的配置模板可直接用
   2a. 配置增加 `permission_mode`（SPEC 3.1）：`AgentConfigSchema` 加可选字段，
   `ClaudeRunner` 从配置读取；`.collie/collie.toml` 两个角色各加一行 `permission_mode = "bypassPermissions"`，
   **此两行授权 worker 与 schema 改动在同一提交内修改**（铁律 17：每个提交独立可构建）；
   `collie init` 模板同步。
   2b. 仲裁规则 3 的认可依赖清单恢复 `@anthropic-ai/claude-agent-sdk`（ADR-004）
   2d. `buildTask` 写入 `issued_by: collie`（SPEC 3.3）；`worker.finished` 事件携带 `final_text`
   （`RunResult.finalText` 截断 2000 字，SPEC 3.6）；`collie show` 打印它
   2e. 仲裁规则 8（SPEC 4.3）：任一验收命令实测未满足期望，PASS 降 FIX 并写 `acceptance.failed` 事件；
   加一个「诚实 worker、验收实测失败、reviewer 判 PASS」的场景测试 `test/scenario-d.test.ts`，
   断言最终 FIX、退出码 10；原三场景不受影响
   2c. R2 取证前先等 CI：`ci.ts` 对 `head_sha` 轮询直到结论不是 pending，上限 `limits.ci_wait_secs`、间隔 `limits.ci_poll_secs`
   （SPEC 3.1，默认 1800 / 30），超时记 `unknown` 并写 `ci.wait_timeout` 事件（SPEC 3.6，字段 head_sha / waited_secs / last_state）；
   `collie.toml` 加这两行授权与 schema 改动同一提交；测试用注入的 fetch 替身模拟「先 pending 后 success」
3. 在本仓库用真实 runner 跑一次 `collie run v01-b05-smoke`（一个只改 README 一行的烟雾批次），
   把完整 task / report / verdict / progress 落盘作为第一个真实样本

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| SDK 概念不泄漏 | `! grep -rlE "@anthropic-ai" src --include='*.ts' \| grep -v '^src/runner/'` | exit 0 |
| 平台树不被 Collie 调用 | `! grep -rlE "@opentelemetry\|fast-sha256" src --include='*.ts'` | exit 0 |
| claude runner 单元测试（SDK 用替身） | `npm test -- test/runner-claude.test.ts` | exit 0 |
| 烟雾批次样本存在 | `test -f .collie/batches/v01-b05-smoke/verdict.md` | exit 0 |
| 场景 D 诚实但验收失败被降级 | `npm test -- test/scenario-d.test.ts` | exit 0 |

额外禁止：
- 测试中调用真实 SDK 或联网
- 在 `runner/` 之外 import SDK

## v01-b05-smoke 烟雾批次：README 改一行

优先级：6　依赖：v01-b05

条目：
1. 在 `README.md` 末尾追加一行：`Collie 用 Collie 跑过的第一个批次：v01-b05-smoke`

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 全部测试通过 | `npm test` | exit 0 |
| README 已追加该行 | `grep -q "第一个批次：v01-b05-smoke" README.md` | exit 0 |
| 只改了 README | `test "$(git diff --name-only HEAD~1 HEAD)" = "README.md"` | exit 0 |

额外禁止：
- 改动 README 以外的任何文件

结论（2026-10-20）：交付物在第 3 次运行已落地，第 4 次运行判 FIX 是因验收第 3 条基于「最近一次提交」，
不幂等。教训：验收命令只断言仓库状态，不断言 diff。本批次判 passed，不再运行。

## v02-b01 真实运行暴露的两处修补

优先级：7　依赖：v01-b05

第一个由 `collie run` 签发并执行的批次。

条目：
1. `ci.ts`：`head_sha` 无自身运行时，采信满足 SPEC 4.2「CI 运行的归属」条件的后代提交运行；
   不满足条件的后代不采信；测试覆盖三种情况（自身运行 / 合规后代 / 改了代码的后代）
2. `progress.ts`：Collie 标记段按运行追加一行（SPEC 2.3），不覆盖；
   回填 v01-b05-smoke 的 4 次运行各一行，数据取自 git 历史与 journal

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| CI 归属三种情况 | `npm test -- test/ci.test.ts` | exit 0 |
| progress 含 4 次烟雾运行 | `test "$(grep -c 'v01-b05-smoke' docs/progress.md)" -ge 4` | exit 0 |

额外禁止：
- 改动 SPEC / CONSTRAINTS / ROLES / backlog

结论（2026-10-20，第一次自举运行）：BLOCK，规则 2，判定正确。条目 2 把 `docs/progress.md` 的回填派给了 worker，
而该文件是受保护路径——是 R1 签发错误，不是 worker 或 Collie 的问题。
代码部分（`9962761` 的 ci.ts / progress.ts 改动）已在 main 且验收 5 条全过，予以采用；
progress.md 的回填内容有误，已由 R2 占位者更正。本批次不重跑。
教训：task 条目不得要求 worker 写任何第 2 节清单内的文件；R1 签发前对照清单自查。

## v02-b02 落盘、心跳与救援

优先级：8　依赖：v01-b05

v0.2 第一批。规格见 SPEC 第 11 章 11.1~11.4、11.8。

条目：
1. `src/runner/index.ts` 追加 `resumeSessionId` / `onStarted` / `RunHandle`（11.2）；
   `fake.ts` 实现三级 `stop`，可脚本化「不响应 soft」；`claude.ts` 实现 `RunHandle`
   （soft / hard / kill 的 SDK 映射留在 runner 内，SDK 无 pid 时 `pid` 省略）。
   按 SPEC 11.2 的约束：soft 用 SDK 的轮次级 `interrupt()`，不得与 hard 同为 abort；
   `test/runner-claude.test.ts` 须断言注入的 `query()` 收到的选项中，SDK 的 `resume` 字段等于 `resumeSessionId`
2. `stream.ndjson` 落盘（11.3）；`heartbeat.json` 写入、更新、清理、启动时孤儿检测与并行拒绝（11.3）；
   新增事件 `run.orphaned` / `worker.rescued`（11.8）。
   修正 v01-b01 留下的扩展名错误：`.gitignore` 与 `src/cli.ts` 的 `GITIGNORE_ENTRIES`
   把 `.collie/heartbeat` 改为 `.collie/heartbeat.json`，否则救援提交会把心跳文件带进仓库
3. 脏工作区救援（11.4）：worker 退出后由 R2 执行 wip 提交并记事件；救援提交不推送。
   场景 E 前半段 `test/scenario-e.test.ts`：断言 kill 后救援提交与事件存在
   （`attempt=2` / `interrupted_at` 的断言留给 v02-b05）

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 场景 E 前半段 | `npm test -- test/scenario-e.test.ts` | exit 0 |
| 心跳与孤儿检测 | `npm test -- test/heartbeat.test.ts` | exit 0 |
| 心跳文件被忽略 | `git check-ignore -q .collie/heartbeat.json` | exit 0 |
| resume 字段映射有断言 | `grep -qE "resume" test/runner-claude.test.ts` | exit 0 |
| SDK 概念不泄漏 | `! grep -rlE "@anthropic-ai" src --include='*.ts' \| grep -v '^src/runner/'` | exit 0 |

额外禁止：
- 改动任何受保护路径（含 `.collie/collie.toml`）；本批次不新增配置字段
- 测试联网或调用真实 SDK

记录：第 1 次运行 r-20261020-120837 BLOCK，worker 120 轮用满、未写 report，R2 未取证。
worker 的 3 个提交存档于 tag `v02-b02-attempt1`，未审核不采用，main 重置后重跑；
worker `max_turns` 上调为 200（SPEC 3.1）。
第 2 次运行 r-20261020-124813 PASS（`00cd501`），8/8 验收实跑通过，R1 复核通过。
已知缺口：soft 未按条目 1 用 `interrupt()`，reviewer 只核了「soft≠hard」字面即放行；
PASS 维持（规则链无误），缺口转入 v02-b03 条目 2 并加两条验收。

## v02-b03 活性检测与信号阶梯

优先级：9　依赖：v02-b02

规格见 SPEC 11.1、11.5、11.6、11.8。

条目：
1. 活性检测（11.5）：启用 `stall_secs` / `progress_secs`，卡死与空转两条计时，产出指纹按事件采样；
   新增事件 `worker.stalled` / `worker.idling`
2. 信号阶梯（11.6）：`limits.grace_secs` 加为可选字段默认 20；soft → grace → hard → grace → kill，
   每级记 `worker.signaled`；`wallclock_secs` 超时改走阶梯（reason=wallclock），
   原 `worker.crashed` 路径仅保留给 runner 自身异常；任何结束方式（含 crashed / escalated）
   都追加一条 progress 运行记录（11.7 第二句）。
   **soft 改用 SDK 的 `Query.interrupt()`**（v02-b02 用的是「等下一条消息再 break」，worker 卡死时不起作用）：
   `claude.ts` 的 `stop('soft')` 必须调用注入 `query()` 返回对象上的 `interrupt()`，
   `test/runner-claude.test.ts` 断言该调用发生且 controller 未 abort
3. 场景 G 及其「不响应 soft」变体：`test/scenario-g.test.ts`

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 场景 G 两个变体 | `npm test -- test/scenario-g.test.ts` | exit 0 |
| 阶梯单元测试 | `npm test -- test/ladder.test.ts` | exit 0 |
| v0.1 三场景与场景 D 不受影响 | `npm test -- test/scenario-a.test.ts test/scenario-b.test.ts test/scenario-d.test.ts test/scenario-c.test.ts` | exit 0 |
| soft 走 interrupt() | `grep -qE "interrupt\(\)" src/runner/claude.ts && grep -qE "interrupt" test/runner-claude.test.ts` | exit 0 |
| soft 不再靠 break 等消息 | `! grep -qE "softStopRequested" src/runner/claude.ts` | exit 0 |

额外禁止：
- 改动任何受保护路径；`grace_secs` 不写入 toml，由 R1 事后补
- 阶梯计时用注入的时钟，测试不得真实等待超过 2 秒

## v02-b04 b02/b03 遗留修补

优先级：10　依赖：v02-b03

两次真实运行暴露、验收命令没抓住的三处。规格见 SPEC 11.2、11.3、11.5。

条目：
1. 心跳覆盖整个 run（11.3）：`run.finished` 之后才删除；加 `phase` 与 `worker_pid`；
   孤儿检测同时看两个 pid。`test/heartbeat.test.ts` 补「reviewer 阶段并行启动被拒绝」用例
2. `claude.ts` 的 `stop('soft')` 必调并 `await` `interrupt()`，缺失即抛错（11.2）；
   `run.finished` 与 progress 运行记录带 worker 的 `exit_code` / `stop_reason`（11.7）
3. `LivenessMonitor` 注入 `now()` / `setTimer()`（11.5）；`test/scenario-g.test.ts` 与 `test/ladder.test.ts`
   改用假时钟，删除所有真实耗时断言

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 全量连跑 3 次稳定 | `npm test && npm test && npm test` | exit 0 |
| 场景 G 不再断言真实耗时 | `! grep -qE "toBeLessThan\(2000\)\|Date.now" test/scenario-g.test.ts` | exit 0 |
| interrupt 不再可选 | `! grep -qE "interrupt\?\." src/runner/claude.ts` | exit 0 |
| 心跳并行拒绝覆盖 reviewer 阶段 | `grep -qE "reviewer" test/heartbeat.test.ts` | exit 0 |

额外禁止：
- 改动任何受保护路径
- 实现任何 resume / 中断标记注入（那是 v02-b05）

记录：第 1 次运行 r-20261021-025435 BLOCK（上报：无 report）。worker 推送 3 个提交后 90.5 秒无事件，
被 b03 的卡死检测误判（实为正在写 report），soft 停止后退出。这 3 个提交未经审核已在 origin：
存档于 tag `v02-b04-attempt1`，main 重置到 `35ed1cd` 强推一次，第 2 次运行从头做；
`stall_secs` 上调为 300（SPEC 3.1、11.5）。第 2 次运行的 task 正文可提示 worker 存档 tag 的位置。

记录：v02-b03 第 1 次运行 r-20261020-145024 PASS（`3da03b9`），8/8 验收在 R2 处通过；
R1 复核时 `npm test` 在全新 clone 上 2 个失败（场景 G 真实耗时 2.8~3.1 秒 > 2 秒），单跑 3 次全过，
属时序脆弱。PASS 维持（R2 取证当时属实），缺口全部进本批次。

记录：第 2 次运行 r-20261021-060149 PASS（裁定 `6f3f5f3`），7/7 验收在 R2 处通过，claims 与实测全部一致。
但条目 3 只做了一半：`test/scenario-g.test.ts` 只注入了 `livenessNow`，定时器（fake worker 的 `setInterval`、
监视器检查间隔）仍是真实的；reviewer 的逐条核对表对这一项打了勾。裁定提交的 CI（Run 81）在 `npm test` 失败，
单核加压复现：场景 G「不响应 soft」2/5 失败，`reviewer-isolation` 的 ESLint 用例 3/5 超时。
PASS 维持（规则按当时证据判是对的），缺口进 v02-b04-tests。这是第三次「验收命令过了、条目要求没做到」。

## v02-b04-tests 测试去真实定时器

优先级：11　依赖：v02-b04

v02-b04 第 2 次运行后 main 的 CI 是红的（Run 81），原因是两个随机失败的测试。本批次只修测试，不碰 `src/`。
规格见 SPEC 11.5。

条目：
1. `test/scenario-g.test.ts` 与 `test/ladder.test.ts` 全部改用注入的假时钟：同时注入 `livenessNow` 与 `livenessSetTimer`，
   fake worker 发事件改为由假时钟驱动，文件内不再出现任何真实的 `setInterval` / `setTimeout`（包括用于让出事件循环的 `setTimeout(r, 0)`，
   改用 `await Promise.resolve()` 或 vitest 的假定时器推进）。断言只看事件序列，不看耗时
2. `test/reviewer-isolation.test.ts` 的 ESLint 用例：`ESLint` 实例移到 `beforeAll` 只建一次，并给该用例显式 `timeout`（60 秒）。
   不改测试的断言内容

自检（不是验收，只是提醒）：在 1 核并额外起 3 个占满 CPU 的空转进程的条件下连跑 `npm test` 3 次。做不到这个环境也不影响交付。

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 场景 G 无真实定时器 | `! grep -qE "setInterval\|setTimeout\(" test/scenario-g.test.ts` | exit 0 |
| ladder 无真实定时器 | `! grep -qE "setInterval\|setTimeout\(" test/ladder.test.ts` | exit 0 |
| 场景 G 注入了定时器 | `grep -qE "livenessSetTimer" test/scenario-g.test.ts` | exit 0 |
| ESLint 只建一次 | `grep -qE "beforeAll" test/reviewer-isolation.test.ts` | exit 0 |
| 未改动 src | `test -z "$(git log --format=%H -n 1 --grep='issue v02-b04-tests' -- .collie/batches/v02-b04-tests/task.md)" \|\| git diff --quiet "$(git log --format=%H -n 1 --grep='issue v02-b04-tests' -- .collie/batches/v02-b04-tests/task.md)"..HEAD -- src/` | exit 0 |

额外禁止：
- 改动 `src/` 下任何文件（需要改源码就停下来在 report 里说明，不要动手）
- 改动任何受保护路径
- 为了让测试过而删除或跳过（`skip` / `todo`）任何测试

记录：第 1 次运行 r-20261021-112601 BLOCK，规则 1：reviewer 在 verdict JSON 里把 `ci_conclusion` 写成
`cannot_verify_no_gh_auth`（schema 外的值），并在没查到 CI 的情况下写了 `ci_branch_matched: true`。
这是 reviewer 的输出错误，不是 worker 的问题；规则 1 维持原样（reviewer 产不出合法输出就该上报）。
worker 的 `2661d0e` 只改两个测试文件，R2 验收 8/8 通过、R1 复核 574 全过、CI 绿，予以采纳；
`reviewer-isolation` 的随机超时已修好。场景 G 在单核加压下仍 3 次挂 2 次：测试里已无真实定时器，
剩余不确定性在 `src/ladder.ts` 每次采样都起真实 `git` 子进程取指纹，本批次禁止改 `src/`，修不到。
判 blocked，不重跑；缺口进 v02-b04-fix。

## v02-b04-fix R2 不再崩：interrupt this、异常兜底、内容指纹

优先级：12　依赖：v02-b04

第 1 次运行（r-20261022-025901）R2 自己崩了，见下方记录。本批次只做让 R2 在真实运行里不再崩的三处。
规格见 SPEC 11.2、11.3、11.5、11.6。运行本批次期间 `progress_secs` / `wallclock_secs` 已临时调大（SPEC 3.1），
让空转与墙钟实际不触发；修好后 R1 恢复。

条目：
1. `claude.ts` 的 `interrupt()` 调用保持 `this`（11.2）：两处（惰性包装与 `stop('soft')`）都改为直接在对象上调用并 `await`，
   不再 `void`。`test/runner-claude.test.ts` 加回归测试：替身的 `interrupt` 读 `this` 上的字段、`this` 为 undefined 时抛错，
   测试名含 `binds this`
2. R2 异常兜底（11.3）与阶梯容错（11.6）：`run.ts` 最外层 try / finally，任何异常都先记 `run.finished(result=error)`、
   救援、追加 progress、删心跳，再以退出码 1 退出；注册 `unhandledRejection`；
   阶梯里某级 `stop()` 抛出时记 `worker.signaled` 带 `error` 字段并进入下一级。
   `test/ladder.test.ts` 加「soft 抛错 → 记 error → 升级 hard」用例；`test/run.test.ts`（或现有 run 测试文件）加
   「worker 阶段抛出 → run.finished(error) 存在、心跳已删、进程未直接退出」用例
3. 产出指纹（11.5）：改为 `HEAD` + `git diff HEAD` 哈希 + 未跟踪文件 (路径, 大小, mtime) 哈希，
   并做成可注入（`LivenessConfig.fingerprint?`）。`test/scenario-g.test.ts` 注入假指纹，fake worker 发事件、推进假时钟、
   改变假指纹三者全部由测试代码顺序控制；另加一条单测：同一文件内容改两次，两次指纹不同

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 场景 G 连跑 5 次 | `for i in 1 2 3 4 5; do npx vitest run test/scenario-g.test.ts \|\| exit 1; done` | exit 0 |
| interrupt 不再拆出调用 | `! grep -qE "= *(resolvedIterable\|queryIterable)\??\.interrupt;" src/runner/claude.ts` | exit 0 |
| this 绑定有回归测试 | `grep -qE "binds this" test/runner-claude.test.ts` | exit 0 |
| 未处理拒绝有兜底 | `grep -qE "unhandledRejection" src/run.ts src/cli.ts` | exit 0 |
| 指纹已注入且看内容 | `grep -qE "fingerprint\?:" src/ladder.ts && grep -qE "diff" src/ladder.ts` | exit 0 |
| 场景 G 两个用例都注入了假指纹 | `test "$(grep -cE "livenessFingerprint" test/scenario-g.test.ts)" -ge 2` | exit 0 |
| SDK 概念不泄漏 | `! grep -rlE "@anthropic-ai" src --include='*.ts' \| grep -v '^src/runner/'` | exit 0 |

额外禁止：
- 改动任何受保护路径
- 为了让测试过而删除或跳过任何测试
- 实现限流不等待或 worker_pid（那是 v02-b04-fix2）

记录：第 1 次运行 r-20261022-025901 退出码 1，R2 进程崩溃。worker 在同一组 4 个文件上连续编辑 15 分钟，
指纹（porcelain）不变被判空转；R2 发 soft，`claude.ts` 把 `interrupt` 拆出来调用丢了 `this`，TypeError 以未处理拒绝
形式让 Node 直接退出。没有 run.finished、救援、progress、裁定；心跳文件遗留。worker 未提交的 4 文件改动（+90/−19，
条目 1 做了一部分，条目 2、3 未动）存档于 tag `v02-b04-fix-attempt1`，不采纳；操作员 reset 到 `origin/main` 并删除心跳。
原条目中的限流不等待与 worker_pid 移至 v02-b04-fix2。

记录：第 2 次运行 r-20261022-044520 FIX（裁定 `6d4d0c6`），R2 未崩。条目 1、2 完成；条目 3 做了一半：
指纹改为看内容、接口可注入、单测通过，但场景 G 两个用例没传 `livenessFingerprint`，仍用真实 git。
验收只 grep 了 `src/ladder.ts` 没抓到，由 reviewer 按手册逐条核对拦下——这是改过的手册第一次真正起作用，
也是第一次由 reviewer 自己把结论拉成非 PASS。R1 复核 9/9 验收通过、583 全过。按 FIX 常规重跑第 3 次，
已补一条验收 grep 测试文件；阈值在第 3 次通过前继续保持调大。

记录：第 3 次运行 r-20261022-062718 PASS（裁定 `eb98dd0`），10/10 验收通过，583 全过，单核加压 3 次全过、场景 G 10 次全过。
worker 读了 progress 里上一次 FIX 的理由，只补做了场景 G 注入（1 个提交，只改测试）。
遗留：假指纹函数里用了真实 `setTimeout(0)` 限制检查频率，b04-tests 的结构检查对 main 已不通过，本批次验收没沿用那条，
reviewer 打了勾。PASS 维持；缺口与「结构检查不回归」问题进 fix2。
claims `pushed=false` 而实际已推送，第二次出现（b03 亦然），无害，不开条目。

## v02-b04-fix2 CI 证据与结构回归

优先级：13　依赖：v02-b04-fix

所有者已生成只读 PAT，等本批次落地后才放进环境；本批次让 R2 能用它、worker 看不见它。规格见 SPEC 3.1、3.2、11.5。

条目：
1. `ci.token_file`（3.1）：`ConfigSchema` 的 `[ci]` 加可选 `token_file`（字符串，`~` 展开为 home）；
   `evidence.ts` 构造 `ciQuery` 时读取文件内容（trim）作为 `token`，文件不存在等同未配置；
   runner 拉起子进程时从 env 删除 `GITHUB_TOKEN` 与 `GH_TOKEN`（fake 与 claude 两个 runner 都要，claude 走 SDK 的 `env` 选项）；
   `.gitignore` 与 `src/cli.ts` 的 `GITIGNORE_ENTRIES` 加 `.collie/github-token`。
   测试：config 解析 `token_file`、`~` 展开；evidence 从临时文件读到 token 并传给注入的 fetch（断言 `Authorization` 头）；
   runner 测试断言传给 `query()` 的 `options.env` 不含这两个键
2. 限流不等待（3.1）：无 token 且首次轮询即 `rate_limited` 时立即返回 unknown、记 `ci.wait_timeout`
   （`waited_secs: 0`、`last_state: rate_limited`），不再等 `ci_wait_secs`；有 token 时行为不变。注入 fetch 替身覆盖两种情况，
   无 token 那条用例的测试名须含 `unauthenticated` 与 `rate limit` 与 `immediately` 三个词
3. 结构回归（3.2）：新建 `test/invariants.test.ts`，把已通过批次的 grep 类结构检查改写为测试，至少包括：
   `.collie/heartbeat.json` 被 gitignore（b02）；`test/scenario-g.test.ts` 与 `test/ladder.test.ts` 无 `setInterval` / `setTimeout(`（b04-tests）；
   `src/runner/claude.ts` 无 `softStopRequested`、无拆出调用的 `interrupt`（b03、b04-fix）；`src/` 除 `src/runner/` 外无 `@anthropic-ai`（b02）；
   `src/ladder.ts` 有 `fingerprint?:`（b04-fix）。
   同时把场景 G 假指纹的 `setTimeout(0)` 去掉：改为同步返回或 `await Promise.resolve()`，检查频率由注入的 `livenessSetTimer` 控制，
   让 b04-tests 那条不变量对 main 重新成立

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 不变量文件存在且含 5 类检查 | `test "$(grep -cE "^\s*it\(" test/invariants.test.ts)" -ge 6` | exit 0 |
| 场景 G 无真实定时器（恢复 b04-tests） | `! grep -qE "setInterval\|setTimeout\(" test/scenario-g.test.ts` | exit 0 |
| token_file 进 schema 与 evidence | `grep -qE "token_file" src/schema/index.ts && grep -qE "token_file" src/evidence.ts` | exit 0 |
| 子进程 env 去密钥有测试 | `grep -qE "GITHUB_TOKEN" test/runner-claude.test.ts && grep -qE "GH_TOKEN" src/runner/claude.ts` | exit 0 |
| token 文件被忽略 | `grep -qE "github-token" .gitignore && grep -qE "github-token" src/cli.ts` | exit 0 |
| 限流不等待有测试 | `grep -qE "unauthenticated.*rate.?limit.*(no wait\|without waiting\|immediately)" test/ci.test.ts` | exit 0 |
| SDK 概念不泄漏 | `! grep -rlE "@anthropic-ai" src --include='*.ts' \| grep -v '^src/runner/'` | exit 0 |

额外禁止：
- 改动任何受保护路径（`.gitignore` 不在清单内，本批次允许改）
- 把任何 token 值写进代码、测试或 fixture；测试里用 `fake-token` 字样
- 为了让测试过而删除或跳过任何测试

记录：第 1 次运行 r-20261022-082259 PASS（裁定 `b3f828e`），10/10 验收通过，601 全过，历史中无 token 字样。
`invariants.test.ts` 8 条。R1 随后把 `token_file` 写进 toml（SPEC 3.1 约定由 R1 事后补）。
遗留：`token_file` 相对路径按进程 cwd 解析，规格定为相对仓库根，fix3 条目 3 对齐。

## v02-b04-fix3 worker_pid、包装层 interrupt、原子心跳

优先级：14　依赖：v02-b04-fix2

规格见 SPEC 11.2、11.3。

条目：
1. `ClaudeRunner` 提供 `worker_pid`（11.2）：通过 SDK 的 `spawnClaudeCodeProcess` 钩子用 `node:child_process.spawn`
   自行拉起并记下 `pid`，`RunHandle.pid` 返回它；`kill` 级对该 pid 发 `SIGKILL`。
   `test/runner-claude.test.ts` 断言注入 `query()` 收到的选项含该钩子，且钩子返回对象的 `pid` 流到 `RunHandle`。
   fix2 的 env 去密钥在这条路径上同样生效（spawn 时的 env 也要删）
2. `claude.ts` 惰性包装层的 `interrupt()`：SDK 对象已就绪但没有 `interrupt` 时必须抛错，不得静默返回；
   SDK 尚未就绪时的调用仍可忽略但要记一条 stderr 日志。`test/runner-claude.test.ts` 加「就绪但无 interrupt → 抛错」用例
3. `heartbeat.ts` 三处 `writeFileSync` 改为写临时文件再 `renameSync`（原子）；
   `test/heartbeat.test.ts` 加「文件为空 / 半截 JSON」两个用例，断言按 SPEC 11.3 处理且不抛出。
   顺带：`evidence.ts` 的 `token_file` 相对路径改为相对仓库根（SPEC 3.1），加一条测试。
   以上三条的结构检查同步加进 `test/invariants.test.ts`

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 心跳原子写 | `grep -qE "renameSync" src/heartbeat.ts && ! grep -qE "writeFileSync\(path," src/heartbeat.ts` | exit 0 |
| 包装层 interrupt 缺失抛错有测试 | `grep -ciE "no interrupt\|without interrupt\|missing interrupt" test/runner-claude.test.ts \| grep -qvE "^0$"` | exit 0 |
| pid 经钩子流到 RunHandle | `grep -qE "spawnClaudeCodeProcess" src/runner/claude.ts && grep -qE "spawnClaudeCodeProcess" test/runner-claude.test.ts` | exit 0 |
| 不变量已扩充 | `grep -qE "renameSync\|spawnClaudeCodeProcess" test/invariants.test.ts` | exit 0 |
| SDK 概念不泄漏 | `! grep -rlE "@anthropic-ai\|spawnClaudeCodeProcess" src --include='*.ts' \| grep -v '^src/runner/'` | exit 0 |

额外禁止：
- 改动任何受保护路径
- 为了让测试过而删除或跳过任何测试
- 条目 1 不得改变 soft / hard 的现有实现（`interrupt()` / abort）

记录：第 1 次运行 r-20261022-102856 PASS（裁定 `f821742`），8/8 验收通过，610 全过。
fix2 的两项第一次真实生效：R2 用 token 取到 head_sha 自己的 CI（success、监听分支一致），未等待；
子进程环境无密钥（/proc 实读）、stream.ndjson 无 token 字样。阈值恢复 900 / 2700。
遗留：CI 取证成功时 journal 无事件（只有超时才写），进 b05 条目 2。

## v02-b04-fix4 spawn 钩子按 SDK 签名、类型来自 SDK、collie smoke

优先级：15　依赖：v02-b04-fix3

v02-b05 第 1 次运行 worker 0.16 秒崩溃：fix3 的 `spawnClaudeCodeProcess` 按 Node `spawn` 写成三参数，SDK 实际只传一个
`SpawnOptions` 对象。R2 自身用这段代码，无法正常签发批次；本批次由操作员按 SPEC 11.3「R2 自救」从 `b6a141a`（fix2 代码，
fix3 那轮实跑验证过）的 worktree 运行 R2。规格见 SPEC 11.2、11.3。

条目：
1. `claude.ts` 钩子改为 `(options) => spawn(options.command, options.args, { cwd: options.cwd, env: 去密钥后的 options.env, signal: options.signal })`，
   返回值满足 SDK 的 `SpawnedProcess`；`test/runner-claude.test.ts` 里所有调用钩子的地方改为传单个对象，
   并加一条断言：钩子收到 `{ command, args, env: { GITHUB_TOKEN: 'fake-token', PATH: '/x' } }` 时，`spawn` 替身收到的 `env` 无 `GITHUB_TOKEN`、有 `PATH`
2. `ClaudeQueryOptions` 及钩子、`SpawnOptions`、`SpawnedProcess` 相关类型全部 `import type` 自 `@anthropic-ai/claude-agent-sdk` 并用
   `Pick` / 索引类型派生，删除手写的 `SpawnHookOptions` / `SpawnHookResult`；`test/invariants.test.ts` 加一条：
   `src/runner/claude.ts` 含 `import type .* from '@anthropic-ai/claude-agent-sdk'`，且不含 `interface SpawnHook`
3. `collie smoke` 子命令：用配置的真实 runner、`maxTurns: 1`、`allowedTools: []`、prompt「Reply with the single word ok.」拉起 worker 角色，
   收到 `RunResult` 即退出码 0 并打印 `exitCode / sessionId / usage`；拉不起来或 runner 抛出则退出码 1 并打印错误。
   不写 journal、不碰 `.collie/batches`。`test/cli.test.ts` 用 fake runner 覆盖成功与失败两条路径；
   `AGENT_KICKOFF.md` 由 R1 事后把「跑批次前先 `collie smoke`」写进操作员流程

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 钩子不再是三参数 | `! grep -qE "spawnClaudeCodeProcess\?: \($" src/runner/claude.ts && ! grep -qE "command: string,$" src/runner/claude.ts` | exit 0 |
| 类型来自 SDK | `grep -qE "import type .* from '@anthropic-ai/claude-agent-sdk'" src/runner/claude.ts && ! grep -qE "interface SpawnHook" src/runner/claude.ts` | exit 0 |
| 不变量已加 | `grep -qE "claude-agent-sdk" test/invariants.test.ts` | exit 0 |
| 测试按单对象调用钩子 | `grep -qE "spawnClaudeCodeProcess\(\{" test/runner-claude.test.ts \|\| grep -qE "spawnClaudeCodeProcess\?\.\(\{" test/runner-claude.test.ts` | exit 0 |
| smoke 子命令存在且有测试 | `grep -qE "'smoke'" src/cli.ts && grep -qE "smoke" test/cli.test.ts` | exit 0 |
| SDK 概念不泄漏 | `! grep -rlE "@anthropic-ai\|spawnClaudeCodeProcess" src --include='*.ts' \| grep -v '^src/runner/'` | exit 0 |

额外禁止：
- 改动任何受保护路径
- 为了让测试过而删除或跳过任何测试
- 改变 soft / hard 的现有实现

记录：第 1 次运行 r-20261022-114309 BLOCK（裁定 `2999228`），规则 1：reviewer 把 `commits_actual` 写成 `git log --oneline` 整行，
不是纯 sha。reviewer 自判 PASS；R2 验收 9/9 通过、CI success；R1 复核 9/9、616 全过。
参照 v02-b04-tests 先例：标 blocked，`8170a3d`、`1bd1ac5` 采纳，不重跑。R2 自救流程（从 `b6a141a` worktree 运行）首次使用，通畅。
遗留：report 写了 7 位 `head_sha`，R2 原样查 Actions API 得 0 条，有 token 也等满 30 分钟才退回后代归属。进 b05 条目 3。

## v02-b05 中断标记与 resume

优先级：16　依赖：v02-b04-fix4

规格见 SPEC 11.7、11.9。

条目：
1. 中断判定与 `task.md` 注入（11.7）：`attempt` 递增、`interrupted_at`、`rescue_sha`、正文「上一轮中断」一节；
   `TaskFrontmatterSchema` 加可选 `rescue_sha`，不升版本。
   同一批次后续 attempt 沿用第 1 次的 `base_sha`（4.3「上报」段）；
   上报路径用 git 实测 `base_sha..HEAD` 与推送状态写入 progress，措辞「上报：无 report」，不再出现「规则 0」
2. resume 策略（11.7）：按 `resume_max` 决定是否传 `resumeSessionId`；新增事件 `worker.resumed`；
   仲裁 PASS 的运行不算中断、`attempt` 不递增（11.7 第一段）；
   `claude.ts` 的 `turns_exhausted` 映射已在 b03 提前落地，本批次只需测试覆盖。
   顺带两处 R2 取证侧（3.5、3.6）：CI 取证成功时记 `ci.resolved` 事件，`collie show` 能据此还原 R2 等了多久；
   取证前用 `git rev-parse` 把 report 的 `head_sha` 与 `commits[]` 展开为 40 位再查 CI、再校验，
   等待逻辑连续 3 次 `no_runs` 即转后代归属。`test/ci.test.ts` 覆盖「短 sha 展开」与「3 次 no_runs 转后代」
3. 场景 E 后半段（attempt / interrupted_at / rescue_sha）与场景 F：
   `test/scenario-e.test.ts` 补全，`test/scenario-f.test.ts` 新增；
   `collie show` 按顺序还原 E / F / G 的事件链

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 场景 E 完整 | `npm test -- test/scenario-e.test.ts` | exit 0 |
| 场景 F | `npm test -- test/scenario-f.test.ts` | exit 0 |
| show 还原事件链 | `npm test -- test/show.test.ts` | exit 0 |
| ci.resolved 进 schema 与 R2 | `grep -qE "ci\.resolved" src/schema/index.ts && grep -qE "ci\.resolved" src/run.ts && grep -qE "ci\.resolved" test/invariants.test.ts` | exit 0 |
| 场景 F 覆盖 resume 上限 | `grep -qE "resume_max" test/scenario-f.test.ts` | exit 0 |
| 后续 attempt 沿用首次 base_sha 有测试 | `grep -qE "base_sha" test/scenario-e.test.ts` | exit 0 |
| 短 sha 展开与 no_runs 转后代有测试 | `grep -qE "rev-parse\|revParse" src/evidence.ts && grep -qE "no_runs" test/ci.test.ts && grep -qiE "short sha\|expands" test/ci.test.ts test/evidence.test.ts` | exit 0 |

额外禁止：
- 改动任何受保护路径
- resume 的 session 内容进入 journal（只记 session_id）
- 为了让测试过而删除或跳过任何测试

记录：第 1 次运行 r-20261022-111044 BLOCK（上报：无 report，裁定 `fbc7410`）。worker 启动 163 毫秒崩溃，
fix3 的 spawn 钩子签名与 SDK 不符（三参数 vs 单对象），claude 子进程没起来。R2 自身（fix3 代码）用 b04-fix 的兜底正常收尾，
run.finished / progress / 心跳删除都执行了，无残留现场。修复批次 v02-b04-fix4 插在前面，本批次依赖改为它。
这是第三次「手写 SDK 类型与真实 SDK 不一致、typecheck 与替身测试都过、真实运行才炸」，规则进 SPEC 11.2。
第 2 次运行 r-20261022-161827 PASS（裁定 `3b56179`），10/10 验收通过，635 全过，R1 复核一致。
但 worker 全程没有 `git push`（claims 如实 `pushed=false`，`remote_has_head=false`，CI 未取证），规则链无一命中，
reviewer 原判 PASS 被采用。代码本身正确，PASS 维持；规格缺口（PASS 不要求已推送、不要求 CI success）由 v02-b05-fix 规则 9 补。
smoke 首次真实运行通过（fix4 钩子能拉起子进程）。worker_pid 仍未进心跳：`onStarted` 先于 spawn 钩子触发。
本批次新功能（中断标记、resume、ci.resolved、短 sha 展开、no_runs 转后代）要下一轮 R2 才真实生效。


## v02-b05-fix 规则 9、worker_pid 时序、CI 未取证措辞

优先级：17　依赖：v02-b05

规格见 SPEC 4.3（规则 9 与来源）、11.3、3.5。

条目：
1. arbiter 规则 9：`remote_has_head=false` 或 `ci_conclusion≠success` 或 `ci_branch_matched≠true` 时，PASS 降为 FIX，
   记 `verdict.downgraded`（字段 rule=9 / reason）；原「采用 verdict 原值」改为规则 10。`src/arbiter.ts` 的常量、
   progress 与 `collie show` 的规则编号文字同步；`test/arbiter.test.ts` 加三个用例（未推送 / unknown / branch 不一致），
   并断言 FIX 原判不被改动、BLOCK 不被改动
2. worker_pid 时序：runner 选项加 `onPid?: (pid: number) => void`，spawn 钩子拿到 `child.pid` 时立刻回调；
   R2 在回调里 `updateHeartbeat({ worker_pid })`，不再依赖 `onStarted` 时读 `handle.pid`。
   `test/runner-claude.test.ts` 的真实顺序用例：`onStarted` 先触发、钩子后触发，断言心跳最终含 `worker_pid`
3. CI 未取证措辞：`evidence.ts` 在 `remote_has_head=false` 或根本没查 CI 时 `ci_branch_matched` 为 `null`、`ci_run_url` 为空；
   `progress.ts` 对 `null` 渲染「未能取证」，`false` 才渲染「监听分支不一致」。`test/evidence.test.ts` 加「未推送 → branch_matched 为 null」

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 规则 9 进 arbiter 与测试 | `grep -qE "RULE_DEFAULT = 10" src/arbiter.ts && grep -qE "remote_has_head: false" test/arbiter.test.ts` | exit 0 |
| onPid 接口存在且 R2 使用 | `grep -qE "onPid" src/runner/index.ts && grep -qE "onPid" src/runner/claude.ts && grep -qE "onPid" src/run.ts` | exit 0 |
| 真实顺序有测试 | `grep -qE "onPid" test/runner-claude.test.ts` | exit 0 |
| 未推送时 branch_matched 为 null 有测试 | `grep -qE "remote_has_head" test/evidence.test.ts && grep -qE "toBeNull" test/evidence.test.ts` | exit 0 |
| 不变量同步 | `grep -qE "RULE_DEFAULT" test/invariants.test.ts` | exit 0 |

额外禁止：
- 改动任何受保护路径
- 为了让测试过而删除或跳过任何测试
- 放宽规则 1~8 的任何一条

记录：第 1 次运行 r-20261023-060802 PASS（裁定 `371815f`），8/8 验收通过，647 全过，R1 复核一致。
b05 代码首次真实生效：`attempt` 从 1 起算正确；`ci.resolved` 首次出现且字段齐全（waited 1 秒、1 次轮询）；worker 推送了。
裁定提交自己的 CI（Run 113）红：场景 C 两个用例清理沙箱时 ENOTEMPTY（`.git/objects/pack` 还有 git 子进程在写），
代码提交的 Run 111 / 112 绿，本地与加压均复现不出。PASS 维持；沙箱清理并入 v02-e-drill 条目 3。
短 sha 展开路径仍未被真实触发（worker 写了 40 位）。

## v02-e-drill stream.ndjson 密钥屏蔽（场景 E 真实 kill 演练）

优先级：18　依赖：v02-b05-fix

规格见 SPEC 第 10 章 Q5、11.2。这是 v0.2 的收口演练：批次本身是小而真实的工作，**操作员会在 worker 阶段对 R2 发 SIGKILL**，
验证场景 E 在真实运行里成立（孤儿检测、救援提交、attempt 递增、`task.md` 的「上一轮中断」一节、resume）。
worker 不知道也不需要知道这件事；中断后第 2 次 attempt 的 worker 照手册 4.4 续做。

条目：
1. `src/runner/claude.ts` 落盘 `stream.ndjson` 前，把屏蔽集合中的每个值（非空且长度 ≥ 8）替换为 `***`；
   屏蔽集合由 R2 用 `token_file` 文件内容与 `GITHUB_TOKEN` / `GH_TOKEN` 环境变量的值构造，
   以 runner 选项 `redact: readonly string[]` 传入，runner 不读配置也不读环境变量
2. `test/runner-claude.test.ts`：注入 fake query 产出含密钥字样的事件，断言落盘文件无原文、有 `***`；`redact` 为空时原样落盘
3. `test/invariants.test.ts` 加一条：`src/runner/claude.ts` 含 `redact`，且 `src/run.ts`、`src/evidence.ts` 之外无任何文件读取 `token_file`。
   顺带修场景 C 的随机 ENOTEMPTY（v02-b05-fix 裁定提交 Run 113）：`test/support/sandbox.ts` 的全局 gitconfig 加
   `[gc]\n\tauto = 0`，`dispose()` 的 `rmSync` 加 `maxRetries: 5, retryDelay: 100`；不改任何场景测试的断言

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| redact 选项存在 | `grep -qE "redact" src/runner/index.ts && grep -qE "redact" src/runner/claude.ts && grep -qE "redact" src/run.ts` | exit 0 |
| 屏蔽有测试 | `grep -qE "redact" test/runner-claude.test.ts && grep -qE "\*\*\*" test/runner-claude.test.ts` | exit 0 |
| 不变量同步 | `grep -qE "redact" test/invariants.test.ts` | exit 0 |
| 沙箱清理不再裸删 | `grep -qE "maxRetries" test/support/sandbox.ts && grep -qE "auto = 0" test/support/sandbox.ts` | exit 0 |

额外禁止：
- 改动任何受保护路径
- 为了让测试过而删除或跳过任何测试
- runner 读取配置文件或环境变量来决定屏蔽什么（屏蔽集合只能来自 `redact` 选项）

记录：两次运行。第 1 次 r-20261023-082524 在 worker 阶段被操作员 `kill -9`（授权演练）；第 2 次 r-20261023-083500 PASS（裁定 `50a2c55`），
7/7 验收通过，654 全过，整批 `83faebb..6317361` 受保护路径零改动，R1 复核一致。短 sha 展开首次真实生效（1 秒 1 次查中）。
演练成立：`worker_pid` 进心跳（onPid）、`run.orphaned`、`attempt: 2`、「上一轮中断」一节、frontmatter 沿用首次 `base_sha`、下一轮接续完成。
演练不成立 / 未验证：R2 死后 worker 独活 78 秒并提交了 `9acc692`（操作员补杀）；救援提交未触发；`interrupted_at` 写成 `unknown worker.started`；
R2 取证与 reviewer 范围从 attempt 2 的 task 提交算起，attempt 1 的两个提交漏审（R1 事后补查无害）。
PASS 维持（三条目完成，缺口与条目无关）；v0.2 收口条件见 SPEC 第 11 章开头，缺口进 v02-e-fix，修完 v02-e-drill2 再演练。

## v02-e-fix worker 随 R2 死、取证沿用首次 base_sha、interrupted_at

优先级：19　依赖：v02-e-drill

v02-e-drill 演练暴露的三处，见 SPEC 第 11 章开头「v0.2 收口条件」第 1、3、4 条。规格见 SPEC 11.3、11.7。

条目：
1. worker 随 R2 死（11.3）：runner spawn 时 `detached: true`；R2 注册 `exit` / `SIGTERM` / `SIGINT` 对 `-worker_pid` 发 `SIGTERM`；
   R2 另起守护进程（`node -e`，脱离 R2 进程组）持有 R2 pid 与 worker_pid，每 2 秒探测，R2 消失即 `SIGKILL` worker_pid 后自退；
   `guard_pid` 写进心跳，孤儿检测三个 pid 任一存活即拒绝启动；reviewer 阶段开始时清掉心跳的 `worker_pid`。
   测试：fake 子进程（`node -e 'setInterval(()=>{},1000)'`）+ 真实守护进程，`SIGKILL` 父进程替身后断言子进程 5 秒内消失；
   `test/heartbeat.test.ts` 加 `guard_pid` 存活拒绝启动用例
2. 取证范围（11.7）：`run.ts` 的 evidence 与 reviewer 输入用 frontmatter 沿用的首次 `base_sha`，不再用 `taskSha`；
   `test/scenario-e.test.ts` 加断言：attempt 2 的 `commits_actual` 含 attempt 1 的提交，且 attempt 1 偷改 SPEC 时 attempt 2 被规则 2 BLOCK
3. `interrupted_at`（11.7）：结束原因按 `worker_stop_reason → result → orphaned → unknown` 取；journal 无 `run.finished` 时最后事件取
   `stream.ndjson` 末行；「上一轮中断」一节无 `rescue_sha` 时也要写「上一轮未留下救援提交，请从 `git log` 核实已完成到哪一步」。
   `test/scenario-e.test.ts` 断言 `interrupted_at` 含 `orphaned` 且事件类型不是 `worker.started`

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 场景 E 完整 | `npm test -- test/scenario-e.test.ts` | exit 0 |
| 子进程随父死有测试 | `grep -qE "detached: true" src/runner/claude.ts && grep -qE "guard_pid" src/heartbeat.ts && grep -qiE "parent.*(killed\|dies\|SIGKILL)" test/runner-claude.test.ts test/guard.test.ts` | exit 0 |
| 取证不再用 taskSha 做 base | `! grep -qE "baseSha: taskSha" src/run.ts && grep -qE "commits_actual" test/scenario-e.test.ts` | exit 0 |
| interrupted_at 取 orphaned | `grep -qE "orphaned" test/scenario-e.test.ts && grep -qE "stream\.ndjson\|appendStream\|readStream" src/run.ts` | exit 0 |
| 不变量同步 | `grep -qE "detached: true\|baseSha: taskSha" test/invariants.test.ts` | exit 0 |

额外禁止：
- 改动任何受保护路径
- 为了让测试过而删除或跳过任何测试
- 守护进程读取配置或仓库；它只认两个 pid

记录：第 1 次运行 r-20261025-083535 PASS（裁定 `2d09cc4`），8/8 验收通过，670 全过，R1 复核一致、`guard.test.ts` 连跑 3 次稳定。
守护进程为独立 `node -e`（detached、unref），只认两个 pid；取证 base 已改为沿用的首次 `base_sha`；`interrupted_at` 能取 `orphaned` 并回退到 `stream.ndjson`。
操作员在 vitest 外做了一次真实进程实验：SIGKILL 替身 R2 后 2.5 秒 worker 与守护进程都消失。
reviewer 对条目 1 的行为要求只给了代码位置没实跑，手册已补「行为要求必须实跑」。worker 用了 193 轮（上限 200）。
规则 9 至今未在真实运行里触发（每轮 worker 都推送且 CI 绿）。本批次代码下一轮（v02-e-drill2）才在 R2 上生效。

## v02-e-drill2 场景 E 第 2 次演练（脏工作区 + 不补杀）

优先级：20　依赖：v02-e-fix

v0.2 收口演练第 2 次。批次工作本身很小；操作员按 AGENT_KICKOFF.md「场景 E 真实演练（第 2 次）」操作：
在 worker 写了文件但尚未提交时 `kill -9` R2，**不补杀 worker**，观察守护进程是否在 5 秒内杀掉它；
然后立即启动下一轮，期望先被拒绝（若 worker 或守护进程仍存活）、确认都退出后再启动，期望 `worker.rescued` + `rescue_sha`。

条目：
1. `collie show <batch>`（`src/cli.ts`）输出末尾加一段「中断链」：按 attempt 列出 `run.orphaned` / `worker.rescued` / `worker.resumed` 与 `rescue_sha`，
   无中断时省略
2. `test/show.test.ts` 覆盖有中断链与无中断链两种输出
3. `README.md` 加一节「中断与恢复」，三句话说明 kill 后会发生什么、下一轮怎么接、人该看哪里

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| show 有中断链 | `grep -qE "中断链" src/cli.ts && grep -qE "中断链" test/show.test.ts` | exit 0 |
| README 有章节 | `grep -qE "^## .*中断与恢复" README.md` | exit 0 |

额外禁止：
- 改动任何受保护路径
- 为了让测试过而删除或跳过任何测试

记录：两次运行。第 1 次 r-20261026-025529 在工作区脏、尚无提交时被操作员 `kill -9` R2（授权演练，不补杀）：
守护进程 1 秒内杀掉 worker 并自退。第 2 次 r-20261026-025925 PASS（裁定 `f40284c`）：`run.orphaned` → `worker.rescued`（`6158611`）
→ `attempt: 2` → 接续完成三条目，5/5 验收通过，672 全过，取证范围 `7f93939..b076c7b` 含救援提交，R1 复核一致。
不成立：`task.md` 无 `rescue_sha`，正文写成「上一轮未留下救援提交」（孤儿救援记在本轮 journal，生成 task 只查上一轮）；
`interrupted_at` 最后事件为 `user@`、时间空。未验证：守护进程存活时拒绝启动（守护太快）。
PASS 维持；缺口进 v02-e-fix2，e-fix2 PASS 即 v0.2 收口，不做第 3 次演练。attempt 2 用 47 轮，`max_turns` 200 不变。

## v02-e-fix2 rescue_sha 跨轮查找、interrupted_at 时间

优先级：21　依赖：v02-e-drill2

v0.2 的最后一批。规格见 SPEC 11.7（`rescue_sha` 来源、`interrupted_at` 事件与时间）。

条目：
1. `run.ts` 生成 task 时，`worker.rescued` 同时在上一轮 journal 与本轮 journal（`run.orphaned` 之后）查找，取最后一条；
   有 `rescue_sha` 时 frontmatter 写入且正文含「请先核实」句，没有时正文含「上一轮未留下救援提交」句
2. `readStreamLastEvent`：事件类型按 SPEC 11.7 细化（`type/subtype` 或 `tool_use` 的 `name`），时间取消息 `timestamp`，
   缺失则向前找最近一条有 `timestamp` 的行，再缺失用心跳 `updated_at`；返回的时间不得为空串
3. `test/scenario-e.test.ts` 用 fake runner 覆盖孤儿救援路径：第 1 轮写脏文件后模拟 R2 被 kill（心跳遗留、无 `run.finished`、
   `stream.ndjson` 末行是无 `timestamp` 的 `user` 消息），第 2 轮启动后断言 `task.md` 的 `rescue_sha` 等于 `worker.rescued.sha`、
   正文含「请先核实」、`interrupted_at` 含 `orphaned` 且时间非空且事件类型不是裸的 `user`

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 场景 E 完整 | `npm test -- test/scenario-e.test.ts` | exit 0 |
| 孤儿路径 rescue_sha 有断言 | `grep -qE "rescue_sha" test/scenario-e.test.ts && grep -qE "请先核实" test/scenario-e.test.ts` | exit 0 |
| interrupted_at 时间非空有断言 | `grep -qE "interrupted_at" test/scenario-e.test.ts && grep -qE "toBeTruthy\|toHaveLength\|toMatch" test/scenario-e.test.ts && grep -qE "tool_use" src/run.ts` | exit 0 |
| 不变量同步 | `grep -qE "请先核实\|rescue_sha" test/invariants.test.ts` | exit 0 |

额外禁止：
- 改动任何受保护路径
- 为了让测试过而删除或跳过任何测试
- 改动守护进程、取证范围、规则链的任何实现

记录：第 1 次运行 r-20261026-035021 PASS（裁定 `cfee4dc`），7/7 验收通过，677 全过，场景 E 15 个，R1 复核一致。
reviewer 阶段心跳 `worker_pid` 已清（142 次采样无数字 pid），`guard_pid` 保留到 ci 阶段结束。
reviewer 按新手册对行为要求贴了实跑输出，但其事件流不落盘，操作员无法独立确认（进 v03-b01）。**v0.2 收口。**

## v03-b01 收回人工动作：R2 推送裁定提交、启动核查其 CI、reviewer 流落盘、场景 H

优先级：22　依赖：v02-e-fix2

v0.3 第一批。规格见 SPEC 12.1、3.6（三个新事件）。

条目：
1. R2 推送裁定提交与启动核查（12.1）：`git.ts` 加 `push(cwd, remote, branch)`；`run.ts` 在 progress 提交之后推送，记 `verdict.pushed`，
   失败记 `verdict.push_failed` 且不改变结论、不抛出；启动阶段若本地领先远端先推送一次；启动阶段取最近一条 `verdict.pushed.sha`
   用 `queryCi` 查一次（不等待），`failure` / `cancelled` 打印 `warning: previous verdict commit ...` 并记 `ci.verdict_commit`，
   `success` 只记事件，其余不记。`schema` 加三个事件。测试：fake 场景里断言推送后远端含裁定提交；注入 fetch 替身返回 failure 时 stderr 有 warning
2. reviewer 事件流落盘（12.1）：`reviewer.stream.ndjson`，复用 worker 的写入与 `redact`；`test/reviewer-isolation.test.ts` 或新测试断言文件存在、
   含 reviewer 的事件、密钥已屏蔽
3. 场景 H（12.1）：`test/scenario-h.test.ts`，fake worker `pushed=false` 且远端无 head、reviewer PASS → arbiter FIX、`verdict.downgraded` rule=9；
   `test/invariants.test.ts` 加「`src/git.ts` 有 `push`」「`scenario-h.test.ts` 存在」两条

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 场景 H | `npm test -- test/scenario-h.test.ts` | exit 0 |
| 三个事件进 schema | `grep -qE "verdict\.pushed" src/schema/index.ts && grep -qE "verdict\.push_failed" src/schema/index.ts && grep -qE "ci\.verdict_commit" src/schema/index.ts` | exit 0 |
| R2 推送且失败不抛 | `grep -qE "export async function push\(" src/git.ts && grep -qE "verdict\.push_failed" src/run.ts` | exit 0 |
| 启动核查有警告 | `grep -qE "previous verdict commit" src/run.ts && grep -qE "previous verdict commit" test/*.test.ts` | exit 0 |
| reviewer 流落盘 | `grep -qE "reviewer\.stream\.ndjson" src/run.ts && grep -qE "reviewer\.stream\.ndjson" test/*.test.ts` | exit 0 |
| 不变量同步 | `grep -qE "scenario-h" test/invariants.test.ts` | exit 0 |

额外禁止：
- 改动任何受保护路径
- 为了让测试过而删除或跳过任何测试
- 推送失败时重试、抛出或改变本轮退出码
- 改动规则 1~10 的实现（场景 H 只是测试）

记录：第 1 次运行 r-20261026-045805 PASS（裁定 `79b40de`，操作员代推最后一次），9/9 验收通过，695 全过（R1 复核 3 次 1 次 `scenario-f` 10 秒超时）。
push 只用 `.git/config` 现成 remote，凭据与全局配置哈希不变；场景 H 用真实 bare 远端且 fake worker 不 push，`verdict.downgraded` rule=9 成立。
**越界**：`run.ts:721-727` 启动时无条件 `push`，且位于孤儿救援之后——下一次真实救援会把 `wip(collie)` 提交推上 main，违反 11.4。
规格 12.1 原文「若本地领先远端先推送」写得不严，R1 已收紧；reviewer 未拦。PASS 维持，`v03-b01-fix` 在任何下一轮之前先跑。

## v03-b01-fix 启动补推只认失败的裁定提交，且先于救援

优先级：23　依赖：v03-b01

规格见 SPEC 12.1（补推的唯一条件）、11.4、3.6（`verdict.push_skipped`）。**在跑任何其他批次之前先跑它**：
现在的代码在下一次孤儿救援时会把未审核的 wip 提交推上 main。

条目：
1. `run.ts` 启动阶段：补推移到孤儿检测与救援**之前**；只有 journal 最近一条 `verdict.push_failed.sha` 等于 `HEAD` 且远端不含它时才 `push`
   并记 `verdict.pushed`；条件不满足记 `verdict.push_skipped`（字段 head / reason，reason 取 `no_failed_push` / `head_is_not_verdict` / `already_on_remote`）；
   没有 `push_failed` 事件时不调用 `push`、不记事件。`schema` 加 `verdict.push_skipped`
2. 场景测试（加进 `test/scenario-e.test.ts` 或新建 `test/scenario-i.test.ts`）：
   a. 第 1 轮 worker 写脏文件后模拟 R2 被 kill；第 2 轮启动后断言远端**不含** `worker.rescued.sha`，journal 无 `verdict.pushed`；
   b. 第 1 轮以注入的 push 替身让裁定推送失败（`verdict.push_failed`）；第 2 轮启动后断言远端含该裁定 sha、journal 有 `verdict.pushed`；
   c. 在 b 的基础上，第 2 轮启动前在 HEAD 上再加一个提交，断言不推送、记 `verdict.push_skipped` reason=`head_is_not_verdict`
3. `test/invariants.test.ts` 加一条：`src/run.ts` 里 `push(` 的调用处每一处前 5 行内都有 `push_failed` 或 `verdict`
   字样（粗略保证没有裸的启动 push）；顺带把 `scenario-f` 的 vitest 超时从默认 10 秒提到 30 秒（只改该文件的 `describe` 选项，不改断言）

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 场景 F 连跑 3 次 | `for i in 1 2 3; do npx vitest run test/scenario-f.test.ts \|\| exit 1; done` | exit 0 |
| 补推有条件 | `grep -qE "push_skipped" src/run.ts && grep -qE "push_skipped" src/schema/index.ts && grep -cE "await push\(" src/run.ts \| grep -qE "^[1-3]$"` | exit 0 |
| 救援提交不被推送有测试 | `grep -qE "worker\.rescued" test/scenario-*.test.ts && grep -qE "push_skipped" test/scenario-*.test.ts` | exit 0 |
| 不变量同步 | `grep -qE "push_skipped\|await push" test/invariants.test.ts` | exit 0 |

额外禁止：
- 改动任何受保护路径
- 为了让测试过而删除或跳过任何测试
- 改动裁定提交在运行末尾的正常推送路径（12.1 第一条）

记录：第 1 次运行 r-20261026-082249 PASS（裁定 `cb12647`，**R2 第一次自己推送**，`verdict.pushed` 在 journal），7/7 验收通过，702 全过，R1 复核一致。
场景 I 用真实 bare 远端与 pre-receive hook 覆盖三条路径。reviewer 事件流首次落盘（1219 行，无密钥），首次能独立核实 reviewer 真跑了测试。
**落盘才看见的旧问题**：初始化消息列出 27 个工具，与 worker 相同——runner 只传了 `allowedTools`（免询问）没传 `tools`（可用集合），
reviewer 的 Write / Edit 自 v01-b05 起一直可用，只是没用过；它还执行过 `gh api` 与 `git ls-remote`。进 v03-b02，在其他批次之前跑。

## v03-b02 工具白名单真正生效：tools 选项、reviewer Bash 黑名单

优先级：24　依赖：v03-b01-fix

铁律 6「reviewer 物理上无法改代码」到今天为止从未真正成立。规格见 SPEC 3.1（`bash_deny`）、11.2（三选项同传、PreToolUse 黑名单）、3.6（`tool.denied`）。
原 12.2「队列与分流」顺延为 v03-b03，12.3 顺延为 v03-b04。

条目：
1. `claude.ts`：`tools: [...allowed_tools]` 与 `allowedTools` 同传；reviewer 角色另传 `disallowedTools: ['Write','Edit','MultiEdit','NotebookEdit']`；
   类型按 11.2 来自 SDK 的 `Options`。`test/runner-claude.test.ts` 断言注入的 `query()` 收到的 `options.tools` 等于白名单、
   reviewer 的 `options.disallowedTools` 含 `Write` 与 `Edit`，worker 的不含 `disallowedTools`
2. reviewer Bash 黑名单：`ConfigSchema` 的 `[agent.reviewer]` 加可选 `bash_deny: string[]`（正则，解析时 `new RegExp` 校验）；
   runner 为 reviewer 注册 `hooks.PreToolUse`（matcher `Bash`），命令匹配任一正则即返回 `permissionDecision: 'deny'` 并在
   `reviewer.stream.ndjson` 追加 `tool.denied`（role / tool / command / pattern）；`bash_deny` 缺省为空数组、不注册钩子。
   测试：注入 fake `query()` 捕获 `options.hooks.PreToolUse`，手动调用钩子，`git push origin main` 被拒、`npm test` 放行、
   `git  push` （多空格）被拒；schema 测试覆盖非法正则报错
3. `test/invariants.test.ts` 加两条：`src/runner/claude.ts` 同时含 `tools:` 与 `allowedTools:`；`src/runner/claude.ts` 含 `disallowedTools`。
   另加一个只读的运行后检查工具 `collie audit <run_id>`（`src/cli.ts`）：读 `reviewer.stream.ndjson` 的初始化消息，工具清单不等于
   reviewer 白名单则退出码 1 并打印差集；没有事件流或没有初始化消息退出码 2。`test/cli.test.ts` 覆盖三种退出码

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| tools 与 allowedTools 同传 | `grep -qE "^\s+tools: \[" src/runner/claude.ts && grep -qE "disallowedTools" src/runner/claude.ts` | exit 0 |
| 白名单有测试 | `grep -qE "options\.tools\|\.tools\)" test/runner-claude.test.ts && grep -qE "disallowedTools" test/runner-claude.test.ts` | exit 0 |
| bash_deny 进 schema 且有钩子 | `grep -qE "bash_deny" src/schema/index.ts && grep -qE "PreToolUse" src/runner/claude.ts && grep -qE "tool\.denied" src/runner/claude.ts` | exit 0 |
| 钩子有测试 | `grep -qE "PreToolUse" test/runner-claude.test.ts && grep -qE "git push" test/runner-claude.test.ts` | exit 0 |
| audit 子命令 | `grep -qE "'audit'" src/cli.ts && grep -qE "audit" test/cli.test.ts` | exit 0 |
| 不变量同步 | `grep -qE "disallowedTools" test/invariants.test.ts` | exit 0 |
| SDK 概念不泄漏 | `! grep -rlE "@anthropic-ai\|PreToolUse" src --include='*.ts' \| grep -v '^src/runner/'` | exit 0 |

额外禁止：
- 改动任何受保护路径（`bash_deny` 的 toml 配置由 R1 在 PASS 后补写）
- 为了让测试过而删除或跳过任何测试
- 给 worker 加 `disallowedTools` 或 Bash 黑名单
- 改动 `permission_mode` 的处理

记录：第 1 次运行 r-20261026-091509 PASS（裁定 `a5efa19`，R2 自推），10/10 验收通过，724 全过，R1 复核一致。
`collie audit` 对本轮与上一轮 reviewer 事件流正确报出工具不一致（退出码 1），对无事件流的旧运行退出码 2。
本轮 R2 仍是 b01-fix 代码：reviewer 工具清单 27 个属已知；reviewer Bash 全为只读 git，未用 gh。`ci.verdict_commit` 首次出现（cb12647 success，不警告）。
成本 $45.28（平时 3~4 倍）：cache_creation 630 万 token，1 次 compact_boundary、多次后台任务（TaskCreate/TaskUpdate 本不在白名单，b02 后被挡）。
裁定：`bash_deny` 按 SPEC 3.1 原文补进 toml（三处镜像同步）；`ls-remote` / `fetch` 不禁；`curl` 写操作暂不加；`cost_cap_usd` 等下一轮数据。

## v03-b03 队列消费与分流：--continue、fix_max 返工闸、backlog 状态列

优先级：25　依赖：v03-b02

v0.3 的核心批次。规格见 SPEC 12.2、3.6（`batch.skipped` / `batch.status` / `queue.finished`）、11.7（返工沿用首次 `base_sha`）。
PASS 之后操作员改用 `--continue` 连跑，不再逐批说「跑」。

条目：
1. `collie run --continue [--max N]`（`src/cli.ts` + `src/run.ts`）：选批逻辑（第一个 `pending` 且依赖全 `passed`，依赖未满足记 `batch.skipped`）、
   分流（PASS 取下一个；FIX 计数 ≤ `fix_max` 立即重跑，否则 `escalated` reason=`fix_max` 并停；BLOCK / 上报停、退出码 20）、
   `queue.finished`（reason / batches）。每批次结束仍走 11.3 清理与 12.1 推送；批次之间不共享进程。单批次模式行为不变
2. backlog 状态列写入（`src/backlog.ts` 加 `setBatchStatus(text, id, status)` 纯函数 + R2 落盘）：只改该行最后一列、其余字节不动，
   找不到或格式不符记 `batch.status` to=`unchanged`。状态文件改动并入裁定提交（`progress: ...`）。单批次模式不写
3. 场景 J（`test/scenario-j.test.ts`，fake runner）：backlog 三个批次 A(passed)、B(pending 依赖 A)、C(pending 依赖 X 不存在)，
   `--continue`：B 跑 PASS → 状态列变 `passed`、C 记 `batch.skipped`、`queue.finished` reason=`exhausted`；
   第二组：B 连续 FIX 3 次（`fix_max`=2）→ 第 3 次 `escalated` reason=`fix_max`、退出码 20、B 状态 `blocked`、attempt 为 3 且 `base_sha` 三次相同；
   第三组：`--max 1` 跑一个即停 reason=`limit`。`test/invariants.test.ts` 加「`src/backlog.ts` 有 `setBatchStatus`」「`scenario-j` 存在」

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 场景 J | `npm test -- test/scenario-j.test.ts` | exit 0 |
| 三个事件进 schema | `grep -qE "batch\.skipped" src/schema/index.ts && grep -qE "batch\.status" src/schema/index.ts && grep -qE "queue\.finished" src/schema/index.ts` | exit 0 |
| --continue 存在 | `grep -qE "\-\-continue" src/cli.ts && grep -qE "\-\-max" src/cli.ts` | exit 0 |
| 状态列纯函数 | `grep -qE "export function setBatchStatus" src/backlog.ts && grep -qE "setBatchStatus" test/backlog.test.ts` | exit 0 |
| fix_max 闸有测试 | `grep -qE "fix_max" test/scenario-j.test.ts && grep -qE "escalated" test/scenario-j.test.ts` | exit 0 |
| 不变量同步 | `grep -qE "setBatchStatus\|scenario-j" test/invariants.test.ts` | exit 0 |

额外禁止：
- 改动任何受保护路径（`docs/backlog.md` 的状态列由 R2 在运行时写，worker 不碰）
- 为了让测试过而删除或跳过任何测试
- 单批次模式 `collie run <batch>` 改写 backlog
- 批次之间复用 runner、守护进程或心跳

记录：第 1 次运行 r-20261026-114631 BLOCK（上报：无 report，裁定 `2ae7c51` R2 自推）。worker 跑满 2700 秒墙钟：代码 `c62deb2`、`09f229c`
已在到期前 62 秒推送，随后又跑了 37 秒全量验证，差 5 秒没写 report。两次上下文压缩耗时约 4 分钟。信号阶梯首次真实触发，soft 后 47 毫秒退出，R2 完整收尾。
b02 白名单在 R2 上首次生效：worker 工具清单正好 6 个。reviewer 未拉起，`collie audit` 退出码 2，硬条件未能检验。成本 $18.13。
操作员补测 9/9 验收通过、741 全过；R1 复核 741 全过、受保护路径零改动。裁定：`wallclock_secs` 2700→3600（八处镜像）；worker 手册加「最后推送后立刻写 report、剩 10 分钟停下写」；
对 v03-b03 跑 attempt 2（沿用 `base_sha=556049e`，两个提交进审核范围），这是「墙钟中断 → attempt 2」首次真实走通；`stop_reason` / CLI「rule 0」/ audit 语义进 v03-b03-fix。
第 2 次运行 r-20261026-141212 BLOCK（裁定 `e6c88ea`）：worker 首次真实续接会话（`worker.resumed` 带 attempt 1 的 session_id），2 分 41 秒、15 轮正确地只补了 report，
但 R2 的「`head_sha` 必须是本轮 task 提交的后代」检查把 `09f229c`（早于 `67d74f6`）判为上报，reviewer 两轮都没拉起。花费 $21.49（续接重写缓存）。
另发现：沿用首次 `base_sha` 后取证范围含 R1 在两次 attempt 之间推的 `357e110`（5 个受保护文件）。裁定：v03-b03 标 blocked、代码采纳；
`head_sha` 检查改按首次 `base_sha`、取证排除 R2 提交、只缺 report 不续接，三条并入 v03-b03-fix 并排在最前；R1 自己的约束（attempt 之间不推受保护改动）写进 kickoff。

## v03-b03-fix head_sha 按首次 base_sha、取证排除 R2 提交、续接成本判断、中断原因、CLI 总结行、audit

优先级：26　依赖：v03-b03

v03-b03 两次运行暴露的问题。v03-b03 本身标 blocked、`c62deb2` / `09f229c` 采纳（操作员 9/9 验收补测、R1 复核 743 全过、受保护路径零改动），
但它的核心改动没经过 reviewer——本批次条目 4 的场景测试要把 b03 的队列代码也覆盖进 reviewer 路径。
规格见 SPEC 11.7（`head_sha` 后代检查、取证排除 R2 提交、续接成本判断、结束原因来源）、4.3（上报措辞）、11.2（audit）。
**条目 1、2 优先**：不修它们，任何批次的 attempt 2 都会误 BLOCK，`--continue` 的返工路径等于没有。

条目：
1. `run.ts` `head_sha` 检查改为「是首次 `base_sha` 的后代且是 `HEAD` 的祖先或等于 `HEAD`」，错误文案相应改；
   `src/evidence.ts` 的 `commits_actual` 与规则 2 / 3 的 diff 按提交逐个取、跳过提交信息以 `docs: issue ` / `progress: ` / `report(collie): ` / `ops: ` 开头的提交。
   场景测试（`scenario-e` 或新 `scenario-k`，fake runner）：attempt 1 提交代码并推送后被中断（无 report）；attempt 2 的 fake worker 只写 report、
   `head_sha` 填 attempt 1 的提交 → 不上报、reviewer 被拉起、`commits_actual` 等于 attempt 1 的代码提交且不含 task / progress 提交
2. 续接成本判断（11.7）：`batchHistory` 增加「上一轮是否已推送代码且工作区干净」的判断（journal 里上一轮有 `worker.finished` 且远端含上一轮最后一个
   非 R2 提交、无 `worker.rescued`），为真则 `session_id: null`；`scenario-f` 加一组：已推送只缺 report 时不续接
3. `run.ts`：本轮有 `worker.signaled` 时，`worker.finished` 的 `stop_reason` 记阶梯 reason（`wallclock` / `stalled` / `idling`），SDK 原值放 `sdk_stop_reason`；
   `batchHistory` 构造 `interrupted_at` 时按 SPEC 11.7 顺序（`worker.signaled.reason` 最优先）。场景测试断言 soft 中断后 `interrupted_at` 含 `wallclock` 且不含 `error`。
   `cli.ts` 总结行：上报路径不打印 `rule 0:`，打印 `上报：无 report — <原因>`；`collie audit` 无 reviewer 事件流时输出
   `no reviewer in run <run_id> (escalation path or worker crash); nothing to audit`，退出码仍 2。`test/cli.test.ts` 断言两处文案；
   `test/invariants.test.ts` 加「`src/cli.ts` 不含 `rule 0`」「`src/evidence.ts` 含 `report(collie)`」

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| head_sha 按首次 base_sha | `! grep -qE "does not descend from the task commit" src/run.ts && grep -qE "commits_actual" test/scenario-*.test.ts` | exit 0 |
| 取证排除 R2 提交 | `grep -qE "report\(collie\)" src/evidence.ts && grep -qE "progress: " src/evidence.ts` | exit 0 |
| 续接成本判断有测试 | `grep -qE "session_id.*null\|sessionId.*undefined" test/scenario-f.test.ts` | exit 0 |
| stop_reason 取阶梯 | `grep -qE "sdk_stop_reason" src/run.ts && grep -qE "wallclock" test/scenario-*.test.ts` | exit 0 |
| CLI 无 rule 0 | `! grep -qE "rule 0" src/cli.ts && grep -qE "rule 0" test/cli.test.ts` | exit 0 |
| audit 文案 | `grep -qE "nothing to audit" src/cli.ts && grep -qE "nothing to audit" test/cli.test.ts` | exit 0 |
| 不变量同步 | `grep -qE "rule 0\|sdk_stop_reason" test/invariants.test.ts && grep -qE "report\(collie\)" test/invariants.test.ts` | exit 0 |

额外禁止：
- 改动任何受保护路径
- 为了让测试过而删除或跳过任何测试
- 改动信号阶梯的触发条件或 soft / hard / kill 的实现
- 放宽 `head_sha` 检查到「任意已存在的提交」：必须同时满足首次 `base_sha` 的后代与 `HEAD` 的祖先

记录：第 1 次运行 r-20261026-161002 FIX（裁定 `403916c`），worker 28 分钟、102 轮、$7.18，一个代码提交 `2196fc6`。三条目功能全部完成且有测试，750 全过，R1 复核一致。
**`collie audit` 首次退出码 0**：reviewer 工具清单 Bash / Glob / Grep / Read，worker 6 个。手册「推送后立刻写 report」首次生效（推送到信封 59 秒）。
FIX 的唯一原因是 R1 的第 6 条验收正则区分大小写（`sessionId.*undefined` 对 `toBeUndefined`）——**R1 的错**；reviewer 建议「加注释让 grep 过」是错误引导。
`tool.denied` 首次出现但误拦：`\b` 把 `git merge-base` 当 `merge`；且只进了 reviewer 事件流没进 journal。
两处缺失断言：scenario-e 没断言 `commits_actual` 不含 R2 提交；scenario-f 没断言 `worker.resumed.session_id` 为 null。
裁定：按上一轮给 R1 自己定的约束（attempt 之间不推受保护改动），R1 不能改验收后重跑，所以 v03-b03-fix 标 blocked、`2196fc6` 采纳；
正则改 `(?=\\s|$)`（`tag -l` 仍会被拦，接受）；缺口进 v03-b03-fix2。v03-b03 队列代码不另开审核批次：操作员 9/9 补测 + R1 复核 + 场景 J 作为其审核，真实检验在 b04 起的 `--continue`。
R1 教训：验收里 grep 测试内容时匹配断言语义（`not\.toContain`、`toBeNull`），不要猜字面，或一律 `-i`。

## v03-b03-fix2 补两条断言、bash_deny 正反用例、tool.denied 进 journal、测试超时

优先级：27　依赖：v03-b03-fix

v03-b03-fix 第 1 次运行留下的几个小缺口。规格见 SPEC 11.7（取证排除 R2 提交、不续接）、3.6（`tool.denied` 进 journal）、3.1（`bash_deny`）。

条目：
1. 两条缺失断言：`test/scenario-e.test.ts` 的 attempt 2 用例断言 `commits_actual`（从 verdict 输入或 progress）**不含**本批次的 task / progress / `report(collie)` 提交
   （task、progress、`report(collie)` 三个提交各一条独立的 `not.toContain`，不要用循环合成一条）；`test/scenario-f.test.ts` 的「只缺 report 不续接」用例断言 journal 里 `worker.resumed` 事件的 `session_id` 为 `null`
2. `bash_deny` 正反用例（`test/runner-claude.test.ts`，用仓库 toml 里的正则）：放行 `git merge-base --is-ancestor a b`、`git branch -v`、`git log --oneline`、`npm test`；
   拒绝 `git merge x`、`git push origin main`、`git  push`、`git branch -D x`、`git stash`、`gh api repos`
3. `tool.denied` 进 journal：runner 已通过 `onEvent` 发出该事件，R2 在 `onEvent` 回调里识别 `event === 'tool.denied'` 并 `rec.record('tool.denied', {role, tool, command, pattern})`
   （journal 自带 ts / run_id）；`collie show` 的「中断链」之后列出 `tool.denied` 条数与命令。测试：注入 fake runner 发一条 `tool.denied`，断言 journal 含它。
   顺带：`vitest.config.ts` 的 `testTimeout` 10 秒 → 30 秒（真实 git 的 cli / scenario-j 用例全量运行时 6~8 秒，随机超时），删掉 `scenario-f` 里单独的 30 秒；
   `test/invariants.test.ts` 加「`src/run.ts` 含 `tool.denied`」「`vitest.config.ts` 的 testTimeout ≥ 30000」

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 全量连跑 3 次稳定 | `for i in 1 2 3; do npm test \|\| exit 1; done` | exit 0 |
| commits_actual 排除断言（现有 2 处 + 新增 3 处） | `grep -cE "not\.toContain" test/scenario-e.test.ts \| grep -qE "^([5-9]\|[1-9][0-9])$"` | exit 0 |
| session_id null 断言 | `grep -qiE "session_id.{0,40}null" test/scenario-f.test.ts` | exit 0 |
| bash_deny 正反用例 | `grep -qE "merge-base" test/runner-claude.test.ts && grep -qE "branch -D" test/runner-claude.test.ts` | exit 0 |
| tool.denied 进 journal | `grep -qE "tool\.denied" src/run.ts && grep -qE "tool\.denied" test/*.test.ts` | exit 0 |
| 测试超时 | `grep -qE "testTimeout: 30_?000" vitest.config.ts` | exit 0 |
| 不变量同步 | `grep -qE "tool\.denied\|testTimeout" test/invariants.test.ts` | exit 0 |

额外禁止：
- 改动任何受保护路径
- 为了让测试过而删除或跳过任何测试
- 为了让 grep 通过而加注释或改字面：验收 grep 的是断言，不是字符串

记录：第 1 次运行 r-20261027-033610 PASS（裁定 `437fb77`），10/10 验收通过，765 全过（连跑 3 次），11 分 28 秒、71 轮、$4.56、无上下文压缩，R1 复核一致。
`collie audit` 退出码 0。worker 守住了「grep 的是断言不是字符串」：改的全是真断言，没有凑字符串的注释。
b03-fix 代码首次在 R2 上生效：progress「提交」一栏只有 `1e00841`，取证排除 R2 提交在真实运行里成立。未在真实运行里验证到的：`stop_reason` 取阶梯 reason、上报总结行措辞、`bash_deny` 放行 `merge-base`（reviewer 改用 `branch -r --contains` 核实推送）。
测试强度缺口（操作员发现）：三条 `not.toContain` 里 `progressSha` 用 `find` 取到的是最后一轮裁定提交，progress 写在它之前，该断言恒真；`taskSha` 只取到 attempt 2 的。功能已真实验证，不另开批次，记进 R1 自查清单：场景测试对多轮提交的排除断言要逐轮取 sha（`filter` 不是 `find`）。
**v03-b03 组（b03 / fix / fix2）至此全部收口。从 v03-b04 起用 `--continue --max 1`。**

## v03-b04 放行判定与停表：queue.paused、规则 1 自动重跑、规则 9 连续两次

优先级：28　依赖：v03-b03-fix2

v0.3 最后一个功能批次。规格见 SPEC 12.3、3.6（`queue.paused` / `batch.retried`）、5（退出码 30）。
**这是第一个由 `--continue` 选中并运行的批次**：它自己的代码在被审核时，R2 跑的还是 b03 的队列代码（没有放行判定），属正常。

条目：
1. 放行判定（`src/run.ts` 队列循环，PASS 之后、选下一批之前）：按 SPEC 12.3 的七项逐条检查，任一不满足则 `rec.record('queue.paused', {batch_id, reasons})`、
   `queue.finished` reason=`paused` 带 `paused_count`、退出码 30；全部满足才取下一批。判定函数独立为纯函数 `gateDecision(input): {pass: boolean; reasons: string[]}`
   放在 `src/arbiter.ts` 旁的 `src/gate.ts`，输入只含 SPEC 12.3 列的字段。`schema` 加两个事件；`cli.ts` 退出码 30。单批次模式不调用
2. 规则 1 自动重跑与规则 9 连续两次（同一队列循环）：BLOCK 且 `decision.rule === 1` 且本批次此前没有 `batch.retried` → 记 `batch.retried` 立即重跑同批次，
   不计入 `fix_max`；第二次仍规则 1 → 停、退出码 20。连续两个批次都有 `verdict.downgraded` rule=9 → `queue.paused` reason=`rule9_twice`、退出码 30
3. 场景 L（`test/scenario-l.test.ts`，fake runner，三组）：a. 批次 PASS 但 reviewer `gaps` 非空 → `queue.paused` reasons 含 `gaps`、backlog 状态 `passed`、退出码 30、
   `queue.finished` paused_count=1；b. 第一轮 reviewer 输出坏 JSON（规则 1 BLOCK）、第二轮正常 PASS → journal 有 `batch.retried` rule=1、继续到下一批、
   `fix_max` 计数未增加；c. 两个批次连续 `claims.pushed=false`（规则 9 降级）→ 第二个批次后 `queue.paused` reason=`rule9_twice`。
   `test/gate.test.ts` 覆盖 `gateDecision` 七项各自单独不满足的情况。`test/invariants.test.ts` 加「`src/gate.ts` 存在且不 import runner」「`scenario-l` 存在」

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 场景 L | `npm test -- test/scenario-l.test.ts` | exit 0 |
| 两个事件进 schema | `grep -qE "queue\.paused" src/schema/index.ts && grep -qE "batch\.retried" src/schema/index.ts` | exit 0 |
| 判定是纯函数 | `grep -qE "export function gateDecision" src/gate.ts && ! grep -qE "runner\|run\.js" src/gate.ts` | exit 0 |
| 退出码 30 | `grep -qE "\b30\b" src/cli.ts && grep -qE "\b30\b" test/scenario-l.test.ts` | exit 0 |
| 规则 1 重跑不计 fix_max | `grep -qE "batch\.retried" src/run.ts && grep -qE "fix_max" test/scenario-l.test.ts` | exit 0 |
| 规则 9 连续两次 | `grep -qE "rule9_twice" src/run.ts && grep -qE "rule9_twice" test/scenario-l.test.ts` | exit 0 |
| 七项各有单测 | `grep -cE "^\s+it\(" test/gate.test.ts \| grep -qE "^([7-9]\|[1-9][0-9])$"` | exit 0 |
| 不变量同步 | `grep -qE "gate\.ts\|scenario-l" test/invariants.test.ts` | exit 0 |

额外禁止：
- 改动任何受保护路径
- 为了让测试过而删除或跳过任何测试
- 改动规则 1~10 的实现或仲裁结论：放行判定只决定「继续还是停」，不改 PASS
- 单批次模式 `collie run <batch>` 发出 `queue.paused` 或返回 30

记录：第一次 `--continue --max 1`（队列 q-20261027051508，50 分 44 秒，退出码 0）。选批正确（唯一 pending 且依赖已 passed），
第 1 次运行 FIX（$8.92）→ 队列在 `fix_max` 内自动重跑 → 第 2 次 PASS（$0.63，不续接会话，b03-fix 规则首次真实生效）。
**R2 第一次写受保护路径**：`batch.status` pending→passed，只改第 46 行最后一格，操作员逐字节比对其余相同，并进裁定提交 `2bbda1b`。
两次 `collie audit` 都是 0。R1 复核 792 全过、`gate.ts` 零 import。放行判定本轮未生效（R2 跑的是 b03 代码）。
FIX 的原因又是验收正则匹配到注释（`! grep "runner"` 碰到 `gate.ts` 第 3 行注释里的词）——R1 第二次犯同类错；更糟的是 reviewer 主动建议改注释、
worker 照做并在提交信息写明「to satisfy acceptance grep」，一行代码没动就从 FIX 变 PASS。裁定：PASS 维持（功能真实、CI 绿、纯函数属实）；
「不得为过验收改字面」升为铁律 26，worker 手册 4.2、reviewer 手册核对表同步；FIX 重跑语义（attempt 递增、不写中断、写「上一轮判 FIX」）、
`fix_max` 只计本次队列、队列 journal 加 `queue.batch_started` 三条进 v03-b04-fix。

## v03-b04-fix FIX 重跑的 task 语义、fix_max 只计本次队列、队列 journal 可还原

优先级：29　依赖：v03-b04

v03-b04 第一次队列运行暴露的三处。规格见 SPEC 11.7（FIX 重跑）、12.2（`fix_max` 计数范围、队列 journal）、3.6（`queue.batch_started`）。

条目：
1. FIX 重跑的 task（`run.ts` `batchHistory` / task 生成）：上一轮 `run.finished.verdict === 'FIX'` 时 `interrupted_at: null`、不写「上一轮中断」，
   改写「上一轮判 FIX」一节：上一轮 verdict 的 `gaps` 原样、未通过的验收命令与退出码、上一轮代码提交清单、「只补缺口，不要重做」。
   场景测试（scenario-l 或 scenario-j 加一组）：第 1 轮 fake reviewer 判 FIX 带 gaps，第 2 轮断言 task.md 含该 gaps 文本、`interrupted_at` 为 null、不含「上一轮中断」
2. `fix_max` 计数只数本次 `--continue` 内本批次的 FIX（队列循环里的内存计数，不再 `countBatchFinished` 扫全部历史）；
   场景测试：预先在 `.collie/runs/` 放两个该批次历史 FIX 的 journal，`--continue` 仍应重跑而不是直接 `escalated`
3. 队列 journal：每次拉起批次运行前 `queueRec.record('queue.batch_started', {run_id, batch_id, attempt, why})`，`why` 取 `new` / `fix_retry` / `rule1_retry`；
   `queue.finished.batches` 改为 `{batch_id, run_id, verdict}[]`（schema 同步）。`collie show --queue <q-run_id>` 按 journal 打印时间线。
   `test/invariants.test.ts` 加「`src/run.ts` 含 `queue.batch_started`」「`src/run.ts` 不含 `countBatchFinished`」

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| FIX 重跑不写中断 | `grep -qE "上一轮判 FIX" src/run.ts && grep -qE "上一轮判 FIX" test/scenario-*.test.ts` | exit 0 |
| fix_max 只计本次队列 | `! grep -v '^\s*//' src/run.ts \| grep -qE "countBatchFinished" && grep -qE "escalated" test/scenario-*.test.ts` | exit 0 |
| 队列事件进 schema | `grep -qE "queue\.batch_started" src/schema/index.ts && grep -qE "fix_retry" src/run.ts` | exit 0 |
| show --queue | `grep -qE "\-\-queue" src/cli.ts && grep -qE "\-\-queue" test/cli.test.ts` | exit 0 |
| 不变量同步 | `grep -qE "queue\.batch_started" test/invariants.test.ts` | exit 0 |

额外禁止：
- 改动任何受保护路径
- 为了让测试过而删除或跳过任何测试
- 为了让验收命令通过而改注释或字面（铁律 26）：匹配到注释就在 report 里指出，照常提交
- 改动放行判定（`gate.ts`）、规则 1~10、`fix_max` 的默认值

## v04-b01 观测数据补齐：运行级字段、evidence.collected、裁定依据，判定第 6 项与 README 清理

优先级：30　依赖：v03-b04-fix

v0.4 的四个命令只读 journal，本批次先把要看的数据写进 journal。规格见 SPEC 13.1、3.6（两个新事件）、12.3（判定改为六项）。

条目：
1. 清理：`gate.ts` 删掉 `protectedDiffLines` 与原因码 `protected`，判定共六项，`run.ts` 调用处与 `test/gate.test.ts` 同步；
   `README.md` 的状态行改成现状（v0.3 功能批次已完成、v0.4 进行中）、铁律条数改 26
2. 运行级数据进 journal（SPEC 13.1）：`worker.finished` 加 `num_turns` / `cost_usd` / `duration_ms` / `usage` 四个 token 字段；
   新增 `reviewer.finished`（reviewer 返回后、解析 verdict 前）；`worker.started` / `reviewer.started` 加 `model`。
   `RunResult` 与 `Usage` 按 13.1 扩展，`claude.ts` 的取值类型从 SDK 导出派生，fake runner 可脚本化这些值；runner 没给的字段不写
3. 批次级与裁定依据进 journal（SPEC 13.1）：新增 `evidence.collected`；`run.finished` 加 `rule` / `reason`；`reviewer.verdict` 加 `gaps`。
   新建 `test/journal-fields.test.ts`，用 fake runner 跑完整一轮，逐个断言上面每个新字段出现在 journal 里，并断言 runner 不给用量时这些字段不存在；
   `test/invariants.test.ts` 加「`src/schema/index.ts` 含 `evidence.collected` 与 `reviewer.finished`」「`src/gate.ts` 不含 `protectedDiffLines`」

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 判定第 6 项已删（不看注释行） | `! cat src/gate.ts src/run.ts test/gate.test.ts \| grep -vE "^\s*(//\|\*\|/\*)" \| grep -qE "protectedDiffLines"` | exit 0 |
| README 改成现状 | `! grep -qE "实现未开始\|25 条" README.md && grep -qE "26 条" README.md` | exit 0 |
| 新字段专项测试通过 | `npm test -- test/journal-fields.test.ts` | exit 0 |
| 专项测试不少于 6 个 | `grep -cE "^\s+it\(" test/journal-fields.test.ts \| grep -qE "^([6-9]\|[1-9][0-9])$"` | exit 0 |
| 两个新事件进 schema | `grep -qE "reviewer\.finished" src/schema/index.ts && grep -qE "evidence\.collected" src/schema/index.ts` | exit 0 |
| 花费取自 SDK 且有测试 | `grep -qE "total_cost_usd" src/runner/claude.ts && grep -qE "total_cost_usd" test/runner-claude.test.ts` | exit 0 |
| 不变量同步 | `grep -qE "evidence\.collected" test/invariants.test.ts` | exit 0 |

额外禁止：
- 改动任何受保护路径
- 为了让测试过而删除或跳过任何测试（`test/gate.test.ts` 里 `protected` 那一个用例随条目 1 删除，不算）
- 为了让验收命令通过而改注释或字面（铁律 26）
- 改动规则 1~10、队列逻辑、`SCHEMA_VERSION`；新增依赖

记录：队列 q-20261110151133 里跑了 3 次（r-20261110151133 / 153637 / 154601），每次都是验收 10/10 通过、reviewer 判 PASS、
规则 9 因 CI 证据取不到降为 FIX（操作员机器上 `ci.token_file` 指向的文件丢失，匿名配额为 0），第 3 次后 `fix_max` 停下。
这是环境问题，不是 worker 的问题。裁定（2026-11-11，SPEC 13.11）：标 blocked，`7600a4c`、`89288a6`、`e0dcdcf` 采纳，不重跑；
依据是 R1 复核与 GitHub Actions 页面上 `e0dcdcf` 的 Run 178 成功，不是 R2 取到的证据。缺口进 v04-b02（钩子超时）、v04-b06、v04-b07。

## v04-b02 投影模块 view.ts 与 collie status

优先级：31　依赖：v03-b04-fix

规格见 SPEC 13.2。`src/view.ts` 是后面三个命令共用的取数入口，这一批把它立起来。
v04-b01 标 blocked、代码已采纳（SPEC 13.11），所以依赖指向 v03-b04-fix；13.1 的字段与事件已经在 main 上。

条目：
1. `src/view.ts` 读取层 `loadRuns(root)`：扫全部运行目录并重放；单个运行的 journal 校验失败不抛出，记为 `unreadable` 带原因，其余照常
2. `src/view.ts` 投影层 `projectRuns` / `projectBatches`：纯函数，`now` 由参数传入，不 import `run.ts` / `runner/` / `roles/`；
   13.1 的字段缺失时给 `null`。`collie status [--json]` 按 13.2 的三段输出，`cli.ts` 只做接线；没有 journal 时打印 `no runs recorded` 退出码 0
3. `test/view.test.ts`：夹具至少覆盖一次 PASS、FIX 后 PASS、进行中的运行、旧格式 run_id 目录、含坏行的 journal、一次队列运行、不含 13.1 字段的旧 journal；
   `test/invariants.test.ts` 加「`src/view.ts` 不 import `run.ts` / `runner/` / `roles/`」。
   另：`vitest.config.ts` 加 `hookTimeout`，与 `testTimeout` 同值（SPEC 13.11：`test/journal-fields.test.ts` 的 `beforeAll` 跑完整一轮，
   默认的 10 秒在有负载的机器上会超时，一超时整个文件的用例被跳过、`npm test` 失败）；本批次新写的测试若在钩子里跑完整一轮，同样受它保护

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 投影专项测试通过 | `npm test -- test/view.test.ts` | exit 0 |
| 专项测试不少于 8 个 | `grep -cE "^\s+it\(" test/view.test.ts \| grep -qE "^([8-9]\|[1-9][0-9])$"` | exit 0 |
| 投影模块不依赖运行逻辑 | `test -f src/view.ts && ! grep -qE "from '\./(run\|runner\|roles)[./]" src/view.ts` | exit 0 |
| 坏 journal 有处理且有测试 | `grep -qE "unreadable" src/view.ts && grep -qE "unreadable" test/view.test.ts` | exit 0 |
| status 命令已接线 | `npx tsx src/cli.ts status` | exit 0 |
| status --json 输出合法 JSON | `npx tsx src/cli.ts status --json \| node -e "JSON.parse(require('fs').readFileSync(0,'utf8'))"` | exit 0 |
| 不变量同步 | `grep -qE "view\.ts" test/invariants.test.ts` | exit 0 |
| 钩子超时已配置（不看注释行） | `grep -vE "^\s*(//\|\*\|/\*)" vitest.config.ts \| grep -qE "hookTimeout"` | exit 0 |

额外禁止：
- 改动任何受保护路径
- 为了让测试过而删除或跳过任何测试
- 为了让验收命令通过而改注释或字面（铁律 26）
- 改动 `run.ts`、`gate.ts`、`arbiter.ts`、规则 1~10；让 `status` 写任何文件；新增依赖

## v04-b03 collie timeline：时间轨迹与按版本汇总

优先级：32　依赖：v04-b02

规格见 SPEC 13.3。

条目：
1. `src/view.ts` 加 `projectTimeline`：按时间升序输出节点（批次首次开始、每次运行结束、`batch.status` 变化、队列开始 / 停表 / 结束）
2. `collie timeline [--since <日期>] [--batch <前缀>] [--by version] [--json]`；`--by version` 按版本前缀汇总，没有花费数据的运行不计入并注明个数；
   输出末尾固定一行说明 ADR 与发布去 `git log` 看
3. `test/timeline.test.ts`：覆盖节点顺序、`--since` 与 `--batch` 过滤、按版本汇总、缺花费数据、空目录；`test/invariants.test.ts` 加「`src/cli.ts` 含 `timeline` 命令」

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| timeline 专项测试通过 | `npm test -- test/timeline.test.ts` | exit 0 |
| 专项测试不少于 6 个 | `grep -cE "^\s+it\(" test/timeline.test.ts \| grep -qE "^([6-9]\|[1-9][0-9])$"` | exit 0 |
| timeline 命令已接线 | `npx tsx src/cli.ts timeline` | exit 0 |
| 按版本汇总可用 | `npx tsx src/cli.ts timeline --by version` | exit 0 |
| timeline --json 输出合法 JSON | `npx tsx src/cli.ts timeline --json \| node -e "JSON.parse(require('fs').readFileSync(0,'utf8'))"` | exit 0 |
| 不变量同步 | `grep -qE "timeline" test/invariants.test.ts` | exit 0 |

额外禁止：
- 改动任何受保护路径
- 为了让测试过而删除或跳过任何测试
- 为了让验收命令通过而改注释或字面（铁律 26）
- 改动 `run.ts`、`gate.ts`、`arbiter.ts`、规则 1~10；绕过 `src/view.ts` 直接读 journal；让 `timeline` 写任何文件；新增依赖

## v04-b04 collie why：按 attempt 摊开证据链

优先级：33　依赖：v04-b02

规格见 SPEC 13.4。

条目：
1. `src/view.ts` 加 `projectWhy`：按 attempt 汇集一个批次每次运行的证据链，顺序按 13.4；13.1 的字段缺失时该行显示 `—`，不报错
2. `collie why <batch_id> [--attempt <n>] [--json]`：每个 attempt 末尾一行结论，由规则号对应的固定模板加 `reason` 生成，不调用模型、不读信封文件；
   退出码 0 有数据 / 1 批次不在 backlog / 2 批次在 backlog 但本机没有 journal
3. `test/why.test.ts`：覆盖 PASS、规则 8 的 FIX、规则 2 的 BLOCK、规则 1 的格式错、无 report 的上报、被中断后恢复、三个退出码；
   `test/invariants.test.ts` 加「`src/cli.ts` 含 `why` 命令」

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| why 专项测试通过 | `npm test -- test/why.test.ts` | exit 0 |
| 专项测试不少于 8 个 | `grep -cE "^\s+it\(" test/why.test.ts \| grep -qE "^([8-9]\|[1-9][0-9])$"` | exit 0 |
| why 已接线，已知批次不报错、未知批次报错 | `npx tsx src/cli.ts why v03-b04-fix; test $? -ne 1 && ! npx tsx src/cli.ts why no-such-batch` | exit 0 |
| 不变量同步 | `grep -qE "why" test/invariants.test.ts` | exit 0 |

额外禁止：
- 改动任何受保护路径
- 为了让测试过而删除或跳过任何测试
- 为了让验收命令通过而改注释或字面（铁律 26）
- 改动 `run.ts`、`gate.ts`、`arbiter.ts`、规则 1~10；改动 `show` 的输出；让 `why` 写任何文件；新增依赖

记录：队列 q-20261111051219 里跑了 1 次（r-20261111055746）：worker 在 900 秒内没有改出任何文件，被判空转、soft 停止，没有 report，上报 BLOCK。没有代码提交。
这不是 worker 越界，是开局要读的文档太大加上空转线没有给开局留余量。裁定（2026-11-11，SPEC 13.12）：标 blocked，不重跑，`why` 改签为 v04-b09；
必读清单瘦身、`progress_secs` 900→1500。条目本身也有规格漏洞（attempt 的取值来源没写），见 SPEC 13.13。

## v04-b05 collie watch：实时跟随

优先级：34　依赖：v04-b02

规格见 SPEC 13.5。

条目：
1. `src/watch.ts`（SPEC 13.5；`status` 的「当前」段见 13.2，事件字段表在 3.6）：轮询循环，时钟、sleep 与取数函数都由参数注入；每条新事件打印一行，阶段变化时打印 `status` 的「当前」段，
   静默超过 `stall_secs` 时标出秒数；`run.finished`（队列运行为 `queue.finished`）后结束
2. `collie watch [--once] [--interval <秒>] [--timeout <秒>]`，`cli.ts` 只做接线；只读：不写 journal、不碰心跳、不发信号
3. `test/watch.test.ts`：用注入的时钟与 sleep，覆盖 `--once`、跟到 `run.finished` 退出、跟到 `queue.finished` 退出、等待新运行、超时退出、静默标注；
   `test/invariants.test.ts` 加「`test/watch.test.ts` 不含真实定时器」「`src/watch.ts` 不写文件」

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| watch 专项测试通过 | `npm test -- test/watch.test.ts` | exit 0 |
| 专项测试不少于 6 个 | `grep -cE "^\s+it\(" test/watch.test.ts \| grep -qE "^([6-9]\|[1-9][0-9])$"` | exit 0 |
| watch --once 可用 | `npx tsx src/cli.ts watch --once` | exit 0 |
| 测试不用真实定时器 | `test -f test/watch.test.ts && ! grep -qE "setInterval\|setTimeout\(" test/watch.test.ts` | exit 0 |
| watch 只读（不看注释行） | `test -f src/watch.ts && ! grep -vE "^\s*(//\|\*\|/\*)" src/watch.ts \| grep -qE "writeFileSync\|appendFileSync\|process\.kill"` | exit 0 |
| 不变量同步 | `grep -qE "watch\.ts" test/invariants.test.ts` | exit 0 |

额外禁止：
- 改动任何受保护路径
- 为了让测试过而删除或跳过任何测试
- 为了让验收命令通过而改注释或字面（铁律 26）
- 改动 `run.ts`、`gate.ts`、`arbiter.ts`、规则 1~10；绕过 `src/view.ts` 直接读 journal；新增依赖

## v04-b06 环境故障不当成 worker 的 FIX：token 读不到就启动失败、证据取不到时队列不重跑

优先级：35　依赖：v03-b04-fix

队列 q-20261110151133 暴露：token 文件丢失被悄悄当成未配置，CI 证据取不到又被当成 worker 的 FIX 重跑了两次。规格见 SPEC 13.9、3.1、3.6、4.3。
规则 9 的结论不变（没有 CI 证据就不能 PASS），变的是 R2 怎么报、队列怎么停。

条目：
1. token 文件（SPEC 13.9）：读 token 的代码收成一处；配了 `ci.token_file` 但文件不存在、读不了或为空时，`collie run`（两种模式）在签发 task 之前退出码 1，
   stderr 含 `ci.token_file`、展开后的路径与原因。测试不得依赖真实 home 目录：凡是会走到 `run` 的夹具，配置要么不配 `token_file`，要么指向临时目录里的文件
   （GitHub 的 CI 机器上没有这个文件，直接读仓库里 toml 的现有用例在本批次之后会在 CI 上失败，要一并改）
2. `collie smoke`（SPEC 13.9）：先查 token 文件再调 runner；runner 通过后用 token 对当前 `HEAD` 查一次 CI，请求失败退出码 1 并打印原因，成功打印 `ci ok`；
   报错、事件与输出里不得出现 token 内容
3. 证据取不到（SPEC 13.9）：规则 9 触发且属于 13.9 列的三种情况时，`verdict.downgraded` 加 `cause: "evidence_unavailable"` 与 `detail`；
   `--continue` 遇到它不重跑、不计 `fix_max`、不改 backlog 状态，记 `escalated` 与 `queue.finished`（reason 都是 `evidence_unavailable`），退出码 20。
   新建 `test/scenario-m.test.ts`：token 文件缺失时启动失败且没有签发 task；限流时单批次模式的 FIX 带 `cause`；`--continue` 只跑一次就停、backlog 状态仍是 `pending`、退出码 20；
   对照组 CI `failure` 仍按普通 FIX 重跑；smoke 的两种失败。`test/invariants.test.ts` 加「`src/run.ts` 含 `evidence_unavailable`」

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 场景 M 通过 | `npm test -- test/scenario-m.test.ts` | exit 0 |
| 场景 M 不依赖真实 home 目录 | `HOME=$(mktemp -d) npm test -- test/scenario-m.test.ts` | exit 0 |
| 场景 M 不少于 6 个用例 | `grep -cE "^\s+it\(" test/scenario-m.test.ts \| grep -qE "^([6-9]\|[1-9][0-9])$"` | exit 0 |
| 原因码进代码与测试（不看注释行） | `grep -vE "^\s*(//\|\*\|/\*)" src/run.ts \| grep -qE "evidence_unavailable" && grep -qE "evidence_unavailable" test/scenario-m.test.ts` | exit 0 |
| token 文件缺失时 smoke 报错并指出配置项 | `HOME=$(mktemp -d) npx tsx src/cli.ts smoke --runner fake 2>&1 \| grep -qE "token_file"` | exit 0 |
| 不变量同步 | `grep -qE "evidence_unavailable" test/invariants.test.ts` | exit 0 |

额外禁止：
- 改动任何受保护路径
- 为了让测试过而删除或跳过任何测试
- 为了让验收命令通过而改注释或字面（铁律 26）
- 改动规则 1~10 的判定（规则 9 的结论仍是 FIX）、放行判定、`fix_max` 的默认值；让报错、事件或输出里出现 token 内容；新增依赖

## v04-b07 队列收尾：queue.batch_started 归位、fix_max 提交推送、FIX 重跑写明降级原因

优先级：36　依赖：v04-b06

同一次队列运行暴露的三处，都在 v03-b04-fix 的代码里。规格见 SPEC 13.10、3.6、11.7、12.2。

条目：
1. journal 归位（SPEC 13.10）：`queue.batch_started` 的批次运行号字段改名 `batch_run_id`，事件落在队列的 `q-` journal；`Recorder.record` 遇到名为 `ts` / `run_id` / `event` 的扩展字段抛错；
   `show --queue` 与现有夹具同步。`reviewer.verdict` 的 `gaps` 在 verdict 可解析时总是写，没有缺口写空数组。
   批次历史（`batchHistory` / `allBatchEvents`）只把含 `run.started` 的 journal 当成一次批次运行：否则事件归位后，队列里每个批次的第一次运行都会变成 attempt 2、task 带「上一轮中断」（SPEC 13.10 末段）
2. `fix_max` 升级时的 backlog 提交按 SPEC 12.1 推送，在队列 journal 记 `verdict.pushed` 或 `verdict.push_failed`
3. FIX 重跑的 task（SPEC 13.10、11.7）：「上一轮判 FIX」一节加小节「降级原因」，写上一轮 `verdict.downgraded` 的规则号与 `reason`，有 `cause` / `detail` 时一并写；
   提交清单只列 worker 的代码提交（按 R2 提交前缀排除）。新建 `test/queue-journal.test.ts`：`queue.batch_started` 在 `q-` journal 里、不在 `r-` journal 里；
   `Recorder` 拒绝信封键；`fix_max` 之后远端含 HEAD 且有 `verdict.pushed`；规则 9 的 FIX 重跑 task 含降级原因；清单不含 `docs: issue` 提交；没有缺口时 `gaps` 是空数组；
   `--continue` 下批次第一次运行的 task 里 `attempt` 是 1、`interrupted_at` 为 null，FIX 重跑是 2。
   `test/invariants.test.ts` 加「`src/run.ts` 含 `batch_run_id`」

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 队列 journal 专项测试通过 | `npm test -- test/queue-journal.test.ts` | exit 0 |
| 专项测试不少于 7 个 | `grep -cE "^\s+it\(" test/queue-journal.test.ts \| grep -qE "^([7-9]\|[1-9][0-9])$"` | exit 0 |
| 队列 journal 不算批次运行（有测试） | `grep -qE "interrupted_at" test/queue-journal.test.ts` | exit 0 |
| 字段改名进代码与测试（不看注释行） | `grep -vE "^\s*(//\|\*\|/\*)" src/run.ts \| grep -qE "batch_run_id" && grep -qE "batch_run_id" test/queue-journal.test.ts` | exit 0 |
| 降级原因进 task 生成与测试 | `grep -rqE "降级原因" src && grep -qE "降级原因" test/queue-journal.test.ts` | exit 0 |
| 不变量同步 | `grep -qE "batch_run_id" test/invariants.test.ts` | exit 0 |

额外禁止：
- 改动任何受保护路径
- 为了让测试过而删除或跳过任何测试
- 为了让验收命令通过而改注释或字面（铁律 26）
- 改动规则 1~10、放行判定、`fix_max` 的默认值与计数方式；新增依赖

## v04-b08 投影取值修补：attempt 按 R2 口径推算、运行用时、花费缺数据、空数据的 --json

优先级：37　依赖：v04-b03

v04-b03 的 `timeline` 与 v04-b02 的 `status` 在真实 journal 上跑出来的四处问题：操作员在队列 q-20261111051219 结束后实跑发现，验收与测试都没测到。规格见 SPEC 13.13。

条目：
1. 取值（SPEC 13.13，读这一节即可；事件字段表在 3.6）：`src/view.ts` 加一个推算 attempt 的函数，`status` 的「当前」段与 `timeline` 的 `run_end` 都用它，
   删掉对 `batch.selected.attempt`、`run.finished.attempt` 的读取（R2 不写这两个字段）；运行用时改为 `run.finished.ts` − `run.started.ts`；
   按版本汇总在范围内没有任何花费数据时显示 `—`
2. 空数据的 `--json`（SPEC 13.13）：没有 journal 时 `status --json` 输出与有数据时同一结构、`timeline --json` 输出 `[]`，不再输出 `{"message": …}`。
   R2 的验收在 `head_sha` 的干净 worktree 里跑，那里没有 `.collie/runs/`；主仓库里有 journal，在主仓库自测看不到这条失败（v04-b02 第 1 次因此 FIX）
3. 新建 `test/view-real.test.ts`：用 `test/support/sandbox.ts` 的 `Sandbox` 让 fake runner 跑真实的 `collie run`（单批次模式，同一批次先 FIX 再 PASS 两次运行），
   断言投影出的 attempt 依次是 1、2 且等于当次 `task.md` frontmatter 的 `attempt`，运行用时不为 null，没有花费数据时汇总显示 `—`；
   `test/timeline.test.ts` 与 `test/view.test.ts` 的手写夹具删掉 R2 不写的字段。
   `test/invariants.test.ts` 加「`src/view.ts` 不含 `batchSelected.attempt`」「`test/view-real.test.ts` 含 `Sandbox.create`」

验收标准：

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

额外禁止：
- 改动任何受保护路径
- 为了让测试过而删除或跳过任何测试（从手写夹具里删掉 R2 不写的字段不算）
- 为了让验收命令通过而改注释或字面（铁律 26）
- 改动 `run.ts`、`gate.ts`、`arbiter.ts`、规则 1~10；让 `status` / `timeline` 写任何文件；绕过 `src/view.ts` 直接读 journal；新增依赖

## v04-b09 collie why：按 attempt 摊开证据链（重签 v04-b04）

优先级：38　依赖：v04-b08

v04-b04 的重签（SPEC 13.12）。规格见 SPEC 13.4；attempt 的取值按 13.13，用 v04-b08 加的推算函数，不另写一套。

条目：
1. `src/view.ts` 加 `projectWhy`（SPEC 13.4；attempt 按 13.13，用 v04-b08 的推算函数；事件字段表在 3.6）：按 attempt 汇集一个批次每次运行的证据链，顺序按 13.4；
   字段缺失时该行显示 `—`，不报错；放行依据按 13.4 末段（有 `queue.gate_passed` 就引用，没有就列事实、不下结论）
2. `collie why <batch_id> [--attempt <n>] [--json]`（SPEC 13.4）：每个 attempt 末尾一行结论，由规则号对应的固定模板加 `reason` 生成，不调用模型、不读信封文件；
   退出码 0 有数据 / 1 批次不在 backlog / 2 批次在 backlog 但本机没有 journal。`cli.ts` 只做接线
3. `test/why.test.ts`：PASS、reviewer 判 FIX 后重跑 PASS 这两种，用 `test/support/sandbox.ts` 的 `Sandbox` 让 fake runner 跑真实的 `collie run` 得到 journal；
   规则 8 的 FIX、规则 2 的 BLOCK、规则 1 的格式错、无 report 的上报、被中断后恢复可以手写夹具，事件字段只能用 SPEC 3.6 与第 11~13 章写明的；另测三个退出码。
   `test/invariants.test.ts` 加「`src/cli.ts` 含 `why` 命令」

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| why 专项测试通过 | `npm test -- test/why.test.ts` | exit 0 |
| 专项测试不少于 8 个 | `grep -cE "^\s+it\(" test/why.test.ts \| grep -qE "^([8-9]\|[1-9][0-9])$"` | exit 0 |
| 专项测试含真实运行的夹具 | `grep -qE "Sandbox\.create" test/why.test.ts` | exit 0 |
| why 已接线，已知批次不报错、未知批次报错 | `npx tsx src/cli.ts why v03-b04-fix; test $? -ne 1 && ! npx tsx src/cli.ts why no-such-batch` | exit 0 |
| 不变量同步 | `grep -qE "why" test/invariants.test.ts` | exit 0 |

额外禁止：
- 改动任何受保护路径
- 为了让测试过而删除或跳过任何测试
- 为了让验收命令通过而改注释或字面（铁律 26）
- 改动 `run.ts`、`gate.ts`、`arbiter.ts`、规则 1~10；改动 `show`、`status`、`timeline` 的输出；让 `why` 写任何文件；绕过 `src/view.ts` 直接读 journal；新增依赖

## v04-b10 队列里的中断自动续跑一次、验收失败全记、放行留痕

优先级：39　依赖：v04-b07

队列 q-20261111051219 暴露：被判空转的批次本来可以续接，队列却直接停下等人。规格见 SPEC 13.14、12.2、12.3、3.6。改的是 R2，要等固定版本前移才生效。

条目：
1. 中断续跑（SPEC 13.14；先例是 12.3 的规则 1 重跑；中断语义见 11.7）：`--continue` 下，走上报路径且 `worker_stop_reason` 是 `idling` / `stalled` / `wallclock` 的批次运行，
   本次队列内第一次自动重跑：记 `batch.retried`（cause `interrupted`、带 stop_reason），不计 `fix_max` 与 `--max`，backlog 状态改回 `pending`，`queue.batch_started.why` 为 `interrupt_retry`；
   第二次仍中断则停，退出码 20。worker 崩溃、`turns_exhausted`、reviewer 失败不重跑。规则 1 的重跑判断只认带 `rule: 1` 的 `batch.retried`
2. 留痕（SPEC 13.14、3.6）：R2 实测未满足的每条验收不论裁决都记 `acceptance.failed`（规则 8 的判定不变）；
   PASS 后放行判定通过时在队列 journal 记 `queue.gate_passed`（字段 batch_id / batch_run_id，不得用 `run_id` 作扩展字段名）
3. 新建 `test/scenario-n.test.ts`，时钟与产出指纹按场景 G 的做法注入，不用真实定时器：空转一次后续跑 PASS、队列继续；连续两次空转退出码 20；worker 崩溃不续跑；
   续跑不占 `fix_max`；reviewer 判 FIX 时 journal 有 `acceptance.failed`；PASS 后队列 journal 有 `queue.gate_passed`。
   `test/invariants.test.ts` 加「`src/schema/index.ts` 含 `queue.gate_passed`」「`src/run.ts` 含 `interrupt_retry`」

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 场景 N 通过 | `npm test -- test/scenario-n.test.ts` | exit 0 |
| 场景 N 不少于 6 个用例 | `grep -cE "^\s+it\(" test/scenario-n.test.ts \| grep -qE "^([6-9]\|[1-9][0-9])$"` | exit 0 |
| 场景 N 不用真实定时器 | `test -f test/scenario-n.test.ts && ! grep -qE "setInterval\|setTimeout\(" test/scenario-n.test.ts` | exit 0 |
| 续跑原因进代码与测试（不看注释行） | `grep -vE "^\s*(//\|\*\|/\*)" src/run.ts \| grep -qE "interrupt_retry" && grep -qE "interrupt_retry" test/scenario-n.test.ts` | exit 0 |
| 放行事件进 schema 与测试 | `grep -qE "queue\.gate_passed" src/schema/index.ts && grep -qE "queue\.gate_passed" test/scenario-n.test.ts` | exit 0 |
| 不变量同步 | `grep -qE "queue\.gate_passed" test/invariants.test.ts` | exit 0 |

额外禁止：
- 改动任何受保护路径
- 为了让测试过而删除或跳过任何测试
- 为了让验收命令通过而改注释或字面（铁律 26）
- 改动规则 1~10 的判定、放行判定的六项、`fix_max` 与各项阈值的默认值；新增依赖

## v04-b11 R2 的后台 git 读取不抢索引锁

优先级：40　依赖：v04-b10

全量测试零散失败的根因：活性检测取产出指纹时的 `git diff` / `git status` 会短暂占用 `index.lock`，worker 的 `git add` / `git commit` 撞上就失败。规格见 SPEC 13.15。
依赖写 v04-b10 只是为了排在它之后（两批都动 R2），没有功能上的依赖。

条目：
1. `src/git.ts` 的 `git()`（SPEC 13.15，读这一节即可）：拉起 git 子进程时环境带 `GIT_OPTIONAL_LOCKS=0`，其余环境变量照常继承；不改任何调用方，不改取指纹的算法
2. `test/git.test.ts` 加用例：通过 `git()` 执行一个打印该环境变量的别名（`-c alias.optlocks='!printenv GIT_OPTIONAL_LOCKS' optlocks`），断言输出是 `0`；
   再断言进程环境里已有的变量（例如测试夹具设的 `GIT_CONFIG_GLOBAL`）在子进程里仍然可见
3. `test/invariants.test.ts` 加「`src/git.ts` 含 `GIT_OPTIONAL_LOCKS`」「`src/` 下除 `src/git.ts` 外没有第二处直接 `spawn('git'`」

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 环境变量进代码（不看注释行） | `grep -vE "^\s*(//\|\*\|/\*)" src/git.ts \| grep -qE "GIT_OPTIONAL_LOCKS"` | exit 0 |
| 有测试断言子进程拿到它 | `grep -qE "GIT_OPTIONAL_LOCKS" test/git.test.ts && npm test -- test/git.test.ts` | exit 0 |
| 不变量同步 | `grep -qE "GIT_OPTIONAL_LOCKS" test/invariants.test.ts` | exit 0 |

额外禁止：
- 改动任何受保护路径
- 为了让测试过而删除或跳过任何测试
- 为了让验收命令通过而改注释或字面（铁律 26）
- 改动活性检测的判定、阈值与取指纹的算法；改动规则 1~10；新增依赖

记录：第 1 次（队列 q-20261111093302，r-20261111115621）代码做完、已推送、CI success，但 report 的 `head_sha` 与 `commits` 是一个不存在的 40 位 sha
（前 7 位对，后 33 位是 worker 补的），R2 上报 BLOCK，状态 `blocked`。拦得对；上报原因写错了（SPEC 13.17）。
第 2 次（2026-11-12，单批次模式，r-20261112-111806）worker 只重写了 report，R2 取证验收 6/6、CI success、reviewer PASS，规则 10 PASS，采纳 `049854d`。
单批次模式不写状态列，R1 于 2026-11-13 改为 `passed`（SPEC 13.16）。

## v04-b12 活性场景测试的假时钟：冻结前不走，加慢开局用例（只改测试）

优先级：41　依赖：v04-b10

场景 G 的两个用例随机失败（R1 的机器上多次，GitHub CI 上 1 次）：假时钟每调用一次 `now()` 走 1 毫秒，机器一慢就在判空转之前先走过了 `stall_secs`，记成了 `worker.stalled`。
规格见 SPEC 13.19。本批次只改 `test/`，不改 `src/`。排在最前，是为了不让这个随机失败把后面批次的 CI 弄红。

条目：
1. 假时钟（SPEC 13.19，读这一节即可）：`test/scenario-g.test.ts` 与 `test/scenario-n.test.ts` 的假时钟改为「指纹冻结之前 `now()` 的返回值不变；冻结之后由注入的 `setTimer` 每次按传入的间隔推进」，
   删掉每调用一次 `now()` 就自增的写法。两个文件共用的辅助函数可以抽到 `test/support/` 下
2. 场景 G 加一个慢开局的用例：fake worker 在冻结指纹之前用 `setImmediate` 让出事件循环 40 万次，断言 journal 里有 `worker.idling`、没有 `worker.stalled`。
   R1 实测：这个用例在旧时钟下必然失败（假时钟走到 300012 毫秒），在新时钟下恰好在 1000 毫秒判空转
3. `test/invariants.test.ts` 加「`test/scenario-g.test.ts` 与 `test/scenario-n.test.ts` 不含 `+= stepMs`」

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 两个场景连跑三遍都通过 | `for i in 1 2 3; do npm test -- test/scenario-g.test.ts test/scenario-n.test.ts \|\| exit 1; done` | exit 0 |
| 自增时钟已删掉 | `! grep -qE "\+= stepMs" test/scenario-g.test.ts test/scenario-n.test.ts` | exit 0 |
| 慢开局用例断言没有判成卡死 | `grep -qE "worker\.stalled" test/scenario-g.test.ts` | exit 0 |
| 不变量同步 | `grep -qE "stepMs" test/invariants.test.ts` | exit 0 |

额外禁止：
- 改动任何受保护路径
- 改动 `src/` 下任何文件（活性检测本身没有问题）
- 为了让测试过而删除或跳过任何测试
- 为了让验收命令通过而改注释或字面（铁律 26）；新增依赖

## v04-b13 上报原因写对、BLOCK 后的重跑说清原因、单批次 run_id 去掉连字符

优先级：42　依赖：v04-b11

v04-b11 两次运行暴露的三处。规格见 SPEC 13.17（三段各对应一个条目）。结论都不变：sha 校验不过仍是上报 BLOCK，本批次只改「怎么报」和「重跑时怎么说」。

条目：
1. sha 校验分三步报（SPEC 13.17 第一段；现有校验在 `src/run.ts` 里报 `is not a descendant of base_sha` 的那一处）：先解析 `head_sha` 与 `claims.commits` 的每一项，
   解析不了报 `does not resolve to a commit`；再分别报「不是 base 的后代」「不是 HEAD 的祖先」；git 命令本身失败不得再被 `.catch(() => false)` 当成「不是祖先」，照旧上报并写 git 的报错原文
2. BLOCK 后的重跑（SPEC 13.17 第二段；`src/run.ts` 的 `batchHistory` 里拼 `interrupted_at` 的地方，`src/roles/worker.ts` 的 `renderInterruptSection`）：
   上一轮是 BLOCK 且不是被信号阶梯掐掉的，结束原因写 `escalated` 或 `blocked`，「上一轮中断」一节加一行「上一轮结论：」并写原因原文，不写「请从 `git log` 核实」那一句；真正的中断写法不变
3. 单批次 run_id（SPEC 13.17 第三段）：`src/cli.ts` 的 `runIdAt` 改为 `r-YYYYMMDDHHMMSS`，函数名与导出不变，现有测试里的字面同步。
   新建 `test/report-sha.test.ts`，用 `test/support/sandbox.ts` 的 `Sandbox` 让 fake runner 跑真实的 `collie run`：report 写一个不存在的 40 位 sha → 退出码 20、`escalated.reason` 含 `does not resolve to a commit`；
   sha 存在但不是 base 的后代；同一批次紧接着再跑一次 → task 的 `interrupted_at` 含 `escalated`、正文含「上一轮结论：」与上一轮的原因原文、不含「请从」；被判空转掐掉的中断写法不变（对照）；`runIdAt` 的格式。
   `test/invariants.test.ts` 加「`src/run.ts` 含 `does not resolve to a commit`」

验收标准：

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

额外禁止：
- 改动任何受保护路径
- 为了让测试过而删除或跳过任何测试（把测试里旧格式的 run_id 字面改成新格式不算）
- 为了让验收命令通过而改注释或字面（铁律 26）
- 改动规则 1~10 的判定与上报的结论（sha 校验不过仍是 BLOCK）；改动放行判定、各项阈值；新增依赖

## v04-b14 裁定提交的 CI 在取证后补查一次

优先级：43　依赖：v04-b13

队列里上一条裁定提交总是几秒前才推送的，启动核查查不到结果；第三次队列里 `76a8622` 的 CI 红了，journal 里没有痕迹。规格见 SPEC 13.18、12.1、3.6。
依赖写 v04-b13 只是为了排在它之后（两批都动 `run.ts`），没有功能上的依赖。

条目：
1. 补查（SPEC 13.18；启动核查是 `src/run.ts` 里记 `ci.verdict_commit` 的那一段，原条文在 12.1）：启动核查得到 `pending` 或 `no_runs` 时记住这个 sha，本次运行取证结束后再 `queryCi` 一次；
   有结论照 12.1 记事件，`failure` / `cancelled` 打印同一行 `warning: previous verdict commit …`；同一个 sha 一次运行至多记一次；上报路径不补查
2. 事件字段（SPEC 13.18、3.6）：`ci.verdict_commit` 加可选字段 `when`，启动时查到的写 `startup`，补查到的写 `after_evidence`。补查只记事件与警告：不改结论、不影响放行判定、不停队列
3. 新建 `test/verdict-ci-recheck.test.ts`，用 `Sandbox` 加测试注入的 `fetch`（按 sha 与调用次数返回不同结果）：启动时 pending、取证后 success → 一条 `when: after_evidence` 的事件；
   取证后 failure → 有事件、输出含 `previous verdict commit`、本次运行的结论与退出码不变；两次都 pending → 不记；启动时已有结论 → 只有一条 `when: startup`；上报路径不补查。
   `test/invariants.test.ts` 加「`src/run.ts` 含 `after_evidence`」

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 补查专项测试通过 | `npm test -- test/verdict-ci-recheck.test.ts` | exit 0 |
| 专项测试不少于 5 个 | `grep -cE "^\s+it\(" test/verdict-ci-recheck.test.ts \| grep -qE "^([5-9]\|[1-9][0-9])$"` | exit 0 |
| 补查标记进代码与测试（不看注释行） | `grep -vE "^\s*(//\|\*\|/\*)" src/run.ts \| grep -qE "after_evidence" && grep -qE "after_evidence" test/verdict-ci-recheck.test.ts` | exit 0 |
| 测试断言了警告文字 | `grep -qE "previous verdict commit" test/verdict-ci-recheck.test.ts` | exit 0 |
| 不变量同步 | `grep -qE "after_evidence" test/invariants.test.ts` | exit 0 |

额外禁止：
- 改动任何受保护路径
- 为了让测试过而删除或跳过任何测试
- 为了让验收命令通过而改注释或字面（铁律 26）
- 让补查改变任何结论、放行判定或退出码；改动规则 1~10、各项阈值；新增依赖

## v04-b15 collie why 的结论行：规则号从降级事件推，推不出显示「规则 —」

优先级：44　依赖：v04-b09

`why` 在没有 `run.finished.rule` 的 journal 上，结论行是 `结论：FIX，`，逗号后面是空的（操作员在真实 journal 上跑出来的）。规格见 SPEC 13.20。

条目：
1. 取值（SPEC 13.20，读这一节即可；现有实现是 `src/view.ts` 的 `projectWhy` 与 `conclusionLine`）：规则号依次取 `run.finished.rule`、该运行最后一条 `verdict.downgraded.rule`，都没有显示 `规则 —`；
   原因依次取 `run.finished.reason`、同一条 `verdict.downgraded.reason`，都没有就不写；结论行不得以逗号结尾；`--json` 的 `rule` / `reason` 按同样的顺序取值
2. `test/why.test.ts` 加用例：没有 `rule` 但有规则 9 的 `verdict.downgraded` → 结论行含 `规则 9`；两者都没有 → 含 `规则 —` 且不以逗号结尾；带 `rule` 的运行输出不变；`--json` 的取值。
   这里可以手写夹具（要测的就是旧 journal 的形态，fake runner 跑不出来），事件字段只能用 SPEC 3.6 写明的
3. `test/invariants.test.ts` 加「`src/view.ts` 含 `规则 —`」

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| why 专项测试通过 | `npm test -- test/why.test.ts` | exit 0 |
| 缺规则号的写法进代码与测试（不看注释行） | `grep -vE "^\s*(//\|\*\|/\*)" src/view.ts \| grep -qE "规则 —" && grep -qE "规则 —" test/why.test.ts` | exit 0 |
| 测试覆盖从降级事件推出规则 9 | `grep -qE "规则 9" test/why.test.ts` | exit 0 |
| 不变量同步 | `grep -qE "规则 —" test/invariants.test.ts` | exit 0 |

额外禁止：
- 改动任何受保护路径
- 为了让测试过而删除或跳过任何测试
- 为了让验收命令通过而改注释或字面（铁律 26）
- 改动 `run.ts`、`gate.ts`、`arbiter.ts`、规则 1~10；改动 `show`、`status`、`timeline`、`watch` 的输出；让 `why` 写任何文件；新增依赖

## v04-b16 report 里的 sha 解析不了改判为声称不符：FIX 并自动重跑

优先级：45　依赖：v04-b13

所有者 2026-11-13 裁定（SPEC 13.16、13.21）：report 的 `head_sha` / `commits` 解析不了时不再上报 BLOCK 停队列，改判 FIX、由队列自动重跑。
v04-b13 已把这项检查拆成三步，本批次只改第 1 步的去向。

条目：
1. 改判（SPEC 13.21「判定」一段；仲裁原文在 4.3；现有检查是 v04-b13 在 `src/run.ts` 里报 `does not resolve to a commit` 的那一处）：解析不了时记 `claim.mismatch`
   （field / claimed / actual 为 `unresolvable`，不带 rule），不拉起 reviewer，结论 FIX、退出码 10，progress 写一条记录并照常提交推送；「不是后代」「不是祖先」与 git 命令失败仍是上报 BLOCK
2. 重跑（SPEC 13.21「重跑」一段；`src/run.ts` 的 `batchHistory` FIX 分支与 `renderFixSection`）：「上一轮判 FIX」一节加小节「声称不符」，列出上一轮每条 `claim.mismatch`；
   上一轮没有 `reviewer.verdict` 时不读 `verdict.md`，提交清单取 `base_sha..HEAD` 的 worker 代码提交。`--continue` 下按普通 FIX 计入 `fix_max` 并重跑，不加新的队列分支
3. 测试：`test/report-sha.test.ts`（v04-b13 新建）里「不存在的 sha → 退出码 20」那一条改成新行为，并补：journal 有 `claim.mismatch`（actual 为 `unresolvable`）、没有 `reviewer.started` 与 `escalated`；
   `--continue` 下第 1 次写错、第 2 次写对 → PASS 且队列继续，第 2 次的 `queue.batch_started.why` 是 `fix_retry`、task 含「声称不符」与写错的那个 sha；
   仓库里留着更早一轮的 `verdict.md` 时 task 不引用它的 gaps；连续写错超过 `fix_max` → 退出码 20；「不是后代」仍是退出码 20。
   `test/invariants.test.ts` 加「`src/run.ts` 含 `unresolvable`」

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| sha 校验专项测试通过 | `npm test -- test/report-sha.test.ts` | exit 0 |
| 专项测试不少于 9 个 | `grep -cE "^\s+it\(" test/report-sha.test.ts \| grep -qE "^(9\|[1-9][0-9])$"` | exit 0 |
| 改判进代码与测试（不看注释行） | `grep -vE "^\s*(//\|\*\|/\*)" src/run.ts \| grep -qE "unresolvable" && grep -qE "unresolvable" test/report-sha.test.ts` | exit 0 |
| 测试断言了声称不符事件与自动重跑 | `grep -qE "claim\.mismatch" test/report-sha.test.ts && grep -qE "fix_retry" test/report-sha.test.ts` | exit 0 |
| 重跑说明进 task 生成与测试（不看注释行） | `grep -vE "^\s*(//\|\*\|/\*)" src/run.ts \| grep -qE "声称不符" && grep -qE "声称不符" test/report-sha.test.ts` | exit 0 |
| 不变量同步 | `grep -qE "unresolvable" test/invariants.test.ts` | exit 0 |

额外禁止：
- 改动任何受保护路径
- 为了让测试过而删除或跳过任何测试（把 v04-b13 那条「不存在的 sha → 退出码 20」的断言改成新行为不算）
- 为了让验收命令通过而改注释或字面（铁律 26）
- 改动规则 1~10 的判定；让「不是后代」「不是祖先」或其他上报路径变成 FIX；改动放行判定、`fix_max` 与各项阈值；新增依赖

## v04-b17 why / timeline 补齐 journal 里已有的数据：reviewer 花费、模型、用时、token、head_sha、裁定提交 CI

优先级：46　依赖：v04-b16

第四次队列的汇报第一次只用四个命令写成，留下的缺口里有五条的数据其实已经在 journal 里，只是命令没显示；其中花费少算了 reviewer（约 15%）。
另有 v04-b16 的一处偏离：sha 解析不了的 FIX 写了 `rule: 0`，`why` 显示成「规则 0：规则 0」。规格见 SPEC 13.23（读这一节和 13.4 即可）。

条目：
1. `src/view.ts`（SPEC 13.23 前两段；timeline 的 `run_end` 与按版本汇总，`projectWhy` / `formatWhy` / `WhyAttempt`）：一次运行的花费 = worker + reviewer 的 `cost_usd`，只加有的，两者都没有才算缺数据；
   `why` 补 worker 的模型、用时、token，reviewer 的模型、轮数、花费、用时，`head_sha`，本次运行的 `ci.verdict_commit`，每个 attempt 一行 `cost: worker=… reviewer=… total=…`，以及对应的 `--json` 字段
2. 声称不符的结论行与 R2 的那一处（SPEC 13.23 后两段）：`view.ts` 里 reason 以「声称不符：」开头且没有 rule 时写 `结论：FIX，<reason>`；`src/run.ts` 的 `finish` 只在规则号 1~10 时写 `rule`。
   `run.ts` 只许改这一处，不改 sha 校验、仲裁和队列的任何逻辑
3. 测试：`test/why.test.ts` 与 `test/timeline.test.ts` 各加用例，至少一组数据用 `Sandbox` 让 fake runner 跑真实的 `collie run` 产生（fake runner 的 `result` 能脚本化 `costUsd` / `numTurns` / `durationMs` / `usage`）：
   timeline 的花费等于 worker 与 reviewer 之和、只有 worker 有花费时等于 worker 的；why 的四处与 `--json` 字段；sha 写错的那次运行结论行含「声称不符」、不含「规则 0」与「规则 —」。
   `test/report-sha.test.ts` 加断言：sha 解析不了时 `run.finished` 没有 `rule` 字段。`test/invariants.test.ts` 加「`src/view.ts` 含 `ci.verdict_commit`」

本批次不应改动 `test/invariants.test.ts` 已有的任何数值上下限。

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 投影专项测试通过 | `npm test -- test/why.test.ts test/timeline.test.ts test/report-sha.test.ts` | exit 0 |
| why 显示裁定提交 CI（不看注释行） | `grep -vE "^\s*(//\|\*\|/\*)" src/view.ts \| grep -qE "ci\.verdict_commit" && grep -qE "ci\.verdict_commit" test/why.test.ts` | exit 0 |
| why 显示模型（不看注释行） | `grep -vE "^\s*(//\|\*\|/\*)" src/view.ts \| grep -qE "model=" && grep -qE "model=" test/why.test.ts` | exit 0 |
| timeline 测试覆盖 reviewer 花费 | `grep -qE "reviewer\.finished" test/timeline.test.ts` | exit 0 |
| 声称不符的结论行有测试 | `grep -qE "声称不符" test/why.test.ts` | exit 0 |
| sha 写错时 run.finished 不带 rule | `grep -qE "not\.toHaveProperty\(.rule.\)" test/report-sha.test.ts` | exit 0 |
| 不变量同步 | `grep -qE "ci\.verdict_commit" test/invariants.test.ts` | exit 0 |

额外禁止：
- 改动任何受保护路径
- 为了让测试过而删除或跳过任何测试
- 为了让验收命令通过而改注释或字面（铁律 26）
- 新增事件或字段；读取 `stream.ndjson` 或 `report.md`；让四个命令写任何文件
- `run.ts` 除条目 3 那一处外的任何改动；改动规则 1~10、放行判定、各项阈值；新增依赖

## v045-b01 开跑前检查与 audit 并进队列：collie preflight、queue.preflight、audit 不符停表

优先级：47　依赖：v04-b17

SPEC 第 14 章「收掉操作员」的第一批：把操作员每轮手工做的开跑前检查和 `audit` 做进 R2。规格见 SPEC 14.1（读这一节；停表的现有写法在 12.3，事件字段表在 3.6）。改的是 R2，要等固定版本前移才生效。

条目：
1. `collie preflight [--smoke] [--json]`（SPEC 14.1 第一段）：新建 `src/preflight.ts`，检查项 `worktree_clean` / `remote_in_sync` / `ci_token` / `disk_free`，`--smoke` 时加 `runner` / `ci_query`（复用现有 `smoke` 的两步，不要另写一套）；`ci_token` 复用 `run.ts` 的 `readCiTokenChecked`（现有不变量：只有 `run.ts` 与 `evidence.ts` 访问 `.token_file`，不要为此放宽它）；
   `limits.min_free_mb` 进配置 schema（可选，缺省 1024；**不要改** `.collie/collie.toml` 与 `templates/collie.toml`，它们是受保护路径 / 由 R1 同步）；可用空间的取数函数经 `CliDeps` 注入。`cli.ts` 只做接线
2. 队列与 audit（SPEC 14.1 后两段）：`run --continue` 在选第一个批次之前做不带 `--smoke` 的检查，记 `queue.preflight`，没过记 `queue.finished`（reason `preflight_failed`）、退出码 1、不签发 task；单批次模式不自动检查。
   把 `cli.ts` 里 `audit` 的核对逻辑抽成两处共用的函数，reviewer 结束后记 `audit.result`（批次 journal）；`--continue` 下 `mismatch` 记 `queue.paused`（reasons 含 `audit_mismatch`）并停，退出码 30。`collie audit` 的输出与退出码不变
3. 测试：新建 `test/preflight.test.ts`（每个检查项的通过与失败、心跳存在时脏工作区不算失败、本地落后于远端、`--smoke` 两项、`--json`、队列开头没过时没有 `batch.task_written` 且退出码 1、单批次模式不检查）与
   `test/queue-audit.test.ts`（`match` 放行、`mismatch` 在 PASS 与 FIX 两种裁决下都停且退出码 30、`no_init` 不停、没有 reviewer 的运行不记）。用 `test/support/sandbox.ts` 的 `Sandbox`，不得依赖真实 home 目录与真实磁盘余量。
   现有 `--continue` 测试若因工作区不干净而失败，改它的准备步骤（先提交），不得为此放宽检查。`test/invariants.test.ts` 加「`src/run.ts` 含 `queue.preflight`」「`src/schema/index.ts` 含 `audit.result`」

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 两个专项测试通过 | `npm test -- test/preflight.test.ts test/queue-audit.test.ts` | exit 0 |
| preflight 测试不少于 8 个 | `grep -cE "^\s+it\(" test/preflight.test.ts \| grep -qE "^([8-9]\|[1-9][0-9])$"` | exit 0 |
| audit 入队列测试不少于 4 个 | `grep -cE "^\s+it\(" test/queue-audit.test.ts \| grep -qE "^([4-9]\|[1-9][0-9])$"` | exit 0 |
| 命令已接线并列出检查项 | `npx tsx src/cli.ts preflight 2>&1 \| grep -qE "worktree_clean"` | exit 0 |
| 队列开头记检查结果（不看注释行） | `grep -vE "^\s*(//\|\*\|/\*)" src/run.ts \| grep -qE "queue\.preflight" && grep -qE "queue\.preflight" src/schema/index.ts` | exit 0 |
| audit 不符会停表（不看注释行） | `grep -vE "^\s*(//\|\*\|/\*)" src/run.ts \| grep -qE "audit_mismatch" && grep -qE "audit_mismatch" test/queue-audit.test.ts` | exit 0 |
| 磁盘阈值进配置 schema | `grep -qE "min_free_mb" src/schema/index.ts` | exit 0 |
| 不变量同步 | `grep -qE "queue\.preflight" test/invariants.test.ts` | exit 0 |

额外禁止：
- 改动任何受保护路径（含 `.collie/collie.toml`）；改动 `templates/collie.toml`
- 为了让测试过而删除或跳过任何测试
- 为了让验收命令通过而改注释或字面（铁律 26）
- 改动规则 1~10 与放行判定的六项；让 audit 的结果改变任何结论或 backlog 状态；改动单批次模式的启动条件；新增依赖

## v045-b02 collie report：把一次队列运行写成 Markdown 汇报

优先级：48　依赖：v045-b01

操作员每轮手写的队列汇报，改由命令从 journal 生成。规格见 SPEC 14.2（读这一节；取值口径在 13.13 与 13.23）。只读命令，不改 R2。

条目：
1. `src/view.ts` 加 `projectReport` 与 `formatReport`（SPEC 14.2）：七节固定、顺序固定，取不到的写 `—`；第 3 节的 attempt、用时、花费复用现有的推算函数，不另写一套；第 5 节复用 `projectWhy` / `formatWhy`，第 6 节复用 `show --queue` 的逐行格式，第 7 节复用 `status` 的队列段
2. `collie report [--queue <q_run_id>] [--json]`（SPEC 14.2）：缺省取最近一次队列运行；退出码 0 有数据 / 2 本机没有队列运行的 journal 或指定的队列号不存在。`cli.ts` 只做接线；不写任何文件
3. 新建 `test/report.test.ts`：至少两组数据用 `Sandbox` 让 fake runner 跑真实的 `collie run --continue`（一组两个批次连续 PASS，一组先 FIX 后 PASS；fake runner 的 `result` 能脚本化花费与轮数），
   断言七个标题都在且顺序对、「实际经过」表的行数与 attempt / 结论 / 合计花费对、`打扰：` 那一行的数字对；另测：没有 `queue.preflight` 的旧 journal 第 2 节写 `—`、两个退出码、`--json` 是合法 JSON。
   `test/invariants.test.ts` 加「`src/view.ts` 含 `projectReport`」

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| report 专项测试通过 | `npm test -- test/report.test.ts` | exit 0 |
| 专项测试不少于 6 个 | `grep -cE "^\s+it\(" test/report.test.ts \| grep -qE "^([6-9]\|[1-9][0-9])$"` | exit 0 |
| 专项测试含真实运行的夹具 | `grep -qE "Sandbox\.create" test/report.test.ts` | exit 0 |
| 没有队列数据时退出码 2 | `npx tsx src/cli.ts report; test $? -eq 2` | exit 0 |
| 投影函数进代码与测试（不看注释行） | `grep -vE "^\s*(//\|\*\|/\*)" src/view.ts \| grep -qE "projectReport" && grep -qE "projectReport" test/report.test.ts` | exit 0 |
| 投影模块仍然不写文件（不看注释行） | `! grep -vE "^\s*(//\|\*\|/\*)" src/view.ts \| grep -qE "writeFileSync\|appendFileSync"` | exit 0 |
| 不变量同步 | `grep -qE "projectReport" test/invariants.test.ts` | exit 0 |

额外禁止：
- 改动任何受保护路径
- 为了让测试过而删除或跳过任何测试
- 为了让验收命令通过而改注释或字面（铁律 26）
- 改动 `run.ts`、`gate.ts`、`arbiter.ts`；改动 `status`、`timeline`、`why`、`watch`、`show` 的输出；读取 `stream.ndjson` 或 `report.md`；让 `report` 写任何文件；新增依赖

## v045-b03 通知与交接协议：notify 模块、next.md 的键值行、下一步动作的判定

优先级：49　依赖：v045-b02

`collie follow`（下一批）要用的两块：发通知，以及读懂 `docs/ops/next.md`。规格见 SPEC 14.3（读这一节）。本批次不写循环、不起子进程。

条目：
1. 通知（SPEC 14.3 第一段）：配置 schema 加可选的 `[notify] webhook_file`（**不要改** `.collie/collie.toml` 与 `templates/collie.toml`）；新建 `src/notify.ts`，`fetch` 由调用方传入；`collie notify <文本>`，`cli.ts` 只做接线。
   地址不得出现在返回值、报错、日志与任何输出里
2. 交接协议（SPEC 14.3 第二段的两张表）：新建 `src/handoff.ts`，`parseNext(text)` 与 `decide(next, state)`，纯函数：不 import `node:fs` / `node:child_process`，不读时钟，不用定时器
3. 新建 `test/notify.test.ts`（没配、文件不存在、2xx、非 2xx、`fetch` 抛错各一条，并断言任何返回值与输出都不含地址）与 `test/handoff.test.ts`
   （三种状态各自的必填键、重复的键、sha 格式不对、`批次上限` 不是正整数、键值行出现在第一个 `## ` 之后不算、SPEC 14.3 判定表的每一行）。
   `test/invariants.test.ts` 加「`src/handoff.ts` 不 import `node:fs` / `node:child_process`」「`src/notify.ts` 存在」

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 两个专项测试通过 | `npm test -- test/notify.test.ts test/handoff.test.ts` | exit 0 |
| 协议测试不少于 10 个 | `grep -cE "^\s+it\(" test/handoff.test.ts \| grep -qE "^[1-9][0-9]$"` | exit 0 |
| 通知测试不少于 5 个 | `grep -cE "^\s+it\(" test/notify.test.ts \| grep -qE "^([5-9]\|[1-9][0-9])$"` | exit 0 |
| 协议模块是纯函数（不看注释行） | `test -f src/handoff.ts && ! grep -vE "^\s*(//\|\*\|/\*)" src/handoff.ts \| grep -qE "node:fs\|node:child_process\|setTimeout\|setInterval\|Date\.now"` | exit 0 |
| 有测试断言地址不外泄 | `grep -qE "not\.toContain" test/notify.test.ts` | exit 0 |
| 没配置时跳过而不是报错 | `HOME=$(mktemp -d) npx tsx src/cli.ts notify "acceptance" 2>&1 \| grep -qE "skipped"` | exit 0 |
| 通知配置进 schema | `grep -qE "webhook_file" src/schema/index.ts` | exit 0 |
| 不变量同步 | `grep -qE "handoff" test/invariants.test.ts` | exit 0 |

额外禁止：
- 改动任何受保护路径（含 `.collie/collie.toml`）；改动 `templates/collie.toml`
- 为了让测试过而删除或跳过任何测试
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里向真实网络发请求；让通知地址出现在任何输出、事件或报错里；改动 `run.ts`、`gate.ts`、`arbiter.ts`；新增依赖

## v045-b04 collie follow：常驻循环，按 next.md 开跑、交汇报、发通知

优先级：50　依赖：v045-b03

操作员那一侧最后剩下的常驻命令。规格见 SPEC 14.4 与 14.5（读这两节；协议与判定表在 14.3，已由 v045-b03 实现为 `src/handoff.ts`）。

条目：
1. 新建 `src/follow.ts`（SPEC 14.4）：循环与 `--once` / `--dry-run` / `--interval` / `--timeout`；每圈 pull、读 `docs/ops/next.md`、用 `handoff.ts` 判定、执行动作；状态落在 `.collie/follow.json`。
   时钟、睡眠、起子进程（一个 `(参数, cwd) → 退出码与输出` 的函数）、发通知都由参数注入，缺省实现才用真实的。`--dry-run` 只打印 `action: …`，不 pull、不起子进程、不写文件、不发通知
2. 「跑一轮」的八步（SPEC 14.4）与边界（SPEC 14.5）：固定版本目录按 sha 一个一个建、不在原地切换；`preflight --smoke` 没过不记为已处理；汇报只提交 `docs/ops/queue-<q_run_id>.md` 这一个文件、提交信息 `ops: report queue <q_run_id>`；
   `report` 失败时写最小汇报；推送失败下一圈先重试。`collie follow` 接线进 `cli.ts`；`.collie/follow.json` 加进 `.gitignore` 与 `collie init` 的忽略清单
3. 新建 `test/follow.test.ts`，用 `Sandbox`，起子进程一律用注入的假函数（可以在进程内调用 `box.cli`），时钟与睡眠用注入的，不用真实定时器：`开跑` → 依次起 `preflight`、`run`、`report`，仓库里出现汇报文件与 `ops:` 提交且已推送、
   发了「队列结束」通知、`handledBase` 已记；同一个 `基准提交` 第二圈不再跑；preflight 没过 → 只通知一次、下一圈重试；`等所有者裁定` 只通知一次；`收工` 通知后退出；格式错只通知一次；
   `基准提交` 不是 `HEAD` 的祖先不跑；`--dry-run` 什么副作用都没有；`report` 失败时有最小汇报。`test/invariants.test.ts` 加「`src/follow.ts` 存在且用了 `handoff.ts`」

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| follow 专项测试通过 | `npm test -- test/follow.test.ts` | exit 0 |
| 专项测试不少于 9 个 | `grep -cE "^\s+it\(" test/follow.test.ts \| grep -qE "^(9\|[1-9][0-9])$"` | exit 0 |
| 专项测试用 Sandbox | `grep -qE "Sandbox\.create" test/follow.test.ts` | exit 0 |
| 专项测试不用真实定时器 | `test -f test/follow.test.ts && ! grep -qE "setInterval\|setTimeout\(" test/follow.test.ts` | exit 0 |
| 命令已接线且有 dry-run | `npx tsx src/cli.ts follow --help 2>&1 \| grep -qE "dry-run"` | exit 0 |
| 汇报用 ops 前缀提交（不看注释行） | `grep -vE "^\s*(//\|\*\|/\*)" src/follow.ts \| grep -qE "ops: report queue"` | exit 0 |
| 状态文件不进仓库 | `grep -qE "follow\.json" .gitignore` | exit 0 |
| 不变量同步 | `grep -qE "follow\.ts" test/invariants.test.ts` | exit 0 |

额外禁止：
- 改动任何受保护路径
- 为了让测试过而删除或跳过任何测试
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner、真实的 `npx` 子进程或真实网络请求；自己在工作区里运行不带 `--dry-run` 的 `collie follow`（它会按 next.md 再起一个队列）
- 让 `follow` 写 `docs/ops/queue-*.md` 之外的仓库文件、改 backlog、改结论；改动 `run.ts`、`gate.ts`、`arbiter.ts`；新增依赖

## v045-b05 collie follow 加固：已处理落在仓库里、失败只通知一次并退避、通知不带路径、子进程与汇报附录

优先级：51　依赖：v045-b04

`collie follow`（v045-b04）四批都过了验收，但有 3 处会在第一次真实使用时出事：环境坏着时每圈都通知并调一次模型、汇报推送失败后把整个队列重跑一遍、`npm ci` 实际没执行。
操作员读代码发现，R1 用假时钟驱动真实循环逐条实测属实。规格见 SPEC 14.9（读这一节；原设计在 14.4，协议与判定表在 14.3，实测记录在 14.8）。

条目：
1. 「已处理」与推送（SPEC 14.9 第 1 条）：汇报提交信息加 `(base <基准提交前 12 位>)`；「已处理」= 本地 `git log <基准提交>..HEAD` 里有这样一条提交，或 `follow.json` 的 `handledBase` 等于它；
   起了 `run --continue` 之后不论后面哪一步失败都记 `handledBase`；本地领先远端时每圈先推送，失败通知一次，推上去之后不再提。
   **连续 3 圈、第 1 圈推送失败的情形下，`run --continue` 只起 1 次，仓库里只有 1 份汇报**
2. 失败只通知一次并退避、通知内容、子进程（SPEC 14.9 第 2~4 条）：按 14.9 的通知键去重；preflight 或固定版本目录失败后退避 5 分钟起、每次翻倍、最长 60 分钟，退避期内不起子进程；
   preflight 用 `--json` 只列失败项名字；队列结束的原因取 journal 的 `queue.finished.reason`；注入的子进程函数收完整命令行，`npm ci` 不经 `npx tsx`；缺省实现边跑边转发输出、内存里只留末 200 行。
   **preflight 连续失败 3 圈（间隔 60 秒）时：`preflight` 起 1 次、通知 1 条；假时钟推进到 5 分钟之后的那一圈才起第 2 次，通知仍是 1 条**
3. 汇报附录、目录注入与测试（SPEC 14.9 第 5~7 条）：汇报末尾加 `## 运行环境（follow 记录）`；固定版本目录的父目录可注入；`test/support/sandbox.ts` 生成配置时去掉 `webhook_file` 一行。
   `test/follow.test.ts` 改写并补齐：上面两条加粗的情形各一条，必须真的走多圈并断言子进程与通知的次数；基准提交不是祖先连续 3 圈只通知 1 条、不起子进程；`follow.json` 删掉后同一个基准不再跑；
   preflight 失败的通知不含 `/`；通知里的原因来自 journal（`limit` 不得写成 `exhausted`）；锁文件不同时子进程收到的命令行第一个词是 `npm`；汇报里有附录一节；
   跑完后注入的父目录之外没有新建固定版本目录。`test/invariants.test.ts` 加「`src/follow.ts` 不含 `execFileSync`」

本批次不改 `src/handoff.ts`、`src/run.ts`、`src/preflight.ts`。不应改动 `test/invariants.test.ts` 已有的任何数值上下限。

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| follow 专项测试通过 | `npm test -- test/follow.test.ts` | exit 0 |
| 专项测试不少于 16 个 | `grep -cE "^\s+it\(" test/follow.test.ts \| grep -qE "^(1[6-9]\|[2-9][0-9])$"` | exit 0 |
| 专项测试不在系统临时目录留下固定版本目录 | `d=$(mktemp -d) && TMPDIR=$d npm test -- test/follow.test.ts && ! ls -d "$d"/collie-r2-* >/dev/null 2>&1` | exit 0 |
| 退避进了代码与测试（不看注释行） | `grep -vE "^\s*(//\|\*\|/\*)" src/follow.ts \| grep -qE "notBefore" && grep -qE "notBefore" test/follow.test.ts` | exit 0 |
| 汇报提交带基准提交、汇报带附录（不看注释行） | `grep -vE "^\s*(//\|\*\|/\*)" src/follow.ts \| grep -qE "\(base " && grep -vE "^\s*(//\|\*\|/\*)" src/follow.ts \| grep -qE "follow 记录"` | exit 0 |
| 子进程不再用带缓冲上限的同步调用（不看注释行） | `! grep -vE "^\s*(//\|\*\|/\*)" src/follow.ts \| grep -qE "execFileSync"` | exit 0 |
| 沙箱不读真实机器的通知地址 | `grep -qE "webhook_file" test/support/sandbox.ts` | exit 0 |
| 不变量同步 | `grep -qE "execFileSync" test/invariants.test.ts` | exit 0 |

额外禁止：
- 改动任何受保护路径（含 `.collie/collie.toml`）；改动 `templates/collie.toml`
- 为了让测试过而删除或跳过任何测试（改写 `test/follow.test.ts` 里与新行为冲突的旧用例不算）
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner、真实的 `npx` 子进程或真实网络请求；自己在工作区里运行不带 `--dry-run` 的 `collie follow`
- 让 `follow` 写 `docs/ops/queue-*.md` 之外的仓库文件、改 backlog、改结论；改动 `handoff.ts`、`run.ts`、`gate.ts`、`arbiter.ts`；新增依赖

## v045-b06 collie report 与 why 补齐：开始与墙钟、合计、轮数上限、tool.denied、批次状态、CI 链接

优先级：52　依赖：v045-b02

操作员把手写汇报和 `collie report` 生成的那份逐条对照，19 处差异里有几处数据其实已在 journal 里；其中「开始」与「墙钟」在真实数据上永远是 `—`，因为实现去找一条 R2 从来不写的事件，而测试手写了它。
规格见 SPEC 14.10（读这一节；`report` 的章节结构在 14.2，取值口径在 13.13 与 13.23）。

条目：
1. 开始、墙钟与合计（SPEC 14.10 前两条；`src/view.ts` 的 `projectReport` / `formatReport` 与 timeline 的投影）：开始 = 队列 journal 第一条事件的时间；`timeline` 输出 `queue_start` 节点；
   「实际经过」表加合计行；删除 `test/report.test.ts` 里手工写进队列 journal 的 `run.started`。
   **开始时间、墙钟、合计这三处的断言必须用 `Sandbox` 让 fake runner 真实跑出来的 `run --continue`，不得手写事件**
2. 轮数上限（SPEC 14.10 第三条）：`src/run.ts` 的 `worker.started` 与 `reviewer.started` 追加可选字段 `max_turns`（取自配置）——`run.ts` 只许改这两处记录；
   `why` 与 `report` 显示 `<轮数>/<上限>`，相等时加「（到上限）」；没有上限数据的旧 journal 只显示轮数
3. 其余补齐与测试（SPEC 14.10 第四、五条）：`report` 的「放行与打扰」加 `tool.denied` 合计与每条 `batch.status`；`why` 的 `ci:` 行加 `polls=` 与 `run_url`，`ci.verdict_commit:` 行加 `run_url`。
   `test/report.test.ts`、`test/why.test.ts`、`test/timeline.test.ts`、`test/journal-fields.test.ts` 各补用例。`test/invariants.test.ts` 加「`src/run.ts` 含 `max_turns`」

本批次不应改动 `test/invariants.test.ts` 已有的任何数值上下限。

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 四个专项测试通过 | `npm test -- test/report.test.ts test/why.test.ts test/timeline.test.ts test/journal-fields.test.ts` | exit 0 |
| 测试里不再手写队列 journal 的 run.started | `! grep -A3 -E "run_id: 'q-" test/report.test.ts \| grep -qE "run\.started"` | exit 0 |
| 轮数上限进 journal 且有测试（不看注释行） | `grep -vE "^\s*(//\|\*\|/\*)" src/run.ts \| grep -qE "max_turns" && grep -qE "max_turns" test/journal-fields.test.ts` | exit 0 |
| 到上限的标注进代码与测试（不看注释行） | `grep -vE "^\s*(//\|\*\|/\*)" src/view.ts \| grep -qE "到上限" && grep -qE "到上限" test/why.test.ts` | exit 0 |
| why 显示 CI 轮询次数（不看注释行） | `grep -vE "^\s*(//\|\*\|/\*)" src/view.ts \| grep -qE "polls=" && grep -qE "polls=" test/why.test.ts` | exit 0 |
| timeline 测试覆盖队列开始节点 | `grep -qE "queue_start" test/timeline.test.ts && grep -qE "Sandbox\.create" test/timeline.test.ts` | exit 0 |
| 不变量同步 | `grep -qE "max_turns" test/invariants.test.ts` | exit 0 |

额外禁止：
- 改动任何受保护路径
- 为了让测试过而删除或跳过任何测试（删掉手写的那条队列 `run.started` 夹具并改用真实运行不算）
- 为了让验收命令通过而改注释或字面（铁律 26）
- `run.ts` 除条目 2 那两处记录外的任何改动；改动 `gate.ts`、`arbiter.ts`、`follow.ts`；读取 `stream.ndjson` 或 `report.md`；让 `report` / `why` / `timeline` 写任何文件；新增依赖

## v045-b07 变异检查：删掉规则、放行条件或受保护路径里的任意一处，测试必须变红

优先级：53　依赖：v04-b17

R1 在 `6cc1bd5` 上逐个删掉仲裁规则、放行条件、受保护清单里的一处判断，共 44 处：7 处漏过各模块自己的单元测试，其中 6 处连全量测试也发现不了。规格见 SPEC 第 15 章（读这一章即可）。
依赖写 v04-b17 只是为了不被别的批次挡住，没有功能上的依赖。

条目：
1. 补测试（SPEC 15.2）：`test/evidence.test.ts` 让 `PROTECTED_PATHS` 的 9 项每一项都有一条行为用例（worker 的提交改了该路径下的文件 → `spec_diff_lines` 大于 0）；
   `test/arbiter.test.ts` 加规则 6 的两条单边用例（只有通过数不符、只有失败数不符）和规则 9「只有 CI 结论不是 success」的用例。只加测试，不改 `src/arbiter.ts`、`src/gate.ts`、`src/evidence.ts`
2. 变异检查（SPEC 15.1）：新建 `scripts/mutation.ts`，`package.json` 加脚本 `test:mutation`（不并进 `test`，不改 `.github/`）。清单按 15.1 的 44 个名字写全；在系统临时目录的副本里改，不动工作区，结束后删掉副本；
   结果只有 `caught` / `survived` / `invalid` / `timeout` / `stale` 五种，超时与编译不过都不算被发现；支持 `--list` 与 `--only`
3. 测试基础设施（SPEC 15.3）与专项测试：`vitest.config.ts` 的 `testTimeout` 与 `hookTimeout` 改为 `120_000`；`test/invariants.test.ts` 里「只有 `run.ts` 与 `evidence.ts` 访问 `.token_file`」改成只看非注释行。
   新建 `test/mutation.test.ts`：只测判定函数与清单的形状（名字不重复、不少于 44 项、每项的原文在当前文件里恰好出现一次；测试进程全过 → `survived`，编译不过 → `invalid`，超时 → `timeout`，有断言失败 → `caught`），**不在里面跑变异**。
   `test/invariants.test.ts` 加「`package.json` 有 `test:mutation`」

本批次不应改动 `test/invariants.test.ts` 已有的任何数值上下限（把 `.token_file` 那条改成不看注释行不算）。

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 变异检查全部被发现 | `npm run test:mutation` | exit 0 |
| 清单不少于 44 项 | `npx tsx scripts/mutation.ts --list \| grep -c . \| grep -qE "^(4[4-9]\|[5-9][0-9]\|[1-9][0-9][0-9])$"` | exit 0 |
| 受保护清单每一项都在变异清单里 | `npx tsx scripts/mutation.ts --list \| grep -cE "^protected:" \| grep -qE "^(9\|[1-9][0-9])$"` | exit 0 |
| 原先漏过的三处规则条件现在被发现 | `npx tsx scripts/mutation.ts --only rule6-failed-count-half,rule6-passed-count-half,rule9-ci-third` | exit 0 |
| 判定函数的专项测试通过 | `npm test -- test/mutation.test.ts` | exit 0 |
| 超时放宽到 120 秒 | `grep -cE "(test\|hook)Timeout: 120_000" vitest.config.ts \| grep -qE "^2$"` | exit 0 |
| 不变量同步 | `grep -qE "test:mutation" test/invariants.test.ts` | exit 0 |

额外禁止：
- 改动任何受保护路径；改动 `.github/` 下任何文件
- 改动 `src/arbiter.ts`、`src/gate.ts`、`src/evidence.ts`（本批次只加测试与检查脚本）
- 为了让测试过而删除或跳过任何测试；为了让变异检查通过而从清单里去掉某一项、或把超时与编译不过算成被发现
- 为了让验收命令通过而改注释或字面（铁律 26）
- 把变异检查并进 `npm test`；让它改动工作区里的文件；新增依赖

## v045-b08 collie follow 的推送与收尾：每圈先同步、分叉时 rebase、汇报上了远端才通知、完整输出、npm ci 失败清目录

优先级：54　依赖：v045-b05

v045-b05 修好了三处，但还剩一处会让 `follow` 交不出汇报：推送失败一次之后，汇报提交永远不会再推（操作员实跑发现，R1 复测属实）；远端在队列期间多一个提交时本地会分叉，之后推送与拉取都一直失败。
R1 另外读出：汇报正文取自只留末 200 行的子进程输出，队列一长就会被截掉开头；`follow` 的拉取靠上游配置，测试沙箱没有上游，所以测试里拉取从来没成功过。规格见 SPEC 14.12（读这一节；现状与实测在 14.11，原设计在 14.4 与 14.9）。

条目：
1. 每圈先同步、通知等汇报上了远端才发（SPEC 14.12 第 1、2 条）：每圈在读 next.md 之前 `git fetch`，按「不领先 / 领先 / 分叉」三种情况处理，`fetch` / `pull` / `push` 都写明 `origin` 与 `main`、不依赖上游配置；分叉时只有本地多出来的全是 `ops: report queue` 提交才 `pull --rebase`，
   冲突就 `rebase --abort`；「队列结束」通知记进 `follow.json` 的 `pendingReport`，本地不再领先时才发、只发一次；删掉 `pendingPush`。
   **推送失败 3 圈 → 恢复远端 → 再走 3 圈之后：远端有汇报提交，本地不领先，`run --continue` 一共只起 1 次，「队列结束」通知只有 1 条、且出现在恢复之后；**
   **队列期间远端多了一个提交时：下一圈之后远端同时有那个提交与汇报提交，本地不领先也不落后，不发 `diverged` 通知**
2. 完整输出、固定版本目录、子进程起不来（SPEC 14.12 第 3、4 条）：注入的子进程函数多一个参数说明要完整输出还是只留末尾，留哪些行的逻辑写成不起子进程的函数；`report`、`report --json`、`preflight --json` 用完整输出；
   `npm ci` 退出码不是 0 时删掉固定版本目录、按 `pinned:<固定版本>` 通知一次并退避，下一次尝试重新建目录；缺省的子进程实现在程序不存在时返回退出码 127，不抛出
3. 小处与测试（SPEC 14.12 第 5 条与末段）：退避状态随基准提交清零；附录里写 `preflight：ok`。`test/follow.test.ts` 补齐：条目 1 两处加粗的情形各一条；
   本地有一个不是汇报的未推送提交且远端前进 → 不 rebase，3 圈只通知 1 条 `diverged`；rebase 冲突 → 放弃、仓库回到 rebase 之前、通知 1 条；留行的函数喂 500 行：完整模式 500 行都在、末尾模式只剩末 200 行；注入的子进程函数收到的模式：`report` / `report --json` / `preflight --json` 是完整，`run --continue` / `npm ci` 是末尾；
   远端有新提交而本地不领先 → 一圈之后本地 `HEAD` 等于远端、没有 `pull` 通知；
   `npm ci` 失败后目录不存在、之后成功能接着跑；用一个不存在的程序名调缺省的子进程实现（不会起任何进程）得到退出码 127；换了基准提交后不沿用上一个基准的退避。
   **每条多圈的用例都要断言实际走了几圈**（例如数注入的 `sleep` 被调了几次）。`test/invariants.test.ts` 加「`src/follow.ts` 不含 `pendingPush`」

本批次不改 `src/handoff.ts`、`src/run.ts`、`src/view.ts`、`src/preflight.ts`。不应改动 `test/invariants.test.ts` 已有的任何数值上下限。

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| follow 专项测试通过 | `npm test -- test/follow.test.ts` | exit 0 |
| 专项测试不少于 28 个 | `grep -cE "^\s+it\(" test/follow.test.ts \| grep -qE "^(2[8-9]\|[3-9][0-9])$"` | exit 0 |
| 专项测试不在系统临时目录留下固定版本目录 | `d=$(mktemp -d) && TMPDIR=$d npm test -- test/follow.test.ts && ! ls -d "$d"/collie-r2-* >/dev/null 2>&1` | exit 0 |
| 分叉时会 rebase，且有测试（不看注释行） | `grep -vE "^\s*(//\|\*\|/\*)" src/follow.ts \| grep -qE "rebase" && grep -qE "rebase" test/follow.test.ts` | exit 0 |
| 通知等汇报上了远端才发（不看注释行） | `grep -vE "^\s*(//\|\*\|/\*)" src/follow.ts \| grep -qE "pendingReport" && grep -qE "pendingReport" test/follow.test.ts` | exit 0 |
| 不再用的状态已删掉（不看注释行） | `! grep -vE "^\s*(//\|\*\|/\*)" src/follow.ts \| grep -qE "pendingPush"` | exit 0 |
| 不变量同步 | `grep -qE "pendingPush" test/invariants.test.ts` | exit 0 |

额外禁止：
- 改动任何受保护路径（含 `.collie/collie.toml`）；改动 `templates/collie.toml`、`eslint.config.js`、`vitest.config.ts`
- 为了让测试过而删除或跳过任何测试（改写 `test/follow.test.ts` 里与新行为冲突的旧用例不算）
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner、真实的 `npx` / `npm` 子进程或真实网络请求；自己在工作区里运行不带 `--dry-run` 的 `collie follow`
- 让 `follow` rebase 或改写汇报提交之外的任何提交；让它写 `docs/ops/queue-*.md` 之外的仓库文件；改动 `handoff.ts`、`run.ts`、`gate.ts`、`arbiter.ts`；新增依赖

## v045-b09 变异检查判定收紧：基线含类型检查、caught 看测试结果不看退出码、超时不算 invalid

优先级：55　依赖：v045-b07

变异检查（v045-b07）在两台机器上都是 44 项全部被发现，但它的判定比规格宽：测试进程只要非零退出就算被发现；基线不跑类型检查，工作区本身类型不过时每一项都报成 `invalid`（R1 实际碰到了）。
它之后可能成为每批必过的检查，先把判定收紧。规格见 SPEC 15.5（读这一节；原设计在 15.1，R1 碰到的情况在 14.11）。

条目：
1. 基线与判定（SPEC 15.5 前两条；`scripts/mutation.ts` 的 `runBaseline`、`runMutation`、`judgeExecResult`）：基线先跑整项目类型检查再跑相关测试，任何一步不过、或一个测试都没执行，立刻退出码 1 并在末行写 `mutation: baseline failed (<原因>)`；
   每一项用 vitest 的 JSON 报告判定：执行了测试且至少一个用例失败才是 `caught`，测试进程非零退出却没有用例失败算 `invalid`。判定写成不起子进程的纯函数，输入是 JSON 报告与退出信息。
   JSON 报告用 `--outputFile` 写到系统临时目录、读完删掉；不带它时 vitest 会在当前目录建 `.vitest/`，基线是在工作区里跑的，不能把工作区弄脏
2. 超时与末行（SPEC 15.5 后两条）：类型检查超时记 `timeout`；类型检查限 120 秒、测试进程限 180 秒；末行固定为 `mutation: caught <n> survived <n> invalid <n> timeout <n> stale <n>`，全部 `caught` 才退出码 0。
   清单的 44 项不动
3. `test/mutation.test.ts` 补齐（仍然**不在测试里跑变异**，只喂 JSON 报告样例）：有用例失败 → `caught`；全过 → `survived`；非零退出但失败用例数为 0 → `invalid`；执行的用例数为 0 → `invalid`；
   类型检查超时 → `timeout`；基线三种不过各一条；末行格式。`test/invariants.test.ts` 加「`scripts/mutation.ts` 含 `numFailedTests`」。
   顺带：`test/preflight.test.ts` 里「本地落后远端」那条用例建的 `collie-clone-*` 目录，用完删掉

本批次只改 `scripts/mutation.ts`、`test/mutation.test.ts`、`test/invariants.test.ts`、`test/preflight.test.ts`。不应改动 `test/invariants.test.ts` 已有的任何数值上下限。

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 判定函数的专项测试通过 | `npm test -- test/mutation.test.ts` | exit 0 |
| 专项测试不少于 18 个 | `grep -cE "^\s+it\(" test/mutation.test.ts \| grep -qE "^(1[8-9]\|[2-9][0-9])$"` | exit 0 |
| 判定看测试结果（不看注释行） | `grep -vE "^\s*(//\|\*\|/\*)" scripts/mutation.ts \| grep -qE "numFailedTests" && grep -qE "numFailedTests" test/mutation.test.ts` | exit 0 |
| 变异检查全部被发现、末行是固定格式、工作区里没有留下报告 | `out=$(npx tsx scripts/mutation.ts 2>&1) && printf '%s\n' "$out" \| tail -n 1 \| grep -qE "^mutation: caught [0-9]+ survived 0 invalid 0 timeout 0 stale 0$" && ! test -e .vitest` | exit 0 |
| preflight 的测试不在系统临时目录留下克隆目录 | `d=$(mktemp -d) && TMPDIR=$d npm test -- test/preflight.test.ts && ! ls -d "$d"/collie-clone-* >/dev/null 2>&1` | exit 0 |
| 清单仍不少于 44 项 | `npx tsx scripts/mutation.ts --list \| grep -c . \| grep -qE "^(4[4-9]\|[5-9][0-9]\|[1-9][0-9][0-9])$"` | exit 0 |
| 不变量同步 | `grep -qE "numFailedTests" test/invariants.test.ts` | exit 0 |

额外禁止：
- 改动任何受保护路径；改动 `.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`
- 改动 `src/` 下任何文件
- 为了让测试过而删除或跳过任何测试；为了让变异检查通过而从清单里去掉某一项、或把超时与编译不过算成被发现
- 为了让验收命令通过而改注释或字面（铁律 26）
- 把变异检查并进 `npm test`；让它改动工作区里的文件；新增依赖

## v045-b10 --max 只数通过的批次：FIX 重跑不占名额

优先级：56　依赖：v045-b01

SPEC 12.2 写的是「`--max N` 数的是 PASS 的批次，FIX 重跑不计」，实现数的是运行次数：第八次队列 `--max 2`，v045-b08 一次 FIX、一次 PASS 就到了上限，v045-b09 没有跑（R1 用假 runner 复现）。
本批次只改 R2 的这一处。规格见 SPEC 14.14（读这一节；原文在 12.2，经过在 14.13）。

条目：
1. `src/run.ts` 的队列循环：到数的判断改为「本次队列里结论是 PASS 的批次数达到 N」。FIX 重跑、规则 1 重跑、中断续跑都不占名额；
   `queue.finished.batches` 照旧列出每一次运行，`fix_max` 的计数与处理不变。
   **`--max 2`、两个批次、第一个先 FIX 再 PASS、第二个 PASS：两个批次都通过，`queue.finished` 的 reason 是 `limit`、`batches` 有 3 项；**
   **`--max 1`、同样的安排：第一个批次通过后停下，第二个仍是 `pending`，`batches` 有 2 项**
2. 新文件 `test/queue-limit.test.ts`：用 `FakeRunner` 跑真实的 `run --continue --max N`（照 `test/report.test.ts` 里「FIX then PASS」那一组的做法，不手写 journal），
   断言 backlog 的状态列、`queue.finished` 的 reason 与 `batches`、每条 `queue.batch_started` 的 why。条目 1 两处加粗的情形各一条；
   `--max 1`、一个批次的 FIX 次数超过 `fix_max` → 退出码 20、记了 `escalated`（reason `fix_max`），不是 `limit`；不带 `--max`、两个批次都一次通过 → 退出码 0、两个都是 `passed`。
   `test/invariants.test.ts` 加「`src/run.ts` 不含 `batchesRun.length >= ctx.max`」

本批次只改 `src/run.ts`、`test/queue-limit.test.ts`、`test/invariants.test.ts`。不应改动 `test/invariants.test.ts` 已有的任何数值上下限。

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| --max 的专项测试通过 | `npm test -- test/queue-limit.test.ts` | exit 0 |
| 专项测试不少于 4 个 | `grep -cE "^\s+it\(" test/queue-limit.test.ts \| grep -qE "^([4-9]\|[1-9][0-9])$"` | exit 0 |
| 专项测试跑的是真实队列 | `grep -qE "FakeRunner" test/queue-limit.test.ts && grep -qE -e "--max" test/queue-limit.test.ts` | exit 0 |
| 不再按运行次数到数（不看注释行） | `! grep -vE "^\s*(//\|\*\|/\*)" src/run.ts \| grep -qE "batchesRun\.length >= ctx\.max"` | exit 0 |
| 不变量同步 | `grep -qE "batchesRun" test/invariants.test.ts` | exit 0 |

额外禁止：
- 改动任何受保护路径；改动 `.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`
- 改动 `src/arbiter.ts`、`src/gate.ts`、`src/evidence.ts`、`src/follow.ts`、`src/view.ts`；改动 `fix_max` 的计数方式或 `queue.finished.batches` 的形状
- 为了让测试过而删除或跳过任何测试；改写已有用例的断言（本批次没有点名允许改写的旧用例；确实与 SPEC 14.14 冲突的，先在「偏离或疑问」里逐条列出）
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；新增依赖

## v045-b11 collie follow 的同步失败与汇报没提交成：补回连续失败通知、没提交成不说「看」

优先级：57　依赖：v045-b08

v045-b08 修好了推送，但把 SPEC 14.9 的「`git pull` 连续失败 3 圈通知一次」删掉了，守它的用例被改成不再断言这件事。R1 实测：远端不可达 5 圈、或本地落后而快进被挡住 4 圈，一条通知都没有，`follow` 一直按旧的 next.md 等着。
另一处：汇报提交失败时照样通知「队列结束，到对话里说看」，而仓库里没有汇报（R1 实测）。规格见 SPEC 14.15（读这一节；原要求在 14.9 第 2 条，同步的三种情况在 14.12 第 1 条，经过在 14.13）。

条目：
1. 同步失败要通知（SPEC 14.15 第 1 条）：一圈里 `git fetch` 失败、或需要拉取而 `git pull --ff-only` 失败，`follow.json` 的 `syncFailures` 加 1；连续 3 圈时通知一次（键 `pull`，文本 `[Collie] git pull 连续失败`）；
   哪一圈同步成功就把 `syncFailures` 清零并去掉 `pull` 这个已通知的键。推送失败的通知不变。
   **远端不可达 5 圈：「git pull 连续失败」只有 1 条，出现在第 3 圈；恢复远端走 1 圈后 `syncFailures` 为 0；再让远端不可达 3 圈：又通知 1 条，一共 2 条；**
   **本地落后而快进被一个未跟踪的同名文件挡住 3 圈：「git pull 连续失败」1 条**
2. 汇报没提交成（SPEC 14.15 第 2 条）：提交之后 `git status --porcelain -- <汇报文件>` 不为空，就不记 `pendingReport`，按键 `commit:<队列号>` 通知一次，
   文本含「汇报没能提交」、队列号与退出码，不含「到对话里说」；基准照样记为已处理，队列不重跑。提交成功时的行为不变
3. `test/follow.test.ts`：条目 1 两处加粗的情形各一条；条目 2 一条（用一个退出码 1 的 `pre-commit` 钩子让提交失败，走 3 圈：`run --continue` 只起 1 次，通知 1 条）。**每条都要断言实际走了几圈。**
   允许改写的旧用例只有三种：注释是 `// 20. SPEC 14.9 item 2` 的那条，改回断言「git pull 连续失败」的条数；「队列期间远端多一个提交」那条，补上圈数的断言；
   因为多了一条「git pull 连续失败」而通知总条数变了的断言。每一处都在「偏离或疑问」里列出用例名、原断言、现断言。
   `test/invariants.test.ts` 加「`src/follow.ts` 含 `syncFailures`」

本批次只改 `src/follow.ts`、`test/follow.test.ts`、`test/invariants.test.ts`。不应改动 `test/invariants.test.ts` 已有的任何数值上下限。

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| follow 专项测试通过 | `npm test -- test/follow.test.ts` | exit 0 |
| 专项测试不少于 33 个 | `grep -cE "^\s+it\(" test/follow.test.ts \| grep -qE "^(3[3-9]\|[4-9][0-9])$"` | exit 0 |
| 专项测试不在系统临时目录留下固定版本目录 | `d=$(mktemp -d) && TMPDIR=$d npm test -- test/follow.test.ts && ! ls -d "$d"/collie-r2-* >/dev/null 2>&1` | exit 0 |
| 同步失败有计数，且有测试（不看注释行） | `grep -vE "^\s*(//\|\*\|/\*)" src/follow.ts \| grep -qE "syncFailures" && grep -qE "syncFailures" test/follow.test.ts` | exit 0 |
| 连续失败的通知补回来了，且有测试断言它（不看注释行） | `grep -vE "^\s*(//\|\*\|/\*)" src/follow.ts \| grep -qE "git pull 连续失败" && grep -vE "^\s*(//\|\*\|/\*)" test/follow.test.ts \| grep -qE "git pull 连续失败"` | exit 0 |
| 汇报没提交成有通知，且有测试（不看注释行） | `grep -vE "^\s*(//\|\*\|/\*)" src/follow.ts \| grep -qE "汇报没能提交" && grep -vE "^\s*(//\|\*\|/\*)" test/follow.test.ts \| grep -qE "汇报没能提交"` | exit 0 |
| 不变量同步 | `grep -qE "syncFailures" test/invariants.test.ts` | exit 0 |

额外禁止：
- 改动任何受保护路径（含 `.collie/collie.toml`）；改动 `templates/collie.toml`、`.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`
- 为了让测试过而删除或跳过任何测试；改写条目 3 点名之外的任何已有断言
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner、真实的 `npx` / `npm` 子进程或真实网络请求；自己在工作区里运行不带 `--dry-run` 的 `collie follow`
- 改动 SPEC 14.12 的推送、rebase 与「汇报上了远端才通知」的行为；改动 `src/handoff.ts`、`src/run.ts`、`src/view.ts`、`src/preflight.ts`；新增依赖

## v045-b12 reviewer 拿不到任何一轮的汇报：工作目录里没有 report.md，取证范围排除信封目录

优先级：58　依赖：v045-b10

SPEC 3.5 写的是「reviewer 的 worktree 不含 `report.md`」，这只在第 1 次运行成立：FIX 重跑时上一轮的汇报提交排在新的 `head_sha` 之前，检出 `head_sha` 就带上了它。
v045-b11 因此被拦了 4 次（SPEC 14.16）。规格见 SPEC 14.18 第一部分（读这一部分；背景在 14.16，原要求在 3.5 末句与 4.2）。

条目：
1. `src/run.ts` 准备 `head_sha` 工作目录的地方：reviewer 开始工作时，目录里不存在 `.collie/batches/<本批次>/report.md`，第几次运行都一样。
   别的文件不动（本批次的 `task.md` 要留着），验收命令照旧在这个目录里跑。这件事只放在 `src/run.ts`，`src/roles/reviewer.ts` 的源码里仍然不得出现 `report.md` 字样。
   **同一个批次先 FIX 再 PASS：第 2 次运行的 `head_sha` 的树里有上一轮的 report.md（`git ls-tree` 查得到），而 reviewer 的工作目录里没有**
2. `src/roles/reviewer.ts` 的 `buildReviewerPrompt`：「取证范围」一节给出的两条命令改为带路径排除的写法，
   `git log <base>..<head> -- . ':(exclude).collie/batches'` 与 `git diff <base>..<head> -- . ':(exclude).collie/batches'`，
   并加一句「`.collie/batches/` 下是信封文件，不是 worker 的产出；只读本批次的 `task.md`」。`ReviewerInputSchema` 不加字段。
3. 新文件 `test/reviewer-rerun.test.ts`：用 `FakeRunner` 跑真实的 `run --continue`（照 `test/report.test.ts` 里「FIX then PASS」那一组的做法，不手写 journal），
   在两次 reviewer 场景里各记下 `ctx.cwd` 下那个文件在不在、本批次的 `task.md` 在不在，以及 `ctx.opts` 里的提示词。断言：
   汇报文件两次都不在；第 2 次的 `head_sha` 的树里它在（这是对照，没有它这条测试什么也证明不了）；`task.md` 两次都在；两次的提示词都含 `':(exclude).collie/batches'`。
   再加一条「第 1 次就 PASS」的。
   允许改写的旧用例只有一处：`test/reviewer-isolation.test.ts` 的 `contains the diff pointer, items, parsed commands verbatim and SPEC paths` 里断言取证范围原文的那一条，
   只许因为两条命令多了路径参数而改；改了就在「偏离或疑问」里列出原断言与现断言。同一文件的 `never reads a report or imports the worker role` 不许改。

本批次只改 `src/run.ts`、`src/roles/reviewer.ts`、`test/reviewer-rerun.test.ts`、`test/reviewer-isolation.test.ts`（仅上面点名的一条）。不应改动 `test/invariants.test.ts`。

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 重跑隔离的专项测试通过 | `npm test -- test/reviewer-rerun.test.ts` | exit 0 |
| 原有的隔离测试仍然通过 | `npm test -- test/reviewer-isolation.test.ts` | exit 0 |
| 专项测试不少于 3 个 | `grep -cE "^\s+it\(" test/reviewer-rerun.test.ts \| grep -qE "^([3-9]\|[1-9][0-9])$"` | exit 0 |
| 专项测试跑的是真实队列，且带对照 | `grep -qE "FakeRunner" test/reviewer-rerun.test.ts && grep -qE "ls-tree" test/reviewer-rerun.test.ts` | exit 0 |
| 提示词的路径排除有断言 | `grep -qF ":(exclude).collie/batches" test/reviewer-rerun.test.ts` | exit 0 |

额外禁止：
- 改动任何受保护路径；改动 `.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`
- 改动 `src/arbiter.ts`、`src/gate.ts`、`src/evidence.ts`、`src/follow.ts`、`src/view.ts`；给 `ReviewerInputSchema` 加字段；让 reviewer 以任何方式拿到汇报的内容
- 为了让测试过而删除或跳过任何测试；改写条目 3 点名之外的任何已有断言
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；新增依赖

## v045-b13 删除仲裁规则 4：reviewer 报的「声称不符」不再改裁定

优先级：59　依赖：v045-b10

所有者 2026-11-17 裁定删除规则 4（SPEC 14.17）。reviewer 按设计拿不到 worker 的声称，它报的「声称不符」只可能来自泄漏的汇报；v045-b11 两次被它从 PASS 降成 FIX。
规格见 SPEC 14.18 第二部分（读这一部分；规则表在 4.3，变异清单在 15.1）。

条目：
1. `src/arbiter.ts`：删掉规则 4 这一段。规则 5~10 的编号不变，4 空着。`src/schema/index.ts` 的 `VerdictSchema`：`claim_mismatches` 改为可选，缺省按空数组，`SCHEMA_VERSION` 不变；R2 不再读它。
   放行判定（`src/gate.ts`）不动：它的第 2 项数的是 R2 自己记的 `claim.mismatch`。旧 journal 里的 `rule: 4` 照常显示，`src/view.ts` 不动。
   **reviewer 判 PASS、`claim_mismatches` 非空、其余证据都好：结论是 PASS、规则 10、没有降级，队列照常放行并取下一个批次**
2. `scripts/mutation.ts`：清单去掉 `rule4-reviewer-mismatch` 与 `rule4-pass-to-fix`，共 42 项；其余 42 项的名字不动。
3. 测试。允许改写或删除的旧用例只有下面几处，每一处都在「偏离或疑问」里列出用例名、原断言、现断言：
   `test/arbiter.test.ts` 的 `arbiter: rule 4, reviewer-reported mismatches` 一组（2 条）删掉；`rule 3 beats rule 4` 改成「`claim_mismatches` 非空时规则 3 照常命中」；
   `rule 4 beats rule 5` 改成「`claim_mismatches` 非空、声称已推送而远端没有 → 规则 5」；`test/mutation.test.ts` 的 `has at least 44 items` 改为 42，末行格式那条里的示例数字可以跟着改。
   新增：`test/arbiter.test.ts` 里条目 1 加粗的情形，以及「reviewer 判 FIX、`claim_mismatches` 非空 → FIX、规则 10」；
   `test/reviewer.test.ts` 里「没有 `claim_mismatches` 字段的 verdict 能解析，取出来是空数组」；
   新文件 `test/no-rule4.test.ts`：用 `FakeRunner` 跑真实的 `run --continue`，两个批次，第一个的 reviewer 判 PASS 且 `claim_mismatches` 非空，第二个正常 PASS →
   退出码 0、两个批次都是 `passed`、第一个批次记了 `queue.gate_passed`、它的 journal 里没有 `verdict.downgraded`。
   `test/invariants.test.ts` 加「`src/arbiter.ts` 的非注释行不含 `claim_mismatches`」

本批次只改 `src/arbiter.ts`、`src/schema/index.ts`、`scripts/mutation.ts`、`test/arbiter.test.ts`、`test/reviewer.test.ts`、`test/mutation.test.ts`、`test/no-rule4.test.ts`、`test/invariants.test.ts`。
不应改动 `test/invariants.test.ts` 已有的任何数值上下限。

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 删除规则 4 的专项测试通过 | `npm test -- test/no-rule4.test.ts` | exit 0 |
| 仲裁、裁决解析、变异清单的测试通过 | `npm test -- test/arbiter.test.ts test/reviewer.test.ts test/mutation.test.ts` | exit 0 |
| 专项测试跑的是真实队列并断言了放行 | `grep -qE "FakeRunner" test/no-rule4.test.ts && grep -qE "gate_passed" test/no-rule4.test.ts` | exit 0 |
| 仲裁不再读 reviewer 报的声称不符（不看注释行） | `! grep -vE "^\s*(//\|\*\|/\*)" src/arbiter.ts \| grep -qE "claim_mismatches"` | exit 0 |
| 变异清单是 42 项 | `npx tsx scripts/mutation.ts --list \| grep -c . \| grep -qx 42` | exit 0 |
| 变异检查全部被发现，工作区里没有留下报告 | `out=$(npx tsx scripts/mutation.ts 2>&1) && printf '%s\n' "$out" \| tail -n 1 \| grep -qE "^mutation: caught 42 survived 0 invalid 0 timeout 0 stale 0$" && ! test -e .vitest` | exit 0 |
| 不变量同步 | `grep -qE "claim_mismatches" test/invariants.test.ts` | exit 0 |

额外禁止：
- 改动任何受保护路径；改动 `.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`
- 改动 `src/gate.ts`、`src/evidence.ts`、`src/run.ts`、`src/view.ts`、`src/follow.ts`；重排规则编号；改动规则 1~3、5~10 的任何判断
- 删除或跳过条目 3 点名之外的任何测试；改写点名之外的任何已有断言；从变异清单里去掉点名之外的项
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；新增依赖

## v045-b14 运行器：SDK 抛错之前已收到结果消息时，花费与轮数照常带回

优先级：60　依赖：v04-b17

第九次队列里有一次 reviewer 用到 61 轮结束，事件流里有带花费的结果消息，`reviewer.finished` 却只有 `exit_code`，花费与轮数没有进 journal（SPEC 14.16）。
规格见 SPEC 14.18 第三部分（读这一部分）。原因是 R1 读代码推断的：SDK 给出结果消息之后又抛了错，出错分支把已经收到的结果消息丢了。

条目：
1. `src/runner/claude.ts` 的 `run`：遍历 SDK 消息的循环抛错时，如果此前已经收到过结果消息，返回值里带上花费、轮数、token、会话号，
   结束原因按结果消息的类型映射（与正常结束时同一套，`error_max_turns` → `turns_exhausted`）。只多带数据，成败的判定不变：这条路径上退出码仍然非 0，不带 `finalText`。
   没收到过结果消息的，行为不变；被 signal 中止的，行为不变。
2. `test/runner-claude.test.ts`，用文件里已有的假 SDK 写法，新用例放进一组 `describe('claude runner: result message before the SDK throws', …)`：
   先给出 `error_max_turns` 的结果消息（带 `total_cost_usd` 与 `num_turns`）再抛错 → 返回值带这两个数、结束原因是 `turns_exhausted`、退出码非 0、没有 `finalText`；
   先给出别的出错类型的结果消息再抛错 → 花费与轮数带回、结束原因是 `error`；没有结果消息就抛错 → 和现在一样。
   已有用例一条都不改；如果你发现这条路径的现状和上面的推断对不上，停下，在「偏离或疑问」里写明你看到的，不要照猜的改。

本批次只改 `src/runner/claude.ts` 与 `test/runner-claude.test.ts`。不应改动 `test/invariants.test.ts`。

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 运行器的测试通过 | `npm test -- test/runner-claude.test.ts` | exit 0 |
| 新情形有一组测试 | `grep -qF "result message before the SDK throws" test/runner-claude.test.ts` | exit 0 |

额外禁止：
- 改动任何受保护路径；改动 `.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`
- 改动 `src/run.ts`、`src/arbiter.ts`、`src/gate.ts`、`src/evidence.ts`、`src/view.ts`、`src/follow.ts`；改动传给 SDK 的参数
- 为了让测试过而删除或跳过任何测试；改写任何已有断言
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；新增依赖

## v045-b15 运行器：一个会话给出多条结果消息时，轮数与 token 合计，成败不被后一条盖掉

优先级：61　依赖：v045-b14

第十次队列里，v045-b13 的 worker 会话给出了两条结果消息（66 轮结束一次，后台任务的通知又触发了 1 轮）。`src/runner/claude.ts` 只留最后一条，journal 把 67 轮记成了 1 轮（SPEC 14.19）。
规格见 SPEC 14.20 第一部分（读这一部分；v045-b14 加的出错分支在 14.18 第三部分）。

条目：
1. `src/runner/claude.ts` 的 `run`：遍历消息时把结果消息都留下，返回值按 SPEC 14.20 第一部分汇总：轮数与 token 的各个字段取各条之和；花费取最后一条带花费的；
   每一条都成功才算成功；结束原因：被软停的仍记 `stopped`，否则有一条是 `error_max_turns` 记 `turns_exhausted`，否则有一条失败记 `error`；
   `finalText` 只在成功时带，取各条的文本按先后用空行连起来；会话号取最后一条的。SDK 抛错的分支（v045-b14）用同一套汇总。只有一条结果消息时，返回值和现在完全一样。
   **两条成功的结果消息（66 轮、1 轮）：轮数 67，token 是两条之和，花费是第二条的，`finalText` 里两段文本都在、先后不变，退出码 0；**
   **第一条是 `error_max_turns`、第二条成功：退出码非 0，结束原因 `turns_exhausted`，没有 `finalText`，轮数是两条之和**
2. `test/runner-claude.test.ts`，用文件里已有的 `scripted` 写法，新用例放进一组 `describe('runner-claude: more than one result message', …)`：
   条目 1 两处加粗的情形各一条；三条结果消息的合计一条；先给两条结果消息再抛错 → 花费与合计的轮数照常带回，一条。
   另在 `claude runner: result message before the SDK throws` 一组里补一条：没有结果消息、但已经收到过带 `session_id` 的消息之后抛错 →
   不抛出，返回退出码非 0、那个会话号、结束原因 `error`（这是现有行为，以前没有测试守着）。已有用例一条都不改。

本批次只改 `src/runner/claude.ts` 与 `test/runner-claude.test.ts`。

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 运行器的测试通过 | `npm test -- test/runner-claude.test.ts` | exit 0 |
| 多条结果消息有一组测试 | `grep -qF "more than one result message" test/runner-claude.test.ts` | exit 0 |
| 不再只留最后一条（不看注释行） | `! grep -vE "^\s*(//\|\*\|/\*)" src/runner/claude.ts \| grep -qE "isResultMessage\(message\)\) result = message"` | exit 0 |

额外禁止：
- 改动任何受保护路径；改动 `.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`
- 改动 `src/run.ts`、`src/arbiter.ts`、`src/gate.ts`、`src/evidence.ts`、`src/view.ts`、`src/follow.ts`；改动传给 SDK 的参数
- 为了让测试过而删除或跳过任何测试；改写任何已有断言
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；新增依赖

## v045-b16 reviewer 的工作目录里，本批次的信封只留 task.md

优先级：62　依赖：v045-b12

v045-b12 只把 `report.md` 从 reviewer 的工作目录里拿掉了。重跑时上一轮的 `verdict.md` 还在：新的 reviewer 打开它，就看到上一位的完整判断（SPEC 14.19）。
规格见 SPEC 14.20 第二部分（读这一部分；v045-b12 的做法在 14.18 第一部分）。

条目：
1. `src/run.ts` 准备 `head_sha` 工作目录的地方（v045-b12 加的那两行）：改为把 `.collie/batches/<本批次>/` 下除 `task.md` 之外的文件都拿掉。
   别的批次的目录不动（有测试要读早期批次的信封）。验收命令照旧在这个目录里跑。旁边注释里的小节号 14.17 改成 14.18 与 14.20。
   **同一个批次先 FIX 再 PASS：第 2 次运行的 `head_sha` 的树里有上一轮的 `verdict.md` 与 `report.md`（`git ls-tree` 查得到），而 reviewer 的工作目录里那个目录下只有 `task.md`**
2. `test/reviewer-rerun.test.ts`：两次 reviewer 场景里再记下 `.collie/batches/<本批次>/` 的文件清单。加断言：
   第 2 次的树里有 `verdict.md`（对照，没有它这条测试什么也证明不了）；两次 reviewer 的工作目录里该目录的文件清单都恰好是 `['task.md']`；
   另一个批次目录里的文件没被拿掉（在沙箱里先提交一个 `.collie/batches/v99-other/report.md`，断言 reviewer 的工作目录里它还在）。已有的断言不改。

本批次只改 `src/run.ts` 与 `test/reviewer-rerun.test.ts`。不应改动 `test/invariants.test.ts`。

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 重跑隔离的专项测试通过 | `npm test -- test/reviewer-rerun.test.ts` | exit 0 |
| 原有的隔离测试仍然通过 | `npm test -- test/reviewer-isolation.test.ts` | exit 0 |
| 专项测试不少于 7 个 | `grep -cE "^\s+it\(" test/reviewer-rerun.test.ts \| grep -qE "^([7-9]\|[1-9][0-9])$"` | exit 0 |
| 别的批次目录不动，有断言 | `grep -qF "v99-other" test/reviewer-rerun.test.ts` | exit 0 |

额外禁止：
- 改动任何受保护路径；改动 `.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`
- 改动 `src/roles/reviewer.ts`、`src/arbiter.ts`、`src/gate.ts`、`src/evidence.ts`、`src/view.ts`、`src/follow.ts`；动别的批次的信封目录；让 reviewer 以任何方式拿到汇报或上一轮裁定的内容
- 为了让测试过而删除或跳过任何测试；改写任何已有断言
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；新增依赖

## v045-b17 测试：去掉低于全局值的局部超时

优先级：63　依赖：v045-b07

`vitest.config.ts` 的全局超时是 120 秒（v045-b07），但 `test/` 里还有写在 `describe`、钩子、用例上的 60 秒局部超时，局部的优先。
R1 的机器上两次全量测试的 4 处失败全是它们，没有一条断言失败（SPEC 14.19）。规格见 SPEC 14.20 第三部分。

条目：
1. `test/` 下所有写给 `describe` / `it` / `beforeAll` / `beforeEach` 的显式超时，数值小于 120 秒的，去掉，让它们用全局值。
   现有两种写法：`{ timeout: 60_000 }`（27 处，11 个文件）与写在钩子、用例末尾的 `}, 60_000);`（5 处，3 个文件）。
   不是超时的数字不动：夹具里的 `duration_ms: 60000`、`test/invariants.test.ts` 里的 `toBeGreaterThanOrEqual(30_000)`、`test/watch.test.ts` 里的 `advance(100_000)`。
   120 秒及以上的不动；除此之外不改任何测试内容。
   在「偏离或疑问」里列出每个文件改了几处；上面点名之外你还碰到别的数值的，写明是什么、动没动。

本批次只改 `test/` 下的测试文件。不应改动 `test/invariants.test.ts` 已有的任何断言。

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| describe 上没有 60 秒或 30 秒的局部超时 | `! grep -nE "timeout: (30\|60)_000" test/*.test.ts` | exit 0 |
| 钩子与用例末尾没有 60 秒或 30 秒的局部超时 | `! grep -nE "^\s*\}, (30\|60)_000\);" test/*.test.ts` | exit 0 |

额外禁止：
- 改动任何受保护路径；改动 `.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`；改动 `src/` 与 `scripts/` 下任何文件
- 删除或跳过任何测试；改写任何断言；改动夹具里的数据
- 为了让验收命令通过而改注释或字面（铁律 26）
- 新增依赖

## v046-b01 配置解耦：测试不再盯着本仓库 .collie/collie.toml 里的数值

优先级：64　依赖：v045-b13

分工改造的第 1 步（SPEC 第 16 章）。现在 7 个测试文件从仓库根加载 `.collie/collie.toml`，其中三处断言了它的具体数值。这个文件是受保护路径，worker 改不了，
所以本项目的任何阈值都没法单独调整。规格见 SPEC 16.9（读这一节；背景在 16.5）。

条目：
1. 新文件 `test/support/template-config.ts`，导出 `templateConfig()`：读 `templates/collie.toml`，把 `{{name}}`、`{{repo}}` 换成固定值后解析，返回配置对象。
   下面 7 个测试文件里从仓库自己的 `.collie/collie.toml` 取配置的地方（`loadConfig(repoRoot)` 与 `loadConfig(join(import.meta.dirname, '..'))`）都改用它：
   `test/cli.test.ts`、`test/config.test.ts`、`test/evidence.test.ts`、`test/reviewer-isolation.test.ts`、`test/reviewer.test.ts`、`test/runner-claude.test.ts`、`test/worker.test.ts`。
   `test/config.test.ts` 只留一条读本仓库配置的用例：它能加载、能通过校验，不断言任何数值。
   **做完之后的样子：把 `.collie/collie.toml` 里 reviewer 的 `max_turns` 改成 61、`wallclock_secs` 改成 3601，`npm test` 仍然全过。**
   **这一条由操作员在队列结束后在仓库副本里验证。你不要改 `.collie/collie.toml`，临时改也不行：它是受保护路径，留在工作区里会被拦停**
2. `scripts/mutation.ts`：临时副本不再复制 `.collie/`，改为复制 `templates/`（`test/evidence.test.ts` 改读模板之后不再需要本仓库的配置）。清单的 42 项不动。
3. 允许改写的旧用例只有下面几处，每一处都在「偏离或疑问」里列出用例名、原断言、现断言：
   `test/config.test.ts` 的 `config: the repository .collie/collie.toml` 一组（6 条）：断言的数值原样保留，一条不删、不放宽，只把对象从本仓库配置换成模板配置，组名相应改掉；`project` 那一条按 `templateConfig()` 填的固定值断言。
   `test/cli.test.ts` 的 `renders to exactly the SPEC 3.1 config the repository uses (no drift)`：改成「模板填上名字和仓库地址后能通过校验」，不再和本仓库配置比；`init derives the repo from an SSH origin…` 里的 `config.limits` 改成和模板配置的 `limits` 比。
   `test/reviewer.test.ts` 的 `launches role reviewer in root with the configured turns`：`maxTurns: 60` 改成取所用配置对象里的值。
   `test/invariants.test.ts` 加「`test/` 下的测试文件里，从仓库根加载配置的只有 `test/config.test.ts` 里的一处」。

本批次只改上面点名的 7 个测试文件、`test/support/template-config.ts`、`test/invariants.test.ts`、`scripts/mutation.ts`。不应改动 `test/invariants.test.ts` 已有的任何数值上下限。

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 改过的 7 个测试文件通过 | `npm test -- test/cli.test.ts test/config.test.ts test/evidence.test.ts test/reviewer-isolation.test.ts test/reviewer.test.ts test/runner-claude.test.ts test/worker.test.ts` | exit 0 |
| 取模板配置的函数存在，7 个文件都用上了 | `grep -qE "export function templateConfig" test/support/template-config.ts && grep -lE "templateConfig\(" test/*.test.ts \| grep -c . \| grep -qE "^([7-9]\|[1-9][0-9])$"` | exit 0 |
| 从仓库根加载配置的只剩 config.test.ts 里的一处 | `grep -nE "loadConfig\((repoRoot\|ROOT\|join\(import\.meta\.dirname)" test/*.test.ts \| grep -v "^test/invariants.test.ts:" \| grep -c . \| grep -qx 1 && grep -qE "loadConfig\((repoRoot\|ROOT\|join\(import\.meta\.dirname)" test/config.test.ts` | exit 0 |
| 变异副本复制模板，不再复制 .collie（不看注释行） | `! grep -vE "^\s*(//\|\*\|/\*)" scripts/mutation.ts \| grep -qF "'.collie'" && grep -qF "'templates'" scripts/mutation.ts` | exit 0 |
| 变异检查全部被发现，工作区里没有留下报告 | `out=$(npx tsx scripts/mutation.ts 2>&1) && printf '%s\n' "$out" \| tail -n 1 \| grep -qE "^mutation: caught 42 survived 0 invalid 0 timeout 0 stale 0$" && ! test -e .vitest` | exit 0 |
| 不变量同步 | `grep -qE "templateConfig\|template-config" test/invariants.test.ts` | exit 0 |

额外禁止：
- 改动任何受保护路径（含 `.collie/collie.toml`，临时改也不行）；改动 `templates/collie.toml`、`.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`
- 改动 `src/` 下任何文件；改动 `test/support/sandbox.ts`
- 删除或跳过任何测试；改写条目 3 点名之外的任何已有断言；把点名用例里断言的数值删掉或放宽；从变异清单里去掉任何一项
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；新增依赖

## v045-b18 运行器：失败的返回值一定带结束原因

优先级：65　依赖：v045-b15

v045-b15 之后，只有一条结果消息时返回值有 3 处和以前不同（操作员实测，R1 读代码确认，SPEC 14.21）。其中一处自相矛盾：成功的结果消息之后 SDK 抛错，退出码非 0 却没有结束原因。
规格见 SPEC 14.22（读这一节；三处的来历在 14.21）。

条目：
1. `src/runner/claude.ts` 的 `run`：SDK 抛错的分支里，汇总出来没有结束原因的，记 `error`（被软停的仍是 `stopped`，有 `error_max_turns` 的仍是 `turns_exhausted`）。
   另外两处是 v045-b15 带来、现在定为正确的行为，不改代码，只补测试：一条 `subtype: success` 但 `is_error: true` → 结束原因 `error`；成功但文本为空 → 不带 `finalText`。
   **做完之后：`run` 的任何返回值，只要退出码不是 0，就带结束原因**
2. `test/runner-claude.test.ts` 新加一组 `describe('runner-claude: failed runs always carry a stop reason', …)`，用文件里已有的假 SDK 写法：
   一条成功的结果消息之后抛错 → 退出码非 0、结束原因 `error`、花费与轮数照常带回、没有 `finalText`；
   两条成功的结果消息之后抛错 → 同上，轮数是合计；
   一条 `success` 但 `is_error: true` → 退出码非 0、结束原因 `error`、没有 `finalText`；
   一条成功、文本是空串 → 退出码 0、返回值里没有 `finalText` 这个键。
   已有用例一条都不改。R1 查过：现有用例里断言「没有结束原因」的只有两条，都是成功的情形（`two successful results…`、`three successful results…`），与本条不冲突；
   `two results then SDK throws…` 那一条没有断言结束原因。你发现还有别的用例与本条冲突，停下，在「偏离或疑问」里写明是哪一条，不要自己改。

本批次只改 `src/runner/claude.ts` 与 `test/runner-claude.test.ts`。

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 运行器的测试通过 | `npm test -- test/runner-claude.test.ts` | exit 0 |
| 新的一组测试在 | `grep -qF "failed runs always carry a stop reason" test/runner-claude.test.ts` | exit 0 |

额外禁止：
- 改动任何受保护路径；改动 `.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`
- 改动 `src/run.ts`、`src/arbiter.ts`、`src/gate.ts`、`src/evidence.ts`、`src/view.ts`、`src/follow.ts`；改动传给 SDK 的参数
- 为了让测试过而删除或跳过任何测试；改写任何已有断言
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；新增依赖

## v046-b02 测试 agent 的角色模块：角色、配置段、提示词（不接进队列）

优先级：66　依赖：v046-b01

分工改造第 3 步的第一块（SPEC 第 16 章）。测试 agent（角色 R6）在 worker 之前把条目里的情形写成验收测试。这一批只做它的角色模块，不动队列。
规格见 SPEC 16.10 的「v046-b02 角色模块」一段（读 16.10；它的手册是仓库根的 `AGENT-tester.md`，整体流程在 16.2）。

条目：
1. 角色与配置：`src/runner/index.ts` 的 `AgentRole` 加 `'tester'`；`src/schema/index.ts` 的配置里 `agent.tester` 是可选的一段，结构与 reviewer 段相同（含 `bash_deny`）；
   `templates/collie.toml` 加 `[agent.tester]`：`model = "claude-opus-4-6"`、`allowed_tools = ["Read", "Write", "Edit", "Glob", "Grep", "Bash"]`、`max_turns = 100`、
   `permission_mode = "bypassPermissions"`、`bash_deny` 与 reviewer 段的两条相同。没有这一段的配置照常能加载（本仓库的 `.collie/collie.toml` 就没有，本批次不许动它）。
2. `src/runner/claude.ts`：角色是 `tester` 时用 `agent.tester` 的白名单与轮数；`bash_deny` 的拦截对 tester 同样生效；reviewer 专有的「禁用写工具」不套到 tester 上（它要写文件）；
   配置里没有这一段而被要求以 tester 运行 → 抛出一个点名 `[agent.tester]` 的错误。worker 与 reviewer 的行为不变。
   **tester 运行一条匹配 `bash_deny` 的命令（`git commit -m x`）被拦下，和 reviewer 被拦时是同一条路径；传给 SDK 的 tester 工具清单里有 `Write` 与 `Edit`**
3. 新文件 `src/roles/tester.ts`，导出：`TESTER_MANUAL`（值是 `'AGENT-tester.md'`）；`TesterInputSchema`（严格对象，只有 `batch_id`、`items`、`spec_paths`、`out_dir` 四个字段，多一个字段就拒绝）；
   `buildTesterPrompt(input)`（提示词里有：批次号；条目原文，一字不改；要读的 SPEC 路径；输出目录与三个文件名 `new.test.ts`、`keep.test.ts`、`MAP.md`；自检用的两条 `npx vitest run <输出目录>/…` 命令）；
   `runTester(runner, cfg, input, cwd)`（以角色 `tester`、`agent.tester` 的工具与轮数、`cwd` 下的 `AGENT-tester.md` 作系统提示词拉起；配置里没有这一段时抛出点名 `[agent.tester]` 的错误）。
   新文件 `test/tester.test.ts` 用 `FakeRunner` 覆盖上面每一点；`test/runner-claude.test.ts` 加条目 2 的用例；
   `test/config.test.ts`：模板配置一组里加一条「有 tester 段」，另加一条「没有 tester 段的配置能加载」。
   允许改写的旧用例只有一处：`test/config.test.ts` 的 `equals the inline SPEC 3.1 fixture used by the error tests` 所用的内联配置 `VALID_TOML`，要跟着模板加上 tester 段（断言本身不变）；在「偏离或疑问」里写明。
   R1 查过：`reports an unknown agent role` 用的是 `[agent.auditor]`，仍然应当被拒绝，不要改。
   `test/invariants.test.ts` 加「`src/roles/tester.ts` 的源码里不出现 `report.md`」（它在 worker 之前运行，和 worker 的产出无关）

本批次只改 `src/runner/index.ts`、`src/schema/index.ts`、`src/runner/claude.ts`、`src/roles/tester.ts`、`templates/collie.toml`、`test/tester.test.ts`、`test/runner-claude.test.ts`、`test/config.test.ts`、`test/invariants.test.ts`。
类型检查因为 `AgentRole` 多了一个值而要求改这之外的文件时，可以改，在「偏离或疑问」里逐个列出。不应改动 `test/invariants.test.ts` 已有的任何断言。

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 角色模块、配置、运行器的测试通过 | `npm test -- test/tester.test.ts test/config.test.ts test/runner-claude.test.ts` | exit 0 |
| 角色模块的三个导出都在 | `grep -qE "export (async )?function runTester" src/roles/tester.ts && grep -qE "export function buildTesterPrompt" src/roles/tester.ts && grep -qE "export const TesterInputSchema" src/roles/tester.ts` | exit 0 |
| 角色模块的专项测试不少于 8 个 | `grep -cE "^\s+it(\.each)?\(" test/tester.test.ts \| grep -qE "^([8-9]\|[1-9][0-9])$"` | exit 0 |
| 模板里有 tester 段，角色类型里有 tester | `grep -qE "^\[agent\.tester\]" templates/collie.toml && grep -qF "'tester'" src/runner/index.ts` | exit 0 |
| 不变量同步 | `grep -qE "roles/tester" test/invariants.test.ts` | exit 0 |

额外禁止：
- 改动任何受保护路径（含 `.collie/collie.toml` 与 `AGENT-tester.md`）；改动 `.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`
- 改动 `src/run.ts`、`src/roles/reviewer.ts`、`src/roles/worker.ts`、`src/arbiter.ts`、`src/gate.ts`、`src/evidence.ts`、`src/view.ts`、`src/follow.ts`；把测试 agent 接进队列或加命令行子命令
- 为了让测试过而删除或跳过任何测试；改写条目 3 点名之外的任何已有断言；改动 worker、reviewer 两个角色的任何行为
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；新增依赖

## v046-b03 红检查：验收测试在没有实现时，新行为的全部失败、要保持的全部通过（不接进队列）

优先级：67　依赖：v046-b01

分工改造第 3 步的第二块（SPEC 第 16 章）。测试 agent 写完验收测试之后、worker 动手之前，要确认这些测试在现有代码上「新行为的全部失败、要保持的全部通过」。
这一批只做判定与执行两个函数，不动队列。规格见 SPEC 16.10 的「v046-b03 红检查」一段与判据那一条（读 16.10；vitest 的 JSON 报告在几种情形下的形状见 15.5）。

条目：
1. 新文件 `src/redcheck.ts`，导出 `judgeRedCheck(reports)`：输入是 `new.test.ts` 与 `keep.test.ts`（可以没有）各自的 vitest JSON 报告，输出 `{ ok, problems }`；
   `problems` 是原因清单，每条点名是哪个文件、哪条用例、为什么。判据：
   `new`：至少执行了一条用例，且每一条都失败；有通过的、跳过的、todo 的，或者文件加载不了（报告里一条用例都没有），都不过。
   `keep`：可以没有这个文件；有的话至少执行了一条且全部通过。
   它是纯函数：不起子进程、不读写文件。
2. 同一文件导出 `runRedCheck(tree, outDir, opts)`：在目录 `tree` 里对 `<outDir>/new.test.ts` 与（存在时）`<outDir>/keep.test.ts` 各跑一次 vitest，
   JSON 报告用 `--outputFile` 写到 `tree` 之外的系统临时目录（目录名以 `collie-redcheck-` 开头）、读完删掉（不带 `--outputFile` 时 vitest 会在当前目录建 `.vitest/`，SPEC 15.5）；
   `new.test.ts` 不存在算不过；超时算不过并写明是超时。超时的毫秒数与起子进程的函数都由调用方经 `opts` 传入，不在 `src/` 里写死数字。
   返回 `judgeRedCheck` 的结果，外加两个文件各执行了几条用例。
   **在一个临时目录里放真实的测试文件、用真实的 vitest 跑：`new` 里两条都失败 → 过；`new` 里一条失败一条通过 → 不过，原因里点名通过的那一条；**
   **`new` 一导入就报错 → 不过，原因写明文件加载失败；`new` 全失败而 `keep` 里有一条失败 → 不过，原因里点名那一条**
3. 新文件 `test/redcheck.test.ts`：`judgeRedCheck` 的每条判据各一条用例，喂报告样例（含跳过、todo、没有 `keep`、`keep` 一条用例都没有）；
   条目 2 加粗的四种情形各一条，必须用真实的 vitest 跑临时目录里的真实文件（临时目录建在系统临时目录下、名字以 `collie-redcheck-` 开头，把仓库的 `node_modules` 链进去，用完删掉；
   跑完系统临时目录里不留下任何 `collie-redcheck-*`，仓库里不出现 `.vitest/`）；超时一条，用注入的假子进程。
   `test/invariants.test.ts` 加「`src/redcheck.ts` 用了 `--outputFile`」

本批次只改 `src/redcheck.ts`、`test/redcheck.test.ts`、`test/invariants.test.ts`。不应改动 `test/invariants.test.ts` 已有的任何断言。

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 红检查的专项测试通过，仓库里没有留下报告 | `npm test -- test/redcheck.test.ts && ! test -e .vitest` | exit 0 |
| 专项测试不少于 12 个 | `grep -cE "^\s+it(\.each)?\(" test/redcheck.test.ts \| grep -qE "^(1[2-9]\|[2-9][0-9])$"` | exit 0 |
| 两个函数都导出了 | `grep -qE "export function judgeRedCheck" src/redcheck.ts && grep -qE "export (async )?function runRedCheck" src/redcheck.ts` | exit 0 |
| 专项测试不在系统临时目录留下东西 | `d=$(mktemp -d) && TMPDIR=$d npm test -- test/redcheck.test.ts && ! ls -d "$d"/collie-redcheck-* >/dev/null 2>&1` | exit 0 |
| 不变量同步 | `grep -qE "redcheck" test/invariants.test.ts` | exit 0 |

额外禁止：
- 改动任何受保护路径；改动 `.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`
- 改动 `src/run.ts`、`src/roles/`、`src/runner/`、`src/arbiter.ts`、`src/gate.ts`、`src/evidence.ts`、`src/view.ts`、`src/follow.ts`；把红检查接进队列或加命令行子命令
- 为了让测试过而删除或跳过任何测试；改写任何已有断言
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求（本批次的测试可以起真实的 vitest 子进程，别的不行）；新增依赖

## v046-b04 条目的「情形」写法：backlog 解析情形与接口，测试 agent 只拿情形（不接进队列）

优先级：68　依赖：v046-b02

分工改造第 3 步（SPEC 第 16 章）。v046-b02 把写给 worker 的条目原文交给了测试 agent，操作员实测提示词后指出两者直接冲突。这一批定下条目里「情形」的写法，并让测试 agent 只拿情形。不动队列。

条目：
1. 读 SPEC 16.11 的「条目怎么写」一段。`src/backlog.ts` 与 `src/schema/index.ts`：批次小节里可选的两节，标签各占一行，写法与现有的 `条目` 标签相同（全角或半角冒号都认）。
   第一节的标签是 `情形`，内容是无序列表，每条 `- <编号> [新] <文字>` 或 `- <编号> [保持] <文字>`，编号是一个大写字母加数字，缩进的续行并进同一条（与条目的续行规则相同）；
   第二节的标签是 `接口`，内容是无序列表，自由文字。解析结果里多出 `scenarios`（每条有 `id`、`kind`（`new` 或 `keep`）、`text`）与 `interfaces`（字符串数组）。
   没有对应小节时，解析结果里不出现这个键。拒绝并报出行号的：编号重复；类别不是这两个；条目不符合上面的格式；有 `情形` 标签而一条都没有；一条 `[新]` 都没有；同一节出现两次。
   `collie show <批次>`：有情形时，在验收命令之后打印情形（编号、类别、文字）与接口。
   **一个带两条 `[新]`、一条 `[保持]`、两条接口的批次：解析出 3 条情形，编号、类别、文字都对；同一份 backlog 里不带这两节的批次，解析结果与现在逐字段相同，没有多出键**
2. 读 SPEC 16.11 的「测试 agent 拿到什么」一段。`src/roles/tester.ts`：`TesterInputSchema` 去掉 `items`，换成 `scenarios`（非空，至少一条 `new`）与 `interfaces`（可以为空数组），仍是严格对象，共五个字段。
   `buildTesterPrompt`：「情形」一节分「新行为」「必须保持」两组列出，编号与文字一字不改；「接口」一节逐条列出，为空时写「（未指定）」；通篇不出现「条目」二字。
   输出一节：`new.test.ts` 与 `MAP.md` 总是列出；`keep.test.ts` 与它的自检命令只在有 `keep` 情形时出现；自检命令的最后加 `npm run lint` 与 `npm run typecheck` 两行。
   **只有 `[新]` 情形时，提示词通篇不出现 `keep.test.ts`；有 `[保持]` 情形时，它和它的自检命令都在**
3. 测试。新用例放进点名的组里：`test/backlog.test.ts` 新加一组 `describe('backlog: scenarios and interfaces', …)`，含条目 1 加粗的情形、续行、两种冒号；
   `test/backlog-reject.test.ts` 新加一组 `describe('backlog: rejects malformed scenarios', …)`，条目 1 列的六种拒绝各一条，都断言报错里的行号；
   `test/cli.test.ts` 加一条 `show prints scenarios and interfaces when the batch has them`；
   `test/tester.test.ts` 新加一组 `describe('tester: scenarios in the prompt', …)`，含条目 2 加粗的两种情形、两组的先后、接口为空时的写法、自检命令里有 lint 与 typecheck 两行。
   R1 查过现有用例：`test/backlog.test.ts` 的 `matches the hand-written expectation including status` 用整对象比较，所以「没有小节时不出现这个键」必须成立，这一条不许改；
   `test/tester.test.ts` 里会被碰到的只有：夹具函数 `validInput`（`items` 换成 `scenarios` 与 `interfaces`）、`accepts a valid input with exactly four fields`（改成五个字段）、
   `includes items verbatim`（改成情形的文字一字不改）、`includes self-check vitest commands`（按有没有 `keep` 情形分开断言）。只许改写这四处，每处在「偏离或疑问」里列出原断言与现断言。
   你发现还有别的现有用例与本批次冲突，停下，在「偏离或疑问」里写明是哪一条，不要自己改。
   `test/invariants.test.ts` 加「`src/roles/tester.ts` 的非注释行里不出现 `items`」

本批次只改 `src/backlog.ts`、`src/schema/index.ts`、`src/cli.ts`、`src/roles/tester.ts`、`test/backlog.test.ts`、`test/backlog-reject.test.ts`、`test/cli.test.ts`、`test/tester.test.ts`、`test/invariants.test.ts`。
类型检查因为批次多了可选字段而要求改这之外的文件时，可以改，在「偏离或疑问」里逐个列出。不应改动 `test/invariants.test.ts` 已有的任何断言。

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 解析、show、测试 agent 的测试通过 | `npm test -- test/backlog.test.ts test/backlog-reject.test.ts test/cli.test.ts test/tester.test.ts` | exit 0 |
| 解析的两组新用例在 | `grep -qF "backlog: scenarios and interfaces" test/backlog.test.ts && grep -qF "backlog: rejects malformed scenarios" test/backlog-reject.test.ts` | exit 0 |
| show 与提示词的新用例在 | `grep -qF "show prints scenarios and interfaces when the batch has them" test/cli.test.ts && grep -qF "tester: scenarios in the prompt" test/tester.test.ts` | exit 0 |
| 测试 agent 不再拿条目（不看注释行） | `! grep -vE "^\s*(//\|\*\|/\*)" src/roles/tester.ts \| grep -qE "\bitems\b"` | exit 0 |
| 不变量同步 | `grep -qE "roles/tester.*items\|items.*roles/tester" test/invariants.test.ts` | exit 0 |

额外禁止：
- 改动任何受保护路径（含 `docs/backlog.md`、`.collie/collie.toml`、`AGENT-tester.md`）；改动 `templates/collie.toml`、`.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`
- 改动 `src/run.ts`、`src/redcheck.ts`、`src/roles/worker.ts`、`src/roles/reviewer.ts`、`src/runner/`、`src/arbiter.ts`、`src/gate.ts`、`src/evidence.ts`、`src/view.ts`、`src/follow.ts`；把测试 agent 接进队列
- 改变不带这两节的批次的解析结果；为了让测试过而删除或跳过任何测试；改写条目 3 点名之外的任何已有断言
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；新增依赖

## v046-b05 红检查加静态检查：只多了验收测试的树上 lint 与类型检查必须通过（不接进队列）

优先级：69　依赖：v046-b03

分工改造第 3 步（SPEC 第 16 章）。worker 改不了验收测试；带着格式错误或 lint 错误的验收测试一旦进了主工作区，批次就永远过不了。所以红检查要在它们进去之前多查一步。不动队列。

条目：
1. 读 SPEC 16.11 的「红检查加静态检查」一段（判据原文在 16.10）。`src/redcheck.ts`：`RunRedCheckOpts` 加可选的 `staticCommands`（字符串数组，每条是一条 shell 命令）。
   两个测试文件跑完之后，在 `tree` 里逐条执行（经注入的 `spawn`，以 `sh -c <命令>` 的形式，超时用同一个 `timeoutMs`）；退出码不是 0 的记一条问题：
   `file` 是 `'static'`，`testName` 是命令原文，`reason` 含退出码与输出的末 20 行；超时的同样记一条，写明是超时。测试的问题与静态检查的问题一起返回，`ok` 要两边都没有问题才是 true。
   不传 `staticCommands` 时，行为与返回值和现在完全一样。测试文件自己超时的，照旧直接返回，不再跑静态命令。
   **`new.test.ts` 两条都失败，静态命令是一条退出码 3、输出里有 `boom` 的命令 → 不过，问题里有这条命令的原文、`3` 与 `boom`；换成退出码 0 的命令 → 过**
2. 同一文件：`keep.test.ts` 存在而没有拿到它的报告（vitest 没有写出报告文件）时，记一条问题 `file` 为 `'keep'`、`reason` 是 `no report produced`，不再当成没有这个文件而放行。
   `judgeRedCheck` 不改：它的「`keepReport` 为 null 即没有 keep 文件」的约定留着，这一处在 `runRedCheck` 里判断。
3. `test/redcheck.test.ts` 新加一组 `describe('runRedCheck: static commands and missing reports', …)`：
   条目 1 加粗的两种情形（真实的 vitest 跑真实的文件，静态命令真实执行）；两条静态命令、第一条过第二条不过 → 只有第二条的问题；
   测试的问题与静态检查的问题同时存在 → 两类都在返回值里；静态命令超时（注入的假子进程）；不传 `staticCommands` → 一条静态命令都没执行；
   条目 2：`keep.test.ts` 存在、注入的假子进程不写报告 → 不过，原因是 `no report produced`。
   R1 查过现有用例：`passes when keep report is null (no keep file)` 是 `judgeRedCheck` 的用例，本批次不改 `judgeRedCheck`，它不受影响；
   `fails on timeout with injected fake spawn` 测的是测试文件超时，行为不变。已有用例一条都不改；你发现有别的现有用例与本批次冲突，停下，在「偏离或疑问」里写明。
   `test/invariants.test.ts` 加「`src/redcheck.ts` 里有 `staticCommands`」

本批次只改 `src/redcheck.ts`、`test/redcheck.test.ts`、`test/invariants.test.ts`。不应改动 `test/invariants.test.ts` 已有的任何断言。

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 红检查的测试通过，仓库里没有留下报告 | `npm test -- test/redcheck.test.ts && ! test -e .vitest` | exit 0 |
| 新的一组用例在 | `grep -qF "runRedCheck: static commands and missing reports" test/redcheck.test.ts` | exit 0 |
| 静态检查与缺报告两处都进了代码与测试 | `grep -qF "staticCommands" src/redcheck.ts && grep -qF "staticCommands" test/redcheck.test.ts && grep -qF "no report produced" src/redcheck.ts && grep -qF "no report produced" test/redcheck.test.ts` | exit 0 |
| 测试不在系统临时目录留下东西 | `d=$(mktemp -d) && TMPDIR=$d npm test -- test/redcheck.test.ts && ! ls -d "$d"/collie-redcheck-* >/dev/null 2>&1` | exit 0 |
| 不变量同步 | `grep -qF "staticCommands" test/invariants.test.ts` | exit 0 |

额外禁止：
- 改动任何受保护路径；改动 `.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`
- 改动 `judgeRedCheck` 的判据；改动 `src/run.ts`、`src/roles/`、`src/runner/`、`src/backlog.ts`、`src/arbiter.ts`、`src/gate.ts`、`src/evidence.ts`、`src/view.ts`、`src/follow.ts`；把红检查接进队列
- 为了让测试过而删除或跳过任何测试；改写任何已有断言
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求（本批次的测试可以起真实的 vitest 子进程与真实的 `sh`，别的不行）；新增依赖

## v046-b06 情形与接口的列表允许空行；测试 agent 提示词两处小修（不接进队列）

优先级：70　依赖：v046-b04

操作员读代码并实测：情形列表里两条之间空一行，空行之后的情形被悄悄丢掉，不报错。另外，测试 agent 试跑时把整份 SPEC 读了一遍，汇报里的批次号也填错了。三处都是小修，不动队列。

条目：
1. 读 SPEC 14.24 里「操作员读代码查出来的」第一条与 16.12 的「v046-b06 小修」。`src/backlog.ts`：「情形」与「接口」两节的列表项之间允许空行。
   规则：空行跳过；符合格式的列表项接着算进同一个列表；紧跟在一条之后的缩进续行并进那一条（与现在相同）；遇到别的非空行（下一个标签、表格、说明文字）列表结束。
   「情形」一节里，空行之后出现一条不符合情形格式的无序列表项，报错并带那一行的行号（列表中间出现的本来就报错）。「条目」「额外禁止」两节的列表规则不动。
   **三条情形、每两条之间空一行：解析出 3 条，编号、类别、文字都对；两条情形之后空一行再跟一条 `- 这不是情形`：报错，行号是这一行；**
   **「接口」一节两条之间空一行：解析出 2 条**
2. 读 SPEC 14.24 里同一段的第二、三条。`src/roles/tester.ts` 的 `buildTesterPrompt`：
   小标题「需要自行阅读的 SPEC 章节」改成「可查阅的文件」，标题下加一句「情形里点名了小节号的，只读那一节；不要通读」，路径照旧逐条列出；
   「输出」一节加一句，写明汇报末尾 JSON 块里的 `batch_id` 填本批次的批次号（把批次号原样写出来）。
3. 测试。`test/backlog.test.ts` 新加一组 `describe('backlog: blank lines inside scenario and interface lists', …)`：条目 1 加粗的三种情形，外加「情形之后空一行再是 `接口` 标签 → 两节都解析对」；
   拒绝的那一条断言报错里的行号。`test/tester.test.ts` 新加一组 `describe('tester: prompt wording (v046-b06)', …)`：新小标题与那句话在、旧小标题不在；`batch_id` 那一句里有批次号。
   R1 查过现有用例：`test/tester.test.ts` 没有一条断言旧小标题的原文，`includes SPEC paths` 只断言路径字符串，不受影响；
   `test/backlog-reject.test.ts` 的 `rejects a scenario that does not match the expected format` 测的是列表中间的情形，行为不变；
   `test/backlog.test.ts` 的 `a batch without scenario/interface sections has no extra keys` 不受影响。已有用例一条都不改；你发现有别的现有用例与本批次冲突，停下，在「偏离或疑问」里写明是哪一条，不要自己改。

本批次只改 `src/backlog.ts`、`src/roles/tester.ts`、`test/backlog.test.ts`、`test/tester.test.ts`。不应改动 `test/invariants.test.ts`。

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 解析与提示词的测试通过 | `npm test -- test/backlog.test.ts test/backlog-reject.test.ts test/tester.test.ts` | exit 0 |
| 两组新用例在 | `grep -qF "backlog: blank lines inside scenario and interface lists" test/backlog.test.ts && grep -qF "tester: prompt wording (v046-b06)" test/tester.test.ts` | exit 0 |
| 旧小标题不在了（不看注释行） | `! grep -vE "^\s*(//\|\*\|/\*)" src/roles/tester.ts \| grep -qF "需要自行阅读的 SPEC 章节"` | exit 0 |

额外禁止：
- 改动任何受保护路径（含 `docs/backlog.md`、`AGENT-tester.md`）；改动 `templates/collie.toml`、`.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`
- 改动「条目」「额外禁止」「验收标准」三节的解析；改变不带「情形」「接口」两节的批次的解析结果
- 改动 `src/run.ts`、`src/redcheck.ts`、`src/roles/worker.ts`、`src/roles/reviewer.ts`、`src/runner/`、`src/arbiter.ts`、`src/gate.ts`、`src/evidence.ts`
- 为了让测试过而删除或跳过任何测试；改写任何已有断言
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；新增依赖

## v046-b07 配置加 tester_max 与静态检查命令、三个事件类型、test/acceptance 受保护（不接进队列）

优先级：71　依赖：v046-b05

分工改造第 3 步接线之前的铺垫（SPEC 第 16 章）：把接线要用到的配置项、事件类型和受保护路径先放好。这一批不调用测试 agent，不动队列的流程。

条目：
1. 读 SPEC 16.12 的「测试 agent 这一步怎么走」。`src/schema/index.ts` 与 `templates/collie.toml`：
   `[limits]` 加可选的 `tester_max`（正整数，缺省 2，缺省值的写法照 `grace_secs`）；`[verify]` 加可选的 `static`（非空字符串的数组；不写时解析结果里没有这个键）。
   模板里写上 `tester_max = 2` 与 `static = ["npm run lint", "npm run typecheck"]`，各带一行注释。本仓库的 `.collie/collie.toml` 不许动：它没有这两项，必须照常能加载。
   **没有这两项的配置能加载，`limits.tester_max` 是 2、`verify` 里没有 `static`；`tester_max = 0` 被拒绝，报错点名 `limits.tester_max`**
2. `src/schema/index.ts` 的事件类型加三个：`tester.started`、`tester.finished`、`redcheck.result`。这一批只加类型，不在任何地方记录它们。
3. `src/evidence.ts` 的受保护路径加 `test/acceptance`；`scripts/mutation.ts` 的清单加一项 `protected:test/acceptance`（写法照已有的 9 项），共 43 项。
   **worker 的提交在 `test/acceptance/` 下新增或改动一个文件：`spec_diff_lines` 大于 0**
   测试与允许改写的旧用例（只有下面四处，每处在「偏离或疑问」里列出原断言与现断言）：
   `test/config.test.ts` 的 `has the limits of SPEC 3.1`：期望对象里加 `tester_max: 2`；同一文件的内联配置 `VALID_TOML`：跟着模板加上 `static` 一行（`equals the inline SPEC 3.1 fixture…` 的断言本身不变）；
   `test/schema.test.ts` 的 `defines the v0.1 event types plus v0.2 and v0.3 types added so far`：个数 37 改成 40，并加三条 `toContain`；
   `test/mutation.test.ts` 的 `every protected path is in the mutation list`：9 改成 10。
   R1 查过：`test/cli.test.ts` 里比较 `limits` 的那条两边都取自模板，不受影响；`test/mutation.test.ts` 的 `has at least 42 items` 用的是「不少于」，不用改；
   没有现有测试在沙箱仓库里往 `test/acceptance/` 写文件。你发现有别的现有用例因此失败，停下，在「偏离或疑问」里写明是哪一条，不要自己改。
   新用例：`test/config.test.ts` 新加一组 `describe('config: tester_max and verify.static', …)`，含条目 1 加粗的情形、模板里两项的值；
   `test/evidence.test.ts` 加一条 `counts test/acceptance as protected (SPEC 16.12)`。
   `test/invariants.test.ts` 加「`src/evidence.ts` 里有 `test/acceptance`」

本批次只改 `src/schema/index.ts`、`src/evidence.ts`、`scripts/mutation.ts`、`templates/collie.toml`、`test/config.test.ts`、`test/schema.test.ts`、`test/evidence.test.ts`、`test/mutation.test.ts`、`test/invariants.test.ts`。
不应改动 `test/invariants.test.ts` 已有的任何断言。

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 配置、事件、取证、变异清单的测试通过 | `npm test -- test/config.test.ts test/schema.test.ts test/evidence.test.ts test/mutation.test.ts` | exit 0 |
| 配置的新用例组与受保护路径的新用例在 | `grep -qF "config: tester_max and verify.static" test/config.test.ts && grep -qF "counts test/acceptance as protected (SPEC 16.12)" test/evidence.test.ts` | exit 0 |
| 模板里有两项，本仓库的配置没有被动 | `grep -qE "^tester_max = 2" templates/collie.toml && grep -qE "^static = " templates/collie.toml && ! grep -qE "tester_max\|^static = " .collie/collie.toml` | exit 0 |
| 变异清单是 43 项 | `npx tsx scripts/mutation.ts --list \| grep -c . \| grep -qx 43` | exit 0 |
| 变异检查全部被发现，工作区里没有留下报告 | `out=$(npx tsx scripts/mutation.ts 2>&1) && printf '%s\n' "$out" \| tail -n 1 \| grep -qE "^mutation: caught 43 survived 0 invalid 0 timeout 0 stale 0$" && ! test -e .vitest` | exit 0 |
| 不变量同步 | `grep -qF "test/acceptance" test/invariants.test.ts` | exit 0 |

额外禁止：
- 改动任何受保护路径（含 `.collie/collie.toml`）；改动 `.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`
- 改动 `src/run.ts`、`src/redcheck.ts`、`src/roles/`、`src/runner/`、`src/arbiter.ts`、`src/gate.ts`、`src/backlog.ts`、`src/view.ts`、`src/follow.ts`；在任何地方记录新加的三个事件；在仓库里建 `test/acceptance/` 目录
- 为了让测试过而删除或跳过任何测试；改写条目 3 点名之外的任何已有断言；从变异清单里去掉任何一项
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；新增依赖

## v046-b08 测试 agent 这一步的模块：拉起、红检查、重写、只取走点名的文件（不接进队列）

优先级：72　依赖：v046-b06, v046-b07

分工改造第 3 步接线之前的铺垫（SPEC 第 16 章）：把「拉起测试 agent → 红检查 → 不过就把原因交回重写 → 只取走点名的文件」做成一个依赖全部由调用方传入的函数。这一批不改 `src/run.ts`，不动队列。

条目：
1. 读 SPEC 16.12 的「测试 agent 这一步怎么走」前五条与「v046-b08」一段（红检查的接口在 `src/redcheck.ts`）。新文件 `src/acceptance.ts`，导出 `prepareAcceptance(opts)`：
   `opts` 有 `root`、`headSha`、`batch`、`config`、`runner`、`testerMax`、`redCheckOpts`，以及可选的 `record(事件名, 字段)` 与可选的 `redCheck`（缺省是 `runRedCheck`）。
   它在系统临时目录下建一个检出于 `headSha` 的 git worktree（目录名以 `collie-accept-` 开头；主仓库有 `node_modules` 就链进去），在里面最多拉起测试 agent `testerMax` 次：
   每次拉起之后做红检查；过了就结束；不过就把问题清单交给下一次。测试 agent 以非零退出的那一次不做红检查，直接算没过，原因写明退出码。
   过了之后只取走 `test/acceptance/<批次>/` 下的 `new.test.ts`、`MAP.md`，以及批次有 `[保持]` 情形时的 `keep.test.ts`；
   批次有 `[保持]` 情形而没有 `keep.test.ts`、或没有 `MAP.md`，算这一次没过。
   返回 `{ ok: true, attempts, files }`（每个文件有相对仓库根的 `path` 与 `content`）或 `{ ok: false, attempts, problems }`（字符串数组，最后一次的原因）。
   它不往 `root` 写任何东西、不提交；不论成败、是否抛错，结束时那个 worktree 都要拿掉。给了 `record` 时，每次拉起记 `tester.started` 与 `tester.finished`，每次红检查记 `redcheck.result`，字段见 SPEC 16.12「事件」一条。
   **第 1 次红检查不过、第 2 次过：测试 agent 一共被拉起 2 次，第 2 次的提示词里有第 1 次每一条问题的原文，返回 `ok` 为 true、`attempts` 为 2；**
   **`testerMax` 是 2 而两次都不过：测试 agent 恰好被拉起 2 次，返回 `ok` 为 false、`attempts` 为 2，`problems` 是第 2 次的原因；**
   **测试 agent 另外写了 `src/sneaky.ts` 和输出目录里的 `extra.ts`：返回的 `files` 里没有它们，主仓库 `git status --porcelain` 为空，`git worktree list` 只剩 1 行，系统临时目录里没有留下 `collie-accept-*`**
2. `src/roles/tester.ts`：`TesterInputSchema` 加可选的 `previous_problems`（非空字符串的数组）；非空时提示词在「情形」之前多一节「上一次没过的原因」，逐条原样列出，并写一句「只改有问题的地方，改完重新自检」。
   不给或为空数组时，提示词与现在逐字相同。
3. 新文件 `test/prepare-acceptance.test.ts`，三组：
   `describe('prepareAcceptance: retry loop', …)`：条目 1 前两处加粗的情形；测试 agent 非零退出的一次；`record` 收到的事件名与先后（两次都拉起时是 started、finished、result 各两条）。红检查用注入的假函数按次给结果。
   `describe('prepareAcceptance: what is taken from the tree', …)`：条目 1 第三处加粗的情形；有 `[保持]` 情形而没有 `keep.test.ts` → 没过；没有 `[保持]` 情形而测试 agent 写了 `keep.test.ts` → `files` 里没有它；没有 `MAP.md` → 没过；注入的红检查抛错 → 错误照常抛出，worktree 仍被拿掉。
   `describe('prepareAcceptance: real red check', …)`：一条，不注入 `redCheck`：`FakeRunner` 往工作目录里写一个真实的、两条用例都会失败的 `new.test.ts` 与一份 `MAP.md`，用真实的 `runRedCheck`（真实的 vitest，不带静态命令）→ `ok` 为 true。
   没有这一条，前两组什么也证明不了：它们的红检查是假的。
   做法：用 `Sandbox` 建仓库，自己往里提交一份 `AGENT-tester.md`；配置用 `templateConfig()`；测试 agent 用 `FakeRunner`（`files` 写进它拿到的工作目录）。不改 `test/support/sandbox.ts`。
   `test/tester.test.ts` 新加一组 `describe('tester: previous problems in the prompt', …)`：给了两条 → 两条原文都在、位置在「情形」之前；不给与给空数组 → 提示词与不带这个字段时逐字相同。
   R1 查过现有用例：`test/tester.test.ts` 的 `accepts a valid input with exactly five fields` 只断言能通过校验，多一个可选字段不影响它；`rejects an extra field (strict object)` 用的键是 `extra`，仍然应当被拒绝。
   已有用例一条都不改；你发现有别的现有用例与本批次冲突，停下，在「偏离或疑问」里写明是哪一条，不要自己改。
   `test/invariants.test.ts` 加「`src/acceptance.ts` 里有 `removeWorktree`」与「`src/run.ts` 的非注释行里没有 `acceptance.js`（还没有导入这个模块）」（后一条到接线那一批由那一批改掉）

本批次只改 `src/acceptance.ts`、`src/roles/tester.ts`、`test/prepare-acceptance.test.ts`、`test/tester.test.ts`、`test/invariants.test.ts`。不应改动 `test/invariants.test.ts` 已有的任何断言。

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 模块与提示词的测试通过，仓库里没有留下报告 | `npm test -- test/prepare-acceptance.test.ts test/tester.test.ts && ! test -e .vitest` | exit 0 |
| 模块的三组用例在 | `grep -qF "prepareAcceptance: retry loop" test/prepare-acceptance.test.ts && grep -qF "prepareAcceptance: what is taken from the tree" test/prepare-acceptance.test.ts && grep -qF "prepareAcceptance: real red check" test/prepare-acceptance.test.ts` | exit 0 |
| 提示词的新用例组在 | `grep -qF "tester: previous problems in the prompt" test/tester.test.ts` | exit 0 |
| 函数导出了，队列还没有用它（不看注释行） | `grep -qE "export (async )?function prepareAcceptance" src/acceptance.ts && ! grep -vE "^\s*(//\|\*\|/\*)" src/run.ts \| grep -qE "acceptance\.js"` | exit 0 |
| 测试不在系统临时目录留下工作目录 | `d=$(mktemp -d) && TMPDIR=$d npm test -- test/prepare-acceptance.test.ts && ! ls -d "$d"/collie-accept-* >/dev/null 2>&1` | exit 0 |
| 不变量同步 | `grep -qF "removeWorktree" test/invariants.test.ts && grep -qF "src/acceptance.ts" test/invariants.test.ts` | exit 0 |

额外禁止：
- 改动任何受保护路径（含 `AGENT-tester.md`、`.collie/collie.toml`）；改动 `templates/collie.toml`、`.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`
- 改动 `src/run.ts`、`src/redcheck.ts`、`src/backlog.ts`、`src/schema/index.ts`、`src/evidence.ts`、`src/roles/worker.ts`、`src/roles/reviewer.ts`、`src/runner/`、`src/arbiter.ts`、`src/gate.ts`、`test/support/sandbox.ts`；把这个模块接进队列或加命令行子命令
- 让 `prepareAcceptance` 往主仓库的工作区写文件、提交或推送；让它取走点名之外的任何文件
- 为了让测试过而删除或跳过任何测试；改写任何已有断言
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求（「real red check」那一条可以起真实的 vitest 子进程，别的不行）；新增依赖

## v046-b09 测试只依赖自己带的环境：git 身份、私有临时目录、不绑本仓库配置；沙箱可留 journal

优先级：73　依赖：v046-b06, v046-b07

主分支的 CI 自 `777ce2a` 起是红的：v046-b08 新加的一条测试用到了机器的 git 全局身份，开发的机器有，CI 的机器没有。这一批把它修绿，并收掉另外两处同类的依赖。只改测试，不改 `src/`。

条目：
1. 读 SPEC 16.13 的第一段与 14.25 开头关于 CI 的那一段。`test/prepare-acceptance.test.ts`：文件里的每一次 `git commit` 都用测试自己设的身份，不用机器的全局配置
   （可以改用 `Sandbox`，也可以让辅助函数设的身份在整个用例期间有效；用完还原环境变量）。
   同一文件与 `test/redcheck.test.ts`：各自建一个私有的临时目录（在系统临时目录下），把 `process.env.TMPDIR` 指过去，结束时还原并删掉；
   「没有 `collie-accept-*` / `collie-redcheck-*` 残留」的断言只看这个私有目录。两个文件里别的断言不改。
   **没有任何 git 全局身份时（`GIT_CONFIG_GLOBAL` 指向一个空文件、`GIT_CONFIG_NOSYSTEM=1`），`test/prepare-acceptance.test.ts` 全部通过；**
   **系统临时目录里事先有别人的 `collie-accept-other` 与 `collie-redcheck-other` 两个目录时，这两个测试文件全部通过，跑完那两个目录还在**
2. `test/config.test.ts`：v046-b07 加的 `.collie/collie.toml loads without tester_max or verify.static` 断言的是本仓库配置里现在没有这两项，
   R1 之后要往本仓库配置里加它们。把这一条改成用内联配置（从 `VALID_TOML` 里去掉这两行）证明「没有这两项的配置能加载，`limits.tester_max` 是 2、`verify` 里没有 `static`」，不读本仓库的配置。
   `test/invariants.test.ts`：v046-b01 那条不变量旁边加一条，数出现的次数：`test/config.test.ts` 里从仓库根加载配置（`loadConfig(repoRoot)` 这一类）的恰好一处。
   允许改写的旧用例只有上面点名的这一条，在「偏离或疑问」里列出原断言与现断言。
   **做完之后的样子：往本仓库的 `.collie/collie.toml` 里加 `tester_max = 3` 与 `static = ["npm run lint"]`，`npm test` 仍然全过。这一条由操作员在仓库副本里验证，你不要改 `.collie/collie.toml`**
3. `test/support/sandbox.ts`：设了环境变量 `COLLIE_TEST_KEEP_RUNS=<目录>` 时，`dispose()` 在删除沙箱之前把沙箱仓库的 `.collie/runs/` 整个复制到 `<目录>/<沙箱目录名>/runs/`，
   并在 `<目录>/<沙箱目录名>/TEST_NAME` 里写下当前用例的全名（取不到就写空）。沙箱里没有 `.collie/runs/` 时只写 `TEST_NAME`。不设这个环境变量时行为与现在完全一样。复制出错不许让用例失败。
   新文件 `test/sandbox-keep.test.ts`，一组 `describe('sandbox: COLLIE_TEST_KEEP_RUNS', …)`：设了 → 用假 runner 跑一次 `run` 之后 `dispose()`，目标目录里有 `events.ndjson` 与 `TEST_NAME`；
   不设 → 什么也不留。用例自己设、自己还原这个环境变量，目标目录用完删掉。
   R1 查过：`test/support/sandbox.ts` 的 `dispose()` 现在只还原两个 git 环境变量并删除目录；没有现有用例断言 `dispose()` 之后沙箱外有什么。

本批次只改 `test/prepare-acceptance.test.ts`、`test/redcheck.test.ts`、`test/config.test.ts`、`test/invariants.test.ts`、`test/support/sandbox.ts`、`test/sandbox-keep.test.ts`。不应改动 `test/invariants.test.ts` 已有的任何断言。

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 没有 git 全局身份时全部测试通过 | `e=$(mktemp) && GIT_CONFIG_GLOBAL=$e GIT_CONFIG_NOSYSTEM=1 npm test` | exit 0 |
| 临时目录里有别人的同名前缀目录时，两个文件通过，别人的目录还在 | `d=$(mktemp -d) && mkdir "$d/collie-accept-other" "$d/collie-redcheck-other" && TMPDIR=$d npm test -- test/prepare-acceptance.test.ts test/redcheck.test.ts && test -d "$d/collie-accept-other" && test -d "$d/collie-redcheck-other"` | exit 0 |
| config.test.ts 里从仓库根加载配置的恰好一处 | `grep -cE "loadConfig\((repoRoot\|ROOT\|join\(import\.meta\.dirname)" test/config.test.ts \| grep -qx 1` | exit 0 |
| 留 journal 的开关管用 | `d=$(mktemp -d) && COLLIE_TEST_KEEP_RUNS=$d npm test -- test/queue-limit.test.ts && find "$d" -name events.ndjson \| grep -q . && find "$d" -name TEST_NAME \| grep -q .` | exit 0 |
| 开关的用例组在 | `grep -qF "sandbox: COLLIE_TEST_KEEP_RUNS" test/sandbox-keep.test.ts` | exit 0 |

额外禁止：
- 改动任何受保护路径（含 `.collie/collie.toml`）；改动 `.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`；改动 `src/`、`scripts/`、`templates/` 下任何文件
- 为了让测试过而删除或跳过任何测试；改写条目 2 点名之外的任何已有断言（条目 1 里两处「没有残留」的断言只许改它看的目录）
- 在测试里改机器的 git 全局配置，或往仓库自己的 `.git/config` 里写身份
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；新增依赖

## v046-b10 prepareAcceptance 收尾：带回测试 agent 的回复、类别标错不再重拉（不接进队列）

优先级：74　依赖：v046-b09

操作员用真实的运行器调了 `prepareAcceptance`：情形的类别标错时，测试 agent 照手册没有作弊、在汇报里请方案设计者改类别，但这句话调用方拿不到，第 2 次拉起也注定白跑。不动队列。

条目：
1. 读 SPEC 16.13 的「`prepareAcceptance` 的收尾」一段（流程在 16.12）。`src/acceptance.ts`：成功与失败两种返回值都加 `reports`（字符串数组，每次拉起的测试 agent 的最终回复原文，没有就是空串，按先后）；
   失败的返回值加 `reason`：`'red_check'`（红检查没过或缺文件）、`'tester_failed'`（最后一次是测试 agent 非零退出）、`'misclassified'`。
   红检查没过，而这一次测试 agent 最终回复的最后一个 JSON 围栏块里 `misclassified` 是非空数组时：不再拉起下一次，直接返回，`reason` 是 `'misclassified'`，`problems` 是这一次红检查的原因。
   最终回复里没有 JSON 块、解析不了、没有这个字段或是空数组，都按没有声明处理，照常重拉。红检查过了的，不看这个字段。
   **`testerMax` 是 2，第 1 次红检查没过且回复的 JSON 里 `misclassified` 列了一条：测试 agent 只被拉起 1 次，返回 `ok` 为 false、`attempts` 为 1、`reason` 为 `misclassified`，`reports` 有 1 条且就是那份回复；**
   **同样的红检查结果，但回复里没有 JSON 块：照常拉起第 2 次**
2. 同一文件：交给测试 agent 的要读的文件是 `SPEC.md` 与 `CONSTRAINTS.md` 两份；建工作目录的那一步失败时，已经建出来的目录与 git 里登记的 worktree 也要清理掉，错误照常抛出；
   测试 agent 以非零退出时，下一次拉起的「上一次没过的原因」里有一条写明上一次的退出码。
3. `test/prepare-acceptance.test.ts` 新加一组 `describe('prepareAcceptance: reports and early stop', …)`：条目 1 加粗的两种情形；`reports` 在成功时也有、条数等于拉起次数；
   三种 `reason` 各一条；JSON 里 `misclassified` 是空数组 → 照常重拉；非零退出之后第 2 次的提示词里有退出码；交给测试 agent 的提示词里两份文件都在；
   建工作目录失败（给一个不存在的 `headSha`）→ 抛错，`git worktree list` 只有 1 行，私有临时目录里没有 `collie-accept-*`。
   R1 查过现有用例：这个文件里的假测试 agent 返回的是 `{ exitCode: 0 }`，没有最终回复，所以现有的重拉用例（`first red check fails, second passes…`、`testerMax=2, both fail…`、`record receives events…`）不会被提前结束影响；
   现有用例对返回值都是逐个字段断言，多出两个字段不影响它们。已有用例一条都不改；你发现有别的现有用例与本批次冲突，停下，在「偏离或疑问」里写明是哪一条，不要自己改。
   `test/invariants.test.ts` 加「`src/acceptance.ts` 里有 `misclassified`」

本批次只改 `src/acceptance.ts`、`test/prepare-acceptance.test.ts`、`test/invariants.test.ts`。不应改动 `test/invariants.test.ts` 已有的任何断言。

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 没有 git 全局身份时模块的测试通过 | `e=$(mktemp) && GIT_CONFIG_GLOBAL=$e GIT_CONFIG_NOSYSTEM=1 npm test -- test/prepare-acceptance.test.ts` | exit 0 |
| 新的一组用例在 | `grep -qF "prepareAcceptance: reports and early stop" test/prepare-acceptance.test.ts` | exit 0 |
| 两份要读的文件都给了（不看注释行） | `grep -vE "^\s*(//\|\*\|/\*)" src/acceptance.ts \| grep -qF "CONSTRAINTS.md"` | exit 0 |
| 队列还没有用它（不看注释行） | `! grep -vE "^\s*(//\|\*\|/\*)" src/run.ts \| grep -qE "acceptance\.js"` | exit 0 |
| 不变量同步 | `grep -qF "misclassified" test/invariants.test.ts` | exit 0 |

额外禁止：
- 改动任何受保护路径（含 `AGENT-tester.md`）；改动 `.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`
- 改动 `src/run.ts`、`src/redcheck.ts`、`src/roles/`、`src/runner/`、`src/backlog.ts`、`src/schema/index.ts`、`src/evidence.ts`、`test/support/sandbox.ts`；把这个模块接进队列
- 按红检查的原因文字去猜类别标错（只看测试 agent 自己在 JSON 里的声明）；让 `prepareAcceptance` 往主仓库的工作区写文件、提交或推送
- 为了让测试过而删除或跳过任何测试；改写任何已有断言
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；用到机器的 git 全局身份；新增依赖

## v046-b11 R2 诊断信息：规则 9 重跑的 task 带 CI 链接；查裁定提交 CI 出异常时记事件

优先级：75　依赖：v046-b09

v046-b08 被规则 9 降级之后重跑了两次，task 里只有一句 `ci_conclusion=failure`，worker 不知道是哪次 CI 运行。另外，R2 查上一条裁定提交的 CI 时出了异常是悄悄吞掉的，一条偶发的测试失败因此无从查起。
这一批只加信息，不改任何判定。改 R2。

条目：
1. 读 SPEC 16.13 的「R2 的两处诊断信息」一段与 14.25 里关于后两次重跑的那一条。`src/run.ts`：上一次运行被规则 9 降级时，重跑的 task「降级原因」一节在规则与原因之后多两行，
   取自上一次运行 journal 里最后一条 `ci.resolved`：`- head_sha：<sha>` 与 `- CI 运行：<run_url>`（`run_url` 为空就不写这一行；没有 `ci.resolved` 就两行都不写）。别的规则降级时这一节不变。
   **上一次运行规则 9、`ci.resolved` 的 `conclusion` 是 `failure` 且带 `run_url`：重跑的 task 里有那个 `head_sha` 与那条链接**
2. `src/run.ts` 与 `src/schema/index.ts`：事件类型加 `ci.verdict_commit_error`。启动时查上一条裁定提交的 CI、取证之后复查，这两处捕获到异常时各记一条：
   `sha`、`when`（`startup` 或 `after_evidence`）、`error`（错误信息，限 500 字符）。别的行为不变：异常仍然不让这次运行失败，也不改它的结论与退出码。
   **启动时那次查询抛错：这次运行照常走完、结论与退出码和不抛错时相同，journal 里有 1 条 `ci.verdict_commit_error`、`when` 是 `startup`**
3. 测试。`test/queue-journal.test.ts` 加一条 `rule 9 FIX rerun task carries head_sha and CI run url`（条目 1 加粗的情形），再加一条 `run_url` 为空时没有「CI 运行」那一行；
   `test/verdict-ci-recheck.test.ts` 新加一组 `describe('verdict CI query errors are journaled', …)`：条目 2 加粗的情形；复查时抛错 → `when` 是 `after_evidence`，结论与退出码不变；两处都不抛错 → 没有这个事件。
   允许改写的旧用例只有一处：`test/schema.test.ts` 的 `defines the v0.1 event types plus v0.2 and v0.3 types added so far`，个数 40 改成 41，并加一条 `toContain`；在「偏离或疑问」里写明。
   R1 查过：`test/queue-journal.test.ts` 的 `rule 9 FIX rerun task contains 降级原因 with rule and reason` 只断言含「降级原因」与「规则 9」，多两行不影响它；
   `test/verdict-ci-recheck.test.ts` 现有 8 条都没有让查询抛错，不会多出新事件。你发现有别的现有用例与本批次冲突，停下，在「偏离或疑问」里写明是哪一条，不要自己改。
   `test/invariants.test.ts` 加「`src/run.ts` 里有 `ci.verdict_commit_error`」

本批次只改 `src/run.ts`、`src/schema/index.ts`、`test/queue-journal.test.ts`、`test/verdict-ci-recheck.test.ts`、`test/schema.test.ts`、`test/invariants.test.ts`。不应改动 `test/invariants.test.ts` 已有的任何数值上下限。

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 队列日志、CI 复查、事件类型的测试通过 | `npm test -- test/queue-journal.test.ts test/verdict-ci-recheck.test.ts test/schema.test.ts` | exit 0 |
| task 带 CI 链接的用例在 | `grep -qF "rule 9 FIX rerun task carries head_sha and CI run url" test/queue-journal.test.ts` | exit 0 |
| 异常记事件的用例组在 | `grep -qF "verdict CI query errors are journaled" test/verdict-ci-recheck.test.ts` | exit 0 |
| 新事件进了类型清单与 R2（不看注释行） | `grep -qF "ci.verdict_commit_error" src/schema/index.ts && grep -vE "^\s*(//\|\*\|/\*)" src/run.ts \| grep -qF "ci.verdict_commit_error"` | exit 0 |
| 不变量同步 | `grep -qF "ci.verdict_commit_error" test/invariants.test.ts` | exit 0 |

额外禁止：
- 改动任何受保护路径；改动 `.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`
- 改动 `src/arbiter.ts`、`src/gate.ts`、`src/evidence.ts`、`src/acceptance.ts`、`src/redcheck.ts`、`src/roles/`、`src/runner/`、`src/view.ts`、`src/follow.ts`；改动任何一条规则的判定、`fix_max` 的计数、重跑的条件
- 让 CI 查询的异常影响这次运行的结论或退出码
- 为了让测试过而删除或跳过任何测试；改写条目 3 点名之外的任何已有断言
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；用到机器的 git 全局身份；新增依赖

## v046-b12 接线前的铺垫补齐：测试 agent 的事件与中止、类别标错清单；三处测试小修（不接进队列）

优先级：76　依赖：v046-b10

把测试 agent 接进队列之前，`src/acceptance.ts` 与 `src/roles/tester.ts` 还缺几样接线要用的东西；另有三处测试的小修。这一批不改 `src/run.ts`。

条目：
1. 读 SPEC 16.14 的「铺垫补齐」一段。`src/roles/tester.ts` 的 `runTester` 加第五个可选参数 `opts`：`signal`、`onEvent`、`redact`，原样交给运行器（写法照 `src/roles/reviewer.ts` 的 `runReviewer`）。
   `src/acceptance.ts` 的 `prepareAcceptance`：`opts` 加可选的 `signal`、`onTesterEvent(attempt, event)`、`redact`，交给 `runTester`；`signal` 已经中止时不再拉起下一次，按 `tester_failed` 结束。
   `tester.started` 的字段是 `attempt`、`model`、`max_turns`；`tester.finished` 的字段是 `attempt`、`exit_code`，以及运行器给了的 `num_turns`、`cost_usd`、`duration_ms`、`usage`
   （写法照 `src/run.ts` 里记 `reviewer.finished` 的那一段）；现在的 `exitCode` 改名为 `exit_code`。
   **假测试 agent 的返回值带 `numTurns: 7`、`costUsd: 0.5`：`tester.finished` 里有 `exit_code: 0`、`num_turns: 7`、`cost_usd: 0.5`，没有 `exitCode` 这个键；每次拉起的事件都经 `onTesterEvent` 送出，第一个参数是第几次**
2. 同一文件：类别标错的声明，数组里的每一项可以是字符串，也可以是 `{ id, why }`；失败的返回值加 `misclassified`（字符串数组：字符串原样，对象转成 `<id>：<why>`；没有声明时是空数组）。
   **回复的 JSON 里是 `"misclassified": [{ "id": "S1", "why": "已有行为" }]`：返回值的 `misclassified` 是 `['S1：已有行为']`，不出现 `[object Object]`**
3. 测试。新用例放进点名的组里：`test/prepare-acceptance.test.ts` 新加 `describe('prepareAcceptance: tester events, signal and misclassified list', …)`（条目 1、2 加粗的情形；`signal` 中止 → 不再重拉、`reason` 是 `tester_failed`；字符串写法照旧能用）；
   `test/tester.test.ts` 新加 `describe('tester: run options are forwarded', …)`。另有三处小修：
   甲、`test/redcheck.test.ts`：测试自己建的目录换一个不以 `collie-redcheck-` 开头的名字；每条用例结束、删除私有临时目录之前，断言里面没有 `collie-redcheck-*`。
   新加一组 `describe('runRedCheck: leaves nothing behind', …)`，至少一条：真实跑一次之后私有临时目录里没有 `collie-redcheck-*`。`test/prepare-acceptance.test.ts` 里被 v046-b09 删掉的那条残留检查同样补回（只看私有目录）。
   乙、`test/prepare-acceptance.test.ts` 的建仓库辅助函数：整个用例期间把 `GIT_CONFIG_GLOBAL` 换成自己写的文件、`GIT_CONFIG_NOSYSTEM` 设为 1，用完还原（照 `test/support/sandbox.ts` 的做法），不再读机器的全局 git 配置。
   丙、这两个文件里真实起 vitest 子进程的用例：交给 `runRedCheck` 的 `timeoutMs` 改成 240 秒（现在 `test/redcheck.test.ts` 里是 60 秒，`test/prepare-acceptance.test.ts` 里是 30 秒），用例自己的超时设成 300 秒（慢机器上一个子进程要 60 到 120 秒）。注入假子进程的用例不动。
   R1 查过现有用例：`record receives events in the right order for two attempts` 只断言事件名，改字段名不影响它；`misclassified in reply JSON → …` 用的是字符串写法，仍然应当通过。
   已有断言一条都不改、不删（甲是补回断言，丙只改时限的数值）；你发现有别的现有用例与本批次冲突，停下，在「偏离或疑问」里写明是哪一条，不要自己改。
   `test/invariants.test.ts` 加「`src/acceptance.ts` 里有 `onTesterEvent`」

本批次只改 `src/acceptance.ts`、`src/roles/tester.ts`、`test/prepare-acceptance.test.ts`、`test/tester.test.ts`、`test/redcheck.test.ts`、`test/invariants.test.ts`。不应改动 `test/invariants.test.ts` 已有的任何断言。

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 三个文件的测试通过 | `npm test -- test/prepare-acceptance.test.ts test/tester.test.ts test/redcheck.test.ts` | exit 0 |
| 全局 git 配置开了提交签名、没有身份时，模块的测试通过 | `e=$(mktemp) && printf '[commit]\n\tgpgsign = true\n[user]\n\tsigningkey = 0000000000000000\n' > "$e" && GIT_CONFIG_GLOBAL=$e GIT_CONFIG_NOSYSTEM=1 npm test -- test/prepare-acceptance.test.ts` | exit 0 |
| 三组新用例在 | `grep -qF "prepareAcceptance: tester events, signal and misclassified list" test/prepare-acceptance.test.ts && grep -qF "tester: run options are forwarded" test/tester.test.ts && grep -qF "runRedCheck: leaves nothing behind" test/redcheck.test.ts` | exit 0 |
| 事件字段改了名（不看注释行） | `grep -vE "^\s*(//\|\*\|/\*)" src/acceptance.ts \| grep -qF "exit_code" && ! grep -vE "^\s*(//\|\*\|/\*)" src/acceptance.ts \| grep -qF "exitCode: result.exitCode"` | exit 0 |
| 队列还没有用它（不看注释行） | `! grep -vE "^\s*(//\|\*\|/\*)" src/run.ts \| grep -qE "acceptance\.js"` | exit 0 |
| 不变量同步 | `grep -qF "onTesterEvent" test/invariants.test.ts` | exit 0 |

额外禁止：
- 改动任何受保护路径（含 `AGENT-tester.md`）；改动 `.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`
- 改动 `src/run.ts`、`src/redcheck.ts`、`src/ladder.ts`、`src/evidence.ts`、`src/runner/`、`src/schema/index.ts`、`test/support/sandbox.ts`；把这个模块接进队列
- 为了让测试过而删除或跳过任何测试；改写或删去任何已有断言
- 在测试里改机器的 git 全局配置
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；新增依赖

## v046-b13 活性指纹不占索引锁：R2 在 worker 工作期间不改写 .git/index

优先级：77　依赖：v046-b09

一条偶发的测试失败留下了 journal：沙箱里的假 worker 提交时报 `Unable to create '.git/index.lock': File exists`。worker 工作期间，R2 自己每 500 毫秒算一次活性指纹（`src/ladder.ts` 的 `computeFingerprint`：`git diff HEAD` 加 `git status`）。
R1 的推断（读代码得出，没有实跑）：`git diff HEAD` 在碰到时间戳变了、内容没变的文件时会顺手刷新索引，那一下要拿索引锁，`GIT_OPTIONAL_LOCKS=0` 管不住它。改 R2，只动指纹这一处。

条目：
1. 读 SPEC 14.26 里「偶发失败查到了直接原因」一段与 16.14 的「活性指纹不占索引锁」。**先写测试，再改代码**：新文件 `test/fingerprint-lock.test.ts`，一组 `describe('fingerprint: never rewrites the git index', …)`，用 `Sandbox` 建仓库：
   提交一个文件；把它的修改时间改到别的时刻、内容不变（让索引里的时间戳对不上）；记下 `.git/index` 的 inode 与修改时间；连调 5 次 `computeFingerprint`；断言 `.git/index` 的 inode 与修改时间都没变，过程中 `.git/index.lock` 没有出现过。
   **这条测试在现有代码上应该失败。它要是通过了，说明 R1 的推断不成立：停下，不要改 `src/ladder.ts`，在「偏离或疑问」里写明你看到的（包括你另外查到的、谁会占这把锁）**
2. `src/ladder.ts` 的 `computeFingerprint`：改成不创建 `.git/index.lock`、不改写 `.git/index` 的写法（比如给 `git diff` 关掉自动刷新索引，或者换成不刷新索引的底层命令；用哪种你定，在汇报里写明选了什么、为什么）。
   指纹仍然对内容敏感：被跟踪的文件内容变了，指纹必须变；HEAD 变了，指纹必须变；未跟踪的文件多了或变了，指纹必须变。只有时间戳变、内容没变时，指纹变不变都可以，在汇报里写明实际是哪一种。
3. 同一个测试文件再加三条，守条目 2 的三种「必须变」；`test/scenario-g.test.ts` 里已有的 `computeFingerprint: content-sensitive` 一组不许改，必须照常通过。
   R1 查过：现有测试里直接调 `computeFingerprint` 的只有 `test/scenario-g.test.ts` 那一组；别的测试经由 `LivenessMonitor` 间接用到它，或者注入了假的指纹函数。
   你发现有别的现有用例与本批次冲突，停下，在「偏离或疑问」里写明是哪一条，不要自己改。

本批次只改 `src/ladder.ts` 与 `test/fingerprint-lock.test.ts`。不应改动 `test/invariants.test.ts`。

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 指纹的两组测试通过 | `npm test -- test/fingerprint-lock.test.ts test/scenario-g.test.ts` | exit 0 |
| 新的一组用例在，且用的是沙箱 | `grep -qF "fingerprint: never rewrites the git index" test/fingerprint-lock.test.ts && grep -qF "Sandbox" test/fingerprint-lock.test.ts` | exit 0 |

额外禁止：
- 改动任何受保护路径；改动 `.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`
- 改动 `src/git.ts`、`src/run.ts`、`src/evidence.ts`、`src/acceptance.ts`、`src/runner/`、`src/roles/`；改动活性检测的阈值、轮询间隔与判定（只改指纹怎么算）
- 为了让测试过而删除或跳过任何测试；改写任何已有断言
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；用到机器的 git 全局配置；新增依赖

## v046-b14 R2 凭提交号认自己的提交：规则 2 不再按提交说明的开头跳过

优先级：78　依赖：v046-b11

R2 取证时数「受保护路径被改了多少行」，会跳过提交说明以 `docs: issue `、`progress: `、`report(collie): `、`ops: ` 开头的提交（`src/evidence.ts`）。
R1 读代码的推断（没有实跑）：worker 的提交只要用了这四种开头之一，它对 SPEC、backlog、验收测试的改动就不计入，规则 2 不会命中。验收测试靠规则 2 保护，接线之前要堵上。改 R2。

条目：
1. 读 SPEC 16.14 的「R2 凭提交号认自己的提交」一段。**先写测试，再改代码**：新文件 `test/r2-commits.test.ts`，第一组 `describe('rule 2 counts every commit that R2 did not make', …)`，用 `Sandbox` 与 `FakeRunner` 跑真实的 `run`：
   假 worker 的一个提交改了 `SPEC.md`，提交说明分别以四种开头之一起头（各一条）→ 结论是 BLOCK、规则 2；
   假 worker 用 `docs: issue v99-b01 task envelope` 这个说明提交了 `test/acceptance/v99-b01/new.test.ts` → BLOCK、规则 2。
   **这一组在现有代码上应该失败（结论不是规则 2）。它要是通过了，说明 R1 的推断不成立：停下，不要改 `src/`，在「偏离或疑问」里写明你看到的**
2. `src/run.ts`、`src/evidence.ts`、`src/schema/index.ts`：事件类型加 `r2.commit`（`sha`、`subject`）。R2 自己的每一次提交都经同一个辅助函数做「提交并记一条 `r2.commit`」；
   `src/run.ts` 里现在直接调 `commit(` 的 8 处都改用它，之后整个文件里直接调 `commit(root` 的只剩辅助函数里的一处。救援提交（`wip(collie):`）不经过它、不记这个事件。
   取证：受保护路径的改动行数对 `base_sha..head_sha` 里的每个提交都数，只跳过 `r2Shas` 里的提交；`r2Shas` 由 `src/run.ts` 从本机全部 journal 里收集：
   `r2.commit` 的 `sha`、`batch.task_written` 的 `commit`、`verdict.pushed` 与 `verdict.push_failed` 的 `sha`。提交说明以什么开头不再影响这个数。`commits_actual` 的列法不变。
   **同一个批次先 FIX 再 PASS：范围里有 R2 自己的裁定提交（它改了 `docs/progress.md`，是受保护路径），第 2 次的 `spec_diff_lines` 仍是 0、结论 PASS**
3. 同一个测试文件第二组 `describe('R2 own commits stay out of the count', …)`：条目 2 加粗的情形；规则 1 自动重跑、中断后自动重跑这两条路径各一条（重跑的那一次不被规则 2 拦）；
   一次运行结束后，`git log` 里 R2 的提交个数等于 journal 里 `r2.commit` 的条数；两次运行之间把 `.collie/runs/` 删掉 → 第 2 次被规则 2 拦下（记下这是已知的保守行为）。
   允许改写的旧用例只有一处：`test/schema.test.ts` 的 `defines the v0.1 event types plus v0.2 and v0.3 types added so far`，个数 41 改成 42，并加一条 `toContain`；在「偏离或疑问」里写明。
   R1 查过：`test/evidence.test.ts` 没有用例手工造带这四种开头的提交再期望它被跳过；`test/invariants.test.ts` 的 `src/evidence.ts contains report(collie) in R2 commit prefixes (v03-b03-fix)` 仍然成立（开头的清单留着给 `commits_actual` 用）；
   FIX 重跑、规则 1 重跑、中断重跑的现有场景测试用的都是真实的 journal，应当照常通过。你发现有别的现有用例因此失败，停下，在「偏离或疑问」里写明是哪一条，不要自己改。
   `test/invariants.test.ts` 加「`src/run.ts` 的非注释行里直接调 `commit(root` 的恰好一处」与「`src/schema/index.ts` 里有 `r2.commit`」

本批次只改 `src/run.ts`、`src/evidence.ts`、`src/schema/index.ts`、`test/r2-commits.test.ts`、`test/schema.test.ts`、`test/invariants.test.ts`。不应改动 `test/invariants.test.ts` 已有的任何数值上下限。

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 新测试与取证、事件类型的测试通过 | `npm test -- test/r2-commits.test.ts test/evidence.test.ts test/schema.test.ts` | exit 0 |
| 两组用例在 | `grep -qF "rule 2 counts every commit that R2 did not make" test/r2-commits.test.ts && grep -qF "R2 own commits stay out of the count" test/r2-commits.test.ts` | exit 0 |
| R2 的提交都走同一处（不看注释行） | `grep -vE "^\s*(//\|\*\|/\*)" src/run.ts \| grep -cE "\bcommit\(root" \| grep -qx 1` | exit 0 |
| 新事件进了类型清单 | `grep -qF "r2.commit" src/schema/index.ts` | exit 0 |
| 变异检查全部被发现，工作区里没有留下报告 | `out=$(npx tsx scripts/mutation.ts 2>&1) && printf '%s\n' "$out" \| tail -n 1 \| grep -qE "^mutation: caught 43 survived 0 invalid 0 timeout 0 stale 0$" && ! test -e .vitest` | exit 0 |
| 不变量同步 | `grep -qF "r2.commit" test/invariants.test.ts` | exit 0 |

额外禁止：
- 改动任何受保护路径；改动 `.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`、`scripts/mutation.ts`
- 改动 `src/arbiter.ts`、`src/gate.ts`、`src/acceptance.ts`、`src/ladder.ts`、`src/roles/`、`src/runner/`、`src/view.ts`、`src/follow.ts`；改动受保护路径的清单、任何一条规则的判定、`commits_actual` 的列法
- 把救援提交记成 R2 的提交；让提交说明的开头继续影响受保护路径的计数
- 为了让测试过而删除或跳过任何测试；改写条目 3 点名之外的任何已有断言
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；用到机器的 git 全局配置；新增依赖

## v046-b15 接线第一块：带情形的批次在写 task 信封之前先拉起测试 agent

优先级：79　依赖：v046-b12, v046-b14, v046-b16

分工改造第 3 步的接线（SPEC 第 16 章）：带「情形」的批次，R2 在写 task 信封之前先调 `prepareAcceptance`，过了就把验收测试和信封一起提交，没过就上报停下。不带情形的批次什么都不变。改 R2。

条目：
1. 读 SPEC 16.14 的「接线第一块」六条（`prepareAcceptance` 的参数与返回值在 `src/acceptance.ts`，流程的来历在 16.12）。`src/run.ts`：照那六条做。几处写明：
   配置检查在写 heartbeat 之前，报错走配置无效时的同一条路径（退出码 1）；`RunContext` 加可选的 `redCheck`（原样交给 `prepareAcceptance`，测试用）与 `testerSignal`（给了就用它代替内部的计时，做法照 `workerSignal`）；
   测试 agent 的事件流用 `appendStream` 写进 `tester.stream.ndjson`；信封提交与上报的裁定提交都经 v046-b14 的那个辅助函数（记 `r2.commit`）；
   上报时的说明文字写「上报：验收测试没有准备好 — <原因>」，不带「无 report」。
   `src/heartbeat.ts` 的阶段加 `tester`；`src/schema/index.ts` 与 `templates/collie.toml` 加 `limits.redcheck_secs`（正整数，可选，缺省 600，写法照 `tester_max`；模板里写 `redcheck_secs = 600` 带一行注释）。本仓库的 `.collie/collie.toml` 不许动。
   **带情形的批次、红检查一次就过：运行器被调用的先后是 tester、worker、reviewer；`docs: issue` 那一个提交里同时有 `task.md`、`new.test.ts`、`MAP.md`；journal 里 `tester.started`、`tester.finished`、`redcheck.result` 都在 `batch.task_written` 之前；这次运行的结论与不带情形时一样由 worker 与 reviewer 决定**
   **不带情形的批次：运行器只被调用 worker、reviewer 两次，journal 里没有 `tester.` 与 `redcheck.` 开头的事件，没有 `tester.stream.ndjson`**
2. 没过与越界的三种结局，都不拉起 worker 与 reviewer：
   红检查两次都不过 → 退出码 20，`escalated` 的原因以 `red_check_failed` 开头，`.collie/batches/<批次>/tester.md` 在裁定提交里，`--continue` 下批次记 `blocked`、队列以 `blocked` 结束；
   测试 agent 声明了类别标错 → 只拉起 1 次，原因以 `misclassified` 开头，`tester.md` 里有它的回复与声明的清单；
   测试 agent 往主工作区写了文件 → 原因以 `tester_touched_main_tree` 开头并列出那个文件，`git log` 里没有任何提交含验收测试或那个文件，那个文件还留在工作区里。
   另：`testerSignal` 中止 → 原因以 `tester_failed` 开头；配置里没有 `[agent.tester]` → 退出码 1，标准错误点名 `[agent.tester]`，没有新提交，批次状态不变；
   **同一个批次先 FIX 再 PASS：测试 agent 只在第 1 次被拉起，整个队列里运行器被调用的先后是 tester、worker、reviewer、worker、reviewer**
3. 新文件 `test/tester-step.test.ts`，用 `Sandbox`、`FakeRunner` 与注入的 `redCheck`（沙箱里的 backlog 自己写一个带情形的批次并提交；假测试 agent 在它拿到的工作目录里写文件），三组：
   `describe('tester step: runs before the task envelope', …)`（条目 1 加粗的两种情形）；
   `describe('tester step: failures stop the batch', …)`（条目 2 的五种结局各一条）；
   `describe('tester step: skipped when the tests are already in the tree', …)`（条目 2 加粗的情形；HEAD 的树里事先就有 `new.test.ts` 时一次也不拉起）。
   允许改写的旧用例只有下面四处，每处在「偏离或疑问」里列出原断言与现断言：
   `test/config.test.ts` 的 `has the limits of SPEC 3.1`（期望对象加 `redcheck_secs: 600`）与内联配置 `VALID_TOML`（跟着模板加一行）；`test/schema.test.ts` 的夹具 `validConfig.limits`（加这个字段，类型要求）；
   `test/invariants.test.ts` 的 `src/run.ts non-comment lines do not contain acceptance.js (v046-b08)`：改成断言 `src/run.ts` 引用了 `acceptance.js`，名字相应改掉。
   R1 查过：`test/heartbeat.test.ts` 没有钉死阶段的清单；`test/cli.test.ts` 比较 `limits` 的那条两边都取自模板；现有测试的沙箱 backlog 都不带情形，所以现有的场景测试都走不到新的一步。
   钉死完整清单的用例 R1 也查过：`test/exit-codes.test.ts` 的 `records the v0.1 event sequence in order` 跑的是不带情形的批次，它的事件序列一个都不许变；本批次不加事件类型，变异清单的项数不变。
   别的现有用例因为本批次的新行为而失败时：只许做新行为直接要求的最小改动（往序列里加事件、个数加一这一类），不许删断言、不许把断言改松，在「偏离或疑问」里逐条列出原断言与现断言；拿不准是不是新行为直接要求的，才停下不改，写明是哪一条。
   `test/invariants.test.ts` 另加「`src/run.ts` 里有 `tester.stream.ndjson`」

本批次只改 `src/run.ts`、`src/heartbeat.ts`、`src/schema/index.ts`、`templates/collie.toml`、`test/tester-step.test.ts`、`test/config.test.ts`、`test/schema.test.ts`、`test/invariants.test.ts`。
类型检查因为 heartbeat 多了一个阶段而要求改这之外的文件时，可以改，在「偏离或疑问」里逐个列出。不应改动 `test/invariants.test.ts` 已有的任何数值上下限。

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 没有 git 全局身份时全部测试通过 | `e=$(mktemp) && GIT_CONFIG_GLOBAL=$e GIT_CONFIG_NOSYSTEM=1 npm test` | exit 0 |
| 接线、配置、事件类型的测试通过 | `npm test -- test/tester-step.test.ts test/config.test.ts test/schema.test.ts test/heartbeat.test.ts` | exit 0 |
| 三组用例在 | `grep -qF "tester step: runs before the task envelope" test/tester-step.test.ts && grep -qF "tester step: failures stop the batch" test/tester-step.test.ts && grep -qF "tester step: skipped when the tests are already in the tree" test/tester-step.test.ts` | exit 0 |
| 队列用上了这个模块（不看注释行） | `grep -vE "^\s*(//\|\*\|/\*)" src/run.ts \| grep -qE "acceptance\.js"` | exit 0 |
| 模板里有新配置项，本仓库的配置没有被动 | `grep -qE "^redcheck_secs = 600" templates/collie.toml && ! grep -qE "redcheck_secs\|agent\.tester" .collie/collie.toml` | exit 0 |
| 变异检查全部被发现，工作区里没有留下报告 | `out=$(npx tsx scripts/mutation.ts 2>&1) && printf '%s\n' "$out" \| tail -n 1 \| grep -qE "^mutation: caught 43 survived 0 invalid 0 timeout 0 stale 0$" && ! test -e .vitest` | exit 0 |
| 不变量同步 | `grep -qF "tester.stream.ndjson" test/invariants.test.ts` | exit 0 |

额外禁止：
- 改动任何受保护路径（含 `.collie/collie.toml`、`AGENT-tester.md`、`AGENT-worker.md`）；改动 `.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`
- 改动 `src/acceptance.ts`、`src/redcheck.ts`、`src/roles/`、`src/runner/`、`src/arbiter.ts`、`src/gate.ts`、`src/evidence.ts`、`src/backlog.ts`、`src/view.ts`、`src/follow.ts`；改动任何一条规则的判定、`fix_max` 的计数、队列自动重跑的条件
- 改变不带情形的批次的任何行为；在仓库里建 `test/acceptance/` 目录；替测试 agent 还原或删除它写到主工作区里的文件
- 为了让测试过而删除或跳过任何测试；改写条目 3 点名之外的任何已有断言
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner、真实的 vitest 子进程或真实网络请求；用到机器的 git 全局配置；新增依赖

## v046-b16 prepareAcceptance 里运行器抛错的两种情形；两条空过的测试改实（不接进队列）

优先级：80　依赖：v046-b12

操作员读代码并实测：测试 agent 的一次运行中途被中止时，`prepareAcceptance` 直接抛出 `AbortError`，不按失败返回，也不记 `tester.finished`。接线（v046-b15）调的就是这个函数，先修。
另有两条 v046-b14 加的测试守不住自己的名字，一并改实。这一批不改 `src/run.ts`。

条目：
1. 读 SPEC 16.15 的「`prepareAcceptance` 里运行器抛错的两种情形」一段。`src/acceptance.ts`：照那四条做。顺手去掉没用的变量 `lastMisclassified`（没有声明类别标错时，失败返回值的 `misclassified` 仍是空数组）。
   **假测试 agent 在第 1 次运行中途让 `signal` 中止，`testerMax` 是 2：`prepareAcceptance` 不抛错，返回 `ok` 为 false、`attempts` 为 1、`reason` 为 `tester_failed`；运行器只被调用 1 次；**
   **`record` 收到 `tester.started` 与 `tester.finished` 各 1 条，后者带 `error`；私有临时目录里没有留下 `collie-accept-*`**
   **第 1 次运行器抛出普通错误（`signal` 没有中止）、第 2 次正常且红检查通过：返回 `ok` 为 true、`attempts` 为 2，第 2 次的提示词里有第 1 次的错误信息**
2. `test/prepare-acceptance.test.ts` 新加一组 `describe('prepareAcceptance: abort and runner errors', …)`：条目 1 加粗的两种情形；两次都抛普通错误 → `tester_failed`、`attempts` 为 2、`problems` 里有错误信息；
   `onTesterEvent` 在第 2 次拉起时第一个参数是 2（现在只测了第 1 次）。
   R1 查过现有用例：这个文件里没有一条让运行器抛错（假测试 agent 的场景都给的是返回值）；`signal aborted before next attempt → tester_failed, no second invocation` 用的是一开始就中止的信号，一次都不拉起，行为不变；
   `injected redCheck throws → …` 与 `addWorktree fails (bad headSha) → …` 两条仍然应当抛错；`record receives events in the right order for two attempts` 的两次都正常结束，事件序列不变。
   `test/invariants.test.ts` 加「`src/acceptance.ts` 里没有 `lastMisclassified`」
3. `test/r2-commits.test.ts` 的两条用例改实。这两条点名允许改写，在「偏离或疑问」里列出原断言与现断言：
   `interrupt auto-retry: second run is not blocked by R2 retry commit`：现在 worker 是崩溃、没有走到中断重跑，断言包在 `if` 里，空过。改成真的走到中断重跑
   （做法照 `test/scenario-n.test.ts` 的 `idle once → interrupt retry → PASS → queue continues (exit 0)`），去掉 `if`，断言：队列 journal 里有 `why` 为 `interrupt_retry` 的 `queue.batch_started`；重跑那一次的 `spec_diff_lines` 是 0、结论 PASS；退出码 0。
   `R2 commit count in git log equals r2.commit count in journal`：现在只断言大于 0。改成真的比较：`git log` 里提交说明以 `docs: issue ` 或 `progress: ` 开头的提交的 sha 集合，等于 journal 里 `r2.commit` 的 sha 集合。
   别的现有用例因为本批次的新行为而失败时：只许做新行为直接要求的最小改动（往序列里加事件、个数加一这一类），不许删断言、不许把断言改松，在「偏离或疑问」里逐条列出原断言与现断言；拿不准是不是新行为直接要求的，才停下不改，写明是哪一条。

本批次只改 `src/acceptance.ts`、`test/prepare-acceptance.test.ts`、`test/r2-commits.test.ts`、`test/invariants.test.ts`。不应改动 `test/invariants.test.ts` 已有的任何断言。

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 没有 git 全局身份时两个文件的测试通过 | `e=$(mktemp) && GIT_CONFIG_GLOBAL=$e GIT_CONFIG_NOSYSTEM=1 npm test -- test/prepare-acceptance.test.ts test/r2-commits.test.ts` | exit 0 |
| 新的一组用例在 | `grep -qF "prepareAcceptance: abort and runner errors" test/prepare-acceptance.test.ts` | exit 0 |
| 没用的变量去掉了 | `! grep -qF "lastMisclassified" src/acceptance.ts` | exit 0 |
| 中断重跑那条不再空过 | `grep -qF "interrupt_retry" test/r2-commits.test.ts && ! grep -qE "if \(passEvents\.length > 0\)" test/r2-commits.test.ts` | exit 0 |
| 队列还没有用它（不看注释行） | `! grep -vE "^\s*(//\|\*\|/\*)" src/run.ts \| grep -qE "acceptance\.js"` | exit 0 |
| 不变量同步 | `grep -qF "lastMisclassified" test/invariants.test.ts` | exit 0 |

额外禁止：
- 改动任何受保护路径（含 `AGENT-tester.md`）；改动 `.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`
- 改动 `src/run.ts`、`src/redcheck.ts`、`src/evidence.ts`、`src/ladder.ts`、`src/roles/`、`src/runner/`、`src/schema/index.ts`、`test/support/sandbox.ts`；把这个模块接进队列
- 让红检查抛出的错误被吞掉；让 `prepareAcceptance` 往主仓库的工作区写文件、提交或推送
- 为了让测试过而删除或跳过任何测试；条目 3 点名的两条之外，删去或改松任何已有断言
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；用到机器的 git 全局配置；新增依赖

## v046-b17 接线收尾一：被跟踪文件不进提交、heartbeat 阶段改回、测试 agent 单独墙钟、放宽超时

优先级：81　依赖：v046-b15

（2026-11-20：本批次两次运行都因模型接口中断，没有完成；条目 1 与条目 3 还互相矛盾。已改签为 v046-b20，本批次保持 blocked，见 SPEC 14.30、16.17。）

接线第一块（v046-b15）跑起来之后，操作员在克隆里实测查出两处必须在带情形的批次正式跑之前修（SPEC 14.28）：测试 agent 改了主工作区里被跟踪的文件会被 R2 一起提交；worker 工作期间 heartbeat 的 `phase` 停在 `tester`。
再加测试 agent 单独的墙钟，并把两条高负载下会超时的用例放宽。改 R2，只动测试 agent 这一步相关的几处，不碰 worker / reviewer / 仲裁的判定。

条目：
1. 读 SPEC 16.16 的「v046-b17」一段与 14.28「b15 查出两处」。`src/run.ts`：上报原因是 `tester_touched_main_tree` 时，走上报路径之前先把主工作区恢复干净
   （在 `root` 里 `git checkout -- .` 再 `git clean -fd`，只在这一条路径上做），这样测试 agent 动过的被跟踪文件不会进 R2 的 `progress.md` / backlog 提交；被动过的文件名写进 `tester.md`（这条路径现在不写 `tester.md`，补上）。
   未跟踪的新文件照旧由「只提交点名路径」挡住。
   **假测试 agent 除了写验收测试还往主工作区被跟踪的 `docs/progress.md` 加一行：批次以 `tester_touched_main_tree` 上报、退出码 20；`git log` 里 R2 的提交都不含测试 agent 加的那一行；`tester.md` 列出了被动过的文件**
   同一处还有 heartbeat：测试 agent 这一步结束、拉起 worker 之前，`phase` 从 `tester` 改回 `worker`（worker 真正开始时本就有一处写 `worker`，现在的问题是它在测试 agent 之前；补一处即可）。
   **带情形的批次，worker 工作期间读 heartbeat，`phase` 是 `worker`，不是 `tester`**
2. `src/schema/index.ts` 与 `templates/collie.toml`：`[limits]` 加可选的 `worktree_secs`（正整数，缺省 1800，写法照 `tester_max`；模板写 `worktree_secs = 1800` 带一行注释）。
   测试 agent 这一步的墙钟（`src/run.ts` 里现在用 `wallclock_secs` 建的那个 `AbortSignal.timeout`）改用 `worktree_secs`。本仓库的 `.collie/collie.toml` 不许动。
   允许改写的旧用例只有：`test/config.test.ts` 的 `has the limits of SPEC 3.1`（期望对象加 `worktree_secs: 1800`）与内联 `VALID_TOML`；`test/schema.test.ts` 的夹具 `validConfig.limits`；每处在「偏离或疑问」里列出（这几处由本条点名）。
3. `test/queue-limit.test.ts`、`test/scenario-n.test.ts` 等真实跑多轮队列或真实起子进程的用例，`describe` / `it` 自带的超时从 120 秒放宽到 300 秒（只改数值，不改断言；慢机器高负载下 120 秒会到点）。
   `test/tester-step.test.ts` 新加一组 `describe('tester step: heartbeat and tracked-file safety', …)`：条目 1、2 加粗的情形；测试 agent 改未跟踪的新文件时照旧上报、文件留在工作区（和现有那条对比）。
   R1 查过现有用例：`test/view.test.ts` 的 `phase` 断言用的是不带情形的批次，不受影响；`tester step: failures stop the batch` 里 `tester writes to main workspace` 那条写的是未跟踪文件、只断言文件还在，本批次把它移进新组并补「被跟踪文件」的情形，原断言保留。
   已有断言除上面点名处外一条都不改；别的现有用例因为本批次的新行为而失败时的处理见下。
   `test/invariants.test.ts` 加「`src/run.ts` 里有 `worktree_secs`」
   别的现有用例因为本批次的新行为而失败时：只许做新行为直接要求的最小改动（往序列里加事件、个数加一这一类），不许删断言、不许把断言改松，在「偏离或疑问」里逐条列出原断言与现断言；拿不准是不是新行为直接要求的，才停下不改，写明是哪一条。

本批次只改 `src/run.ts`、`src/schema/index.ts`、`templates/collie.toml`、`test/tester-step.test.ts`、`test/queue-limit.test.ts`、`test/scenario-n.test.ts`、`test/config.test.ts`、`test/schema.test.ts`、`test/invariants.test.ts`。不应改动 `test/invariants.test.ts` 已有的任何数值上下限。

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 没有 git 全局身份时全部测试通过 | `e=$(mktemp) && GIT_CONFIG_GLOBAL=$e GIT_CONFIG_NOSYSTEM=1 npm test` | exit 0 |
| 接线那一步的测试通过 | `npm test -- test/tester-step.test.ts test/config.test.ts test/schema.test.ts` | exit 0 |
| 新的一组用例在 | `grep -qF "tester step: heartbeat and tracked-file safety" test/tester-step.test.ts` | exit 0 |
| 模板有新配置项，本仓库的配置没动 | `grep -qE "^worktree_secs = 1800" templates/collie.toml && ! grep -qE "worktree_secs" .collie/collie.toml` | exit 0 |
| 不变量同步 | `grep -qF "worktree_secs" test/invariants.test.ts` | exit 0 |

额外禁止：
- 改动任何受保护路径（含 `.collie/collie.toml`、`AGENT-*.md`）；改动 `.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`
- 改动 `src/acceptance.ts`、`src/redcheck.ts`、`src/roles/`、`src/runner/`、`src/arbiter.ts`、`src/gate.ts`、`src/evidence.ts`、`src/ladder.ts`、`src/backlog.ts`；改动任何一条规则的判定、`fix_max` 的计数、队列自动重跑的条件
- 把 `git checkout -- .` / `git clean` 用在 `tester_touched_main_tree` 以外的任何路径上；改变不带情形的批次的任何行为
- 为了让测试过而删除或跳过任何测试；改写条目 3 点名之外的任何已有断言（条目 4 只改超时数值）
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；用到机器的 git 全局配置；新增依赖

## v046-b18 接线收尾二：带情形的 worker 任务书多出情形与接口两节、写明验收测试不能改

优先级：82　依赖：v046-b15, v046-b20

带情形的批次，worker 现在拿到的 `task.md` 没有情形与接口两节，也没写验收测试在哪、不能改（v046-b15 真跑时看到的）。这一批给任务书补上。只改任务书的文字，不改任何判定。

条目：
1. 读 SPEC 16.16 的「v046-b18」一段。`src/roles/worker.ts` 的 `renderBody`（或它的调用处）：批次有情形时，`task.md` 在「本批次条目」之后、「验收标准」之前多两节：
   「本批次情形」——每条 `- <编号> [新|保持] <文字>`，和给测试 agent 的情形逐字相同；「本批次接口」——有接口才出现，每条一行；并在「验收标准」里或紧接一句写明
   「`test/acceptance/<批次>/` 下是本批次的验收测试，由测试 agent 写好，你不能改（受保护路径）」。
   批次没有情形时，`task.md` 逐字不变。
   **一个带 2 情形、1 接口的批次：渲染出的 `task.md` 里有「本批次情形」两条、「本批次接口」一条，以及「验收测试……你不能改」那句；一个不带情形的批次：渲染结果和现在逐字节相同**
2. `test/task-envelope.test.ts`：新加一组或在「body」组里加用例，覆盖条目 1 加粗的两种情形（有情形、无情形逐字不变）；
   现有的 `has the SPEC 3.3 section order` 用的是不带情形的批次，断言的小节清单不变，本批次不许改它。
   `test/worker.test.ts` 的闭环用例用的批次不带情形，应当照常通过。
   R1 查过：`test/task-envelope.test.ts` 的 body 组逐条跑 backlog 里的真实批次，这些批次现在都不带情形，所以渲染结果不变、现有断言不受影响。
   已有断言一条都不改；别的现有用例因为本批次的新行为而失败时的处理见下。
   别的现有用例因为本批次的新行为而失败时：只许做新行为直接要求的最小改动（往序列里加事件、个数加一这一类），不许删断言、不许把断言改松，在「偏离或疑问」里逐条列出原断言与现断言；拿不准是不是新行为直接要求的，才停下不改，写明是哪一条。

本批次只改 `src/roles/worker.ts`、`test/task-envelope.test.ts`。不应改动 `test/invariants.test.ts`。

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 任务书与 worker 的测试通过 | `npm test -- test/task-envelope.test.ts test/worker.test.ts` | exit 0 |
| 带情形时任务书有两节，不带情形时逐字不变——由新用例覆盖 | `grep -qE "本批次情形" src/roles/worker.ts && grep -qE "本批次接口" src/roles/worker.ts` | exit 0 |

额外禁止：
- 改动任何受保护路径（含 `AGENT-*.md`）；改动 `.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`
- 改动 `src/run.ts`、`src/acceptance.ts`、`src/redcheck.ts`、`src/roles/reviewer.ts`、`src/roles/tester.ts`、`src/backlog.ts`、`src/schema/index.ts`、`src/runner/`；改变不带情形的批次的任务书哪怕一个字节
- 在这一步校验情形、拉起谁、改任何判定
- 为了让测试过而删除或跳过任何测试；改写任何已有断言
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；新增依赖

## v046-b19 接线收尾三：why 与 report 显示测试 agent 的花费

优先级：83　依赖：v046-b18

测试 agent 这一步的轮数和花费现在只在 journal 里，`why` 与 `report` 看不到。这一批补上。只改显示，不改任何判定。

条目：
1. 读 SPEC 16.16 的「v046-b19」一段的第一条（第二条已由 R1 做完，见 16.17）。`src/view.ts`：`why <run_id>` 与 `report`（队列汇报）读本批次 journal 里的 `tester.started` / `tester.finished`，
   把测试 agent 的轮数、花费、用时显示出来，和 worker、reviewer 并列；一次运行里测试 agent 拉起多次时合计；没有 `tester.*` 事件的运行，不显示这一栏（输出和现在逐字节相同）。
   **一个有 `tester.finished`（带 `num_turns`、`cost_usd`、`duration_ms`）的运行：`why` 的输出里有测试 agent 的轮数与花费，`report` 那一行的合计花费把它算进去；一个没有 `tester.*` 的运行：`why` 与 `report` 的输出和现在逐字节相同**
2. `test/why.test.ts`、`test/report.test.ts`：条目 1 加粗的两种情形各加用例（有测试 agent；拉起两次时合计；无测试 agent 逐字不变）。
   R1 查过：这两个文件现有的用例里没有一条用到 `tester.*` 事件，所以「无测试 agent 逐字不变」成立时现有断言都不受影响。已有断言一条都不改。
   别的现有用例因为本批次的新行为而失败时：只许做新行为直接要求的最小改动（往序列里加事件、个数加一这一类），不许删断言、不许把断言改松，在「偏离或疑问」里逐条列出原断言与现断言；拿不准是不是新行为直接要求的，才停下不改，写明是哪一条。

本批次只改 `src/view.ts`、`test/why.test.ts`、`test/report.test.ts`。不应改动 `test/invariants.test.ts`。

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| why 与 report 的测试通过 | `npm test -- test/why.test.ts test/report.test.ts` | exit 0 |
| 视图读了测试 agent 的事件，两份测试都覆盖到 | `grep -qF "tester.finished" src/view.ts && grep -qF "tester.finished" test/why.test.ts && grep -qF "tester.finished" test/report.test.ts` | exit 0 |

额外禁止：
- 改动任何受保护路径（含 `AGENT-*.md`、`.collie/collie.toml`）；改动 `.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`
- 改动 `src/run.ts`、`src/acceptance.ts`、`src/redcheck.ts`、`src/roles/`、`src/arbiter.ts`、`src/gate.ts`、`src/evidence.ts`、`src/backlog.ts`、`src/schema/index.ts`、`src/runner/`；改任何判定
- 改变没有测试 agent 的运行的 `why` / `report` 输出哪怕一个字节
- 为了让测试过而删除或跳过任何测试；改写任何已有断言
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；新增依赖

## v046-b20 v046-b17 改签：测试 agent 动过的被跟踪文件恢复原样、heartbeat 与墙钟补测试、放宽超时，把主分支修绿

优先级：84　依赖：v046-b15

v046-b17 两次运行都因模型接口中断，没有完成；它做了一半的改动随救援提交 `bbdf673` 上了主分支，其中一处是错的，**主分支的 CI 现在是红的**：
`test/tester-step.test.ts` 的 `tester writes to main workspace → escalated with tester_touched_main_tree` 失败（全量测试恰好这 1 条）。那一处错在 R1 的条目（让你 `git clean -fd`，又要未跟踪的文件留着）。
这一批接着做完，并把主分支修绿。改 R2，只动测试 agent 这一步相关的几处。

条目：
1. 先读 SPEC 16.17 与 14.30 里讲主分支 CI 的那一段，再 `git show bbdf673` 看主分支上已有的半成品。`src/run.ts` 的 `tester_touched_main_tree` 路径：去掉 `git checkout -- .` 与 `git clean -fd`，换成 16.17 的做法：
   测试 agent 动过的被跟踪文件（改了内容的、删掉的）恢复成 HEAD 的样子；未跟踪的文件一个都不动；不执行 `git clean`；`tester.md` 分两节列出「恢复了的被跟踪文件」与「留在工作区的未跟踪文件」（哪一节没有就写「无」）。
   **假测试 agent 往主工作区被跟踪的 `docs/progress.md` 加一行，又新建一个未跟踪的 `rogue.txt`：以 `tester_touched_main_tree` 上报、退出码 20；`git log -p` 里没有任何提交含它加的那一行；`rogue.txt` 还在工作区、不在任何提交里；`tester.md` 两节各列出对应的那个文件**
   **现有用例 `tester writes to main workspace → escalated with tester_touched_main_tree` 一个字都不改，重新通过**
2. 半成品里另外三处是对的，留着，核对一遍并补上测试：`limits.worktree_secs`（`src/schema/index.ts`、`templates/collie.toml`；`test/config.test.ts` 的期望对象与内联配置、`test/schema.test.ts` 的夹具已经在半成品里加了这一项，
   这几处是点名允许的改写，照常在「偏离或疑问」里列出）；测试 agent 这一步的墙钟用 `worktree_secs`；测试 agent 这一步结束之后 heartbeat 的 `phase` 改回 `worker`。本仓库的 `.collie/collie.toml` 不许动。
   **带情形的批次：假 worker 在它的场景里读 `.collie/heartbeat.json`，`phase` 是 `worker`；`worktree_secs = 0` 的配置被拒绝，报错点名 `limits.worktree_secs`；不写这一项的配置能加载，值是 1800**
3. 测试。`test/tester-step.test.ts` 新加一组 `describe('tester step: heartbeat and tracked-file safety', …)`：条目 1、2 加粗的情形（配置的两条放 `test/config.test.ts` 新加的一组 `describe('config: worktree_secs', …)` 里）；
   再加一条：测试 agent 只删掉了一个被跟踪的文件 → 那个文件被恢复，`tester.md` 列在「恢复了的被跟踪文件」里。
   `test/queue-limit.test.ts` 第 188 行与 `test/follow.test.ts` 第 121 行两处 `describe` 自带的超时 `120_000` 改成 `300_000`（只改这两个数值）。
   `test/invariants.test.ts` 加「`src/run.ts` 里有 `worktree_secs`」与「`src/run.ts` 的非注释行里没有 `'clean'`（不在主仓库里执行 `git clean`）」。
   R1 查过现有用例：`test/view.test.ts` 里断言 `phase` 的用例用的是不带情形的批次，不受影响；`test/tester-step.test.ts` 现有 9 条里只有上面点名的那一条现在是红的，别的不受影响；
   `src/run.ts` 的非注释行里现在只有半成品那一处用到 `'clean'`。已有断言除条目 2 点名处外一条都不改。
   别的现有用例因为本批次的新行为而失败时：只许做新行为直接要求的最小改动（往序列里加事件、个数加一这一类），不许删断言、不许把断言改松，在「偏离或疑问」里逐条列出原断言与现断言；拿不准是不是新行为直接要求的，才停下不改，写明是哪一条。

本批次只改 `src/run.ts`、`src/schema/index.ts`、`templates/collie.toml`、`test/tester-step.test.ts`、`test/config.test.ts`、`test/schema.test.ts`、`test/queue-limit.test.ts`、`test/follow.test.ts`、`test/invariants.test.ts`。
不应改动 `test/invariants.test.ts` 已有的任何断言与数值上下限。

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 没有 git 全局身份时全部测试通过 | `e=$(mktemp) && GIT_CONFIG_GLOBAL=$e GIT_CONFIG_NOSYSTEM=1 npm test` | exit 0 |
| 接线那一步与配置的测试通过 | `npm test -- test/tester-step.test.ts test/config.test.ts test/schema.test.ts` | exit 0 |
| 两组新用例在 | `grep -qF "tester step: heartbeat and tracked-file safety" test/tester-step.test.ts && grep -qF "config: worktree_secs" test/config.test.ts` | exit 0 |
| 不在主仓库里执行 git clean（不看注释行） | `! grep -vE "^\s*(//\|\*\|/\*)" src/run.ts \| grep -qF "'clean'"` | exit 0 |
| 模板有新配置项，本仓库的配置没动 | `grep -qE "^worktree_secs = 1800" templates/collie.toml && ! grep -qE "worktree_secs" .collie/collie.toml` | exit 0 |
| 不变量同步 | `grep -qF "worktree_secs" test/invariants.test.ts` | exit 0 |

额外禁止：
- 改动任何受保护路径（含 `.collie/collie.toml`、`AGENT-*.md`）；改动 `.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`
- 改动 `src/acceptance.ts`、`src/redcheck.ts`、`src/roles/`、`src/runner/`、`src/arbiter.ts`、`src/gate.ts`、`src/evidence.ts`、`src/ladder.ts`、`src/backlog.ts`；改动任何一条规则的判定、`fix_max` 的计数、队列自动重跑的条件
- 在主仓库里执行 `git clean`，或用任何别的办法删除、移动测试 agent 留下的未跟踪文件；改变不带情形的批次的任何行为
- 为了让测试过而删除或跳过任何测试；改写条目 2 点名之外的任何已有断言（条目 3 的超时只改那两个数值）
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；用到机器的 git 全局配置；新增依赖

## v046-b21 没有测试 agent 的运行，why 与 report 的 JSON 里不出现测试 agent 的键（第一个带情形的批次）

优先级：85　依赖：v046-b19

这是第一个按新流程走的批次（SPEC 16.18）：下面的「情形」先由测试 agent 写成验收测试，放在 `test/acceptance/v046-b21/`，随 task 信封一起提交；worker 只写实现，不能改那个目录。
起因：v046-b19 之后，没有测试 agent 的运行，`why --json` 与 `report --json` 多出了值为 `null` 的新键，而那一批要求的是输出不变（SPEC 14.31）。

情形：
- S1 [新] 一次运行的 journal 里没有任何 `tester.` 开头的事件：`projectWhy` 得到的那个 attempt 对象没有 `tester` 这个键，它的 `cost` 对象也没有 `tester` 这个键；整个结果 `JSON.stringify` 之后不出现 `"tester":`
- S2 [新] 一个队列里每个批次的 journal 都没有任何 `tester.` 开头的事件：`projectReport` 得到的每一行 `batchRows` 都没有 `testerCost` 这个键；整个结果 `JSON.stringify` 之后不出现 `"testerCost":`
- K1 [保持] 一次运行的 journal 里有一条 `tester.finished`（`num_turns` 21、`cost_usd` 0.29、`duration_ms` 123000）：那个 attempt 的 `tester` 是 `turns` 21、`costUsd` 0.29、`durationMs` 123000、`invocations` 1，`cost.tester` 是 0.29；`formatWhy` 的文字里有以 `tester:` 开头的一行
- K2 [保持] 队列里一个批次的 journal 有一条 `tester.finished`（`cost_usd` 0.29）：`projectReport` 那一行的 `testerCost` 是 0.29；`formatReport` 的文字里有「tester 花费」这一列
- K3 [保持] 没有任何 `tester.` 开头事件的运行与队列：`formatWhy` 的文字里没有以 `tester:` 开头的行，`formatReport` 的文字里没有「tester 花费」

接口：
- `src/view.ts` 已有的导出，签名都不变：`loadRuns(root)`、`projectWhy(runDataList, batchId, filterAttempt?)`、`formatWhy(proj)`、`projectReport(allRunData, queueEvents, queueRunId)`、`formatReport(proj, whyTexts, showQueueText, queueRemainingText)`
- 类型 `RunData` 在 `src/view.ts`，`Event` 在 `src/schema/index.ts`；journal 是 `.collie/runs/<run_id>/events.ndjson`，一行一个事件

条目：
1. 读 SPEC 16.18 的「第一个带情形的批次」一段与 14.31 里「判 PASS 之后才查出来的三处」的第 1 条。`src/view.ts`：一次运行（或一个批次）的 journal 里没有 `tester.finished` 事件时，
   `projectWhy` 的 attempt 对象不带 `tester` 键、它的 `cost` 不带 `tester` 键，`projectReport` 的行不带 `testerCost` 键（类型上改成可选；不要输出值为 `null` 或 `undefined` 的占位）。
   有 `tester.finished` 时这三处与现在相同。`formatWhy`、`formatReport` 的文字输出一个字节都不变。
2. 现有用例里断言这三处是 `null` 的两条，改成断言键不存在。这是点名允许的改写，在「偏离或疑问」里列出原断言与现断言：
   `test/why.test.ts` 的 `no tester events: output identical to run without tester (tester field null)`（`a.tester` 与 `a.cost.tester` 两行；用例名里的 `tester field null` 相应改掉）；
   `test/report.test.ts` 的 `no tester events: output byte-identical (no tester column)`（`row.testerCost` 一行）。
   R1 查过：全部测试里断言这三个键为 `null` 的只有这三行；没有用例对 `cost` 或整行做整体的 `toEqual`。
   别的现有用例因为本批次的新行为而失败时：只许做新行为直接要求的最小改动（往序列里加事件、个数加一这一类），不许删断言、不许把断言改松，在「偏离或疑问」里逐条列出原断言与现断言；拿不准是不是新行为直接要求的，才停下不改，写明是哪一条。

本批次只改 `src/view.ts`、`test/why.test.ts`、`test/report.test.ts`。`test/acceptance/` 下的文件你不能改：你认为某条验收测试写错了，停下，在「偏离或疑问」里写明是哪一条、错在哪。

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过（含验收测试） | `npm test` | exit 0 |
| 本批次的验收测试通过 | `npm test -- test/acceptance/v046-b21` | exit 0 |

额外禁止：
- 改动任何受保护路径（含 `test/acceptance/`、`AGENT-*.md`、`.collie/collie.toml`）；改动 `.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`
- 改动 `src/view.ts` 之外的 `src/` 文件；改变 `formatWhy`、`formatReport` 的文字输出；改变有测试 agent 时的 JSON
- 为了让测试过而删除或跳过任何测试；改写条目 2 点名之外的任何已有断言
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；新增依赖

## v046-b22 批次在队列里最终被拦时的收尾：撤销救援提交的改动、拿掉本批次的验收测试

优先级：86　依赖：v046-b20

所有者 2026-11-20 裁定 D12 选甲：救援提交会随之后的推送上主分支（v046-b17 的半成品让主分支红了一天）；批次在队列里最终被拦时，R2 自动把救援提交的改动撤掉。
同一处收尾还要把本批次的验收测试从树里拿掉（接线时留下没做的）。改 R2 的队列收尾，不改任何判定。

条目：
1. 读 SPEC 16.18 的「批次在队列里最终被拦时的收尾」一段（救援提交见 11.4）。`src/run.ts`：照那一段做，写成一个函数，在队列里两处调用：以 BLOCK 结束、规则 1 重跑与中断重跑都不适用（或已用过）、即将以 `blocked` 停下之前；超过 `fix_max`、即将以 `fix_max` 停下之前。
   提交经 `r2Commit`（记 `r2.commit`）。`src/schema/index.ts`：事件类型加 `batch.cleanup`、`batch.cleanup_failed`。单批次模式 `run <批次>` 不收尾。
   **队列里一个批次：第 1 次 worker 留下未提交的改动后被判空转（于是有救援提交），自动续跑的第 2 次又被判空转：队列以 `blocked` 结束，退出码 20；`git log` 最上面是 `progress: <批次> cleanup`，**
   **救援提交改过的文件恢复成开跑前的内容（`git diff <首次 base_sha> HEAD -- <那些文件>` 为空）；救援提交仍在历史里；journal 有 `batch.cleanup`，`reverted` 里是救援提交的 sha；这个提交记了 `r2.commit` 并推送了**
   **没有救援提交、树里也没有本批次验收测试的批次被拦：不多任何提交，journal 没有 `batch.cleanup`**
2. 同一个函数的另外几种情形：
   **带情形的批次超过 `fix_max`：收尾提交把 `test/acceptance/<批次>/` 从树里删掉（`removed_acceptance` 为 true）；worker 自己的代码提交一行不动**
   **撤销有冲突（救援提交之后，同一行又被 worker 后来的提交改过）：不留下半截的撤销，`git status --porcelain` 为空，记 `batch.cleanup_failed`；树里有本批次的验收测试时照样拿掉**
   **单批次模式 `run <批次>` 以 BLOCK 结束、有救援提交：不收尾，没有 `cleanup` 提交**
3. 新文件 `test/blocked-cleanup.test.ts`，用 `Sandbox` 与 `FakeRunner`，三组：
   `describe('blocked cleanup: rescue commits are reverted', …)`（条目 1 的情形；怎样让假 worker 被判空转，照 `test/scenario-n.test.ts` 的 `idle twice → exit 20 (BLOCK)`）；
   `describe('blocked cleanup: acceptance tests are removed', …)`（条目 2 第一条；带情形的沙箱批次、`[agent.tester]` 与注入的红检查照 `test/tester-step.test.ts`）；
   `describe('blocked cleanup: when it must not act', …)`（条目 2 后两条；以及队列以 `evidence_unavailable` 停下时不收尾）。
   允许改写的旧用例只有两处，在「偏离或疑问」里列出：`test/schema.test.ts` 的 `defines the v0.1 event types plus v0.2 and v0.3 types added so far`（个数 42 改成 44，加两条 `toContain`）；
   `test/invariants.test.ts` 的 `every await push( in run.ts has push_failed or verdict within 5 lines above (v03-b01-fix)`（上限 6 改成 7，前提是新加的推送恰好一处）。
   R1 查过：队列以 `blocked` 或 `fix_max` 结束的现有用例在 `test/scenario-n.test.ts`（2 条）、`test/scenario-j.test.ts`、`test/scenario-m.test.ts`、`test/queue-limit.test.ts`、`test/r2-commits.test.ts`；
   其中假 worker 留下过未提交改动的，队列结束时会多出一个收尾提交和 `r2.commit`、`verdict.pushed`、`batch.cleanup` 三条事件。`test/r2-commits.test.ts` 比较提交 sha 集合的那一条，收尾提交以 `progress: ` 开头并记了 `r2.commit`，应当仍然相等。
   单批次模式的用例（`test/scenario-e.test.ts`、`test/scenario-i.test.ts`、`test/show.test.ts` 里有救援提交的那些）不应受影响。
   别的现有用例因为本批次的新行为而失败时：只许做新行为直接要求的最小改动（往序列里加事件、个数加一这一类），不许删断言、不许把断言改松，在「偏离或疑问」里逐条列出原断言与现断言；拿不准是不是新行为直接要求的，才停下不改，写明是哪一条。
   `test/invariants.test.ts` 另加「`src/run.ts` 里有 `batch.cleanup`」

本批次只改 `src/run.ts`、`src/schema/index.ts`、`test/blocked-cleanup.test.ts`、`test/schema.test.ts`、`test/invariants.test.ts`。

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 没有 git 全局身份时新测试通过 | `e=$(mktemp) && GIT_CONFIG_GLOBAL=$e GIT_CONFIG_NOSYSTEM=1 npm test -- test/blocked-cleanup.test.ts` | exit 0 |
| 三组用例在 | `grep -qF "blocked cleanup: rescue commits are reverted" test/blocked-cleanup.test.ts && grep -qF "blocked cleanup: acceptance tests are removed" test/blocked-cleanup.test.ts && grep -qF "blocked cleanup: when it must not act" test/blocked-cleanup.test.ts` | exit 0 |
| 两个事件进了类型清单 | `grep -qF "batch.cleanup_failed" src/schema/index.ts && grep -qE "'batch\.cleanup'" src/schema/index.ts` | exit 0 |
| 不在主仓库里执行 git clean（不看注释行） | `! grep -vE "^\s*(//\|\*\|/\*)" src/run.ts \| grep -qF "'clean'"` | exit 0 |
| 不变量同步 | `grep -qF "batch.cleanup" test/invariants.test.ts` | exit 0 |

额外禁止：
- 改动任何受保护路径；改动 `.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`、`templates/collie.toml`
- 改动 `src/arbiter.ts`、`src/gate.ts`、`src/evidence.ts`、`src/acceptance.ts`、`src/redcheck.ts`、`src/roles/`、`src/runner/`、`src/cli.ts`；改动任何一条规则的判定、`fix_max` 的计数、队列自动重跑的条件
- 撤销 worker 自己提交的代码；改写或删除历史里的提交（不许 `reset`、`rebase`、强推）；在主仓库里执行 `git clean`，或删除、移动未跟踪的文件；在单批次模式里收尾
- 为了让测试过而删除或跳过任何测试；改写条目 3 点名之外的任何已有断言
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；用到机器的 git 全局配置；新增依赖

## v046-b23 模型接口出错的 worker 会话算可续跑的中断：先等一段时间，自动续跑一次

优先级：87　依赖：v046-b22

（2026-11-20：本批次因模型接口出错中断，没有完成，没有代码提交。R1 之后推了规格的改动，按 11.7 不能重跑；原样改签为 v046-b26，本批次保持 blocked，见 SPEC 14.32。）

所有者 2026-11-20 裁定 D11：worker 的会话因为模型接口出错而结束，算可续跑的中断。第十六、十九两次队列都因为它只跑了一批就停，其中一次 worker 的活已经做完、只差汇报。
改运行器与 R2 的队列，不改任何判定。

条目：
1. 读 SPEC 16.18 的「模型接口出错的会话算可续跑的中断」一段（中断后自动重跑见 13.14）。`src/runner/claude.ts` 与 `src/runner/index.ts`：读结果消息里的 `terminal_reason`；`RunResult.stopReason` 的取值加 `api_error`，
   先后是 `stopped` > `turns_exhausted` > `api_error` > `error`。
   **结果消息是 `subtype: success`、`is_error: true`、`terminal_reason: api_error`：返回值的 `exitCode` 非零、`stopReason` 是 `api_error`；同样的消息、会话是被中止的：`stopped`；出错而没有 `terminal_reason` 的消息：仍是 `error`**
2. `src/run.ts`、`src/schema/index.ts`、`templates/collie.toml`：`[limits]` 加可选的 `api_retry_wait_secs`（非负整数，缺省 300，写法照 `tester_max`；模板写 `api_retry_wait_secs = 300` 带一行注释）。本仓库的 `.collie/collie.toml` 不许动。
   队列里 `api_error` 与 `idling`、`stalled`、`wallclock` 一样算中断，共用每个批次每次队列一次的自动续跑；只有 `api_error` 在续跑之前先等 `api_retry_wait_secs`，`batch.retried` 多带 `waited_secs`。
   等待经可注入的函数做：`QueueContext` 加可选的 `retryDelay(ms)`（缺省真实等待），`src/cli.ts` 只做转发。v046-b22 的收尾仍在所有自动重跑的判断之后。
   **队列里 worker 第 1 次以 `api_error` 结束、没有 report：注入的等待函数收到 300000，然后自动重跑一次，`batch.retried` 是 `cause: interrupted`、`stop_reason: api_error`、`waited_secs: 300`；重跑 PASS：队列继续，退出码 0**
   **重跑又以 `api_error` 结束：不再重跑，队列以 `blocked` 结束，退出码 20；第 1 次是 `idling` 的重跑不等，等待函数没有被调用**
3. 测试。`test/runner-claude.test.ts` 新加一组 `describe('runner: api_error stop reason', …)`（条目 1 的三种情形）；新文件 `test/api-error-retry.test.ts`，一组 `describe('queue: api_error counts as a resumable interruption', …)`（条目 2 的情形；假 worker 的返回值直接给 `stopReason: 'api_error'`）。
   允许改写的旧用例只有：`test/config.test.ts` 的 `has the limits of SPEC 3.1`（期望对象加 `api_retry_wait_secs: 300`）与内联配置 `VALID_TOML`（跟着模板加一行）；`test/schema.test.ts` 的夹具 `validConfig.limits`（加这一项）。在「偏离或疑问」里列出。
   R1 查过：`test/runner-claude.test.ts` 现有 6 处断言 `stopReason` 是 `error` 的用例，夹具都不带 `terminal_reason`，不受影响；`test/scenario-n.test.ts` 的 `worker crash → no interrupt retry` 里 worker 是抛错，结束原因是 `error`，仍然不重跑；
   全部测试里现在没有一处用到 `terminal_reason` 或 `api_error`。测试要注入等待函数而 `test/support/sandbox.ts` 传不过去时，可以给它加转发，在「偏离或疑问」里写明。
   别的现有用例因为本批次的新行为而失败时：只许做新行为直接要求的最小改动（往序列里加事件、个数加一这一类），不许删断言、不许把断言改松，在「偏离或疑问」里逐条列出原断言与现断言；拿不准是不是新行为直接要求的，才停下不改，写明是哪一条。
   `test/invariants.test.ts` 加「`src/run.ts` 里有 `api_error`」

本批次只改 `src/runner/claude.ts`、`src/runner/index.ts`、`src/run.ts`、`src/schema/index.ts`、`src/cli.ts`、`templates/collie.toml`、`test/runner-claude.test.ts`、`test/api-error-retry.test.ts`、`test/config.test.ts`、`test/schema.test.ts`、`test/invariants.test.ts`
（以及上面说的 `test/support/sandbox.ts`）。不应改动 `test/invariants.test.ts` 已有的任何断言与数值上下限。

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 运行器、队列、配置的测试通过 | `npm test -- test/runner-claude.test.ts test/api-error-retry.test.ts test/scenario-n.test.ts test/config.test.ts test/schema.test.ts` | exit 0 |
| 两组新用例在 | `grep -qF "runner: api_error stop reason" test/runner-claude.test.ts && grep -qF "queue: api_error counts as a resumable interruption" test/api-error-retry.test.ts` | exit 0 |
| 模板有新配置项，本仓库的配置没动 | `grep -qE "^api_retry_wait_secs = 300" templates/collie.toml && ! grep -qF "api_retry_wait_secs" .collie/collie.toml` | exit 0 |
| 运行器与队列都认得 api_error（不看注释行） | `grep -vE "^\s*(//\|\*\|/\*)" src/runner/claude.ts \| grep -qF "api_error" && grep -vE "^\s*(//\|\*\|/\*)" src/run.ts \| grep -qF "api_error"` | exit 0 |
| 不变量同步 | `grep -qF "api_error" test/invariants.test.ts` | exit 0 |

额外禁止：
- 改动任何受保护路径（含 `.collie/collie.toml`）；改动 `.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`
- 改动 `src/arbiter.ts`、`src/gate.ts`、`src/evidence.ts`、`src/acceptance.ts`、`src/redcheck.ts`、`src/roles/`、`src/ladder.ts`、`src/view.ts`；改动任何一条规则的判定、`fix_max` 的计数
- 让一个批次在一次队列里被自动续跑超过一次；让测试 agent 或 reviewer 的会话也走这条续跑；在测试里真的等待
- 为了让测试过而删除或跳过任何测试；改写条目 3 点名之外的任何已有断言
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；用到机器的 git 全局配置；新增依赖

## v046-b24 小修：reviewer 读这一次运行的信封；两处守不住的测试改实

优先级：88　依赖：v046-b20

三处小修。第一处改 R2：重跑时 worker 要是没有新的代码提交，reviewer 读到的是上一次的任务书（SPEC 14.27）。后两处是 v046-b20 留下的、守不住的测试（SPEC 14.31）。

条目：
1. 读 SPEC 16.18 的「小修」一段。`src/run.ts` 给 reviewer 准备工作目录的地方（现在只留本批次的 `task.md`）：那份 `task.md` 换成主工作区里这一次运行的信封（`.collie/batches/<批次>/task.md`），不用 `head_sha` 的树里的。目录里仍然只有 `task.md`，别的批次的目录不动。
   **同一个批次第 1 次判 FIX，第 2 次 worker 没有新的代码提交、只重写了 report：第 2 次 reviewer 的工作目录里，`task.md` 的 frontmatter `attempt` 是 2，正文有「上一轮判 FIX」一节；目录里只有 `task.md`**
2. 测试。`test/reviewer-rerun.test.ts` 新加一组 `describe('reviewer-rerun: task.md comes from the current run', …)`（条目 1 的情形；怎样记下 reviewer 工作目录里的东西，照这个文件现有的做法）。
   `test/tester-step.test.ts` 的 `tester only deletes a tracked file → that file is restored, listed in tester.md`：它删的是 `docs/progress.md`，R2 上报时本来就会重写这个文件，所以恢复被撤掉它也通过。
   改成删 `SPEC.md`，并断言恢复之后的内容与 HEAD 上的相同。这是点名允许的改写，在「偏离或疑问」里列出。
   同一个文件新加一条 `tester wallclock uses worktree_secs`：沙箱配置里 `worktree_secs = 1`、`wallclock_secs` 不动、不注入 `testerSignal`，假测试 agent 一直等到中止信号才结束 → 以 `tester_failed` 上报，退出码 20。
   假测试 agent 的场景拿不到中止信号时，可以给 `src/runner/fake.ts` 的场景上下文加上它，在「偏离或疑问」里写明。
   `test/reviewer-rerun.test.ts` 的 `reviewer-rerun: FIX then PASS` 一组的 `beforeEach` 在慢机器上两次到了 120 秒的钩子超时（SPEC 14.31、14.32）：给这一组的 `describe` 加 `{ timeout: 300_000 }`（钩子跟着用例的时限走），新加的一组同样加上。只改时限。
   R1 查过：`test/reviewer-rerun.test.ts` 现有用例断言的是目录里只有 `task.md`、`task.md` 存在、别的批次的目录没有被动，不看 `task.md` 的内容，不受影响。已有断言除点名的那一条外都不改。
   别的现有用例因为本批次的新行为而失败时：只许做新行为直接要求的最小改动（往序列里加事件、个数加一这一类），不许删断言、不许把断言改松，在「偏离或疑问」里逐条列出原断言与现断言；拿不准是不是新行为直接要求的，才停下不改，写明是哪一条。

本批次只改 `src/run.ts`、`test/reviewer-rerun.test.ts`、`test/tester-step.test.ts`（以及上面说的 `src/runner/fake.ts`）。不应改动 `test/invariants.test.ts`。

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 两个文件的测试通过 | `npm test -- test/reviewer-rerun.test.ts test/tester-step.test.ts` | exit 0 |
| 新的一组与新的一条在 | `grep -qF "reviewer-rerun: task.md comes from the current run" test/reviewer-rerun.test.ts && grep -qF "tester wallclock uses worktree_secs" test/tester-step.test.ts` | exit 0 |

额外禁止：
- 改动任何受保护路径；改动 `.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`、`templates/collie.toml`
- 改动 `src/acceptance.ts`、`src/redcheck.ts`、`src/roles/`、`src/arbiter.ts`、`src/gate.ts`、`src/evidence.ts`、`src/view.ts`、`src/schema/index.ts`；改任何判定
- 让 reviewer 的工作目录里出现 `task.md` 之外的信封文件（`report.md`、`verdict.md`、`tester.md`）
- 为了让测试过而删除或跳过任何测试；改写条目 2 点名之外的任何已有断言
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；用到机器的 git 全局配置；新增依赖

## v046-b25 收尾只提交自己改的路径：不提交未跟踪文件、冲突时只用 revert --abort

优先级：89　依赖：v046-b22

v046-b22 加的收尾（批次在队列里最终被拦时撤掉救援提交、拿掉验收测试）有两处问题，操作员实测、R1 读代码确认（SPEC 14.32）：它最后 `git add -A` 提交整个工作区，会把未跟踪的文件推上 `main`；冲突时用了 `git reset HEAD` 与 `git checkout .`，那条用例也守不住。
这一批只改 `batchCleanup`，不改它在什么时候被调用。

条目：
1. 读 SPEC 16.19（16.18 的收尾一段是背景）。`src/run.ts` 的 `batchCleanup`：只提交它自己改的路径（撤销了的救援提交改过的文件，与 `test/acceptance/<批次>/` 下被删的文件），经 `r2Commit` 传这些路径；
   去掉 `git add -A` 与提交 `.`；没有撤销任何救援提交、树里也没有本批次验收测试时，不提交、不推送、不记 `batch.cleanup`。
   **队列里一个带情形的批次以 `tester_touched_main_tree` 上报，主工作区留着测试 agent 新建的未跟踪 `rogue.txt`：没有 `cleanup` 提交，没有 `batch.cleanup` 事件；`rogue.txt` 还在工作区、不在任何提交里**
   **队列里假 worker 留下未提交的改动、两次被判空转（有救援提交），工作区里另有一个未跟踪的 `note.txt`：`cleanup` 提交只含救援提交改过的文件，`note.txt` 不在任何提交里、还在工作区**
2. 同一个函数的冲突处理：只执行 `git revert --abort`，不执行 `git reset`、`git checkout .`；放弃之后被跟踪的文件仍有改动时，记 `batch.cleanup_failed`（`reason: abort_left_changes`），什么都不提交；
   放弃干净了，记 `batch.cleanup_failed`（`reason` 以 `revert_conflict` 开头），树里有本批次验收测试时照常只提交删掉那个目录。
   **内容冲突（救援提交改了 `feature.txt` 的第 1 行，之后 worker 的提交又改了同一行）：没有任何提交里出现 `<<<<<<<`；`git status --porcelain` 里没有被跟踪文件的改动；journal 有 `batch.cleanup_failed`，`reason` 以 `revert_conflict` 开头**
3. 测试。`test/blocked-cleanup.test.ts` 新加一组 `describe('blocked cleanup: only its own paths', …)`：条目 1、2 加粗的三种情形（第一种照 `test/tester-step.test.ts` 让假测试 agent 写主工作区，第二、三种照这个文件第一组让假 worker 被判空转）。
   这个文件里现有的 6 条不改，都应当照常通过（R1 查过：它们的工作区里没有未跟踪文件，收尾提交里的路径不变）。
   `test/invariants.test.ts` 加两条：「`src/run.ts` 的非注释行里没有 `'reset'`」与「`src/run.ts` 的非注释行里 `['add', '-A']` 恰好一处（救援提交那一处）」。
   别的现有用例因为本批次的新行为而失败时：只许做新行为直接要求的最小改动（往序列里加事件、个数加一这一类），不许删断言、不许把断言改松，在「偏离或疑问」里逐条列出原断言与现断言；拿不准是不是新行为直接要求的，才停下不改，写明是哪一条。

本批次只改 `src/run.ts`、`test/blocked-cleanup.test.ts`、`test/invariants.test.ts`。不应改动 `test/invariants.test.ts` 已有的任何断言与数值上下限。

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 没有 git 全局身份时收尾的测试通过 | `e=$(mktemp) && GIT_CONFIG_GLOBAL=$e GIT_CONFIG_NOSYSTEM=1 npm test -- test/blocked-cleanup.test.ts` | exit 0 |
| 新的一组用例在 | `grep -qF "blocked cleanup: only its own paths" test/blocked-cleanup.test.ts` | exit 0 |
| 不再 reset（不看注释行） | `! grep -vE "^\s*(//\|\*\|/\*)" src/run.ts \| grep -qF "'reset'"` | exit 0 |
| `add -A` 只剩救援那一处（不看注释行） | `grep -vE "^\s*(//\|\*\|/\*)" src/run.ts \| grep -cF "['add', '-A']" \| grep -qx 1` | exit 0 |
| 不变量同步 | `grep -qF "'reset'" test/invariants.test.ts` | exit 0 |

额外禁止：
- 改动任何受保护路径；改动 `.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`、`templates/collie.toml`
- 改动 `batchCleanup` 被调用的位置与条件、任何一条规则的判定、`fix_max` 的计数、队列自动重跑的条件；改动 `src/` 下 `src/run.ts` 以外的文件
- 执行 `git reset`、`git clean`、`rebase`、强推；提交未跟踪文件；改写或删除历史里的提交
- 为了让测试过而删除或跳过任何测试；改写任何已有断言
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；用到机器的 git 全局配置；新增依赖

## v046-b26 （v046-b23 改签）模型接口出错的 worker 会话算可续跑的中断：先等一段时间，自动续跑一次

优先级：90　依赖：v046-b25

（v046-b23 因模型接口出错中断，没有完成，原样改签为本批次，见 SPEC 14.32、16.19。下面的条目、验收与额外禁止与 v046-b23 相同。）

所有者 2026-11-20 裁定 D11：worker 的会话因为模型接口出错而结束，算可续跑的中断。第十六、十九两次队列都因为它只跑了一批就停，其中一次 worker 的活已经做完、只差汇报。
改运行器与 R2 的队列，不改任何判定。

条目：
1. 读 SPEC 16.18 的「模型接口出错的会话算可续跑的中断」一段（中断后自动重跑见 13.14）。`src/runner/claude.ts` 与 `src/runner/index.ts`：读结果消息里的 `terminal_reason`；`RunResult.stopReason` 的取值加 `api_error`，
   先后是 `stopped` > `turns_exhausted` > `api_error` > `error`。
   **结果消息是 `subtype: success`、`is_error: true`、`terminal_reason: api_error`：返回值的 `exitCode` 非零、`stopReason` 是 `api_error`；同样的消息、会话是被中止的：`stopped`；出错而没有 `terminal_reason` 的消息：仍是 `error`**
2. `src/run.ts`、`src/schema/index.ts`、`templates/collie.toml`：`[limits]` 加可选的 `api_retry_wait_secs`（非负整数，缺省 300，写法照 `tester_max`；模板写 `api_retry_wait_secs = 300` 带一行注释）。本仓库的 `.collie/collie.toml` 不许动。
   队列里 `api_error` 与 `idling`、`stalled`、`wallclock` 一样算中断，共用每个批次每次队列一次的自动续跑；只有 `api_error` 在续跑之前先等 `api_retry_wait_secs`，`batch.retried` 多带 `waited_secs`。
   等待经可注入的函数做：`QueueContext` 加可选的 `retryDelay(ms)`（缺省真实等待），`src/cli.ts` 只做转发。v046-b22 的收尾仍在所有自动重跑的判断之后。
   **队列里 worker 第 1 次以 `api_error` 结束、没有 report：注入的等待函数收到 300000，然后自动重跑一次，`batch.retried` 是 `cause: interrupted`、`stop_reason: api_error`、`waited_secs: 300`；重跑 PASS：队列继续，退出码 0**
   **重跑又以 `api_error` 结束：不再重跑，队列以 `blocked` 结束，退出码 20；第 1 次是 `idling` 的重跑不等，等待函数没有被调用**
3. 测试。`test/runner-claude.test.ts` 新加一组 `describe('runner: api_error stop reason', …)`（条目 1 的三种情形）；新文件 `test/api-error-retry.test.ts`，一组 `describe('queue: api_error counts as a resumable interruption', …)`（条目 2 的情形；假 worker 的返回值直接给 `stopReason: 'api_error'`）。
   允许改写的旧用例只有：`test/config.test.ts` 的 `has the limits of SPEC 3.1`（期望对象加 `api_retry_wait_secs: 300`）与内联配置 `VALID_TOML`（跟着模板加一行）；`test/schema.test.ts` 的夹具 `validConfig.limits`（加这一项）。在「偏离或疑问」里列出。
   R1 查过：`test/runner-claude.test.ts` 现有 6 处断言 `stopReason` 是 `error` 的用例，夹具都不带 `terminal_reason`，不受影响；`test/scenario-n.test.ts` 的 `worker crash → no interrupt retry` 里 worker 是抛错，结束原因是 `error`，仍然不重跑；
   全部测试里现在没有一处用到 `terminal_reason` 或 `api_error`。测试要注入等待函数而 `test/support/sandbox.ts` 传不过去时，可以给它加转发，在「偏离或疑问」里写明。
   别的现有用例因为本批次的新行为而失败时：只许做新行为直接要求的最小改动（往序列里加事件、个数加一这一类），不许删断言、不许把断言改松，在「偏离或疑问」里逐条列出原断言与现断言；拿不准是不是新行为直接要求的，才停下不改，写明是哪一条。
   `test/invariants.test.ts` 加「`src/run.ts` 里有 `api_error`」

本批次只改 `src/runner/claude.ts`、`src/runner/index.ts`、`src/run.ts`、`src/schema/index.ts`、`src/cli.ts`、`templates/collie.toml`、`test/runner-claude.test.ts`、`test/api-error-retry.test.ts`、`test/config.test.ts`、`test/schema.test.ts`、`test/invariants.test.ts`
（以及上面说的 `test/support/sandbox.ts`）。不应改动 `test/invariants.test.ts` 已有的任何断言与数值上下限。

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 运行器、队列、配置的测试通过 | `npm test -- test/runner-claude.test.ts test/api-error-retry.test.ts test/scenario-n.test.ts test/config.test.ts test/schema.test.ts` | exit 0 |
| 两组新用例在 | `grep -qF "runner: api_error stop reason" test/runner-claude.test.ts && grep -qF "queue: api_error counts as a resumable interruption" test/api-error-retry.test.ts` | exit 0 |
| 模板有新配置项，本仓库的配置没动 | `grep -qE "^api_retry_wait_secs = 300" templates/collie.toml && ! grep -qF "api_retry_wait_secs" .collie/collie.toml` | exit 0 |
| 运行器与队列都认得 api_error（不看注释行） | `grep -vE "^\s*(//\|\*\|/\*)" src/runner/claude.ts \| grep -qF "api_error" && grep -vE "^\s*(//\|\*\|/\*)" src/run.ts \| grep -qF "api_error"` | exit 0 |
| 不变量同步 | `grep -qF "api_error" test/invariants.test.ts` | exit 0 |

额外禁止：
- 改动任何受保护路径（含 `.collie/collie.toml`）；改动 `.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`
- 改动 `src/arbiter.ts`、`src/gate.ts`、`src/evidence.ts`、`src/acceptance.ts`、`src/redcheck.ts`、`src/roles/`、`src/ladder.ts`、`src/view.ts`；改动任何一条规则的判定、`fix_max` 的计数
- 让一个批次在一次队列里被自动续跑超过一次；让测试 agent 或 reviewer 的会话也走这条续跑；在测试里真的等待
- 为了让测试过而删除或跳过任何测试；改写条目 3 点名之外的任何已有断言
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；用到机器的 git 全局配置；新增依赖

## v046-b27 开跑前检查：运行器退出码非零算不过，写出结束原因与用时

优先级：91　依赖：v046-b20

第二十二次队列开跑前，模型接口坏着：`preflight --smoke` 每次要 4 分钟，`runner` 一项写的是 `exitCode=1`，可这一项仍记 `ok`，整条命令退出码 0（SPEC 14.33）。
操作员是自己量用时、读那一行文字才拦下来的；`collie follow` 靠这条命令判断能不能开跑。改 `preflight` 与 `smoke` 两条命令对运行器结果的判断，不改队列。

条目：
1. 读 SPEC 14.33 的「开跑前检查的修补」一段（这条命令的来历在 14.1）。`src/preflight.ts` 的 `runner` 一项：运行器返回的退出码非零 → `ok` 为 false，`detail` 是 `exitCode=<N>`，返回值带 `stopReason` 时再加 ` stopReason=<原因>`；
   通过与不过的 `detail` 末尾都加 ` secs=<用时秒数，取整>`。用时经可注入的时钟算（缺省用真实时钟），测试里不许真的等。运行器抛错时照旧不过，`detail` 是错误信息。
   **假运行器返回 `exitCode: 1`、`stopReason: 'error'`：`preflight --smoke` 输出里有一行以 `FAIL runner: exitCode=1 stopReason=error` 开头，末行是 `preflight: failed (runner)`，命令的退出码非零；`--json` 里这一项的 `ok` 是 false**
   **假运行器返回 `exitCode: 0`：这一行以 `ok   runner: exitCode=0` 开头、带 `secs=`，命令的退出码是 0**
2. `src/cli.ts` 的 `collie smoke`：运行器返回的退出码非零 → 标准错误写 `smoke failed: exitCode=<N>`（有 `stopReason` 时带上），退出码 1，不再去查 CI，标准输出里没有 `smoke ok`。
   **假运行器返回 `exitCode: 1`：`collie smoke` 的退出码是 1，输出里有 `smoke failed: exitCode=1`、没有 `smoke ok`，CI 一次都没有被查询**
3. 测试。`test/preflight.test.ts` 新加一组 `describe('preflight: runner check judges the exit code', …)`（条目 1 的情形；`secs=` 用注入的时钟让它是一个确定的数）；`test/cli.test.ts` 新加一条 `smoke exits 1 when the runner returns a non-zero exit code`（条目 2 的情形）。
   R1 查过现有用例：`test/preflight.test.ts` 的 `--smoke adds runner and ci_query checks` 用的是 `exitCode: 0`，断言 `ok   runner`，仍然成立；`--smoke runner failure shows FAIL runner` 是运行器抛错，仍然成立；
   `test/cli.test.ts` 的 `smoke succeeds with a fake runner that returns a RunResult` 是 `exitCode: 0`，断言含 `smoke ok` 与 `exitCode=0`，仍然成立；`test/scenario-m.test.ts` 两条 `smoke exits 1 …` 的运行器都是成功的，不受影响；
   `test/follow.test.ts` 用假的子进程代替 `preflight`，不受影响。已有断言一条都不改。
   别的现有用例因为本批次的新行为而失败时：只许做新行为直接要求的最小改动（往序列里加事件、个数加一这一类），不许删断言、不许把断言改松，在「偏离或疑问」里逐条列出原断言与现断言；拿不准是不是新行为直接要求的，才停下不改，写明是哪一条。

本批次只改 `src/preflight.ts`、`src/cli.ts`、`test/preflight.test.ts`、`test/cli.test.ts`。不应改动 `test/invariants.test.ts`。

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 两条命令与用到它们的测试通过 | `npm test -- test/preflight.test.ts test/cli.test.ts test/scenario-m.test.ts test/follow.test.ts` | exit 0 |
| 新的一组与新的一条在 | `grep -qF "preflight: runner check judges the exit code" test/preflight.test.ts && grep -qF "smoke exits 1 when the runner returns a non-zero exit code" test/cli.test.ts` | exit 0 |
| 两条命令都有了不过的说法（不看注释行） | `grep -vE "^\s*(//\|\*\|/\*)" src/cli.ts \| grep -qF "smoke failed" && grep -vE "^\s*(//\|\*\|/\*)" src/preflight.ts \| grep -qF "stopReason"` | exit 0 |

额外禁止：
- 改动任何受保护路径；改动 `.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`、`templates/collie.toml`
- 改动 `src/run.ts`、`src/follow.ts`、`src/runner/`、`src/schema/index.ts`；改动 `preflight` 别的检查项、不带 `--smoke` 时的行为、队列开头那次检查
- 给用时加阈值或新的配置项（这一批只把用时写出来）；在 `detail` 或输出里写出模型的回复全文、token 或文件的绝对路径
- 为了让测试过而删除或跳过任何测试；改写任何已有断言
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；测试里真的等待；新增依赖

## v046-b28 测试改实：reviewer 信封、收尾的未跟踪文件与内容冲突三处造出真正的情形

优先级：92　依赖：v046-b25

v046-b24、b25 加的三处测试没有造出它们名字里说的情形，把修复撤掉照样全过（SPEC 14.34，操作员撤一次查出来的）。这一批只改测试，不改 `src/`。

条目：
1. 读 SPEC 14.34「判 PASS 之后才查出的测试缺口」与 16.20。`test/reviewer-rerun.test.ts` 的 `describe('reviewer-rerun: task.md comes from the current run', …)`：第 2 次 worker 改成**不提交任何代码**，只重写 `.collie/batches/<批次>/report.md` 并以 `report(collie): <批次>` 提交、推送，`head_sha` 仍写第 1 次的代码提交。
   这一组现有的 4 条断言不改，都应当照常通过。
   **把 `src/run.ts` 里「reviewer 的 `task.md` 用主工作区这一次的信封」那几行撤掉：这一组的 `attempt 2 reviewer sees task.md with attempt: 2 frontmatter` 必须失败**
2. `test/blocked-cleanup.test.ts` 的 `describe('blocked cleanup: only its own paths', …)` 里两条：
   `idle workers with note.txt → cleanup only commits rescue paths; note.txt stays`：去掉把 `note.txt` 放进 `.gitignore` 的做法，改成在救援之后、收尾之前的一个场景里（最后一个 reviewer 场景）往主工作区写一个真正未跟踪的 `note.txt`；
   `content conflict → revert_conflict; no merge markers; workspace clean`：改成真正的内容冲突，沙箱基准里先有 `feature.txt`（两行），救援提交改第 1 行，之后 worker 的提交又改同一行，`fix_max = 1`。
   两条用例名与现有断言不变，可以加断言。这两处是点名允许的改写，在「偏离或疑问」里列出改了什么。
   **把 `batchCleanup` 改回提交前 `git add -A`：`note.txt` 那条必须失败；把冲突处理里 `git revert --abort` 之后补上 `git checkout -- .` 与提交：`content conflict` 那条仍要守住「没有任何提交里出现 `<<<<<<<`」**
3. 不改 `src/`；不改 `test/invariants.test.ts`。R1 查过：这三条用例之外的现有用例不受影响。
   别的现有用例因为本批次的新行为而失败时：只许做新行为直接要求的最小改动（往序列里加事件、个数加一这一类），不许删断言、不许把断言改松，在「偏离或疑问」里逐条列出原断言与现断言；拿不准是不是新行为直接要求的，才停下不改，写明是哪一条。

本批次只改 `test/reviewer-rerun.test.ts`、`test/blocked-cleanup.test.ts`。

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 两个文件的测试通过 | `npm test -- test/reviewer-rerun.test.ts test/blocked-cleanup.test.ts` | exit 0 |
| 不再用 .gitignore 绕开未跟踪文件 | `! grep -qE "gitignore.*note\.txt\|note\.txt.*gitignore" test/blocked-cleanup.test.ts` | exit 0 |

额外禁止：
- 改动任何受保护路径；改动 `src/`、`.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`
- 用 `.gitignore`、改配置或跳过步骤的办法绕开要造的情形
- 为了让测试过而删除或跳过任何测试；删去或改松任何已有断言
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；用到机器的 git 全局配置；新增依赖

## v046-b29 同一个 head_sha 第二次被规则 9 降级就上报，不再自动重跑（D10）

优先级：93　依赖：v046-b26

所有者 2026-11-20 裁定 D10：同一个 `head_sha` 第二次被规则 9 降成 FIX 时，不再重跑，直接上报。现在照常重跑到 `fix_max`，v046-b08 因此白跑过两次（代码没变，CI 的结论不会变）。改 R2 的队列，不改仲裁。

条目：
1. 读 SPEC 16.20 的「v046-b29」一段（规则 9 见 12.3，超过 `fix_max` 的那条路与收尾见 16.18）。`src/run.ts` 的队列循环：批次判 FIX、降级规则是 9，而本批次此前（本机 journal 里）已有一次规则 9 降级、两次 `ci.resolved` 的 `head_sha` 相同：
   不再 `fix_retry`；记 `escalated`（`reason: rule9_same_head`、`batch_id`、`head_sha`），批次记 `blocked`，照超过 `fix_max` 那条路提交、推送、收尾，`queue.finished` 的 `reason` 是 `rule9_same_head`，退出码 20。
   `head_sha` 不同时照旧按 `fix_max` 计数重跑。以 `evidence_unavailable` 停下的判断仍在它之前。
   **队列里一个批次：第 1 次 CI 失败被规则 9 降成 FIX，自动重跑的第 2 次 worker 没有新提交、CI 仍失败：只重跑了一次，第 2 次之后队列以 `rule9_same_head` 停下，退出码 20，backlog 记 `blocked`，journal 有 `escalated`（`reason: rule9_same_head`，带 `head_sha`）**
   **同样两次规则 9，但第 2 次 worker 有新的代码提交（`head_sha` 不同）：照常第 3 次重跑（`fix_max` 是 2）**
2. `src/schema/index.ts` 不加新事件类型（复用 `escalated`）。允许改写的旧用例：`test/invariants.test.ts` 的 `every await push( …` 上限 7 改成 8，前提是新加的推送恰好一处（复用现有那条路就不用改）；在「偏离或疑问」里列出。
3. 新文件 `test/rule9-same-head.test.ts`，一组 `describe('queue: rule 9 twice on the same head_sha escalates', …)`：条目 1 的两种情形，再加一条：第 1 次规则 9 之后第 2 次 PASS → 照常放行、队列继续。
   CI 结论用注入的假 `fetch` 给（做法照 `test/scenario-l.test.ts` 的 `scenario L group c` 与 `test/verdict-ci-recheck.test.ts`）。
   R1 查过：`test/scenario-l.test.ts` 的 group c 是两个不同批次各一次规则 9（`rule9_twice`），不受影响；`test/queue-limit.test.ts`、`test/scenario-j.test.ts` 超过 `fix_max` 的用例里没有规则 9 降级，不受影响。
   `test/invariants.test.ts` 加「`src/run.ts` 里有 `rule9_same_head`」。
   别的现有用例因为本批次的新行为而失败时：只许做新行为直接要求的最小改动（往序列里加事件、个数加一这一类），不许删断言、不许把断言改松，在「偏离或疑问」里逐条列出原断言与现断言；拿不准是不是新行为直接要求的，才停下不改，写明是哪一条。

本批次只改 `src/run.ts`、`test/rule9-same-head.test.ts`、`test/invariants.test.ts`。

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 没有 git 全局身份时新测试通过 | `e=$(mktemp) && GIT_CONFIG_GLOBAL=$e GIT_CONFIG_NOSYSTEM=1 npm test -- test/rule9-same-head.test.ts` | exit 0 |
| 新的一组用例在 | `grep -qF "queue: rule 9 twice on the same head_sha escalates" test/rule9-same-head.test.ts` | exit 0 |
| 队列认得这条原因（不看注释行） | `grep -vE "^\s*(//\|\*\|/\*)" src/run.ts \| grep -qF "rule9_same_head"` | exit 0 |
| 不变量同步 | `grep -qF "rule9_same_head" test/invariants.test.ts` | exit 0 |

额外禁止：
- 改动任何受保护路径；改动 `.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`、`templates/collie.toml`
- 改动 `src/arbiter.ts`、`src/gate.ts`、`src/evidence.ts`、`src/acceptance.ts`、`src/roles/`、`src/runner/`、`src/schema/index.ts`；改动任何一条仲裁规则的判定、`rule9_twice` 的判断
- 在单批次模式里加这条判断；`head_sha` 不同时也停下
- 为了让测试过而删除或跳过任何测试；改写条目 2 点名之外的任何已有断言
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；用到机器的 git 全局配置；新增依赖

## v046-b30 小修：rule9_same_head 只看这一次的 head_sha；api_error 续跑总带 waited_secs

优先级：94　依赖：v046-b29

v046-b29、b26 通过之后查出来的两处小问题（SPEC 14.35）。改 R2 的队列，不改仲裁。

条目：
1. 读 SPEC 16.21 的「v046-b30」一段与 14.35「查出来的两处」。`src/run.ts` 队列里 `rule9_same_head` 的判断：现在是「本批次历史上有某个 `head_sha` 被规则 9 降级过两次」，改成只看这一次——
   这一次运行的 `ci.resolved` 的 `head_sha`，等于本批次此前别的运行里被规则 9 降级那一次的 `head_sha`，才上报；`escalated` 的 `head_sha` 写这一次的。
   **一个批次在第一次队列里两次被规则 9 降级、`head_sha` 都是 A，以 `rule9_same_head` 停下。把 backlog 里它的状态格改回 pending 并提交，再跑一次队列：worker 这一次有新的代码提交（`head_sha` 是 B），CI 仍失败、被规则 9 降级 → 照常自动重跑，不上报；**
   **重跑时 worker 没有新提交、仍被规则 9 降级 → 以 `rule9_same_head` 停下，`escalated` 的 `head_sha` 是 B**
2. `src/run.ts`：`api_error` 的自动续跑，`batch.retried` 总带 `waited_secs`（`api_retry_wait_secs = 0` 时是 0）；别的中断原因仍不带这个字段。
   **沙箱配置里 `api_retry_wait_secs = 0`，worker 第 1 次以 `api_error` 结束：`batch.retried` 带 `waited_secs: 0`，然后照常重跑一次**
3. 测试。`test/rule9-same-head.test.ts` 加一条 `second queue with a new head_sha is retried, then escalates on its own repeat`（条目 1 的情形）；
   `test/api-error-retry.test.ts` 加一条 `api_error with api_retry_wait_secs = 0 still records waited_secs: 0`（条目 2 的情形）。
   R1 查过：`test/rule9-same-head.test.ts` 现有 3 条都在同一次队列里，结果不变；`test/api-error-retry.test.ts` 的 `idling first → retry does NOT wait, retryDelay never called` 断言 `idling` 的续跑不带 `waited_secs`，仍然成立。已有断言一条都不改。
   别的现有用例因为本批次的新行为而失败时：只许做新行为直接要求的最小改动（往序列里加事件、个数加一这一类），不许删断言、不许把断言改松，在「偏离或疑问」里逐条列出原断言与现断言；拿不准是不是新行为直接要求的，才停下不改，写明是哪一条。

本批次只改 `src/run.ts`、`test/rule9-same-head.test.ts`、`test/api-error-retry.test.ts`。不应改动 `test/invariants.test.ts`。

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 没有 git 全局身份时两个文件的测试通过 | `e=$(mktemp) && GIT_CONFIG_GLOBAL=$e GIT_CONFIG_NOSYSTEM=1 npm test -- test/rule9-same-head.test.ts test/api-error-retry.test.ts` | exit 0 |
| 两条新用例在 | `grep -qF "second queue with a new head_sha is retried, then escalates on its own repeat" test/rule9-same-head.test.ts && grep -qF "api_error with api_retry_wait_secs = 0 still records waited_secs: 0" test/api-error-retry.test.ts` | exit 0 |

额外禁止：
- 改动任何受保护路径；改动 `.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`、`templates/collie.toml`
- 改动 `src/` 下 `src/run.ts` 以外的文件；改动任何一条仲裁规则的判定、`fix_max` 的计数、`rule9_twice` 的判断、收尾（`batchCleanup`）
- 为了让测试过而删除或跳过任何测试；改写任何已有断言
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；测试里真的等待；用到机器的 git 全局配置；新增依赖

## v046-b31 CI、lint、测试配置列为受保护路径，变异清单加三项（第 16 章第 2 步）

优先级：95　依赖：v046-b29

分工改造第 2 步（SPEC 第 16 章，所有者 2026-11-17 裁定的原 D1）：`.github/`、`eslint.config.js`、`vitest.config.ts` 定义的是检查本身，worker 不能随手改（v045-b07 的 worker 改过 `eslint.config.js` 给自己的目录豁免规则）。
这一批把它们列为受保护路径。以后要改它们靠批次授权，那是下一批（v046-b32）。

条目：
1. 读 SPEC 16.21 的「v046-b31」一段。`src/evidence.ts` 的 `PROTECTED_PATHS` 加三项：`.github`、`eslint.config.js`、`vitest.config.ts`（写法照现有各项，每项一行）。
   **worker 的提交改了 `.github/workflows/ci.yml`、`eslint.config.js`、`vitest.config.ts` 当中任何一个：`spec_diff_lines` 大于 0（于是按规则 2 拦停）**
2. `scripts/mutation.ts` 的清单加三项 `protected:.github`、`protected:eslint.config.js`、`protected:vitest.config.ts`（写法照已有的 10 项），共 46 项；清单上方注释里的项数相应改掉。
3. 测试。`test/evidence.test.ts` 加一组 `it.each`，用例名 `counts %s as protected (SPEC 16.21)`，三个路径是 `.github/workflows/ci.yml`、`eslint.config.js`、`vitest.config.ts`；
   `test/mutation.test.ts` 的 `every protected path is in the mutation list`：10 改成 13（点名允许的改写，在「偏离或疑问」里列出）；
   `test/invariants.test.ts` 加一条，用例名 `src/evidence.ts has .github, eslint.config.js and vitest.config.ts in PROTECTED_PATHS (v046-b31)`。
   R1 查过：`test/mutation.test.ts` 的 `has at least 42 items` 用的是「不少于」，不用改；`test/prepare-acceptance.test.ts`、`test/redcheck.test.ts` 往自己的临时仓库里写 `vitest.config.ts`，不经过 R2 的取证，不受影响；
   没有现有测试让假 worker 的提交带上这三类文件再去取证。
   别的现有用例因为本批次的新行为而失败时：只许做新行为直接要求的最小改动（往序列里加事件、个数加一这一类），不许删断言、不许把断言改松，在「偏离或疑问」里逐条列出原断言与现断言；拿不准是不是新行为直接要求的，才停下不改，写明是哪一条。

本批次只改 `src/evidence.ts`、`scripts/mutation.ts`、`test/evidence.test.ts`、`test/mutation.test.ts`、`test/invariants.test.ts`。不应改动 `test/invariants.test.ts` 已有的任何断言与数值上下限。
注意：你不能改 `.github/`、`eslint.config.js`、`vitest.config.ts` 这三处本身，只是把它们的名字加进清单。

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 取证与变异清单的测试通过 | `npm test -- test/evidence.test.ts test/mutation.test.ts` | exit 0 |
| 三个路径进了清单，新用例在 | `grep -qF "'.github'," src/evidence.ts && grep -qF "'eslint.config.js'," src/evidence.ts && grep -qF "'vitest.config.ts'," src/evidence.ts && grep -qF "as protected (SPEC 16.21)" test/evidence.test.ts` | exit 0 |
| 变异检查全部被发现，工作区里没有留下报告 | `out=$(npx tsx scripts/mutation.ts 2>&1) && printf '%s\n' "$out" \| tail -n 1 \| grep -qE "^mutation: caught 46 survived 0 invalid 0 timeout 0 stale 0$" && ! test -e .vitest` | exit 0 |
| 不变量同步 | `grep -qF "in PROTECTED_PATHS (v046-b31)" test/invariants.test.ts` | exit 0 |

额外禁止：
- 改动任何受保护路径；改动 `.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`、`templates/collie.toml`
- 改动 `src/` 下 `src/evidence.ts` 以外的文件；改动任何一条仲裁规则的判定；从 `PROTECTED_PATHS` 里去掉或改写已有的项
- 为了让测试过而删除或跳过任何测试；改写条目 3 点名之外的任何已有断言
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；用到机器的 git 全局配置；新增依赖

## v046-b32 批次授权：条目点名的受保护路径由 worker 改，不计入受保护文件改动行数（D9）

优先级：96　依赖：v046-b31

所有者 2026-11-20 裁定 D9：CI、lint、测试配置受保护之后，要改它们由 R1 在批次里点名授权、worker 来改，R2 对点名的路径不按规则 2 拦，别的照拦。这一批让 backlog、任务书和取证认得这种授权。不改仲裁规则本身。

条目：
1. 读 SPEC 16.21 的「v046-b32」一段。`src/backlog.ts`、`src/schema/index.ts`：批次可以多一个可选小节，标签是「可改的受保护路径」加冒号（全角半角都认，写法照 `LABEL_INTERFACES`），下面是 `- <路径>` 的列表（允许空行，照「接口」一节）；
   解析结果多一个可选字段 `allowed_protected`。能点名的只有 `.github`、`.github/` 下的路径、`eslint.config.js`、`vitest.config.ts`；别的一律报错并指出是哪一项。
   `src/roles/worker.ts`：有这一节时，`task.md` 在「本批次条目」之后多一节「本批次可改的受保护路径」，逐条列出，后面一句「只做条目要求的改动，并在『偏离或疑问』里列出改了什么」。
   **批次有这一节、两行是 `- vitest.config.ts` 与 `- .github/workflows/ci.yml`：`allowed_protected` 是这两项，`task.md` 里有「本批次可改的受保护路径」一节两条；**
   **点名 `SPEC.md`、`docs/backlog.md`、`test/acceptance/x.test.ts`、`.collie/collie.toml`、`../x`、`/etc/x`、`.github/*` 当中任何一个：解析报错，错误信息里有那一项；没有这一节的批次：没有 `allowed_protected` 这个键，`task.md` 逐字节不变**
2. `src/evidence.ts`、`src/run.ts`：取证时把本批次 `allowed_protected` 里的路径排除在受保护文件改动行数之外，这部分行数另记在 `evidence.collected` 事件的 `authorized_diff_lines`（批次没有授权时不带这个字段）。别的受保护路径照计。
   **批次授权了 `vitest.config.ts`，worker 的提交只改了它和普通源码：`spec_diff_lines` 是 0，`evidence.collected` 带 `authorized_diff_lines` 且大于 0，reviewer 判 PASS 时批次通过；**
   **同一个批次 worker 还改了 `eslint.config.js`（没有授权）：`spec_diff_lines` 大于 0，按规则 2 拦停；没有授权的批次改了 `vitest.config.ts`：按规则 2 拦停，`evidence.collected` 不带 `authorized_diff_lines`**
3. 测试。`test/backlog.test.ts` 新加一组 `describe('backlog: allowed protected paths', …)`（条目 1 的解析情形）；`test/task-envelope.test.ts` 加条目 1 里任务书的两种情形；
   新文件 `test/batch-authorisation.test.ts`，一组 `describe('batch authorisation: named protected paths do not count', …)`，用 `Sandbox` 与 `FakeRunner` 跑条目 2 的三种情形（沙箱 backlog 的写法照 `test/tester-step.test.ts` 里带「情形」的那种，自己拼小节）。
   `test/invariants.test.ts` 加「`src/backlog.ts` 里有 `可改的受保护路径`」与「`src/run.ts` 里有 `authorized_diff_lines`」。
   R1 查过：`docs/backlog.md` 现有的批次都没有这一节，`test/task-envelope.test.ts` 逐条跑真实批次的那两组不受影响；`evidence.collected` 只在有授权时多一个字段，`test/exit-codes.test.ts` 的事件序列不变；
   `BatchSchema` 加的是可选字段，现有夹具不用改。已有断言一条都不改。
   别的现有用例因为本批次的新行为而失败时：只许做新行为直接要求的最小改动（往序列里加事件、个数加一这一类），不许删断言、不许把断言改松，在「偏离或疑问」里逐条列出原断言与现断言；拿不准是不是新行为直接要求的，才停下不改，写明是哪一条。

本批次只改 `src/backlog.ts`、`src/schema/index.ts`、`src/roles/worker.ts`、`src/evidence.ts`、`src/run.ts`、`test/backlog.test.ts`、`test/task-envelope.test.ts`、`test/batch-authorisation.test.ts`、`test/invariants.test.ts`。
不应改动 `test/invariants.test.ts` 已有的任何断言与数值上下限。

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 没有 git 全局身份时新测试通过 | `e=$(mktemp) && GIT_CONFIG_GLOBAL=$e GIT_CONFIG_NOSYSTEM=1 npm test -- test/batch-authorisation.test.ts` | exit 0 |
| 解析、任务书、取证的测试通过 | `npm test -- test/backlog.test.ts test/task-envelope.test.ts test/evidence.test.ts test/batch-authorisation.test.ts` | exit 0 |
| 两组新用例在 | `grep -qF "backlog: allowed protected paths" test/backlog.test.ts && grep -qF "batch authorisation: named protected paths do not count" test/batch-authorisation.test.ts` | exit 0 |
| 解析与取证都认得授权（不看注释行） | `grep -vE "^\s*(//\|\*\|/\*)" src/backlog.ts \| grep -qF "可改的受保护路径" && grep -vE "^\s*(//\|\*\|/\*)" src/run.ts \| grep -qF "authorized_diff_lines"` | exit 0 |
| 变异检查仍然全部被发现 | `out=$(npx tsx scripts/mutation.ts 2>&1) && printf '%s\n' "$out" \| tail -n 1 \| grep -qE "^mutation: caught 46 survived 0 invalid 0 timeout 0 stale 0$" && ! test -e .vitest` | exit 0 |
| 不变量同步 | `grep -qF "authorized_diff_lines" test/invariants.test.ts` | exit 0 |

额外禁止：
- 改动任何受保护路径；改动 `.github/`、`eslint.config.js`、`vitest.config.ts`、`package.json`、`templates/collie.toml`、`scripts/mutation.ts`
- 改动 `src/arbiter.ts`、`src/gate.ts`、`src/acceptance.ts`、`src/redcheck.ts`、`src/roles/reviewer.ts`、`src/roles/tester.ts`、`src/runner/`；改动任何一条仲裁规则的判定；从 `PROTECTED_PATHS` 里去掉任何一项
- 让授权能点名那三类之外的路径；让授权来自 backlog 之外的任何地方（task、report、配置、环境变量）；有授权时把别的受保护路径也放过
- 为了让测试过而删除或跳过任何测试；改写任何已有断言
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；用到机器的 git 全局配置；新增依赖

## v046-b33 测试时限提到 300 秒（第一个用批次授权的批次）

优先级：97　依赖：v046-b32

`vitest.config.ts` 里用例与钩子的时限现在都是 120 秒。R1 的机器比操作员的机器慢十几倍，那里有两个测试文件的 `beforeEach` 要 160 秒左右，全量测试 3 次里有 2 次因此到点（SPEC 14.35）。没有任何断言依赖这两个数。
`vitest.config.ts` 是受保护路径（v046-b31）；这一批用下面的授权小节点名它，你只许改这一个文件。

条目：
1. 读 SPEC 16.22 的第一段。`vitest.config.ts`：`testTimeout` 与 `hookTimeout` 都改成 `300_000`，那一行的注释相应改成说明现在的值与原因（慢机器上钩子要 160 秒左右；没有断言依赖这个值）。别的配置项不动。
   在「偏离或疑问」里列出你对这个文件做的每一处改动。

可改的受保护路径：
- vitest.config.ts

本批次只改 `vitest.config.ts`。

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过 | `npm test` | exit 0 |
| 两个时限都是 300 秒 | `grep -qE "testTimeout: 300_000" vitest.config.ts && grep -qE "hookTimeout: 300_000" vitest.config.ts` | exit 0 |

额外禁止：
- 改动授权小节点名之外的任何受保护路径（含 `.github/`、`eslint.config.js`）；改动 `vitest.config.ts` 里两个时限与那一行注释之外的任何内容
- 改动 `src/`、`test/`、`scripts/`、`templates/`、`package.json`
- 为了让验收命令通过而改注释或字面（铁律 26）
- 新增依赖

## v046-b34 授权路径的两处补全：报错信息的说法、带 .. 的写法有测试守着（带情形）

优先级：98　依赖：v046-b32

v046-b32 加了批次授权。操作员核对时查出两处（SPEC 14.36）：报错信息里把 `.github/*` 列成能点名的写法，可它正好拒绝字面上的 `.github/*`；`.github/../SPEC.md` 这类写法现在是拒绝的，但没有测试守着。
这一批按新流程走：下面的「情形」先由测试 agent 写成验收测试，放在 `test/acceptance/v046-b34/`，随 task 信封一起提交；你只写实现，不能改那个目录。

情形：
- S1 [新] 批次的授权小节点名 `SPEC.md`：`parseBacklog` 抛出 `BacklogError`，它的 `message` 里有 `only .github, paths under .github/, eslint.config.js, vitest.config.ts`，并且整条 `message` 里不出现 `.github/*`
- K1 [保持] 授权小节点名 `.github/../SPEC.md`：`parseBacklog` 抛出 `BacklogError`，`message` 里有 `.github/../SPEC.md`
- K2 [保持] 授权小节点名 `.github/workflows/../../docs/backlog.md`：`parseBacklog` 抛出 `BacklogError`
- K3 [保持] 授权小节点名 `/etc/x`、`../x`、`.github/*`、`.github/workflows/?.yml` 当中任何一个：`parseBacklog` 抛出 `BacklogError`，`message` 里有被点名的那一项
- K4 [保持] 授权小节依次点名 `.github`、`.github/workflows/ci.yml`、`eslint.config.js`、`vitest.config.ts`：不报错，那个批次的 `allowed_protected` 就是这四项、次序相同
- K5 [保持] 没有授权小节的批次：解析结果里没有 `allowed_protected` 这个键

接口：
- `src/backlog.ts` 已有的导出，签名不变：`parseBacklog(text: string, source?: string): Batch[]`、`class BacklogError extends Error`（有 `message`、`batchId`、`line`）
- 授权小节的标签是「可改的受保护路径」后面跟一个冒号、独占一行，下面每行一个 `- <路径>`（SPEC 16.21）；一份最小的 backlog 文本怎么拼，照 `test/backlog.test.ts` 里 `describe('backlog: allowed protected paths', …)` 一组用的辅助函数

条目：
1. 读 SPEC 16.21 的「v046-b32」一段与 14.36「判 PASS 之后才查出来的」第 2、3 条。`src/backlog.ts`：授权小节里点名了不许点名的路径时，报错信息末尾括号里的说法改成
   `(only .github, paths under .github/, eslint.config.js, vitest.config.ts)`。哪些路径能点名、哪些被拒绝，一概不变。
2. `src/evidence.ts` 第 103 行附近那条注释里的「受保護」改成「受保护」（只改这一个字）。
   R1 查过：`test/backlog.test.ts` 的 `rejects %s as not allowable` 一组只断言报错信息里有被点名的那一项，改说法不影响它；别的测试没有断言这句括号里的文字。已有断言一条都不改。
   别的现有用例因为本批次的新行为而失败时：只许做新行为直接要求的最小改动（往序列里加事件、个数加一这一类），不许删断言、不许把断言改松，在「偏离或疑问」里逐条列出原断言与现断言；拿不准是不是新行为直接要求的，才停下不改，写明是哪一条。

本批次只改 `src/backlog.ts`、`src/evidence.ts`。`test/acceptance/` 下的文件你不能改：你认为某条验收测试写错了，停下，在「偏离或疑问」里写明是哪一条、错在哪。

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过（含验收测试） | `npm test` | exit 0 |
| 本批次的验收测试通过 | `npm test -- test/acceptance/v046-b34` | exit 0 |

额外禁止：
- 改动任何受保护路径（含 `test/acceptance/`、`AGENT-*.md`、`.collie/collie.toml`、`.github/`、`eslint.config.js`、`vitest.config.ts`）
- 改动 `src/backlog.ts`、`src/evidence.ts` 之外的 `src/` 文件；改变哪些路径能被授权；改动 `src/evidence.ts` 里那一个字之外的任何内容
- 为了让测试过而删除或跳过任何测试；改写任何已有断言
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；新增依赖

## v046-b35 没过的验收命令留下输出的末尾：进运行日志与重跑的任务书（带情形）

优先级：99　依赖：v046-b34

变异检查现在每次取证都跑。它没过时，R2 只在 `docs/progress.md` 里留输出的最后一行，`acceptance.failed` 事件与重跑的 task 里只有命令和退出码：哪一项没被发现，worker 要自己重跑才知道（SPEC 14.37）。
这一批让没过的验收命令把输出的末尾留下来。按新流程走：下面的「情形」先由测试 agent 写成验收测试，放在 `test/acceptance/v046-b35/`；你只写实现，不能改那个目录。

情形：
- S1 [新] `renderFixSection` 拿到的 `failedAcceptance` 里有一项是 `cmd` 为 `sh noisy.sh`、`exit_code` 为 1、`output_tail` 为两行文字 `line A` 与 `line B`：返回的文字里，`sh noisy.sh` 那一行之后有一个围栏代码块，块里依次是 `line A`、`line B` 两行
- S2 [新] 沙箱的全局验收命令里多一条 `sh noisy.sh`，它依次打印 `out 1` 到 `out 30` 共 30 行后以 1 退出；假 worker 如实提交、假 reviewer 判 PASS，跑一次：journal 里 `cmd` 为 `sh noisy.sh` 的 `acceptance.failed` 事件带 `output_tail`，按行拆开恰好 20 行，第一行是 `out 11`，最后一行是 `out 30`
- S3 [新] 同样的沙箱，`noisy.sh` 改成先打印一行 500 个 `x` 再以 1 退出：`output_tail` 里那一行恰好是 300 个 `x`
- S4 [新] 同样的沙箱，测试里把环境变量 `GITHUB_TOKEN` 设成 `tok-secret-12345`（用完还原），`noisy.sh` 打印一行 `token=tok-secret-12345` 后以 1 退出：`output_tail` 恰好是一行 `token=***`
- S5 [新] 接着 S2 那一次（结论是 FIX）再跑一次，第 2 次的假 worker 把它拿到的 `task.md` 读出来：`task.md` 里有单独成行的 `out 11`，也有单独成行的 `out 30`
- K1 [保持] `renderFixSection` 拿到的 `failedAcceptance` 里那一项不带 `output_tail`：返回的文字里有一行 ``- `sh noisy.sh` → exit 1``，并且「未通过的验收命令」那一节里没有围栏代码块
- K2 [保持] S2 那一次运行里，`acceptance.failed` 事件的 `cmd`、`exit_code`、`expect` 三个字段照旧都在；结论是 FIX、规则 8，退出码 10
- K3 [保持] 全局验收命令都通过的一次运行：journal 里没有 `acceptance.failed` 事件

接口：
- `src/run.ts` 已有的导出：`renderFixSection(info: FixInfo): string` 与类型 `FixInfo`。`FixInfo.failedAcceptance` 每一项现在是 `{ cmd, exit_code }`，本批次起多一个可选的 `output_tail?: string`（多行文字，用换行分隔）；实现之前类型上还没有它
- `acceptance.failed` 事件本批次起多一个字段 `output_tail`（字符串）；读事件用 `Sandbox` 的 `events()`
- 沙箱、假 worker、假 reviewer 怎么搭，照 `test/scenario-d.test.ts`（它就是「worker 如实、验收命令没过、reviewer 判 PASS」）与 `test/support/sandbox.ts` 导出的 `Sandbox`、`workerScene`、`fooledReviewerScene`、`honestClaims`、`TEST_CMD`；
  往全局验收命令里加一条的办法：改写沙箱里 `.collie/collie.toml` 的 `commands` 一行并提交，`noisy.sh` 写在沙箱仓库根并提交；第 2 次运行里读 `task.md` 的假 worker 自己写一个场景

条目：
1. 读 SPEC 16.23 的「没过的验收命令留下输出的末尾」一段。`src/run.ts`：记 `acceptance.failed` 的地方带上 `output_tail`；从上一次运行的 journal 重建 `failedAcceptance` 的地方把它取出来；`renderFixSection` 把它渲染成那条命令下面的围栏代码块。
   取多少行、每行截到多少字符写成具名常量（20、300）；脱敏用这次运行已有的那份清单，替换成 `***`；命令没有输出时不带这个字段。
2. 不许变的：`acceptance.failed` 原有的三个字段；`docs/progress.md` 里每条命令的摘要；`why` 与 `report` 的输出；命令通过时不记事件；事件类型的个数。
   R1 查过：`test/scenario-d.test.ts` 对 `acceptance.failed` 的断言用的是 `objectContaining`，多一个字段不影响；`test/scenario-n.test.ts`、`test/why.test.ts` 里涉及这个事件的用例不受影响。已有断言一条都不改。
   别的现有用例因为本批次的新行为而失败时：只许做新行为直接要求的最小改动（往序列里加事件、个数加一这一类），不许删断言、不许把断言改松，在「偏离或疑问」里逐条列出原断言与现断言；拿不准是不是新行为直接要求的，才停下不改，写明是哪一条。

本批次只改 `src/run.ts`（确有需要时加 `src/verify.ts`，在「偏离或疑问」里写明为什么）。`test/acceptance/` 下的文件你不能改：你认为某条验收测试写错了，停下，在「偏离或疑问」里写明是哪一条、错在哪。

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过（含验收测试） | `npm test` | exit 0 |
| 本批次的验收测试通过 | `npm test -- test/acceptance/v046-b35` | exit 0 |

额外禁止：
- 改动任何受保护路径（含 `test/acceptance/`、`AGENT-*.md`、`.collie/collie.toml`、`.github/`、`eslint.config.js`、`vitest.config.ts`）
- 改动 `src/arbiter.ts`、`src/gate.ts`、`src/evidence.ts`、`src/view.ts`、`src/progress.ts`、`src/schema/index.ts`、`src/roles/`、`src/runner/`；改任何一条规则的判定
- 把整段输出不截断、不脱敏地写进 journal 或 task
- 为了让测试过而删除或跳过任何测试；改写任何已有断言
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；用到机器的 git 全局配置；新增依赖

## v046-b36 worker 认为验收测试写错了：汇报里声明，R2 不拉审核、不计返工、上报停下（带情形）

优先级：100　依赖：v046-b34

分工改造第 4 步（SPEC 第 16 章）：验收测试是测试 agent 写的，worker 改不了。worker 认为某条验收测试和情形对不上时，现在只能在汇报里写一句，批次照常被判验收没过、返工到上限才停。
这一批给它一条正路：在汇报的 JSON 里声明，R2 就不拉审核、不计返工，直接上报停下，等 R1 裁定。按新流程走：下面的「情形」先由测试 agent 写成验收测试，放在 `test/acceptance/v046-b36/`；你只写实现，不能改那个目录。

情形：
- S1 [新] `ReportSchema` 解析一份别的字段都合法、另带 `disputed_tests` 的汇报，`disputed_tests` 是只有一项的数组，那一项的 `test` 为 `test/acceptance/v99-b01/new.test.ts: S1: x`、`why` 为 `情形要的是 A，测试断言的是 B`：解析成功，结果里这一项原样在
- S2 [新] 单批次运行（`run <批次>`），假 worker 照常提交代码与汇报，汇报的 JSON 里 `disputed_tests` 有 S1 的那一项，脚本里只给了 worker 一个场景：journal 里 `escalated` 事件的 `reason` 以 `acceptance_disputed: ` 开头并含 `S1: x`，它的 `disputed` 等于汇报里那个数组；`docs/progress.md` 里有「worker 认为验收测试有错」
- S3 [新] 汇报的 JSON 里 `disputed_tests` 是空数组，假 worker 如实、验收全过、假 reviewer 判 PASS：运行器被调用的先后是 worker、reviewer，退出码 0
- K1 [保持] 汇报的 JSON 里没有 `disputed_tests` 这个键，其余同 S3：运行器被调用的先后是 worker、reviewer，退出码 0，journal 里没有 `escalated`
- K2 [保持] `ReportSchema` 解析带 `disputed_tests` 的汇报，其中那一项的 `test` 是空串，或 `why` 是空串，或多出一个 `note` 键：三种都解析失败
- K3 [保持] S2 那一次运行：退出码 20；运行器只被调用 1 次、角色是 worker；journal 里没有 `reviewer.started`，也没有 `evidence.collected`（现在这样的汇报会被当成格式不对而上报，这几样已经如此；实现之后上报的原因变了，这几样不变）
- K4 [保持] 队列运行（`run --continue`），同 S2 的假 worker：退出码 20；`docs/backlog.md` 里这个批次的状态是 `blocked`；队列 journal 里这个批次的 `queue.batch_started` 只有 1 条；`queue.finished` 的 `reason` 是 `blocked`

接口：
- `src/schema/index.ts` 已有的导出 `ReportSchema`（zod 的严格对象，用 `safeParse`）；本批次起多一个可选字段 `disputed_tests`，实现之前带这个键的汇报会被拒绝
- 汇报是 `.collie/batches/<批次>/report.md` 末尾的围栏 JSON 块；一份合法的汇报怎么写、假 worker 怎么提交它，照 `test/support/sandbox.ts` 的 `workerScene`。它不支持多出来的键：要带 `disputed_tests` 时在测试文件里自己写一个假 worker 的场景，JSON 用不带类型标注的对象拼
- 沙箱与两种运行方式照 `test/support/sandbox.ts` 导出的 `Sandbox`（`run(runner)` 是单批次，`cli(['run', '--continue'], runner)` 是队列）、`fooledReviewerScene`、`honestClaims`、`BATCH`；运行器被调用了几次、各是什么角色，读 `FakeRunner` 的 `calls`
- `escalated` 事件本批次起在这条路上多带 `disputed`（数组）；读事件用 `Sandbox` 的 `events()`，队列 journal 的读法照 `test/queue-limit.test.ts`

条目：
1. 读 SPEC 16.23 的「worker 认为验收测试写错了」一段。`src/schema/index.ts`：`ReportSchema` 加可选的 `disputed_tests`（数组，每项是只有 `test`、`why` 两个非空字符串的严格对象）。
2. `src/run.ts`：读到有效的汇报而 `disputed_tests` 非空时，照那一段上报（不拉 reviewer、不取证；`escalated` 的 `reason` 与 `disputed`；progress 的说明文字「上报：worker 认为验收测试有错 — …」；`--continue` 下记 `blocked`；裁定提交经 `r2Commit` 并按 12.1 推送；BLOCK、退出码 20）。
   做法照现有的 `escalate` 与 `testerEscalate`；能合成一个带说明文字参数的函数就合，不要再抄一份。队列的循环不用改：它走现有 BLOCK 那一支，停下之前照常收尾。
   `test/invariants.test.ts` 的 `every await push( in run.ts has push_failed or verdict within 5 lines above (v03-b01-fix)`：你新加了一处推送时上限 8 改成 9（点名允许的改写）；复用现有函数、没有新加推送就不改。在「偏离或疑问」里写明是哪一种。
3. 不许变的：没有这个字段或它是空数组时的全部行为；`escalated` 在别的上报路径上的字段；事件类型的个数（复用 `escalated`，不加新类型）。`test/support/` 不许改。
   R1 查过：`test/envelope.test.ts`、`test/worker.test.ts` 与 `test/support/sandbox.ts` 里的汇报都不带这个字段，加一个可选字段不影响它们。已有断言除上面点名的那一处外都不改。
   别的现有用例因为本批次的新行为而失败时：只许做新行为直接要求的最小改动（往序列里加事件、个数加一这一类），不许删断言、不许把断言改松，在「偏离或疑问」里逐条列出原断言与现断言；拿不准是不是新行为直接要求的，才停下不改，写明是哪一条。

本批次只改 `src/schema/index.ts`、`src/run.ts`、`test/invariants.test.ts`（仅条目 2 点名的那一处）。`test/acceptance/` 下的文件你不能改：你认为某条验收测试写错了，停下，在「偏离或疑问」里写明是哪一条、错在哪（这一批还没生效，你不要在自己的汇报里用 `disputed_tests`）。

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 代码规范零错误 | `npm run lint` | exit 0 |
| 类型检查零错误 | `npm run typecheck` | exit 0 |
| 全部测试通过（含验收测试） | `npm test` | exit 0 |
| 本批次的验收测试通过 | `npm test -- test/acceptance/v046-b36` | exit 0 |

额外禁止：
- 改动任何受保护路径（含 `test/acceptance/`、`AGENT-*.md`、`.collie/collie.toml`、`.github/`、`eslint.config.js`、`vitest.config.ts`）
- 改动 `src/arbiter.ts`、`src/gate.ts`、`src/evidence.ts`、`src/acceptance.ts`、`src/roles/`、`src/runner/`、`src/view.ts`、`test/support/`；改任何一条规则的判定、`fix_max` 的计数、队列自动重跑的条件、收尾
- 在这条路上拉起 reviewer 或自动重跑；让 worker 的声明改动、删除或跳过任何验收测试
- 为了让测试过而删除或跳过任何测试；改写条目 2 点名之外的任何已有断言
- 为了让验收命令通过而改注释或字面（铁律 26）
- 测试里拉起真实的 runner 或真实网络请求；用到机器的 git 全局配置；新增依赖
