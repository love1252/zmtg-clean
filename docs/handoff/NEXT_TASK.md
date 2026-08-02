# 智美天工唯一下一任务

## 当前交接状态

BASE-02 Membership Revision M5 高水位追赶与冲突清零已完成实施、独立审查、一次受控执行、执行证据、
执行独立审查与 handoff：

- M5 实施 PR #893：Head `43440e3f38c3c6ba3576dba1788b3fad586cfb5a`，Run `30727616873`／Job `91442118293`，Merge Commit `72c7568df3fd1078b813733eda472c01b0f8672d`；
- M5 实施独立审查 PR #894：Head `14c7e6e4419203dacd5d20b3bec2b3d8bc43c285`，Run `30728269902`／Job `91443866416`，Merge Commit `33c52ee41e20385e8541594fa92b4c5c6ce21cf9`；
- M5 执行证据 PR #895：Head `53e7f1c0ad257fdff935d3ce1234be0054a19b34`，Run `30729433131`／Job `91446923309`，Merge Commit `804444789d135903a737bc0721c452bcc74511b5`；
- M5 执行独立审查 PR #896：Head `a768ddac965d42c96e59f2a2881a66961d9f3cf7`，Run `30729838933`／Job `91448020103`，Merge Commit `ea4a59df15fa14e64d7b7c5ad8a18b80452cc0c0`；
- Migration `0042` 已在固定 localhost-only local_acceptance 环境完成唯一授权 guarded 目标调用；仓库／环境 journal 为 `43／0042`，snapshot 保持 `0026`；
- 零候选结果为 `planned／created／reused／conflict／unexpected=0／0／0／0／0`；Membership total／all-null／partial／complete 保持 `1／0／0／1`，transition／exact current-head／M4 baseline 保持 `1／1／1`；
- 目标 guarded 调用为 `1`，直接 SQL、第二次目标调用和自动重试均为 `0`，执行结果已知；
- Allocation Lease 未消费且已释放；Execution Lease `claim／consume／renewal／release／active=1／1／0／1／0`；执行前后恢复点与隔离恢复通过，原目标 Restore 为 `0`；
- active historical orphan／Scope relation orphan 保持 `1／1`，A2-P2 Scope FK 保持 `NOT VALID`／`convalidated=false`；
- F01／F02 已由执行独立审查关闭；当前主动私有参数披露、真正敏感信息披露与非 localhost 连接均为 `0`；
- M5 交付不启动 M6、M7、BASE-B1～B6、orphan 修复、FK `VALIDATE`、项目级 Writer、Audit／模板、MIG-01B／C 或业务 Reader。

## 唯一下一任务

```text
BASE-02 Membership Revision M6 Reader 从 updated_at 切换到显式 revision＋lifecycle
```

仓库当前没有该任务的正式 `V2-*` 编号，本 handoff 不自行创造编号。

当前状态：**仅冻结且尚未启动；M5 handoff 合并后已由当前 ULTRA 用户指令授权继续**。

本任务中的 Reader 特指 Access Control Membership 授权事实 Reader、Formal Session 与 Guard 消费链，
不是项目级业务 Reader 或 Capability 放行。M6 只完成显式 Membership revision＋lifecycle 的读取切换、
逐请求 Fresh Membership／Binding／Scope 重读和 fail-closed 语义；不实施 M7 Enforce 或 BASE-B1～B6。

## 一、不得重开的 accepted 约束

1. `tenant_members` 继续是 Access Control 唯一 canonical Membership current；`tenant_membership_transitions` 只保存 append-only immutable evidence，不参与 current 判定。
2. Identity 拥有用户、账号和 Formal Session；Access Control 拥有 Membership／Binding 生命周期与 Fresh Membership；Tenancy 拥有 Scope／Context／Scope revision；Security 只提供通用安全能力和受控 Guard evidence。
3. Membership revision、Binding version 与 Scope revision 是三个独立版本域，不得互相替代或串线。
4. `updated_at`、Binding version、Scope revision、Session claim、hash／HMAC 或缓存均不得作为 Membership revision 或授权 fallback。
5. Formal Session 只保存 selector／provenance，不固化 role、lifecycle、Membership revision、Binding version、Scope revision 或其他授权事实。
6. 每次受保护请求必须重新读取 canonical Membership、active Binding 与 active Scope；request-bound evidence 只能由本次 fresh 读取形成。
7. lifecycle 非 `active`、stale／future revision、缺失／多候选 tenant、Provider 不可用、版本域冲突或证据不完整全部 fail-closed。
8. Operating Context Head／Version 不进入 M6 授权组合，不成为第四版本域或 Membership fallback。
9. M6 不接受新的查询优化索引，不创建第二套 current，不重开新 incarnation、Owner、P01～P12 或 M0→M7 顺序。

## 二、启动只读冻结

M5 handoff 合并后开始 M6 时，改文件前必须动态确认：

1. 最新 `main=origin/main`、工作树干净、分支保护与 Required Check 状态稳定；
2. M5 handoff 已合并，`base02_membership_revision_m5_execution_review=passed`、`m5_execution_complete=true`、`m5_handoff_complete=true`；
3. 仓库 journal 与 SQL 集合在最新 main 上实时核验为 current；固定环境 `43／0042` 只从已合并 M5 执行证据、独立审查与 handoff 交叉核对，不在 M6 重新连接数据库；`0040`、`0041`、`0042` 均已消费且不得改写；
4. Membership all-null／partial `0／0`、complete／transition／exact current-head `1／1／1`，以及 duplicate、identity mismatch、parent missing、conflict、unexpected 均为 `0`，只作为已合并 M5 证据链的继承门禁；
5. AQ008 Owner 外 direct Membership Writer／Deleter 仍为 `0／0`，唯一 Owner allowlist 为 `1`；
6. active historical orphan／Scope relation orphan `1／1` 与 Scope FK `NOT VALID` 只从已合并证据核对，M6 不重新探测或修改环境；
7. 当前 Auth、Access Control、Security、Institution 组合根、次级 Reader 和测试影响面能够完整枚举；
8. `tenantMembers.updatedAt`、`membershipUpdatedAt`、`membershipRevisionAt` 与相邻兼容语义的当前生产／测试命中已重新计数并分类；
9. 没有其他 Agent 写入、未解释 Git／代码漂移或需要数据库、Migration Lease、恢复点与环境执行的前置条件。

M6 是 Runtime／测试切片，不创建 Migration Lease，不连接数据库，不创建恢复点，也不执行 DDL、DML、
Migration、Seed、`db:generate` 或 snapshot 变更。若最新仓库证据不足以确认上述环境继承事实且必须实时
重探数据库，应立即停止 M6 并申请独立只读环境授权，不得在本 Runtime 切片内扩大范围。

## 三、当前候选影响面与精确冻结要求

最新已合并前置预检定位的生产候选为：

1. `src/modules/auth/server/auth-account-repository.ts`：Membership／Binding current 查询与 Formal Session 用户复核；
2. Access Control authoritative Membership Reader Port／Adapter：必须在 M6 启动冻结中从最新 main 选定精确文件，不得凭空建立第二事实源；
3. `src/modules/security/server/institution-membership-provider.ts`：Security 兼容桥与 request-bound Fresh Membership evidence；
4. `src/modules/institution/server/institution-server-runtime.ts`：服务端唯一组合根接线；
5. `src/modules/institution/server/tenant-quota-enforcement.ts`：次级 lifecycle-aware Reader；
6. `src/modules/open-platform/server/tenant-account-management-repository.ts`：次级 lifecycle-aware Reader。

受保护边界包括 Formal Session provenance owner、Institution Scope／Section／Action Guard、request
authorization、Anchor Reader／Provider 与 onboarding 外层事务。启动实现前必须重新形成精确文件
allowlist；上述目录或模块名称不构成整目录空白授权。若影响面无法完整解释，立即停止。

## 四、authoritative Reader 契约

- 输入必须具备明确 user selector 和显式 tenant selector；多 Membership 却无 tenant 选择必须拒绝；
- authoritative current 输出至少包含 Membership identity、严格正整数 `revision`、`lifecycleStatus` 与 `role`；
- 只允许 `active` Membership 形成 fresh 授权事实；`revoked`、`deleted`、未知或缺失状态全部拒绝；
- 查询必须直接读取 canonical current 的显式 revision／lifecycle 列，禁止从 `updated_at` 转换或双读回退；
- 只清除生产授权链的时间戳 fallback；通用 `tenant_members.updated_at` 审计时间列继续保留，不删除、不改写，也不赋予新授权语义；
- expected reference 与 current revision 不一致时，无论 stale 或 future 均 fail-closed；
- Provider／Repository 超时、不可用、返回多行、部分 Shape 或跨 tenant 冲突均 fail-closed；
- transition evidence 只可用于审计或一致性校验，不可替代 canonical current；
- Reader query 沿用当前连接 timeout，M6 不新增数据库对象或环境配置。

## 五、Formal Session、Binding、Scope 与 Guard

固定授权链为：

```text
Formal Session selector／provenance
→ Access Control Fresh active Membership + independent active Binding
→ Tenancy Fresh active Scope
→ request-bound scope／section／action authorization
```

- 登录、Session 恢复与刷新不能仅凭 Session claim、客户端 tenant／institution 或旧 Anchor 授权；
- 每次请求都重读 Membership、Binding 与 Scope，各自核对 identity、状态和独立版本域；
- Membership 变化只推进 Membership revision，Binding rebind 只推进 Binding version，Scope 变化只推进 Scope revision；
- request-bound evidence 不得跨请求缓存为新的授权事实；敏感授权事实不得进入 cookie、日志或公开响应；
- Security 兼容桥只消费 Access Control Port，不得直接成为 Membership Repository 或 Owner；
- M6 不放行业务对象 Reader、Capability 或七线正式发布。

## 六、次级 Reader

- staff seat 统计只计算 `active` Membership，不得把 revoked／deleted 或 legacy 时间戳存在性计为 active；
- 初始管理员查找必须识别 lifecycle，不能只以 Membership 行存在作为有效依据；
- 次级 Reader 不得建立独立 Membership current、私有生命周期枚举或 `updated_at` fallback；
- 次级 Reader 的行为变化必须与 authoritative Reader 的状态语义一致，但不得越权承担 Formal Session 或 Guard 授权。

## 七、测试与质量门禁

既有前置预检冻结 15 个核心链测试，并增加 2 个次级 Reader 测试：

- Auth：`AuthAccountRepository.test.ts`、`AuthAccountService.test.ts`、`FormalAuthRoutes.test.ts`、`FormalServerSessionProvenanceOwner.test.ts`；
- Security／Guard：`InstitutionMembershipProvider.test.ts`、`InstitutionGuardEvidence.test.ts`、`InstitutionGuardEvidenceBoundary.test.ts`、`InstitutionScopeGuard.test.ts`、`InstitutionSectionGuard.test.ts`、`InstitutionRequestAuthorization.test.ts`、`InstitutionAnchorProvider.test.ts`；
- Institution：`InstitutionServerRuntime.test.ts`、`HospitalWorkbenchEntry.test.tsx`、`InstitutionWorkbenchRuntime.test.ts`、`InstitutionRouteShell.test.tsx` 及 capability-off Route 边界；
- 次级：`TenantQuotaEnforcement.test.ts`、`TenantAccountManagementRepository.test.ts`。

M6 启动冻结必须将上列逻辑集合映射为最新 main 的精确路径和去重文件数，不能机械把描述中的测试族
当作文件数。定向测试至少覆盖：active 允许、revoked／deleted 拒绝、整数 revision、stale／future、
Provider unavailable、多 Membership 无 tenant、Binding／Scope 非 active、三个版本域独立、Session 不携带
授权事实、每请求重读、次级 Reader lifecycle 过滤，以及生产代码不再使用时间戳授权 fallback。

完整验证链必须包含定向测试、架构检查器自测、增量架构检查、lint、typecheck、完整测试、build 和
真实 Required Check；完整测试和 build 不得跳过。

M6 成功门必须同时满足：

```text
fresh_membership_reader_cutover=true
session_restore_refresh_reread=true
guard_reference_cutover=true
authorization_tenant_members_updated_at_reads=0
authorization_membership_updated_at_compatibility_mappings=0
explicit_membership_revision_lifecycle_source=true
```

上述归零仅针对生产授权链，不要求全仓通用 `updated_at` 字段或普通审计读取机械归零，也不表示业务
Reader 或 Capability 已放行。

## 八、未来交付链

M5 handoff 合并后按当前 ULTRA 授权执行的交付顺序为：

1. 最新 main 上完成 M6 精确符号、文件和测试影响面冻结；
2. 单一回退域 Draft Runtime／测试实施 PR；
3. 单文件独立审查 PR，冻结实施 Head、契约、影响面、测试与零越界；
4. 实施 PR Required Check 成功后 Ready 并使用 Merge Commit 合并；
5. 审查 PR 重放至最新 main，经新 Required Check 后 Ready 并使用 Merge Commit 合并；
6. M6 handoff PR；只在该 handoff 中冻结 M7，不夹带 M7 Schema／Migration。

上述链路已由当前 ULTRA 目标授权连续执行，但仍必须逐项通过动态冻结、精确文件范围、独立审查和
Required Check 硬门；不得以 ULTRA 授权绕过 Owner、Session、版本域或 fail-closed 约束。

## 九、失败与 forward-fix

- 实施合并前失败：保持新 Reader 切换未发生，既有兼容读取继续按当前边界保留；修正同一回退域后重新验证；
- 新 Reader 发现问题：关闭新入口并使用独立 forward-fix，不恢复 `updated_at` 授权 fallback；
- Provider／依赖不可用：保持 fail-closed，不以 Session claim、缓存、Demo 或 Mock 兜底；
- 已消费 Migration `0040`～`0042` 不得因 Reader 问题改写；M6 不创建补偿 Migration；
- 任何版本域串线、授权事实泄漏或 Owner 越界都必须回到独立审查，不得用测试例外掩盖。

## 十、真正硬停止

- M5 handoff、journal、Membership current／transition、AQ008、orphan 或 Scope FK 出现未解释漂移；
- 无法删除授权语义中的 `updated_at` fallback，或仍把时间戳、Binding／Scope revision 当 Membership revision；
- authoritative Reader 无法返回显式 identity／revision／lifecycle／role，或需要第二套 Membership current；
- lifecycle 非 active、stale／future revision、Provider 不可用、缺失／多候选 tenant 无法 fail-closed；
- Formal Session 必须固化授权事实，或请求链无法逐请求重读 Membership／Binding／Scope；
- Membership／Binding／Scope 三个版本域串线，或 Identity／Access Control／Tenancy／Security Owner 被重开；
- 15 个核心链＋2 个次级 Reader 的影响面无法完整解释；
- 需要 Schema、Migration、journal、snapshot、Lease、数据库、orphan 修复、FK `VALIDATE`、M7、BASE-B1、项目级 Writer、Audit／模板、MIG-01B／C 或业务 Reader；
- Required Check 需要绕过、出现敏感信息泄漏、其他 Agent 写入或 Git 状态无法安全恢复。

## 十一、持续阻断

- M7 Enforce 尚未启动；M6 未完成前不得进入 M7；
- BASE-B1～B6 尚未启动；M7 完成前不得宣称 BASE-B1 Runtime 关闭；
- active historical orphan／Scope relation orphan 保持 `1／1`，未授权修复；
- A2-P2 Scope FK 保持 `NOT VALID／convalidated=false`，未执行 `VALIDATE`；
- 项目级 Writer、Audit／模板、MIG-01B、MIG-01C 与业务 Reader继续阻断；
- 正式平台服务端授权根仍是独立缺口，七线正式发布继续为 `0/7`。

```text
next_task=BASE-02 Membership Revision M6 Reader 从 updated_at 切换到显式 revision＋lifecycle
next_task_started=false
next_task_authorized_under_ultra=true
m5_complete=true
m5_handoff_complete=true
eligible_for_m6_after_handoff=true
m6_started=false
m6_authorized_under_ultra=true
m7_started=false
eligible_for_base_b1_runtime=false
eligible_for_reader=false
```
