# BASE-B1 Owner／Port／revision 契约关闭证据

- 状态：`current evidence`
- 日期：`2026-08-02 CST +0800`
- 审计基线：`af58246675787536b6439404582d0b320ab4eba8`
- 任务：`BASE-B1 Owner／Port／revision 契约闭环`
- 结论：`all_exact`
- 文档性质：最新 `main` 的仓库静态证据；不是新的架构事实源、Runtime 实施或数据库证据

## 1. 文档定位与边界

本证据只关闭 Access Control、Identity、Tenancy 与 Security 之间已接受的 Owner、Port 和三个独立
revision 域契约。审计读取当前代码、测试、架构门禁与已合并 M7 handoff；没有连接数据库，也没有
修改 Runtime、Schema、Migration、journal、snapshot、脚本、测试、CI、package 或 lock。

本证据不实施 standalone Binding create／rebind／revoke／expire，不处理 historical orphan，不执行
A2-P2 Scope FK `VALIDATE`，不建立对象 Guard／Action Policy，不开放业务 Reader／Capability，也不启动
BASE-B2～B6、项目级 Writer、Audit／模板或 MIG-01B／C。

## 2. 关闭总表

| 契约 | current 结论 | 主要证据 |
| --- | --- | --- |
| Membership／Binding 生命周期 Owner | `all_exact` | Access Control 的 command domain、transaction Port、application service 与唯一 Repository 形成单一写入边界 |
| Membership／Binding 权威读取 Port | `all_exact` | Access Control application 组合入口持有数据库与 Repository，调用方只能消费 genuine Reader |
| 正式账号与 Session Owner | `all_exact` | Identity 持有 active-account Reader 与正式 Session；Session 只保存 selector，不成为授权事实源 |
| Scope 与 Scope revision Owner | `all_exact` | Tenancy application 组合入口持有 Scope 数据库与 Repository，Security 只消费 genuine Reader |
| Security 消费边界 | `all_exact` | 每次请求重读 Owner facts，只发布短生命周期、低敏、不可伪造引用与 Guard 结果 |
| 三个 revision 域 | `all_exact` | `membershipRevision`、`bindingRevision`、Scope `revision` 分别读取、比较和引用，互不替代 |
| 多 Membership 选择 | `all_exact` | 登录仅在完整 active Membership＋Binding tuple 精确为一条时成功；0 条拒绝，多条失败关闭 |
| 授权时间戳 fallback | `all_exact` | 生产授权链不读取 `tenant_members.updated_at`，也不存在 Membership 时间戳兼容映射 |
| Operating Context 排除 | `all_exact` | 正式授权组合只使用 Identity、Membership／Binding 与 Scope；Context Head／Version 未进入判定 |
| 第二授权事实源与 Owner 外 Writer | `all_exact` | genuine handle、Owner 内数据库组合与 AQ008 唯一写入 allowlist 共同阻断调用方伪造和旁路写入 |

## 3. Owner 与写入契约

### 3.1 Access Control

- `src/modules/access-control/domain/membership-lifecycle.ts` 的 `decideMembershipLifecycle` 负责 create、
  refresh、revoke、reactivate 与 delete 的 revision／lifecycle／provenance／transition 决策。
- `src/modules/access-control/ports/membership-command-unit-of-work.ts` 的
  `MembershipCommandUnitOfWork` 与 `MembershipCommandTransactionPort` 冻结 current、Binding 与 immutable
  transition 的同事务边界。
- `src/modules/access-control/application/membership-command-service.ts` 的
  `executeMembershipCommandWithUnitOfWork` 固定锁定、replay、CAS、Binding 动作与 evidence 顺序；
  Membership revision 与 Binding version 独立推进。
- `src/modules/access-control/server/membership-command-repository.ts` 是 AQ008 唯一内建 Membership
  direct-writer allowlist。当前 Owner 外 direct Membership Writer／Deleter 文件数与符号数为 `0／0`，
  allowlist 文件数为 `1`。

### 3.2 Identity、Tenancy 与 Security

- `src/modules/auth/application/authoritative-formal-session-identity-reader.ts` 由 Identity 自行固定数据库与
  Repository，只对外返回 genuine active-account Reader；用户、账号和正式 Session 所有权未被重开。
- `src/modules/tenancy/application/authoritative-institution-scope-reader.ts` 由 Tenancy 自行固定数据库与
  Repository，只对外返回 genuine Scope Reader；Scope、Context 与 Scope revision 原始事实仍由 Tenancy
  唯一拥有。
- `src/modules/security/server/institution-membership-provider.ts` 与
  `src/modules/security/server/institution-anchor-provider.ts` 只接收通过 nominal authenticity 校验的 Owner
  Reader，每次 `resolve` 重读 current fact，并只在完整引用均签发、验证成功后原子发布短生命周期证据。
- `src/modules/security/server/institution-scope-guard.ts` 只组合 provenance、Membership／Binding 和 Scope
  evidence；调用方不能提交 role、revision、Scope fact 或 allow 结果绕过 Owner Reader。

Access Control 与 Tenancy 的 Owner Reader 实现不依赖 Auth／Security 的事实实现。Access Control domain
复用 Auth 的角色共享词汇，但不反向读取 Identity／Session 事实。Auth／Security 的组合代码消费 Owner
Port 或 nominal application handle；Auth 对 Security domain 标识校验及引用 codec 的依赖不改变事实所有权，
也没有形成文件级循环、反向数据库／Repository 所有权或第二事实源。

## 4. Reader、Session 与 revision 契约

`src/modules/access-control/server/authoritative-membership-reader.ts` 只从显式 current envelope 与 active
Binding 读取：

- Membership：`revision`、`lifecycleStatus`、current provenance、revoke／delete 状态；
- Binding：`version`、status、source、assigned／expires／revoked 状态；
- 旧 `tenant_members.updated_at` 不在选择集，也不承担 revision fallback；
- 精确 selector 返回 0 条时拒绝、超过 1 条时 invalid；无 selector 的登录入口同样要求全账号范围内精确
  一个完整 active Membership＋Binding tuple。

`src/modules/auth/application/formal-institution-session-context.ts` 对登录与 Session 恢复执行：

```text
Identity I1
→ Membership／Binding M1
→ Scope S1
→ Membership／Binding M2
→ Scope S2
→ Identity I2
```

M1／M2 比较 Membership identity、explicit revision、lifecycle、Binding identity／version／期限等完整授权
事实；S1／S2 独立比较 Scope revision；I1／I2 独立比较 Identity fact。任何 selector、Owner fact、Provider
或 revision 漂移均返回 `stale`／`invalid`／`denied`／`unavailable`，不会发布 Session snapshot。

三个版本域保持独立：

1. Membership revision 只描述 canonical Membership lifecycle；
2. Binding version 只描述账号—机构 Binding lifecycle，不用 Membership revision 掩盖 rebind；
3. Scope revision 只描述 Tenancy Scope 原始事实。

Operating Context Head／Version 仅存在于 Tenancy provisioning 资产，未进入上述正式授权组合。

## 5. 防伪、低敏与失败关闭

- Access Control、Identity 与 Tenancy application 入口用模块私有 nominal handle 识别 genuine Reader；结构
  相同对象、Proxy、getter 或调用方注入 Repository／数据库不能提升为权威事实。
- Security 所有的 codec 按 Owner domain 签发 Membership、Binding 与 Scope 的低敏引用；Guard 只返回冻结的
  request-bound allow projection，不暴露数据库行、current provenance 正文或可复用授权事实。
- Membership／Binding／Scope 任一不存在、不完整、歧义、过期、撤销、非法来源或读失败时均 fail-closed。
- 当前第二套 Membership／Binding／Scope／Authorization current 事实源数量为 `0`；Operating Context
  进入授权组合为 `false`。

## 6. 测试与静态验证

本轮定向执行以下 10 个测试文件，共 `344／344` 通过：

- `src/modules/access-control/tests/MembershipCommandService.test.ts`
- `src/modules/access-control/tests/MembershipCommandRepository.test.ts`
- `src/modules/access-control/tests/MembershipCommandExternalTransaction.test.ts`
- `src/modules/access-control/tests/AuthoritativeMembershipReader.test.ts`
- `src/modules/auth/tests/FormalInstitutionSessionContext.test.ts`
- `src/modules/auth/tests/FormalServerSessionProvenanceOwner.test.ts`
- `src/modules/tenancy/tests/AuthoritativeInstitutionScopeReader.test.ts`
- `src/modules/security/tests/InstitutionMembershipProvider.test.ts`
- `src/modules/security/tests/InstitutionAnchorProvider.test.ts`
- `src/modules/security/tests/InstitutionScopeGuard.test.ts`

关键锁定包括：唯一 Owner 组合入口、CAS 与 replay、同事务 evidence、独立 Binding version、唯一登录
tuple、多 Membership fail-closed、显式 revision／lifecycle、I1→M1→S1→M2→S2→I2、每请求重读、
revision 漂移拒绝、genuine handle、防伪引用与低敏 Guard projection。AQ008 架构门禁继续只允许一个
Access Control Owner Repository 直接写 Membership，规则 exceptions 为空。

## 7. 结论与下一边界

最新 `main` 的 BASE-B1 契约为 `all_exact`，不需要为了关闭 B1 创建无意义 Runtime 改动。该结论只
准入单文件独立审查和后续 handoff；在 handoff 合并前不得把 BASE-B2 写成已启动或已完成。

```text
base_b1_owner_port_revision_contract=all_exact
base_b1_runtime_change_required=false
access_control_membership_binding_owner=single
identity_account_session_owner=single
tenancy_scope_revision_owner=single
membership_binding_scope_revision_domains=independent
owner_outside_direct_membership_writer_files=0
owner_outside_direct_membership_writer_symbols=0
authorization_tenant_members_updated_at_reads=0
authorization_membership_updated_at_compatibility_mappings=0
operating_context_in_authorization_combination=false
second_authorization_fact_source_count=0
multiple_membership_selection=explicit_or_fail_closed
base_b1_closure_evidence=passed
eligible_for_base_b1_independent_review=true
eligible_for_base_b1_handoff=false
eligible_for_base_b2=false
database_connection_count=0
runtime_change_count=0
schema_change_count=0
migration_change_count=0
```

BASE-B2 必须在独立 handoff 后另行实现 standalone Binding create／rebind／revoke／expire；它不得修改
historical orphan、Scope、A2-P2 FK 或业务 Reader，也不得建立第二套 Membership 或 Binding current。
