# BASE-02 Membership Revision 精确物理模型决策包

> 状态：`proposed physical model`／`not accepted`
>
> 证据状态：`current evidence`
>
> 决策基线：`e4f6a822fc52dd46d52c7d6accb0bae5c2a428a5`
>
> 决策日期：2026-08-01
>
> `schema_migration_implementation_authorized=false`

## 1. 决策定位

本文在已接受 A-full 语义内比较物理实现并给出唯一推荐。推荐不是 accepted decision；“用户选择”列
保持空白时，不能创建 Schema、Migration、Migration Lease、数据库资产或 BASE-B1 Runtime。

本文不重开：

- `tenant_members` 作为 Access Control 唯一 canonical Membership current；
- Identity／Access Control／Tenancy／Security Owner；
- Membership revision／Binding version／Scope revision 三个独立版本域；
- 显式单调 revision、`expectedRevision` CAS、完整 lifecycle、ABA、current provenance、同事务 immutable
  transition evidence 与唯一 Writer；
- 永久第二套 current、`updated_at`／Binding version／hash／HMAC 方案已经排除。

## 2. 用户接受总表

| 编号 | 待接受物理主题 | 推荐 | 用户必须明确接受 | 未接受时阻断 | 用户选择 |
|---|---|---|---|---|---|
| P01 | canonical current 字段 envelope | 方案 A：同表规范化列 | 字段、类型、nullability、无默认及 Shape | M1、M4～M7 |  |
| P02 | revision | `revision integer`，初值 1，上限 `2147483647` | 正值、严格 `+1`、溢出 fail-closed | Writer／Reader |  |
| P03 | lifecycle | `active／revoked／deleted` | 状态机、revoked 可 reactivate、deleted 终态 | M1～M7 |  |
| P04 | incarnation | 复用现有 `tenant_members.id` 作为不可变 identity | 初版不支持同 tenant/user 新 incarnation | Schema／Binding 边界 |  |
| P05 | current provenance | 规范化列，不用 JSONB | source／actor／reason／command／时间语义 | M1、M4 |  |
| P06 | immutable transition evidence | `tenant_membership_transitions` | 表、键、约束、append-only 机制 | M1、M2 |  |
| P07 | transition 状态机 | 六种 transition，current 与 evidence 同事务 | from／to revision／status Shape | M2、M4 |  |
| P08 | legacy calibration | revision 1＋`legacy_calibration` baseline | 不伪造历史 actor／occurred time | M4、M5 |  |
| P09 | Migration 串行 | M0→M7 | 每个数据／DDL 切片独立编号、Lease、审查、handoff | 所有实施 |  |
| P10 | Reader／Writer cutover | Owner Writer 先行，旧 Writer 封堵后 backfill，再切 Reader | 禁止首个 Migration 同时放行 Runtime | BASE-B1 |  |
| P11 | mutable Membership 字段 | identity 不可变；`role` 变化推进 revision；`display_name` 初版不可变 | 授权字段 allowlist 与 evidence before／after | M2、M3、M6 |  |
| P12 | Membership／Binding 联动 | 同一 Access Control 外层事务、独立版本域 | create／revoke／reactivate／delete 的 Binding 动作 | M2、M3 |  |

## 3. 物理方案比较

### 3.1 方案 A：规范化同表 current＋规范化 transition 表（推荐）

- `tenant_members` 增加显式 revision、lifecycle、tombstone 与 current provenance 列；
- 独立 `tenant_membership_transitions` 只存 append-only 历史；
- 数据库 CHECK／FK／UNIQUE 与 append-only trigger 提供可静态审查的物理保护；
- Access Control command 在同一事务 CAS current 并 INSERT evidence。

优点：current 单一、查询直接、约束可验证、CAS 与重放键明确、历史 evidence 不冒充 current。代价：需要
多段 Schema／data Migration、Writer cutover、Reader cutover 与 Enforce，不能一次完成。

### 3.2 方案 B：同表 current＋JSONB provenance／transition payload

- revision 与 lifecycle 仍为规范化列，但 provenance 或 before／after evidence 放入 JSONB；
- Repository 负责 payload shape 与 append-only 约定。

优点是列数较少、payload 扩展容易。缺点是 actor／reason／from-to revision／状态机难以由数据库
CHECK／UNIQUE 完整证明，Schema 漂移与历史重放识别更难，应用约定不能单独满足 immutable。它与
A-full 不必然冲突，但安全性和可审查性低于方案 A，本决策包不推荐。

### 3.3 方案 C：复用 `audit_events` 或建立永久 sidecar current（排除）

`audit_events` 是通用审计表，current reset／seed 还存在删除路径；它不能证明 Membership transition
不可变，也不能静态锁定 from／to revision 与 lifecycle。永久 sidecar current 则直接形成第二套
Membership current。两种表达均为 `target-incompatible／排除`，不能在本决策包中接受；若未来要求
采用，必须先独立 ADR 修改 accepted target。

## 4. 推荐 canonical current 精确字段

### 4.1 保留字段与 identity

- 现有 `tenant_members.id varchar(64)` 继续作为不可变 Membership／incarnation identity；
- 保留现有 `(tenant_id,user_id)` 唯一键和 Binding 自然键 FK；
- 不新增重复 `incarnation_id`；不把 revision 拼进 identity；
- 初版不支持同一 tenant/user 在旧 tombstone 旁创建新 row。需要新 incarnation 时返回
  `new_incarnation_not_supported`，未来必须独立 ADR 重构唯一键和 Binding 引用；
- `updated_at` 保留为普通更新时间，但不再参与授权 revision。

### 4.2 新增列候选

| 列 | SQL 类型 | M1 nullability／default | M7 目标 | 精确语义 |
|---|---|---|---|---|
| `revision` | `integer` | nullable；无 default | NOT NULL；CHECK `revision BETWEEN 1 AND 2147483647` | create／legacy calibration 初值 1；每次授权事实成功变化严格 `+1` |
| `lifecycle_status` | enum `membership_lifecycle_status` | nullable；无 default | NOT NULL | 仅 `active`、`revoked`、`deleted` |
| `current_provenance_source` | enum `membership_provenance_source` | nullable；无 default | NOT NULL | 仅 `formal_onboarding`、`access_control_command`、`legacy_calibration` |
| `current_provenance_actor_id` | `varchar(96)` | nullable；无 default | 条件 Shape | 非 legacy 必填；legacy 必须为空 |
| `current_provenance_reason_code` | `varchar(96)` | nullable；无 default | NOT NULL | 低敏、稳定 reason code；禁止自由文本／PII |
| `current_provenance_command_id` | `varchar(128)` | nullable；无 default | NOT NULL | 当前成功变化的 command identity |
| `current_provenance_occurred_at` | `timestamptz` | nullable；无 default | 条件 Shape | 非 legacy 必填；legacy 必须为空，避免伪造历史时间 |
| `current_provenance_recorded_at` | `timestamptz` | nullable；无 default | NOT NULL | evidence 实际持久化时间 |
| `revoked_at` | `timestamptz` | nullable；无 default | 条件 Shape | revoked 必填；active／deleted 规则见下 |
| `deleted_at` | `timestamptz` | nullable；无 default | 条件 Shape | deleted 必填；active／revoked 为空 |

所有新列在 M1 Expand 均 nullable 且没有数据库 default。这样旧 Writer 会暴露为未校准，而不是由 default
伪造 revision、status 或 provenance。M7 才在 Writer 封堵、数据校准和 Reader 切换全部完成后 Enforce。

M1 同时增加 all-null／all-complete envelope CHECK：legacy row 可以暂时让上述新列全部为 NULL；任何
新字段一旦非 NULL，就必须形成完整 current provenance、正 revision 和合法 lifecycle Shape。禁止
partial envelope。M2／M3 兼容窗口只允许 authoritative create 写 complete envelope；对 all-null legacy
row 的 refresh／revoke／reactivate／delete 必须返回 `legacy_membership_not_calibrated`，直至 M4／M5
完成。

### 4.3 mutable 字段与授权 allowlist

- `id`、`tenant_id`、`user_id`、`created_at` 创建后不可变；
- `role` 是初版唯一可变授权字段。role 改变必须使用 `refresh`、`expectedRevision` CAS，并在 evidence
  记录 `from_role／to_role`；
- `display_name` 不参与授权判断，但初版同样创建后不可变，避免 canonical row 出现无 evidence 变化。
  如未来需要修改，必须先独立决定其 Profile Owner 或新增具 evidence 的非授权 command；
- `updated_at` 只在 canonical current 成功变化时更新，是普通审计时间，永远不能作为 revision；
- 纯观察 refresh 不写任何上述字段。初版不存在“无 role 变化但仍推进 revision”的授权 refresh。

### 4.4 current Shape

| lifecycle | `revoked_at` | `deleted_at` | 允许后续 transition |
|---|---|---|---|
| `active` | NULL | NULL | refresh、revoke、delete |
| `revoked` | NOT NULL | NULL | reactivate、delete |
| `deleted` | 可保留先前 revoke 时间或 NULL | NOT NULL | 无；终态 |

非 legacy 命令必须满足 `current_provenance_recorded_at >= current_provenance_occurred_at`。revoke 时
`revoked_at = current_provenance_occurred_at`；delete 时
`deleted_at = current_provenance_occurred_at`，且已有 `revoked_at` 时必须 `deleted_at >= revoked_at`。
legacy 的 occurredAt 与 actor 均为 NULL，不应用上述发生时间等式。精确 CHECK 在 M7 以已接受字段为准
手写。数据库不提供“自动 revision+1”default 或 trigger；revision 必须由 Access Control command 以
`expectedRevision` CAS 明确推进。

### 4.5 revision 与溢出

- 初值精确为 1；0、负数、NULL（M7 后）、跳号、复用与倒退非法；
- CAS：`WHERE id=? AND revision=? AND lifecycle_status=?`；
- 成功后 `revision = expectedRevision + 1`，affected rows 必须精确为 1；
- `expectedRevision >= 2147483647` 时在写入前返回稳定错误 `revision_exhausted`；
- 不自动改用时间戳、bigint sidecar 或 revision 重置；若实际需要扩型，另立 Schema 决策和 Migration。

## 5. 生命周期状态机

| transition | from | to | revision | current provenance／evidence |
|---|---|---|---|---|
| `create` | 无 | active | 无 → 1 | command、actor、reason、occurred／recorded 与 `to_role` 完整 |
| `refresh` | active | active | `n → n+1` | 初版仅 role 实际变化时允许；记录 `from_role／to_role` |
| 纯观察 refresh | 任意 current | 不写 | 不变 | 不写 current，不生成 transition |
| `revoke` | active | revoked | `n → n+1` | 设置 `revoked_at`，使旧 evidence 失效 |
| `reactivate` | revoked | active | `n → n+1` | 清空 `revoked_at`；Binding 必须另走自己的生命周期 |
| `delete` | active／revoked | deleted | `n → n+1` | 设置 `deleted_at`；终态，不允许复活 |
| `legacy_calibration` | 无可证明历史 | active | 无 → 1 | 记录当前 `to_role`；只表示迁移时观察到 legacy current，不伪造历史 |

禁止：active→active 的无事实写、revoked→revoked、deleted→任何状态、revision 跳号、用 Binding rebind
推进 Membership revision。Binding rebind 必须撤销旧 active Binding、创建新 Binding 并推进 Binding
version；只有 Membership 授权事实本身变化时才产生 Membership transition。

### 5.1 Membership／Binding 联动边界

| Membership command | Binding 行为 | 原子性与版本域 |
|---|---|---|
| create | Membership create 本身不猜测 institution；若 onboarding 同时授予机构，composition root 在同一外层事务显式调用 Binding create | Membership revision=1；Binding identity/version 独立创建 |
| role refresh | 不改 Binding | 只推进 Membership revision |
| revoke | 同一外层事务先锁 Membership，再撤销该 account+tenant 的 active Binding（若存在），随后写 Membership current＋evidence | 两个版本域分别推进；任一步失败整批回滚 |
| delete | 若存在 active Binding，同一外层事务先撤销；保留历史 Binding 和 Membership tombstone | 禁止物理删除；两个版本域分别推进 |
| reactivate | 不自动复活旧 Binding，不猜测 institution | 只推进 Membership revision；需要机构访问时另发 Binding create／rebind command，可由同一外层事务编排 |
| Binding rebind | Membership 不变 | 只推进 Binding version，禁止伪推进 Membership revision |

Access Control 同时拥有两个生命周期，但它们不是同一事实。transaction-bound UoW 可以原子编排两个
command，不能让 Membership Repository 直接改写 Binding，也不能反向用 Binding version 充当
Membership revision。

## 6. 推荐 immutable transition evidence

### 6.1 表与列

精确表名：`tenant_membership_transitions`。

| 列 | SQL 类型 | nullability | 语义 |
|---|---|---|---|
| `id` | `varchar(96)` | NOT NULL／PK | immutable evidence identity |
| `tenant_id` | `varchar(64)` | NOT NULL | 与 Membership tenant 一致 |
| `membership_id` | `varchar(64)` | NOT NULL | 指向稳定 `tenant_members.id` |
| `command_id` | `varchar(128)` | NOT NULL | 调用方命令 identity；用于唯一命令／重放拒绝识别 |
| `transition_type` | enum `membership_transition_type` | NOT NULL | `create／refresh／revoke／reactivate／delete／legacy_calibration` |
| `source` | enum `membership_provenance_source` | NOT NULL | 与 current provenance source 一致 |
| `actor_id` | `varchar(96)` | 条件 nullable | 非 legacy 必填，legacy 必须为空 |
| `reason_code` | `varchar(96)` | NOT NULL | 稳定低敏 reason code |
| `from_revision` | `integer` | create／legacy 为 NULL | 其他 transition 必填且为正 |
| `to_revision` | `integer` | NOT NULL | create／legacy 为 1；其他为 `from+1` |
| `from_lifecycle_status` | `membership_lifecycle_status` | create／legacy 为 NULL | 其他 transition 必填 |
| `to_lifecycle_status` | `membership_lifecycle_status` | NOT NULL | 与状态机一致 |
| `from_role` | `auth_role` | create／legacy 为 NULL | refresh／revoke／reactivate／delete 记录变化前 role |
| `to_role` | `auth_role` | NOT NULL | create／legacy 为当前 role；refresh 为新 role；其他 transition 与 `from_role` 相同 |
| `occurred_at` | `timestamptz` | legacy 为 NULL | 非 legacy 的业务授权事实发生时间 |
| `recorded_at` | `timestamptz` | NOT NULL | evidence 持久化时间 |

### 6.2 键、关系与排序

- 在 `tenant_members` 增加 UNIQUE `(tenant_id,id)`，使 transition 使用复合 FK：
  `(tenant_id,membership_id) → tenant_members(tenant_id,id) ON UPDATE NO ACTION ON DELETE NO ACTION`；
- UNIQUE `(tenant_id,command_id)`：同一租户同一 command 只能形成一次 evidence；
- UNIQUE `(membership_id,to_revision)`：同一 Membership 每个 revision 只能有一个 transition；
- btree `(tenant_id,membership_id,to_revision)`：唯一重放／排序键；不以墙钟排序；
- CHECK `to_revision > 0`，非 create／legacy 必须 `to_revision=from_revision+1`；
- transition-specific CHECK 锁定第 5 节 from／to 状态机与 legacy null Shape。

重放顺序只使用 `(membership_id,to_revision)`；`recorded_at` 只作低敏审计时间，不能决定先后。
任何已存在 `command_id` 的再次提交都必须返回 `command_replay_rejected`，不尝试比较 payload，也不
自动返回历史结果；调用方需要另行读取 current。这样当前精确 Shape 不依赖未定义的 payload digest。

command identity 采用互斥命名域：Runtime command 由 Access Control application boundary 生成
`mcmd1_<base64url-no-padding(random-32-bytes)>`；Runtime evidence `id` 使用
`mtr1_<base64url-no-padding(random-32-bytes)>`。legacy calibration 的两个确定性 identity 分别为：

```text
mcal1_<lowercase-hex(
  SHA-256(UTF-8("zmtg:membership-calibration-command:v1") || 0x00 ||
          UTF-8(tenant_id) || 0x00 || UTF-8(membership_id))
)>

mtcl1_<lowercase-hex(
  SHA-256(UTF-8("zmtg:membership-calibration-transition:v1") || 0x00 ||
          UTF-8(tenant_id) || 0x00 || UTF-8(membership_id))
)>
```

其中 `0x00` 是单字节 NUL 分隔符，SHA-256 输出固定为 64 个 lowercase hex 字符，不带前导 `0x`。
两个固定 domain tag 保证 command 与 evidence 摘要不会跨域碰撞。这些值只保存低敏 opaque identity，
不会包含 tenant/user 原文；全部长度适配 `varchar(96／128)`。

### 6.3 append-only 物理保护

推荐同时采用权限与数据库 trigger，Repository 约定不能替代物理保护：

1. Runtime role 对 evidence 只具 `SELECT／INSERT`，无 UPDATE／DELETE／TRUNCATE；
2. trigger function 精确候选名：`reject_tenant_membership_transition_mutation`；
3. row trigger：`tenant_membership_transitions_reject_row_mutation`，`BEFORE UPDATE OR DELETE`；
4. statement trigger：`tenant_membership_transitions_reject_truncate`，`BEFORE TRUNCATE`；
5. trigger 统一 fail-closed，Migration owner 也必须通过后续独立、审计化 forward-fix，而不是静默改历史。

这些名称和机制仍为 proposed，只有 P06 接受后才能进入 M1 SQL。

## 7. 原子命令协议

### 7.1 固定锁序

```text
tenant_members current
→ active auth_account_institution_bindings（仅命令改变 Binding 时）
→ tenant_membership_transitions append
```

create 尚无 current row 时，先按 `(tenant_id,user_id)` 取得 transaction-scoped advisory lock 或等价唯一
串行化，再 INSERT current revision 1 与 evidence。现有 onboarding 的 tenant/account/plan/audit 外层事务必须
向 Access Control 传入 transaction-bound UoW；Owner command 不能另开事务。

### 7.2 CAS 与结果

- 请求必须携带 `commandId`、`expectedRevision`（create 使用 expected-absence）、actor、reason 与 occurredAt；
- 先检查 command identity：任何重复均以 `command_replay_rejected` fail-closed，不比较 payload、不推进
  revision、不自动返回历史结果；
- current mutation 使用 expectedRevision／expected status CAS；affected rows 必须为 1；
- 在同一事务 INSERT transition；任一步失败整批回滚；
- stale、future、非法、溢出、状态不允许、affected rows 0 或 >1 均 fail-closed；
- 同一旧 revision 的并发命令最多一个 commit；失败方不自动重试。

## 8. Legacy deterministic calibration

推荐 M4 对每个未校准 legacy row 形成：

```text
revision=1
lifecycle_status=active
current_provenance_source=legacy_calibration
current_provenance_actor_id=NULL
current_provenance_reason_code=legacy_unknown
current_provenance_command_id=<由稳定 Membership identity 推导的确定性低敏 ID>
current_provenance_occurred_at=NULL
current_provenance_recorded_at=<本次校准实际记录时间>
transition_type=legacy_calibration
from_revision=NULL
to_revision=1
from_lifecycle_status=NULL
to_lifecycle_status=active
from_role=NULL
to_role=<legacy row 当前 role>
```

Migration／校准时间只能写入 `recorded_at`，不能伪造成 Membership create 或授权发生时间。当前仓库证据
不能重建 actor、reason 或 occurredAt；未知必须显式保留为 `legacy_unknown`／NULL。M4 不改变 role、
display_name、tenant/user 归属、Binding、Scope 或 orphan。

## 9. Migration 与切换顺序

唯一 proposed 串行为：

```text
M0 metadata calibration
→ M1 Expand current envelope + transition evidence
→ M2 Access Control Owner Writer／CAS
→ M3 onboarding 委托 + reset／seed direct Writer 封堵
→ M4 deterministic legacy calibration
→ M5 hand-written high-water catch-up Migration／conflict zero
→ M6 Reader 从 updated_at 切换到显式 revision
→ M7 Enforce／旧路径退出
→ 独立 BASE-B1 Runtime 授权
```

- M1、M4、M5、M7 各自实时分配 Migration 编号、唯一 Lease、恢复点、PR、独立审查和 handoff；
- 不预留编号，不共用长期 Lease，不运行 `db:generate`，不修改 snapshot；
- M1 只 Expand，不夹带 legacy DML；M4／M5 不伪造历史；M7 只在 Writer/Reader 切换和冲突清零后 Enforce；
- 首个 Schema／Migration PR 不切 Session、Guard、Reader，不启动 BASE-B1；
- historical orphan `1／1`、A2-P2 Scope FK `NOT VALID`、Writer／Reader 项目发布门禁保持独立。

## 10. Writer／Reader 物理影响

### 10.1 Writer

当前 authoritative Writer 为 0。未来 M2 建立唯一 Access Control command 后：

- onboarding 的唯一 direct INSERT 委托该 command，并保留现有跨域外层事务；
- trial reset 的物理 DELETE fail-closed，不擅自改为 revoke；
- `db:seed` 的 DELETE／UPSERT 与低敏 seed CLI 的 INSERT／DELETE 写模式保持关闭；
- 新架构规则禁止 Access Control allowlist 外的 `tenantMembers` insert/update/delete 与 raw
  `tenant_members` DML；
- M3 完成条件为 Owner 外 direct mutation=0。

### 10.2 Reader

M6 由 Access Control Owner Port 提供显式 `membershipId + revision + lifecycle + role` current fact，
Security 只消费并签发短生命周期 evidence。Formal Session 继续保存 selector／provenance，每次 Guard
请求重新读取 Membership、Binding 与 Scope。禁止：

- `updated_at` fallback；
- 把 revision 固化进长期 Session 并跳过重读；
- 用 Binding／Scope revision 代替 Membership revision；
- 在 lifecycle 非 active 时继续签发 Fresh Membership evidence。

## 11. 索引候选边界

生命周期正确性首先依赖键、CHECK、FK、UNIQUE、CAS 与 evidence 顺序。M1 不借机删除现有索引；
M6 必须以冻结后的真实查询为依据独立决定 lifecycle-aware 索引。当前只记录两个候选，不在本决策包中
自动接受：

- `(user_id,tenant_id) WHERE lifecycle_status='active'` 支撑 formal membership selector；
- `(tenant_id,role) WHERE lifecycle_status='active'` 支撑 quota／admin Reader。

未有查询计划和 Reader 合约前不得删除 `tenant_members_tenant_role_idx` 或新增未证明索引。

## 12. 风险、回滚与不可逆点

| 风险 | 控制 |
|---|---|
| nullable Expand 被误报为 lifecycle 已完成 | M1 只标 Expand；M7 前 BASE-B1 继续 blocked |
| old Writer 生成 null envelope | M3 架构门禁＋M4/M5 高水位清零；M7 无 default Enforce |
| evidence 被改写／删除 | ACL＋UPDATE/DELETE/TRUNCATE trigger；只允许审计化 forward-fix |
| onboarding 失去跨域原子性 | transaction-bound Access Control UoW；失败回滚全部开通写入 |
| deleted 后同自然键重建造成 ABA | deleted 终态；初版返回 `new_incarnation_not_supported` |
| migration time 冒充历史 | legacy occurredAt=NULL，仅 recordedAt 为校准时间 |
| Reader 提前切换 | M6 严格后置 M1～M5；禁止时间戳 fallback |
| shared Migration 已消费 | 不回写 SQL／journal，只创建独立 forward-fix |

## 13. 需要用户接受的绑定组合

P01～P12 建议作为一个绑定组合接受，因为 revision、状态机、provenance、evidence、Binding 联动与
切换序列缺一项都
不能满足 A-full。若用户只接受“加 revision 列”，该结果最多是 A-literal 临时载体，BASE-B1 仍 blocked。

可以后置到 M6 的只有具体查询优化索引；可以后置到未来独立 ADR 的只有同 tenant/user 新 incarnation
支持。不得后置：deleted 终态、无 identity/revision 复用、同事务 evidence、CAS、legacy 未知语义和
旧 Writer 封堵。

## 14. 未接受时的冻结状态

```text
membership_revision_physical_model=proposed_normalized_current_plus_transition_evidence
membership_revision_physical_model_accepted=false
membership_revision_current_table=tenant_members
membership_transition_table=tenant_membership_transitions_proposed
membership_new_incarnation_initial_support=false
membership_revision_migration_sequence=M0_to_M7_proposed
schema_migration_implementation_authorized=false
migration_number_reserved=false
migration_lease_created=false
database_connected=false
base_b1_runtime=blocked
base_b2_started=false
base_b3_started=false
base_b4_started=false
base_b5_started=false
base_b6_complete=false
writer_started=false
reader_started=false
historical_orphan_modified=false
a2_p2_scope_fk_validated=false
```

## 15. 证据路径

- `docs/decisions/base02-membership-revision-accepted-decision.md`；
- `docs/operations/base02-membership-revision-schema-migration-preflight-20260801.md`；
- `docs/decisions/base02-membership-revision-lifecycle-decision-pack-20260801.md`；
- `docs/decisions/base02-membership-revision-architecture-decision-pack.md`；
- `src/server/db/schema.ts`；
- `src/server/db/tests/Schema.test.ts`；
- `src/modules/open-platform/server/tenant-plan-binding-repository.ts`；
- `src/modules/open-platform/server/trial-data-reset-service.ts`；
- `src/server/db/seed-demo-data.ts`；
- `scripts/demo/seed-v06-low-sensitive-demo.ts`；
- `src/modules/auth/server/auth-account-repository.ts`；
- `src/modules/security/server/institution-membership-provider.ts`；
- `src/modules/institution/server/institution-server-runtime.ts`；
- `drizzle/meta/_journal.json` 与 `drizzle/meta/0026_snapshot.json`。

以上路径均只作静态证据；本文没有修改其内容，也没有把 proposed 推荐写成 accepted。
