# MIG-01A2 锚点 Provisioning 实施前置审计与切片冻结

> 任务编号：`V2-MIG01-A2-PROVISIONING-PREFLIGHT-01`
>
> 审计基线：`bebdd3afca9773b4ac9764572a4372349440ea10`
>
> 审计日期：2026-07-29
>
> 交付性质：docs-only 静态预检；不构成 Schema、Migration、Runtime、环境或发布授权

## 1. 文档定位、事实源与状态定义

本文只审计 MIG-01A2 的静态前置条件，冻结候选实施切片及其启动、停止和前向修复条件。本轮未创建或修改 Migration、Schema、脚本、测试、CI 或 Runtime，未读取真实 manifest、环境变量或凭证，未连接数据库或业务外部环境，也未取得 Migration lease。

事实源按以下顺序使用：

1. `current`：本基线 `main` 中的代码、测试、Schema、Migration、配置、package 命令和已合并记录；
2. `target`：`docs/architecture/architecture-v2.md` 与已接受 ADR 确定的最高级目标约束；
3. 模块映射、六类架构视图、代码证据审计、架构索引和 handoff 只负责展开、导航、核验与记录状态，不独立改写 `target`；
4. `proposed`：尚需独立决策和授权的候选方案，不是 current，也不是实施许可。

上述权威关系见 `docs/architecture/development-architecture.md:40-44` 和 `docs/handoff/NEXT_TASK.md:40-51`。本文发现数据架构、软件架构与既有预检对具体 Owner 的展开存在差异；该差异在本文中显式保留，不静默提升任何一方为最高级目标事实。

本文使用以下状态：

| 状态 | 含义 |
|---|---|
| `current` | 当前基线可由仓库静态证据直接证明 |
| `target` | 架构 V2 与已接受 ADR 已确认的目标约束 |
| `proposed` | 后续可讨论的候选方案，仍需独立授权 |
| `阻断` | 当前不足以启动对应实施切片 |
| `待确认` | 仓库证据可定位，但尚不能唯一冻结结论 |
| `待授权核验` | 必须在未来获得环境、数据库、真实 manifest、备份或凭证边界授权后核验 |

Schema、类型、测试、Demo、Mock、Seed 或 Capability 的存在均不证明 provisioning、回填、约束、授权或发布已经完成。

## 2. A1／A2 总结

MIG-01 的最高级关闭顺序仍为：

```text
MIG-01A1 Expand
→ MIG-01A2 锚点 provisioning
→ BASE-02／Writer／Guard
→ Audit／模板
→ MIG-01B
→ MIG-01C
→ Reader 重新核验与放行
```

该顺序来自 `docs/architecture/architecture-v2.md:230-255` 与 `docs/decisions/architecture-v2-decisions.md:39-56`，不得因 A1 表结构已存在而跳过 A2 或后续关闭单元。

| 单元 | 状态 | 当前证据 | 缺失证据 | 阻断 | 环境待核验 | 后续切片 |
|---|---|---|---|---|---|---|
| MIG-01A1 | 已具备，但仅限 `current` 静态 Expand | `drizzle/0038_mig_01a1_institution_isolation_expand.sql:1-71` 创建 4 个枚举、3 张锚点／上下文表，并向 4 张业务表追加可空机构字段；`src/server/db/schema.ts:380-499` 与 SQL 对齐；`src/server/db/tests/Schema.test.ts:3294-3351` 明确没有 DML、回填、`SET NOT NULL` 或业务 Scope FK | 环境执行证据、业务双写、回填、Enforce、Reader 放行均不属于 A1 | 不得把可空结构写成归属已完成 | 各环境真实 journal、部署版本和数据 shape | A2-P1 |
| MIG-01A2 | 缺失；实施处于 `阻断` | Scope／Context Schema 和只读 Anchor 链已存在；`architecture-v2.md:249` 要求获批锚点按 manifest provisioning，重复执行安全且不覆盖 | 唯一 Owner、manifest 契约、provisioning Writer、事务与计数、幂等重放、冲突清零、真实审批与执行证据均缺失 | Owner、manifest、metadata 决策、环境前置和唯一 lease 尚未关闭 | 真实 manifest、环境 journal、目标库、备份／恢复点 | A2-P1 → handoff → A2-P2 |

补充边界：

- 0038 没有 `INSERT`、`UPDATE`、`DELETE`、回填、业务 Scope 关系或 Enforce，A1 只能称为静态 Expand。
- 当前 `institution_scopes` 的唯一生产引用是只读 Repository；两个 Operating Context 表除 Schema 与 Schema 测试外没有生产 Reader／Writer。
- BASE-02、全部 Writer 双写、Audit／模板、MIG-01B、MIG-01C 和 Reader 放行不属于本轮实施范围，也未因本文完成而获得授权。

## 3. Owner 候选矩阵

### 3.1 静态结论

Owner 候选能够从仓库证据中枚举，因此本预检可以继续；但 Scope、Context Version、Context Head 与 manifest 的具体实现 Owner 无法从最高级 `target` 唯一冻结。该结果是本预检必须交付的 `阻断／待确认` 结论，不得凭偏好选定 Owner，也不得据此启动 A2-P1 或 A2-P2。

`architecture-v2.md:124-131` 与 ADR-V2-015（`docs/decisions/architecture-v2-decisions.md:78-82`）只明确 Access Control 拥有 provenance、成员资格、机构／对象 Guard 和 action policy；并未明确把 Scope、Context Version、Context Head 或 manifest 的持久化所有权交给 Access Control。与此同时：

- `docs/architecture/software-architecture.md:375-386` 将 Institution Scope 列入 Access Control；
- `docs/architecture/v2-02b-mig01-closure-preflight.md:169-206` 仅以 `proposed` 建议 Tenancy 持久化 Scope／provisioning，Access Control 消费 anchor／membership／revision；
- `src/modules/tenancy/` 与 `src/modules/access-control/` 当前均不存在，目标目录不得被当作 current 事实。

### 3.2 矩阵

| 事实对象 | 当前物理位置 | `current` 读写者 | `target` Owner 候选 | 消费者 | 冲突 | 结论 | 主要证据 |
|---|---|---|---|---|---|---|---|
| Institution Scope | `institution_scopes` | Security Anchor Repository 只读；未发现生产 Writer | Tenancy 持久化候选；Access Control 语义展开也曾包含 Scope | Anchor Provider、Guard | 软件视图与既有预检展开不同；ADR 未唯一指定持久化 Owner | `阻断／待确认`；推荐方向仅为 `proposed`：Tenancy 持有原始事实，Access Control 只消费 | `src/server/db/schema.ts:380-414`；`src/modules/security/server/institution-anchor-repository.ts:20-48` |
| Context Version | `institution_operating_context_versions` | 除 Schema／测试外未发现生产 Reader／Writer | Tenancy 候选 | 未来 Context Provider／业务消费者 | ADR 未指定；当前 wire contract 与 Schema 尚无 mapper | `阻断／待确认` | `src/server/db/schema.ts:416-459`；`src/modules/institution-contracts/v1/institution-operating-context.ts:29-59` |
| Context Head | `institution_operating_contexts` | 除 Schema／测试外未发现生产 Reader／Writer | Tenancy 候选 | 未来 Context Provider | Owner、revision 生命周期和消费方向均未落地 | `阻断／待确认` | `src/server/db/schema.ts:461-499` |
| A2 manifest | 仓库内无正式 manifest 类型、解析器、校验器或资产 | 无生产 Reader／Writer | Tenancy provisioning 候选；审批治理与 Migration 执行者必须分离 | A2-P1 校验与 Writer | 来源、Owner、审批协议、canonicalization、digest 算法和保存边界未冻结 | 缺失且 `阻断` | `drizzle/0038_mig_01a1_institution_isolation_expand.sql:1-20`；`docs/handoff/NEXT_TASK.md:94-106` |
| Membership provenance | `tenant_members`、`auth_account_institution_bindings` | Auth Repository 读取；Security Membership Provider 校验；未发现正式 binding Writer | Identity 管账号／正式 Session；Access Control 管 Fresh Membership、provenance 与 Guard | Session Root、Guard | 物理事实分散；`tenant_members` 没有独立 status／revision，当前使用 `updatedAt` 作为 revision 时间 | 部分具备；持久化边界留给 BASE-02 | `src/server/db/schema.ts:888-955`；`src/modules/auth/server/auth-account-repository.ts:437-479`；`src/modules/security/server/institution-membership-provider.ts:290-485` |
| Anchor provenance | Scope 的 source／digest／approvedBy／approvedAt | Security 当前只读取双键、status、revision 并签发短时 Anchor 证据；不读取或复核 source／digest／审批字段 | Tenancy 候选 Owner 在写入时校验 manifest、digest 与审批 provenance；Access Control 只拥有 Session／Membership／Anchor 授权 provenance、短时证据签发与 Guard 消费 | Anchor Provider、Guard | 持久化 Owner 未冻结；当前 Runtime 未复核 manifest 审批 provenance；不能把签发证据变成第二份 Scope | 部分具备；原始事实 Owner `阻断／待确认` | `src/server/db/schema.ts:380-414`；`src/modules/security/server/institution-anchor-repository.ts:20-48`；`src/modules/security/server/institution-anchor-provider.ts:368-545` |
| Scope revision | `institution_scopes.revision` | Anchor Repository 读取，Provider 转换为 `arv`；无生产 Writer／CAS | Tenancy 候选控制持久 revision；Access Control 只消费 | Guard | `institution_operating_contexts.revision` 是另一字段且当前无生产消费者，二者不能混写 | 部分具备且 Writer 生命周期 `阻断` | `src/modules/security/server/institution-anchor-repository.ts:29-46`；`src/server/db/schema.ts:461-499` |

当前平台租户创建链也不能证明 A2：

- `src/app/api/v1/open-platform/tenants/route.ts:31-65` 使用 Demo access context；
- `src/modules/open-platform/server/tenant-plan-binding-repository.ts:104-148` 的事务不写 Scope、Context 或正式 institution binding。

因此该链只能列为 current 的历史开户 Writer 位置证据，不是 Scope／Context／manifest 的 target Owner 候选，也不能被直接复用为 `formal_onboarding` 已完成的证明。

## 4. Tenancy 持久化与 Access Control 消费边界

以下边界是基于现有 target 的 `proposed` 收敛方向；在独立 Owner 决策完成前，不是实施授权。

### 4.1 Tenancy 持久化候选职责

Tenancy 候选负责唯一持久化：

- tenant／institution Scope 原始事实；
- Scope status、Scope revision 与 provisioning provenance；
- Operating Context 的 append-only Version；
- 指向最新 Version 的 Context Head；
- 经批准 manifest 的语义校验、确定性创建或严格一致复用；
- 对 revision、version、source、digest、审批与生效字段的事务和计数证据。

共享 `src/server/db` 只是数据库资产托管位置，不是业务 Owner；Migration 执行者只持有一次执行 lease，也不因此成为事实 Owner。

### 4.2 Access Control 目标职责

Access Control 按 ADR-V2-015 拥有 provenance、Fresh Membership、机构／对象 Guard、action policy 的解析与校验，以及低敏授权证据的签发。面对 Tenancy 原始事实时，它只能读取、复核并消费低敏、短生命周期的：

- 正式 Session provenance 投影；
- Fresh Membership／binding 投影；
- `{ tenantId, institutionId, status, scopeRevision }` Anchor 投影。

不得把 manifest、完整 Scope 行、Context Version／Head 或其副本持久化为第二套 Tenancy 事实源。当前 `institution-anchor-repository.ts:20-48` 只投影双键、状态和 revision，且注释明确它不签发 Guard、不授权访问，符合这一消费方向。

### 4.3 依赖方向与 fail-closed

```text
获批 manifest
→ Tenancy provisioning 候选 Owner
→ Scope／Context Version／Context Head
→ Access Control 低敏 Anchor Reader／Provider
→ provenance → membership → anchor → Guard
→ 业务 Application Service
```

当前 Guard 链已能静态定位：`src/modules/security/domain/institution-scope-guard.ts:520-661` 强制 Session provenance、membership、anchor 的双键与时效一致；`institution-anchor-provider.ts:368-545` 对缺失、重复、停用或非法 revision 返回拒绝／unavailable；`institution-membership-provider.ts:290-485` 对 binding 缺失、机构不符、过期、撤销或占位值 fail-closed。

该 fail-closed 链只证明锚点存在性、唯一性、status 与 revision 的当前复核；Anchor Repository 没有读取 `provisioningSource`、digest 或 `approvedBy／approvedAt`，因此不能证明 manifest 审批 provenance 已被 Runtime 复核。

但这些 current 能力不关闭以下 BASE-02 缺口：

- `tenant_members` 没有显式 membership status 或 revision，当前以 `updatedAt` 作为 revision 时间；
- membership 查询没有把 tenant 停用状态形成独立授权事实；
- 正式 binding 写入、membership 生命周期、陈旧上下文失效和 revision CAS 未闭环；
- Context Version／Head 当前未进入 Guard 消费链。

因此：

- A2 只负责 Scope／Context 原始事实的 provisioning；
- membership／binding、Fresh Membership、Anchor revision 消费、入口／业务 Guard 与跨机构拒绝必须留给 BASE-02；
- A2 不签发权限、不创建 Reader 放行，也不把 Context 暂时归入 Access Control。

## 5. Manifest 契约

### 5.1 当前已知与缺失

0038 与 Schema 已提供的低敏持久字段包括：

- Scope：`tenantId`、`institutionId`、`status`、`revision`、`provisioningSource`、64 字符 `provisioningReferenceDigest`、`approvedBy`、`approvedAt`；
- Context Version：`version`、`timezone`、`currency`、`effectiveFromBusinessDate`、`effectiveAt`、`source`、`migrationProvenance`、`createdBy`；
- Context Head：`revision`、`latestVersion`、`updatedBy`。

当前约束只证明 digest 长度为 64、timezone 非空、currency 为 3 位大写；它不证明 digest 算法／编码、canonicalization、IANA timezone 或 ISO 4217 校验已经存在。

### 5.2 P1 前必须冻结的契约

| 项目 | `proposed` 契约 | 当前结论 |
|---|---|---|
| manifest version | 顶层必填、显式版本；拒绝未知版本 | 格式与兼容政策 `待确认` |
| 唯一来源／Owner | A2-P1 只接受 `approved_migration_manifest`；`formal_onboarding` 留给未来正式 Runtime | Owner 与正式来源证明 `阻断` |
| 审批 | 每批必须有低敏审批引用、审批人、审批时间和已批准状态；执行者不能自批 | 审批状态协议与权限 `待确认` |
| digest | 对冻结 canonical form 计算；算法、编码、字段顺序、Unicode／时间规范必须版本化 | Schema 只有长度 64；算法与 canonicalization `阻断` |
| 低敏白名单 | 仅包含 provisioning 必需字段、审批引用与计数；禁止 PII、Secret、Token 和凭证 | 白名单尚未形成正式仓库契约 |
| 生效 | 每个条目显式提供 business date 与 instant，不由执行环境时钟推导 | 实际政策 `待确认` |
| 撤销／替换 | 不覆盖既有 provenance；Scope status 纠正走获批 CAS 并递增 Scope revision；Context 纠正追加新 Version，再 CAS 更新 Head revision／latestVersion，不修改旧 Version | 语义 `待确认` |
| 仓库边界／P1 输入承载 | 仓库可保存低敏契约、验证逻辑和可审计 digest／计数；是把经授权的低敏冻结投影写入手写 SQL，还是由受控 runner 接收仓库外 manifest，必须独立决定 | 当前没有 runner／input 路径；SQL 是否可承载真实低敏投影 `阻断／待确认` |

### 5.3 字段规则

| 字段 | `proposed` 规则 | 冲突／缺失处理 |
|---|---|---|
| `tenantId` | 必填、长度符合 Schema、必须引用已存在 tenant；禁止默认或从单租户现状推断 | tenant 不存在即整批写前停止；A2 不创建 tenant |
| `institutionId` | 必填、长度符合 Schema；与 `tenantId` 形成唯一 Scope | 禁止从账号 binding、负责人、Seed 或 Demo 反推 |
| `status` | 显式 `active` 或 `suspended` | 不接受默认；既有值不同即冲突 |
| Scope `revision` | 新锚点显式 `1`；重复执行必须完全一致 | 非 1、缺失或既有不一致即停止；后续更改使用 CAS 与递增 revision |
| Context `version` | P1 首版显式 `1` | 不与 Context Head revision 混用 |
| `timezone` | 显式提供；未来验证器应校验获批 IANA zone | 当前只有非空检查，不能声称 IANA 已验证 |
| `currency` | 显式 3 位大写；未来验证器应校验获批 ISO 4217 集合 | 当前只检查格式，不能声称币种有效 |
| effective date／time | 显式 business date 与 UTC instant，二者语义和排序规则必须冻结 | 禁止用执行时钟、数据库默认或部署时区填充 |
| source／provenance | Scope source 固定为 `approved_migration_manifest`；Context source 的 P1 候选为 `product_default`，并显式记录 migration provenance | `product_default` 仍为 `proposed／待确认`；不得把 Demo／Seed／Mock 写成正式来源 |
| actor 字段 | `approvedBy`、`createdBy`、`updatedBy` 只能是获批的低敏主体引用 | 不得写 PII 或凭证；引用格式 `待确认` |

`src/modules/institution-contracts/v1/institution-operating-context.ts:17-59` 目前只是 wire declaration，不负责解析、授权、持久化或调度。其字符串 version、`timeZone/defaultCurrency` 与数据库整数 version、`timezone/currency` 尚无生产 mapper；P1 前必须冻结映射，不能靠字段近似自动推断。

历史技术设计曾以低级 `proposed` 证据给出 Context Version 1、`product_default`、`Asia/Shanghai`、`CNY`、`0001-01-01` 与 epoch 的候选组合（`docs/superpowers/plans/2026-07-18-institution-base-03-mig-01-technical-design.md:128-140`）。这些值不是 current，也不是最高级 target；未来 P1 必须经 manifest 契约和独立授权显式冻结，不能作为隐式默认。

### 5.4 重复与冲突原则

- 完整三元组（Scope、Version 1、Head）均不存在：在全部前置校验通过后原子插入；
- 三者均存在且所有不可变、审批、digest、source、revision／version 与 Context 字段完全一致：只读复用，净写入为 0；
- 任一部分存在、任一字段冲突或来源不明：写前停止，不补半套、不 `upsert`、不覆盖；
- 重复执行相同 manifest 必须得到相同 `inserted／reused／conflict／unexpected` 计数；
- 真实 manifest 内容与目标数据只能在未来获授权环境任务中核验。

## 6. A2-P1／A2-P2 严格拆分

固定候选顺序为：

```text
A2-P1 manifest 驱动 provisioning
→ 独立 handoff
→ A2-P2 复合键／索引／NOT VALID 关系
```

这是 MIG-01A2 内部候选顺序，不是本文合并后的自动 `NEXT_TASK`。项目级门禁仍为：

```text
本预检
→ 独立 handoff
→ A2-P1 manifest 驱动 provisioning
→ 独立 handoff
→ A2-P2 复合键／索引／NOT VALID 关系
```

第一次 handoff 必须回填本预检的合并结果，并重新冻结唯一下一任务；不得因为本文列出 P1 就自动启动 P1。该项目级顺序见 `docs/architecture/README.md:213-217` 与 `docs/handoff/NEXT_TASK.md:225-240`。

### 6.1 A2-P1

A2-P1 只允许候选处理：

- manifest 契约与低敏校验；
- Scope、Context Version 1、Context Head 1 的确定性创建或严格一致复用；
- 幂等重放、冲突封堵；
- 单事务、回滚和分类计数证据。

A2-P1 不允许：

- 新增复合键、索引、FK／CHECK；
- 回填业务表、验证历史约束、设置 `NOT NULL`；
- 写 membership／binding、签发 Guard 或放行 Reader；
- 同时夹带 BASE-02、Writer、Audit、B 或 C。

### 6.2 独立 handoff

P1 合并后必须独立回填：

- P1 Head／Merge Commit 与最新 main；
- 实际采用的 Migration 方式、journal 编号和 lease 释放；
- 获授权环境中的执行／未执行状态；
- inserted／reused／conflict／unexpected 计数；
- 备份／恢复点、冲突和前向修复状态；
- P2 是否具备独立启动条件。

P1 证据不完整时不得启动 P2。

### 6.3 A2-P2

A2-P2 才允许候选处理：

- 获批复合唯一键与索引；
- 获批 `NOT VALID` FK／CHECK；
- 后续 BASE-02 所需、经精确 allowlist 冻结的关系；
- 只创建约束，不提前 `VALIDATE`，不设置 `NOT NULL`，不回填业务数据。

P2 的精确约束清单目前仍是 `阻断／待确认`。`auth_account_institution_bindings` 当前有 tenant/member 关系但没有 `(tenant_id, institution_id) → institution_scopes` 关系（`src/server/db/schema.ts:911-955`）；更广业务关系必须在 P2 独立任务中逐项冻结，不能由本文发明。

P1、P2 不得合并为一个候选 PR；若二者最终都采用 Drizzle Migration，也必须分别取得独立授权与 lease。

## 7. Migration 元数据、编号与唯一 lease

### 7.1 current 元数据

| 项目 | 静态事实 | 结论 |
|---|---|---|
| journal | `drizzle/meta/_journal.json:271-276` 最新为 idx 38、tag `0038_mig_01a1_institution_isolation_expand`；共 39 项，与 SQL tag 集合一致 | current 到 `0038` |
| snapshot | 仓库共有 15 个 snapshot，最新为 `drizzle/meta/0026_snapshot.json` | current 到 `0026` |
| A1 snapshot 覆盖 | 0026 不含 A1 的 4 个枚举、3 张表及 5 个追加字段 | snapshot 不覆盖 A1 |
| 生成方式 | `docs/operations/drizzle-migration-snapshot-strategy.md:18-26` 与 `development-architecture.md:184` 阻断 `db:generate` 和 snapshot-diff Migration | 继续硬阻断 |
| 手写 SQL | 当前运维策略允许“已审查手写 SQL + journal”候选，`scripts/db/guarded-migrate.mjs:30-86,117-152` 可检查 SQL／journal 与 pending allowlist | 不等于 A2 已获手写 Migration 授权 |

旧 snapshot 策略文档和 `ProductionReadinessDocs.test.ts:64-70` 仍锁定早期 0035／0036 口径，属于治理证据漂移。该漂移可解释为文档／测试基线陈旧，但必须在实施切片中形成明确 metadata 处理决策；不能运行 `db:generate` 试图自动修补。

结论：

- snapshot 漂移不自动阻断所有获审查的手写 Migration；
- A2 是否采用手写 Migration、是否更新 snapshot 及如何验证，仍需独立 Schema／Migration 授权；
- 各环境真实 journal 不能由仓库 journal 推断，统一标记 `待授权核验`。

### 7.2 编号与方式

- `0039` 只是当前静态 journal 后的数值候选，不是预留、授权或 lease；
- 若 P1、P2 都采用独立 Migration，在没有任何并发漂移的瞬时假设下，数值候选可分别为 0039、0040；
- P2 不得提前写死 0040：必须在 P1 合并及独立 handoff 后重新 fetch、核对 origin/main、journal 和远端并发，再取下一空闲号；
- 若 P1 采用受控 runner 而不是 journal Migration，P2 编号将不同；当前仓库没有可证的 A2 runner 路径，因此不得在本文发明；
- P1 的输入承载方式是实施前 `阻断` 决策：候选一是经独立安全授权把低敏冻结投影写入手写 data Migration，候选二是建立受控 runner 接收仓库外 manifest。两者当前都未获授权，本文不选择优先方式，也不能冻结可执行文件集；
- P2 只能在 P1 方式和独立 handoff 确认后，以独立 DDL Migration 候选重新取号和取得 lease。

### 7.3 唯一 Migration lease

当前仓库的 guarded migrate 能校验单次执行输入，但不能提供跨 PR、跨 Agent 的唯一 Migration lease。本文未取得 lease。

| 维度 | `proposed` 规则 | 当前状态 |
|---|---|---|
| Owner | 每个切片由一名经用户明确授权的 Migration 协调者唯一持有；事实 Owner、审批人和执行人角色可分离 | 人员／角色 `待确认` |
| 开始 | 独立任务冻结 origin/main、journal、候选编号、文件范围、目标环境、备份和授权后生效 | 未开始 |
| 互斥 | lease 覆盖 `drizzle/**`、Schema、journal、metadata 与同一目标环境；同一时间不得有第二个 Schema／Migration Writer | 机制 `待确认` |
| 冲突 | 发现并发分支、编号占用、journal／base／Head 漂移或第二执行者即停止 | 未发现本轮 lease 冲突 |
| 失效 | 超过冻结窗口、任一基线漂移、授权撤回、环境状态变化或执行结果不可解释即失效 | 时限 `待确认` |
| 交接 | 合并及获授权环境证据完成后，在独立 handoff 记录计数、异常、forward-fix、最新 journal 和释放时间 | 尚未交接 |

### 7.4 分支保护与 Required Check

2026-07-29 只读 GitHub branch API 返回：

- `main.protected = false`；
- Required Check 的 checks／contexts 为空；
- enforcement level 为 off。

`.github/workflows/architecture-quality.yml` 已存在，“最小架构与质量门禁”包含架构自测、增量检查、lint、typecheck、完整测试和 build；Workflow 存在不等于 GitHub 服务端已强制阻断不合格合并。

`proposed`：在 A2-P1 与 A2-P2 实施前，应由用户／仓库管理员通过独立授权任务启用 main 保护，并将“最小架构与质量门禁”设为 Required Check。本文没有修改仓库设置；当前未启用保护不阻断本 docs-only 预检，但应作为两个实施切片的启动硬门。

## 8. 幂等与失败矩阵

### 8.1 A2-P1

| 场景 | 预期动作 | 必须计数／证明 | 停止与修复 |
|---|---|---|---|
| 空库、空获批输入 | 0 写入、成功 no-op | input=0，三表 inserted／reused／conflict／unexpected 均为 0 | 不得生成默认 tenant／institution |
| 未知 manifest version、未批准状态或 digest／canonicalization 校验失败 | 在安全形成条目集前整批停止 | batchRejected=1，committedInserted=0，净变化=0；不应用逐条守恒式 | 不兼容降级、不跳过审批或完整性校验 |
| manifest 内重复双键 | 信封通过并可安全枚举条目后，无论内容完全相同还是相互冲突，均写前拒绝 | 重复组内每个 raw entry 计入 duplicateKey conflict；committedInserted=0，净变化=0 | 不静默去重；修正 manifest 后重新审批并生成新 digest |
| 空库、非空输入 | 因 tenant 父记录不存在而写前停止 | missingTenant 计入 conflict；committedInserted=0，净变化=0 | A2 不创建 tenant；由独立前置任务解决 |
| tenant 存在，三类行均不存在 | 分类为 insertCandidate；零冲突后在单事务按 Scope → Version 1 → Head 创建 | 每类 committedInserted=input，reused=0，conflict=unexpected=0；提交后三类行数守恒 | 任一步失败则整批回滚 |
| 三类行全部完全一致 | 分类为 reuseCandidate；零冲突后只读复用，不 UPDATE／upsert | reused=input，committedInserted=conflict=unexpected=0，净变化=0 | 重复执行结果相同 |
| 部分存在 | 写前停止，不补半套 | partial 计入 conflict；committedInserted=0，净变化=0 | 生成低敏冲突清单；需新授权处理 |
| digest／source／status／字段冲突 | 写前停止 | conflict>0，committedInserted=0，净变化=0 | 不覆盖、不重绑；独立前向修复 |
| Scope revision／Context version／Head revision 不为初始值 | 写前停止 | revisionConflict 计入 conflict；净变化=0 | 不把两类 revision 混写，不自动递增 |
| 事务未提交时失败 | 无论目标是否共享，全部回滚 | 三表净变化=0；错误分类可审计 | 不得吞错重试 |
| 已在共享环境提交后发现错误 | 不删除、不覆盖、不修改旧 SQL／journal | 新审批、新编号、影响计数和 lineage | Scope 只按获批 CAS 更新 status／revision；Context 追加新 Version，再 CAS 更新 Head，不修改旧 Version |

P1 使用两层计数。未知版本、未批准状态、信封 digest 或 canonicalization 失败发生在安全形成条目集之前，只报告 `batchRejected=1` 和净变化为 0，不应用逐条守恒式。

信封通过并可安全枚举 raw entries 后，先完成全批分类，再决定是否进入写事务：

```text
input = insertCandidate + reuseCandidate + conflict
unexpected = 0

if conflict > 0:
  committedInserted = 0
  Scope net-inserted = Version net-inserted = Head net-inserted = 0

if conflict = 0:
  committedInserted = insertCandidate
  reused = reuseCandidate
  Scope net-inserted = Version net-inserted = Head net-inserted = committedInserted
```

`duplicateKey`、`missingTenant`、`partial`、`revisionConflict` 和其他可安全枚举的字段冲突是 `conflict` 的互斥诊断子类，不能在守恒式之外重复计数。重复双键组的每个 raw entry 都计入 `duplicateKey`，不能静默压成一个条目；三张表还必须分别报告逐表 committedInserted／reused 和净新增量。

任何不满足均停止，不得把告警降级为成功。

### 8.2 A2-P2

| 场景 | 预期动作 | 必须计数／证明 | 停止与修复 |
|---|---|---|---|
| P1 未关闭或计数不一致 | 不执行 DDL | planned=created=reused=0 | 返回独立 handoff 补证据 |
| 目标对象均不存在且数据 shape／锁窗口满足 | 在获批事务边界内创建 allowlist 中的关系 | created=planned，reused=conflict=unexpected=0 | 只创建，不 VALIDATE、不 NOT NULL |
| 目标对象均存在且完整定义一致 | journal 防重或只读复用 | reused=planned，净变化=0 | 不能只比较对象名 |
| 部分存在 | 停止，输出 catalog inventory | conflict>0，created=0 | 不覆盖、不改名绕过 |
| 同名但定义、列序、predicate 或 validation 状态不同 | 停止 | conflict>0，unexpected=0 | 重新冻结 allowlist 与 forward-fix |
| DDL 事务失败 | 整体回滚 | 净对象变化=0 | 若选择非事务 DDL，必须另拆切片并定义未知状态恢复 |
| 已在共享环境执行后发现错误 | 不破坏性 down，不改旧 Migration／journal | 新 Migration、新 lease、forward-fix 证据 | 保留已被消费的关系，前向纠正 |

P2 必须在 catalog 预检中逐项比较对象类型、列序、引用目标、predicate、`NOT VALID` 状态和依赖；冲突与 unexpected 必须为 0。

## 9. 仓库外待授权核验

以下事项均为 `待授权核验`，本轮没有读取或连接：

| 事项 | 未来最小证据 | 未核验时的处理 |
|---|---|---|
| 各环境真实 journal | 目标环境、最新已执行 tag、pending 清单、核验时间与操作者 | 阻断 P1／P2 环境执行 |
| 备份与恢复点 | 可恢复备份标识、完成时间、恢复演练或批准的回退窗口 | 阻断任何共享环境写入 |
| 真实 manifest | 版本、审批状态、digest、条目计数、低敏契约符合性 | 阻断 P1 |
| 目标数据库与数据状态 | tenant 父记录、三表现状、冲突／部分存在计数、catalog shape | 阻断 P1／P2 |
| 部署版本 | 应用／Schema 基线与执行目标对应关系 | 不得推断已上线 |
| 环境配置和凭证边界 | 仅确认授权范围和执行身份，不在文档中打印值 | 未授权不得访问 |

## 10. 后续候选切片

所有切片均为 `proposed`，必须由用户对当次任务、文件、Schema／Migration、环境、风险和 lease 逐项明确授权。

### 10.1 A2-P1 manifest 驱动 provisioning

| 维度 | 冻结内容 |
|---|---|
| 精确依赖 | Scope／Context／manifest Owner 独立决策；manifest 契约和审批；metadata 决策；真实 journal、目标数据、备份；main 保护与“最小架构与质量门禁”Required Check 已启用并经只读核验；唯一 lease；独立用户、Schema／Migration、环境授权 |
| 候选文件 | 当前不能冻结可执行文件集：若安全决策允许低敏冻结投影进入 data Migration，候选类型才可能是 `drizzle/<lease-分配编号>_*.sql`、`drizzle/meta/_journal.json` 和必要测试；若使用受控 runner，当前仓库无可证路径。输入承载方式和 Owner 未定均为 `阻断`，不得发明路径 |
| 必需测试 | 契约版本／批准状态／digest／canonicalization；manifest 内同双键重复；空库；tenant 缺失；三表全缺／全一致／部分存在；重复执行；字段与 revision 冲突；事务回滚；逐表与批次计数守恒；禁止默认 institution；完整架构质量门禁 |
| 启动条件 | 上述依赖全部关闭，base／journal／编号冻结且 lease 唯一，文件 allowlist 获批 |
| 完成证据 | 单主题 PR；仓库静态验证；获授权环境的 journal、三表计数、冲突=0、unexpected=0、备份与 forward-fix 记录；独立 handoff |
| 停止条件 | Owner／manifest／环境不明；tenant 缺失；部分存在；任何字段或 revision 冲突；计数不守恒；事务结果不可解释；base／journal／Head／lease 漂移；需要扩大获批范围 |
| 回退／前向修复 | 事务未提交时无论环境是否共享都整体回滚；共享环境已提交后不删除、覆盖、重绑或改旧 Migration。Scope 仅以获批 CAS 更新 status／revision；Context 追加新 Version 并 CAS 更新 Head；全部使用新审批、新编号和可追溯 forward-fix |
| 所需授权 | 用户实施授权、Schema／Migration 授权、目标环境与备份授权、真实 manifest 核验授权、唯一 lease |

### 10.2 独立 handoff

| 维度 | 冻结内容 |
|---|---|
| 精确依赖 | P1 合并；所有获授权环境执行结果已知；lease 可释放 |
| 候选文件 | 由新的 docs-only handoff 任务单独冻结；本文不授权任何 handoff 文件 |
| 必需验证 | 回填 P1 Head／Merge、journal、Actions、环境计数、冲突、备份、forward-fix 与 lease 释放；重新 fetch 最新 main |
| 启动／完成条件 | P1 交付证据完整；唯一下一任务明确；P2 依赖逐项关闭 |
| 停止条件 | 环境状态未知、计数不守恒、Owner 或 metadata 决策仍未关闭、存在并发 Migration |
| 回退／前向修复 | 不启动 P2；保持已提交 Scope 不被覆盖，以新任务重新冻结 |
| 所需授权 | 独立 docs-only handoff 授权 |

### 10.3 A2-P2 复合键／索引／NOT VALID 关系

| 维度 | 冻结内容 |
|---|---|
| 精确依赖 | P1 及独立 handoff 完成；P2 exact constraint allowlist；catalog／数据 shape；锁与超时策略；metadata 决策；main 保护与“最小架构与质量门禁”Required Check 已启用并经只读核验；新的唯一 lease；独立 Schema／Migration／环境授权 |
| 候选文件 | `drizzle/<届时下一空闲编号>_*.sql`、`src/server/db/schema.ts`、`drizzle/meta/_journal.json`、必要 metadata（是否允许仍待确认）、Schema／Migration／升级回退测试 |
| 必需测试 | 复合键与 FK 目标；列序／predicate；`NOT VALID` 状态；全缺／全一致／部分存在／定义冲突；事务失败；无数据重写；不 VALIDATE／不 NOT NULL；完整架构质量门禁 |
| 启动条件 | P1 关闭且环境计数为零冲突；约束 allowlist 和执行窗口唯一冻结；新编号与 lease 无冲突 |
| 完成证据 | SQL、Schema、journal 和测试一致；created／reused 守恒；conflict=unexpected=0；约束保持未验证；独立 handoff |
| 停止条件 | P1 未关闭；约束目标不唯一；数据 shape 不明；部分对象或定义冲突；编号／lease／base 漂移；要求提前 VALIDATE、回填或 NOT NULL |
| 回退／前向修复 | 未共享时在已验证事务边界回滚；共享环境后使用新编号 forward-fix，不破坏性删除已消费关系，不修改旧 SQL／journal |
| 所需授权 | 用户实施授权、Schema／Migration 授权、目标环境与锁窗口授权、唯一 lease |

## 11. 阻断、已确认边界与预检结论

### 11.1 关键阻断

1. Scope、Context Version、Context Head 与 manifest 的具体实现 Owner 尚未由最高级 target 唯一冻结；
2. manifest version、可信来源、审批协议、低敏白名单、canonicalization、digest 算法、撤销／替换语义尚未形成正式契约；
3. Scope／Version／Head provisioning Writer、事务、计数和重放测试不存在；
4. journal／snapshot 漂移下的 A2 metadata 策略和手写 Migration 授权尚未决定；
5. P1 的真实输入承载方式（获批低敏 SQL 投影或受控 runner）及其安全边界尚未决定；
6. P1／P2 的实施方式、精确编号、唯一 lease Owner／窗口／交接尚未冻结；
7. P2 的 exact constraint allowlist、catalog shape 与锁策略尚未冻结；
8. main 当前未启用分支保护或 Required Check；
9. 真实 manifest、环境 journal、目标数据、备份／恢复点和部署状态均待授权核验。

### 11.2 已确认边界

- A1 仅具备静态 Expand，不等于 A2、回填、Enforce 或 MIG-01 已关闭；
- Access Control 不得成为第二套 Tenancy Scope／Context 事实源；
- A2-P1 与 A2-P2 必须由独立 handoff 隔开，不得合并；
- `db:generate` 与 snapshot-diff Migration 继续阻断；
- 0039 只是当前数值候选，不是预留或授权；
- 未获得独立授权前，不启动 A2-P1、A2-P2、BASE-02、Writer、Reader 或任何后续任务。

### 11.3 最终结论

MIG-01A2 当前状态是“结构基础部分存在，但 provisioning 实现缺失且启动受阻”。Owner 候选与静态证据已经能够完整枚举，所以本 docs-only 预检可以交付；但 Scope／Context／manifest 的具体 Owner、manifest 契约、metadata 策略、环境证据、Required Check 和唯一 Migration lease 均未关闭，A2-P1 与 A2-P2 都没有获得实施授权。

后续只能先经项目级 handoff，再按以下候选顺序重新冻结：

```text
独立 handoff
→ A2-P1 manifest 驱动 provisioning
→ 独立 handoff
→ A2-P2 复合键／索引／NOT VALID 关系
```

本文完成不代表 A2 已启动，不改变 MIG-01 后续顺序，也不恢复平台切片或机构端旧任务。
