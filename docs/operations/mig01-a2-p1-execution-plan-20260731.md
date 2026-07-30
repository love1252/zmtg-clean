# MIG-01A2 A2-P1 Manifest 驱动 Provisioning 受控执行计划

> 计划编制任务：`V2-MIG01-A2-P1-MANIFEST-PROVISIONING-AUTHORIZATION-01`
>
> 状态：`proposed execution plan`
>
> 冻结基线：`24e5076a5e705ea374c9f96ad4ed3d6f53b8fe6c`
>
> 日期与时区：2026-07-31，Asia/Shanghai
>
> 交付性质：单文件 docs-only；不是 Runtime、数据库、Manifest、Lease 或 `--execute` 授权

## 1. 文档定位与授权分层

本文只完成 A2-P1 的实施前冻结、范围确认和执行计划，不修改或运行任何 Provisioning 实现。

授权必须分成四个互不替代的层次：

1. **本计划编制授权**：只允许审计仓库证据并通过 Draft PR 交付本 Markdown；进入 Ready 或 Merge 仍需用户对该动作另行明确授权；
2. **Runtime 准备授权**：只允许在精确文件 allowlist 内实现并验证可写 Adapter，不连接数据库、不读取真实 Manifest、不签发或消费 Lease；
3. **Authority／组合根准备授权**：在 Runtime handoff 之后独立冻结真实 Authority、可信组合方式、client 生命周期、撤权和无写验证；不得与首次数据库写入合并；
4. **数据库执行授权**：只有前两项准备分别合并、各自 handoff 完成并重新冻结全部环境硬门后，才可在指定 `local_acceptance` 环境执行一次受控 A2-P1。

本计划合并不自动授予后三层授权，也不允许把新执行通道、Authority／组合根的首次实现和首次真实数据库写入放在同一任务中。

权威边界依次引用：

- `docs/decisions/mig01-a2-provisioning-accepted-decisions.md`；
- `docs/architecture/v2-mig01-a2-provisioning-preflight.md`；
- `docs/operations/mig01-a2-provisioning-runbook.md`；
- `docs/handoff/NEXT_TASK.md`；
- 当前 `main` 的 Provisioning Contract、Kernel、Port、Runner、Policy 与 Adapter。

如本文与已接受决策或当前代码不一致，应停止并修正本文，不得静默改写既有 target 或 Contract。

## 2. 启动冻结快照

| 项目 | 当前低敏结论 | A2-P1 执行前要求 |
|---|---|---|
| `main`／`origin/main` | 均为 `24e5076a5e705ea374c9f96ad4ed3d6f53b8fe6c` | Runtime 和执行任务分别重新 fetch 并冻结最新 Base |
| Stage D handoff | PR #827 Head `f0e6192bd359c19e785a08222347808838ed38cc` 已使用 Merge Commit `24e5076a5e705ea374c9f96ad4ed3d6f53b8fe6c` 合并；Run `30563348472`／Job `90941683838` 成功 | 不得用 Stage D 的只读授权替代写入授权 |
| Stage D 独立审查 | `F01=closed`、`stage_d_independent_review=passed`、`eligible_for_stage_d_handoff=true`、`eligible_for_a2_p1=false` | A2-P1 仍须独立授权 |
| Stage D 五项计数 | Stage D 当次历史低敏证据为 `1／1／0／0／0`，且当次 dry-run 前后状态一致；本计划未核验当前数据库状态 | 执行前必须重新分类；任何漂移即停止 |
| Approved Manifest | 最近低敏证据为数量 1、`mig01-a2/v1`、`approved`、`c14n-v1`、exact shape 与独立 digest 校验通过 | 本任务未打开仓库外资产；执行前必须重新核验当前有效性、权限、文件身份、Contract、digest、保留状态与撤销状态 |
| Candidate 隔离 | 最近证据为 Candidate 与 Approved Manifest 相互独立，Candidate digest 未复用 | 执行前重新证明隔离关系，禁止把 Candidate 当作 Approved Manifest |
| Context Policy | `mig01-a2-local-acceptance-context-policy/v1`；目标环境只允许 `local_acceptance`，timezone 只允许 `Asia/Shanghai`，currency 只允许 `CNY` | 任一字段、集合、版本或目标环境变化即停止 |
| ReadOnly Adapter | `REPEATABLE READ + READ ONLY`；只读取 tenant 与目标 triplet；所有 insert 和 `write` 永久拒绝 | 保持原文件和拒写边界不变；不得将其改造成写 Adapter |
| Recovery Point | Stage D 低敏证据记录迁移前后恢复点的存在、权限、归档、hash 与 metadata 校验通过；未执行 Restore | 本任务未打开仓库外恢复点；执行前必须建立或重新核验适用于最新状态的恢复点 |
| Lease | Stage D 当次签发、读取、验证和消费均为 0；仓库只有 Lease Contract／Authority Port 与合成测试 | 没有仓库证据证明当前存在有效真实执行 Lease；实时状态待独立授权核验，执行前必须重新签发、冻结并由 Authority 验证 |
| 仓库硬门 | `main` 已保护；Required Check 为“最小架构与质量门禁”，enforcement 为 everyone | Runtime 与执行任务均须使用冻结 Head 对应的成功 Required Check，不得绕过 |

`docs/handoff/CURRENT_STATUS.md` 中“本 handoff 正在收口”属于 PR #827 无法在自身提交内预写 Merge Commit 的记录时点；GitHub 当前事实与本基线已经证明 PR #827 合并。该记录时点不改变 Stage D 已完成、A2-P1 仍未准入的结论。本计划不修改 canonical handoff。

Approved Manifest、Recovery Point 和真实 Lease 都是仓库外状态。本任务仅确认最后一份已合并低敏证据没有仓库内漂移，不把历史校验写成当前实时校验。

## 3. A2-P1 目标与完成边界

A2-P1 的唯一目标是：

```text
仓库外 Approved Manifest
→ 既有一次性受控 Runner
→ Manifest／Context／Lease 全部 fail-closed 校验
→ 单一可写 Transaction Adapter
→ Institution Scope
→ Context Version 1
→ Context Head 1
→ 提交前完整批次重检
→ 五项低敏计数与独立 handoff
```

只允许：

- 对全缺 triplet 进行确定性原子创建；
- 对全量字段严格一致的 triplet 进行只读复用；
- 使用 `input／insertedCandidate／reusedCandidate／conflict／unexpected` 五项计数；
- 在独立 handoff 中记录低敏授权、事务、撤权、恢复点与结果证据。

A2-P1 完成必须同时满足：

1. Runtime 准备代码已经独立合并；
2. Runtime 准备 handoff 已冻结唯一执行入口和后续阻断；
3. Authority／组合根准备已经独立完成无写验证并通过 handoff；
4. 用户对数据库执行任务、Operator、环境、Manifest 和 Lease 给出新的明确授权；
5. 一次受控执行成功；全一致复用属于成功结果，但零写入阻断只能收口当次执行任务，A2-P1 必须继续保持未完成／阻断；
6. 执行后的独立 handoff 已合并。

仅有代码、测试、Required Check、Stage D dry-run 或本计划合并，都不构成 A2-P1 完成。

## 4. 严格非目标

A2-P1 不得包含：

- A2-P2 的复合键、索引、FK 或 CHECK；
- Schema、Migration、journal、snapshot、`db:generate` 或 Migration 编号；
- UPDATE、UPSERT、DELETE、回填、`VALIDATE` 或 `SET NOT NULL`；
- Membership／Binding、Guard、Action Policy 或 Reader 放行；
- BASE-02、Writer、Audit／模板、MIG-01B、MIG-01C；
- API、UI、正式 Onboarding Runtime、平台切片或机构端旧任务；
- 第二个 Runner、Data Migration 写入口或临时 SQL 旁路；
- 生产、Staging、测试服务器或任何非 `local_acceptance` 目标环境。

P1 使用执行 Lease，不使用 Migration Lease，也不分配 `0039`。

## 5. 当前资产与缺口

| 能力 | 当前资产 | 当前结论 |
|---|---|---|
| Manifest Contract | `parseProvisioningManifest`、`assertParsedProvisioningManifest` | 已具备 exact-shape、approved、Context Policy、canonicalization、digest 与重复键 fail-closed |
| 持久化映射 | `toProvisioningExpectedTriplet` | 已固定 Scope、Version 1 与 Head 1 的低敏字段映射 |
| 执行内核 | `executeProvisioning` | 已实现 Authority 验证、事务内全批分类、顺序插入、affected rows 校验和提交前重检 |
| Repository／Transaction Port | `ProvisioningRepositoryV1`、`ProvisioningTransactionPortV1` | 已冻结读写接口和稳定事务要求 |
| Context Policy | `getLocalAcceptanceProvisioningContextPolicy` | 已冻结本地验收环境及唯一 timezone／currency 集合 |
| Lease Contract | `ProvisioningExecutionLeasePayloadV1`、`verifyProvisioningExecutionLease` | 只有低敏 Contract、校验器和 Authority Port；没有真实 Authority |
| Runner | `runProvisioningCli` | 是唯一入口并支持依赖注入；直接 package 命令不注入真实依赖，固定 fail-closed |
| ReadOnly Adapter | `createProvisioningReadonlyPostgresAdapter` | 只支持 Stage D 读取，`write` 永久拒绝 |
| Write Adapter | 不存在 | 阻断 Runtime 准备和数据库执行 |
| 可信组合根 | 仓库中不存在真实数据库／Authority 组合 | 阻断数据库执行；不得由临时 Helper 承担 SQL、授权或业务逻辑 |
| 真实 Lease Authority | 不存在 | 禁止使用测试 fake 或固定返回 `true` 的 verifier |

当前代码不具备真实写入条件。尤其不得把 ReadOnly Adapter 改成可写，也不得用 package 命令能够解析 `--execute` 推断执行能力已经完成。

## 6. 后续 Runtime 准备任务的文件范围

Runtime 准备必须由新的用户授权任务执行，默认精确 allowlist 冻结为：

1. 新建 `src/modules/tenancy/provisioning/server/provisioning-write-postgres-adapter.ts`；
2. 新建 `src/modules/tenancy/provisioning/tests/ProvisioningWritePostgresAdapter.test.ts`；
3. 新建 `src/modules/tenancy/provisioning/tests/ProvisioningPostgresAdapterParity.test.ts`，锁定 ReadOnly／Write Adapter 的 tenant、triplet、时间与低敏错误映射等价性；
4. 必要时只更新 `docs/operations/mig01-a2-provisioning-runbook.md` 的一致性说明。

Runtime 准备默认不得修改：

- `scripts/db/mig01-a2-provisioning-runner.mjs`；
- `scripts/db/mig01-a2-provisioning-runner.test.mjs`；
- `provisioning-canonicalization.ts`；
- `provisioning-manifest.ts`；
- `provisioning-ports.ts`；
- `provisioning-kernel.ts`；
- `provisioning-lease.ts`；
- `provisioning-context-policy.ts`；
- `provisioning-readonly-postgres-adapter.ts`；
- `package.json`、lockfile、`.github/**`、`drizzle/**` 和 `src/server/db/schema.ts`。

理由：

- 既有 Runner 已能注入 Policy、Transaction Adapter、Lease payload 与 Authority；
- Manifest、Kernel、Port 和 Lease Contract 已具备合成契约证据；
- 新写能力应保持为单独 Adapter，避免弱化 Stage D 的永久只读边界；
- 当前 ReadOnly Adapter 的读取与映射 helper 是私有实现；默认方案接受 Write Adapter 内受控重复必要读取／映射逻辑，并以独立 parity 测试锁定等价性，避免为共享 helper 改动已经冻结的只读文件；
- package 命令继续 fail-closed，防止未获执行授权时直接进入写模式。

若实现审查不接受受控重复、需要抽取共享 row-mapping／Repository helper，或发现必须修改上述保护文件、增加仓库内 Authority Adapter、增加组合脚本或扩大 allowlist，应立即停止并取得新的文件级授权，不得在同一 PR 中临场重构。

## 7. 可信组合根候选与职责分离

已接受决策只冻结“既有 Runner 是唯一写入口”和依赖注入边界，尚未接受真实组合根的具体实现方式。本文提出“仓库外、权限受控、一次性组合根”作为 `proposed` 候选；它不是 accepted decision，也不是第二执行入口。Runtime handoff 与数据库执行任务必须独立冻结其实现方式、责任人、审查证据和授权边界，未冻结时继续阻断。

若后续用户接受该候选，组合根只允许：

1. 创建并最终关闭数据库 client；
2. 注入当前 Context Policy；
3. 注入已合并且已验证的 Write Adapter；
4. 注入真实 Lease payload 与真实 `ProvisioningLeaseAuthorityPortV1`；
5. 调用既有 `runProvisioningCli`；
6. 在 `finally` 中撤销临时权限、关闭 client，并触发 Lease release 流程。

组合根不得：

- 直接执行 SQL；
- 自行解析或改写 Manifest；
- 复制 Provisioning Kernel；
- 绕过 `runProvisioningCli`；
- 固定返回 Authority 成功；
- 把 Manifest、Lease、连接信息或角色引用写入 Git、argv 正文、环境变量正文、日志或 PR；
- 在授权窗口外保留可复用数据库写权限。

最少职责分离：

| 角色 | 职责 | 禁止 |
|---|---|---|
| Approver | 批准 Manifest | 兼任 Operator |
| Reviewer | 复核低敏 Manifest 投影、环境、恢复点和计数 | 签发自己的执行授权 |
| Lease Authority | 核验用户授权并签发、撤销、释放 Lease | 使用测试 fake 或无条件通过 |
| Operator | 在批准窗口内运行唯一 Runner | 修改 Manifest、越过 Runner 或扩大环境 |
| Database Adapter owner | 提供最小权限 client 与事务边界 | 向 Runner 暴露凭证或长期写权限 |

真实 Authority 的实现方式、责任人和低敏验证证据尚未冻结。它是 Runtime 准备 handoff 进入数据库执行授权前的阻断项。

## 8. 数据影响与最小数据库权限

未来执行只允许读取：

- tenant 父记录；
- `institution_scopes`；
- `institution_operating_context_versions`；
- `institution_operating_contexts`。

只允许插入：

- `institution_scopes`；
- `institution_operating_context_versions`；
- `institution_operating_contexts`。

不得对任何表执行 UPDATE、UPSERT、DELETE、DDL 或通用查询。不得访问与当前 Manifest 条目无关的业务行；全表低敏计数只能由独立批准的固定只读探针采集，不能扩展 Runner 或 Adapter。

Runtime 准备测试只使用合成 client，不连接数据库。数据库执行任务必须单独冻结：

- grant／revoke owner；
- 精确 SELECT／INSERT 权限；
- client 创建、timeout、关闭和异常回收；
- 授权生效与失效时间；
- `finally` 撤权和撤权复核；
- 禁止继承、长期账号或共享写权限。

## 9. Manifest 与执行前核验顺序

任何数据库写事务前必须依次完成：

1. 冻结最新 `main`、工作分支、Head、Base、正式任务编号和文件范围；
2. 确认 Head 对应的 Required Check 成功，且 `main` 保护未被绕过；
3. 确认目标仍为 localhost-only `local_acceptance`；
4. 核验 Approved Manifest 当前存在性、普通文件身份、最小权限、Contract、`approved` 状态、canonicalization、digest、条目数量、有效期和撤销／替换状态；
5. 确认 Candidate 与 Approved Manifest 继续隔离；
6. 核验 Context Policy version、目标环境、timezone 与 currency；
7. 核验环境 Journal、A1 Shape、tenant 父记录和三张 A1 表当前状态；
8. 建立或重新验证适用于当前时间点的恢复点；
9. 冻结 Approver／Reviewer／Authority／Operator 分离；
10. 授予最小数据库权限并记录低敏授权窗口；
11. 签发范围精确的真实执行 Lease；
12. 由 Authority 使用受信主机 Clock 验证 Lease；
13. 只有全部通过后，才能调用 `transactionPort.write`。

任一步失败都必须在数据库事务前停止，并执行撤权、client 关闭和临时资产清理。

## 10. Lease 使用方式

执行 Lease 必须使用 `mig01-a2-execution-lease/v1`，并精确绑定：

- 正式任务编号；
- 工作分支与冻结 Base；
- Journal `0038_mig_01a1_institution_isolation_expand`；
- holder、Operator 与 `local_acceptance`；
- Manifest digest、entry-key digest 与 entry count；
- startsAt、expiresAt、renewal、invalidation 与 release。

硬门：

- Operator 不得等于 Manifest Approver；
- 未生效、已过期、已撤销、已释放或 scope 不一致的 Lease 必须拒绝；
- Authority 不可用或验证失败必须在写事务前拒绝；
- 当前时间只来自受信主机 Clock；
- 不得自动续期，不得在执行中静默更换 Lease；
- 剩余有效窗口不足以覆盖受控事务和清理时必须停止；
- 对正常结束和可捕获的失败／异常路径，组合根必须 best-effort 明确 release，并保留低敏证据；
- 对 `SIGKILL`、主机掉电等不可捕获终止，不得声称 `finally` 或显式 release 必然执行；必须依赖短 TTL、外部 Authority 的过期／撤销／回收机制，并在任何重试前形成低敏失效证据。

本计划没有签发、读取、验证或消费任何真实 Lease。

## 11. 写事务与写入顺序

Write Adapter 必须实现 `ProvisioningTransactionPortV1.write`，并满足：

- 完整批次从首次分类到提交位于同一原子事务；
- 使用 `SERIALIZABLE`，或经独立证明等价的行锁、predicate／advisory lock；
- 覆盖“目标行尚不存在”的并发竞争窗口；
- 不在回调外补写、重试、upsert 或降级提交；
- 使用固定 timeout，serialization failure 必须 fail-closed；
- 数据库异常只映射为固定低敏错误码。

事务内顺序固定为：

```text
重新读取 tenant 与完整 triplet
→ 对完整批次分类
→ conflict／unexpected 任一非零则整批停止
→ Institution Scope
→ Context Version 1
→ Context Head 1
→ 每次 INSERT affected rows 必须精确为 1
→ 提交前重新读取并分类完整批次
→ 全部必须成为严格一致 reusedCandidate
→ 计数守恒
→ commit
```

严格一致行只复用，净写入为 0。任何部分存在、额外／重复行、字段、digest、source、revision、version 或时间冲突都不得补写半套。

## 12. 计数、预期结果与低敏输出

公开输出仍只允许：

- `input`
- `insertedCandidate`
- `reusedCandidate`
- `conflict`
- `unexpected`

必须满足：

```text
input
= insertedCandidate
+ reusedCandidate
+ conflict
+ unexpected
```

Stage D 的历史分类为 `1／1／0／0／0`。真实执行前若重新分类不再精确一致，必须停止并重新审查，不得调整 Manifest 或数据以追求预期结果。

若全部前置保持不变，首次 execute 的候选预期仍为 `1／1／0／0／0`。事务内提交前重检必须全部为 `reusedCandidate`。提交后的独立只读证据应证明三张目标表各净新增 1、Journal、Shape 和 tenant 数不变；该独立核验方法和权限必须在执行授权中另行冻结。

不得自动运行第二次 `--execute` 证明幂等。真实重放必须另行授权；当前只通过合成测试和提交后只读分类证明幂等边界。

低敏输出不得包含私有路径、tenant／institution 实值、任何 digest 值、Manifest 正文、角色私有引用、连接参数、数据库原始结果、SQL、异常堆栈、Secret、Token、凭证或 PII。

## 13. 回滚、恢复与 forward-fix

### 13.1 提交前

- 任一校验失败：保持零写入；
- 回调抛错、affected rows 异常、serialization failure 或提交前重检失败：整批事务回滚；
- 事务结果不可解释：停止，不得自动重试；
- 对正常结束和可捕获失败，必须执行 `finally` 撤权、client 关闭和临时资产清理；
- 对不可捕获终止，必须由外部 Authority／权限所有者按冻结的 TTL 和回收流程失效 Lease 与临时权限；完成独立核验前不得重试。

### 13.2 提交后

提交后的数据库事实不能通过 Git revert 回退。发现错误时：

- 不 DELETE、不覆盖、不重绑、不 upsert；
- 不修改旧 Migration、journal 或 Manifest；
- 停止重复执行；
- 保留五项低敏计数、Lease 和授权状态证据；
- Scope 纠正只允许新审批下的 CAS status／revision 更新；
- Context 纠正只能追加新 Version，再 CAS 更新 Head；
- 由独立用户授权的 forward-fix 任务处理。

Restore 只允许在独立恢复授权、恢复点再次验证并明确接受影响范围后执行，不属于 A2-P1 自动回滚。

## 14. Runtime 准备验收标准

未来 Runtime 准备 PR 至少必须证明：

1. Write Adapter 只读取四张批准表，只向三张 A1 表执行纯 INSERT；
2. ReadOnly Adapter 代码和永久拒写测试保持不变；
3. parity 测试证明两类 Adapter 对 tenant、triplet、时间规范化、枚举和低敏错误的读取语义等价；
4. `SERIALIZABLE`／竞争保护、timeout 和事务生命周期可验证；数据库 client 生命周期与进程级 `finally` 属于后续 Authority／组合根准备，不得由 Adapter-only PR 冒充已关闭；
5. 全缺、全一致、tenant 缺失、部分存在、重复行、字段冲突和 revision 冲突全部 fail-closed；
6. Scope → Version 1 → Head 1 的顺序和三个 affected row count 均被测试锁定；
7. 任一步失败、serialization failure 与提交前漂移均整批回滚；
8. Runner 未注入 Authority／Lease 时不得进入 write；真实 Authority 的信任根、实现和负向证据必须由 Runtime handoff 标记为执行阻断，并在后续独立执行授权中冻结；
9. Runner 仍是唯一入口，直接 package 命令仍不会获得隐式真实依赖；
10. 低敏输出和错误映射不泄漏私有输入或数据库异常；
11. Manifest／canonicalization／Lease／Kernel／Context Policy／ReadOnly Adapter 既有测试保持通过；
12. `git diff --check`、架构检查、lint、typecheck、完整测试和 build 通过；
13. 新 Head 的真实 Required Check 全部实际执行成功。

Runtime 准备 PR 只能交付代码与合成测试，不运行 Runner、不连接数据库、不签发 Lease、不读取真实 Manifest。合并后必须独立 handoff，不能直接继续真实 execute。

`ProvisioningLeaseAuthorityPortV1` 当前只有 boolean 返回契约；Kernel 无法自行识别一个无条件返回 `true` 的伪 Authority。因此“真实 Authority 可信”不能由 Write Adapter 测试替代。无条件通过只允许出现在合成测试 fake 中，严禁用于真实组合根；Authority 的真实信任根和拒绝证据未关闭前，数据库执行继续阻断。

## 15. Authority 与组合根准备验收标准

Authority／组合根准备必须是 Runtime handoff 之后的独立任务，并且不得连接数据库、读取真实 Manifest、签发或消费真实 Lease、授予真实写权限或使用 `--execute`。

该准备任务至少必须冻结并证明：

1. 真实 Authority 的信任根、实现方式、签发者、撤销者、释放者和审计责任人唯一；
2. Authority 对未生效、过期、撤销、释放、scope 不符和未知授权全部拒绝；
3. 无条件返回 `true` 的实现只存在于合成测试，不进入真实组合；
4. 组合根只负责创建／关闭 client 和注入 Policy、Write Adapter、Lease 与 Authority，不包含 SQL、Manifest 解析、Kernel 或业务映射；
5. 组合根调用既有 `runProvisioningCli`，不形成第二 Runner；
6. 若组合根或 Authority 需要仓库文件，必须先取得新的精确 allowlist，通过独立 PR 与 Required Check；
7. 若它们属于仓库外受控资产，必须独立审查其低敏摘要、完整性、所有者、权限、保留和删除规则，不公开正文或敏感值；
8. 正常与可捕获失败路径的 client 关闭、撤权和 Lease release 可以通过无写合成验证；
9. 不可捕获终止依赖的短 TTL、外部撤销／回收和重试前失效核验已经冻结；
10. 完成独立 handoff，明确数据库执行仍未开始。

Authority／组合根准备没有通过时，不得在数据库执行任务中临时实现、首次启用并同时写库。

## 16. 数据库执行验收标准

未来独立执行任务必须同时证明：

- 最新 Base、Head、Required Check、目标环境和文件范围未漂移；
- Approved Manifest、Context Policy、Journal、Shape、tenant、恢复点与职责分离全部通过；
- 真实 Authority、执行 Lease、Write Adapter、grant／revoke 和 client cleanup 可用；
- 执行前分类无 conflict／unexpected，计数守恒；
- 单事务完成或整批回滚；
- 提交前完整批次全部严格一致复用；
- 实际写入只触及三张目标表，其他数据与结构不变；
- 五项低敏计数、授权窗口、Lease release、撤权、client 关闭和临时文件处置证据完整；
- 未输出私有或敏感信息；
- 执行后独立 handoff 已创建并通过质量门禁。

缺少任一项时，不得把 A2-P1 标记为完成，也不得启动 A2-P2。

## 17. 硬停止条件

以下任一情况必须保持零写入并停止：

- 正式任务编号、Runtime allowlist、目标环境或职责未冻结；
- Base、Head、Required Check、Journal、Shape、恢复点或仓库保护漂移；
- Manifest 文件身份、权限、approved 状态、Context Policy、digest、重复键、有效期或完整性异常；
- Candidate／Approved Manifest 隔离关系不成立；
- Lease 缺失、scope 不符、未生效、过期、撤销、释放或 Authority 不可用；
- Operator 与 Approver 相同；
- tenant 父记录缺失；
- triplet 部分存在、字段冲突、额外／重复行；
- `conflict > 0`、`unexpected > 0` 或计数不守恒；
- 可写 Adapter、稳定事务、缺失键竞争保护、最小权限或 client cleanup 无法证明；
- 任一 INSERT affected rows 不为 1；
- 提交前重检不全为严格一致复用；
- serialization failure、事务状态或数据库结果不可解释；
- 需要修改 Contract、Kernel、Port、Lease、Schema、Migration、package、CI 或其他未授权文件；
- 需要非 `local_acceptance` 环境或连接真实业务系统；
- 低敏输出边界可能被突破。

普通测试或质量失败只能在当次精确 allowlist 内修复。需要扩大范围时必须停止并重新授权。

## 18. 后续授权顺序

固定顺序为：

```text
本 docs-only 计划 PR
→ 用户独立授权 Runtime 准备文件范围
→ Write Adapter 与合成测试 PR
→ 独立 Runtime handoff
→ 用户独立授权 Authority／组合根准备
→ Authority／组合根无写验证
→ 独立 Authority／组合根 handoff
→ 用户独立授权环境、Manifest、Lease 与数据库执行
→ 一次受控 A2-P1 execute
→ 独立执行 handoff
→ 才能重新评估 A2-P2
```

本计划完成后，用户仍需分别明确授权 Runtime 准备、Authority／组合根准备和真实数据库写入。任何一个授权都不能从本计划、Stage D、Required Check 或代码存在性自动推导。

## 19. 本任务零执行声明

本任务：

- 未连接数据库或外部环境；
- 未打开仓库外 Approved Manifest 或 Recovery Point；
- 未运行 Runner 或新的 dry-run；
- 未使用 `--execute`；
- 未签发、读取、验证或消费 Lease；
- 未执行 Migration、Seed、DDL、DML 或数据库写入；
- 未修改 Runtime、Schema、Runner、Adapter、测试、CI、package 或 lock；
- 只启动了 A2-P1 的 docs-only 计划编制；未启动 A2-P1 Runtime／数据库执行、A2-P2、BASE-02、Writer、Reader 或其他后续任务。
