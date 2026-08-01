# BASE-02 Membership Revision 物理模型与 Migration 切片已接受决策

> 状态：`accepted`
>
> 接受组合：`P01_to_P12_bound_acceptance`
>
> 接受日期：2026-08-01
>
> 记录基线：`9393ca8c0c5402ea575ab95e8f4ea6016fa41a84`
>
> 授权来源：用户对当前任务的明确接受
>
> 本文记录精确物理模型和 M0～M7 串行边界。它不取代每个阶段的文件范围、Migration Lease、恢复点、独立审查、Required Check 与执行停止条件。

## 1. 决策定位

用户在当前任务中正式接受
`docs/decisions/base02-membership-revision-physical-model-decision-pack-20260801.md` 的 P01～P12
推荐绑定组合，并接受 M0→M7 作为唯一实施顺序。

本文是新的 accepted decision 记录，不回填或改写历史 proposed 决策包。以下上位约束继续有效：

- `tenant_members` 是 Access Control 唯一 canonical Membership current；
- Identity 拥有用户、账号和正式 Session；
- Access Control 唯一拥有 Membership 与 Binding 生命周期；
- Tenancy 拥有 Scope、Context 与 Scope revision 原始事实；
- Membership revision、Binding version 与 Scope revision 是三个独立版本域；
- current 与 immutable transition evidence 必须同事务原子形成；
- 永久第二套 Membership current、`updated_at` 授权 fallback、Binding／Scope revision 替代方案继续排除。

本次接受不自动接受 M6 的查询优化索引，不支持同 tenant/user 新 incarnation，也不授权 historical
orphan 修复、A2-P2 FK `VALIDATE`、项目级 Writer、Audit／模板、MIG-01B、MIG-01C 或业务 Reader。

## 2. P01～P12 绑定接受结果

| 编号 | 已接受主题 | 已接受结果 |
|---|---|---|
| P01 | canonical current 字段 envelope | `tenant_members` 同表规范化列；M1 允许 legacy all-null／new all-complete，禁止 partial envelope |
| P02 | revision | `revision integer`，初值 1，严格 `+1`，上限 `2147483647`，无隐式 default，溢出 fail-closed |
| P03 | lifecycle | `active／revoked／deleted`；revoked 可 reactivate，deleted 为终态 |
| P04 | incarnation | 复用现有 `tenant_members.id` 作为不可变 identity；初版不支持同 tenant/user 新 incarnation |
| P05 | current provenance | 规范化低敏列，不使用 JSONB current；source／actor／reason／command／occurred／recorded 语义固定 |
| P06 | immutable transition evidence | 新建 `tenant_membership_transitions`，只保存 append-only 历史，不成为第二 current |
| P07 | transition 状态机 | `create／refresh／revoke／reactivate／delete／legacy_calibration` 六种 transition；current 与 evidence 同事务 |
| P08 | legacy calibration | revision 1、`active`、`legacy_calibration／legacy_unknown`；不伪造 actor 或历史发生时间 |
| P09 | Migration 串行 | 严格 M0→M7；每个 DDL／DML 回退域使用独立编号、Lease、恢复点、审查与 handoff |
| P10 | Writer／Reader cutover | Owner Writer 先行，旧 Writer 封堵后校准，再切 Reader；首个 Migration 不放行 Runtime |
| P11 | mutable Membership 字段 | identity 字段创建后不可变；初版只允许 `role` 变化推进 revision，`display_name` 不可变 |
| P12 | Membership／Binding 联动 | 同一 Access Control 外层事务编排，但 Membership revision 与 Binding version 独立推进 |

P01～P12 是一个不可拆分组合。任何阶段若只能实现其中一部分，不得把 Membership lifecycle、BASE-B1
或 BASE-02 标记为完成。

## 3. canonical current 精确物理模型

### 3.1 保留 identity 与自然键

- 保留 `tenant_members.id varchar(64)` 作为不可变 Membership／incarnation identity；
- 保留 `(tenant_id,user_id)` 唯一键和现有 Binding 自然键 FK；
- 不新增重复 `incarnation_id`，不把 revision 拼入 identity；
- 初版 deleted tombstone 不允许同 tenant/user 新建另一行；需要新 incarnation 时返回
  `new_incarnation_not_supported`，只有未来独立 ADR 才可重构自然键和 Binding 引用；
- `updated_at` 仅保留普通更新时间语义，不参与授权 revision。

### 3.2 accepted current envelope

| 列 | SQL 类型 | M1 | M7 目标 | 语义 |
|---|---|---|---|---|
| `revision` | `integer` | nullable、无 default | NOT NULL，正值 CHECK | create／legacy 初值 1；授权事实变化严格 `+1` |
| `lifecycle_status` | `membership_lifecycle_status` | nullable、无 default | NOT NULL | `active／revoked／deleted` |
| `current_provenance_source` | `membership_provenance_source` | nullable、无 default | NOT NULL | `formal_onboarding／access_control_command／legacy_calibration` |
| `current_provenance_actor_id` | `varchar(96)` | nullable、无 default | 条件 Shape | 非 legacy 必填；legacy 必须为空 |
| `current_provenance_reason_code` | `varchar(96)` | nullable、无 default | NOT NULL | 稳定低敏 reason code，禁止自由文本／PII |
| `current_provenance_command_id` | `varchar(128)` | nullable、无 default | NOT NULL | 当前成功变化的 command identity |
| `current_provenance_occurred_at` | `timestamptz` | nullable、无 default | 条件 Shape | 非 legacy 必填；legacy 必须为空 |
| `current_provenance_recorded_at` | `timestamptz` | nullable、无 default | NOT NULL | current／evidence 实际持久化时间 |
| `revoked_at` | `timestamptz` | nullable、无 default | 条件 Shape | revoked 必填，active 为空 |
| `deleted_at` | `timestamptz` | nullable、无 default | 条件 Shape | deleted 必填，active／revoked 为空 |

M1 的 CHECK 只允许全部新列为 NULL 的 legacy row，或满足完整 revision、lifecycle 与 provenance Shape
的新 row。任何 partial envelope 必须 fail-closed。M7 才在 Writer 封堵、校准、追赶和 Reader 切换完成后
执行 NOT NULL 与最终 Shape Enforce。

### 3.3 mutable 字段与状态 Shape

- `id／tenant_id／user_id／created_at／display_name` 初版创建后不可变；
- `role` 是初版唯一可变授权字段，实际变化必须使用 `refresh` 并推进 revision；
- 纯观察 refresh 不写 current、不生成 transition；
- `active`：`revoked_at=NULL`、`deleted_at=NULL`；
- `revoked`：`revoked_at NOT NULL`、`deleted_at=NULL`；
- `deleted`：`deleted_at NOT NULL`，终态；已有 `revoked_at` 时保留且不得晚于 `deleted_at`；
- 非 legacy 命令满足 `recorded_at >= occurred_at`；revoke／delete 时间取命令
  `occurred_at`；legacy actor／occurredAt 均为 NULL；
- 数据库不使用 default 或 trigger 自动推进 revision。

## 4. immutable transition evidence

精确表名为 `tenant_membership_transitions`，accepted 列如下：

| 列 | SQL 类型 | nullability／语义 |
|---|---|---|
| `id` | `varchar(96)` | NOT NULL／PK，immutable evidence identity |
| `tenant_id` | `varchar(64)` | NOT NULL |
| `membership_id` | `varchar(64)` | NOT NULL，指向稳定 Membership identity |
| `command_id` | `varchar(128)` | NOT NULL，唯一命令／重放拒绝 identity |
| `transition_type` | `membership_transition_type` | NOT NULL，六种 accepted transition |
| `source` | `membership_provenance_source` | NOT NULL，与 current provenance 一致 |
| `actor_id` | `varchar(96)` | 非 legacy 必填，legacy 必须为空 |
| `reason_code` | `varchar(96)` | NOT NULL，稳定低敏 code |
| `from_revision` | `integer` | create／legacy 为 NULL；其余必填且为正 |
| `to_revision` | `integer` | NOT NULL；create／legacy 为 1，其余为 `from+1` |
| `from_lifecycle_status` | `membership_lifecycle_status` | create／legacy 为 NULL；其余必填 |
| `to_lifecycle_status` | `membership_lifecycle_status` | NOT NULL，与状态机一致 |
| `from_role` | `auth_role` | create／legacy 为 NULL；其余记录变化前 role |
| `to_role` | `auth_role` | NOT NULL |
| `occurred_at` | `timestamptz` | legacy 为 NULL；非 legacy 必填 |
| `recorded_at` | `timestamptz` | NOT NULL |

accepted 关系与约束：

- `tenant_members` 增加 UNIQUE `(tenant_id,id)`；
- transition 使用 `(tenant_id,membership_id) → tenant_members(tenant_id,id)` 复合 FK，
  `ON UPDATE NO ACTION ON DELETE NO ACTION`；
- UNIQUE `(tenant_id,command_id)`；
- UNIQUE `(membership_id,to_revision)`；
- btree `(tenant_id,membership_id,to_revision)`；
- CHECK 锁定正 revision、`from+1`、六种 transition 的 from／to status、role 与 legacy null Shape；
- 重放顺序只依赖 `(membership_id,to_revision)`，不能用墙钟排序；
- Runtime role 只具 evidence `SELECT／INSERT`，无 UPDATE／DELETE／TRUNCATE；
- trigger function `reject_tenant_membership_transition_mutation`；
- row trigger `tenant_membership_transitions_reject_row_mutation` 拒绝 UPDATE／DELETE；
- statement trigger `tenant_membership_transitions_reject_truncate` 拒绝 TRUNCATE。

Repository 约定不能替代 UNIQUE、CHECK、FK、权限和 trigger 提供的物理保护。

## 5. command 与 evidence identity

- Runtime command：`mcmd1_<base64url-no-padding(random-32-bytes)>`；
- Runtime evidence：`mtr1_<base64url-no-padding(random-32-bytes)>`；
- 任一重复 `command_id` 均返回 `command_replay_rejected`，不比较 payload、不自动返回历史成功；
- legacy calibration command identity：

```text
mcal1_<lowercase-hex(
  SHA-256(UTF-8("zmtg:membership-calibration-command:v1") || 0x00 ||
          UTF-8(tenant_id) || 0x00 || UTF-8(membership_id))
)>
```

- legacy calibration evidence identity：

```text
mtcl1_<lowercase-hex(
  SHA-256(UTF-8("zmtg:membership-calibration-transition:v1") || 0x00 ||
          UTF-8(tenant_id) || 0x00 || UTF-8(membership_id))
)>
```

`0x00` 是单字节 NUL 分隔符，输入编码固定 UTF-8，SHA-256 输出固定 64 个 lowercase hex 字符且
不带 `0x`。两个命名域不得复用。

## 6. accepted 生命周期与 Binding 联动

| command | Membership | Binding | revision／version |
|---|---|---|---|
| create | expected-absence → active revision 1 | 不猜 institution；如 onboarding 同时授予机构，由 composition root 在同一外层事务显式创建 Binding | 两个版本域独立创建 |
| refresh | 仅 active 且 role 实际变化，`n→n+1` | 不变 | 只推进 Membership revision |
| revoke | active→revoked，设置 `revoked_at` | 同一外层事务撤销该 account+tenant 的 active Binding（若存在） | 两个版本域分别推进 |
| reactivate | revoked→active，清空 `revoked_at` | 不自动恢复旧 Binding | 只推进 Membership revision |
| delete | active／revoked→deleted tombstone | 若有 active Binding，先在同一外层事务撤销；保留历史 Binding | 两个版本域分别推进 |
| Binding rebind | Membership 不变 | 撤销旧 active Binding、创建新 Binding | 只推进 Binding version |
| legacy_calibration | legacy all-null→active revision 1 | 不修改 | 只建立 Membership baseline |

固定锁序为：

```text
tenant_members current
→ active auth_account_institution_bindings（仅涉及 Binding 时）
→ tenant_membership_transitions append
```

create 在 current row 不存在时，必须用 `(tenant_id,user_id)` 的 transaction-scoped advisory lock 或
等价唯一串行化。onboarding 必须向 Access Control command 传入 transaction-bound UoW，Owner command
不得另开事务。

## 7. expectedRevision CAS 不变量

- 每个非 create 写命令必须携带 `commandId`、`expectedRevision`、actor、reason 与 occurredAt；
- create 使用 expected-absence；
- current mutation 使用 identity＋expected revision＋expected lifecycle status 条件写；
- 成功时 `revision=expectedRevision+1` 且 affected rows 精确为 1；
- 同一旧 revision 并发命令最多一个 commit；
- stale、future、非法、溢出、状态不允许、affected rows 0 或大于 1 均 fail-closed；
- 任一 current／Binding／evidence 步骤失败，外层事务整批回滚；
- CAS 冲突和执行失败不得自动重试，不得恢复旧 Writer 或时间戳 fallback；
- `expectedRevision >= 2147483647` 时返回 `revision_exhausted`。

## 8. accepted legacy calibration

M4 对每个未校准 legacy row 形成：

```text
revision=1
lifecycle_status=active
current_provenance_source=legacy_calibration
current_provenance_actor_id=NULL
current_provenance_reason_code=legacy_unknown
current_provenance_command_id=<accepted deterministic command identity>
current_provenance_occurred_at=NULL
current_provenance_recorded_at=<实际校准记录时间>
transition_type=legacy_calibration
from_revision=NULL
to_revision=1
from_lifecycle_status=NULL
to_lifecycle_status=active
from_role=NULL
to_role=<legacy current role>
occurred_at=NULL
recorded_at=<实际校准记录时间>
```

校准不得修改 role、display_name、tenant/user 归属、Binding、Scope 或 historical orphan。Migration
时间只能写入 `recorded_at`，不能伪造 create 时间、actor 或业务 reason。

## 9. M0～M7 唯一实施顺序

```text
M0 metadata current 校准
→ M1 Expand current envelope 与 transition evidence
→ M2 Access Control Owner Writer／CAS
→ M3 onboarding 委托、旧 Writer／Deleter 封堵
→ M4 deterministic legacy calibration
→ M5 高水位追赶与冲突清零
→ M6 Reader 从 updated_at 切换到显式 revision＋lifecycle
→ M7 Enforce 与旧路径退出
→ BASE-B1～B6 独立闭环
```

### M0

实时核对 journal、SQL、snapshot 与 current metadata；不预留编号、不创建 Lease。无漂移且无需修改时只
形成低敏证据，不创建无意义 PR。

### M1

独立手写 Expand Migration，只增加 nullable／无 default current envelope、transition evidence、键、
FK、UNIQUE、CHECK 与 append-only trigger；禁止 legacy DML。实时分配编号和唯一 Lease；固定锁序、短
事务、timeout、恢复点、独立审查、local_acceptance 单次 guarded Migration、执行证据和 handoff 均不可跳过。

### M2

建立 transaction-bound Access Control Owner command／Writer 与 CAS；合成和事务测试先行。legacy
all-null row 除 create 外继续返回 `legacy_membership_not_calibrated`。

### M3

onboarding 委托 Owner；trial reset、主 seed、低敏 seed、CLI 与维护入口必须委托或保持 fail-closed；
Owner 外 direct Membership mutation 必须为 0。

### M4

独立手写 deterministic legacy calibration 数据 Migration。稳定排序、独立编号／Lease／恢复点／审查／
执行，行数守恒、每条 current 恰好一条 baseline evidence、冲突为 0；共享环境消费后只允许 forward-fix。

### M5

独立手写高水位追赶数据 Migration，处理 M4 冻结后合法新增的 legacy row；Owner 外 Writer 必须为 0，
null envelope、duplicate、conflict、unexpected 必须清零；不自动重试、不改写已消费 Migration。

### M6

Access Control authoritative Reader 返回显式 membership identity、revision、lifecycle 与 role；删除
`updated_at` 授权 fallback。Formal Session 仅保存 selector／provenance，每次请求重读 Membership、
Binding 与 Scope；非 active、revision 漂移或 Provider 不可用均 fail-closed。

### M7

仅在 M1～M6 证据全部通过后执行独立 Enforce Migration：current envelope NOT NULL／最终 CHECK、
transition 最终约束与旧路径退出。Owner 外 Writer／Deleter 必须再次为 0。禁止夹带 orphan、A2-P2 FK
`VALIDATE`、业务 Reader 或项目级 Writer 放行。

## 10. Migration、回滚与审查规则

- M1、M4、M5、M7 各自使用实时编号、独立 Migration Lease、独立恢复点与独立执行证据；
- 不预留后续编号，不共享长期 Lease，不运行 `db:generate`，不修改 snapshot；
- SQL 不写显式外层 BEGIN／COMMIT；沿用 guarded migration 的短事务与 fail-closed 机制；
- 所有相关表／行使用固定锁序，设置有界 `lock_timeout`／`statement_timeout`；
- 事务前失败可回退 PR；共享环境消费后不改写 SQL／journal，只允许独立 forward-fix；
- 每个实施 PR、独立审查 PR、执行证据 PR 与 handoff PR 都必须绑定冻结 Head、真实 Required Check、
  Merge Commit 和最终 main；
- 普通测试／CI 问题不得放宽约束；范围外既有问题使用独立修复 PR。

## 11. BASE-B1～B6 与项目级边界

- M7 完成前不得宣称 BASE-B1 Runtime 关闭；
- BASE-B1～B4 只闭环 Access Control Membership／Binding Writer、Fresh Membership Reader、Session 与
  Guard 消费链；Operating Context 不加入本轮授权组合；
- BASE-B5 historical orphan 只有唯一权威业务依据时才可受控处置；不存在依据时形成 blocked handoff；
- BASE-B6 需要 M0～M7、B1～B5 全证据、orphan `0／0`、Owner 外 direct Writer／Deleter=0；
- A2-P2 FK 继续 `NOT VALID`；
- 项目级 Writer、Audit／模板、MIG-01B、MIG-01C 与业务 Reader 不因本决策自动启动。

## 12. 决策结果

```text
membership_revision_direction=A-full_same_table_lifecycle
membership_revision_decision_accepted=true
membership_revision_physical_model=normalized_current_plus_transition_evidence
membership_revision_physical_model_accepted=true
membership_revision_current_table=tenant_members
membership_transition_table=tenant_membership_transitions
membership_new_incarnation_initial_support=false
membership_revision_migration_sequence=M0_to_M7_accepted
membership_revision_reader_index_candidates_deferred_to_M6=true
historical_orphan_in_scope=false
a2_p2_scope_fk_validation_in_scope=false
project_writer_started=false
audit_template_started=false
mig01b_started=false
mig01c_started=false
business_reader_started=false
```

## 13. 真正硬停止条件

- accepted P01～P12 无法在当前 PostgreSQL／Drizzle 栈实现且必须重开 A-full；
- 需要永久第二套 Membership current；
- Migration 编号、Lease、恢复点、事务回滚或执行结果无法证明；
- current、Schema、journal、Writer 或数据出现无法解释的漂移；
- 需要生产／非 localhost 环境；
- 需要修改 snapshot、运行 `db:generate`、绕过 Required Check 或破坏性改写已消费 Migration；
- 出现 Secret、Token、密码、私钥或 PII 泄漏；
- Git 状态无法安全恢复。

## 14. 证据链

- `docs/decisions/base02-membership-revision-accepted-decision.md`；
- `docs/decisions/base02-membership-revision-physical-model-decision-pack-20260801.md`；
- `docs/operations/base02-membership-revision-schema-migration-preflight-20260801.md`；
- `docs/operations/base02-membership-revision-schema-preflight-independent-review-20260801.md`；
- `docs/handoff/CURRENT_STATUS.md`；
- `docs/handoff/NEXT_TASK.md`。
