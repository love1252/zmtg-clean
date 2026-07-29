# MIG-01A2 Owner、Manifest、输入承载、Metadata 与硬门决策包

> 任务编号：`V2-MIG01-A2-DECISION-PACK-01`
>
> 状态：`proposed decision pack`
>
> 审计基线：`5fbeffbbbb89b2d39eaf4fc40101edbfbb12ee75`
>
> 审计日期：2026-07-29
>
> 本文不是 ADR，不是 `accepted decision`，不是 Migration、仓库设置、环境或实施授权。

## 1. 文档定位、事实源与禁止范围

本文只把 MIG-01A2 P1／P2 启动前尚未关闭的决策整理为可集中选择的材料。本文提供当前事实、`target` 约束、方案、推荐、风险、对 P1／P2 的影响及未决定时的阻断；所有推荐均为 `proposed`，只有用户对具体编号和选项作出明确决定后，后续独立 handoff 才能记录为已接受。

事实源顺序为：

1. `current`：本基线 `main` 的代码、测试、Schema、Migration、配置和已合并记录；
2. `target`：`docs/architecture/architecture-v2.md` 与已接受 ADR；
3. `docs/architecture/v2-mig01-a2-provisioning-preflight.md`、其他架构视图、模块映射、索引和 handoff 只展开、核验或记录状态，不独立改写 `target`；
4. `proposed`：本文中的选项和推荐，尚未获得用户决定或实施授权。

启动时只读核对 GitHub `main` 得到：

- `protected = false`；
- Required Check 的 checks／contexts 为空；
- enforcement level 为 `off`；
- 仓库当前允许 Merge Commit、Squash Merge 和 Rebase Merge，未启用 auto-merge。

这些是 2026-07-29 的 `current` 读数，不是建议配置，也不授权本文修改仓库设置。

本基线的 A2 直接事实为：

- MIG-01A1 只具备仓库静态 Expand 证据；0038 没有 provisioning、回填或 Enforce；
- MIG-01A2 的 manifest、Writer、事务、计数和环境执行证据均缺失，当前状态为阻断；
- journal 到 0038，snapshot 到 0026，且 snapshot 不覆盖 A1；
- `db:generate` 与 snapshot-diff Migration 继续禁止；
- A2-P1 → 独立 handoff → A2-P2 的边界不变。

本轮没有读取真实 manifest、`.env.local`、`DATABASE_URL`、凭证、Secret、Token、私钥或 PII，没有连接数据库或外部环境，也没有执行 Migration、Seed、`db:generate`、部署或任何 A2 实施任务。

## 2. 用户决策总表

决策选项合法性规则：

- `target-compatible`：与当前已接受的 `target` 一致，可以在本决策包后由用户选择；
- `target-incompatible`：只作为反例或被排除方案保留，不得由本任务直接接受，也不得写入“用户选择”栏作为普通选项；
- 如果用户要求采用 `target-incompatible` 方案，必须先创建并合并独立 ADR，明确修改既有 `target`；ADR 合并前，原决策项继续保持阻断；
- 本决策包不得自行改写架构目标。“推荐”仍然不等于 `accepted`。

“用户选择”必须由用户明确填写；留空即保持对应阻断。

| 编号 | 决策主题 | 选项 | 推荐 | 必须由用户决定 | 未决定时阻断 | 用户选择 |
|---|---|---|---|---|---|---|
| D01 | 原始事实 Owner | A Tenancy 唯一 Owner（`target-compatible`）；B Scope 与 Context／Manifest 拆分 Owner（`target-compatible`）；C 共享 DB／Migration／执行资产作为 Owner（`target-incompatible`，仅作排除项） | A | 只可在 A／B 中选择；要求 C 时必须先通过独立 ADR 重开事实所有权 `target`，ADR 合并前 C 不得记录为 `accepted` | P1、P2 | |
| D02 | Tenancy／Access Control 边界 | A 单向低敏消费；B 直接读表兼容；C 双份事实 | A；B 仅限期兼容；排除 C | producer、Reader／Port、兼容退出和 BASE-02 分界 | P1、P2 | |
| D03 | Manifest version、审批与白名单 | A 严格低敏投影；B 宽松过滤；C 完整 manifest 入库／入 Git | A；排除 C | 版本、审批角色、字段白名单、撤销／替换 | P1 | |
| D04 | Canonicalization 与 digest | A 固定位置 JSON 数组；B JCS 对象；C 长度前缀二进制元组 | A | canonicalization、Unicode、SHA-256 表示与升级政策 | P1；继而阻断 P2 | |
| D05 | Context 政策 | A 全字段显式；B product default 隐式填充；C 环境／Demo 推断 | A；排除 C | source、timezone、currency、日期／时刻、revision／version | P1 | |
| D06 | P1 输入承载 | A 低敏投影进入 data Migration；B 受控 runner 接收仓库外 manifest | B，条件是先独立批准 runner 治理；不批准此前置则 A | 是否新增受控执行通道，或接受低敏投影永久进入 Git | P1、P2 | |
| D07 | P1 执行资产 | A 手写 Migration；B 一次性受控 runner；C 正式 onboarding／人工控制台 | 与 D06 绑定选择 B；不批准治理前置则 A；排除 C | 唯一入口、文件类型、权限、保留期和环境授权 | P1、P2 | |
| D08 | Metadata 策略 | A 全部保持；B 先全量 snapshot 校准；C 分阶段治理 | C | P1／P2 是否触碰 journal、旧文档测试校准点、snapshot 后置政策 | P1、P2 | |
| D09 | 编号与 Migration lease | A 用户签发任务级排他 lease；B 机器强制锁；C 只靠 migrate guard | A；B 后置；排除 C | 授予者、holder、作用域、时限、失效、交接和手写 Migration 许可 | 使用 Migration 的 P1、全部 P2 | |
| D10 | `main` 保护与 Required Check | A 保持未保护；B 保护 + Required Check；C ruleset／merge queue | B | 是否作为 P1／P2 硬门、管理员范围、合并方式和回退权限 | P1、P2 | |
| D11 | P1 文件边界与启动硬门 | A Migration 文件集；B runner 文件集；C 两套入口并存 | 与 D06／D07 绑定；排除 C | 唯一文件 allowlist、测试、环境、备份、计数和前向修复 | P1 | |
| D12 | P2 Exact Constraint Allowlist | A 最小 Anchor Bridge；B 完整业务关系预铺；C 全部推迟到 MIG-01C | A | 精确对象、名称、列序、锁窗口和是否仅创建不验证 | P2，不阻断 P1 | |

## 3. D01 原始事实 Owner

### 3.1 当前事实

- `institution_scopes`、`institution_operating_context_versions`、`institution_operating_contexts` 位于共享 Schema；当前没有 Scope／Context／Manifest provisioning Writer。
- `institution_scopes` 的唯一生产访问是 Security 下的低敏只读 Repository；它只返回双键、status 和 revision。
- `src/modules/tenancy/` 与 `src/modules/access-control/` 当前均不存在，目标目录不能当作 current。
- 平台租户创建链使用 Demo access context，且不写 Scope／Context，不能提升为 A2 Owner。

### 3.2 `target` 约束

- 已接受边界不得重开：
  - Identity：用户、账号和正式 Session；
  - Access Control：Membership、Authorization Provenance、Fresh Membership、Anchor 授权证据、机构／对象 Guard 和 Action Policy；
  - Security：密钥、低敏输出、安全开关和通用安全能力。
- 原始事实必须只有一个语义 Owner；共享 `src/server/db`、Migration 或执行者不是业务 Owner。
- `architecture-v2.md` 与 ADR-V2-015 没有把 Scope／Context／Manifest 原始事实明确交给 Access Control。

### 3.3 方案

- **方案 A｜Tenancy 唯一 Owner**：Tenancy 持久化 Scope、Context Version、Context Head、Manifest、Scope Revision 和 Provisioning Provenance；执行资产只是受控 producer。
- **方案 B｜拆分 Owner**：Access Control 持有 Scope，Tenancy 持有 Context／Manifest。它可解释已合并软件视图中“不具最高级 `target` 决定权”的展开／漂移证据，但一次 P1 事务会跨 Owner，并增加循环依赖和双事实风险。
- **方案 C｜共享 DB／Migration Owner（`target-incompatible／排除`）**：把 `src/server/db`、Migration 或 runner 当作 Owner。该方案混淆资产托管、执行权限和事实所有权，违反当前已接受的单一业务 Owner 与共享数据库资产边界；它只保留为排除反例，不属于本决策包可接受的用户选项。若要采用，必须先创建并合并独立 ADR，明确修改既有 `target`。

### 3.4 推荐方案及理由

推荐 **A**：Tenancy 是原始事实唯一 Owner；Manifest 审批治理者、事实 Owner、执行资产、Migration lease holder 和数据库 operator 可以分离。Access Control 只消费低敏投影，不取得原始事实所有权。

理由是 Scope 与 Operating Context 需要同一事务、同一 revision／version 生命周期和同一 provisioning provenance；拆分到 Access Control 会把授权消费边界变成原始事实生产边界。

### 3.5 风险、成本和不可逆点

- `tenancy` 当前尚未物理落位；选择 A 只冻结所有权，不授权创建空模块或 Runtime。
- 一旦 P1 按某 Owner 写入 provenance，后续改 Owner 必须通过 ADR、兼容 Reader 和可审计迁移，不能只改目录名。
- 选择 B 会让 Scope 与 Context 的原子创建跨模块；选择 C 会形成永久共享实现。

### 3.6 对 A2-P1／A2-P2 的影响

- P1 的 manifest parser／producer、事务和计数必须以选定 Owner 的契约为准。
- 在推荐 D01-A 下，P2 的 binding→Scope 关系属于 Access Control 消费 Tenancy 原始事实的桥，不改变两边 Owner。

### 3.7 用户需明确选择

用户必须在 A／B 中选择。选择 B 时必须说明如何保持单一事实源、P1 原子事务和无循环依赖。C 仅作为被排除反例；若用户要求重新考虑 C，必须停止当前接受流程，先建立独立 ADR 修改 `target`。

### 3.8 未决定时的阻断结果

D01 留空时，P1 无法冻结 parser、producer、Repository 和 provenance 写入职责；P2 也无法确认关系两端的所有者，二者均阻断。

### 3.9 证据路径

- `docs/architecture/architecture-v2.md:124-139`
- `docs/decisions/architecture-v2-decisions.md:78-82`
- `docs/architecture/software-architecture.md:375-386`
- `docs/architecture/v2-mig01-a2-provisioning-preflight.md:64-110`
- `src/server/db/schema.ts:380-499`
- `src/modules/security/server/institution-anchor-repository.ts:20-48`

## 4. D02 Tenancy／Access Control 边界

### 4.1 当前事实

- Anchor Repository 只投影 `{ tenantId, institutionId, status, revision }`，明确不授权访问。
- Anchor Provider 每次重读权威行，随后签发短生命周期 `anc`／`arv` 证据。
- Guard 按正式 provenance → Fresh Membership → active anchor 顺序校验；缺失、重复、停用、过期或双键不一致均 fail-closed。
- 当前直接读表位于 `security`，但 current 物理位置不是最终 Owner 证明。

### 4.2 `target` 约束

- A2 只处理 Scope／Context／Manifest Provisioning。
- Membership／Binding 生命周期、Fresh Membership、Guard 和 Action Policy 留给 BASE-02。
- 无论 D01 选择哪个 Owner，非 Owner 都不得复制或建立第二套 Scope／Context／Manifest 事实源；在推荐的 D01-A 下，Access Control 只消费低敏投影，不持久化完整 Scope、Context Version／Head 或 Manifest。
- Scope／Context 原始事实与 Access Control 签发的短时 Anchor 授权证据不是同一事实。

### 4.3 方案

- **方案 A｜单向低敏消费**：Tenancy 提供版本化 Reader／Port；Access Control 读取低敏投影后签发短时授权证据。
- **方案 B｜直接读共享表的限期兼容**：继续使用当前 Repository，但明确退出条件和最终 Port Owner。
- **方案 C｜Access Control 复制原始事实**：以缓存、副表或第二 Repository 保存 Scope／Context 副本。

### 4.4 推荐方案及理由

在 D01 选择推荐方案 A 的前提下，推荐本项 **A**，并把 **B** 只保留为 BASE-02 前的限期兼容路径；排除 C。该依赖方向保持 Tenancy 为原始事实 Owner，又允许 Access Control 每次请求重新核验 status／revision。若用户改选 D01-B，必须重新说明 Scope 单一 Owner、P1 跨 Owner 事务和无副本边界，不能把本项 A 自动视为已接受。

### 4.5 风险、成本和不可逆点

- A 需要未来真实切片建立 Port／Reader，不能在本决策包创建占位接口。
- B 若没有退出条件，会把当前 `security` Repository 固化成第二 Owner。
- C 会让 Scope suspension／revision 发生不可解释的双写和陈旧授权。

### 4.6 对 A2-P1／A2-P2 的影响

- P1 只写原始 Scope／Context／provenance，不签发权限。
- P2 最小桥只建立 binding 到 Scope 的数据库关系；Binding 生命周期和 active→active 授权语义仍属于 BASE-02。

### 4.7 用户需明确选择

用户需选择与 D01 一致的边界；若采用推荐 D01-A，则确认本项方案 A、当前直接 Repository 的兼容期限／退出条件，以及 P2 关系不等于 BASE-02 已完成。

### 4.8 未决定时的阻断结果

边界未定时，P1 的消费契约和 P2 的关系所有权均不明确，P1／P2 阻断。

### 4.9 证据路径

- `src/modules/security/server/institution-anchor-repository.ts:20-48`
- `src/modules/security/server/institution-anchor-provider.ts:400-545`
- `src/modules/security/server/institution-scope-guard.ts:520-661`
- `src/modules/security/tests/InstitutionAnchorRepository.test.ts:53-94`
- `src/modules/security/tests/InstitutionAnchorProvider.test.ts:54-118`
- `docs/architecture/v2-mig01-a2-provisioning-preflight.md:95-148`

## 5. D03 Manifest version、审批协议与低敏白名单

### 5.1 当前事实

- Schema 已有 Scope／Context／Head 的低敏目标字段，但没有正式 Manifest 类型、Parser、审批状态协议或 Writer。
- Scope source 只有 `formal_onboarding | approved_migration_manifest`；P1 只能使用后者。
- Schema 只证明 digest 长度 64，不证明 version、批准状态、canonicalization 或 digest 算法。

### 5.2 `target` 约束

- 锚点只能由正式 onboarding 或获批 migration manifest 创建，不能从账号 Binding、成员、客户、Demo、Seed 或单机构现状反推。
- P1 必须确定性创建或严格一致复用，不得覆盖式 upsert。
- 未批准、未知版本、越界字段或完整性失败必须整批写前拒绝。
- 执行者不能自批；真实 manifest、凭证和 PII 不进入 Git、日志或本文。

### 5.3 方案

- **方案 A｜严格低敏执行投影**：真实审批包留仓库外，只向执行资产提供 exact-shape、版本化、获批的低敏投影。
- **方案 B｜宽松对象 + 运行时过滤**：接受任意对象，丢弃未知字段并填默认。
- **方案 C｜完整真实 manifest 入 Git／入执行日志**：保留原始审批包全文。

### 5.4 推荐方案及理由

推荐 **A**，建议冻结：

- 顶层 `manifestVersion = mig01-a2/v1` 和 `canonicalizationVersion = c14n-v1`；
- 审批状态只接受 `approved`；
- 审批者低敏引用、审批引用 digest、`approvedAt`、条目数；
- 条目白名单：
  - `tenantId`、`institutionId`；
  - Scope `status`、`revision`、`provisioningSource`；
  - Context `version`、`timezone`、`currency`、`effectiveFromBusinessDate`、`effectiveAt`、`source`、`migrationProvenance`、`createdBy`；
  - Head `revision`、`latestVersion`、`updatedBy`。
- 禁止姓名、电话、邮箱、地址、自由文本、Secret、Token、凭证、连接串和 PII。

版本字符串、字段名和白名单仍是 `proposed`；本段没有创建真实 manifest。

### 5.5 风险、成本和不可逆点

- A 的契约严格，版本升级必须新 digest、新审批和兼容策略。
- B 会让未知字段、默认值和字段缺失在不同执行器间产生漂移。
- C 会产生永久敏感记录和难以撤销的 Git 历史。

### 5.6 对 A2-P1／A2-P2 的影响

- P1 必须在任何数据库访问前校验 envelope、版本、批准状态、白名单、重复键和 digest。
- P2 不读取 manifest 内容，但必须等待 P1 对 manifest 与落库行的一致性证据。

### 5.7 用户需明确选择

用户需决定版本格式、审批角色与状态、执行者分离、字段白名单、审批引用保存原值还是仅保存 digest，以及撤销／替换是否必须新审批和 forward-fix。

### 5.8 未决定时的阻断结果

Manifest 契约未定时，P1 parser、digest、幂等和审计不可验证，P1 阻断。

### 5.9 证据路径

- `drizzle/0038_mig_01a1_institution_isolation_expand.sql:1-52`
- `src/server/db/schema.ts:112-123`
- `src/server/db/schema.ts:380-499`
- `docs/architecture/v2-mig01-a2-provisioning-preflight.md:150-200`

## 6. D04 Canonicalization 与 digest

### 6.1 当前事实

- `institution_scopes.provisioning_reference_digest` 只约束 64 字符。
- 仓库存在多套领域私有协议：固定数组 JSON、排序对象 JSON、长度前缀元组以及不同输出表示；没有 A2 统一协议。
- 仓库已有 SHA-256 和小写 hex 先例，但不能据此声称 A2 算法已接受。

### 6.2 `target` 约束

- 同一获批输入在不同运行器、不同时间和不同环境必须产生相同 digest。
- canonicalization version 与 manifest version 必须进入 preimage。
- 未知算法／版本、重复双键、非法 Unicode、空值歧义或时间格式歧义必须 fail-closed。
- P1 写入后不得回算覆盖历史 digest。

### 6.3 方案

- **方案 A｜固定位置 canonical JSON 数组**：每个字段位置冻结，数组条目先排序。
- **方案 B｜RFC 8785／JCS 对象**：标准化对象，但仓库当前没有对应依赖或 A2 实现。
- **方案 C｜长度前缀 UTF-8 二进制元组**：无键序问题，但人工审阅和跨语言实现成本更高。

### 6.4 推荐方案及理由

推荐 **A**，采用 A2 私有协议，不复用其他领域 helper：

```text
[
  "zmtg.mig01-a2.provisioning-manifest",
  "c14n-v1",
  manifestVersion,
  approvalStatus,
  approvalReferenceDigest,
  approverReference,
  approvedAt,
  entryCount,
  [
    [
      tenantId,
      institutionId,
      scopeStatus,
      scopeRevision,
      provisioningSource,
      contextVersion,
      timezone,
      currency,
      effectiveFromBusinessDate,
      effectiveAt,
      contextSource,
      migrationProvenanceOrNull,
      contextCreatedBy,
      headRevision,
      latestVersion,
      headUpdatedBy
    ]
  ]
]
```

具体规则建议为：

- entries 在拒绝重复双键后，按 `tenantId`、`institutionId` 的 UTF-8 字节序稳定排序；
- 固定位置全部出现；唯一获批 nullable 值显式写 `null`，缺字段不等于 `null`；
- ID 保留大小写，按现有 Scope ID 字符集和 Schema 长度校验；枚举精确匹配；
- currency 固定大写；business date 固定 `YYYY-MM-DD`；instant 固定 UTC 毫秒 `YYYY-MM-DDTHH:mm:ss.SSSZ`；
- 数字只允许安全正整数，不接受浮点、指数、负零或字符串数字；
- 字符串必须是合法 Unicode 且已为 NFC；非 NFC 拒绝，不静默改变已批准输入；
- 无额外空白的 JSON 以 UTF-8 编码，计算 SHA-256；
- 外部证据使用 `sha256:<64 位小写 hex>`；数据库字段只保存 64 位小写 hex；
- 升级 canonicalization 或字段顺序必须使用新版本、新 digest 和新审批，不能覆盖旧值。

### 6.5 风险、成本和不可逆点

- 固定位置数组必须靠测试向量防止位置误读。
- NFC 拒绝策略会要求审批源先规范化；静默规范化则可能改变已签内容，因此不推荐。
- digest 一旦进入 Scope 行，算法、排序、空值和时间政策就是可审计历史，不能原地替换。

### 6.6 对 A2-P1／A2-P2 的影响

- P1 必须提供正／负测试向量，并在写库前完成 digest 校验。
- P2 只能消费 P1 的零冲突、可重放证据，不重新计算或迁移 digest。

### 6.7 用户需明确选择

用户需选择 A／B／C，并确认 Unicode 策略、外部／数据库输出格式、测试向量、版本升级和旧 digest 保留政策。

### 6.8 未决定时的阻断结果

无法证明审批输入、执行投影与落库 provenance 是同一内容，P1 阻断；P2 不得绕过 P1。

### 6.9 证据路径

- `src/server/db/schema.ts:388-411`
- `src/modules/institution-knowledge/domain/knowledge-content-manifest.ts:428-531`
- `src/modules/institution/domain/wecom-real-send-proof.ts:178-190`
- `src/modules/institution/domain/wecom-customer-mapping-review-actions.ts:213-220`
- `src/modules/security/server/institution-section-guard.ts:72-104`

## 7. D05 Context source、timezone、currency 与 effective date 政策

### 7.1 当前事实

- Scope、Context Version 和 Context Head 结构已存在，未发现 production Writer。
- Schema 只检查 timezone 非空、currency 三位大写；没有 IANA／ISO 4217 完整校验。
- DB version 是整数，现有 wire declaration 的 version 是字符串，当前没有生产 mapper。
- `Asia/Shanghai`、`CNY` 和历史 version 1 日期只存在于低级候选／契约证据，不是 A2 已接受默认值。

### 7.2 `target` 约束

- P1 首次 Scope revision、Context version、Head revision 和 latestVersion 必须显式、正数且互不混写。
- 不得从执行时钟、部署时区、Binding、Demo、Seed 或单机构现状推断值。
- 重放必须与所有原始字段完全一致；部分存在或任一冲突均写前停止。

### 7.3 方案

- **方案 A｜全部显式**：manifest 对 source、timezone、currency、business date、instant、revision 和 version 逐项赋值。
- **方案 B｜只写 `product_default`**：执行资产从当前代码默认值补齐其余字段。
- **方案 C｜环境／业务数据推断**：从系统时间、部署时区、Binding、客户或 Demo 推导。

### 7.4 推荐方案及理由

推荐 **A**：

- Scope source 固定为 `approved_migration_manifest`；
- Scope revision、Context version、Head revision、latestVersion 首次均显式为 `1`；
- Context source 必须逐项选择 `product_default` 或 `institution_config`；
- 即使选择 `product_default`，timezone、currency、business date 和 instant 仍显式进入获批 manifest；
- timezone 按获批 IANA zone 校验，currency 按获批 ISO 4217 集合校验；
- `effectiveAt` 转换到所选 timezone 后必须落在 `effectiveFromBusinessDate`，具体是否要求本地零点由用户决定；
- 缺失、未知 source、非法 timezone／currency、日期不一致、tenant 不存在、归属不明或既有字段冲突时整批停止。

### 7.5 风险、成本和不可逆点

- A 增加 manifest 长度和审批成本，但可重复、可审计。
- B 使默认版本与执行资产耦合，未来默认变化会改变相同输入结果。
- C 会产生跨环境差异和错误机构归属，必须排除。

### 7.6 对 A2-P1／A2-P2 的影响

- P1 parser、事务和计数必须按明确字段政策实现。
- P2 不改变 Context 值；只在 P1 三元组和计数关闭后申请。

### 7.7 用户需明确选择

用户需选择 Context source 政策、是否允许任何默认、IANA／ISO 校验方式、date／instant 关系、初始 revision／version 规则及冲突后的 forward-fix 语义。

### 7.8 未决定时的阻断结果

P1 无法确定 version 1／head 1 的实际值和重放判定，P1 阻断。

### 7.9 证据路径

- `src/server/db/schema.ts:112-123`
- `src/server/db/schema.ts:380-499`
- `src/server/db/tests/Schema.test.ts:3164-3262`
- `src/modules/institution-contracts/v1/institution-operating-context.ts:17-59`
- `docs/architecture/v2-mig01-a2-provisioning-preflight.md:175-200`

## 8. D06 A2-P1 输入承载

### 8.1 当前事实

- 当前生产数据库政策只允许仓库内已审查 SQL、journal 和 `pnpm db:migrate` guarded 入口。
- 当前没有 A2 manifest runner、input path 或可在执行时验证仓库外 manifest 的实现。
- 手写 SQL 可以携带低敏冻结投影，但当前证据不能证明它能在执行时重建、核对完整审批信封。

### 8.2 `target` 约束

- 真实 manifest 不进入 Git、argv、环境变量正文或日志。
- version、审批、canonicalization、digest、重复键和全批分类必须在任何写入前完成。
- 写入必须是单事务、严格一致复用，并产生 `inserted／reused／conflict／unexpected` 低敏计数。
- 不得同时建立两套 P1 输入入口。

### 8.3 方案

- **方案 A｜低敏投影进入手写 data Migration**：
  - 优点：直接符合 current 生产 runbook，SQL／journal／PR 可审计；
  - 代价：投影永久进入 Git，每次清单变化需要新 Migration；SQL 对仓库外完整审批信封的执行时校验能力有限。
- **方案 B｜受控 runner 接收仓库外 manifest**：
  - 优点：可在写库前验证原始获批信封、digest、重复键和全批计数，真实投影不永久进入 Git；
  - 代价：当前没有该通道，且它与“生产只允许 SQL + `pnpm db:migrate`”的 current runbook 冲突。

### 8.4 推荐方案及理由

条件式推荐 **B**，因为它更完整地证明“获批输入 = canonical digest = 实际写入”，并避免真实低敏投影永久进入 Git。

该推荐附带不可省略的前置：在 P1 前以独立任务／PR 冻结 runner 治理、输入注入、target／审批／备份、operator／reviewer 分离、事务／计数、低敏错误、package 命令、operations runbook、权限撤销和保留期。不能让第一次真实 P1 写入同时创建并批准新执行通道。

如果用户不批准这项独立治理前置或不接受增加前置切片，则推荐退回 **A**，因为 A 是唯一直接符合 current production runbook 的方案；同时必须明确接受“SQL 不能独立验证仓库外完整信封”和“低敏投影永久进入 Git”的剩余风险。

### 8.5 风险、成本和不可逆点

- B 增加一个数据库执行入口；若治理不完整，会绕开现行 migration guard。
- A 让低敏投影进入永久 Git 历史，撤回 manifest 不会删除历史。
- B 的 runner 不能演变为常驻 onboarding Runtime；A 的 data Migration 不能成为日常 provisioning 接口。

### 8.6 对 A2-P1／A2-P2 的影响

- 选 B：P1 不占 Migration 编号、不修改 journal／snapshot；P2 仍是独立 DDL Migration。
- 选 A：P1 取得独立 Migration 编号和 lease，写入 SQL／journal；P2 再取得新编号和新 lease。

### 8.7 用户需明确选择

用户必须选择 A 或 B；若选 B，还必须批准“先治理执行通道、后实施 P1”的新增前置；若选 A，必须批准低敏投影进入 Git 及其字段范围。

### 8.8 未决定时的阻断结果

P1 的输入、审批链、文件范围、测试和环境入口不能冻结，P1 阻断；P2 等待 P1 handoff，因此也阻断。

### 8.9 证据路径

- `docs/operations/production-migration-runbook.md:5-19`
- `docs/operations/production-migration-runbook.md:38-47`
- `docs/operations/production-migration-runbook.md:83-103`
- `docs/operations/drizzle-migration-snapshot-strategy.md:3-14`
- `scripts/db/guarded-migrate.mjs:89-185`
- `docs/architecture/v2-mig01-a2-provisioning-preflight.md:286-293`
- `docs/architecture/v2-mig01-a2-provisioning-preflight.md:324-358`

## 9. D07 A2-P1 执行资产类型

### 9.1 当前事实

- 当前稳定数据库入口是 `scripts/db/guarded-migrate.mjs`，它只校验 journal／pending allowlist 后启动 `drizzle-kit migrate`，不是 A2 runner。
- 当前 package 只有 `db:generate`、`db:migrate` 和 `db:seed`，没有 provisioning 命令。
- P1 与 P2 已冻结为两个实施切片，中间必须有独立 handoff。

### 9.2 `target` 约束

- P1 只处理 manifest 校验、Scope／Version 1／Head 1、严格一致复用、事务和计数。
- P1 不新增约束，不写 Membership／Binding，不放行 Guard／Reader。
- P2 只处理获批 DDL allowlist，不能由 P1 资产顺带执行。

### 9.3 方案

- **方案 A｜手写 journal Migration**：一个低敏 data Migration，经现行 guarded migrate 执行。
- **方案 B｜一次性受控 runner**：`scripts/db/**` 中的唯一入口，接收仓库外 manifest，在写前完成全部校验。
- **方案 C｜正式 onboarding Service／Route 或人工 SQL 控制台**：把迁移 provisioning 变成 Runtime 或不可重复人工操作。

### 9.4 推荐方案及理由

与 D06 绑定，条件式推荐 **B**，排除 C。runner 代码与测试可保留用于审计和受控重放，但 manifest、凭证和环境权限不持久化；执行权限在 handoff 后撤销。

选择 B 之前必须独立调整 current production runbook 和 guard 边界；若用户不批准该治理前置，则选择 A，且不得同时保留 runner 与 SQL 两套入口。

### 9.5 风险、成本和不可逆点

- B 若没有独立 runbook、最小权限和撤权，会成为旁路数据库工具。
- A 每批需要新 Migration，且审批信封与投影的等价性更依赖独立复核。
- C 会越过 A2／BASE-02 边界或产生不可审计操作，应排除。

### 9.6 对 A2-P1／A2-P2 的影响

- B 让 P1 成为数据执行资产，P2 保持手写 DDL Migration。
- A 让 P1／P2 都是 Migration，但必须分别编号、授权、PR、lease 和 handoff。

### 9.7 用户需明确选择

用户必须确认唯一执行资产、输入注入方式、operator／reviewer 分离、是否新增 package 命令、资产保留／停用和权限撤销规则。

### 9.8 未决定时的阻断结果

无法冻结唯一入口和失败恢复，P1／P2 阻断。

### 9.9 证据路径

- `package.json:21-25`
- `scripts/db/guarded-migrate.mjs:89-185`
- `src/server/db/tests/MigrationGuard.test.ts:72-240`
- `docs/architecture/v2-mig01-a2-provisioning-preflight.md:202-264`

## 10. D08 Migration Metadata 策略

### 10.1 当前事实

- journal 最新为 idx `38`、tag `0038_mig_01a1_institution_isolation_expand`，SQL／journal tag 集合一致。
- snapshot 最新为 `0026_snapshot.json`，不包含 A1 的 enum、三张表和新增列。
- production 以已审查 SQL／journal 为执行来源，snapshot 不用于推断环境已执行状态。
- `db:generate` 和 snapshot-diff Migration 继续阻断。
- 旧 snapshot 策略文档和 `ProductionReadinessDocs.test.ts` 仍锁定 0035／0036 口径，属于可解释但未修复的治理漂移。

### 10.2 `target` 约束

- 不手工伪造 snapshot `id／prevId`，不把 0026 当作 0038 current metadata。
- metadata 治理与业务 Schema／data 变更分开评审。
- 环境真实 journal 必须独立授权核验，不能从仓库 journal 推断。
- 已执行 SQL 不原地修改；错误使用新编号 forward-fix。

### 10.3 方案

- **方案 A｜全部保持现状**：继续保留 snapshot 0026 和旧文档／测试口径。
- **方案 B｜A2 前全量 snapshot baseline 校准**：先重建完整 metadata 链。
- **方案 C｜分阶段治理**：
  - runner P1 不修改 journal／snapshot；
  - 首个 journal-backed A2 切片前，以独立任务修正旧策略文档／测试的过时 current 口径；
  - P2 继续使用已审查手写 SQL + journal，snapshot 保持 0026；
  - 完整 snapshot baseline 校准另立治理任务；此前持续禁止 `db:generate`／snapshot-diff。

### 10.4 推荐方案及理由

推荐 **C**。它不让历史 snapshot diff 污染 A2，也不把旧 0035／0036 文字继续冒充 current；完整 snapshot 校准保持独立，避免把 metadata 大治理夹入 P1／P2。

如果 D06／D07 选择 A（data Migration），则“修正旧策略文档／测试 current 口径”必须提前到 P1 之前；若选择 runner B，则最迟在 P2 之前完成。

### 10.5 风险、成本和不可逆点

- A 会继续扩大文档／测试与 journal 的事实漂移。
- B 范围大，可能把 0027～0038 历史差异错误混入 A2。
- C 暂时保留 snapshot 技术债，未来仍不能使用 `db:generate`。

### 10.6 对 A2-P1／A2-P2 的影响

- runner P1 不触碰 Migration metadata。
- data Migration P1 和 DDL P2 只允许经批准的 SQL／journal 路径；是否允许任何 metadata 文件必须逐切片冻结。

### 10.7 用户需明确选择

用户需决定 snapshot 漂移是否阻断 runner P1、是否接受 P2 的“手写 SQL + journal、snapshot 仍为 0026”、旧文档／测试修正插入点和完整 snapshot 校准的后置方式。

### 10.8 未决定时的阻断结果

P1 无法确认是否触碰 journal；P2 无法冻结 Migration 文件集和验证口径，二者阻断。

### 10.9 证据路径

- `drizzle/meta/_journal.json:271-276`
- `drizzle/meta/0026_snapshot.json`
- `docs/operations/drizzle-migration-snapshot-strategy.md:3-28`
- `docs/operations/production-migration-runbook.md:38-47`
- `src/server/db/tests/ProductionReadinessDocs.test.ts:64-70`
- `scripts/db/guarded-migrate.mjs:30-86`

## 11. D09 编号与唯一 Migration lease

### 11.1 当前事实

- 当前 journal 后的数值候选是 `0039`，但它不是预留、批准或 lease。
- migrate guard 校验 SQL／journal、expected current／target 和全部 pending allowlist，但不协调跨 PR、Agent 或环境的排他 lease。
- 当前仓库没有机器强制 Migration lease。

### 11.2 `target` 约束

- Schema、Migration、journal 和环境执行必须串行。
- 编号只能在实施任务 fresh fetch 后，从最新 `origin/main`／journal 分配。
- P1、P2 若都使用 Migration，必须分别取得新编号和独立 lease。
- base、journal、Head、环境或授权任一漂移都必须停止。

### 11.3 方案

- **方案 A｜任务级排他 lease**：用户或明确指定的 Migration 协调者签发，记录 frozen base、journal、候选编号、holder、作用域、目标环境、开始、过期、续期、失效、释放和交接。
- **方案 B｜机器强制锁**：以后通过受保护 environment／集中协调资产实施。
- **方案 C｜只依赖 migrate guard**：没有跨 PR／Agent 互斥。

### 11.4 推荐方案及理由

推荐当前采用 **A**，把 B 作为独立治理候选，排除 C。

建议 lease：

- 授予者：用户或用户明确指定的唯一 Migration 协调者；
- holder：具体任务编号 + 分支 + operator，不以模糊团队名持有；
- 作用域：`drizzle/**`、`src/server/db/schema.ts`、必要 metadata／测试和明确目标环境；
- 开始：fresh fetch、base／journal／编号／文件 allowlist／环境授权冻结后；
- 失效：时限届满、授权撤回、base／journal／Head／环境变化、并发 Writer 或未知执行结果；
- 交接：合并和获授权环境结果完成后，在独立 handoff 记录计数、异常、forward-fix、最新 journal 和释放时间。

### 11.5 风险、成本和不可逆点

- A 依赖流程执行，不能提供机器级互斥。
- B 需要额外仓库／环境治理，不能由本文发明为已存在。
- C 会造成编号占用、pending 集合扩大或两个执行者冲突。

### 11.6 对 A2-P1／A2-P2 的影响

- runner P1 不占 Migration 编号，但仍需要独立执行 lease。
- data Migration P1 占一个届时分配的编号；P2 在 P1 handoff 后重新取号。
- 当前 `0039` 仅用于解释静态候选，不授予给 P1 或 P2。

### 11.7 用户需明确选择

用户需决定是否允许手写下一 Migration、lease 授予者／holder／作用域／有效期／续期／失效／交接，以及 P1／P2 是否分别取得独立 lease。

### 11.8 未决定时的阻断结果

任何使用 Migration 的 P1 和全部 P2 阻断；runner P1 也因执行 lease 未定而阻断环境执行。

### 11.9 证据路径

- `drizzle/meta/_journal.json:271-276`
- `scripts/db/guarded-migrate.mjs:30-86`
- `scripts/db/guarded-migrate.mjs:117-152`
- `src/server/db/tests/MigrationGuard.test.ts:149-180`
- `docs/architecture/v2-mig01-a2-provisioning-preflight.md:268-306`

## 12. D10 `main` 保护与 Required Check

### 12.1 当前事实

- 2026-07-29 只读 API 核对：`main.protected=false`、Required Check 为空、enforcement `off`。
- “架构与质量门禁”仅由 `pull_request` 触发，Job 名为“最小架构与质量门禁”，依次执行环境核对、依赖安装、架构自测、增量检查、lint、typecheck、完整测试和 build。
- Workflow 只有 `contents: read`，没有 `continue-on-error`。
- 仓库当前允许三种合并方式；存在 CI 不等于服务端已强制阻断失败合并。

### 12.2 `target` 约束

- 推荐配置不等于设置已启用；仓库设置必须由独立授权任务修改和验证。
- P1／P2 的成功 check 必须属于冻结 Head；pending、failure、cancelled、skipped 或旧 Head 结果都不能替代。
- 不得使用 admin bypass、force push 或自动合并绕过门禁。

### 12.3 方案

- **方案 A｜维持未保护 main**：依赖人工遵守检查。
- **方案 B｜main 保护 + Required Check**：要求 PR，冻结 Head 的“最小架构与质量门禁”成功；管理员同样受约束。
- **方案 C｜ruleset／merge queue**：进一步机器化，但当前没有设计或仓库资产。

### 12.4 推荐方案及理由

推荐 **B**，作为 P1／P2 启动硬门：

- 禁止直接 push、force push、删除和 bypass；
- Required Check 精确绑定“最小架构与质量门禁”；
- A2 数据／Migration PR 只使用 Merge Commit，禁止 squash、rebase、auto-merge 和 `--admin`；
- 是否在仓库全局关闭其他合并方式另行决定，本文不建议借 A2 决策静默改动全仓策略；
- Workflow 故障时停止并修复，或经独立授权回退设置，不以管理员绕过替代。

### 12.5 风险、成本和不可逆点

- 错误的 check 名称或触发条件会阻断合并，设置任务必须用测试 PR 验证。
- 管理员零豁免提高安全性，也要求预先定义故障回退权限。
- C 的设计和运维成本高，不能在本文直接采用。

### 12.6 对 A2-P1／A2-P2 的影响

- B 获用户决定后，必须先完成独立仓库设置任务及只读复核，再申请 P1。
- P1／P2 均需新 Head 对应的真实 check 成功。

### 12.7 用户需明确选择

用户需决定是否采用 B、管理员是否零豁免、是否要求分支基于最新 main、Merge Commit 规则只限 A2 还是仓库全局，以及设置变更／回退由谁授权。

### 12.8 未决定时的阻断结果

按已合并 A2 预检的 proposed 硬门，P1／P2 均保持阻断；本文不会替用户修改设置。

### 12.9 证据路径

- `.github/workflows/architecture-quality.yml:1-80`
- `docs/architecture/README.md:121-135`
- `docs/architecture/development-architecture.md:218-220`
- GitHub Branch／Repository API 的 2026-07-29 只读结果

## 13. D11 A2-P1 文件边界与启动硬门

### 13.1 当前事实

- P1 只允许 manifest 校验、Scope／Version 1／Head 1 的确定性创建或严格一致复用、单事务、幂等、冲突封堵和分类计数。
- 当前没有 manifest parser、provisioning Writer、输入路径或 runner。
- SQL 和 runner 是互斥执行方案，不能批准两套文件的并集。

### 13.2 `target` 约束

- P1 不新增复合键、索引、FK／CHECK，不回填业务表，不 `VALIDATE`、不 `SET NOT NULL`。
- P1 不写 Membership／Binding，不启动 Guard、Reader、BASE-02、Writer、Audit、B 或 C。
- 环境 journal、备份／恢复点、真实 manifest、目标数据库和 operator 身份必须独立授权核验。
- P1 完成后必须独立 handoff，不能自动启动 P2。

### 13.3 方案

- **方案 A｜Migration 文件集**：
  - 一个 lease 分配编号的 `drizzle/*.sql`；
  - `drizzle/meta/_journal.json`；
  - D08 明确批准时才允许必要 metadata；
  - 一个聚焦 Migration／计数契约测试；
  - 不修改 `schema.ts`、CI、package 或 runner。
- **方案 B｜runner 文件集**：
  - `scripts/db/**` 下单一 runner／必要的内部类型；
  - 一个聚焦测试文件；
  - 只有用户明确要求稳定命令时才允许 `package.json`；
  - 不修改 `drizzle/**`、journal、snapshot 或 Schema；
  - 真实 manifest 始终留在仓库外。
- **方案 C｜SQL + runner 双入口**：两套入口可对同一三元组写入。

### 13.4 推荐方案及理由

与 D06／D07 绑定选择 **B**；若用户拒绝 runner 治理前置，则整体退回 A。排除 C。未来 handoff 必须把所选方案收窄到精确路径，不得把上述候选通配为授权。

选择 B 前，runner 治理／runbook 任务必须先合并；选择 A 前，旧 metadata 文档／测试口径及低敏投影入 Git 必须先获决定。

### 13.5 风险、成本和不可逆点

- 提前批准 A+B 的并集会形成双执行事实源。
- 共享环境提交后不能删除、覆盖、重绑 Scope 或修改旧 Migration；只能使用新审批和可追溯 forward-fix。
- runner 的长期保留会被误用为 onboarding；Migration 的长期投影会保留在 Git。

### 13.6 对 A2-P1／A2-P2 的影响

P1 必测：

- 未知版本、未批准、digest／canonicalization 失败；
- manifest 内重复双键、空输入、tenant 缺失；
- Scope／Version／Head 全缺、全一致、部分存在；
- 重复执行、字段／revision 冲突、事务回滚；
- 逐表和批次 `inserted／reused／conflict／unexpected` 守恒；
- 禁止默认 institution；
- 完整“最小架构与质量门禁”。

P1 完成 handoff 必须回填 Head／Merge Commit、采用入口、journal／执行状态、四类计数、备份、异常、forward-fix 和 lease 释放。证据不全时 P2 不启动。

### 13.7 用户需明确选择

用户需决定唯一文件方案、精确 allowlist、是否允许 package 命令、定向测试、环境／备份／manifest／数据库授权、停止条件、执行 lease 和前向修复责任人。

### 13.8 未决定时的阻断结果

P1 文件范围和完成定义不能冻结，P1 阻断。

### 13.9 证据路径

- `docs/architecture/v2-mig01-a2-provisioning-preflight.md:224-264`
- `docs/architecture/v2-mig01-a2-provisioning-preflight.md:324-358`
- `docs/architecture/v2-mig01-a2-provisioning-preflight.md:374-402`

## 14. D12 A2-P2 Exact Constraint Allowlist

### 14.1 当前事实

- A1 已有 Scope／Context 的复合 PK、Scope FK、Head→Version FK 和基础 CHECK。
- `auth_account_institution_bindings` 有 tenant/member FK、status／source／version CHECK，但没有 `(tenant_id, institution_id) → institution_scopes` FK，也没有以这两个字段开头的支持索引。
- 更广业务复合键／FK／索引只存在于 historical／proposed 技术设计，不是 accepted allowlist。
- 完整 NOT NULL、attribution 和 shape enforce 属于 MIG-01C。

### 14.2 `target` 约束

- P2 必须等待 P1 和独立 handoff。
- P2 只创建精确 allowlist 中的关系，不回填、不验证历史、不设置非空、不放行 Reader。
- 对象类型、名称、列序、引用目标、predicate、validation 状态、锁窗口和数据 shape 必须逐项核验。

### 14.3 方案

- **方案 A｜最小 Anchor Bridge**：
  - 复用 `institution_scopes_pk`，不新增复合唯一键；
  - proposed 普通索引 `auth_account_institution_bindings_scope_idx`：
    `auth_account_institution_bindings(tenant_id, institution_id)`；
  - proposed `NOT VALID` FK `auth_account_institution_bindings_scope_fk`：
    `(tenant_id, institution_id) REFERENCES institution_scopes(tenant_id, institution_id)`；
  - 不新增 CHECK；不处理 audit attribution／shape。
- **方案 B｜完整业务关系预铺**：
  - 为 Customers、Appointments、Care 子事实、Draft、Timeline、Audit 等预建机构复合键、索引、Scope FK 和父子 `NOT VALID` FK；
  - 必须逐对象列出，不能用“全部业务 FK”通配。
- **方案 C｜全部推迟到 MIG-01C**：
  - P2 不创建关系，binding→Scope 继续只靠 Runtime 复核。

### 14.4 推荐方案及理由

推荐 **A**。它只关闭 A2→BASE-02 的 Anchor Bridge，不把 Writer、Audit 或 MIG-01C 的职责静默并入 P2。推荐的 exact allowlist 只有一个普通索引和一个 `NOT VALID` FK；具体名称仍需用户接受，并在 P2 实施前以 catalog 核验最终冻结。

### 14.5 风险、成本和不可逆点

- 即使 `NOT VALID` 不扫描历史行，也会约束新增／更新行；P2 前必须确认 P1 Scope 已就绪、当前写入路径和锁窗口。
- A 把更广关系推迟到后续独立切片；B 会显著扩大锁、数据 shape 和所有权审计面。
- 同名异定义或部分存在不能自动复用或改名绕过。

### 14.6 对 A2-P1／A2-P2 的影响

- D12 可后置到 P1 完成后的 handoff，不阻断 P1。
- P2 必测全缺／全一致／部分存在／同名异定义、列序、引用目标、validation 状态、事务失败和无数据重写。
- `created／reused／conflict／unexpected` 必须守恒，后两项为 0。

### 14.7 用户需明确选择

用户需选择 A／B／C；选择 A 时确认约束／索引名称、列序和锁窗口；选择 B 时必须另行提交逐对象 allowlist，不能从本文直接实施。

### 14.8 未决定时的阻断结果

不阻断 P1；阻断 P2 的文件范围、编号／lease 和环境执行。

### 14.9 证据路径

- `src/server/db/schema.ts:380-499`
- `src/server/db/schema.ts:911-955`
- `src/server/db/tests/Schema.test.ts:1242-1249`
- `docs/architecture/architecture-v2.md:230-255`
- `docs/architecture/v2-mig01-a2-provisioning-preflight.md:253-264`
- `docs/superpowers/plans/2026-07-18-institution-base-03-mig-01-technical-design.md:142-170`

### 14.10 明确排除

A2-P2 不包含：

- 任何数据回填；
- `VALIDATE CONSTRAINT`；
- `SET NOT NULL`；
- 删除或替换 tenant-only 旧约束；
- audit attribution／shape 收紧；
- 模板正式版本化；
- Reader 放行；
- BASE-02、Writer、Audit、MIG-01B／MIG-01C Runtime；
- 未经 catalog、数据 shape 和锁窗口核验的 unique／index／FK／CHECK。

## 15. 建议用户决策顺序与绑定关系

建议按以下顺序集中决定：

1. **所有权层**：D01 → D02；
2. **输入完整性层**：D03 → D04 → D05；
3. **执行通道层**：D06 与 D07 绑定决定；
4. **治理层**：D08 → D09 → D10；
5. **P1 实施边界**：D11；
6. **P2 边界**：D12，可在 P1 完成后的独立 handoff 最终接受。

必须绑定的决定：

- D01 + D02：Owner 与消费边界不能分别采用互相冲突的方案；
- D03 + D04 + D05：Manifest shape、digest preimage 和 Context 字段政策必须同版；
- D06 + D07 + D11：输入承载、执行资产和文件 allowlist 只能选择一套；
- D08 + D09：凡采用 Migration 的切片必须同时确定 metadata 和 lease；
- D10 + D11：P1 的完成定义必须包含冻结 Head 对应的 Required Check。

可以后置到 P2 的决定：

- D12 的最终对象名称和 catalog 定义；
- P2 的实际下一编号；
- P2 的锁／timeout 数值和目标环境窗口；
- 完整 snapshot baseline 校准；
- 机器强制 lease 和仓库全局合并方式治理。

如果 D06／D07 选择 runner B，则 runner 治理／runbook 是 P1 前新增的独立硬前置；如果用户不接受该前置，应明确选择 data Migration A，不能让选择保持模糊。

## 16. 用户选择后的独立 handoff 回填

用户完成选择后，下一次 handoff 至少必须回填：

- D01～D12 每项的用户选择、决定时间、适用范围和未接受方案；
- 哪些选择已经记录为 accepted，哪些仍为 proposed／阻断；
- 是否先启动 runner 治理或仓库硬门配置任务；
- P1 唯一执行资产和精确文件 allowlist；
- P1 是否需要 Migration 编号、lease，或只需要执行 lease；
- metadata、Required Check 和 Merge Commit 政策；
- 仍待授权核验的真实 manifest、环境 journal、目标数据库、备份／恢复点、operator／reviewer；
- 最新 main、决策包 PR Head／Merge Commit 和真实 Actions；
- 唯一下一任务及其明确非目标。

决策包合并不自动配置 `main` 保护、Required Check、runner、runbook 或 Migration lease，也不自动启动 A2-P1、A2-P2、BASE-02、Writer、Audit、MIG-01B、MIG-01C、Reader、平台切片或机构端旧任务。

## 17. 当前仍然阻断 P1／P2 的事项

### 17.1 P1

P1 当前继续被以下事项阻断：

1. D01～D11 尚无用户选择；
2. Owner、Manifest、canonicalization、Context 和唯一执行入口尚未成为 accepted；
3. 若推荐 runner 获选，独立 runner 治理／runbook 尚未实施；
4. `main` 保护和 Required Check 尚未启用；
5. 真实 manifest、环境 journal、目标数据库、tenant 父记录、现有三表 shape、备份／恢复点均待授权核验；
6. operator／reviewer、执行 lease、文件 allowlist、停止和 forward-fix 责任尚未冻结。

### 17.2 P2

P2 除继承 P1 全部完成证据外，继续被以下事项阻断：

1. P1 未完成且独立 handoff 未回填；
2. D08～D12 尚无适用于 P2 的 accepted 选择；
3. exact constraint allowlist、catalog shape、锁／timeout、编号和新 lease 尚未冻结；
4. 目标环境的 P1 计数、冲突和备份证据未知。

## 18. 结论

当前仓库能完整枚举 D01～D12 的选项并形成具体推荐，因此没有触发“无法定位证据或无法枚举方案”的硬停止条件。推荐组合为：

```text
Tenancy 原始事实 Owner
→ Access Control 单向消费低敏投影
→ 严格版本化低敏 manifest
→ A2 私有固定数组 canonicalization + SHA-256
→ Context 全字段显式
→ 条件式受控 runner P1
→ 分阶段 metadata 治理
→ 任务级排他 lease
→ main 保护 + Required Check
→ 唯一 P1 文件集
→ P2 最小 Anchor Bridge
```

该组合仍是 `proposed`。用户未逐项选择前，P1／P2 保持阻断；本文的提交、PR、质量门禁或合并均不把推荐变成 accepted，也不构成任何仓库设置、数据库或实施许可。
