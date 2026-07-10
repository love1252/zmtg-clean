# V0.8-04F-EB 企业微信低敏联系人与客户档案人工映射完整闭环

日期 / 时区：2026-07-10 CST +0800

任务编号：`V0.8-04F-EB-CUSTOMER-MAPPING-CLOSED-LOOP-01`

## 范围

本任务在 4F-EA 已有数据基础上完成企业微信低敏联系人与本机构客户档案的人工映射闭环：domain 状态机、repository 并发保护、service、GET / POST API、低敏 audit、现有 customer timeline 聚合验证，以及 AI 会话工作台右侧 ProfilePanel 紧凑模块。

本任务不自动匹配，不创建或合并客户，不调用真实企业微信，不真实出网，不读取敏感配置。

## 固定低敏 proof

只使用以下固定值：

- `proofContactId = live-contact-proof-01`
- `proofEmployeeId = live-employee-proof-01`
- `sourceMode = real_readonly_proof`

不读取或持久化企业微信原始外部联系人标识、员工标识、企业主体标识、凭证、原始响应、姓名、手机号或微信号。

## 状态模型

对外状态：

- `unreviewed`：数据库无记录
- `confirmed`
- `rejected`
- `revoked`

domain 状态机完整覆盖 confirm / reject / revoke：

- `unreviewed` 可 confirm 或 reject，不能 revoke。
- `confirmed` 对同客户 confirm 幂等，对其他客户 confirm 冲突；仅可对同客户 revoke。
- `rejected` 可对有效候选 confirm；同客户 reject 幂等；其他 reject 和 revoke 无效。
- `revoked` 可对有效候选 confirm 或 reject；同客户 revoke 幂等，其他客户 revoke 无效。
- 失败决策不生成可持久化状态。

## API 契约

### GET `/api/institution/wecom-customer-mapping`

需要登录、`customer/read` 权限以及可信会话中的 `tenantId`、`institutionId`。

响应：

```json
{
  "mapping": {
    "proofContactId": "live-contact-proof-01",
    "proofEmployeeId": "live-employee-proof-01",
    "sourceMode": "real_readonly_proof",
    "status": "unreviewed",
    "customerId": null
  },
  "candidates": [],
  "currentCustomer": null,
  "canWrite": false
}
```

候选最多 20 条，由 repository 按客户 ID 稳定升序，只返回：

- `customerId`
- `displayName`
- `maskedPhone`
- `maskedMedicalRecordNo`
- `lifecycle`
- `priority`

当前映射客户不在前 20 条时，使用同一 tenant + institution 归属检查后单独返回 `currentCustomer` 低敏摘要。

### POST `/api/institution/wecom-customer-mapping`

需要登录和 `customer/update` 权限。`tenant_admin` 可写，`tenant_operator` 等只读角色返回 403。请求体上限 512 bytes，且严格只允许三个字段：

```json
{
  "action": "confirm",
  "proofContactId": "live-contact-proof-01",
  "customerId": "customer-a"
}
```

`action` 只允许 `confirm`、`reject`、`revoke`；`proofContactId` 必须等于固定值。

客户通过 `getCustomerByTenantAndInstitution` 验证。不存在、同租户其他机构或机构归属为空的客户统一返回：

```json
{
  "code": "customer_not_found",
  "error": "客户不存在或不属于当前机构"
}
```

状态冲突返回 409 `conflict`，非法转换返回 409 `invalid_transition`，不会覆盖原状态。

## 并发保护

- 新建记录使用 `createIfAbsent` 和 `onConflictDoNothing`，唯一键竞争时返回 `null`。
- 更新同时绑定 `tenantId + institutionId + proofContactId + expectedCustomerId + expectedStatus`。
- create-if-absent 竞争失败或 expectedStatus stale update 统一返回 conflict，不覆盖并发写入。

## 事务与低敏 audit

POST 通过同一个数据库事务创建 transaction-scoped customer repository、mapping repository 和 audit repository。状态变更和成功 audit 任一步失败，整个事务失败。

Audit 固定：

- `resource = customer`
- `action = update`
- 成功 `resourceId = customerId`
- 无法安全绑定客户时不写 `resourceId`
- 不写自由文本原因
- 不写 proof 原始外部标识

新增稳定 reason：

- `wecom_customer_mapping_confirmed`
- `wecom_customer_mapping_rejected`
- `wecom_customer_mapping_revoked`
- `wecom_customer_mapping_conflict_blocked`
- `wecom_customer_mapping_invalid_transition`
- `wecom_customer_mapping_customer_not_found`

成功转换写 `transitioned`；冲突、无效转换、客户不可见写 `denied`。同状态同客户幂等不重复写状态和成功 audit。

## Customer timeline

不新增 timeline schema 或 migration。现有 `audit_events` 按 `resource = customer` 和 `resourceId = customerId` 聚合，`buildCustomerTimelineResponse` 已将 customer audit 直接转换为 `audit` 时间线节点。本任务通过 `wecom_customer_mapping_confirmed` audit fixture 验证映射成功事件会进入现有 customer timeline。

## UI

接入位置：

`AiConversationWorkbenchShell → 右侧 ProfilePanel → 企业微信客户关联`

模块展示固定匿名 proof、当前状态、当前客户低敏摘要、最多 20 条本机构候选，以及确认、拒绝、撤销操作。包含加载中、成功、冲突、无权限、加载失败和操作失败提示。

组件通过正式 `wecom-customer-mapping-client` 调用 mapping API，并由 client 对 GET / POST 响应执行低敏字段白名单映射；组件内不伪造业务结果。

- `tenant_admin` 可操作。
- `tenant_operator` 根据 GET `canWrite=false` 只读，选择框与全部操作按钮禁用。
- GET 401 / 403 或加载失败时失败关闭，不展示可写控件，不发 mutation。
- POST 403 后立即切换为只读。

边界文案固定展示：

- 仅人工关联
- 不自动匹配
- 不自动创建或合并客户
- 关联不代表允许触达
- 当前不调用真实企业微信

## 明确未包含

- schema 或 migration 修改
- package 或 lock 修改
- 自动匹配或匹配评分
- 按姓名、手机号、微信号或标签猜测
- 自动创建或合并客户
- 跨机构候选
- 真实企业微信读取、发送或出网
- 群发、自动回复、自动随访
- 聊天记录或会话内容存档
- worker、queue、scheduler、轮询
- dashboard 扩展
- 4F-F
