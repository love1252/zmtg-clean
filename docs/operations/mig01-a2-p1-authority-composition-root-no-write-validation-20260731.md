# MIG-01A2 A2-P1 Authority／组合根无写验证报告

## 1. 文档定位

- 当前总任务：`V2-MIG01-A2-P1-MANIFEST-PROVISIONING-END-TO-END-01`
- 阶段：`Authority／组合根无写准备`
- 验证动作：`Authority／组合根无写验证`
- 日期与时区：`2026-07-31`，`Asia/Shanghai`
- 审计 Base：`2ca100af132adf6676c09073f5d527c1b608d3ed`
- 状态：`current low-sensitive no-write evidence`
- 交付范围：docs-only；仓库内只新增本报告

本报告记录仓库外一次性组合根、Authority 信任模型和生命周期清理的合成无写验证。它不是 ADR，不是正式 Authority 记录、真实 Execution Lease、数据库权限或 `--execute` 的签发／执行记录，也不表示 A2-P1 已完成。

## 2. 前置冻结证据

| 项目 | 结果 |
|---|---|
| Runtime handoff PR | #830 |
| PR #830 Base | `bbf15be8f5acd66d80db5ac7b6e9250a57d5744e` |
| PR #830 Head | `1d28b6a91bf3b7076f66478861a3a7cc46fdcb18` |
| PR #830 Merge Commit | `2ca100af132adf6676c09073f5d527c1b608d3ed` |
| PR #830 Required Check | Run `30570185023`／Job `90964638309`，成功 |
| 当前 main／origin/main | 与审计 Base 一致 |
| 工作树与 Git 操作 | 干净；未发现进行中操作或锁 |
| 当前 Write Adapter | 已通过 PR #829 进入 `main` |
| 当前 Context Policy | `local_acceptance`、`Asia/Shanghai`、`CNY` |

Write Adapter 进入 `main` 只证明 Runtime 资产与合成测试已完成，不表示真实 Authority、Lease、权限窗口、数据库连接或 A2-P1 执行已经完成。

## 3. 事实源与验证边界

本次依据：

- `scripts/db/mig01-a2-provisioning-runner.mjs`
- `src/modules/tenancy/provisioning/provisioning-lease.ts`
- `src/modules/tenancy/provisioning/provisioning-context-policy.ts`
- `src/modules/tenancy/provisioning/server/provisioning-write-postgres-adapter.ts`
- `docs/decisions/mig01-a2-provisioning-accepted-decisions.md`
- `docs/operations/mig01-a2-provisioning-runbook.md`
- `docs/operations/mig01-a2-p1-execution-plan-20260731.md`
- `docs/handoff/NEXT_TASK.md`

本次只使用合成 Manifest、合成 Lease、合成 Authority 状态、不可联网的合成 client 和合成权限／生命周期 Controller。未读取既有 Approved Manifest、Candidate、真实 Lease、数据库连接或环境变量值。

## 4. Authority 信任模型

### 4.1 冻结的实现方式

真实执行采用仓库外、任务级、一次性的签名授权记录：

1. Lease Authority 持有独立签名私钥；
2. Operator 与一次性组合根只取得预先冻结的公钥验证锚和签名后的活动记录，不能取得签名私钥；
3. 活动记录精确绑定 task、branch、Base、Journal、holder、Operator、`local_acceptance`、Manifest digest、entry-key digest、entry count、开始时间、失效时间及职责引用；
4. Authority 每次从独立当前状态读取记录，验证 exact shape、签名、活动状态、受信主机时间、最小剩余有效期和 Lease payload 全字段一致性；
5. 未知记录、签名无效、未 claim、未生效、过期、撤销、释放、scope 漂移或 Authority 不可用全部拒绝；
6. `leasePayload` 不能反向生成 expectation 或 Authority 记录；结构正确本身不构成授权；
7. release 后即使原 Lease payload 的 `release` 字段仍为空，Authority 当前状态也必须拒绝重放。

本次只用一次性合成密钥验证上述行为，没有生成或保留真实签名私钥、真实授权记录或真实 Lease。真实签名锚、角色引用和活动记录必须在受控执行窗口内由独立 Lease Authority 重新建立，并在执行前以低敏结果复核。

### 4.2 职责分离

| 职责 | 冻结边界 |
|---|---|
| Manifest Approver | 只批准 Manifest，不得兼任 Operator |
| Reviewer | 独立复核环境、恢复点、权限、计数和低敏证据 |
| Lease Authority | 独立签发、claim、撤销、release 并控制签名信任根 |
| Operator | 只在获批窗口运行既有 Runner，不能取得 Authority 签名私钥 |
| 权限 Owner | 只通过独立 Controller 授予／撤销精确最小权限 |
| 审计责任 | 独立核对签名状态、权限撤销、Lease release 和清理结果 |

合成记录验证了每项职责只有一个绑定且 Operator 与 Approver、Authority 和审计职责分离。本报告不记录任何真实角色引用。

## 5. 一次性组合根边界

仓库外一次性组合根只允许：

- 调用既有 `runProvisioningCli`；
- 取得当前 `getLocalAcceptanceProvisioningContextPolicy()`；
- 使用已合并 `createProvisioningWritePostgresAdapter(client)`；
- 注入独立冻结的 Lease payload、expectation 和 Authority；
- 编排 client、权限、Lease 与临时资产生命周期；
- 将 Runner 输出限制为五项计数或固定低敏错误码；
- 在所有可捕获路径逐项 best-effort 执行 client close、权限 revoke、撤权负向探针、Lease release、release 后拒绝复核和临时资产删除。

静态边界核对确认组合根：

- 没有 SQL 字符串或通用 query；
- 没有导入 Kernel 或 Manifest parser；
- 没有复制 Manifest 解析、Repository 映射或业务分类；
- 没有读取 `process.env`；
- 没有形成第二 Runner；
- 没有在清理某一步失败后跳过其余清理。

不可捕获的 `SIGKILL`、主机掉电或进程崩溃不能由 `finally` 保证。本次冻结的处理是短 TTL、外部 revoke／release／回收和任何重试前的独立失效核验；不得自动重试或声称这些路径已经完成清理。

## 6. 合成无写验证

### 6.1 Authority 正向与负向矩阵

| 类别 | 数量 | 结果 |
|---|---:|---|
| 完整签名、活动状态、scope 与时间窗全部一致 | 1 | 仅授权判断通过 |
| task／branch／Base／Journal／holder／Operator／环境漂移 | 7 | 全部拒绝 |
| Manifest digest／entry-key digest／entry count 漂移 | 3 | 全部拒绝 |
| payload 已撤销／已释放 | 2 | 全部拒绝 |
| 外部记录未 claim／已撤销／已释放 | 3 | 全部拒绝 |
| 未生效／过期／剩余 TTL 不足 | 3 | 全部拒绝 |
| 未知记录／签名破坏／时钟无效／Authority 不可用 | 4 | 全部拒绝 |
| 合计 | 23 | `1` 通过，`22` 拒绝 |

无条件返回 `true` 的真实实现数量为 `0`。合成正向用例的通过依赖独立签名记录，不依赖传入 payload 临时建立白名单。

### 6.2 Runner／Policy／Adapter 组合

正常用例调用真实 Runner、真实 Context Policy 和真实 Write Adapter；Write Adapter 接收不可联网的合成 client，Runner 只运行 `--dry-run`。合成 client 只响应既有只读 Adapter 的固定交互，不建立 socket 或数据库连接，并拒绝任何写语句。

| 五项计数 | 结果 |
|---|---:|
| input | 1 |
| insertedCandidate | 1 |
| reusedCandidate | 0 |
| conflict | 0 |
| unexpected | 0 |
| 计数守恒 | `true` |

这里的 `insertedCandidate=1` 仍只是合成 dry-run 分类，不是 INSERT 或数据库事实。

### 6.3 生命周期矩阵

共验证 12 个场景：

- 正常 dry-run；
- Manifest 固定失败；
- claim 失败；
- 权限激活失败；
- client 创建失败；
- 合成只读交互失败；
- client close 失败；
- revoke 失败；
- 撤权负向探针失败；
- Lease release 失败；
- release 后拒绝复核失败；
- 临时资产删除失败。

正常路径中 client 创建／关闭、权限激活／撤销／负向复核、Lease claim／release／release 后拒绝复核和临时资产删除各执行 1 次。所有可捕获失败路径均继续尝试其余适用清理；任一清理不完整都会把整体结果固定为 `composition_cleanup_incomplete`，不会泄漏原始异常。

## 7. 零连接、零执行与清理证据

| 类别 | 结果／数量 |
|---|---:|
| Authority 合成矩阵 | 23 个用例通过 |
| 组合根生命周期矩阵 | 12 个场景通过 |
| 静态边界核对 | 6 项通过 |
| 合成 Adapter 交互 | 8 |
| `--execute` 调用 | 0 |
| 真实数据库连接 | 0 |
| 数据库写入 | 0 |
| 真实 Approved Manifest 读取 | 0 |
| 真实 Lease 签发、读取、claim、消费、release | 0 |
| 真实数据库 grant／revoke | 0 |
| Migration／Seed／DDL／DML | 0 |
| Runtime／Schema／Migration／scripts／tests／CI／package／lock 修改 | 0 |
| 合成私有文件模式 | `0600` |
| 私有临时目录模式 | `0700` |
| 临时 Helper、合成输入与目录 | 已删除，残留 0 |
| 私有路径、双键、digest、角色引用、连接参数、Secret、Token、凭证、PII 输出 | 0 |

合成 client 的 8 次交互只是对既有 Adapter 固定只读协议的内存响应，不是数据库 SQL 执行或网络调用。

## 8. 结论与下一步边界

本次 Authority 信任模型、一次性组合根职责、签名记录 fail-closed、无写 Runner 组合、可捕获生命周期清理和不可捕获终止回收边界均通过验证，具备进入独立 `Authority／组合根 handoff` 的条件。

该结论不表示：

- 真实签名锚、真实 Authority 记录或真实 Lease 已经签发；
- 真实 Manifest、数据库、权限或恢复点已经实时复核；
- `--execute` 已运行；
- A2-P1 已完成；
- A2-P2、BASE-02、Writer 或 Reader 可以启动。

独立 handoff 合并后，才能按当前用户授权进入一次受控 `local_acceptance` 执行的实时前置核验。执行前仍必须重新冻结最新 main、Required Check、localhost-only 环境、Approved Manifest／Candidate 隔离、Context Policy、Journal／Shape、tenant 父记录、恢复点、职责分离、真实签名锚、最长 10 分钟且不续期的 Execution Lease、精确 grant／revoke 和五项预分类 `1／1／0／0／0`。任一项不满足即保持零写入并停止。
