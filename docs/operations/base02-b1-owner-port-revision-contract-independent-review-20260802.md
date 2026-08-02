# BASE-B1 Owner／Port／revision 契约独立审查

- 状态：`current evidence + independent review`
- 日期：`2026-08-02 CST +0800`
- 审查基线：`e01f62a2c413cb563c1ac3433f5cbac684147503`
- 被审查 PR：#910
- 被审查 Head：`5fc7234daf6dd67fcaea72747a859aa081621b58`
- Required Check：Run `30743380150`／Job `91484669720`，`success`
- Merge Commit：`e01f62a2c413cb563c1ac3433f5cbac684147503`
- 被审查文件：`docs/operations/base02-b1-owner-port-revision-contract-closure-20260802.md`

## 1. 审查定位

本审查从 PR #910 合并后的最新 `main` 独立核对证据文档、真实代码符号、依赖方向、测试和架构
门禁。审查没有修改或重跑被审查提交，没有连接数据库，也没有读取凭证或环境参数。

审查目标不是为 BASE-B1 创造 Runtime，而是确认“现有契约已经 `all_exact`、无需无意义改动”的证据
是否完整、可重复定位且没有越过 BASE-B2～B6 边界。

## 2. 文件范围与证据归因

- PR #910 相对 Base `af58246675787536b6439404582d0b320ab4eba8` 精确为一个提交、一个新增
  operations Markdown。
- Runtime、Schema、Migration、journal、snapshot、数据库、scripts、tests、CI、package 与 lock
  修改均为 `0`。
- 文档中的 current 结论均指向仓库路径、真实导出符号或测试；`decideMembershipLifecycle`、Security
  codec 所有权和 Access Control 复用 Auth 角色共享词汇的表述与代码一致。
- PR #910 的真实 Required Check 已执行环境核对、依赖安装、架构自测、增量检查、lint、typecheck、
  完整测试和 build，全部成功，完整测试与 build 未跳过。

## 3. Owner 与单一事实源复核

### 3.1 Access Control

以下链路形成唯一 Membership／Binding 写入所有权：

```text
membership-lifecycle.ts::decideMembershipLifecycle
→ membership-command-unit-of-work.ts::MembershipCommandUnitOfWork
→ membership-command-service.ts::executeMembershipCommandWithUnitOfWork
→ membership-command-repository.ts
```

Repository 在一个事务内锁定 current、执行 replay／CAS、处理 Membership 关联 Binding 动作并追加
immutable transition。AQ008 的唯一 direct-writer allowlist 仍只有该 Repository，配置 exceptions 为 `0`；
Owner 外 direct Membership Writer／Deleter 为 `0／0`。

Access Control domain 对 Auth 的引用仅复用角色共享词汇，不读取 Identity／Session current、Repository 或
数据库，没有形成事实所有权反转、文件级循环或第二套 current。

### 3.2 Identity、Tenancy 与 Security

- Identity application 组合入口持有 active-account 数据库与 Repository，并以 nominal handle 发布 genuine
  Reader；正式 Session 只保存 selector 与一次性消费 snapshot，不成为授权事实源。
- Tenancy application 组合入口持有 Scope 数据库与 Repository，并以 nominal handle 发布 genuine Reader；
  Scope revision 不由 Security 或 Access Control 写入。
- Security 只消费 Identity、Access Control、Tenancy 的 genuine Reader。Security 所有的 codec 按 Owner
  domain 签发短生命周期低敏引用，Guard 不接收调用方自报的事实或 allow 结果。

未发现跨 Owner Repository／数据库直读、第二套 Membership／Binding／Scope current 或调用方事实提升
路径。

## 4. revision、读取顺序与失败关闭复核

- `membershipRevision` 来自 `tenant_members.revision`，与 lifecycle／current provenance 一起验证；
- `bindingRevision` 来自 active Binding 的 `version`，不替代 Membership revision；
- Scope `revision` 由 Tenancy authoritative Reader 独立读取；
- `tenant_members.updated_at` 不在生产授权 Reader 选择集，授权时间戳 fallback 与兼容映射为 `0／0`；
- Context Head／Version 没有进入正式授权组合。

正式登录／Session 恢复按 `I1→M1→S1→M2→S2→I2` 重读。Membership／Binding、Scope 或 Identity
在两次读取间发生任何 identity、lifecycle、revision、expiry 或 Provider 漂移时均失败关闭。无 selector 的
登录入口只有在全账号范围内精确存在一个完整 active Membership＋Binding tuple 时成功，多 Membership
不会被隐式选择。

## 5. 测试与门禁复核

PR #910 交付前的 B1 定向矩阵覆盖 10 个文件、`344／344`：

- command domain／service／Repository／external transaction；
- authoritative Membership／Binding 与 Scope Reader；
- Formal Session／provenance Owner；
- Membership、Anchor Provider 与 Scope Guard。

独立核对确认这些测试锁定 CAS、replay、同事务 evidence、三个独立 revision 域、genuine handle、双重
读取、歧义拒绝、漂移拒绝和低敏 projection。架构检查器自测为 `125／125`，AQ008 rules exceptions
保持为空。

## 6. 排除范围

本审查没有把以下事项写成 B1 已具备：

- standalone Binding create／rebind／revoke／expire；
- historical orphan 归属处置或 Scope 创建；
- A2-P2 Scope FK `VALIDATE`；
- object Guard、Action Policy 或业务 Owner Adapter；
- 项目级 Writer／Audit／MIG-01B／C；
- 业务 Reader／Capability 放行。

因此，B1 关闭不等于 BASE-02 完成，也不改变 active historical orphan／Scope relation orphan `1／1`、
Scope FK `NOT VALID` 或 Reader 阻断状态。

## 7. 独立结论

PR #910 的证据归因、Owner 边界、Port authenticity、三个 revision 域、双重读取与失败关闭结论均可由
最新 `main` 重复定位；未发现阻断 B1 handoff 的冲突。

```text
base_b1_independent_review=passed
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
eligible_for_base_b1_handoff=true
eligible_for_base_b2=false
eligible_for_business_reader=false
runtime_change_count=0
schema_change_count=0
migration_change_count=0
database_connection_count=0
```

只有 BASE-B1 handoff 合并并在最新 `main` 再次确认无漂移后，才可把 BASE-B2 冻结为唯一下一任务；
本审查本身不启动 BASE-B2。
