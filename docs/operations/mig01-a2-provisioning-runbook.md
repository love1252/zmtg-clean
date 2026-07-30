# MIG-01A2 受控 Provisioning Runner 治理基础 Runbook

## 1. 文档定位

状态：`current governance foundation + proposed execution procedure`

本文只描述 MIG-01A2 受控 Provisioning Runner 的仓库治理基础。当前 Stage B 不是 A2-P1，不代表真实 Manifest、环境、数据库、执行 Lease、备份／恢复点或操作人员已经获批，也不构成生产执行授权。

当前实现提供：

- 严格版本化、低敏、exact-shape Manifest 契约；
- `c14n-v1` 固定位置数组、UTF-8、SHA-256 和固定测试向量；
- dry-run／execute 共用的事务内核和 Repository／Transaction Port；
- 低敏执行 Lease payload 与 Authority Port；
- 只接收安全本地文件路径的 CLI 外壳；
- 合成 Port、合成 Lease 和内存事务测试。

当前实现明确不提供：

- 真实数据库 Adapter；
- 真实 Lease Authority 或签发入口；
- 真实 Manifest、真实环境批准集合或数据库连接；
- A2-P1／A2-P2 实施、Migration、回填、Reader 或正式 onboarding Runtime。

## 2. 权威边界

- Tenancy 是 Institution Scope、Context Version、Context Head、Manifest、Scope Revision 和 Provisioning Provenance 原始事实的唯一语义 Owner。
- Access Control 只通过后续版本化 Port／Reader 消费低敏投影；Membership、Authorization Provenance、Fresh Membership、短生命周期 Anchor、Guard 和 Action Policy 不属于 A2 Runner。
- Identity 继续拥有用户、账号和正式 Session；Security 继续拥有通用安全能力。
- `scripts/db/mig01-a2-provisioning-runner.mjs` 只是受控执行资产，不是业务事实 Owner，也不是第二套数据库入口。

## 3. Manifest 输入与保管

真实 Manifest 只能通过 `--manifest-file <path>` 传入。禁止把 Manifest 正文放入：

- Git、PR 描述、Issue、日志或测试 fixture；
- argv、stdin、环境变量、shell history 或聊天内容；
- `.env.local`、CI 变量、临时调试输出或错误堆栈。

Runner 只接受当前操作系统用户拥有的普通文件：

- 禁止符号链接；
- hard link 数必须为 1；
- 权限必须精确为 `0400` 或 `0600`；
- 大小必须在 1 Byte 到 1 MiB 之间；
- 必须是无 BOM 的严格 UTF-8 和单一 JSON 文档；
- 打开前、打开后和读取后的 inode、device、owner、mode、size 与时间元数据必须一致。

Manifest 所在目录也应由操作人员使用受控临时目录并设置最小权限。Runner 退出后按批准的保留期删除文件。普通文件删除不能保证底层介质物理安全擦除；如环境要求介质级擦除，必须由独立基础设施控制处理。

真实任务中的文件读取权限必须按任务和时限单独授予，只赋予指定 Operator；任务结束、Lease 失效、撤销或释放后立即撤销目录、文件和执行入口权限。不得保留共享账号、长期可复用授权或绕过 Reviewer 的备用入口。

## 4. Manifest 与 Context 契约

Manifest 顶层只允许：

- `manifestVersion = mig01-a2/v1`
- `approvalStatus = approved`
- `approvedByReference`
- `approvedAt`
- `digest`
- `entries`

条目只允许冻结的低敏字段，且 `entries.length > 0`；空 Manifest 必须 fail-closed，不得解释为成功 no-op。`scopeRevision`、`contextVersion`、`contextHeadRevision` 和 `latestVersion` 首次均必须显式为 `1`。`provisioningSource` 只允许 `approved_migration_manifest`。

当前代码区分：

1. IANA 时区／ISO 4217 格式或注册表有效；
2. 本次真实执行获批的时区与币种子集。

后者必须由后续环境与 Manifest 只读预检冻结并注入。CLI 当前没有真实批准集合，因此直接运行会 fail-closed。

持久化映射固定为：

- `createdBy = approvedByReference`
- `updatedBy = approvedByReference`
- `migrationProvenance = null`
- 外部 `sha256:<64 lowercase hex>` 去掉前缀后写入 64 位数据库 digest。

当前 Schema 的 Context Version `migrationProvenance` 可空，但获批 Manifest 白名单不允许新增该输入字段，因此治理基础固定写入 `null`。A2 的 Provisioning Provenance 由 Scope 的 `provisioningSource`、Manifest digest、审批引用与审批时间共同承载；这不表示 Context 的 nullable 字段已经形成第二套或完整 provenance 事实源。

`createdBy` 与 `updatedBy` 固定记录稳定的 `approvedByReference`（审批主体引用），不记录可随重放变化的执行者。Operator 仅由已验证 Lease 和低敏执行日志记录；两类主体不得混写，也不得据此省略审批人与执行者分离。

## 5. Canonicalization 与 digest

协议固定为：

- Manifest version：`mig01-a2/v1`
- Canonicalization version：`c14n-v1`
- 条目按 UTF-8 字节序的 `tenantId`、`institutionId` 排序；
- 固定位置 JSON 数组，nullable 位置显式为 `null`；
- 所有字符串必须是 NFC 且不得包含非法 Unicode；
- 日期为 `YYYY-MM-DD`；
- 时间为 `YYYY-MM-DDTHH:mm:ss.sssZ`；
- 序列化使用 UTF-8；
- digest 使用 SHA-256；
- 外部表示为 `sha256:<64 lowercase hex>`，数据库表示为 64 位小写 hex。

顶层 preimage 位置固定为：

```text
[
  0 domain = "zmtg.mig01-a2.provisioning-manifest",
  1 canonicalizationVersion = "c14n-v1",
  2 manifestVersion,
  3 approvalStatus,
  4 approvedByReference,
  5 approvedAt,
  6 entryCount,
  7 entries
]
```

每个 `entries` 元素的位置固定为：

```text
[
  0 tenantId,
  1 institutionId,
  2 scopeStatus,
  3 scopeRevision,
  4 provisioningSource,
  5 contextVersion,
  6 contextHeadRevision,
  7 latestVersion,
  8 contextSource,
  9 timezone,
  10 currency,
  11 effectiveFromBusinessDate,
  12 effectiveAt,
  13 migrationProvenance = null
]
```

协议字段、位置或格式的任何变化都必须使用新版本、新 digest 和新审批，不得静默兼容。

## 6. Dry-run、计数与停止条件

CLI 默认模式是 dry-run，但只有注入真实获批 Context 集合和受信 Repository Adapter 后才能读取数据库状态并给出真实分类。当前直接 CLI 首先因缺少真实批准集合返回 `runner_context_policy_unavailable`；未来注入该集合后，如仍无 Adapter，则返回 `runner_repository_adapter_unavailable`。任何阶段都不能假设所有行都是新增候选，也不能伪造绿色结果。

成功 dry-run 只允许输出：

- `input`
- `insertedCandidate`
- `reusedCandidate`
- `conflict`
- `unexpected`

失败只允许输出固定低敏错误码，不得输出文件路径、双键、digest、Manifest 正文、连接信息、数据库原始异常或堆栈。真实任务如需保留日志，只保留批准的任务引用、五项计数、时间和固定结果码，并按独立保留期与访问控制处理。

必须满足：

```text
input
= insertedCandidate
+ reusedCandidate
+ conflict
+ unexpected
```

以下任一情况停止并保持零写入：

- tenant 父记录缺失；
- 三表部分存在；
- revision、digest 或任一持久化字段冲突；
- 额外／重复 Scope、Version 或 Head 行；
- 数量不守恒；
- Repository、事务、批准集合或 Lease Authority 不可用；
- Manifest、文件、权限、编码、digest 或审批状态不合法；
- 发现真实环境与冻结 Base／journal／shape 不一致。

## 7. Execute、事务与前向修复

execute 必须在真实执行授权任务中同时具备：

- 当前 Head 对应的绿色 Required Check；
- 独立 handoff 冻结的任务、分支、Base 和目标环境；
- 只读核验过的真实 Manifest 与 digest；
- 环境 journal 和三表 shape 证据；
- tenant 父记录证据；
- 已验证备份与恢复点；
- 用户明确授权的 Operator／Reviewer；
- 有效且未撤销、未释放、未过期的真实执行 Lease；
- Lease Authority 和 Repository／Transaction Adapter。

审批人与执行者必须分离。结构正确的 Lease payload 不等于真实授权；只有 Authority Port 验证成功后才能进入写事务。

执行时必须在同一数据库事务内重新读取完整批次并重新分类，然后只允许按以下顺序插入全缺失三元组：

```text
Institution Scope
→ Context Version 1
→ Context Head 1
```

一致行只复用；禁止 update、upsert、delete 或补写半套数据。任一条目冲突或任一写入失败必须回滚完整批次。

Transaction Adapter 必须从首次分类到提交保持稳定视图，使用 `SERIALIZABLE` 或等价的行锁与缺失键竞争保护；serialization failure 必须 fail-closed。内核在写入后、提交前再次核验完整批次全部为严格一致复用，任何并发漂移都必须回滚。

提交后的数据库事实不能依赖 Git revert 回退。失败时必须停止重复执行，保留低敏分类计数与授权记录，使用独立批准的前向修复任务；只有经过验证的数据库恢复流程才可执行恢复。

## 8. Lease 与职责分离

Lease 低敏契约包含：

- task、branch、frozen Base 与 journal；
- holder、operator、target environment；
- Manifest digest、entry-key digest 和 entry count；
- start、expiry、renewal、invalidation 与 release。

Lease 不承载真实 Manifest 正文、凭证、连接串或 PII。真实 Lease 的签发者、持有者、时限、环境、撤销和释放必须由后续独立任务授权。测试 Lease 仅验证契约和 fail-closed 行为，不能解释为真实执行许可。

Lease 生效与过期判断只能使用受信主机 Clock。生产组合不得从 Manifest、argv、环境变量、HTTP 请求、数据库业务时间或操作人员输入覆盖当前时间；代码中的 `now` 注入只允许合成测试使用。

建议最少职责分离：

- Reviewer：核对 Manifest 低敏投影、digest、环境证据和计数；
- Lease Authority：验证用户授权并签发／撤销 Lease；
- Operator：只使用获批文件和 Lease 执行，不得兼任 Manifest approver；
- Database Adapter owner：维护受控连接和事务边界，不向 Runner 暴露凭证。

Stage B 不授予任何文件、数据库或执行权限。未来 P1 必须在独立 handoff 中冻结 grant／revoke owner、生效与失效时间窗、最小数据库权限、异常和 `finally` 路径的撤权动作、Manifest 保留期限、删除证据及撤权验证；缺少任一项都不得签发真实 Lease。

## 9. 命令边界

仓库提供稳定命令：

```bash
pnpm db:mig01-a2:provisioning -- --manifest-file /受控路径/manifest.json
```

该命令当前只加载治理基础，不包含真实批准集合、Repository Adapter 或 Lease Authority，预期 fail-closed。不得通过临时修改脚本、环境变量、Mock、Demo、Seed 或测试 Port 绕过。

在独立真实执行任务获批前，禁止使用 `--execute`，禁止连接数据库，禁止创建 Migration 编号，禁止运行 `db:generate`、Migration 或 Seed。

## 10. Stage B 完成定义与后续边界

Stage B 只在契约、内核、CLI 外壳、测试、Runbook 和质量门禁全部通过后完成。完成后必须通过独立 handoff 将唯一下一任务冻结为真实环境与 Manifest 的只读预检。

Stage B 合并不自动：

- 启动真实 Manifest 核验或数据库 shape 核验；
- 签发执行 Lease 或 Migration Lease；
- 启动 A2-P1、A2-P2、BASE-02、Writer、MIG-01B、MIG-01C 或 Reader；
- 修改 journal `0038`、snapshot `0026`、Schema、Migration 或仓库设置；
- 证明任何机构业务线已正式发布。

## 11. 本地就绪修复 Stage B 只读能力

`V2-MIG01-A2-LOCAL-READINESS-REMEDIATION-01-STAGE-B-COMPLETE` 与前述“治理 Stage B Runner 基础”不是同一阶段。本节记录固定 localhost-only 本地验收环境的只读能力现状，不改写 Runner、Lease、Manifest 或 execute 边界。

当前已经建立：

- Context Policy version：`mig01-a2-local-acceptance-context-policy/v1`；
- 目标环境：`local_acceptance`；
- 唯一批准 timezone：`Asia/Shanghai`；
- 唯一批准 currency：`CNY`；
- Policy 对象和批准数组均冻结，重复值、未知值、未批准值、版本或环境漂移均使用固定低敏错误码 fail-closed；
- 只读 Adapter：`src/modules/tenancy/provisioning/server/provisioning-readonly-postgres-adapter.ts`；
- Adapter 只接收调用方注入的 postgres.js `Sql` client，不读取 `DATABASE_URL`，不创建、缓存或关闭全局连接；
- 静态读取白名单仅为 `public.tenants`、`public.institution_scopes`、`public.institution_operating_context_versions`、`public.institution_operating_contexts`；
- 每次 `read` 使用 `REPEATABLE READ + READ ONLY` 事务，并在事务内核验 `transaction_read_only=on` 与 `transaction_isolation=repeatable read`；
- Adapter 直接设置并核验 `statement_timeout=5s`、`lock_timeout=1s`、`idle_in_transaction_session_timeout=5s`；`connect_timeout=5s` 仍由创建 client 的调用方负责；
- timestamptz 以 UTC 六位微秒文本读取，只允许毫秒对齐后规范化为三位毫秒 ISO UTC；business date 固定映射为 `YYYY-MM-DD`；
- Repository 三个 insert 方法和 Transaction Port `write` 均永久返回 `provisioning_readonly_write_forbidden`，且不调用写回调；
- 数据库、连接、timeout、行 Shape、enum 和时间异常只映射为固定低敏错误码，不向调用方返回 SQL、连接信息、双键、数据库正文或原始异常。

验证结果：

- Context Policy 测试：23 个通过；
- 只读 PostgreSQL Adapter 测试：26 个通过；
- Provisioning 定向契约集：6 个测试文件、112 个测试通过；
- 固定本地验收库只读 smoke：`local_readonly_adapter_smoke=pass`；
- smoke 前后 Journal 均为 39、`tenants` 均为 2，三个 A1 表均为 0；
- smoke 只使用明显不存在的合成双键，不读取真实 tenantId 或业务行，临时脚本已经删除。

当前 Runner CLI 仍未组合该 Context Policy 与真实 Adapter，execute Adapter 仍不存在，直接运行仍按既有契约 fail-closed。本阶段没有创建或读取真实 Manifest，没有运行 Runner dry-run／`--execute`，没有签发 Lease，没有执行 Provisioning，也没有启动 A2-P1／P2。真实本地 Runner dry-run 只能在独立 handoff 与用户明确授权后的 Stage D 中运行。

Stage C 仍需通过独立 handoff 和用户授权形成本地验收 Manifest 候选与审批包。Stage B 完成不代表真实 Manifest 已批准、真实 dry-run 已执行、A2-P1 已就绪、MIG-01 已关闭或 Reader 已放行。
