# 租户正式账号闭环阶段 B 实施计划

> **面向 agentic worker 的要求：** 本文是阶段 B 的可审批实施计划，不是 schema、migration 或 runtime 实施授权。真正修改 `src/**`、`drizzle/**`、数据库、登录逻辑、账号服务或测试服数据前，必须先获得用户明确确认：`确认进入阶段 B schema/migration 实施`。

**目标：** 将平台端「租户管理」从“记录开通快照”升级为“真实机构录入与可登录账号闭环”，确保新建租户时录入的机构、联系人、手机号、邮箱、初始管理员、管理员账号、套餐和试用周期在数据库、授权快照、列表、详情、审计和登录链路中保持一致。

**架构：** 阶段 A 已在无 schema 情况下从 `snapshot_json.openingContact` 修复展示断链。阶段 B 需要新增正式账号与联系人持久化模型，用后端事务把租户、联系人、管理员账号、租户成员、套餐分配、授权快照和审计记录一次性写入；登录从静态演示账号迁移为数据库账号校验，同时保留受控的本地演示开关。

**技术栈：** Next.js、React、TypeScript、PostgreSQL、Drizzle、Vitest、pnpm、测试服务器发布脚本。

---

## 一、当前基线

- 日期：`2026-06-25`
- 时区：CST
- 当前分支：`codex/tenant-formal-intake-loop`
- 当前 HEAD：`4e9e3520bdba6558b6bb8f1bd2cf1b851597174d`
- `origin/main`：`f08e7a1b297397fdda8ef65e614b5cf91c486749`
- 当前阶段：阶段 B 方案固化。
- 本轮不是：schema 修改、migration 实施、数据库迁移、真实登录替换、账号创建 runtime、测试服数据写入、真实短信或邮件通知。

## 二、阶段 A 已完成能力

阶段 A 已经解决无 schema 范围内的展示断链：

- 租户列表和详情从授权快照读取 `openingContact`。
- 去除了详情页硬编码联系人占位。
- 试用版展示开始时间、截止时间和剩余天数。
- 普通审计和授权快照继续只展示业务摘要，不展示密码、请求体、SQL 或服务端内部细节。
- 已完成本地测试、lint、build，并同步到测试服务器。

阶段 A 的限制也很明确：`openingContact` 仍然是授权快照里的开通摘要，不是正式联系人表；管理员账号也没有进入真实认证模型。

## 三、现有代码约束

当前项目已有以下基础：

- `src/server/db/schema.ts` 中已有 `tenants`、`tenant_members`、`tenant_plan_assignments`、`tenant_authorization_snapshots`、`audit_events`。
- `tenant_members` 当前只有 `tenantId`、`userId`、`role`、`displayName`，不能代表真实登录账号。
- `src/modules/auth/server/demo-session.ts` 使用静态演示账号和明文演示密码，只适合本地或演示模式。
- `src/app/api/auth/login/route.ts` 当前只调用演示登录。
- `audit_events` 当前只保存审计摘要字段，没有请求体、SQL、密码或服务端错误详情字段，这一点应继续保持。

这些约束决定阶段 B 不能只补 UI；必须先补账号数据模型、密码哈希、登录读取和事务创建。

## 四、目标边界

阶段 B 必须完成：

1. 机构联系人和初始管理员有正式持久化位置。
2. 手机号和邮箱可以完整保存，但普通列表和详情默认按脱敏或权限规则展示。
3. 密码只保存哈希，不保存明文，不写入审计，不写入授权快照。
4. 新建租户后生成可登录的初始管理员账号。
5. 登录态进入对应租户，`tenantId`、角色和用户名来自数据库。
6. 试用版按创建时间生成 10 天体验周期，并保存明确截止时间。
7. 租户列表、详情、授权快照和审计显示同一份业务事实。
8. 支持账号启用、停用、要求重置密码和审计追踪。
9. 本地 migration、测试、lint、build 和测试服 migration 均通过。

阶段 B 不做：

- 不接真实短信、邮件、企微或外部身份源。
- 不保存、展示或回放明文密码。
- 不展示请求体、SQL、服务端堆栈、数据库连接串或密钥。
- 不做真实计费、合同、发票、支付或后付费。
- 不做真实 HIS 对接。
- 不自动清理生产或测试服旧数据，除非用户单独批准数据运维任务。

## 五、推荐数据模型

### 5.1 新增账号状态枚举

建议新增 `auth_account_status`：

| 值 | 含义 |
| --- | --- |
| `active` | 可正常登录 |
| `password_reset_required` | 首次登录或重置后必须改密 |
| `disabled` | 平台停用，不可登录 |
| `locked` | 多次失败后暂时锁定 |

### 5.2 新增正式账号表

建议新增 `auth_users`，作为登录账号事实来源：

| 字段 | 类型建议 | 说明 |
| --- | --- | --- |
| `id` | `varchar(96)` | 主键，服务端生成 |
| `username` | `varchar(96)` | 登录账号，唯一 |
| `display_name` | `varchar(120)` | 显示名称 |
| `phone` | `varchar(32)` | 完整手机号，受权限保护 |
| `email` | `varchar(160)` | 完整邮箱，受权限保护 |
| `password_hash` | `text` | 密码哈希字符串 |
| `password_updated_at` | `timestamp with time zone` | 密码更新时间 |
| `password_reset_required` | `boolean` | 是否要求改密 |
| `status` | `auth_account_status` | 账号状态 |
| `last_login_at` | `timestamp with time zone` | 最近成功登录时间 |
| `failed_login_count` | `integer` | 连续失败次数 |
| `locked_until` | `timestamp with time zone` | 锁定截止时间 |
| `created_by` | `varchar(96)` | 创建人 |
| `updated_by` | `varchar(96)` | 更新人 |
| `created_at`、`updated_at` | `timestamp with time zone` | 通用时间戳 |

索引建议：

- `auth_users_username_unique_idx`：唯一索引。
- `auth_users_phone_idx`：普通索引，用于平台检索。
- `auth_users_email_idx`：普通索引，用于平台检索。
- `auth_users_status_idx`：状态查询索引。

手机号和邮箱不建议一开始做全局唯一，因为后续可能出现同一个负责人管理多个机构的情况。登录账号 `username` 必须唯一。

### 5.3 新增租户联系人表

建议新增 `tenant_contacts`，把业务联系人和登录账号解耦：

| 字段 | 类型建议 | 说明 |
| --- | --- | --- |
| `id` | `varchar(64)` | 主键 |
| `tenant_id` | `varchar(64)` | 关联租户 |
| `contact_name` | `varchar(120)` | 联系人姓名 |
| `contact_phone` | `varchar(32)` | 完整手机号 |
| `contact_email` | `varchar(160)` | 完整邮箱 |
| `initial_admin_user_id` | `varchar(96)` | 初始管理员账号 |
| `created_by` | `varchar(96)` | 创建人 |
| `updated_by` | `varchar(96)` | 更新人 |
| `created_at`、`updated_at` | `timestamp with time zone` | 通用时间戳 |

索引建议：

- `tenant_contacts_tenant_unique_idx`：每个租户一条主联系人记录。
- `tenant_contacts_admin_user_idx`：按初始管理员追踪。

这张表解决用户指出的问题：创建时填了陈磊和手机号，详情页就必须能显示同一份事实，而不是从占位或随机数据中拼出来。

### 5.4 扩展租户成员关系

现有 `tenant_members` 应继续表示“账号在某个租户内的成员身份和角色”。阶段 B 建议只做最小扩展：

- 给 `tenant_members.user_id` 增加对 `auth_users.id` 的外键。
- 保持 `tenant_members.tenant_id + tenant_members.user_id` 唯一。
- 保持 `role` 使用现有 `auth_role`。

不建议把手机号、邮箱、密码放进 `tenant_members`，否则同一个账号跨租户时会出现多份身份事实。

### 5.5 扩展租户状态

现有 `tenant_status` 只有 `active` 和 `suspended`。阶段 B 建议新增：

| 值 | 含义 |
| --- | --- |
| `trialing` | 试用中 |
| `expired` | 已过期 |

如果不希望阶段 B 扩展租户状态，也可以继续用 `tenant_plan_assignments.expires_at` 判断试用状态，但 UI 和筛选会不够直接。推荐扩展状态，便于租户列表表达商业试用阶段。

## 六、密码与敏感信息策略

密码策略必须满足：

- 创建时可以让平台管理员输入临时密码或服务端生成一次性临时密码。
- 数据库只保存 `password_hash`。
- 审计只记录“初始账号已创建”“密码已重置”，不记录密码原文、哈希、请求体。
- 登录失败审计只记录账号、范围、结果和摘要原因，不记录输入密码。
- 普通租户详情默认不展示完整手机号和邮箱；平台管理员可在详情页看到完整字段，安全审计员可看审计摘要。

哈希建议：

- 如果不新增依赖，使用 Node.js `crypto.scrypt`，保存格式为 `scrypt$N$r$p$salt$hash`。
- 如果允许新增依赖，可选择 `argon2`，但这会引入 package 和 lockfile 改动，必须在实施计划中单独说明。

推荐第一轮使用 `crypto.scrypt`，减少依赖和部署风险。

## 七、后端事务链路

新建租户必须由一个 service 在单个数据库事务中完成：

1. 校验平台操作者权限。
2. 校验机构名称、联系人、手机号、邮箱、管理员账号和套餐。
3. 如果选择试用版，以服务端当前时间作为开始时间，截止时间为开始时间加 10 天。
4. 写入 `tenants`。
5. 写入 `auth_users`。
6. 写入 `tenant_members`，角色为 `tenant_admin`。
7. 写入 `tenant_contacts`。
8. 写入 `tenant_plan_assignments`。
9. 写入 `tenant_authorization_snapshots`，其中 `snapshot_json.openingContact` 继续保留脱敏业务摘要，用于兼容阶段 A。
10. 写入 `audit_events`，原因建议为 `tenant_created` 或新增 `tenant_account_created`。
11. 返回低敏 DTO：不含 `password_hash`、不含明文密码、不含请求体。

任何一步失败都必须回滚，不留下半租户、半账号或孤儿成员。

## 八、登录替换策略

阶段 B 不应一次性删除演示登录，而应增加正式认证优先级：

1. `/api/auth/login` 先尝试数据库账号认证。
2. 找不到账号或正式认证关闭时，再按环境变量判断是否允许演示登录。
3. 生产和测试服务器默认应关闭演示登录，除非用户明确打开受控演示开关。
4. 登录成功后沿用现有 session cookie 形状，避免一次性改动所有机构端页面。
5. session 中的 `id`、`username`、`name`、`role`、`tenantId` 来自 `auth_users + tenant_members`。

登录成功后需要更新：

- `auth_users.last_login_at`
- `auth_users.failed_login_count = 0`
- 登录成功审计摘要

登录失败后需要更新：

- `auth_users.failed_login_count`
- 达到阈值后设置 `locked_until`
- 登录失败审计摘要

## 九、审计口径

建议扩展审计原因枚举或稳定原因值：

| 原因值 | 含义 |
| --- | --- |
| `tenant_created` | 租户创建 |
| `tenant_account_created` | 初始管理员账号创建 |
| `tenant_account_password_reset` | 密码重置 |
| `tenant_account_disabled` | 账号停用 |
| `tenant_account_enabled` | 账号启用 |
| `tenant_login_succeeded` | 租户账号登录成功 |
| `tenant_login_failed` | 租户账号登录失败 |
| `tenant_trial_expired` | 试用到期 |

审计记录只保留：

- 操作者
- 操作者角色
- 租户
- 资源类型
- 资源 ID
- 操作
- 结果
- 原因
- 时间
- 来源

审计记录不保留：

- 明文密码
- 密码哈希
- 完整请求体
- SQL
- 服务端堆栈
- 数据库错误详情
- 密钥或环境变量

## 十、前端改造目标

阶段 B 的 UI 目标不是重新设计租户管理，而是让现有录入成为真实闭环：

- 新建租户表单必须包含完整联系人、手机号、邮箱、初始管理员、管理员账号和试用周期。
- 选择试用版时显示“体验周期 10 天”和具体截止时间。
- 提交确认页展示业务摘要，不展示密码、请求体、SQL 或服务端细节。
- 租户列表显示联系人和套餐状态，手机号按权限脱敏。
- 租户详情展示正式联系人、管理员账号、套餐有效期和账号状态。
- 账号管理入口支持启用、停用、重置密码，所有操作走服务端 API 和审计。

## 十一、建议文件拆分

### PR B1：schema/migration

需修改：

- `src/server/db/schema.ts`
- `drizzle/0020_tenant_formal_accounts.sql`
- `drizzle/meta/_journal.json`
- `drizzle/meta/*_snapshot.json` 中由 Drizzle 生成或更新的对应快照文件

需新增或修改测试：

- `src/server/db/tests/Schema.test.ts`
- 账号 schema 相关测试文件，按现有测试目录实际命名。

验收：

- 本地 migration 可应用。
- `tenant_contacts`、`auth_users`、`tenant_members` 外键和索引符合计划。
- 回滚策略明确：测试服可通过备份回滚数据库。

### PR B2：账号领域与密码服务

建议新增：

- `src/modules/auth/domain/auth-account.ts`
- `src/modules/auth/server/password-hash.ts`
- `src/modules/auth/server/auth-account-repository.ts`
- `src/modules/auth/server/auth-account-service.ts`

建议测试：

- `src/modules/auth/tests/AuthAccountDomain.test.ts`
- `src/modules/auth/tests/PasswordHash.test.ts`
- `src/modules/auth/tests/AuthAccountRepository.test.ts`
- `src/modules/auth/tests/AuthAccountService.test.ts`

验收：

- 密码哈希可验证正确密码，拒绝错误密码。
- 哈希结果每次带盐，不等于明文。
- 账号停用、锁定、要求改密都有明确 domain 判断。

### PR B3：真实租户创建事务

需修改：

- `src/modules/open-platform/domain/tenant-plan-binding.ts`
- `src/modules/open-platform/server/tenant-plan-binding-service.ts`
- `src/modules/open-platform/server/tenant-plan-binding-repository.ts`
- `src/app/api/v1/open-platform/tenants/route.ts`
- `src/app/api/open-platform/tenants/route.ts`

建议测试：

- `src/modules/open-platform/tests/TenantPlanBindingDomain.test.ts`
- `src/modules/open-platform/tests/TenantPlanBindingService.test.ts`
- `src/modules/open-platform/tests/TenantPlanBindingRepository.test.ts`
- `src/modules/open-platform/tests/TenantPlanBindingApiRoute.test.ts`

验收：

- 创建租户会一次性写入租户、联系人、管理员账号、成员、套餐分配、授权快照和审计。
- 试用版有效期为创建时间加 10 天。
- 任意写入失败时事务回滚。
- 返回 DTO 不含密码、密码哈希、请求体或 SQL。

### PR B4：正式登录接入

需修改：

- `src/app/api/auth/login/route.ts`
- `src/app/api/auth/session/route.ts`
- `src/modules/auth/server/demo-session.ts`
- `src/modules/security/server/access-context.ts`
- `src/modules/auth/domain/session.ts`

建议测试：

- `src/modules/auth/tests/DemoAuthRoutes.test.ts`
- `src/modules/auth/tests/AuthSessionDomain.test.ts`
- `src/modules/security/tests/AccessContext.test.ts`

验收：

- 数据库账号可登录对应租户。
- 错误密码不能登录。
- 停用账号不能登录。
- 演示账号只在受控环境变量允许时可用。
- session 中的租户和角色来自正式账号关系。

### PR B5：租户管理 UI 与账号操作

需修改：

- `src/modules/open-platform/components/OpenPlatformTenantManagementPanel.tsx`
- `src/modules/open-platform/client/platform-tenant-management-client.ts`
- `src/modules/open-platform/domain/tenant-management.ts`
- `src/modules/open-platform/domain/tenant-management-view.ts`

建议测试：

- `src/modules/open-platform/tests/OpenPlatformTenantManagementPanel.test.tsx`
- `src/modules/open-platform/tests/OpenPlatformTenantManagementDomain.test.ts`
- `src/modules/open-platform/tests/OpenPlatformTenantManagementApiRoute.test.ts`

验收：

- 新建租户后列表和详情展示录入联系人，而不是占位或随机值。
- 试用版显示具体开始时间、截止时间和剩余天数。
- 账号启用、停用、重置密码入口走 API 并产生审计。
- 普通审计不展示敏感明细。

## 十二、实施顺序

1. 先做 PR B1，只落 schema/migration，完成本地迁移验证。
2. 再做 PR B2，建立账号和密码服务，不接 UI。
3. 再做 PR B3，让租户创建事务写入正式账号和联系人。
4. 再做 PR B4，把登录切到数据库账号优先。
5. 最后做 PR B5，完善平台端 UI 和账号操作。
6. 每个 PR 独立测试、lint、build；涉及测试服的 PR 独立部署和验证。

不建议把 B1 到 B5 合成一个 PR。阶段 B 涉及数据库、认证、安全审计和 UI，一次性合并会让回滚和审查都变困难。

## 十三、测试矩阵

每个 runtime PR 至少执行：

```bash
pnpm test
pnpm lint
pnpm build
```

阶段 B 关键专项测试：

| 场景 | 预期 |
| --- | --- |
| 新建试用租户 | 有效期为服务端当前时间加 10 天 |
| 新建基础版租户 | 无试用倒计时，套餐状态正常 |
| 新建租户失败 | 事务回滚，无孤儿账号或成员 |
| 数据库账号登录 | session 绑定正确租户 |
| 错误密码登录 | 返回失败，不泄露具体原因 |
| 停用账号登录 | 返回失败，写入审计摘要 |
| 重置密码 | 只更新哈希和重置状态 |
| 审计查询 | 不出现密码、请求体、SQL、服务端堆栈 |

## 十四、测试服验证

进入测试服前置：

- schema/migration 已本地验证。
- 已备份测试服数据库。
- 已确认代理端口使用 `127.0.0.1:7897`。
- 已确认测试服可以接受账号体系变更。

测试服验收：

- `/open-platform` 租户管理能创建真实试用租户。
- 创建后列表、详情、授权快照展示同一联系人和管理员账号。
- 新账号能登录机构端。
- 试用版截止时间为创建时间加 10 天。
- 测试服审计只有业务摘要，没有密码、请求体、SQL 或服务端内部错误。

## 十五、回滚策略

代码回滚：

- 每个 PR 单独提交。
- 测试服 release 可回滚到上一稳定 commit。

数据库回滚：

- 阶段 B 首个 migration 前必须备份。
- 如果 B1 migration 失败，停止后续 PR，按备份恢复。
- 如果 B3 或 B4 失败，禁止手动删除半成品数据，优先用事务保障；若已进入测试服，以备份和审计记录为准恢复。

业务回滚：

- 若正式登录异常，可临时恢复上一 release。
- 不建议在正式账号表上线后重新打开演示账号作为常规入口；演示登录只能作为本地开发兜底。

## 十六、用户确认门槛

进入实施前，用户至少需要确认：

1. 是否同意新增 `auth_users` 和 `tenant_contacts`。
2. 是否同意扩展 `tenant_status` 为 `trialing`、`expired`。
3. 是否同意用 Node.js `crypto.scrypt` 做第一版密码哈希。
4. 是否同意试用版统一按创建时间加 10 天计算。
5. 是否同意测试服执行 schema migration，并在执行前备份数据库。

建议用户确认口径：

```text
确认进入阶段 B schema/migration 实施，同意新增 auth_users、tenant_contacts，试用期按 10 天计算，密码使用 scrypt 哈希，先做本地迁移验证。
```
