# V0.8 05C-A 企业微信客户运营字段白名单与数据对象契约

## 1. 结论摘要

05C-A 只定义企业微信客户运营数据对象、字段白名单和状态契约，**不实现同步**。本阶段不调用企业微信、不读取会话内容、不接入会话内容存档，也不处理真实外部联系人数据。

本文用于约束后续设计和 mock / demo 演练；其中的对象、字段和状态均为规划契约，不代表任何真实同步、数据落库或产品能力已实现。后续只有在获得单独授权后，05C-B 才能考虑 mock 外部联系人只读 domain。

## 2. 字段分类与通用规则

每个对象字段必须在设计、接口和展示层按以下三类处理：

| 分类 | 含义 | 使用规则 |
| --- | --- | --- |
| `allow` | 允许低敏展示 | 仅限本契约明确列出的低敏业务字段；仍受租户和授权范围限制。 |
| `masked_or_digest_only` | 只能脱敏或 digest | 不展示原值；只能使用不可逆 digest、脱敏片段或内部不透明引用。 |
| `forbidden` | 禁止存储或展示 | 不写入规划对象、接口响应、日志、审计详情或前端。 |

任何未列入 `allow` 或 `masked_or_digest_only` 的字段默认视为 `forbidden`。字段白名单不能因运营便利而绕过租户隔离、授权状态或人工复核。

## 3. 数据对象契约

以下对象均为规划，不构成 schema、API、repository 或同步实现授权。

### 3.1 WeComTenantAuthorization

| 分类 | 规划字段 |
| --- | --- |
| `allow` | `authorizationStatus`、`providerState`、`authorizedAtDate`、`expiresAtDate`、`manualReviewState`、`lastPreflightAt` |
| `masked_or_digest_only` | `tenantId` 的内部不透明引用、`corpIdDigest`、授权记录引用 |
| `forbidden` | `access_token`、`secret`、原始 corpId、原始授权响应、任何凭证或 webhook 原文 |

### 3.2 WeComExternalContactReadonly

| 分类 | 规划字段 |
| --- | --- |
| `allow` | `displayName`、`sourceType`、`addedAtDate`、`remarkSummary`、`mappingStatus`、`syncStatus`、`manualReviewState`、`lastSyncedAt` |
| `masked_or_digest_only` | `external_userid_digest`、外部联系人内部引用、低敏标签引用 |
| `forbidden` | 原始 `external_userid`、原始手机号、身份证号、客户完整敏感资料、原始聊天内容、原始 API response |

### 3.3 WeComFollowUserReadonly

| 分类 | 规划字段 |
| --- | --- |
| `allow` | `displayName`、归属状态、所属机构低敏摘要 |
| `masked_or_digest_only` | `follow_userid_digest`、员工内部不透明引用 |
| `forbidden` | 原始 `userid`、手机号、邮箱、身份证号、原始人员响应 |

### 3.4 WeComCustomerTagReadonly

| 分类 | 规划字段 |
| --- | --- |
| `allow` | `tagName`、标签来源类型、标签状态 |
| `masked_or_digest_only` | `tagIdDigest`、标签内部不透明引用 |
| `forbidden` | 原始标签标识与可反推客户敏感身份的标签 payload |

### 3.5 WeComCustomerMappingCandidate

| 分类 | 规划字段 |
| --- | --- |
| `allow` | `mappingStatus`、`confidenceLevel`、`matchReasonCode`、`manualReviewState`、`createdAt`、`updatedAt` |
| `masked_or_digest_only` | `externalContactDigest`、`systemCustomerReference`、匹配记录引用 |
| `forbidden` | 手机号明文、身份证号、原始客户标识、原始外部联系人标识、可直接覆盖客户档案的未复核匹配结果 |

### 3.6 WeComSyncSnapshot

| 分类 | 规划字段 |
| --- | --- |
| `allow` | `syncStatus`、`scopeSummary`、`startedAt`、`finishedAt`、计数摘要、`manualReviewState` |
| `masked_or_digest_only` | `snapshotId`、`tenantReference`、限定批次引用 |
| `forbidden` | 原始 API response 全量、原始分页游标、未脱敏 webhook payload、凭证、全量客户资料 |

### 3.7 WeComAuditEvent

| 分类 | 规划字段 |
| --- | --- |
| `allow` | `eventType`、`occurredAt`、`actorRole`、`resultStatus`、固定低敏 `reasonCode`、租户治理摘要 |
| `masked_or_digest_only` | `tenantReference`、对象 digest、操作引用 |
| `forbidden` | secret、token、原始客户资料、聊天原文、原始请求或响应 payload、自由文本敏感诊断 |

### 3.8 WeComManualReviewState

| 分类 | 规划字段 |
| --- | --- |
| `allow` | `reviewStatus`、固定 `reasonCode`、`reviewedAt`、下一步固定动作、低敏操作者角色 |
| `masked_or_digest_only` | 对象 digest、人工复核记录引用 |
| `forbidden` | 敏感自由文本、聊天内容、原始身份标识、凭证、未脱敏外部响应 |

## 4. 低敏展示字段与禁止字段汇总

### 低敏展示字段

- 外部联系人展示名。
- `external_userid_digest`。
- 归属员工展示名。
- `follow_userid_digest`。
- 标签名称。
- 来源类型。
- 添加日期。
- 备注低敏摘要。
- 匹配状态。
- 最近同步时间。
- 同步状态。
- 人工复核状态。

### 禁止字段

- `access_token`。
- `secret`。
- 原始 `external_userid`。
- 原始 `userid`。
- 原始手机号。
- 身份证号。
- 原始聊天内容。
- 会话内容存档密钥。
- 未脱敏 webhook payload。
- 原始 API response 的全量落库或展示。

## 5. 状态枚举契约

以下枚举仅定义契约语义，不代表运行时状态机已实现。

### 授权状态

`not_configured` / `authorized` / `revoked` / `expired` / `disabled` / `external_disabled` / `manual_review_required`

### 同步状态

`not_started` / `mock_ready` / `preflight_ready` / `syncing_disabled` / `sync_failed` / `manual_review_required`

### 匹配状态

`unmatched` / `candidate` / `matched` / `conflict` / `rejected` / `manual_review_required`

### 人工复核状态

`not_required` / `pending` / `approved` / `rejected` / `needs_more_info`

## 6. 租户隔离与授权规则

- 机构端只能查看本机构授权范围内的低敏数据。
- 平台端只能查看治理状态和低敏摘要，不能查看客户敏感明细。
- 没有明确授权时，不能同步，也不能展示真实外部联系人。
- provider 默认保持 disabled / fail-closed；授权存在不等于外部能力可调用。
- 所有对象必须携带可验证的租户范围；不得用跨租户查询、全局列表或默认租户补全绕过隔离。

## 7. mock / demo 契约

- 第一阶段只允许 mock / demo 数据。
- mock 数据必须可识别为 mock，且与真实数据来源明确隔离。
- 不允许混入真实客户、真实外部联系人或真实员工数据。
- 不允许使用真实 `external_userid`、`userid` 或手机号。
- mock 数据只能验证字段分类、授权状态、匹配状态、审计和人工复核的契约语义。

## 8. 审计事件契约

规划的事件类型如下：

- `authorization_status_changed`
- `sync_preflight_checked`
- `mock_snapshot_generated`
- `mapping_candidate_generated`
- `mapping_manual_review_updated`
- `forbidden_field_blocked`
- `external_provider_disabled`

每个事件只允许记录固定事件类型、固定低敏 reason code、租户范围摘要和对象 digest。事件不得承载 token、secret、聊天内容、完整客户资料或原始外部响应。

## 9. 后续切片建议

- **05C-B**：mock 外部联系人只读 domain。
- **05C-C**：机构端只读 API / 页面。
- **05C-D**：平台端授权与同步健康只读治理。

不建议直接真实同步。任何真实同步 proof 都必须另行获得用户授权，并先满足字段白名单、租户隔离、审计、人工复核和受控环境等前置条件。
