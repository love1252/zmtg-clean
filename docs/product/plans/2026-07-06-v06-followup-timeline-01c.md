# V0.6-FOLLOWUP-TIMELINE-01C 客户随访轨迹

日期：2026-07-07

## 目标

在客户详情中沉淀并展示治疗后随访执行轨迹，让运营人员能够看到路径纳入、阶段任务生成、任务状态变化、消息草稿生成与人工处理、低敏人工反馈，以及整体路径进度和风险概览。

## 范围

本切片复用现有客户、治疗摘要、随访路径、随访任务和消息草稿能力，新增最小随访客户 timeline 事件模型。

新增能力：

- 随访关键动作写入低敏 timeline event。
- 客户详情 API 聚合随访 timeline 与 overview。
- 客户详情抽屉新增“治疗后管理 / 随访轨迹”区域。
- 支持人工记录低敏反馈 / 备注。
- 保持 tenant / institution 隔离。
- API response 使用白名单字段。

## 事件类型

- `followup_path_enrolled`
- `followup_path_cancelled`
- `followup_tasks_generated`
- `followup_task_status_changed`
- `followup_task_escalated`
- `message_draft_created`
- `message_draft_updated`
- `message_draft_approved`
- `message_draft_rejected`
- `message_draft_marked_sent`
- `manual_feedback_recorded`

## API

- `GET /api/institution/customers/[customerId]/followup-timeline`
- `GET /api/institution/customers/[customerId]/followup-overview`
- `POST /api/institution/customers/[customerId]/followup-feedback`
- `GET /api/institution/customers/[customerId]/timeline` 已聚合返回：
  - `followUpTimelineEvents`
  - `followUpOverview`

## 安全边界

- 不真实发送微信 / 企业微信 / 短信。
- 不做电话外呼。
- 不接外部消息渠道、自动回复、HIS、外部 webhook。
- 不调用真实 AI provider。
- 不保存手机号原文、身份证、病历号、HIS payload。
- 不返回 provider、model、token、cost、vendor、prompt、raw AI response、secret。
- 标记已发送仅代表人工记录，不代表系统自动发送。

## UI 文案

客户详情页“治疗后管理 / 随访轨迹”区域明确展示：

> 这里只展示内部随访执行记录，不代表已自动联系客户；标记已发送仅代表人工记录。当前没有企业微信 / 短信接入。

## 数据库

新增 `follow_up_customer_timeline_events`，包含：

- tenant / institution / customer scope
- source type / source id
- event type
- event title
- safe summary
- risk level
- occurred at
- safe reason code
- metadata json

索引：

- `tenant_id, institution_id, customer_id, occurred_at`
- `tenant_id, source_type, source_id, event_type`
- `tenant_id, event_type, occurred_at`

幂等约束：

- `tenant_id, source_type, source_id, event_type`

## 测试关注

- domain DTO 白名单。
- 客户详情 API 不泄露敏感字段。
- 客户详情 UI 展示 KPI、时间线与无自动发送提示。
- 路径纳入 / 任务生成写 timeline。
- 草稿生成 / 确认 / 标记发送写 timeline。
- 01A / 01B 行为不回归。

## 验证结果

- `node scripts/run-vitest.mjs run src/modules/institution/tests`：78 files / 1117 tests passed。
- `node scripts/run-vitest.mjs run src/modules/open-platform/tests`：94 files / 650 tests passed。
- `node scripts/run-vitest.mjs run src/modules/knowledge-base/tests`：11 files / 80 tests passed。
- `node scripts/run-vitest.mjs run`：219 files / 2201 tests passed。
- `./node_modules/.bin/eslint .`：0 errors，4 existing warnings。
- `node scripts/run-next.mjs build --webpack`：passed。
- `./node_modules/.bin/drizzle-kit check`：passed。
- `git diff --check`：passed。
