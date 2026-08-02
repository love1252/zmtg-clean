# BASE-02 Membership Revision M6 实施独立审查

## 1. 文档定位

- 审查日期：2026-08-02。
- 审查对象：PR #898。
- 实施 Base：`3c6884a1aefbfb2dd0a9177c811f6375aef6fe2b`。
- 冻结实施 Head：`e1cc9e4e97c18a80d3bf8ce55ed588b259898f19`。
- 实施 Merge Commit：`fe79267264f228cac217908365aa42f3f7408109`。
- 实施 Required Check：Run `30734941015`／Job `91461924228`，结论为成功。
- 审查范围：M6 authoritative Membership Reader、正式 Session 恢复／刷新和 Guard reference 切换。
- 本文只记录仓库静态独立审查，不是 M7、BASE-B1、数据库或发布授权。

## 2. 精确文件范围

实施提交保持单提交、42 文件，其中生产文件 24 个、测试文件 18 个。

### 2.1 生产文件（24）

1. `src/app/api/auth/login/route.ts`
2. `src/app/api/auth/session/route.ts`
3. `src/modules/access-control/application/authoritative-membership-reader.ts`
4. `src/modules/access-control/domain/membership-lifecycle.ts`
5. `src/modules/access-control/ports/authoritative-membership-reader.ts`
6. `src/modules/access-control/server/authoritative-membership-reader.ts`
7. `src/modules/auth/application/authoritative-formal-session-identity-reader.ts`
8. `src/modules/auth/application/formal-institution-session-context.ts`
9. `src/modules/auth/domain/auth-account.ts`
10. `src/modules/auth/ports/authoritative-formal-session-identity-reader.ts`
11. `src/modules/auth/server/auth-account-repository.ts`
12. `src/modules/auth/server/auth-account-service.ts`
13. `src/modules/auth/server/authoritative-formal-session-identity-reader.ts`
14. `src/modules/auth/server/formal-server-session-provenance-owner.ts`
15. `src/modules/institution/server/institution-server-runtime.ts`
16. `src/modules/institution/server/tenant-quota-enforcement.ts`
17. `src/modules/open-platform/server/tenant-account-management-repository.ts`
18. `src/modules/security/server/institution-anchor-provider.ts`
19. `src/modules/security/server/institution-anchor-repository.ts`
20. `src/modules/security/server/institution-membership-provider.ts`
21. `src/modules/security/server/institution-scope-guard.ts`
22. `src/modules/tenancy/application/authoritative-institution-scope-reader.ts`
23. `src/modules/tenancy/ports/authoritative-institution-scope-reader.ts`
24. `src/modules/tenancy/server/authoritative-institution-scope-reader.ts`

### 2.2 测试文件（18）

1. `src/modules/access-control/tests/AuthoritativeMembershipReader.test.ts`
2. `src/modules/auth/tests/AuthAccountRepository.test.ts`
3. `src/modules/auth/tests/AuthAccountService.test.ts`
4. `src/modules/auth/tests/AuthoritativeFormalSessionIdentityReader.test.ts`
5. `src/modules/auth/tests/FormalAuthRoutes.test.ts`
6. `src/modules/auth/tests/FormalInstitutionSessionContext.test.ts`
7. `src/modules/auth/tests/FormalServerSessionProvenanceOwner.test.ts`
8. `src/modules/institution-workbench/tests/HospitalWorkbenchEntry.test.tsx`
9. `src/modules/institution/tests/InstitutionServerRuntime.test.ts`
10. `src/modules/institution/tests/TenantQuotaEnforcement.test.ts`
11. `src/modules/open-platform/tests/TenantAccountManagementRepository.test.ts`
12. `src/modules/security/tests/InstitutionAnchorProvider.test.ts`
13. `src/modules/security/tests/InstitutionAnchorRepository.test.ts`
14. `src/modules/security/tests/InstitutionMembershipProvider.test.ts`
15. `src/modules/security/tests/InstitutionRequestAuthorization.test.ts`
16. `src/modules/security/tests/InstitutionScopeGuard.test.ts`
17. `src/modules/security/tests/InstitutionSectionGuard.test.ts`
18. `src/modules/tenancy/tests/AuthoritativeInstitutionScopeReader.test.ts`

冻结逻辑回归还覆盖 4 个未修改测试文件；连同新增支撑测试，精确 M6 矩阵共 22 文件、755 项测试。未修改的冻结逻辑文件不计入 PR 文件范围。

## 3. Owner 与依赖方向复核

| 事实域 | 唯一 Owner | M6 消费边界 | 审查结果 |
| --- | --- | --- | --- |
| 正式账号与 Session Identity | Identity | application genuine Reader | 通过 |
| Membership 与 Binding 生命周期 | Access Control | application genuine Reader | 通过 |
| Institution Scope 与 Scope revision | Tenancy | application genuine Reader | 通过 |
| Guard evidence | Security | 只消费上述 Owner Reader，不持久化原始事实 | 通过 |

Access Control Reader 显式提供 Membership identity、revision、lifecycle 与独立 Binding identity/version；没有把 Binding version 或 Scope revision 当作 Membership revision。Auth 已移除跨域 Membership／Binding Repository 查询，旧 Security Scope Repository 退役为空模块。未发现生产跨域直接绕过 Owner application Reader 的路径。

## 4. Session 与 Guard 链路复核

正式 Session 登录与恢复均按以下顺序形成稳定授权快照：

```text
Identity I1
→ Membership／Binding M1
→ Scope S1
→ Membership／Binding M2
→ Scope S2
→ Identity I2
```

审查确认：

- selector 与首轮 Membership 的 tenant／institution 不一致时立即返回 `invalid`，且不读取 Scope；
- Identity、Membership、Binding、Scope 任一身份、版本或生命周期漂移均失败关闭；
- non-active、password reset、locked、revoked、expired、Provider／Repository unavailable 均不能发布授权；
- 正式 Session cookie 只保留 provenance 与账号／租户／机构 selector，不持久化角色、Membership revision、Binding version 或 Scope revision；
- 每个受保护请求重新读取权威事实；Guard 对 Membership／Binding／Scope identity 与 revision 只传播不透明 reference，同时仅携带受控低敏 role、scope 与时效包络，不传播原始事实；
- 配额和平台租户账号两个次级 Reader 仅过滤 active Membership，不承担 Session／Guard 授权或建立第二套 current。

## 5. 兼容回退与越界复核

```text
authorization_tenant_members_updated_at_reads=0
authorization_membership_updated_at_compatibility_mappings=0
```

生产授权路径未发现 `tenantMembers.updatedAt`、`membershipUpdatedAt` 或 `membershipRevisionAt` 回退。实施 diff 中 Schema、Migration、journal、snapshot、数据库、CI、scripts、package 与 lock 修改均为 0；没有 M7 DDL／DML、historical orphan 处理、FK VALIDATE、BASE-B1 或项目业务 Reader／Capability 实现。

## 6. 验证证据

- M6 精确／支撑测试矩阵：22 文件、755/755 通过。
- selector 与首轮 Membership 不一致补充用例：目标文件 30/30 通过。
- `pnpm check:architecture:test`：通过。
- Base→Head 增量架构检查：通过。
- `pnpm lint`：通过。
- `pnpm typecheck`：通过。
- 完整测试：430 文件、6341/6341 通过。
- build：101/101，实际执行且未跳过。
- `git diff --check`：通过。
- PR #898 的真实 Required Check：Run `30734941015`／Job `91461924228` 对应冻结 Head，完整测试和 build 均实际成功；PR #898 已使用 Merge Commit 合并。

## 7. 独立结论

未发现 Owner 越界、授权事实泄漏、版本域串线、fail-open 或范围外实现。后续可独立增加 AQ import 规则，以机械限制底层 Reader 工厂引用范围；当前静态扫描未发现生产绕过，因此不阻断 M6。

```text
m6_implementation_review=passed
fresh_membership_reader_cutover=true
session_restore_refresh_reread=true
guard_reference_cutover=true
explicit_membership_revision_lifecycle_source=true
eligible_for_m6_merge=true
eligible_for_m7=false
```

PR #898 已在冻结 Head 和真实 Required Check 全部成功后使用 Merge Commit 合并。M7 必须等待本审查 PR Merge Commit 合并，并由独立 M6 handoff 冻结后才能启动。
