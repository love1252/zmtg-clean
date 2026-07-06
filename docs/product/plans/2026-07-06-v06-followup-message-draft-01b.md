# V0.6-FOLLOWUP-MESSAGE-DRAFT-01B 随访话术模板与消息草稿

## 日期

2026-07-06

## 范围

本切片在 01A 路径纳入和阶段任务基础上，补齐随访任务的消息草稿闭环：

1. `message template` 最小模型。
2. `message draft` 最小模型。
3. 根据 `follow-up task` 生成低敏草稿。
4. 草稿绑定 `follow-up task` / `enrollment` / `stage`。
5. 人工编辑、人工确认、人工拒绝、人工标记已发送。
6. `SmartFollowUpShell` 在今日任务卡片展示草稿状态与操作入口。

## 明确不包含

1. 不真实发送微信。
2. 不真实发送企业微信。
3. 不真实发送短信。
4. 不做电话外呼。
5. 不接外部渠道。
6. 不接客户回复。
7. 不做自动营销群发。
8. 不调用真实 AI 生成客户可见话术。
9. 不接 HIS。
10. 不新增 worker / queue / cron。
11. 不保存 provider / token / cost / vendor。

## 数据模型

### follow_up_message_templates

用途：保存租户或机构可用的人工话术模板。

关键字段：

- `tenant_id`
- `institution_id`
- `template_key`
- `template_name`
- `template_type`
- `applicable_template_key`
- `applicable_node_key`
- `channel_type = manual`
- `content_template`
- `requires_human_approval = true`
- `forbid_auto_send = true`

### follow_up_message_drafts

用途：保存针对随访任务生成的内部草稿。

关键字段：

- `tenant_id`
- `institution_id`
- `follow_up_task_id`
- `enrollment_id`
- `stage_id`
- `customer_id`
- `template_id`
- `channel_type = manual`
- `status`
- `draft_content`
- `edited_content`
- `safe_preview`
- `approved_at`
- `rejected_at`
- `marked_sent_at`
- `safe_reason_code`
- `metadata_json`

索引覆盖：

- `tenant_id / institution_id`
- `follow_up_task_id`
- `customer_id`
- `status`
- `created_at`

## 状态流转

允许：

1. `draft -> approved`
2. `draft -> rejected`
3. `approved -> marked_sent`
4. `draft -> cancelled`：domain 预留

禁止：

1. `rejected -> marked_sent`
2. `marked_sent` 后再次编辑
3. 跨 tenant / institution 读取或写入

## 草稿生成规则

草稿只使用低敏字段：

- `customerDisplayName`
- `task.stage`
- `task.suggestedAction`
- `dueAt`
- `templateKey`
- `nodeKey`

禁止使用：

- 手机号原文
- 身份证
- 病历号
- 完整治疗原文
- HIS payload
- provider / model / token / vendor / prompt / raw AI response

没有可用模板时，生成通用低敏 fallback 草稿。

## API 白名单

新增 API：

1. `GET /api/institution/followup-message-templates`
2. `GET /api/institution/followup-message-drafts?taskId=...`
3. `POST /api/institution/followup-message-drafts`
4. `PATCH /api/institution/followup-message-drafts/[draftId]`
5. `POST /api/institution/followup-message-drafts/[draftId]/approve`
6. `POST /api/institution/followup-message-drafts/[draftId]/reject`
7. `POST /api/institution/followup-message-drafts/[draftId]/mark-sent`

草稿响应只返回：

- `draftId`
- `followUpTaskId`
- `customerId`
- `customerDisplayName`
- `channelType`
- `status`
- `safePreview`
- `draftContent`
- `editedContent`
- `approvedAt`
- `markedSentAt`
- `safeReasonCode`
- `createdAt`
- `updatedAt`

不返回：

- `tenantId`
- `institutionId`
- `templateId`
- `approvedBy`
- `rejectedBy`
- `markedSentBy`
- `metadataJson`
- provider / model / token / cost / vendor
- prompt / raw AI response
- secret / API key / baseUrl

## 审计与隔离

所有读写入口继续使用 `follow_up` resource 权限，按 `tenantId` 与 `institutionId` 调 repository。

审计只记录低敏 reason，例如：

- `message_draft_created`
- `message_draft_updated`
- `message_draft_approved`
- `message_draft_rejected`
- `message_draft_marked_sent`
- `follow_up_message_draft_exists`
- `unsafe_follow_up_message_content`

## UI

`SmartFollowUpShell` 今日任务卡片新增“消息草稿”区域：

1. 无草稿时显示“生成草稿”。
2. 有草稿时显示状态和低敏预览。
3. `draft` 状态支持编辑、保存、人工确认、拒绝。
4. `approved` 状态支持标记已人工发送。
5. 页面明确展示：仅生成低敏草稿，不会自动发送消息；需要人工确认，当前没有企业微信 / 短信接入。

## 测试覆盖

新增/更新测试覆盖：

1. 根据 follow-up task 创建 message draft。
2. 无模板时 fallback 草稿可生成。
3. 水光 / 光电 / 术后修复任务生成差异化话术。
4. 草稿只使用低敏字段。
5. 草稿不包含手机号 / 身份证 / 病历号 / HIS payload。
6. `draft -> approved`。
7. `draft -> rejected`。
8. `approved -> marked_sent`。
9. `rejected` 不能 `marked_sent`。
10. `marked_sent` 不能编辑。
11. 跨 tenant / institution 通过 service/repository 输入隔离。
12. 生成草稿不真实出网。
13. 生成草稿不调用 provider。
14. `mark_sent` 不真实发送。
15. API response 白名单。
16. `SmartFollowUpShell` 展示草稿状态。
17. `SmartFollowUpShell` 明确不自动发送、不接企微/短信。
18. 既有 01A enrollment / follow-up task 测试继续作为回归。

## 后续建议

### 01C

增加草稿模板运营配置页，支持机构管理员维护模板启停、适用路径和节点，但仍不接真实渠道。

### 01D

增加客户时间线里的草稿事件聚合展示，让确认、拒绝、标记已发送在客户视角可复盘。

### V0.7

如需接企业微信或短信，应单独设计 channel / delivery / callback / retry / opt-out / consent / rate limit，不复用本切片的 `marked_sent` 作为真实发送记录。
