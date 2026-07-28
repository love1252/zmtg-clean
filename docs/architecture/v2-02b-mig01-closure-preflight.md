# V2-02B：MIG-01 完整关闭链审计与实施切片冻结

## 1. 文档定位

本文是任务 `V2-02B-MIG01-CLOSURE-PREFLIGHT` 的仓库内静态预检，基线为：

- 日期：2026-07-28，时区 `Asia/Shanghai`；
- 仓库：`love1252/zmtg-clean`；
- `main`：`1d2691a60fd021af815a7449af8c5c1b33d8d274`；
- 审计方式：只读取当前 `main` 的代码、Schema、Migration、测试、脚本、配置、架构文档、ADR 与 handoff；
- 唯一交付：本文。

本文回答 MIG-01A1 至 MIG-01C 当前具备什么、完整静态影响面是什么，以及后续独立实施 PR 应如何串行拆分。本文不是 Migration、Schema、Runtime、Reader、Capability 或环境执行授权。

本文中的状态只使用以下五种：

| 状态 | 含义 |
| --- | --- |
| 已具备 | 当前仓库已经形成该单元所需的完整静态证据；不代表任何环境已经执行或发布 |
| 部分具备 | 当前仓库已有可复用构件，但尚未形成完整关闭证据 |
| 缺失 | 当前仓库未发现该单元所需实现或证据 |
| 阻断 | 当前缺口或前置条件使后续单元不得启动 |
| 待确认 | 只能由独立决策或仓库外受控核验回答 |

“各环境真实 Migration 状态待核验”属于仓库外事项，在状态表中统一记为“待确认”。`current` 只表示当前仓库可验证事实；`target`、`proposed` 和 `planned` 均不表示已经实现。

## 2. 事实源、权威关系与禁止范围

### 2.1 事实源

本次结论按以下证据读取：

1. 当前实现事实：`src/server/db/schema.ts`、`drizzle/**`、`src/server/db/**`、`src/modules/**`、`src/app/**`、`scripts/**`、测试和 `package.json`；
2. 架构目标与固定门禁：`docs/architecture/architecture-v2.md`、`docs/decisions/architecture-v2-decisions.md`；
3. 同一架构的展开证据：`docs/architecture/data-architecture.md`、`docs/architecture/software-architecture.md`、`docs/architecture/development-architecture.md`、`docs/architecture/architecture-v2-module-map.md`；
4. 审计、七线与阶段状态：`docs/architecture/architecture-v2-evidence-audit-20260728.md`、`docs/architecture/institution-seven-stream-restart-baseline.md`、`docs/handoff/CURRENT_STATUS.md`、`docs/handoff/NEXT_TASK.md`；
5. 历史 MIG-01 技术设计参考：`docs/superpowers/plans/2026-07-18-institution-base-03-mig-01-technical-design.md`；按架构索引，该文件属于 `historical`，不是新的事实源或执行授权。

当前代码与目标架构不一致时，本文同时记录两层事实，不用目标覆盖当前实现，也不用当前实现降低既定目标。

历史 MIG-01 技术设计提供候选细节。经本次 `current` 证据复核后，仍未被 `architecture-v2.md` 或已接受 ADR 明确接受的传播顺序、证据等级、精确表／约束／索引清单，统一标记为本预检冻结的 `proposed` 候选；它们不得覆盖当前实现，也不得被解释为 Runtime、Schema、Migration 或环境执行授权。

### 2.2 禁止范围

本轮没有：

- 修改 Schema、Migration、Runtime、API、UI、测试、脚本、配置、package 或 lockfile；
- 创建 `0039` 或任何其他 Migration；
- 运行测试、Build、`db:generate`、Migration、Seed 或部署；
- 读取 `.env.local`、`DATABASE_URL`、Secret、Token、私钥、真实 manifest 值或 PII；
- 连接数据库、HIS、企业微信、AI 厂商、对象存储、CI、监控、测试服务器或生产环境；
- 启动 MIG-01、V2-02C、真实 Reader、Capability 或机构端旧任务。

本文列出的文件类型、测试、命令类别和实施顺序只定义未来切片边界，不构成执行许可。

## 3. MIG-01 固定关闭链

关闭链保持为：

```text
MIG-01A1 Expand
→ MIG-01A2 锚点 provisioning
→ BASE-02B／BASE-02 双键上下文、scope revision、Guard
→ 全部 Writer 双写与旧 Writer 封堵
→ 审计 institution attribution 与模板 fail-closed
→ MIG-01B 确定性回填、追赶和冲突清零
→ MIG-01C 非空、外键、attribution 与 shape enforce
→ Reader 重新核验与独立放行
```

不得交换顺序。A1 的可空 Expand 不证明机构归属、回填、约束或 Reader 已完成；A2 的锚点不证明当前成员授权；账号绑定、当前负责人、单机构假设、Seed、Demo、Mock、测试通过或代码存在都不能替代业务归属证据。

只有 MIG-01C 完成且 BASE-02 当前成员服务端 `tenantId + institutionId` 双键上下文可用，MIG-01 才能标记关闭。Customers 与 Institution System 的真实 Reader 此前保持关闭；七条机构业务线正式发布仍为 0/7。

### 3.1 项目级阶段顺序与 MIG-01 内部顺序

本文冻结的：

```text
A2
→ BASE-02
→ Writer
→ Audit／模板
→ B
→ C
→ Reader
```

只是 MIG-01 关闭链内部的候选实施顺序，不表示 PR #789 合并后可以立即启动 A2。

在没有后续独立 handoff、ADR 或用户明确决策调整前，当前已合并架构索引中的项目级参考顺序保持为：

```text
V2-02B-MIG01-CLOSURE-PREFLIGHT
→ V2-02C-PLATFORM-AUTH-ROUTE-PREFLIGHT
→ 最小 Architecture／Quality CI
→ MIG-01 后续独立数据 PR
```

PR #789 合并后仍需独立 handoff：

- 回填 PR #789 的合并结果；
- 决定并冻结唯一下一任务；
- 不得因为本文列出 A2 就自动启动 A2；
- 不得自动跳过 V2-02C 或当前架构索引中的质量门禁。

如未来需要调整 Architecture／Quality CI 的准确插入点，必须通过独立任务明确决定；本文不得静默改变当前索引顺序。

## 4. 关闭单元总表

| 单元 | 状态 | 当前证据 | 缺失证据 | 阻断项 | 仓库外待核验事项 | 建议后续切片 |
| --- | --- | --- | --- | --- | --- | --- |
| MIG-01A1 Expand | 已具备 | `0038`、Schema、journal 与 Schema 测试对三张新表、四张扩展表和四个 enum 的核心事实一致 | 未逐项自动比对全部 CHECK/FK；snapshot 未更新 | 不阻断静态 A1 结论，但禁止据此进入 Reader | 各环境是否执行到 0038、是否部分应用、实际对象是否一致，均待核验 | 不重做 A1；后续切片先确认环境与元数据基线 |
| MIG-01A2 锚点 provisioning | 缺失 | A1 已提供 Scope、Context Version、Context Head 结构 | 获批 manifest、owner、provision Writer、幂等与计数证据均不存在 | 无法证明合法机构锚点、version 1、head 或 binding→anchor | manifest、机构清单、批准证据、现存行和真实 journal 待核验 | 独立 A2 数据/Migration 切片 |
| BASE-02B／BASE-02 | 部分具备 | 正式 session、provenance、membership、anchor Reader、opaque anchor revision reference、Scope/Section Guard 与 server composition root 已存在 | A2 权威行、binding→Scope FK、Scope status/revision CAS mutation 与失效生命周期、全 API/Object/Action Guard、全部 Writer 上下文仍未关闭；Operating Context Provider 是独立 Runtime 缺口 | A2 缺失；通用 `AccessContext.institutionId` 可空；旧业务边界仍 tenant-only | key material、正式配置与环境可用性待核验，且不得在本文读取 | 独立 BASE-02B／BASE-02 Runtime 切片 |
| 全部 Writer 双写与旧 Writer 封堵 | 阻断 | 少数输入或记录已携带 `institutionId`；部分严格 WeCom 路径按双键读写 | A1 四类新增列没有连续 Writer；Seed、Trial、Audit 和旧 Repository 仍可绕过 | 任一旧实例或 tenant-only Writer 都会在 B/C 前持续制造空值 | 实际运行版本、后台作业、仓库外导入和维护任务待核验 | 独立 Writer 双写切片 |
| 审计 attribution 与模板保护 | 阻断 | 部分证据为审计列/enum 已 Expand、模板具备人工审批和禁自动发送字段、部分草稿路径已按双键读取 | 审计领域、mapper、DTO、查询和调用方未携带 attribution；模板作用域与版本保护不完整 | 新审计仍可能写空；机构查询 tenant-only；模板跨机构引用和默认数据归属不能证明，因而 B 不得启动 | 历史审计可归属率、模板实际引用冲突待核验 | 最小审计兼容 Writer，再做模板 fail-closed |
| MIG-01B 回填 | 阻断 | 固定关闭链要求确定性回填、追赶与冲突清零；本文提出 `proposed` 传播顺序和证据等级 | 没有回填 SQL/脚本、规则版本、高水位、批次、计数、追赶或冲突清零证据 | A2、BASE-02、Writer、审计和模板前置均未完成 | 行数、空值、孤儿、冲突、备份、窗口待核验 | 独立 MIG-01B 切片 |
| MIG-01C Enforce | 阻断 | 固定关闭链要求非空、外键、attribution 与 shape enforce；本文提出 `proposed` 精确约束候选 | 没有 C Migration、约束验证、锁影响、升级/回退演练证据 | B 未清零；当前字段仍可空、父子关系仍 tenant-only | 环境约束可验证性、锁时长、恢复点待核验 | 独立 MIG-01C 切片 |
| Reader 重新核验与放行 | 阻断 | `/hospital` 已接正式 Guard，但仍只渲染 capability-off；机构 API 候选 Route 仍关闭 | 没有 MIG-01C 环境证据、逐 Reader 对象 Guard、发布与回退证据 | 任何 tenant-only、默认机构、Mock/Seed fallback 都阻断 | 实际部署、Capability、监控和发布状态待核验 | MIG-01C 后逐 Reader 独立放行 |

MIG-01 整体状态为“阻断”，不能从 A1、正式 Guard 地基或 capability-off 壳推断为已关闭。

## 5. MIG-01A1 静态审计

### 5.1 A1 精确范围

`drizzle/0038_mig_01a1_institution_isolation_expand.sql` 直接触及 7 张表。下表状态只评价 A1 的静态结构，不代表 MIG-01 完整关闭：

| 表 | A1 动作 | 当前约束证据 | 状态 |
| --- | --- | --- | --- |
| `institution_scopes` | 新建 10 字段 | 复合 PK；tenant FK；revision 正数；digest 长度 64 | 已具备 |
| `institution_operating_context_versions` | 新建 11 字段 | 三列 PK；Scope FK；effective time UNIQUE；version、timezone、currency CHECK | 已具备 |
| `institution_operating_contexts` | 新建 7 字段 | 复合 PK；Scope FK；latest version 三列 FK；revision/latest version 正数 | 已具备 |
| `appointments` | 新增可空 `institution_id` | 无机构 FK、机构 UNIQUE、机构索引或 shape CHECK | 部分具备 |
| `treatment_summaries` | 新增可空 `institution_id` | customer/appointment 关系仍为 tenant-only | 部分具备 |
| `follow_up_tasks` | 新增可空 `institution_id` | customer/source summary 关系仍为 tenant-only | 部分具备 |
| `audit_events` | 新增可空 `institution_id` 与可空 `institution_attribution` | 无 Scope FK、机构索引或 attribution shape CHECK | 部分具备 |

依赖但未被 0038 修改的父表为 `tenants`。关闭链相邻表还包括 `customers` 与 `auth_account_institution_bindings`：前者的 `institution_id` 仍可空，后者虽非空但没有指向 `institution_scopes` 的复合 FK。

SQL 位于 `drizzle/0038_mig_01a1_institution_isolation_expand.sql:1-71`；对应 Schema 位于 `src/server/db/schema.ts:112-127`、`:380-499`、`:2450-2585`、`:2877-2908`。

### 5.2 Schema、Migration、journal 与测试一致性

当前静态证据一致：

- 四个 enum 精确为：
  - `institution_scope_status = active | suspended`；
  - `institution_provisioning_source = formal_onboarding | approved_migration_manifest`；
  - `institution_operating_context_source = institution_config | product_default`；
  - `audit_institution_attribution = not_applicable | verified | legacy_unattributed`。
- `_journal.json` 已登记 idx `38`、tag `0038_mig_01a1_institution_isolation_expand`，见 `drizzle/meta/_journal.json:271-276`；
- `src/server/db/tests/Schema.test.ts:3164-3351` 验证三张新表、关键约束、可空新增列、无默认值，并明确 0038 没有 provision、回填、Enforce 或业务 Scope FK；
- 0038 没有 `INSERT`、`UPDATE`、`DELETE`、`TRUNCATE` 或 `SET NOT NULL`。

因此 A1 的“已具备”只表示仓库静态 Expand 证据成立。它不证明：

- 任一环境已执行 0038；
- A2 已插入锚点；
- 新增业务列已经双写或回填；
- attribution 已分类；
- NOT NULL、复合 FK、机构唯一键、机构索引或 shape enforce 已完成。

### 5.3 A1 重放风险

三张表和部分 FK 使用了存在性保护，但 enum 与 `ADD COLUMN` 不是完整可重复执行协议。若环境中存在部分应用，不得直接重跑猜测；必须先在独立、获批的环境预检中确认实际对象与 journal。

## 6. MIG-01A2 锚点 provisioning 审计

### 6.1 当前状态

仓库没有发现：

- 获批 MIG-01A2 provisioning manifest；
- 对 `institution_scopes`、`institution_operating_context_versions` 或 `institution_operating_contexts` 的生产 Writer；
- 创建 version 1 与 head 的脚本或 Migration；
- manifest digest、批准人、批准时间、计数守恒或重复执行验收；
- `auth_account_institution_bindings` 到 `institution_scopes` 的复合 FK；
- 缺失、冲突、停用、未知归属的处理实现。

静态搜索中 `approved_migration_manifest` 与 `provisioning_reference_digest` 的非文档引用只存在于 0038、Schema 和 Schema 测试。`institution_scopes` 只有 `src/modules/security/server/institution-anchor-repository.ts` 的只读路径；两个 Operating Context 表没有生产读写。

### 6.2 锚点来源与所有权

`target` 只允许两种创建来源：

1. `formal_onboarding`：正式开户/合同侧受控记录；
2. `approved_migration_manifest`：逐 tenant 人工批准的迁移清单。

账号绑定、成员、负责人、客户行、当前单机构现状、自由文本、Seed 或 Demo 都不能反向创建机构锚点。

既有事实所有权把租户、机构、成员关系置于 Tenancy + Access Control。`proposed` 的职责拆分为：Tenancy 拥有 Scope 与 provisioning；Access Control 只消费锚点、membership 和 revision 证据，不自行创建机构。该具体实现 owner 仍需在 A2 授权前确认，状态为“待确认”。

### 6.3 A2 的 `proposed` 候选顺序

以下顺序来自历史设计与本次静态证据复核，是供 A2 独立授权确认的 `proposed` 候选；确认后，provisioning 应在单一受控事务中：

1. 校验 manifest 的版本、digest、批准人、批准时间、tenant/institution 唯一性和总数；
2. 显式插入 `institution_scopes`，写入获批 `status` 与 `revision=1`；
3. 插入 `product_default` 的 Operating Context version 1；
4. 插入 head，显式写 `revision=1` 与 `latest_version=1`；
5. 对 manifest、Scope、version、head 逐 tenant 核对计数；
6. 不设置默认机构，不回填业务事实，不收紧非空。

`proposed` 的段内拆分为：provisioning 事务提交并完成计数证据后，由 A2-P2 创建获批的复合唯一键、索引和 `NOT VALID` 锚点／业务 FK；业务 FK 不得混入 provisioning 事务。A2-P2 只创建、不验证历史行，具体约束 allowlist 仍由 A2 授权确认；后续 C-P1 只验证这些既有约束，不重复创建。

重复执行只允许“所有字段与已批准 manifest 完全一致”的 no-op。不得覆盖式 upsert。既有行的 source、digest、批准证据、status 或 revision 任一不一致，立即停止。

### 6.4 A2 fail-closed 条件

以下任一情况阻断 A2：

- manifest 缺失、未批准、重复、版本不明或摘要不一致；
- tenant 不存在，或 tenant/institution 归属不明；
- 现有 Scope、version、head 或 binding 与 manifest 冲突；
- revision 不是显式正整数 `1`，出现默认值、递减、复用或覆盖；
- active/suspended 语义或恢复策略未确认；
- 实际环境 journal、备份、恢复点或升级窗口未知；
- 需要把账号绑定、负责人、单机构假设或 fixture 当作锚点来源。

## 7. BASE-02B／BASE-02 审计

### 7.1 已有正式地基

当前仓库已经存在以下可复用构件：

- 正式账号、tenant member 与 account-institution binding 查询：`src/modules/auth/server/auth-account-repository.ts:437-627`；
- 正式 session Cookie 将 `tenantId + institutionId` 绑定到签名 claims：`src/modules/auth/server/formal-server-session-provenance-owner.ts:500-726`；
- request provenance owner：`src/modules/security/server/formal-request-provenance-owner.ts`；
- membership fact、binding revision、过期/撤销/placeholder 拒绝：`src/modules/security/server/institution-membership-provider.ts:290-415`；
- Scope Reader 按双键读取并在缺失、重复、暂停或坏 revision 时 fail-closed：`src/modules/security/server/institution-anchor-repository.ts:25-48`、`institution-anchor-provider.ts:368-546`；
- `membershipRevision`、`bindingRevision`、`anchorRevision` 的 opaque reference 与短期有效期：`src/modules/security/server/institution-guard-evidence.ts`、`institution-guard-reference.ts`；
- Scope/Section Guard 与统一授权 composition root：`src/modules/security/server/institution-scope-guard.ts`、`institution-section-guard.ts`、`institution-request-authorization.ts`；
- server runtime composition：`src/modules/institution/server/institution-server-runtime.ts:348-427`；
- `/hospital` 与 `/hospital/[...slug]` 已消费正式导航授权，但最终页面仍保持 capability-off：`src/app/hospital/page.tsx`、`src/app/hospital/[...slug]/page.tsx`。

这些构件证明正式双键授权链的地基“部分具备”，不证明业务 Reader/Writer 或 A2 已关闭。

### 7.2 仍然缺失的上下文与 revision

- `AccessContext.institutionId` 在通用类型中仍为可选/可空，见 `src/modules/security/domain/access-control.ts:71-78`；
- `resolveInstitutionAccessContextV1` 只是结构收窄，并明确不验证当前 membership 或授权具体对象/动作，见 `src/modules/security/server/institution-access-context.ts:73-108`；
- `institution_operating_context_versions` 与 `institution_operating_contexts` 没有生产 Reader/Writer；
- 当前 Guard 能分别验证 membership、binding、anchor 和 policy revision；`institution_scopes.revision → opaque arv` 已实现 Reader/签发地基，但 A2 权威行、Scope status/revision CAS mutation 与失效生命周期仍缺失；
- Operating Context Provider 是独立运行上下文缺口，不是授权 anchor revision 的替代物；是否还需要额外“组合 revision”属于 `proposed／待确认`，不能写成 BASE-02 已接受硬门；
- `auth_account_institution_bindings` 没有 Scope FK，且仓库没有正式 provisioning Writer；
- `canAccessResource` 的旧通用路径主要只比较 tenant，没有统一 `targetInstitutionId` 和对象 owner 校验；
- 机构业务 API 还没有把正式授权链接入每个 Route、Application Service、Repository 和 Object/Action Guard。

因此不能把现有 opaque revision reference 表述为完整的 BASE-02 current context。

### 7.3 Guard 边界

已有中央链能拒绝：

- provenance 与请求 Scope 不一致；
- membership 缺失、重复、撤销、过期、placeholder 或错机构；
- anchor 缺失、重复、suspended、revision 非正整数或过期；
- cross-tenant、cross-institution 与 stale reference；
- key ring、clock、repository 或 provider 不可用。

仍需逐业务入口关闭：

- Page/Route 的正式 session 入口；
- Application Service 的 action 授权；
- Repository 的对象机构归属；
- 客户、预约、摘要、任务、路径、草稿、时间线与审计的父子双键一致性；
- 所有失败路径的 fail-closed 和低敏输出。

任何客户端提交的 institution、当前负责人、显示字段、默认机构或历史缓存都不能覆盖服务端 Scope。

## 8. 全部 Writer 双写与旧 Writer 封堵

### 8.1 静态 Writer 清单

MIG-01 完整 14 表影响面中，当前找到 11 个实际 Writer/脚本文件。对 14 个表符号统计，生产 TypeScript 有 47 个直接 Drizzle `insert/update/delete` 静态位置；另有一个 Demo 原生 helper 脚本的 16 个插入/清理调用。该计数只描述静态调用点，不表示每个调用点都是独立部署单元。

| Writer／脚本 | 涉及事实 | 当前缺口 | 状态 |
| --- | --- | --- | --- |
| `src/modules/institution/server/tenant-business-repository.ts` | customers、appointments、follow-up task/path/stage/draft/timeline | 多个输入的 institution 可选；大量查询和更新仍 tenant-only；任务显式 Writer 不写新增列 | 阻断 |
| `src/modules/institution/server/treatment-summary-repository.ts` | appointments、treatment summaries | create/update/void 类型与 `.values()` 不包含 institution；归属检查 tenant-only | 阻断 |
| `src/modules/institution/server/trial-provisioning-service.ts` | customers、appointments、treatment summaries、follow-up tasks | 虽持有 institution，但只给 customer 写入；其余三类遗漏 | 阻断 |
| `src/modules/audit/server/audit-event-repository.ts` | audit events | `TenantAuditEvent` 与 mapper 不携带 institution/attribution | 阻断 |
| `src/modules/institution/server/wecom-real-send-proof-repository.ts` | drafts、audit events | draft 读取按双键；复制的 audit mapper仍遗漏新增字段 | 部分具备 |
| `src/modules/open-platform/server/tenant-account-management-repository.ts` | audit events | 审计插入复用缺字段 mapper | 阻断 |
| `src/modules/open-platform/server/tenant-plan-binding-repository.ts` | audit events | 两个审计插入复用缺字段 mapper | 阻断 |
| `src/modules/open-platform/server/tenant-plan-change-repository.ts` | audit events | 审计插入复用缺字段 mapper | 阻断 |
| `src/modules/open-platform/server/trial-data-reset-service.ts` | customers、appointments、treatment summaries、follow-up tasks、audit events | 按 tenant 读取/删除；审计 mapper缺字段 | 阻断 |
| `src/server/db/seed-demo-data.ts` | customers、appointments、treatment summaries、follow-up tasks、audit events | 只有 customer 连续写 institution；其余新增列和 attribution 均遗漏 | 阻断 |
| `scripts/demo/seed-v06-low-sensitive-demo.ts` | customers、treatment summaries、follow-up facts、templates | 部分记录有 institution，但摘要/任务仍遗漏，且 helper 绕过正式上下文 | 阻断 |

以下当前没有生产 Writer：

- `institution_scopes`；
- `institution_operating_context_versions`；
- `institution_operating_contexts`；
- `auth_account_institution_bindings` 的正式 provisioning/维护入口。

### 8.2 关键连续双写缺口

对 A1 四类新增列的生产直接引用为 0：

```text
appointments.institutionId
treatmentSummaries.institutionId
followUpTasks.institutionId
auditEvents.institutionId
auditEvents.institutionAttribution
```

具体证据：

- `createFollowUpTaskFromTreatmentSummarySuggestion` 与 `createManualFollowUpTask` 显式组装值但不写 institution，见 `tenant-business-repository.ts:833-925`；
- `createTreatmentSummary`、update、void 均只使用 tenant/id，见 `treatment-summary-repository.ts:265-468`；
- Trial Provisioning 只在 customer insert 写 institution，见 `trial-provisioning-service.ts:324-419`；
- Demo Seed 的 appointment、summary、task、audit upsert 均遗漏新增列，见 `seed-demo-data.ts:1728-1835`；
- 通用审计 mapper 位于 `audit-event-repository.ts:30-45`，WeCom 复制 mapper 位于 `wecom-real-send-proof-repository.ts:60-74`。

### 8.3 旧 Writer 封堵门

未来 Writer 切片只有同时满足以下条件才能完成：

1. 每个 Writer 只从正式服务端 Guard 上下文取得双键；
2. 父子对象在同一事务重新核验 institution 一致；
3. 机构高风险 mutation 与 `verified` audit 保持事务一致；审计不可写时 fail-closed；
4. 平台/tenant 审计写 `not_applicable`，机构审计写 `verified + institution_id`；
5. Seed、Demo、Import、维护脚本、fixture 和旧实例要么升级双写，要么明确冻结；
6. 双写开始后禁止回滚到 tenant-only Writer；
7. 记录双写启动高水位，并持续检查新增空值；
8. 任何未知 Writer、空 institution、默认机构或混跑旧版本立即停止。

Capability-off 只关闭当前页面/Route，不等于旧 Repository、脚本或部署实例已经封堵。

## 9. 审计 attribution 与模板保护

### 9.1 审计当前事实

当前：

- Schema 已有可空 `audit_events.institution_id` 与可空 `institution_attribution`；
- `TenantAuditEvent`、`createAuditEvent` 没有这两个字段，见 `src/modules/audit/domain/audit-events.ts:205-255`；
- `mapAuditEventToInsert` 不写这两个字段；
- `AuditEventQueryScope.kind = institution` 当前实际只加 tenant 条件，见 `src/modules/audit/server/audit-event-repository.ts:72-88`；
- DTO 不输出 institution attribution；
- 机构审计 Route 固定 503，见 `src/app/api/institution/audit-events/route.ts`；
- 登录、控制平面、知识管理、HIS、随访、WeCom 等审计调用面仍依赖旧事件形状。

静态检索得到 35 个生产 audit surface 文件，分布在：

- `src/modules/audit/domain/audit-events.ts` 与 `src/modules/audit/server/audit-event-repository.ts`；
- `src/app/api/auth/login/route.ts`；
- Open Platform 的 audit、AI model config、knowledge directory、trial reset Route；
- `src/modules/institution/server` 下的 follow-up、HIS、trusted reachout、WeCom mapping/controlled reachout/dry-run/real-send 服务与事务；
- `src/modules/open-platform/server` 下的 knowledge、AI config、tenant account/plan/trial reset 服务。

该 35 文件口径是：在生产 `.ts/.tsx` 中查找 `createAuditEvent`、`createDeniedAccessAuditEvent`、`createAuditEventRepository`、`mapAuditEventToInsert` 或 `TenantAuditEvent` 的精确符号，排除测试；`src/modules/open-platform/server/platformAiModelConfigPersistenceTypes.ts` 只声明类型端口，作为 type-only dependent 单列，不计入直接调用面。冻结路径为：

- App Route（9）：
  - `src/app/api/auth/login/route.ts`
  - `src/app/api/open-platform/audit-events/route.ts`
  - `src/app/api/v1/open-platform/ai-model-config/route.ts`
  - `src/app/api/v1/open-platform/ai-model-config/sync/route.ts`
  - `src/app/api/v1/open-platform/ai-model-config/test/route.ts`
  - `src/app/api/v1/open-platform/knowledge-management/directories/[directoryId]/route.ts`
  - `src/app/api/v1/open-platform/knowledge-management/directories/reorder/route.ts`
  - `src/app/api/v1/open-platform/knowledge-management/directories/route.ts`
  - `src/app/api/v1/open-platform/trial-data-reset/route.ts`
- Audit Core（2）：
  - `src/modules/audit/domain/audit-events.ts`
  - `src/modules/audit/server/audit-event-repository.ts`
- Institution 调用面（16）：
  - `src/modules/institution/server/followup-message-draft-api.ts`
  - `src/modules/institution/server/followup-message-draft-service.ts`
  - `src/modules/institution/server/his-connection-credential-service.ts`
  - `src/modules/institution/server/his-connection-status-service.ts`
  - `src/modules/institution/server/his-connection-test-connection-service.ts`
  - `src/modules/institution/server/his-connection-write-service.ts`
  - `src/modules/institution/server/tenant-business-api.ts`
  - `src/modules/institution/server/tenant-business-audit-transaction.ts`
  - `src/modules/institution/server/trusted-reachout-safety-service.ts`
  - `src/modules/institution/server/trusted-reachout-safety-transaction.ts`
  - `src/modules/institution/server/wecom-controlled-reachout-transaction.ts`
  - `src/modules/institution/server/wecom-customer-mapping-service.ts`
  - `src/modules/institution/server/wecom-customer-mapping-transaction.ts`
  - `src/modules/institution/server/wecom-dry-run-snapshot-service.ts`
  - `src/modules/institution/server/wecom-real-send-proof-repository.ts`
  - `src/modules/institution/server/wecom-real-send-proof-service.ts`
- Open Platform 调用面（8）：
  - `src/modules/open-platform/server/platform-knowledge-management-service.ts`
  - `src/modules/open-platform/server/tenant-account-management-repository.ts`
  - `src/modules/open-platform/server/tenant-account-management-service.ts`
  - `src/modules/open-platform/server/tenant-plan-binding-repository.ts`
  - `src/modules/open-platform/server/tenant-plan-binding-service.ts`
  - `src/modules/open-platform/server/tenant-plan-change-repository.ts`
  - `src/modules/open-platform/server/tenant-plan-change-service.ts`
  - `src/modules/open-platform/server/trial-data-reset-service.ts`

DTO、query/parser、Schema、Seed 和测试由其他影响面清单继续覆盖；这 35 个文件不是整个 Audit 编译闭包。

最小审计兼容 Writer 必须在 B 前覆盖该完整调用面，而不是只改中央 mapper。

### 9.2 attribution 的 `proposed` 目标 shape

固定关闭链要求完成 attribution 与 shape enforce；下表是本预检依据现有 enum、架构边界和静态影响面冻结的 `proposed` 候选，仍须由后续独立数据切片确认：

| 事件类别 | tenant | institution | attribution |
| --- | --- | --- | --- |
| 平台控制面 | 空 | 空 | `not_applicable` |
| tenant 控制面 | 非空 | 空 | `not_applicable` |
| 已验证机构数据面 | 非空 | 非空 | `verified` |
| 无法可靠归属的历史 tenant 事件 | 非空 | 空 | `legacy_unattributed` |

机构非空必须蕴含 tenant 非空，并引用有效 Scope。历史事件只能依据唯一资源对象或事务证据归属；不允许用当前账号绑定、负责人或单机构假设推断。`legacy_unattributed` 必须从机构 Reader 排除。

### 9.3 模板、默认数据和共享配置

`follow_up_message_templates` 当前允许 tenant/institution 都为空，缺少 Scope FK、来源/version 和作用域 shape 约束。`listFollowUpMessageTemplatesByTenant` 先读取全部 active 模板再内存过滤；调用方没有 institution 时不会排除机构模板，见 `tenant-business-repository.ts:1615-1630`。

模板保护必须区分：

- 平台模板；
- 同 tenant 模板；
- 同机构模板；
- 跨机构模板。

跨机构引用必须阻断。正式版本化模板模型不属于 MIG-01C；在其独立数据变更获批前，携带 `templateId` 的草稿 Writer 必须冻结，或先交付临时同 Scope fail-closed Guard。该临时保护不能被描述为正式模板所有权/version 已完成。

Operating Context 的 `product_default | institution_config` 当前只有 Schema/契约结构，没有 Provider/Reader/Writer。默认值不能作为历史归属或机构授权。

## 10. MIG-01B：确定性回填、追赶与冲突清零

### 10.1 当前状态

仓库没有 A2/B 专用数据脚本、Migration、批次表、规则版本、高水位、追赶、冲突报告或环境执行证据。MIG-01B 状态为“阻断”。

### 10.2 `proposed` 回填证据等级

以下等级是本预检冻结的 `proposed` 候选。后续 MIG-01B 必须在独立授权中确认后才能采用；在确认前不得执行回填：

| 等级 | 允许来源 | 处理 |
| --- | --- | --- |
| A | institution 已存在于获批 manifest/Scope，且记录已有非空 institution、所有可信父子事实一致 | 可回填并进入复核 |
| B | 唯一父事实已经达到 A | 可按父事实传播并记录证据链 |
| C | 锚点有效，且至少两个独立权威业务关系给出同一 institution | 可回填，但必须保留来源摘要和计数 |

以下证据禁止用于回填：当前账号绑定、负责人、tenant 单机构假设、自由文本、fixture、Seed 或 Demo。多个可信来源给出不同 institution 时，状态为“阻断”。

### 10.3 `proposed` 传播顺序

固定关闭链只规定 B 位于 Writer、审计和模板保护之后、C 之前；以下逐表传播顺序是本预检依据父子关系冻结的 `proposed` 候选：

```text
customers
→ appointments
→ treatment_summaries
→ follow_up_tasks
→ follow_up_path_enrollments
→ follow_up_path_stages
→ follow_up_message_drafts
→ follow_up_customer_timeline_events
→ 可唯一归属的 audit_events
```

不得越过父事实。模板只做作用域冲突预检，不在 B 中假装完成正式版本化。

### 10.4 稳定排序与批次

未来实现必须先冻结每表的确定性排序和游标：

- 不使用无序扫描或 offset 作为恢复点；
- 以明确、稳定的 tenant + 主键序列扫描；若需要增量追赶，必须先证明用于高水位的时间/version 字段具有足够单调性；
- UUID/string 主键的“最大值”不能自动当作创建时间高水位；
- 某表没有安全高水位时，必须使用受控写入栅栏/静默窗口，不能发明默认游标；
- 每个批次记录规则版本、批次引用、处理数、已解析数、未解析数、冲突数和低敏摘要。

### 10.5 行数守恒、追赶与清零

每表必须满足：

```text
total = resolved + unresolved + conflict
```

回填不得插入、删除或覆盖已有非空且已验证的 institution。前后总行数、父子一致性、孤儿数和 institution 分布必须守恒。

双写上线时记录启动高水位；主批结束后持续追赶新增/更新记录；进入 C 前执行最终追赶。任何新空值、未知 Writer、冲突非零、来源不唯一或追赶持续漂移都阻断 C。

Audit 分类：

- 唯一可归属机构事件写 `verified`；
- 合法平台/tenant 事件写 `not_applicable`；
- 不可归属的历史 tenant 事件写 `legacy_unattributed`；
- 多候选或非法 shape 保持“阻断”，不能用 `legacy_unattributed` 掩盖冲突。

### 10.6 停止、回退和前向修复

- A2、Writer、审计或模板门未完成时不得启动 B；
- 备份/恢复点、实际 journal、只读预检或升级窗口未知时停止；
- 已有 institution 与权威父事实冲突时停止；
- 回填失败时关闭 Capability、保持双写、停止新批次并保留证据；
- 不清空已验证 institution，不用默认机构“回滚”；
- 可逆更新必须绑定批次与旧值摘要；存在后续写入时优先用新批次前向纠正；
- Reader 在冲突清零前继续关闭。

## 11. MIG-01C：非空、外键、attribution 与 shape enforce

### 11.1 当前缺口

当前业务 institution 列仍可空；大量唯一键、FK、索引和查询仍只含 tenant；audit attribution 仍可空且没有 shape CHECK。仓库没有 C Migration 或约束验证证据。

### 11.2 C 的 `proposed` 目标约束

固定关闭链要求非空、外键、attribution 与 shape enforce。以下精确约束清单是本预检候选，必须在后续 MIG-01C 独立授权中结合实际数据、锁影响与数据库证据确认：

1. `auth_account_institution_bindings` 到 Scope 的复合 FK；
2. customers、appointments、treatment summaries、follow-up tasks 及机构专属子事实的 `institution_id NOT NULL`；
3. 业务稳定 ID/唯一键以 `tenant_id + institution_id` 开头；
4. customer、appointment、summary、task、enrollment、stage、draft、timeline 的父子复合 FK；
5. 所有机构索引以 `tenant_id, institution_id` 开头；
6. `audit_events.institution_attribution NOT NULL`；
7. 平台、tenant、机构、legacy audit 的 shape CHECK；
8. 非空 audit institution 到 Scope 的复合 FK；
9. 草稿→模板跨机构冲突为 0，但不宣称模板正式版本化已经完成。

### 11.3 建议升级顺序

1. 固定兼容应用版本和写入栅栏；
2. 重跑 B 的最终追赶、行数守恒、孤儿、冲突与 attribution 检查；
3. 创建或确认复合唯一目标；
4. 添加/验证 `NOT VALID` 复合 FK 与 shape CHECK；
5. 验证 FK 和索引；
6. 收紧业务 institution 与 audit attribution 非空；
7. 复核 tenant-only 兼容路径；删除或收紧必须另行审批；
8. 完成同 tenant 双机构、跨机构拒绝、并发、幂等、升级和回退演练。

任一约束验证失败、锁影响超阈值、冲突非零、新空值出现、旧实例混跑或回退版本会写 tenant-only 时立即停止。

### 11.4 Reader 放行条件

Reader 只有同时满足以下条件才能独立申请放行：

- MIG-01C 的环境证据已确认；
- BASE-02 每次请求重新验证正式 session、membership、anchor、revision；
- 查询按双键过滤并验证父子/对象归属；
- 不存在 tenant-only、默认机构、Mock/Seed/Demo fallback；
- Route、Application Service、Repository、DTO、Audit 和 Capability 测试完成；
- 发布、监控、停止和回退证据独立批准。

任何 Reader 放行仍是单独任务，不能由本文、MIG-01C 合并或测试存在自动触发。

## 12. 完整静态影响面

本基线的冻结计数为：

- 14 张关闭链表，其中 7 张被 0038 直接触及；
- 11 个 Writer／脚本文件，47 个生产 Drizzle mutation 静态位置，另有 16 个 Demo helper 插入／清理调用；
- 9 个直接 Reader 文件，78 个 `.from(受影响表)` 静态位置；
- 9 个 Repository／factory、3 个直接 DB Service、2 个 Seed／脚本，共 14 个直接数据边界文件；
- 完整 14 表有 13 个静态调用边 API Route、2 个 SSR 入口、33 个 MIG-01C 后候选机构 Route；A1 七表子集为其中 12 个 Route；
- 35 个直接 Audit contract／调用面文件，另有 1 个 type-only dependent；
- A1 七表有 65 个直接静态受影响测试；完整 14 表有 70 个；对应直接导入 Schema 表符号的测试分别为 14／15 个，另有 1 个原生 Demo Writer 测试。

这些数字均为 `1d2691a60fd021af815a7449af8c5c1b33d8d274` 上的静态文本/AST 结果，不代表运行时调用频率、部署实例或环境数据量；后续切片必须在当时最新 `main` 重算。

### 12.1 表与事实所有者

MIG-01 完整关闭链涉及 14 张表；其中 7 张由 0038 直接触及，另外 7 张属于锚点、父子归属、模板或历史事实关闭面。下表状态评价 MIG-01 完整关闭，不等同于第 5.1 节对 A1 结构的评价。`current` 物理持有者不等于 `target` 事实所有者；消费者不得因此复制 Repository。

| 表 | 当前路径 | `current` 物理持有者 | `target` 唯一事实所有者 | 主要消费者 | 当前关键事实与状态 |
| --- | --- | --- | --- | --- | --- |
| `institution_scopes` | `src/server/db/schema.ts:380-414` | 共享 Schema；Reader 在 `security` | 待确认：A2 必须冻结 Tenancy 持久化与 Access Control 授权消费的边界 | Access Control Guard | A1 结构和 Reader 存在，无 provisioning Writer；部分具备 |
| `institution_operating_context_versions` | `src/server/db/schema.ts:416-459` | 共享 Schema；无生产 Repository | `proposed`：Tenancy；A2 授权前确认 | 应用运行上下文 Provider | A1 结构存在，无生产读写；部分具备 |
| `institution_operating_contexts` | `src/server/db/schema.ts:461-499` | 共享 Schema；无生产 Repository | `proposed`：Tenancy；A2 授权前确认 | 应用运行上下文 Provider | A1 head 结构存在，无 Provider/读写；部分具备 |
| `auth_account_institution_bindings` | `src/server/db/schema.ts:911-955` | `auth` Repository 只读 | Access Control；与 Identity 的持久化分界需在 BASE-02 再确认 | Identity/session 与 Guard | 双键、状态/version 和 member FK 存在，无 Scope FK/正式 Writer；部分具备 |
| `customers` | `src/server/db/schema.ts:1738-1771` | 旧 `institution` Repository | Customers | Care、Workbench | institution 可空；既有复合 unique，但保留 tenant-only unique；部分具备 |
| `appointments` | `src/server/db/schema.ts:2450-2475` | 旧 `institution` Repository | Care | Customers、Workbench | institution 可空；Writer/模型不连续携带；阻断 |
| `treatment_summaries` | `src/server/db/schema.ts:2478-2536` | 旧 `institution` Repository | Care | Customers、Workbench | institution 可空；父子 FK tenant-only；阻断 |
| `follow_up_tasks` | `src/server/db/schema.ts:2538-2585` | 旧 `institution` Repository | Care | Customers、Messaging、Workbench | institution 可空；父子 FK tenant-only；阻断 |
| `follow_up_path_enrollments` | `src/server/db/schema.ts:2587-2652` | 旧 `institution` Repository | Care | Customers、Workbench | institution 可空；活动唯一键/父子 FK 不完整；阻断 |
| `follow_up_path_stages` | `src/server/db/schema.ts:2654-2704` | 旧 `institution` Repository | Care | Workbench | institution 可空；enrollment/task FK tenant-only；阻断 |
| `follow_up_message_templates` | `src/server/db/schema.ts:2706-2742` | 旧 `institution` Repository | 待确认：Care／Messaging 模板边界；Messaging 仅为 `proposed` 候选 | Care、Messaging | tenant/institution 可空；正式版本化模型仍待独立数据申请；阻断 |
| `follow_up_message_drafts` | `src/server/db/schema.ts:2744-2822` | 旧 `institution` Repository | Messaging | Care、Audit、渠道 Adapter | institution 可空；多数关系仍 tenant-only；template FK 只含 id；阻断 |
| `follow_up_customer_timeline_events` | `src/server/db/schema.ts:2824-2875` | 旧 `institution` Repository | Care | Customers、Workbench、Messaging | institution 可空；父子和幂等键未完整机构化；阻断 |
| `audit_events` | `src/server/db/schema.ts:2877-2908` | `audit` Repository 与多个旧 mapper | Audit | 所有业务 Owner 与控制平面 | institution/attribution 可空；领域与 mapper 未接入；阻断 |

支持性父事实包括 `tenants`、`tenant_members`、`auth_users`。它们是验证来源，不是本轮建议新增的 MIG-01 目标表。

### 12.2 Reader 与 Repository

完整 14 表静态扫描得到 9 个直接 Reader 文件、78 个 `.from(受影响表)` 位置：

| Reader／Repository | 当前读取 | 关键结论 | 状态 |
| --- | --- | --- | --- |
| `src/modules/security/server/institution-anchor-repository.ts` | Scope | 正确按双键读取并限制两行 | 已具备 |
| `src/modules/auth/server/auth-account-repository.ts` | account/member/binding | 正式 membership 与 binding 双键校验存在 | 部分具备 |
| `src/modules/institution/server/tenant-business-repository.ts` | 9 类业务/消息事实 | 既有双键方法与大量 tenant-only/可选 institution 方法并存 | 阻断 |
| `src/modules/institution/server/treatment-summary-repository.ts` | appointment/summary/customer | 一个机构方法通过 customer join 间接过滤；其他多为 tenant-only | 阻断 |
| `src/modules/audit/server/audit-event-repository.ts` | audit/customer/draft | institution query 实际只按 tenant；attribution 不输出 | 阻断 |
| `src/modules/institution/server/tenant-quota-enforcement.ts` | customer/appointment | 计数只按 tenant | 阻断 |
| `src/modules/institution/server/trial-provisioning-service.ts` | customer | 已存在判断只按 tenant | 阻断 |
| `src/modules/institution/server/wecom-real-send-proof-repository.ts` | draft | 局部严格双键读取；仍依赖未 enforce 草稿事实 | 部分具备 |
| `src/modules/open-platform/server/trial-data-reset-service.ts` | customer/appointment/summary/task/audit | 平台维护按 tenant 聚合和删除 | 部分具备 |

没有 Operating Context Reader。预约、随访和摘要的部分“机构级”读取依赖 customer join，而不读取或核验事实表自身 `institution_id`；这不能替代 C 的复合归属。

Repository/DB 边界的完整文件集合为：

- 9 个 Repository／Repository factory 文件：anchor、auth、tenant business、treatment summary、audit event、WeCom proof，以及 `tenant-plan-binding-repository.ts`、`tenant-plan-change-repository.ts`、`tenant-account-management-repository.ts`；
- 3 个其他直接 DB Service：Tenant Quota Enforcement、Trial Provisioning、Trial Reset；
- 2 个 Seed/脚本：`src/server/db/seed-demo-data.ts`、`scripts/demo/seed-v06-low-sensitive-demo.ts`。

“共享 Migration”不等于共享 Repository。未来实现仍按 Tenancy、Identity/Access Control、Customers、Care/Messaging 与 Audit 的事实所有权拆分。

### 12.3 Route 与 SSR

完整 14 表当前有静态调用边的 API Route 为 13 个：

1. `src/app/api/auth/login/route.ts`
2. `src/app/api/auth/session/route.ts`
3. `src/app/api/open-platform/audit-events/route.ts`
4. `src/app/api/v1/open-platform/ai-model-config/route.ts`
5. `src/app/api/v1/open-platform/ai-model-config/sync/route.ts`
6. `src/app/api/v1/open-platform/ai-model-config/test/route.ts`
7. `src/app/api/v1/open-platform/knowledge-management/directories/route.ts`
8. `src/app/api/v1/open-platform/knowledge-management/directories/[directoryId]/route.ts`
9. `src/app/api/v1/open-platform/knowledge-management/directories/reorder/route.ts`
10. `src/app/api/v1/open-platform/tenants/route.ts`
11. `src/app/api/v1/open-platform/tenants/[tenantId]/account/route.ts`
12. `src/app/api/v1/open-platform/tenants/[tenantId]/plan-change/route.ts`
13. `src/app/api/v1/open-platform/trial-data-reset/route.ts`

其中 A1 七表的静态调用边为 12 个，不含只通过 `auth_account_institution_bindings` 进入完整 14 表范围的 `auth/session`。多数影响来自 audit Writer；Trial Reset 直接读取/删除四类业务事实。两个 SSR 入口使用正式 Scope Reader：

- `src/app/hospital/page.tsx`
- `src/app/hospital/[...slug]/page.tsx`

另有 33 个机构业务 API Route 属于 MIG-01C 后的 Reader/Writer 重新核验候选，当前均为 capability-off 或 410，并没有 Repository/DB 静态调用边：

| Route 组 | 数量 | 当前状态 |
| --- | ---: | --- |
| customers 根、import、timeline、follow-up、treatment、reachout safety | 8 | 阻断 |
| appointments | 1 | 阻断 |
| treatment summaries 根、详情、void、suggestion、task | 5 | 阻断 |
| followups | 1 | 阻断 |
| follow-up path enrollment/template | 4 | 阻断 |
| follow-up message draft/template | 8 | 阻断 |
| follow-up operations | 1 | 阻断 |
| institution audit | 1 | 阻断 |
| entitlement usage | 1 | 阻断 |
| legacy dashboard/opportunity/path analysis | 3 | 阻断 |

33 个候选 Route 的冻结路径为：

- Customers（8）：
  - `src/app/api/institution/customers/route.ts`
  - `src/app/api/institution/customers/import/route.ts`
  - `src/app/api/institution/customers/[customerId]/timeline/route.ts`
  - `src/app/api/institution/customers/[customerId]/followup-feedback/route.ts`
  - `src/app/api/institution/customers/[customerId]/followup-overview/route.ts`
  - `src/app/api/institution/customers/[customerId]/followup-timeline/route.ts`
  - `src/app/api/institution/customers/[customerId]/treatment-summaries/route.ts`
  - `src/app/api/institution/customers/[customerId]/wecom-reachout-safety/route.ts`
- Appointments（1）：`src/app/api/institution/appointments/route.ts`
- Treatment Summaries（5）：
  - `src/app/api/institution/treatment-summaries/route.ts`
  - `src/app/api/institution/treatment-summaries/[summaryId]/route.ts`
  - `src/app/api/institution/treatment-summaries/[summaryId]/void/route.ts`
  - `src/app/api/institution/treatment-summaries/[summaryId]/follow-up-suggestions/route.ts`
  - `src/app/api/institution/treatment-summaries/[summaryId]/follow-up-tasks/route.ts`
- Followups（1）：`src/app/api/institution/followups/route.ts`
- Follow-up Path（4）：
  - `src/app/api/institution/followup-paths/enrollments/route.ts`
  - `src/app/api/institution/followup-paths/enrollments/[enrollmentId]/route.ts`
  - `src/app/api/institution/followup-paths/enrollments/[enrollmentId]/cancel/route.ts`
  - `src/app/api/institution/followup-paths/templates/route.ts`
- Follow-up Message Draft／Template（8）：
  - `src/app/api/institution/followup-message-drafts/route.ts`
  - `src/app/api/institution/followup-message-drafts/[draftId]/route.ts`
  - `src/app/api/institution/followup-message-drafts/[draftId]/approve/route.ts`
  - `src/app/api/institution/followup-message-drafts/[draftId]/reject/route.ts`
  - `src/app/api/institution/followup-message-drafts/[draftId]/mark-sent/route.ts`
  - `src/app/api/institution/followup-message-drafts/[draftId]/wecom-controlled-reachout/route.ts`
  - `src/app/api/institution/followup-message-drafts/[draftId]/wecom-customer-broadcast-task/route.ts`
  - `src/app/api/institution/followup-message-templates/route.ts`
- Operations（1）：`src/app/api/institution/followup-operations/dashboard/route.ts`
- Audit（1）：`src/app/api/institution/audit-events/route.ts`
- Entitlement（1）：`src/app/api/institution/entitlement-usage/route.ts`
- Legacy（3）：
  - `src/app/api/institution/dashboard-stats/route.ts`
  - `src/app/api/institution/opportunities/route.ts`
  - `src/app/api/institution/follow-up-path-analysis/route.ts`

代码存在、Route 存在或 capability-off 测试通过都不代表 Reader 已发布。

### 12.4 脚本、Import、Seed 与 fixture

| 类型 | 当前路径 | 结论 | 状态 |
| --- | --- | --- | --- |
| Migration runner | `scripts/db/guarded-migrate.mjs` | 校验 journal/SQL、环境目标与人工批准；本轮未执行 | 部分具备 |
| A2/B 专用脚本 | 无 | 没有 provision/backfill/catch-up/conflict 工具 | 缺失 |
| 通用 Demo Seed | `src/server/db/seed-demo-data.ts` | 只给 customer 连续写 institution；其他目标事实遗漏 | 阻断 |
| V0.6 Demo Seed | `scripts/demo/seed-v06-low-sensitive-demo.ts` | helper 直接写表；部分事实遗漏 institution | 阻断 |
| Customer Import | `src/app/api/institution/customers/import/route.ts` | 当前 capability-off；未形成正式双键 Import | 阻断 |
| 独立 fixture 文件 | 无 | fixture 内嵌测试；未来测试 fixture 仍须纳入双写清单 | 待确认 |
| 仓库外任务/导入 | 仓库不可见 | 不能证明不存在 | 待确认 |

### 12.5 测试影响面

对 A1 7 表及其 Repository/Service/Route 的静态闭包：

- 32 个生产 Reader 方法/函数入口；
- 38 个直接读取位置；
- 20 个生产 Writer/Mutation 方法入口；
- 35 个变更位置；
- 14 个直接引用 A1 表符号的测试；
- 65 个直接静态受影响测试。

14 个直接测试为：

- `src/server/db/tests/Schema.test.ts`
- `src/modules/security/tests/InstitutionAnchorRepository.test.ts`
- `src/modules/audit/tests/AuditEventRepository.test.ts`
- `src/modules/institution/tests/TenantBusinessRepository.test.ts`
- `src/modules/institution/tests/TreatmentSummaryRepository.test.ts`
- `src/modules/institution/tests/TenantQuotaEnforcement.test.ts`
- `src/modules/institution/tests/FollowUpOperationsDashboardRepository.test.ts`
- `src/modules/institution/tests/HisConnectionRepository.test.ts`
- `src/modules/institution/tests/HisConnectionCredentialCompensationJobQueueRepository.test.ts`
- `src/modules/institution/tests/HisConnectionCredentialCompensationOperationRepository.test.ts`
- `src/modules/institution/tests/WeComControlledReachOutRepository.test.ts`
- `src/modules/open-platform/tests/TenantPlanBindingRepository.test.ts`
- `src/modules/open-platform/tests/TenantPlanChangeRepository.test.ts`
- `src/modules/open-platform/tests/TenantAccountManagementRepository.test.ts`

按 TypeScript AST 的 import 语义复核，A1 七表有上述 14 个直接 Schema 表符号测试；完整 14 表再加 `src/modules/auth/tests/AuthAccountRepository.test.ts`，合计 15 个。再计入直接测试原生 SQL helper 的 `scripts/demo/seed-v06-low-sensitive-demo.test.ts`，对应直接实现测试分别为 15／16 个。此前无单词边界的子串扫描会把 `quota_exceeded_appointments`、`followUpTasksPost`、`treatmentSummariesResponse`、`auditEventsResponse` 等普通标识符计为命中，不能作为“直接表符号引用”口径。

A1 七表的 65 个直接静态受影响测试，复核口径为：使用 TypeScript AST 解析本地 `import`、`export ... from`、动态 `import()` 和 `vi.mock/jest.mock`，选择直接指向 13 个触及 A1 表的代码／Seed／脚本文件、12 个有静态调用边的 API Route 或 2 个 SSR 入口的测试，再与 14 个直接导入 A1 Schema 表符号的测试取并集。它不是完整递归传递闭包。冻结路径如下：

- `scripts/demo`（1）：
  - `scripts/demo/seed-v06-low-sensitive-demo.test.ts`
- `src/modules/audit/tests`（3）：
  - `src/modules/audit/tests/AuditEventRepository.test.ts`
  - `src/modules/audit/tests/InstitutionAuditEventsApiRoute.test.ts`
  - `src/modules/audit/tests/OpenPlatformAuditEventsApiRoute.test.ts`
- `src/modules/auth/tests`（2）：
  - `src/modules/auth/tests/DemoAuthRoutes.test.ts`
  - `src/modules/auth/tests/FormalAuthRoutes.test.ts`
- `src/modules/institution-workbench/tests`（1）：
  - `src/modules/institution-workbench/tests/HospitalWorkbenchEntry.test.tsx`
- `src/modules/institution/tests`（40）：
  - `src/modules/institution/tests/CustomerFollowUpFeedbackApiRoute.test.ts`
  - `src/modules/institution/tests/CustomerFollowUpOverviewApiRoute.test.ts`
  - `src/modules/institution/tests/CustomerFollowUpTimelineApiRoute.test.ts`
  - `src/modules/institution/tests/CustomerImportApiRoute.test.ts`
  - `src/modules/institution/tests/CustomerTimelineApiRoutes.test.ts`
  - `src/modules/institution/tests/DashboardStatsLegacyApiRoute.test.ts`
  - `src/modules/institution/tests/FollowUpMessageDraftApiRoutes.test.ts`
  - `src/modules/institution/tests/FollowUpOperationsDashboardApiRoutes.test.ts`
  - `src/modules/institution/tests/FollowUpOperationsDashboardRepository.test.ts`
  - `src/modules/institution/tests/FollowUpPathAnalysisApiRoutes.test.ts`
  - `src/modules/institution/tests/FollowUpPathEnrollmentApiRoutes.test.ts`
  - `src/modules/institution/tests/HisConnectionApiRoutes.test.ts`
  - `src/modules/institution/tests/HisConnectionCredentialApiRoutes.test.ts`
  - `src/modules/institution/tests/HisConnectionCredentialCompensationJobQueueRepository.test.ts`
  - `src/modules/institution/tests/HisConnectionCredentialCompensationOperationRepository.test.ts`
  - `src/modules/institution/tests/HisConnectionRepository.test.ts`
  - `src/modules/institution/tests/HisConnectionTestConnectionApiRoute.test.ts`
  - `src/modules/institution/tests/InstitutionConversationCapabilityOffRoute.test.tsx`
  - `src/modules/institution/tests/InstitutionKnowledgeAnswerApiRoute.test.ts`
  - `src/modules/institution/tests/InstitutionKnowledgeUploadService.test.ts`
  - `src/modules/institution/tests/InstitutionRouteShell.test.tsx`
  - `src/modules/institution/tests/InstitutionServerRuntime.test.ts`
  - `src/modules/institution/tests/OpportunityPoolLegacyApiRoute.test.ts`
  - `src/modules/institution/tests/RealChannelPreflightApiRoute.test.ts`
  - `src/modules/institution/tests/TenantBusinessApiRoutes.test.ts`
  - `src/modules/institution/tests/TenantBusinessRepository.test.ts`
  - `src/modules/institution/tests/TenantQuotaEnforcement.test.ts`
  - `src/modules/institution/tests/TreatmentFollowUpLinkApiRoutes.test.ts`
  - `src/modules/institution/tests/TreatmentFollowUpSuggestionsApiRoute.test.ts`
  - `src/modules/institution/tests/TreatmentSummaryApiRoutes.test.ts`
  - `src/modules/institution/tests/TreatmentSummaryCreateApiRoute.test.ts`
  - `src/modules/institution/tests/TreatmentSummaryListApiRoutes.test.ts`
  - `src/modules/institution/tests/TreatmentSummaryRepository.test.ts`
  - `src/modules/institution/tests/TrustedReachOutSafetyTransaction.test.ts`
  - `src/modules/institution/tests/WeComControlledReachOutApiRoute.test.ts`
  - `src/modules/institution/tests/WeComControlledReachOutRepository.test.ts`
  - `src/modules/institution/tests/WeComOfficialDryRunApiRoute.test.ts`
  - `src/modules/institution/tests/WeComRealSendExecutionShellService.test.ts`
  - `src/modules/institution/tests/WeComRealSendProofRepository.test.ts`
  - `src/modules/institution/tests/WeComRealSendProofService.test.ts`
- `src/modules/open-platform/tests`（10）：
  - `src/modules/open-platform/tests/OpenPlatformAiModelConfigPersistence.test.ts`
  - `src/modules/open-platform/tests/OpenPlatformAiModelVendorOperations.test.ts`
  - `src/modules/open-platform/tests/PlatformKnowledgeDirectoryManagementApiRoute.test.ts`
  - `src/modules/open-platform/tests/TenantAccountManagementApiRoute.test.ts`
  - `src/modules/open-platform/tests/TenantAccountManagementRepository.test.ts`
  - `src/modules/open-platform/tests/TenantPlanBindingApiRoute.test.ts`
  - `src/modules/open-platform/tests/TenantPlanBindingRepository.test.ts`
  - `src/modules/open-platform/tests/TenantPlanChangeApiRoute.test.ts`
  - `src/modules/open-platform/tests/TenantPlanChangeRepository.test.ts`
  - `src/modules/open-platform/tests/TrialDataResetService.test.ts`
- `src/modules/security/tests`（4）：
  - `src/modules/security/tests/InstitutionAnchorProvider.test.ts`
  - `src/modules/security/tests/InstitutionAnchorRepository.test.ts`
  - `src/modules/security/tests/InstitutionRequestAuthorization.test.ts`
  - `src/modules/security/tests/SafetySwitchApiRoute.test.ts`
- `src/modules/workspace/tests`（1）：
  - `src/modules/workspace/tests/WorkspaceEntryPages.test.tsx`
- `src/server/db/tests`（3）：
  - `src/server/db/tests/ProductionReadinessDocs.test.ts`
  - `src/server/db/tests/Schema.test.ts`
  - `src/server/db/tests/SeedGuard.test.ts`

完整 14 表的直接静态受影响测试为上述 65 个，再加以下 5 个，合计 70 个：

- `src/modules/auth/tests/AuthAccountRepository.test.ts`
- `src/modules/auth/tests/FormalServerSessionProvenanceOwner.test.ts`
- `src/modules/security/tests/InstitutionMembershipProvider.test.ts`
- `src/modules/security/tests/InstitutionScopeGuard.test.ts`
- `src/modules/security/tests/InstitutionSectionGuard.test.ts`

正式双键 Guard 还需覆盖以下关键测试族：

- `src/modules/auth/tests/FormalServerSessionProvenanceOwner.test.ts`
- `src/modules/auth/tests/FormalAuthRoutes.test.ts`
- `src/modules/security/tests/FormalRequestProvenanceOwner.test.ts`
- `src/modules/security/tests/InstitutionAnchorProvider.test.ts`
- `src/modules/security/tests/InstitutionMembershipProvider.test.ts`
- `src/modules/security/tests/InstitutionGuardReference.test.ts`
- `src/modules/security/tests/InstitutionGuardReferenceBoundary.test.ts`
- `src/modules/security/tests/InstitutionGuardRuntimeConfig.test.ts`
- `src/modules/security/tests/InstitutionScopeGuard.test.ts`
- `src/modules/security/tests/InstitutionSectionGuard.test.ts`
- `src/modules/security/tests/InstitutionRequestAuthorization.test.ts`
- `src/modules/institution/tests/InstitutionServerRuntime.test.ts`

现有测试只证明 A1 nullable Expand、部分正式 Scope/Guard 与部分 customer-join 隔离。没有测试证明全部 Writer 连续写 institution、audit Writer 连续写 attribution、A2/B/C 或环境升级已完成。本轮未运行任何测试。

## 13. Migration 元数据与历史漂移

### 13.1 可验证事实

- 基线结论：journal 到 0038，snapshot 到 0026；
- `drizzle/meta/_journal.json` 有 39 个 entry，最新 idx 为 `38`；
- 最新 journal tag 为 `0038_mig_01a1_institution_isolation_expand`；
- snapshot 文件共 15 个，最新为 `drizzle/meta/0026_snapshot.json`；
- 0026 snapshot 不包含 A1 的 4 个 enum、3 张新表或 5 个新增字段；
- `docs/operations/drizzle-migration-snapshot-strategy.md` 仍写 journal 到 0035；
- `src/server/db/tests/ProductionReadinessDocs.test.ts` 仍锁定旧 0034/0035 与“不新增 0036”的历史口径；
- `docs/operations/production-migration-runbook.md` 要求 journal、pending SQL 和批准目标精确一致，并说明生产 migrate 不使用 snapshot。

这些证据可以同时成立：journal/手写 SQL 已到 0038，而 snapshot、旧运维说明和旧文档测试仍停在更早基线。

### 13.2 阻断判断

| 事项 | 状态 | 判断 |
| --- | --- | --- |
| 把 0026 snapshot 当作当前 0038 元数据 | 阻断 | snapshot 缺少 A1 |
| 运行 `db:generate` 或基于 snapshot diff 生成生产 Migration | 阻断 | 会把历史漂移混入新变更 |
| A1 的仓库静态 Expand 事实 | 已具备 | 0038、Schema、journal 和核心测试一致，snapshot 漂移不推翻该结论 |
| 所有手写 V2 Migration 一律被 snapshot 漂移自动阻断 | 待确认 | 当前已接受文档尚未批准这一扩大解释 |
| A2/B/C 的实际实施 | 待确认 | 每个切片必须显式确认 metadata 漂移处理与唯一 Migration lease；手写 Migration 是否因此阻断仍待独立决策 |
| 各环境真实 Migration 状态 | 待确认 | 统一标记“待核验”，本文未连接环境 |

因此后续第一个数据切片必须明确：snapshot 如何校准、是否成为所有 V2 Migration 的硬门、旧文档测试如何更新，以及唯一 Migration 队列 lease。不能静默绕过，也不能把旧 snapshot 当成生产数据库事实。

## 14. MIG-01 内部候选实施队列

- 本节仅冻结 MIG-01 内部 A2 至 Reader 的串行关系；
- 本节不是 PR #789 合并后的项目级 `NEXT_TASK`；
- 所有切片都必须等待项目级前置任务和独立 handoff 完成；
- 任一候选切片只有获得用户对当次任务、文件、环境和风险的明确授权后才能启动。

所有切片都必须基于当时最新 `main` 重新审计，独立分支、独立授权、独立 PR。下面冻结七段串行门禁及段内候选小 PR；通配目录只描述静态影响面，不构成整目录修改许可。每个 Runtime PR 原则上只触及 3–5 个核心文件及对应测试，必须在启动时重新冻结精确路径。每个段内小 PR 都继承所在节的依赖、允许文件类型、必测项、停止条件、回退／前向修复和所需授权，并且只有前一小 PR 的完成证据已合并才能启动。Schema、Migration、公共契约、`src/app/**` 和配置共享路径始终串行。`src/modules/institution/**` 只允许旧聚合模块的薄兼容、双写或封堵，不得在其中新增长期事实所有权、Repository 或 Provider。

每个候选 PR 的静态完成证据至少包括：精确 diff、依赖/符号扫描、对应单元与契约测试、无范围外文件、无旧路径绕过；需要 Schema、数据或发布环境的 A2/B/C/Reader PR 还必须在另行环境授权下提供 journal、计数、冲突、约束或发布证据。环境证据缺失时状态保持“待确认”，不得以代码合并替代完成，也不得启动下一门。

### 14.1 切片 1：MIG-01A2

- 依赖：A1 环境状态、journal、备份/恢复点和 metadata 漂移处理已确认；manifest 已批准；无并发 Migration。
- 允许文件类型：唯一编号的 Migration SQL、journal/必要 metadata、Schema/Schema 测试、低敏 manifest 校验或迁移验证资产；具体文件必须在授权中逐项列出。
- `proposed` 段内顺序：
  1. A2-P1：只做 manifest 驱动的 Scope/version/head 单事务 provisioning 与计数证据；
  2. A2-P2：P1 提交并核验后，用独立授权/PR 创建获批复合键、索引和 `NOT VALID` 锚点／业务关系；只创建不验证，业务 FK 不得混入 P1。
- 必测：空库/已有一致行、重复执行、digest/source/status/revision 冲突、计数、事务回滚、FK target、无默认 institution。
- 停止：manifest 或环境不明；既有行不一致；revision 非 1；计数不守恒；部分应用不可解释。
- 回退/前向修复：提交前只允许事务整体回滚；提交后无论是否已有消费者，都不得删除、覆盖或重绑 Scope/Context，必须 suspend、提高 revision，并追加可追溯的前向纠正证据。
- 所需授权：Schema/Migration/数据与环境执行分别明确授权；唯一 Migration lease；不包含真实 secret。

### 14.2 切片 2：BASE-02B／BASE-02

- 依赖：A2 锚点、binding→anchor 关系和正式配置边界可验证。
- 允许文件类型：Auth 的正式 session/binding、Security 的 membership/anchor/reference/Guard、服务端 composition root、单个入口与对应测试；任何新 Schema/Migration 另行授权，不能把目录名当作许可。
- `proposed` 段内顺序：
  1. BASE-P1：`institution-anchor-repository.ts`、`institution-anchor-provider.ts` 及两者测试；Runtime 只消费并核验 A2-P2 已创建的关系，关闭 Scope status/revision CAS 与失效生命周期，不创建或修改 DDL；
  2. BASE-P2A：`auth-account-repository.ts`、`institution-membership-provider.ts` 及对应测试；关闭 binding、fresh membership 与 anchor 的一致性；
  3. BASE-P2B：`formal-server-session-provenance-owner.ts`、`institution-guard-evidence.ts`、`institution-guard-reference.ts` 及对应测试；关闭 current context 与 opaque anchor revision；
  4. BASE-P3：`institution-scope-guard.ts`、`institution-section-guard.ts`、`institution-request-authorization.ts`、`institution-server-runtime.ts` 及对应测试；完成 fail-closed composition，不顺带开放业务 Route。
- 必测：正式 session、provenance、fresh membership、anchor、所有 revision、TTL、cross-scope、stale context、key/config unavailable、Route/Object/Action fail-closed。
- 停止：接受 demo/client institution；无法重验 membership/anchor；对象 owner 与 Scope 不一致；配置不可用时降级 tenant-only。
- 回退/前向修复：回到 capability-off/deny；通过新 revision 和修复后的 Provider 前向恢复，不恢复 raw ID、旧 `arv` 或 tenant-only。
- 所需授权：Runtime、auth/security 和配置边界授权；真实 key material/环境配置单独授权。

### 14.3 切片 3：Writer 双写与旧 Writer 封堵

- 依赖：A2、BASE-02 可用；完整 Writer 清单在最新 main 重新冻结。
- 允许文件类型：第 8.1 节列出的 Repository/Service/Seed/脚本及其精确调用方和测试；不得顺带开放页面。
- `proposed` 段内小 PR 顺序；每项只允许所列核心文件和对应测试，旧 `institution` 文件仅作兼容双写/封堵：
  1. W-P1：`tenant-business-repository.ts` 中 customer 及其父子双键方法；
  2. W-P2：同一 Repository 中 follow-up path/task/stage/draft/timeline 方法；必须在 W-P1 合并后串行修改该共享文件；
  3. W-P3：`treatment-summary-repository.ts`；
  4. W-P4：`trial-provisioning-service.ts`；
  5. W-P5：`wecom-real-send-proof-repository.ts`；
  6. W-P6：`trial-data-reset-service.ts`；
  7. W-P7：`src/server/db/seed-demo-data.ts`；
  8. W-P8：`scripts/demo/seed-v06-low-sensitive-demo.ts`。
  Audit central Repository 与三个 Open Platform audit Writer 归入下一段，不在此重复修改；Customer Import 当前保持 capability-off，正式 Import 需另行 Runtime 授权。
- 必测：每表 create/update/delete、父子双键、同 tenant 双机构、并发、幂等、Seed/Import/fixture、旧版本混跑、审计事务一致性。
- 停止：任一 Writer 无法原子写双键；仍出现空/默认 institution；未知脚本/任务；旧实例未冻结。
- 回退/前向修复：双写开始前可回退应用；开始后禁止回到 tenant-only，必要时冻结写入并前向修复。
- 所需授权：逐 owner 的 Runtime 与脚本授权；精确文件清单；部署/混跑门另行授权。

### 14.4 切片 4：审计 attribution 与模板保护

- 依赖：正式 Guard/对象 owner 可提供 attribution；Writer 双写稳定。
- 允许文件类型：Audit domain/DTO/query/repository、35 个 audit surface 调用方、模板 domain/repository/草稿 Writer 与对应测试；需要约束时另立数据/Migration PR。
- `proposed` 段内顺序：
  1. AUD-P1：`audit-events.ts`、`audit-event-query.ts`、`audit-event-dto.ts`、`audit-event-repository.ts` 与对应测试，新增 strict scoped API 和显式、可递减的 legacy caller allowlist；未知 caller、错误 shape 或机构调用缺少 institution 必须拒绝，禁止静默 optional fallback；
  2. AUD-P2A：`auth/login`、Open Platform audit 与三个 AI model config Route（第 9.1 节 App Route 前 5 项），改用 strict API 并从 allowlist 移除；
  3. AUD-P2B：三个 knowledge directory Route 与 trial reset Route（第 9.1 节 App Route 后 4 项），改用 strict API 并从 allowlist 移除；
  4. AUD-P3A：Institution 的 follow-up draft API/service、tenant business API/audit transaction；
  5. AUD-P3B：四个 HIS credential/status/test/write service；
  6. AUD-P3C：trusted reachout service/transaction、WeCom controlled-reachout transaction、customer-mapping service；
  7. AUD-P3D：WeCom customer-mapping transaction、dry-run snapshot service、real-send proof Repository/service；
  8. AUD-P4A：Open Platform knowledge service、tenant account Repository/service、tenant plan binding Repository；
  9. AUD-P4B：tenant plan binding service、tenant plan change Repository/service、trial reset service；
  10. AUD-P5：legacy allowlist 归零，删除兼容入口，机构查询按双键且 DTO 输出 attribution；任一遗留调用或空 attribution 都阻断完成。
  11. TPL-D1：先以独立决策确认模板 owner、三层作用域和版本策略。确认前默认候选 TPL-F1 是冻结携带 `templateId` 的正式 Writer；只有 owner/策略确认后，才能改选互斥的 TPL-G1 同 Scope fail-closed Guard。两者不得在同一 PR 以“冻结或 Guard”保留双目标。
- 兼容桥完成证据：全量 direct caller allowlist 可重算且只能递减；每批编译通过；旧 caller 的能力保持关闭或在错误 Scope 时拒绝；AUD-P5 后不存在 legacy 入口、新空 attribution 或 tenant-only 机构查询。若无法在 3–5 个核心文件内形成可编译、fail-closed 的桥，AUD-P1 必须停止并申请一次性编译闭包的例外授权，不能退回 optional 字段。
- 必测：平台/tenant/机构/legacy shape、机构审计 fail-closed、敏感字段排除、机构 query 隔离、模板三层作用域、跨机构引用、同 key 优先级。
- 停止：归属不能从正式 Guard/对象 owner 唯一推导；模板优先级不确定；高风险 mutation 审计失败仍继续。
- 回退/前向修复：能力保持关闭；保留历史 audit/template 引用；用 correction event、重新分类或新模板版本前向修复。
- 所需授权：Audit Runtime；模板 Runtime；若新增约束/版本模型则单独 Schema/Migration 授权。

### 14.5 切片 5：MIG-01B

- 依赖：切片 1 至 4 完成；真实行数、备份、恢复点和写入高水位可确认。
- 允许文件类型：独立回填 Migration/脚本、只读预检与验证脚本、低敏结果 schema、对应测试和运行手册；不混入 C。
- `proposed` 段内顺序：
  1. B-P0：只读预检、证据等级和冲突分类，不修改业务行；
  2. B-P1：customers；
  3. B-P2：appointments → treatment summaries → follow-up tasks；
  4. B-P3：path enrollments → path stages；
  5. B-P4：message drafts → customer timeline；
  6. B-P5：可唯一归属的 audit events 与 attribution 分类；
  7. B-P6：所有表高水位追赶、行数守恒、孤儿和冲突最终清零。
  每个 PR 都必须使用前一批已验证父事实并保留独立 checkpoint、规则版本、计数和前向纠正证据。
- 必测：A/B/C 证据等级、稳定排序、幂等、已有值冲突、父子传播、行数守恒、批次恢复、高水位追赶、audit 分类、冲突清零。
- 停止：冲突非零、来源不唯一、追赶漂移、行数不守恒、未知 Writer、环境/journal/备份不明。
- 回退/前向修复：停止批次、保持双写和 Reader 关闭；按批次证据恢复或用新批次前向纠正，不清空已验证归属。
- 所需授权：数据回填、脚本/Migration、隔离数据库与环境执行分别授权。

### 14.6 切片 6：MIG-01C

- 依赖：B 冲突清零；最终追赶稳定；所有 FK target 存在；兼容应用已部署。
- 允许文件类型：独立 Enforce Migration、Schema、journal/metadata、Schema/升级/回退测试和运行手册。
- `proposed` 段内顺序：
  1. C-P1：验证 A2-P2 已创建的复合 UNIQUE/索引/`NOT VALID` 关系，并只为获批的 C 专属 shape CHECK 做创建/验证准备；
  2. C-P2：customers 与 Care core（appointments/summaries/tasks）非空和父子约束；
  3. C-P3：Care path、Messaging draft/timeline 与模板引用的获批约束；
  4. C-P4：audit attribution、Scope FK 与 shape enforce；
  5. C-P5：全 14 表最终约束/索引复核、旧版本写入拒绝与升级证据。
  C 不重复创建 A2 关系，也不得夹带 B 数据修正。
- 必测：NOT NULL、复合 FK/UNIQUE/索引、audit shape、同租户双机构、锁影响、升级、回退、旧版本拒绝。
- 停止：任一约束验证失败；新空值；锁/窗口超阈值；回退版本会写 tenant-only。
- 回退/前向修复：只在已验证事务边界且无新写时撤销未完成约束；已生效并被消费后优先用新的前向 Migration 修复。
- 所需授权：Schema/Migration、数据库环境、升级窗口、备份/恢复与发布分别授权。

### 14.7 切片 7：Reader 重新核验与独立放行

- 依赖：MIG-01C + BASE-02 完成；每个事实 owner 和 Provider 可用。
- 允许文件类型：单一 Reader/Route/Application Service/Provider/DTO/Capability 纵向切片与对应测试；每次只放行获批业务线。
- `proposed` 段内顺序：
  1. R-P0：对第 12.3 节 13 个 current 调用 Route、2 个 SSR 与 33 个候选机构 Route 重新跑静态依赖/Guard/owner 清单；只产出放行矩阵，不开启 Capability；
  2. R-P1：MIG-01C + BASE-02 只使 Customers／System Reader 具备申请资格；每个 Reader 仍按单一 Route/Service/Repository/DTO/Guard 纵向 PR 单独授权；
  3. R-P2 以后继续服从既定门禁：Care 等待 MIG-02，Knowledge 等待 MIG-03，Conversations 等待 MIG-04，Analytics Facts 等待 MIG-05，Analytics Snapshot/五页等待 MIG-06 + AN-03C，Workbench 最后接线；
  4. 第 12.3 节 3 个 410 legacy Route 不进入放行队列；其余 capability-off Route 也不能因 MIG-01C 自动开启。
  代码 Ready、Capability/发布授权和环境发布证据分别过门，不批量放行七线。
- 必测：双键查询、对象 Guard、角色、freshness、分区、无 fallback、低敏错误、审计、Capability 开关和回退。
- 停止：tenant-only、默认机构、Mock/Seed/Demo fallback、stale/unavailable source、缺发布证据或越过后续 MIG 门禁。
- 回退/前向修复：关闭对应 Capability/Reader，恢复 capability-off；通过版本化 Provider 和查询前向修复。
- 所需授权：每个 Reader 和 Capability 的独立 Runtime/发布授权；不能一次性放行 7 条业务线。

## 15. 已确认决策、待确认事项与停止条件

### 15.1 已确认决策

- MIG-01 的顺序不变；
- A1 只是可空 Expand；
- Scope/manifest 证明机构存在，不证明成员/action 授权；
- 全部正式 Reader/Writer 必须使用服务端双键和 Guard；
- 业务归属不得用单机构、负责人、binding、fixture 或 Demo 猜测；本文提出的 A/B/C 证据等级仍是 `proposed` 候选；
- B 必须在 Writer、audit、模板门完成后执行；
- C 必须在冲突清零和最终追赶后执行；
- Reader 必须在 C + BASE-02 后独立放行；
- MIG-01 不替代 MIG-02 至 MIG-06，也不启动机构端旧任务。

### 15.2 待确认事项

- A2 manifest 的 owner、存放/传递方式、批准流程和低敏摘要格式；
- snapshot 校准是否成为所有新 V2 Migration 的统一硬门；
- 各环境真实 journal、部分应用、表/约束、数据量、空值、孤儿与冲突；
- 每表安全高水位/游标或写入栅栏方案；
- A2/B/C 的备份、恢复点、锁阈值、维护窗口和回退演练；
- 模板正式作用域/version 模型的独立数据变更 owner；
- 仓库外 Import、任务、维护脚本和旧部署实例；
- 逐 Reader 的发布、监控和 Capability 证据。

### 15.3 立即停止条件

未来任一切片出现以下情况必须停止：

- 完整表/Writer/Reader/Route/Repository 影响面在最新 main 上无法重现；
- Schema、Migration、journal、snapshot 或测试矛盾且无法解释；
- 需要未授权数据库、凭证、环境或外部系统核验；
- 出现并发 Migration、共享数据库写竞争或范围外文件；
- institution 来源不唯一、父子冲突、孤儿、行数不守恒或冲突非零；
- Writer 清单不完整、旧实例未冻结或新空值持续产生；
- Audit attribution 或模板 Scope 无法 fail-closed；
- 需要启动 V2-02C、真实 Reader、Capability、MIG-02～MIG-06 或机构端旧任务。

## 16. 预检结论

MIG-01A1 的仓库静态 Expand 证据已具备；A2 缺失；BASE-02B／BASE-02 只有正式双键授权地基；Writer 连续双写、Audit attribution、模板保护、B 回填、C Enforce 和 Reader 放行均未关闭。在 MIG-01 关闭链内部，首个候选实施单元只能是 MIG-01A2；但它不是 PR #789 合并后的自动下一任务。项目级下一任务仍须通过独立 handoff，按照当前架构索引和用户授权重新冻结。MIG-01A2 启动前仍必须先确认 manifest、环境 journal、metadata 漂移处理门禁、备份与唯一 Migration lease。

本文未实施 MIG-01，未改变任何 Runtime、Schema 或 Migration，未读取凭证，未连接环境，也未恢复任何机构端旧开发任务。
